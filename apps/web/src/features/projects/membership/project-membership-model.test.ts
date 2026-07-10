import { projectRoles, projectRoleValues } from "@atlashq/types";
import { describe, expect, it } from "vitest";
import {
  getProjectRoleDescription,
  PROJECT_ROLE_DESCRIPTIONS,
  PROJECT_ROLE_OPTIONS,
} from "./project-membership-model";

describe("project membership role descriptions", () => {
  it("covers every supported project role", () => {
    expect(PROJECT_ROLE_OPTIONS.map((option) => option.value)).toEqual(projectRoleValues);
  });

  it("provides non-empty descriptions for every role", () => {
    for (const role of projectRoleValues) {
      expect(PROJECT_ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(20);
    }
  });

  it("surfaces the Project Owner description for UI helpers", () => {
    expect(getProjectRoleDescription(projectRoles.projectOwner)).toContain("archive");
  });
});
