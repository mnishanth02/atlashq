import { describe, expect, it } from "vitest";
import {
  apiEnvSchema,
  clamAvEnvSchema,
  referenceCaptureEnvSchema,
  sourceVaultEnvSchema,
  storageEnvSchema,
  webEnvSchema,
  workerEnvSchema,
} from "./index.js";

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
  it("accepts API env without S3 values", () => {
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
      }),
    ).not.toThrow();
  });

  it("accepts a complete storage group coherently", () => {
    const storageEnv = {
      S3_ENDPOINT: "http://localhost:9000",
      S3_ACCESS_KEY_ID: "replace-with-local-minio-access-key",
      S3_SECRET_ACCESS_KEY: "replace-with-local-minio-secret-key",
      S3_BUCKET: "atlashq-local",
    };

    expect(() => storageEnvSchema.parse(storageEnv)).not.toThrow();
    expect(() =>
      apiEnvSchema.parse({
        NODE_ENV: "development",
        PORT: "3000",
        LOG_LEVEL: "info",
        DATABASE_URL: "******localhost:5432/atlashq",
        REDIS_URL: "redis://localhost:6379",
        AUTH_SECRET: "replace-with-at-least-32-characters",
        AUTH_URL: "http://localhost:3000",
        WEB_ORIGIN: "http://localhost:5173",
        ...storageEnv,
      }),
    ).not.toThrow();
  });

  it("rejects partial storage configuration", () => {
    expect(() =>
      apiEnvSchema.parse({
        NODE_ENV: "development",
        PORT: "3000",
        LOG_LEVEL: "info",
        DATABASE_URL: "******localhost:5432/atlashq",
        REDIS_URL: "redis://localhost:6379",
        AUTH_SECRET: "replace-with-at-least-32-characters",
        AUTH_URL: "http://localhost:3000",
        WEB_ORIGIN: "http://localhost:5173",
        S3_ENDPOINT: "http://localhost:9000",
      }),
    ).toThrow();
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

describe("module 2 source vault env schema", () => {
  it("defaults the 100 MiB upload size, 24h session TTL, and signed URL TTL ceilings", () => {
    const parsed = sourceVaultEnvSchema.parse({});
    expect(parsed.SOURCE_UPLOAD_MAX_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
    expect(parsed.SOURCE_UPLOAD_SESSION_TTL_SECONDS).toBe(24 * 60 * 60);
    expect(parsed.SOURCE_UPLOAD_URL_TTL_SECONDS).toBe(15 * 60);
    expect(parsed.SOURCE_DOWNLOAD_URL_TTL_SECONDS).toBe(10 * 60);
    expect(parsed.S3_REQUIRE_BUCKET_VERSIONING).toBe(true);
  });

  it("rejects a signed upload URL TTL beyond the 15-minute maximum", () => {
    expect(() =>
      sourceVaultEnvSchema.parse({ SOURCE_UPLOAD_URL_TTL_SECONDS: 15 * 60 + 1 }),
    ).toThrow();
  });

  it("rejects a signed download URL TTL beyond the 60-minute maximum", () => {
    expect(() =>
      sourceVaultEnvSchema.parse({ SOURCE_DOWNLOAD_URL_TTL_SECONDS: 60 * 60 + 1 }),
    ).toThrow();
  });

  it("coerces the bucket-versioning requirement flag from a string env value", () => {
    expect(
      sourceVaultEnvSchema.parse({ S3_REQUIRE_BUCKET_VERSIONING: "false" })
        .S3_REQUIRE_BUCKET_VERSIONING,
    ).toBe(false);
  });

  it("keeps the source vault env group optional-with-defaults on the API env (no S3 credentials required)", () => {
    expect(() =>
      apiEnvSchema.parse({
        NODE_ENV: "development",
        PORT: "3000",
        LOG_LEVEL: "info",
        DATABASE_URL: "******localhost:5432/atlashq",
        REDIS_URL: "redis://localhost:6379",
        AUTH_SECRET: "replace-with-at-least-32-characters",
        AUTH_URL: "http://localhost:3000",
        WEB_ORIGIN: "http://localhost:5173",
      }),
    ).not.toThrow();
  });
});

describe("module 2 ClamAV env schema", () => {
  it("defaults to the Compose service hostname and standard INSTREAM port", () => {
    const parsed = clamAvEnvSchema.parse({});
    expect(parsed.CLAMAV_HOST).toBe("clamav");
    expect(parsed.CLAMAV_PORT).toBe(3310);
    expect(parsed.CLAMAV_TIMEOUT_MS).toBe(30_000);
  });

  it("rejects an empty ClamAV host", () => {
    expect(() => clamAvEnvSchema.parse({ CLAMAV_HOST: "" })).toThrow();
  });

  it("keeps ClamAV and capture config on the worker env without breaking worker-only placeholders", () => {
    expect(() =>
      workerEnvSchema.parse({
        NODE_ENV: "development",
        LOG_LEVEL: "info",
        DATABASE_URL: "******localhost:5432/atlashq",
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

describe("module 2 reference capture env schema", () => {
  it("defaults capture timeout, redirect, and byte bounds", () => {
    const parsed = referenceCaptureEnvSchema.parse({});
    expect(parsed.REFERENCE_CAPTURE_TIMEOUT_MS).toBe(20_000);
    expect(parsed.REFERENCE_CAPTURE_MAX_REDIRECTS).toBe(5);
    expect(parsed.REFERENCE_CAPTURE_MAX_RESPONSE_BYTES).toBe(25 * 1024 * 1024);
    expect(parsed.REFERENCE_CAPTURE_MAX_TOTAL_BYTES).toBe(75 * 1024 * 1024);
  });

  it("rejects a negative max-redirects bound", () => {
    expect(() =>
      referenceCaptureEnvSchema.parse({ REFERENCE_CAPTURE_MAX_REDIRECTS: -1 }),
    ).toThrow();
  });
});
