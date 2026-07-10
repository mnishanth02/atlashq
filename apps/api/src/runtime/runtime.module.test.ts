import "reflect-metadata";
import type { Auth } from "@atlashq/auth";
import type { Database } from "@atlashq/db";
import { Inject, Injectable, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";
import { DrizzleAuthDirectory } from "../auth/auth-directory.js";
import { DrizzleProjectAccessQueries } from "../security/project-access.queries.js";
import {
  AUTH_DIRECTORY,
  AUTH_INSTANCE,
  DATABASE_CLIENT,
  NULL_RUNTIME,
  PROJECT_ACCESS_QUERIES,
} from "./runtime.js";
import { RuntimeModule } from "./runtime.module.js";

/**
 * Stand-in for an independently authored feature module: it never imports `RuntimeModule` itself,
 * relying entirely on `RuntimeModule` being `@Global()` to resolve the runtime tokens.
 */
@Injectable()
class FeatureService {
  constructor(
    @Inject(AUTH_INSTANCE) readonly auth: Auth | null,
    @Inject(DATABASE_CLIENT) readonly db: Database | null,
    @Inject(PROJECT_ACCESS_QUERIES) readonly projectAccessQueries: unknown,
    @Inject(AUTH_DIRECTORY) readonly authDirectory: unknown,
  ) {}
}

@Module({ providers: [FeatureService] })
class FeatureModule {}

describe("RuntimeModule", () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("defaults to NULL_RUNTIME, keeping AUTH_INSTANCE/DATABASE_CLIENT null for offline tooling", async () => {
    @Module({ imports: [RuntimeModule.forRoot()] })
    class RootModule {}

    app = await NestFactory.createApplicationContext(RootModule, { logger: false });

    expect(app.get(AUTH_INSTANCE)).toBeNull();
    expect(app.get(DATABASE_CLIENT)).toBeNull();
    expect(NULL_RUNTIME).toEqual({ auth: null, db: null });
  });

  it("provides Drizzle-backed PROJECT_ACCESS_QUERIES/AUTH_DIRECTORY even with a null database", async () => {
    @Module({ imports: [RuntimeModule.forRoot()] })
    class RootModule {}

    app = await NestFactory.createApplicationContext(RootModule, { logger: false });

    expect(app.get(PROJECT_ACCESS_QUERIES)).toBeInstanceOf(DrizzleProjectAccessQueries);
    expect(app.get(AUTH_DIRECTORY)).toBeInstanceOf(DrizzleAuthDirectory);
  });

  it("lets an independently authored feature module inject runtime tokens without importing RuntimeModule itself", async () => {
    @Module({ imports: [RuntimeModule.forRoot(), FeatureModule] })
    class RootModule {}

    app = await NestFactory.createApplicationContext(RootModule, { logger: false });
    const feature = app.get(FeatureService);

    expect(feature.auth).toBeNull();
    expect(feature.db).toBeNull();
    expect(feature.projectAccessQueries).toBeInstanceOf(DrizzleProjectAccessQueries);
    expect(feature.authDirectory).toBeInstanceOf(DrizzleAuthDirectory);
  });

  it("passes through a supplied non-null runtime's auth/db instances", async () => {
    const auth = { marker: "fake-auth" } as unknown as Auth;
    const db = { marker: "fake-db" } as unknown as Database;

    @Module({ imports: [RuntimeModule.forRoot({ auth, db })] })
    class RootModule {}

    app = await NestFactory.createApplicationContext(RootModule, { logger: false });

    expect(app.get(AUTH_INSTANCE)).toBe(auth);
    expect(app.get(DATABASE_CLIENT)).toBe(db);
  });
});
