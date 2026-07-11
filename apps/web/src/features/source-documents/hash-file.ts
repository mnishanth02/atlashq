let worker: Worker | null = null;
const pending = new Map<
  string,
  { resolve: (hash: string) => void; reject: (reason: unknown) => void }
>();

function ensureWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./hash-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", (event: MessageEvent) => {
      const { id, hash, error } = event.data as {
        id: string;
        hash?: string;
        error?: string;
      };
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (typeof hash === "string") {
        entry.resolve(hash);
      } else {
        entry.reject(new Error(error ?? "hash-worker-failure"));
      }
    });
    worker.addEventListener("error", (event) => {
      for (const [, entry] of pending) {
        entry.reject(new Error(event.message || "hash-worker-failure"));
      }
      pending.clear();
      worker?.terminate();
      worker = null;
    });
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

async function hashOnMainThread(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the SHA-256 of `file` using a Web Worker whenever available so the
 * React main thread stays responsive. Falls back to `SubtleCrypto` on the main
 * thread in environments without Worker support (tests, older browsers).
 */
export async function hashFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const activeWorker = ensureWorker();
  if (!activeWorker) {
    return hashOnMainThread(buffer);
  }
  const id = crypto.randomUUID();
  const done = new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  activeWorker.postMessage({ id, buffer }, [buffer]);
  return done;
}

export function disposeHashWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const [, entry] of pending) {
    entry.reject(new Error("hash-worker-disposed"));
  }
  pending.clear();
}
