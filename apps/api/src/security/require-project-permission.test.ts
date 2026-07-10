import type { Request } from "express";
import { describe, expect, it } from "vitest";
import {
  extractProjectId,
  type ProjectPermissionRequirement,
} from "./require-project-permission.decorator.js";

function request(params: Record<string, string>): Request {
  return { params } as unknown as Request;
}

const defaultRequirement: ProjectPermissionRequirement = {
  permission: "project:write",
  param: "projectId",
};

describe("extractProjectId", () => {
  it("reads the configured route param", () => {
    expect(extractProjectId(request({ projectId: "proj-1" }), defaultRequirement)).toBe("proj-1");
  });

  it("supports a custom param name", () => {
    const requirement: ProjectPermissionRequirement = { permission: "project:read", param: "id" };
    expect(extractProjectId(request({ id: "proj-9" }), requirement)).toBe("proj-9");
  });

  it("falls back to the id param", () => {
    expect(extractProjectId(request({ id: "proj-2" }), defaultRequirement)).toBe("proj-2");
  });

  it("returns null when no project id is present", () => {
    expect(extractProjectId(request({}), defaultRequirement)).toBeNull();
  });

  it("returns null for an empty project id", () => {
    expect(extractProjectId(request({ projectId: "" }), defaultRequirement)).toBeNull();
  });
});
