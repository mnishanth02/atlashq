import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
          // A couple of tests build real DOCX/PPTX fixtures on the fly; under full-suite CPU
          // contention (many extraction-adapter tests running in parallel) that can exceed
          // vitest's 5s default, so the whole file/project uses a more generous timeout.
          testTimeout: 40_000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          globalSetup: ["./src/test/global-setup.ts"],
          // Disposable Postgres/Redis/MinIO/ClamAV containers are shared for the whole run
          // (see src/test/global-setup.ts); keep the suite single-worker so tests never race
          // over the same bucket/queue state.
          pool: "forks",
          isolate: true,
          fileParallelism: false,
          maxWorkers: 1,
          // ClamAV needs real time to finish loading its signature database before the first
          // scan completes; the worker global-setup already waits for readiness, but individual
          // scans/bootstraps still need a generous per-test budget.
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
