import { describe, expect, it } from "vitest";
import {
  type ClientCreateFormValues,
  clientCreateFormSchema,
  toCreateClientInput,
} from "./client-create-transform";

function valid(overrides: Partial<ClientCreateFormValues> = {}): ClientCreateFormValues {
  return {
    name: "Northwind",
    contactPerson: "",
    email: "",
    notes: "",
    ...overrides,
  };
}

describe("clientCreateFormSchema", () => {
  it("accepts a minimal client with only a name", () => {
    expect(clientCreateFormSchema.safeParse(valid()).success).toBe(true);
  });

  it("requires a name", () => {
    const result = clientCreateFormSchema.safeParse(valid({ name: "  " }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email but allows a blank one", () => {
    expect(clientCreateFormSchema.safeParse(valid({ email: "not-email" })).success).toBe(false);
    expect(clientCreateFormSchema.safeParse(valid({ email: "a@b.com" })).success).toBe(true);
    expect(clientCreateFormSchema.safeParse(valid({ email: "  " })).success).toBe(true);
  });
});

describe("toCreateClientInput", () => {
  it("trims the name, defaults status to active, and omits blank optionals", () => {
    expect(toCreateClientInput(valid({ name: "  Northwind  " }))).toEqual({
      name: "Northwind",
      status: "active",
    });
  });

  it("includes trimmed optional fields when provided", () => {
    expect(
      toCreateClientInput(
        valid({
          contactPerson: "  Ada  ",
          email: "  ada@nw.com ",
          notes: "  Priority ",
        }),
      ),
    ).toEqual({
      name: "Northwind",
      status: "active",
      contactPerson: "Ada",
      email: "ada@nw.com",
      notes: "Priority",
    });
  });
});
