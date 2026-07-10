import { describe, expect, it } from "vitest";
import { paginationQuerySchema, projectRoleSchema } from "./index.js";

describe("shared validators barrel", () => {
  it("validates V1 project roles and paginated DTO defaults", () => {
    expect(projectRoleSchema.parse("Developer")).toBe("Developer");
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 25 });
  });

  it("coerces string limits from query params and enforces bounds", () => {
    expect(paginationQuerySchema.parse({ limit: "10" })).toEqual({ limit: 10 });
    expect(() => paginationQuerySchema.parse({ limit: "0" })).toThrow();
    expect(() => paginationQuerySchema.parse({ limit: "101" })).toThrow();
  });
});
