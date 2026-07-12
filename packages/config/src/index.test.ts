import { describe, expect, it } from "vitest";
import {
  aiRequirementAnalysisBudgetEnvSchema,
  aiRequirementAnalysisDataHandlingEnvSchema,
  aiRequirementAnalysisDefaults,
  aiRequirementAnalysisFeatureFlagEnvSchema,
  aiRequirementAnalysisLogRetentionEnvSchema,
  aiRequirementAnalysisProviderEnvSchema,
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

  it("defaults analyzer feature flags without exposing server secrets", () => {
    const parsed = webEnvSchema.parse({});
    expect(parsed.VITE_AI_REQUIREMENT_ANALYSIS_ENABLED).toBe(false);
    expect(parsed.VITE_AI_ANALYSIS_READS_ENABLED).toBe(true);
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

  describe("module 3 AI requirement-analysis env schemas", () => {
    it("defaults feature flags to safe-disabled behavior", () => {
      const parsed = aiRequirementAnalysisFeatureFlagEnvSchema.parse({});
      expect(parsed.AI_REQUIREMENT_ANALYSIS_ENABLED).toBe(false);
      expect(parsed.AI_MODEL_CALLS_ENABLED).toBe(false);
      expect(parsed.AI_REFERENCE_FEATURE_EXTRACTION_ENABLED).toBe(false);
      expect(parsed.AI_EVAL_GATE_REQUIRED).toBe(true);
      expect(parsed.AI_ANALYSIS_READS_ENABLED).toBe(true);
    });

    it("defaults run budgets and concurrency limits from the plan", () => {
      const parsed = aiRequirementAnalysisBudgetEnvSchema.parse({});
      expect(parsed.AI_ANALYSIS_MAX_USD_PER_RUN).toBe(3);
      expect(parsed.AI_ANALYSIS_MAX_INPUT_TOKENS_PER_RUN).toBe(300_000);
      expect(parsed.AI_ANALYSIS_MAX_OUTPUT_TOKENS_PER_RUN).toBe(30_000);
      expect(parsed.AI_ANALYSIS_MAX_WALL_CLOCK_SECONDS).toBe(1_800);
      expect(parsed.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_PROJECT).toBe(1);
      expect(parsed.AI_ANALYSIS_MAX_ACTIVE_RUNS_PER_ORGANIZATION).toBe(3);
    });

    it("defaults AI provider selection and data-retention handling", () => {
      const provider = aiRequirementAnalysisProviderEnvSchema.parse({});
      expect(provider.AI_ANALYSIS_DEFAULT_PROVIDER).toBe("openai");
      expect(provider.AI_ANALYSIS_DEFAULT_MODEL_ALIAS).toBe("gpt-4o-mini");
      expect(provider.AI_ANALYSIS_DEFAULT_RESOLVED_MODEL_ID).toBe("gpt-4o-mini");
      expect(provider.AI_ANALYSIS_DEFAULT_DATA_RETENTION_MODE).toBe("provider_default");
      expect(provider.AI_ANALYSIS_PROVIDER_SELECTION_STRATEGY).toBe("explicit_policy_only");
      expect(provider.AI_ANALYSIS_DISABLE_AUTOMATIC_FALLBACK).toBe(true);

      expect(
        aiRequirementAnalysisProviderEnvSchema.parse({
          AI_ANALYSIS_DEFAULT_PROVIDER: "openai-compatible",
        }).AI_ANALYSIS_DEFAULT_PROVIDER,
      ).toBe("openai-compatible");
      expect(
        aiRequirementAnalysisProviderEnvSchema.parse({
          AI_ANALYSIS_DEFAULT_PROVIDER: "local",
        }).AI_ANALYSIS_DEFAULT_PROVIDER,
      ).toBe("local");

      const dataHandling = aiRequirementAnalysisDataHandlingEnvSchema.parse({});
      expect(dataHandling.AI_ANALYSIS_LOG_PROMPTS).toBe(false);
      expect(dataHandling.AI_ANALYSIS_LOG_SOURCE_CHUNKS).toBe(false);
      expect(dataHandling.AI_ANALYSIS_LOG_MODEL_OUTPUTS).toBe(false);
      expect(dataHandling.AI_ANALYSIS_REDACT_SIGNED_URLS).toBe(true);
      expect(dataHandling.AI_ANALYSIS_SAFE_DISABLED_BEHAVIOR).toBe(
        "reject_new_runs_preserve_reads",
      );

      expect(
        aiRequirementAnalysisLogRetentionEnvSchema.parse({}).AI_ANALYSIS_LOG_RETENTION_DAYS,
      ).toBe(30);
    });

    it("coerces kill switches from 1/0 env values", () => {
      const parsed = aiRequirementAnalysisFeatureFlagEnvSchema.parse({
        AI_REQUIREMENT_ANALYSIS_ENABLED: "1",
        AI_MODEL_CALLS_ENABLED: "0",
      });
      expect(parsed.AI_REQUIREMENT_ANALYSIS_ENABLED).toBe(true);
      expect(parsed.AI_MODEL_CALLS_ENABLED).toBe(false);
    });

    it("exposes typed defaults for feature flags, budgets, provider policy, and retention", () => {
      expect(aiRequirementAnalysisDefaults).toEqual({
        featureFlags: {
          aiRequirementAnalysisEnabled: false,
          aiModelCallsEnabled: false,
          aiReferenceFeatureExtractionEnabled: false,
          aiEvalGateRequired: true,
          aiAnalysisReadsEnabled: true,
        },
        budgets: {
          maxUsdPerRun: 3,
          maxInputTokensPerRun: 300_000,
          maxOutputTokensPerRun: 30_000,
          maxWallClockSeconds: 1_800,
          maxActiveRunsPerProject: 1,
          maxActiveRunsPerOrganization: 3,
        },
        providerSelection: {
          provider: "openai",
          modelAlias: "gpt-4o-mini",
          resolvedModelId: "gpt-4o-mini",
          dataRetentionMode: "provider_default",
          strategy: "explicit_policy_only",
          disableAutomaticFallback: true,
        },
        dataHandling: {
          logPrompts: false,
          logSourceChunks: false,
          logModelOutputs: false,
          redactSignedUrls: true,
          safeDisabledBehavior: "reject_new_runs_preserve_reads",
        },
        logRetentionDays: 30,
      });
    });
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
