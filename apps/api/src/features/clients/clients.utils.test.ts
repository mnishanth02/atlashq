import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { RequestSessionContext } from "../../auth/session-context.js";
import {
  assertClientCanBeArchived,
  assertOrganizationAdmin,
  decodeClientCursor,
  encodeClientCursor,
  paginateClientRows,
} from "./clients.utils.js";

const adminSession: RequestSessionContext = {
  user: {
    id: "67dcb6b0-14b9-444a-9cf0-6eb033af62b0",
    email: "admin@example.com",
    name: "Ada Lovelace",
    organizationId: "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90",
    organizationRole: "admin",
    status: "active",
  },
  session: {
    id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
    expiresAt: new Date("2999-01-01T00:00:00.000Z"),
  },
};

describe("client cursor helpers", () => {
  it("round-trips opaque cursors", () => {
    const cursor = encodeClientCursor({
      sortName: "acme corp",
      clientId: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4",
    });

    expect(decodeClientCursor(cursor)).toEqual({
      sortName: "acme corp",
      clientId: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4",
    });
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeClientCursor("not-base64")).toThrow(BadRequestException);
    expect(() => decodeClientCursor(encodeClientCursor({ sortName: "", clientId: "" }))).toThrow(
      BadRequestException,
    );
  });
});

describe("client pagination helper", () => {
  it("marks hasMore and computes the next cursor from the last returned item", () => {
    const page = paginateClientRows(
      [
        { id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9", name: "Acme" },
        { id: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4", name: "Beta" },
        { id: "11de9f7a-4eb2-4ad8-9f9e-4f4efdb3f5d2", name: "Delta" },
      ],
      2,
    );

    expect(page.pageInfo.hasMore).toBe(true);
    expect(page.pageInfo.nextCursor).toBeDefined();
    expect(decodeClientCursor(page.pageInfo.nextCursor as string)).toEqual({
      sortName: "beta",
      clientId: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4",
    });
  });
});

describe("organization-admin enforcement", () => {
  it("allows organization admins", () => {
    expect(() => assertOrganizationAdmin(adminSession)).not.toThrow();
  });

  it("rejects non-admin sessions", () => {
    expect(() =>
      assertOrganizationAdmin({
        ...adminSession,
        user: { ...adminSession.user, organizationRole: "member" },
      }),
    ).toThrow(ForbiddenException);
  });
});

describe("archived state guard", () => {
  it("rejects direct writes to archived clients", () => {
    expect(() => assertClientCanBeArchived("archived")).toThrow(ForbiddenException);
  });
});
