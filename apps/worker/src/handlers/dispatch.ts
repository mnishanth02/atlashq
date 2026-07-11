import type { DocumentProcessingJobPayload } from "@atlashq/jobs";
import { parseDocumentProcessingJobPayload } from "@atlashq/jobs";
import type { Queue } from "bullmq";
import type { WorkerRuntimeContext } from "../runtime/context.js";
import { handleCaptureReference } from "./capture-reference.js";
import { handleExpireUploadSession } from "./expire-upload-session.js";
import { handleExtract } from "./extract.js";
import { handleGeneratePreview } from "./generate-preview.js";
import { handleVerifyAndScan } from "./verify-and-scan.js";

/**
 * Routes one `document-processing` job to its handler by discriminated `kind` (module-02 §10).
 * Every handler receives the shared runtime context (DB/storage/ClamAV/capture adapter) plus the
 * `document-processing` queue itself (so a handler can chain the next pipeline stage) and the
 * already-validated, kind-narrowed payload.
 */
export async function dispatchDocumentProcessingJob(
  context: WorkerRuntimeContext,
  queue: Pick<Queue<DocumentProcessingJobPayload>, "add">,
  rawPayload: unknown,
): Promise<{ kind: DocumentProcessingJobPayload["kind"]; idempotencyKey: string }> {
  const payload = parseDocumentProcessingJobPayload(rawPayload);

  switch (payload.kind) {
    case "verify-and-scan":
      await handleVerifyAndScan(context, queue, payload);
      break;
    case "extract":
      await handleExtract(context, queue, payload);
      break;
    case "generate-preview":
      await handleGeneratePreview(context, payload);
      break;
    case "capture-reference":
      await handleCaptureReference(context, queue, payload);
      break;
    case "expire-upload-session":
      await handleExpireUploadSession(context, payload);
      break;
  }

  return { kind: payload.kind, idempotencyKey: payload.idempotencyKey };
}
