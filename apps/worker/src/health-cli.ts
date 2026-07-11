import { getWorkerHealth } from "./health.js";
import { createWorkerRuntimeContext } from "./runtime/context.js";

const context = createWorkerRuntimeContext();

try {
  const health = await getWorkerHealth(context);
  process.stdout.write(`${JSON.stringify(health)}\n`);

  if (health.status !== "ok") {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`worker health check failed: ${String(error)}\n`);
  process.exitCode = 1;
} finally {
  await context.close();
}
