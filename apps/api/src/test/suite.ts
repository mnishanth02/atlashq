import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { createIntegrationHarness, type IntegrationHarness } from "./harness.js";

/**
 * Register the standard integration lifecycle for a spec file: build a harness (real container
 * database + real Better Auth + the production {@link createIntegrationHarness} Nest app) once,
 * truncate all tables before every test for deterministic isolation despite the append-only audit
 * trigger, and always tear the app + pool down afterwards (even if a test throws). Returns an
 * accessor so tests can reach the live harness inside `it` blocks.
 *
 * The shared PostgreSQL container is provided by the Vitest global setup, so this only pays the
 * cost of an app/pool per file. Integration files run serially (see `vitest.config.ts`).
 */
export function useHarness(): () => IntegrationHarness {
  let harness: IntegrationHarness | undefined;

  beforeAll(async () => {
    harness = await createIntegrationHarness(inject("integrationDatabaseUrl"));
  }, 180_000);

  afterAll(async () => {
    await harness?.close();
  });

  beforeEach(async () => {
    if (!harness) {
      throw new Error("Integration harness was not initialized.");
    }
    await harness.truncateAll();
  });

  return () => {
    if (!harness) {
      throw new Error("Integration harness accessed before initialization.");
    }
    return harness;
  };
}
