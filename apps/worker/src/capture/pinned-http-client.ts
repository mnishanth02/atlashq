import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { CaptureFailedError } from "./capture-adapter.js";

export type PinnedFetchRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Buffer;
  pinnedAddress: string;
  timeoutMs: number;
  maxResponseBytes: number;
};

export type PinnedFetchResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Buffer;
};

type HttpModule = typeof http | typeof https;

export async function fetchPinnedHttpResource(
  request: PinnedFetchRequest,
): Promise<PinnedFetchResponse> {
  const url = new URL(request.url);
  const transport = selectTransport(url.protocol);
  const addressFamily = isIP(request.pinnedAddress);

  if (addressFamily !== 4 && addressFamily !== 6) {
    throw new CaptureFailedError(`Pinned address "${request.pinnedAddress}" is not a valid IP.`);
  }

  return await new Promise<PinnedFetchResponse>((resolve, reject) => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort(
        new CaptureFailedError(`Capture request to ${url.hostname} timed out.`),
      );
    }, request.timeoutMs);

    let settled = false;
    let sizeViolation: CaptureFailedError | null = null;

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      reject(
        error instanceof CaptureFailedError
          ? error
          : new CaptureFailedError(`Capture request to ${url.hostname} failed.`, {
              cause: error,
            }),
      );
    };

    const nodeRequest = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: request.method,
        headers: request.headers,
        agent: false,
        servername: url.hostname,
        signal: abortController.signal,
        lookup: (_hostname, _options, callback) => {
          callback(null, request.pinnedAddress, addressFamily);
        },
      },
      (response) => {
        response.on("error", (error) => fail(sizeViolation ?? error));

        const declaredLength = Number(response.headers["content-length"] ?? "0");
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > 0 &&
          declaredLength > request.maxResponseBytes
        ) {
          sizeViolation = new CaptureFailedError(
            `Capture response exceeded the maximum of ${request.maxResponseBytes} bytes.`,
          );
          response.destroy(sizeViolation);
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.length;
          if (totalBytes > request.maxResponseBytes) {
            sizeViolation = new CaptureFailedError(
              `Capture response exceeded the maximum of ${request.maxResponseBytes} bytes.`,
            );
            response.destroy(sizeViolation);
            return;
          }
          chunks.push(buffer);
        });

        response.on("end", () => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeout);
          resolve({
            status: response.statusCode ?? 502,
            statusText: response.statusMessage ?? "",
            headers: flattenHeaders(response.headers),
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    nodeRequest.on("error", (error) => fail(sizeViolation ?? error));

    if (request.body && request.body.length > 0) {
      nodeRequest.end(request.body);
      return;
    }

    nodeRequest.end();
  });
}

function selectTransport(protocol: string): HttpModule {
  if (protocol === "http:") {
    return http;
  }

  if (protocol === "https:") {
    return https;
  }

  throw new CaptureFailedError("Capture URL must use http or https.");
}

function flattenHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const flattened: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "undefined") {
      continue;
    }

    flattened[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  return flattened;
}
