/// <reference lib="webworker" />

/**
 * Computes the SHA-256 of the uploaded ArrayBuffer using SubtleCrypto so the
 * React main thread stays responsive during large uploads. The worker is
 * one-shot: it posts a single `{ id, hash }` reply per message and can be
 * safely terminated by the caller between file hashes.
 */

type HashRequest = {
  id: string;
  buffer: ArrayBuffer;
};

type HashResponse = { id: string; hash: string } | { id: string; error: string };

self.addEventListener("message", async (event: MessageEvent<HashRequest>) => {
  const { id, buffer } = event.data;
  try {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const response: HashResponse = { id, hash };
    (self as unknown as Worker).postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "hash-failed";
    const response: HashResponse = { id, error: message };
    (self as unknown as Worker).postMessage(response);
  }
});

// Ensure module isolation
export {};
