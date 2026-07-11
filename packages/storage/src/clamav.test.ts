import { EventEmitter } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { type ClamAvScanResult, createClamAvClient } from "./index.js";

const servers = new Set<Server>();
const sockets = new Set<Socket>();

afterEach(async () => {
  for (const socket of sockets) {
    socket.destroy();
  }
  sockets.clear();

  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  servers.clear();
});

describe("ClamAV client", () => {
  it("streams clean payloads using INSTREAM chunk framing", async () => {
    const observedChunks: Buffer[] = [];
    const server = await createQueuedServer([
      (socket) => respondToVersion(socket),
      async (socket) => {
        const payload = await readInstreamPayload(socket);
        observedChunks.push(payload);
        socket.end("stream: OK\0");
      },
    ]);

    const client = createClamAvClient({ host: "127.0.0.1", port: server.port, timeoutMs: 250 });
    const result = await client.scanStream(
      Readable.from([Buffer.from("atlas"), Buffer.from("hq")]),
    );

    expect(result.status).toBe("clean");
    expect(observedChunks.map((value) => value.toString("utf8"))).toEqual(["atlashq"]);
  });

  it("returns infected verdicts with signature names", async () => {
    const server = await createQueuedServer([
      (socket) => respondToVersion(socket),
      async (socket) => {
        await readInstreamPayload(socket);
        socket.end("stream: Eicar-Test-Signature FOUND\0");
      },
    ]);

    const client = createClamAvClient({ host: "127.0.0.1", port: server.port, timeoutMs: 250 });
    const result = await client.scanStream(Readable.from(["eicar"]));

    expect(result).toMatchObject({
      status: "infected",
      signature: "Eicar-Test-Signature",
    } satisfies Partial<ClamAvScanResult>);
  });

  it("treats closed or missing scanner sockets as unavailable", async () => {
    const server = await createQueuedServer([]);
    const port = server.port;
    await closeServer(server.server);

    const client = createClamAvClient({ host: "127.0.0.1", port, timeoutMs: 50 });
    const result = await client.scanStream(Readable.from(["atlas"]));

    expect(result).toMatchObject({ status: "unavailable", retryable: true });
  });

  it("does not infer verdicts from timeouts", async () => {
    const server = await createQueuedServer([() => undefined]);

    const client = createClamAvClient({ host: "127.0.0.1", port: server.port, timeoutMs: 50 });
    const result = await client.scanStream(Readable.from(["atlas"]));

    expect(result).toMatchObject({
      status: "timeout",
      retryable: true,
      timeoutMs: 50,
    });
  });

  it("reports malformed VERSION responses as protocol errors", async () => {
    const server = await createQueuedServer([
      (socket) => {
        socket.end("NOPE\0");
      },
    ]);
    const client = createClamAvClient({ host: "127.0.0.1", port: server.port, timeoutMs: 100 });

    const result = await client.getVersion();

    expect(result).toMatchObject({
      status: "protocol-error",
      retryable: false,
    });
  });

  it("classifies timeout and network reachability socket errors safely", async () => {
    const timeoutClient = createClamAvClient(
      { host: "127.0.0.1", port: 3310, timeoutMs: 25 },
      { connect: createFailingConnect("ETIMEDOUT") },
    );
    const unavailableClient = createClamAvClient(
      { host: "127.0.0.1", port: 3310, timeoutMs: 25 },
      { connect: createFailingConnect("EHOSTUNREACH") },
    );

    await expect(timeoutClient.getVersion()).resolves.toMatchObject({
      status: "timeout",
      retryable: true,
      timeoutMs: 25,
    });
    await expect(unavailableClient.getVersion()).resolves.toMatchObject({
      status: "unavailable",
      retryable: true,
      reason: "EHOSTUNREACH",
    });
  });
});

function respondToVersion(socket: Socket): void {
  socket.end("ClamAV 1.4.3/27411/Fri Jul 10 14:15:16 2026\0");
}

async function readInstreamPayload(socket: Socket): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let buffer = Buffer.alloc(0);
    let commandSeen = false;

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!commandSeen) {
        const commandTerminator = buffer.indexOf(0x00);
        if (commandTerminator === -1) {
          return;
        }

        const command = buffer.subarray(0, commandTerminator).toString("utf8");
        if (command !== "zINSTREAM") {
          reject(new Error(`Unexpected command ${command}`));
          return;
        }

        buffer = buffer.subarray(commandTerminator + 1);
        commandSeen = true;
      }

      while (buffer.length >= 4) {
        const frameLength = buffer.readUInt32BE(0);
        if (buffer.length < frameLength + 4) {
          return;
        }

        if (frameLength === 0) {
          socket.removeAllListeners("data");
          resolve(Buffer.concat(chunks));
          return;
        }

        chunks.push(buffer.subarray(4, frameLength + 4));
        buffer = buffer.subarray(frameLength + 4);
      }
    });
    socket.once("error", reject);
  });
}

async function createQueuedServer(
  handlers: Array<(socket: Socket) => void | Promise<void>>,
): Promise<{
  server: Server;
  port: number;
}> {
  const queue = [...handlers];
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });

    const handler = queue.shift();
    if (!handler) {
      socket.destroy();
      return;
    }

    void Promise.resolve(handler(socket)).catch(() => socket.destroy());
  });
  servers.add(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address info.");
  }

  return { server, port: address.port };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  servers.delete(server);
}

function createFailingConnect(code: string): typeof import("node:net").connect {
  return (() => {
    const socket = new EventEmitter() as Socket;
    socket.destroy = (() => {
      socket.emit("close");
      return socket;
    }) as Socket["destroy"];
    socket.end = (() => socket) as Socket["end"];
    socket.write = ((_chunk: unknown, callback?: (error?: Error | null) => void) => {
      callback?.(null);
      return true;
    }) as unknown as Socket["write"];

    setImmediate(() => {
      const error = Object.assign(new Error(code), { code });
      socket.emit("error", error);
    });

    return socket;
  }) as typeof import("node:net").connect;
}
