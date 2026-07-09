import { queueNames } from "./queues.js";

export type WorkerHealth = {
  status: "ok";
  service: "worker";
  queues: typeof queueNames;
};

export function getWorkerHealth(): WorkerHealth {
  return {
    status: "ok",
    service: "worker",
    queues: queueNames,
  };
}
