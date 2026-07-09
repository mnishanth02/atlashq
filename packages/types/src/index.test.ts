import { describe, expect, it } from "vitest";
import { isProjectRole, projectRoles } from "./index.js";

describe("project roles", () => {
  it("exposes V1 role constants including the client approver placeholder", () => {
    expect(isProjectRole(projectRoles.clientViewerApprover)).toBe(true);
    expect(projectRoles.clientViewerApprover).toBe("Client Viewer / Approver");
  });
});
