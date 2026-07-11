import { type ChildProcess, spawn } from "node:child_process";
import { closeSync, promises as fs, openSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAuth } from "@atlashq/auth";
import { createDatabaseClient, type DatabaseClient, migrateDatabase } from "@atlashq/db";
import { createMinioStorageClient } from "@atlashq/storage";
import { chromium, type FullConfig } from "@playwright/test";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import {
  E2E_API_URL,
  E2E_BASE_URL,
  E2E_MEMBER_EMAIL,
  E2E_MEMBER_NAME,
  E2E_MEMBER_PASSWORD,
  E2E_ORGANIZATION_NAME,
  E2E_USER_EMAIL,
  E2E_USER_NAME,
  E2E_USER_PASSWORD,
} from "./support/test-data";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RUNTIME_DIR = join(ROOT, "tests", "e2e", ".runtime");
const POSTGRES_IMAGE = "postgres:17-alpine";
const REDIS_IMAGE = "redis:8-alpine";
const MINIO_IMAGE = "minio/minio:RELEASE.2025-09-07T16-13-09Z";
const CLAMAV_IMAGE = "clamav/clamav:1.5.3-debian13-slim";
const AUTH_SECRET = "atlashq-e2e-only-auth-secret-0123456789abcdef";
const IS_WINDOWS = process.platform === "win32";

// Dedicated credentials/bucket for this suite only -- distinct from docker-compose's
// `atlashq-local` bucket and the worker integration suite's `atlashq-worker-integration`
// bucket, so none of the disposable Testcontainers-managed stacks can collide.
const MINIO_ACCESS_KEY_ID = "e2e-playwright-minio-access";
const MINIO_SECRET_ACCESS_KEY = "e2e-playwright-minio-secret";
const MINIO_BUCKET = "atlashq-e2e-playwright";

type StartedProcess = {
  name: string;
  child: ChildProcess;
  logPath: string;
  logFd: number;
  logClosed: boolean;
};

const startedProcesses: StartedProcess[] = [];
let container: StartedPostgreSqlContainer | undefined;
let redisContainer: StartedTestContainer | undefined;
let minioContainer: StartedTestContainer | undefined;
let clamavContainer: StartedTestContainer | undefined;
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

/**
 * The worker has no HTTP server, so readiness is polled by repeatedly spawning its one-shot
 * `health-cli.js` (module-02 §9, §10) -- the same script `pnpm --filter @atlashq/worker health`
 * runs -- against the shared database/redis/storage/clamav until it reports `status: "ok"`.
 */
async function waitForWorkerReady(
  env: NodeJS.ProcessEnv,
  workerProcess: StartedProcess,
): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError = "No health check attempted.";

  while (Date.now() < deadline) {
    if (workerProcess.child.exitCode !== null) {
      const log = await readLogTail(workerProcess.logPath);
      throw new Error(
        `${workerProcess.name} exited early (${workerProcess.child.exitCode}).\n${log}`,
      );
    }

    const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
      const child = spawn(
        process.execPath,
        [join(ROOT, "apps", "worker", "dist", "health-cli.js")],
        {
          cwd: ROOT,
          env,
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout?.on("data", (chunk) => {
        output += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        output += String(chunk);
      });
      child.once("exit", (code) => resolve({ code, output }));
      child.once("error", (error) => resolve({ code: -1, output: String(error) }));
    });

    if (result.code === 0) {
      return;
    }
    lastError = result.output.trim() || `health-cli exited with code ${result.code}`;

    await delay(500);
  }

  const log = await readLogTail(workerProcess.logPath);
  throw new Error(`Timed out waiting for worker readiness: ${lastError}\n${log}`);
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

  const containerStopResults = await Promise.allSettled([
    redisContainer?.stop(),
    minioContainer?.stop(),
    clamavContainer?.stop(),
  ]);
  for (const result of containerStopResults) {
    if (result.status === "rejected") {
      cleanupErrors.push(result.reason);
    }
  }
  redisContainer = undefined;
  minioContainer = undefined;
  clamavContainer = undefined;

  try {
    await fs.rm(RUNTIME_DIR, { recursive: true, force: true });
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "E2E infrastructure cleanup failed.");
  }
}

