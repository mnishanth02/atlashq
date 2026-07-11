import type { Socket, TcpNetConnectOpts } from "node:net";
import { connect as createConnection } from "node:net";
import type { Readable } from "node:stream";

export type ClamAvClientOptions = {
  host: string;
  port: number;
  timeoutMs: number;
};

export type ClamAvVersion = {
  raw: string;
  engineVersion: string | null;
  signatureVersion: string | null;
  signatureTimestamp: string | null;
};

type ClamAvResultBase = {
  endpoint: string;
  durationMs: number;
  completedAt: string;
};

export type ClamAvCleanResult = ClamAvResultBase & {
  status: "clean";
  signature: null;
  bytesScanned: number;
  version: ClamAvVersion;
};

export type ClamAvInfectedResult = ClamAvResultBase & {
  status: "infected";
  signature: string;
  bytesScanned: number;
  version: ClamAvVersion;
};

export type ClamAvUnavailableResult = ClamAvResultBase & {
  status: "unavailable";
  retryable: true;
  reason: string;
};

export type ClamAvTimeoutResult = ClamAvResultBase & {
  status: "timeout";
  retryable: true;
  timeoutMs: number;
};

export type ClamAvProtocolErrorResult = ClamAvResultBase & {
  status: "protocol-error";
  retryable: false;
  reason: string;
  rawResponse: string | null;
};

export type ClamAvScanResult =
  | ClamAvCleanResult
  | ClamAvInfectedResult
  | ClamAvUnavailableResult
  | ClamAvTimeoutResult
  | ClamAvProtocolErrorResult;

export type ClamAvClient = {
  getVersion(): Promise<
    ClamAvVersion | ClamAvUnavailableResult | ClamAvTimeoutResult | ClamAvProtocolErrorResult
  >;
  scanStream(stream: Readable): Promise<ClamAvScanResult>;
};

export type ClamAvClientDependencies = {
  connect?: typeof createConnection;
  now?: () => Date;
};

export function createClamAvClient(
  options: ClamAvClientOptions,
  dependencies: ClamAvClientDependencies = {},
): ClamAvClient {
  const connectFn = dependencies.connect ?? createConnection;
  const now = dependencies.now ?? (() => new Date());
  const endpoint = `${options.host}:${options.port}`;

  return {
    async getVersion() {
      const startedAt = now();

      try {
        const raw = await sendSimpleCommand(connectFn, options, "zVERSION\0");
        const version = parseVersionResponse(raw);

        if (!version) {
          return protocolError(endpoint, startedAt, now(), "Invalid VERSION response.", raw);
        }

        return version;
      } catch (error) {
        return mapClamAvError(endpoint, startedAt, now(), options.timeoutMs, error);
      }
    },
    async scanStream(stream) {
      const startedAt = now();
      const versionResponse = await this.getVersion();
      if ("status" in versionResponse) {
        return versionResponse;
      }

      const version = versionResponse;

      try {
        const scan = await sendInstream(connectFn, options, stream);
        const completedAt = now();
        const common = {
          endpoint,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          completedAt: completedAt.toISOString(),
        } as const;

        const cleanMatch = /^stream: OK$/u.exec(scan.response);
        if (cleanMatch) {
          return {
            ...common,
            status: "clean",
            signature: null,
            bytesScanned: scan.bytesScanned,
            version,
          };
        }

        const infectedMatch = /^stream: (?<signature>.+) FOUND$/u.exec(scan.response);
        if (infectedMatch?.groups?.signature) {
          return {
            ...common,
            status: "infected",
            signature: infectedMatch.groups.signature,
            bytesScanned: scan.bytesScanned,
            version,
          };
        }

        return {
          ...common,
          status: "protocol-error",
          retryable: false,
          reason: "Unexpected INSTREAM response.",
          rawResponse: scan.response,
        };
      } catch (error) {
        return mapClamAvError(endpoint, startedAt, now(), options.timeoutMs, error);
      }
    },
  };
}

