import { describe, expect, it } from "vitest";
import {
  clientCreateInputSchema,
  clientListFilterSchema,
  clientUpdateInputSchema,
} from "./client.js";

describe("clientCreateInputSchema", () => {
  it("defaults status to active", () => {
    const parsed = clientCreateInputSchema.parse({ name: "Acme Corp" });

    expect(parsed.status).toBe("active");
  });

  it("validates email format when provided", () => {
    expect(() =>
      clientCreateInputSchema.parse({ name: "Acme Corp", email: "not-an-email" }),
    ).toThrow();
    expect(clientCreateInputSchema.parse({ name: "Acme Corp", email: "ops@acme.test" }).email).toBe(
      "ops@acme.test",
    );
  });

  it("rejects unknown fields (strict schema)", () => {
    expect(() => clientCreateInputSchema.parse({ name: "Acme Corp", extra: true })).toThrow();
  });

  it("does not allow nullable contact fields on create", () => {
    expect(() => clientCreateInputSchema.parse({ name: "Acme Corp", email: null })).toThrow();
  });
});

describe("clientUpdateInputSchema", () => {
  it("leaves untouched fields absent rather than reapplying the create-time default", () => {
    const parsed = clientUpdateInputSchema.parse({ version: 2, notes: "Renewed contract" });

    expect(parsed).toEqual({ version: 2, notes: "Renewed contract" });
    expect(parsed.status).toBeUndefined();
  });

  it("requires version and at least one mutable field", () => {
    expect(() => clientUpdateInputSchema.parse({})).toThrow();
    expect(() => clientUpdateInputSchema.parse({ version: 2 })).toThrow();
    expect(() => clientUpdateInputSchema.parse({ notes: "Renewed contract" })).toThrow();
  });

  it("accepts explicit nulls for clearing nullable contact fields", () => {
    expect(
      clientUpdateInputSchema.parse({
        version: 2,
        contactPerson: null,
        email: null,
        notes: null,
      }),
    ).toEqual({
      version: 2,
      contactPerson: null,
      email: null,
      notes: null,
    });
  });
});

describe("clientListFilterSchema", () => {
  it("supports pagination plus optional status/search filters", () => {
    const parsed = clientListFilterSchema.parse({ search: "acme", limit: "10" });

    expect(parsed).toEqual({ search: "acme", limit: 10 });
  });
});
