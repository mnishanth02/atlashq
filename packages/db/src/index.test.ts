import { describe, expect, it } from "vitest";
import {
  auditTableConvention,
  drizzleSchemaPlaceholder,
  mutableBusinessTableColumns,
  postgresExtensions,
  schemaAreas,
} from "./index.js";

describe("db placeholder conventions", () => {
  it("keeps PostgreSQL text-search extensions in scope without pgvector", () => {
    expect(postgresExtensions).toEqual(["pg_trgm", "unaccent"]);
    expect(drizzleSchemaPlaceholder.searchBaseline).toBe("postgres-full-text-search");
    expect(drizzleSchemaPlaceholder.vectorSearch).toBe("deferred");
  });

  it("captures mutable table and append-only audit conventions", () => {
    expect(mutableBusinessTableColumns).toEqual(
      expect.arrayContaining(["organization_id", "created_at", "updated_at", "version"]),
    );
    expect(auditTableConvention.appendOnly).toBe(true);
    expect(schemaAreas).toContain("ai-and-audit");
  });
});
