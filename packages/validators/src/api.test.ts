import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  authenticatedMeResponseSchema,
  createUuidPathParamsSchema,
  currentOrganizationResponseSchema,
} from "./api.js";

const sampleUuid = "7b69cd3e-f52f-41ca-a57c-756d08727ffa";
const sampleOrganizationId = "0c8ea111-b595-4eec-a7ec-a6f352ad29ef";
const sampleSessionId = "b1c7cb52-3053-4cc1-bd5d-9ac2f37797b3";

describe("apiErrorSchema", () => {
  it("accepts a stable error payload with optional details and correlationId", () => {
    expect(
      apiErrorSchema.parse({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: [{ path: ["query", "limit"], message: "Too small", code: "too_small" }],
        correlationId: "corr_1",
      }),
    ).toEqual({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: [{ path: ["query", "limit"], message: "Too small", code: "too_small" }],
      correlationId: "corr_1",
    });
  });

  it("rejects unknown fields and non-canonical codes", () => {
    expect(() =>
      apiErrorSchema.parse({
        statusCode: 400,
        code: "validation_error",
        message: "Request validation failed.",
      }),
    ).toThrow();

    expect(() =>
      apiErrorSchema.parse({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        extra: true,
      }),
    ).toThrow();
  });
});

describe("authenticatedMeResponseSchema", () => {
  it("matches the authenticated /me response shape", () => {
    expect(
      authenticatedMeResponseSchema.parse({
        user: {
          id: sampleUuid,
          email: "user@example.com",
          name: "Ada Lovelace",
          organizationId: sampleOrganizationId,
          organizationRole: "member",
          status: "active",
        },
        session: {
          id: sampleSessionId,
          expiresAt: "2999-01-01T00:00:00.000Z",
        },
      }),
    ).toEqual({
      user: {
        id: sampleUuid,
        email: "user@example.com",
        name: "Ada Lovelace",
        organizationId: sampleOrganizationId,
        organizationRole: "member",
        status: "active",
      },
      session: {
        id: sampleSessionId,
        expiresAt: "2999-01-01T00:00:00.000Z",
      },
    });
  });

  it("rejects unknown fields and non-canonical user statuses", () => {
    expect(() =>
      authenticatedMeResponseSchema.parse({
        user: {
          id: sampleUuid,
          email: "user@example.com",
          name: "Ada Lovelace",
          organizationId: sampleOrganizationId,
          organizationRole: "member",
          status: "disabled",
        },
        session: {
          id: sampleSessionId,
          expiresAt: "2999-01-01T00:00:00.000Z",
        },
      }),
    ).toThrow();

    expect(() =>
      authenticatedMeResponseSchema.parse({
        user: {
          id: sampleUuid,
          email: "user@example.com",
          name: "Ada Lovelace",
          organizationId: sampleOrganizationId,
          organizationRole: "member",
          status: "active",
          extra: true,
        },
        session: {
          id: sampleSessionId,
          expiresAt: "2999-01-01T00:00:00.000Z",
        },
      }),
    ).toThrow();
  });
});

describe("currentOrganizationResponseSchema", () => {
  it("matches the current organization response shape", () => {
    expect(
      currentOrganizationResponseSchema.parse({
        id: sampleOrganizationId,
        name: "AtlasHQ",
        plan: "starter",
        role: "admin",
      }),
    ).toEqual({
      id: sampleOrganizationId,
      name: "AtlasHQ",
      plan: "starter",
      role: "admin",
    });
  });
});

describe("createUuidPathParamsSchema", () => {
  it("builds strict UUID path-param schemas for named params", () => {
    const schema = createUuidPathParamsSchema("projectId");

    expect(schema.parse({ projectId: sampleUuid })).toEqual({ projectId: sampleUuid });
    expect(() => schema.parse({ projectId: "not-a-uuid" })).toThrow();
    expect(() => schema.parse({ projectId: sampleUuid, extra: true })).toThrow();
  });
});
