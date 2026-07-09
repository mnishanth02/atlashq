import { getWorkerHealth } from "./health.js";

process.stdout.write(`${JSON.stringify(getWorkerHealth())}
`);
