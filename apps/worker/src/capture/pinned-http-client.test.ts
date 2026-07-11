import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const httpRequestMock = vi.fn();
const httpsRequestMock = vi.fn();

vi.mock("node:http", () => ({
  default: { request: httpRequestMock },
  request: httpRequestMock,
}));

vi.mock("node:https", () => ({
  default: { request: httpsRequestMock },
  request: httpsRequestMock,
}));

const { fetchPinnedHttpResource } = await import("./pinned-http-client.js");
const { CaptureFailedError } = await import("./capture-adapter.js");

type MockIncomingMessage = EventEmitter &
  Pick<IncomingMessage, "headers" | "statusCode" | "statusMessage" | "destroy">;

function createResponse({
  statusCode = 200,
  statusMessage = "OK",
  headers = { "content-type": "text/plain" },
  body = Buffer.from("ok"),
}: {
  statusCode?: number;
  statusMessage?: string;
  headers?: Record<string, string>;
  body?: Buffer;
} = {}): MockIncomingMessage {
  const response = new EventEmitter() as MockIncomingMessage;
  response.headers = headers;
  response.statusCode = statusCode;
  response.statusMessage = statusMessage;
  const destroy = vi.fn((error?: Error) => {
    if (error) {
      response.emit("error", error);
    }
    return response as unknown as IncomingMessage;
  });
  response.destroy = destroy as MockIncomingMessage["destroy"];

  queueMicrotask(() => {
    response.emit("data", body);
    response.emit("end");
  });

  return response;
}

function createRequestInvoker(
  responder: (options: Record<string, unknown>) => MockIncomingMessage,
): typeof httpRequestMock {
  return vi.fn(
    (options: Record<string, unknown>, callback: (response: MockIncomingMessage) => void) => {
      const request = new EventEmitter() as EventEmitter & {
        end(data?: Buffer): void;
      };

      request.end = (_data?: Buffer) => {
        callback(responder(options));
      };

      return request;
    },
  );
}

beforeEach(() => {
  httpRequestMock.mockReset();
  httpsRequestMock.mockReset();
});

describe("fetchPinnedHttpResource", () => {
  it("pins HTTPS requests to the validated IP while preserving hostname and TLS SNI", async () => {
    const capturedOptions: Record<string, unknown>[] = [];
    httpsRequestMock.mockImplementation(
      createRequestInvoker((options) => {
        capturedOptions.push(options);
        return createResponse();
      }),
    );

    const result = await fetchPinnedHttpResource({
      url: "https://secure.example.com/path?x=1",
      method: "GET",
      headers: { accept: "text/html" },
      pinnedAddress: "93.184.216.34",
      timeoutMs: 1_000,
      maxResponseBytes: 100,
    });

    expect(result.status).toBe(200);
    expect(capturedOptions).toHaveLength(1);
    expect(capturedOptions[0]).toEqual(
      expect.objectContaining({
        hostname: "secure.example.com",
        servername: "secure.example.com",
        path: "/path?x=1",
      }),
    );

    const lookup = capturedOptions[0]?.lookup as
      | ((
          hostname: string,
          options: unknown,
          callback: (error: Error | null, address: string, family: number) => void,
        ) => void)
      | undefined;
    expect(lookup).toBeTypeOf("function");
    if (!lookup) {
      throw new Error("Expected pinned lookup override to be configured.");
    }

    const lookupResult = await new Promise<{ hostname: string; address: string; family: number }>(
      (resolve, reject) => {
        lookup("secure.example.com", {}, (error, address, family) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ hostname: "secure.example.com", address, family });
        });
      },
    );

    expect(lookupResult).toEqual({
      hostname: "secure.example.com",
      address: "93.184.216.34",
      family: 4,
    });
  });

  it("rejects responses that exceed the configured maxResponseBytes", async () => {
    httpsRequestMock.mockImplementation(
      createRequestInvoker(() =>
        createResponse({
          headers: { "content-length": "101", "content-type": "text/plain" },
          body: Buffer.alloc(101, 1),
        }),
      ),
    );

    await expect(
      fetchPinnedHttpResource({
        url: "https://secure.example.com/",
        method: "GET",
        headers: {},
        pinnedAddress: "93.184.216.34",
        timeoutMs: 1_000,
        maxResponseBytes: 100,
      }),
    ).rejects.toBeInstanceOf(CaptureFailedError);
  });
});
