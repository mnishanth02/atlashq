import { describe, expect, it } from "vitest";
import { paginationQuerySchema, projectRoleSchema } from "./index.js";

describe("shared validators", () => {
  it("validates V1 project roles and paginated DTO defaults", () => {
    expect(projectRoleSchema.parse("Developer")).toBe("Developer");
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 25 });
  });
});
