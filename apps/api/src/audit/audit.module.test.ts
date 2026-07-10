import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";
import { AuditModule } from "./audit.module.js";
import { AuditWriter } from "./audit-writer.js";

describe("AuditModule", () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("exports an injectable AuditWriter", async () => {
    app = await NestFactory.createApplicationContext(AuditModule, { logger: false });

    expect(app.get(AuditWriter)).toBeInstanceOf(AuditWriter);
  });

  it("has no runtime dependency: AuditWriter resolves without a database/auth runtime present", async () => {
    // AuditModule declares no imports, so it cannot be transitively depending on RuntimeModule or
    // any database connection to construct AuditWriter.
    expect(Reflect.getMetadata("imports", AuditModule)).toBeUndefined();

    app = await NestFactory.createApplicationContext(AuditModule, { logger: false });
    const writer = app.get(AuditWriter);

    expect(writer).toBeInstanceOf(AuditWriter);
  });
});
