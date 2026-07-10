import { type ChildProcess, spawn } from "node:child_process";
import { closeSync, promises as fs, openSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAuth } from "@atlashq/auth";
import { createDatabaseClient, type DatabaseClient, migrateDatabase } from "@atlashq/db";
import type { FullConfig } from "@playwright/test";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import {
  E2E_API_URL,
  E2E_BASE_URL,
  E2E_ORGANIZATION_NAME,
  E2E_USER_EMAIL,
  E2E_USER_NAME,
  E2E_USER_PASSWORD,
} from "./support/test-data";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RUNTIME_DIR = join(ROOT, "tests", "e2e", ".runtime");
const POSTGRES_IMAGE = "postgres:17-alpine";
const AUTH_SECRET = "atlashq-e2e-only-auth-secret-0123456789abcdef";
const IS_WINDOWS = process.platform === "win32";

type StartedProcess = {
  name: string;
  child: ChildProcess;
  logPath: string;
  logFd: number;
  logClosed: boolean;
};

const startedProcesses: StartedProcess[] = [];
let container: StartedPostgreSqlContainer | undefined;
let databaseClient: DatabaseClient | undefined;
let cleanupStarted = false;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

function startProcess(
  name: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): StartedProcess {
  const logPath = join(RUNTIME_DIR, `${name}.log`);
  const logFd = openSync(logPath, "w");
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: !IS_WINDOWS,
    env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
  });

  if (!child.pid) {
    closeSync(logFd);
    throw new Error(`Failed to start ${name}.`);
  }

  const started = { name, child, logPath, logFd, logClosed: false };
  startedProcesses.push(started);
  return started;
}

function closeProcessLog(process: StartedProcess): void {
  if (!process.logClosed) {
    closeSync(process.logFd);
    process.logClosed = true;
  }
}

async function readLogTail(logPath: string): Promise<string> {
  try {
    const content = await fs.readFile(logPath, "utf8");
    return content.slice(-8_000);
  } catch {
    return "";
  }
}

async function waitForHttp(
  url: string,
  process: StartedProcess,
  validate: (response: Response) => Promise<boolean>,
  requestInit: RequestInit = {},
): Promise<void> {
  const deadline = Date.now() + 45_000;
  let lastError = "No response received.";

  while (Date.now() < deadline) {
    if (process.child.exitCode !== null) {
      const log = await readLogTail(process.logPath);
      throw new Error(`${process.name} exited early (${process.child.exitCode}).\n${log}`);
    }

    try {
      const response = await fetch(url, {
        ...requestInit,
        signal: AbortSignal.timeout(2_000),
      });
      if (await validate(response)) {
        return;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await delay(250);
  }

  const log = await readLogTail(process.logPath);
  throw new Error(`Timed out waiting for ${url}: ${lastError}\n${log}`);
}

function isMissingProcessError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
}

async function waitForProcessExit(process: StartedProcess, timeoutMs: number): Promise<void> {
  if (process.child.exitCode !== null) {
    return;
  }

  await Promise.race([
    new Promise<void>((resolve) => process.child.once("exit", () => resolve())),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${process.name} did not exit after termination.`)),
        timeoutMs,
      ),
    ),
  ]);
}

async function stopWindowsProcessTree(process: StartedProcess): Promise<void> {
  const script = `
function Stop-ExactTree([int]$ProcessId) {
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
  foreach ($childProcess in $children) {
    Stop-ExactTree ([int]$childProcess.ProcessId)
  }
  if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Stop-ExactTree ${process.child.pid}
`;

  await new Promise<void>((resolve, reject) => {
    const stopper = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
    stopper.once("error", reject);
    stopper.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to stop ${process.name} process tree (exit ${code}).`));
      }
    });
  });

  await waitForProcessExit(process, 5_000);
}

async function stopPosixProcessGroup(process: StartedProcess): Promise<void> {
  const processId = process.child.pid;
  if (!processId) {
    return;
  }
  const processGroupId = -processId;

  try {
    globalThis.process.kill(processGroupId, "SIGTERM");
  } catch (error) {
    if (!isMissingProcessError(error)) {
      throw error;
    }
  }

  try {
    await waitForProcessExit(process, 5_000);
  } catch {
    try {
      globalThis.process.kill(processGroupId, "SIGKILL");
    } catch (killError) {
      if (!isMissingProcessError(killError)) {
        throw killError;
      }
    }
    if (process.child.exitCode === null) {
      await waitForProcessExit(process, 5_000);
    }
  }
}

async function stopExactProcessTree(process: StartedProcess): Promise<void> {
  const { child } = process;
  if (!child.pid || child.exitCode !== null) {
    closeProcessLog(process);
    return;
  }

  try {
    if (IS_WINDOWS) {
      await stopWindowsProcessTree(process);
    } else {
      await stopPosixProcessGroup(process);
    }
  } finally {
    closeProcessLog(process);
  }
}