async function sendSimpleCommand(
  connectFn: typeof createConnection,
  options: ClamAvClientOptions,
  command: string,
): Promise<string> {
  const socket = await connectSocket(connectFn, options);

  try {
    socket.end(command);
    return await collectResponse(socket, options.timeoutMs);
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

async function sendInstream(
  connectFn: typeof createConnection,
  options: ClamAvClientOptions,
  stream: Readable,
): Promise<{ response: string; bytesScanned: number }> {
  const socket = await connectSocket(connectFn, options);
  let bytesScanned = 0;

  try {
    await writeToSocket(socket, Buffer.from("zINSTREAM\0", "utf8"));

    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesScanned += buffer.length;

      const frameLength = Buffer.allocUnsafe(4);
      frameLength.writeUInt32BE(buffer.length, 0);
      await writeToSocket(socket, frameLength);
      await writeToSocket(socket, buffer);
    }

    await writeToSocket(socket, Buffer.alloc(4));
    socket.end();
    const response = await collectResponse(socket, options.timeoutMs);

    return { response, bytesScanned };
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

async function connectSocket(
  connectFn: typeof createConnection,
  options: ClamAvClientOptions,
): Promise<Socket> {
  return await new Promise<Socket>((resolve, reject) => {
    const socket = connectFn({
      host: options.host,
      port: options.port,
    } satisfies TcpNetConnectOpts);

    const timer = setTimeout(() => {
      socket.destroy(new Error("CLAMAV_TIMEOUT"));
    }, options.timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("connect", handleConnect);
      socket.removeListener("error", handleError);
    };
    const handleConnect = () => {
      cleanup();
      resolve(socket);
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.once("connect", handleConnect);
    socket.once("error", handleError);
  });
}

async function collectResponse(socket: Socket, timeoutMs: number): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      socket.destroy(new Error("CLAMAV_TIMEOUT"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeAllListeners("data");
      socket.removeAllListeners("error");
      socket.removeAllListeners("close");
      socket.removeAllListeners("end");
      socket.on("error", () => undefined);
    };

    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (chunk.includes(0x00) || chunk.includes(0x0a)) {
        cleanup();
        resolve(normalizeResponse(Buffer.concat(chunks).toString("utf8")));
      }
    });
    socket.once("end", () => {
      cleanup();
      resolve(normalizeResponse(Buffer.concat(chunks).toString("utf8")));
    });
    socket.once("close", () => {
      cleanup();
      resolve(normalizeResponse(Buffer.concat(chunks).toString("utf8")));
    });
    socket.once("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}

async function writeToSocket(socket: Socket, chunk: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function normalizeResponse(response: string): string {
  return response
    .replace(/\0+$/u, "")
    .replace(/\r?\n+$/u, "")
    .trim();
}

function parseVersionResponse(response: string): ClamAvVersion | null {
  const match =
    /^ClamAV\s+(?<engineVersion>[^/\s]+)\/(?<signatureVersion>[^/\s]+)(?:\/(?<signatureTimestamp>.+))?$/u.exec(
      response,
    );

  if (!match?.groups) {
    return null;
  }

  return {
    raw: response,
    engineVersion: match.groups.engineVersion ?? null,
    signatureVersion: match.groups.signatureVersion ?? null,
    signatureTimestamp: match.groups.signatureTimestamp ?? null,
  };
}

function mapClamAvError(
  endpoint: string,
  startedAt: Date,
  finishedAt: Date,
  timeoutMs: number,
  error: unknown,
): ClamAvUnavailableResult | ClamAvTimeoutResult | ClamAvProtocolErrorResult {
  if (error instanceof Error && error.message === "CLAMAV_TIMEOUT") {
    return {
      endpoint,
      status: "timeout",
      retryable: true,
      timeoutMs,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      completedAt: finishedAt.toISOString(),
    };
  }

  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : null;
    if (code === "ETIMEDOUT") {
      return {
        endpoint,
        status: "timeout",
        retryable: true,
        timeoutMs,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        completedAt: finishedAt.toISOString(),
      };
    }
    if (
      code === "ECONNREFUSED" ||
      code === "ECONNRESET" ||
      code === "EPIPE" ||
      code === "ENOTFOUND" ||
      code === "EAI_AGAIN" ||
      code === "EHOSTUNREACH" ||
      code === "ENETUNREACH"
    ) {
      return unavailable(endpoint, startedAt, finishedAt, code);
    }
  }

  return protocolError(endpoint, startedAt, finishedAt, "ClamAV protocol failure.", null);
}

function unavailable(
  endpoint: string,
  startedAt: Date,
  finishedAt: Date,
  reason: string,
): ClamAvUnavailableResult {
  return {
    endpoint,
    status: "unavailable",
    retryable: true,
    reason,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    completedAt: finishedAt.toISOString(),
  };
}

function protocolError(
  endpoint: string,
  startedAt: Date,
  finishedAt: Date,
  reason: string,
  rawResponse: string | null,
): ClamAvProtocolErrorResult {
  return {
    endpoint,
    status: "protocol-error",
    retryable: false,
    reason,
    rawResponse,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    completedAt: finishedAt.toISOString(),
  };
}
