import { describe, expect, it } from "vitest";
import { apiEnvSchema, webEnvSchema, workerEnvSchema } from "./index.js";

describe("web env schema", () => {
  it("rejects server-only values in frontend config", () => {
    expect(() =>
      webEnvSchema.parse({
        VITE_API_BASE_URL: "http://localhost:3000",
        VITE_APP_NAME: "AtlasHQ",
        DATABASE_URL: "postgres://example",
      }),
    ).toThrow();
  });
});

describe("server env schemas", () => {
  it("accepts API placeholders without exposing them to web config", () => {
    expect(() =>
      apiEnvSchema.parse({
        NODE_ENV: "development",
        PORT: "3000",
        LOG_LEVEL: "info",
        DATABASE_URL: "postgresql://atlashq:local@localhost:5432/atlashq",
        REDIS_URL: "redis://localhost:6379",
        AUTH_SECRET: "replace-with-at-least-32-characters",
        AUTH_URL: "http://localhost:3000",
        WEB_ORIGIN: "http://localhost:5173",
        S3_ENDPOINT: "http://localhost:9000",
        S3_ACCESS_KEY_ID: "replace-with-local-minio-access-key",
        S3_SECRET_ACCESS_KEY: "replace-with-local-minio-secret-key",
        S3_BUCKET: "atlashq-local",
      }),
    ).not.toThrow();
  });

  it("accepts worker-only placeholders", () => {
    expect(() =>
      workerEnvSchema.parse({
        NODE_ENV: "development",
        LOG_LEVEL: "info",
        DATABASE_URL: "postgresql://atlashq:local@localhost:5432/atlashq",
        REDIS_URL: "redis://localhost:6379",
        S3_ENDPOINT: "http://localhost:9000",
        S3_ACCESS_KEY_ID: "replace-with-local-minio-access-key",
        S3_SECRET_ACCESS_KEY: "replace-with-local-minio-secret-key",
        S3_BUCKET: "atlashq-local",
        OPENAI_API_KEY: "replace-with-local-development-key",
        ANTHROPIC_API_KEY: "replace-with-local-development-key",
        WORKER_CONCURRENCY: "2",
      }),
    ).not.toThrow();
  });
});