async function cleanup(): Promise<void> {
  if (cleanupStarted) {
    return;
  }
  cleanupStarted = true;

  const cleanupErrors: unknown[] = [];

  for (const process of [...startedProcesses].reverse()) {
    try {
      await stopExactProcessTree(process);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  startedProcesses.length = 0;

  try {
    await databaseClient?.close();
  } catch (error) {
    cleanupErrors.push(error);
  } finally {
    databaseClient = undefined;
  }

  try {
    await container?.stop();
  } catch (error) {
    cleanupErrors.push(error);
  } finally {
    container = undefined;
  }

  try {
    await fs.rm(RUNTIME_DIR, { recursive: true, force: true });
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "E2E infrastructure cleanup failed.");
  }
}

async function provisionAdmin(organizationId: string): Promise<void> {
  if (!databaseClient) {
    throw new Error("E2E database client was not initialized.");
  }

  // Provision the admin directly through a trusted, NON-mounted Better Auth
  // instance with public sign-up explicitly enabled. This mirrors the initial-
  // admin provisioning CLI and never uses public HTTP sign-up (which the mounted
  // E2E API rejects, exactly as in production). The browser login flow under
  // test continues to exercise the real, still-enabled sign-in route.
  const provisioningAuth = createAuth({
    db: databaseClient.db,
    env: {
      NODE_ENV: "test",
      AUTH_SECRET,
      AUTH_URL: E2E_BASE_URL,
      WEB_ORIGIN: E2E_BASE_URL,
    },
    allowSignUp: true,
  });

  await provisioningAuth.api.signUpEmail({
    body: {
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
      name: E2E_USER_NAME,
      organizationId,
    },
  });

  const result = await databaseClient.pool.query(
    `UPDATE "user"
     SET organization_role = 'admin', updated_at = now()
     WHERE email = $1
     RETURNING id`,
    [E2E_USER_EMAIL],
  );

  if (result?.rowCount !== 1) {
    throw new Error("E2E admin user was not provisioned and promoted to organization admin.");
  }
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  try {
    await fs.rm(RUNTIME_DIR, { recursive: true, force: true });
    await fs.mkdir(RUNTIME_DIR, { recursive: true });
    await Promise.all([assertPortAvailable(3000), assertPortAvailable(4187)]);

    container = await new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase("atlashq_e2e").start();
    databaseClient = createDatabaseClient({ connectionString: container.getConnectionUri() });
    await migrateDatabase(databaseClient);

    const organizationResult = await databaseClient.pool.query<{ id: string }>(
      `INSERT INTO organization (name) VALUES ($1) RETURNING id`,
      [E2E_ORGANIZATION_NAME],
    );
    const organizationId = organizationResult.rows[0]?.id;
    if (!organizationId) {
      throw new Error("Failed to seed the E2E organization.");
    }

    const environmentWithoutS3 = { ...process.env };
    delete environmentWithoutS3.S3_ENDPOINT;
    delete environmentWithoutS3.S3_ACCESS_KEY_ID;
    delete environmentWithoutS3.S3_SECRET_ACCESS_KEY;
    delete environmentWithoutS3.S3_BUCKET;

    const apiProcess = startProcess(
      "api",
      process.execPath,
      [join(ROOT, "apps", "api", "dist", "main.js")],
      {
        ...environmentWithoutS3,
        NODE_ENV: "test",
        PORT: "3000",
        DATABASE_URL: container.getConnectionUri(),
        REDIS_URL: "redis://127.0.0.1:6399/15",
        AUTH_SECRET,
        AUTH_URL: E2E_BASE_URL,
        WEB_ORIGIN: E2E_BASE_URL,
        LOG_LEVEL: "info",
      },
    );
    await waitForHttp(`${E2E_API_URL}/api/v1/health`, apiProcess, async (response) => {
      if (!response.ok) {
        return false;
      }
      const body = (await response.json()) as { status?: string };
      return body.status === "ok";
    });

    const webProcess = startProcess(
      "web",
      process.execPath,
      [
        join(ROOT, "apps", "web", "node_modules", "vite", "bin", "vite.js"),
        join(ROOT, "apps", "web"),
        "--host",
        "127.0.0.1",
        "--port",
        "4187",
        "--strictPort",
      ],
      {
        ...process.env,
        VITE_DEV_API_PROXY_TARGET: E2E_API_URL,
      },
    );
    await waitForHttp(
      `${E2E_BASE_URL}/login`,
      webProcess,
      async (response) => {
        if (!response.ok) {
          return false;
        }
        return (await response.text()).includes('<div id="root"></div>');
      },
      {
        headers: { accept: "text/html" },
      },
    );

    await provisionAdmin(organizationId);

    return cleanup;
  } catch (error) {
    const logs = await Promise.all(
      startedProcesses.map(async (process) => {
        const tail = await readLogTail(process.logPath);
        return tail ? `\n--- ${process.name}.log ---\n${tail}` : "";
      }),
    );

    try {
      await cleanup();
    } catch (cleanupError) {
      logs.push(`\n--- cleanup error ---\n${String(cleanupError)}`);
    }

    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    throw new Error(`${message}${logs.join("")}`);
  }
}