async function provisionUsers(organizationId: string): Promise<void> {
  if (!databaseClient) {
    throw new Error("E2E database client was not initialized.");
  }

  // Provision both users directly through a trusted, NON-mounted Better Auth
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

  // A second, non-admin organization member for the Source Vault permission-boundary coverage
  // (module-02 §7): stays at the default organization role and is added to a project with a
  // non-admin project role by the spec itself, through the real UI membership flow.
  await provisioningAuth.api.signUpEmail({
    body: {
      email: E2E_MEMBER_EMAIL,
      password: E2E_MEMBER_PASSWORD,
      name: E2E_MEMBER_NAME,
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

/**
 * Vite's dev server optimizes dependencies lazily: the *first* time the browser's module graph
 * discovers a dependency the initial esbuild scan missed (routing is TanStack Router's file-based
 * lazy-loaded route tree here), Vite silently forces a full page reload once the new pre-bundle is
 * ready. Any fetch in flight at that exact moment (e.g. Better Auth's session check) is aborted
 * with a generic "Failed to fetch", which showed up as flaky, unrelated-looking spec failures.
 * Running one throwaway navigation through both the unauthenticated and authenticated route
 * trees here lets that one-time forced reload happen during setup instead of during a real test.
 */
async function warmUpWebDevServer(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${E2E_BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(E2E_USER_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(E2E_USER_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/projects$/, { waitUntil: "networkidle" });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  try {
    await fs.rm(RUNTIME_DIR, { recursive: true, force: true });
    await fs.mkdir(RUNTIME_DIR, { recursive: true });
    await Promise.all([assertPortAvailable(3000), assertPortAvailable(4187)]);

    [container, redisContainer, minioContainer, clamavContainer] = await Promise.all([
      new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase("atlashq_e2e").start(),
      new GenericContainer(REDIS_IMAGE)
        .withExposedPorts(6379)
        .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/u))
        .start(),
      new GenericContainer(MINIO_IMAGE)
        .withCommand(["server", "/data"])
        .withEnvironment({
          MINIO_ROOT_USER: MINIO_ACCESS_KEY_ID,
          MINIO_ROOT_PASSWORD: MINIO_SECRET_ACCESS_KEY,
          // Lets the browser PUT directly to MinIO's presigned upload URLs (module-02 §9.1):
          // `mc cors set` cannot be used here because this exact pinned `mc` release requires an
          // XML CORS document (the shared docker-compose bootstrap script writes JSON, and its
          // bundled bucket-versioning check also depends on a `grep` binary this `mc` image
          // doesn't ship) -- the server-level env var configures the same behavior directly and
          // is independent of both issues.
          MINIO_API_CORS_ALLOW_ORIGIN: E2E_BASE_URL,
        })
        .withExposedPorts(9000)
        .withWaitStrategy(Wait.forHttp("/minio/health/live", 9000))
        .start(),
      new GenericContainer(CLAMAV_IMAGE)
        .withExposedPorts(3310)
        // ClamAV needs real time to load its bundled signature database before clamd's socket is
        // ready; this exact log line is what docker-compose's own healthcheck effectively waits on.
        .withWaitStrategy(Wait.forLogMessage(/socket found, clamd started\.?/u))
        .withStartupTimeout(180_000)
        .start(),
    ]);

    databaseClient = createDatabaseClient({ connectionString: container.getConnectionUri() });
    await migrateDatabase(databaseClient);

    const organizationResult = await databaseClient.pool.query<{ id: string }>(
      `INSERT INTO organization (name, settings) VALUES ($1, $2::jsonb) RETURNING id`,
      [E2E_ORGANIZATION_NAME, JSON.stringify({ source_vault_writes_enabled: true })],
    );
    const organizationId = organizationResult.rows[0]?.id;
    if (!organizationId) {
      throw new Error("Failed to seed the E2E organization.");
    }

    const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
    const s3Endpoint = `http://${minioContainer.getHost()}:${minioContainer.getMappedPort(9000)}`;
    const clamavHost = clamavContainer.getHost();
    const clamavPort = String(clamavContainer.getMappedPort(3310));

    const storage = createMinioStorageClient({
      endpoint: s3Endpoint,
      accessKeyId: MINIO_ACCESS_KEY_ID,
      secretAccessKey: MINIO_SECRET_ACCESS_KEY,
      bucket: MINIO_BUCKET,
    });
    await storage.bootstrapBucket();

    const storageEnv = {
      S3_ENDPOINT: s3Endpoint,
      S3_ACCESS_KEY_ID: MINIO_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: MINIO_SECRET_ACCESS_KEY,
      S3_BUCKET: MINIO_BUCKET,
    };

    const apiProcess = startProcess(
      "api",
      process.execPath,
      [join(ROOT, "apps", "api", "dist", "main.js")],
      {
        ...process.env,
        ...storageEnv,
        NODE_ENV: "test",
        PORT: "3000",
        DATABASE_URL: container.getConnectionUri(),
        REDIS_URL: redisUrl,
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

    const workerEnv = {
      ...process.env,
      ...storageEnv,
      NODE_ENV: "test",
      DATABASE_URL: container.getConnectionUri(),
      REDIS_URL: redisUrl,
      CLAMAV_HOST: clamavHost,
      CLAMAV_PORT: clamavPort,
      LOG_LEVEL: "info",
    };
    const workerProcess = startProcess(
      "worker",
      process.execPath,
      [join(ROOT, "apps", "worker", "dist", "main.js")],
      workerEnv,
    );
    await waitForWorkerReady(workerEnv, workerProcess);

    await provisionUsers(organizationId);
    await warmUpWebDevServer();

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
