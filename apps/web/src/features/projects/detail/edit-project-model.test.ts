import { describe, expect, it } from "vitest";
import type { ProjectEditSource } from "./edit-project-model";
import {
  buildProjectEditClients,
  buildProjectEditDefaults,
  buildProjectEditPeople,
  buildProjectUpdateVariables,
} from "./edit-project-model";

const project: ProjectEditSource = {
  name: "Atlas",
  type: "client",
  clientId: "client-current",
  client: { id: "client-current", name: "Current Client" },
  ownerId: "user-owner",
  owner: { id: "user-owner", name: "Owner" },
  techLeadId: "user-lead",
  techLead: null,
  businessOwnerId: null,
  businessOwner: null,
  startDate: null,
  targetDate: null,
  status: "active",
  phase: "delivery",
  priority: "high",
  visibility: "organization",
  tags: ["v1"],
  description: null,
};

describe("project edit integration helpers", () => {
  it("seeds defaults and only known assignment/current-user people", () => {
    expect(buildProjectEditDefaults(project)).toMatchObject({
      clientId: "client-current",
      ownerId: "user-owner",
      techLeadId: "user-lead",
      description: "",
    });
    expect(buildProjectEditPeople(project, { id: "user-current", name: "Current User" })).toEqual([
      { id: "user-current", name: "Current User", hint: "You" },
      { id: "user-owner", name: "Owner" },
      { id: "user-lead", name: "user-lead" },
    ]);
  });

  it("keeps the current client even when it is absent from the active-client page", () => {
    expect(
      buildProjectEditClients(project, [
        { id: "client-active", name: "Active Client" },
        { id: "client-current", name: "Stale duplicate" },
      ]),
    ).toEqual([
      { id: "client-active", name: "Active Client" },
      { id: "client-current", name: "Current Client" },
    ]);
  });

  it("builds the typed update mutation variables without dropping null clears", () => {
    const input = {
      version: 2,
      clientId: null,
      techLeadId: null,
      businessOwnerId: null,
      startDate: null,
      targetDate: null,
      description: null,
    };
    expect(buildProjectUpdateVariables("project-1", input)).toEqual({
      projectId: "project-1",
      input,
    });
  });
});
