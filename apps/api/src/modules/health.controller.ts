import type { MinioObjectStorageClient } from "@atlashq/storage";
import { Controller, Get, Inject, Optional } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { SOURCE_DOCUMENT_QUEUE, SOURCE_STORAGE } from "../runtime/runtime.js";
import type { SourceDocumentQueue } from "../runtime/source-vault-runtime.js";

const HEALTH_CHECK_TIMEOUT_MS = 2_000;

export class HealthCheckDto {
  @ApiProperty({ enum: ["storage", "queue"] })
  name: "storage" | "queue";

  @ApiProperty({ type: Boolean })
  ok: boolean;

  @ApiProperty({ type: Boolean })
  required: boolean;

  @ApiProperty({ type: String, example: "not configured" })
  detail: string;

  constructor(input: HealthCheckDto) {
    this.name = input.name;
    this.ok = input.ok;
    this.required = input.required;
    this.detail = input.detail;
  }
}

export class HealthResponseDto {
  @ApiProperty({ enum: ["ok", "degraded"] })
  status: "ok" | "degraded" = "ok";

  @ApiProperty({ enum: ["api"] })
  service: "api" = "api";

  @ApiProperty({ type: String, example: "0.0.0" })
  version = "0.0.0";

  @ApiProperty({ enum: ["core-only", "source-vault", "partial-source-vault"] })
  mode: "core-only" | "source-vault" | "partial-source-vault" = "core-only";

  @ApiProperty({ type: () => HealthCheckDto, isArray: true })
  checks: HealthCheckDto[] = [];
}

type HealthCheckResult = {
  name: "storage" | "queue";
  ok: boolean;
  required: boolean;
  detail: string;
};

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    @Optional()
    @Inject(SOURCE_STORAGE)
    private readonly storage: MinioObjectStorageClient | null = null,
    @Optional()
    @Inject(SOURCE_DOCUMENT_QUEUE)
    private readonly queue: SourceDocumentQueue | null = null,
  ) {}

  @Get()
  @ApiOperation({
    operationId: "HealthController_getHealth",
    summary: "Report API runtime health and optional Source Vault readiness",
  })
  @ApiOkResponse({
    description: "API process health with optional Source Vault readiness checks.",
    type: HealthResponseDto,
  })
  async getHealth(): Promise<HealthResponseDto> {
    const mode = this.resolveMode();
    const checks = await Promise.all([
      this.checkStorage(mode !== "core-only"),
      this.checkQueue(mode !== "core-only"),
    ]);

    return {
      status: checks.every((check) => !check.required || check.ok) ? "ok" : "degraded",
      service: "api",
      version: "0.0.0",
      mode,
      checks: checks.map((check) => new HealthCheckDto(check)),
    };
  }

  private resolveMode(): HealthResponseDto["mode"] {
    if (!this.storage && !this.queue) {
      return "core-only";
    }
    if (this.storage && this.queue) {
      return "source-vault";
    }
    return "partial-source-vault";
  }

  private async checkStorage(required: boolean): Promise<HealthCheckResult> {
    if (!this.storage) {
      return { name: "storage", ok: false, required, detail: "not configured" };
    }

    try {
      const readiness = await withTimeout(
        this.storage.getBucketReadiness(),
        HEALTH_CHECK_TIMEOUT_MS,
        "storage readiness timed out",
      );

      if (!readiness.bucketExists) {
        return { name: "storage", ok: false, required, detail: "bucket-missing" };
      }

      return {
        name: "storage",
        ok: readiness.versioningStatus === "Enabled",
        required,
        detail: `versioning=${readiness.versioningStatus}`,
      };
    } catch (error) {
      return {
        name: "storage",
        ok: false,
        required,
        detail: error instanceof Error ? error.message : "storage unavailable",
      };
    }
  }

  private async checkQueue(required: boolean): Promise<HealthCheckResult> {
    if (!this.queue) {
      return { name: "queue", ok: false, required, detail: "not configured" };
    }

    try {
      const availability = await withTimeout(
        this.queue.checkAvailability(HEALTH_CHECK_TIMEOUT_MS),
        HEALTH_CHECK_TIMEOUT_MS,
        "queue readiness timed out",
      );
      return {
        name: "queue",
        ok: availability.ok,
        required,
        detail: availability.detail,
      };
    } catch (error) {
      return {
        name: "queue",
        ok: false,
        required,
        detail: error instanceof Error ? error.message : "queue unavailable",
      };
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
