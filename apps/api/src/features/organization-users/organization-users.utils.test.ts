import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  decodeOrganizationUserCursor,
  encodeOrganizationUserCursor,
  paginateOrganizationUserRows,
  toOrganizationUserResponse,
} from "./organization-users.utils.js";

describe("organization user cursor helpers", () => {
  it("round-trips opaque cursors", () => {
    const cursor = encodeOrganizationUserCursor({
      sortName: "ada lovelace",
      userId: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4",
    });

    expect(decodeOrganizationUserCursor(cursor)).toEqual({
      sortName: "ada lovelace",
      userId: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4",
    });
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeOrganizationUserCursor("not-base64")).toThrow(BadRequestException);
    expect(() =>
      decodeOrganizationUserCursor(encodeOrganizationUserCursor({ sortName: "", userId: "" })),
    ).toThrow(BadRequestException);
  });
});

describe("organization user pagination helper", () => {
  it("marks hasMore and computes the next cursor from the last returned item", () => {
    const page = paginateOrganizationUserRows(
      [
        { id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9", name: "Ada" },
        { id: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4", name: "Beatrix" },
        { id: "11de9f7a-4eb2-4ad8-9f9e-4f4efdb3f5d2", name: "Delta" },
      ],
      2,
    );

    expect(page.pageInfo.hasMore).toBe(true);
    expect(page.pageInfo.nextCursor).toBeDefined();
    expect(decodeOrganizationUserCursor(page.pageInfo.nextCursor as string)).toEqual({
      sortName: "beatrix",
      userId: "7b1b7d94-3d6f-4bba-9814-7f4e98050dd4",
    });
  });

  it("reports no next cursor when every row fits on one page", () => {
    const page = paginateOrganizationUserRows(
      [{ id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9", name: "Ada" }],
      25,
    );

    expect(page.pageInfo.hasMore).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });
});

describe("toOrganizationUserResponse", () => {
  it("maps a repository row to the minimal, safe response shape", () => {
    const response = toOrganizationUserResponse({
      id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9",
      name: "Ada Lovelace",
      email: "ada@example.com",
      status: "active",
      organizationRole: "admin",
    });

    expect(response).toEqual({
      id: "3fb34df8-845f-4cf9-9db6-e8d6af8ef3d9",
      name: "Ada Lovelace",
      email: "ada@example.com",
      status: "active",
      organizationRole: "admin",
    });
  });
});
