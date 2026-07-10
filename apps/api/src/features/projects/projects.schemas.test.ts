import { describe, expect, it } from "vitest";
import {
  membershipResponseSchema,
  projectDashboardResponseSchema,
  projectResponseSchema,
} from "./projects.schemas.js";

const ORG = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const OWNER = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const MEMBERSHIP = "44444444-4444-4444-8444-444444444444";

function validProject() {
  return {
    id: PROJECT,
    organizationId: ORG,
    name: "Apollo",
    type: "internal",
    status: "active",
    clientId: null,
    client: null,
    ownerId: OWNER,
    owner: { id: OWNER, name: "Owner User" },
    techLeadId: null,
    techLead: null,
    businessOwnerId: null,
    businessOwner: null,
    startDate: null,
    targetDate: null,
    phase: "intake",
    tags: [],
    priority: "medium",
    visibility: "organization",
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: OWNER,
    updatedAt: "2026-01-02T00:00:00.000Z",
    updatedBy: OWNER,
    softDeletedAt: null,
    version: 1,
  };
}

function validMembership() {
  return {
    id: MEMBERSHIP,
    organizationId: ORG,
    projectId: PROJECT,
    userId: OWNER,
    user: { id: OWNER, name: "Owner User", email: "owner@example.com" },
    role: "Project Owner",
    status: "active",
    invitedAt: null,
    invitedBy: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    addedBy: OWNER,
    deactivatedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: OWNER,
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: OWNER,
    softDeletedAt: null,
    version: 1,
  };
}

describe("projectResponseSchema", () => {
  it("accepts a well-formed project", () => {
    expect(projectResponseSchema.parse(validProject()).id).toBe(PROJECT);
  });

  it("rejects unknown keys (strict)", () => {
    expect(() => projectResponseSchema.parse({ ...validProject(), extra: true })).toThrow();
  });

  it("rejects an invalid status enum", () => {
    expect(() => projectResponseSchema.parse({ ...validProject(), status: "nope" })).toThrow();
  });
});

describe("membershipResponseSchema", () => {
  it("accepts a well-formed membership and a null user", () => {
    expect(membershipResponseSchema.parse(validMembership()).id).toBe(MEMBERSHIP);
    expect(membershipResponseSchema.parse({ ...validMembership(), user: null }).user).toBeNull();
  });

  it("rejects unknown keys (strict)", () => {
    expect(() => membershipResponseSchema.parse({ ...validMembership(), extra: 1 })).toThrow();
  });
});

describe("projectDashboardResponseSchema", () => {
  it("requires every Module 1 card", () => {
    const dashboard = {
      project: validProject(),
      cards: {
        sourceDocuments: { state: "not_started", count: 0, label: "Source documents" },
        requirements: { state: "not_started", count: 0, label: "Requirements" },
        openQuestions: { state: "not_started", count: 0, label: "Open questions" },
        risksAndDeliveryItems: { state: "zero", count: 0, label: "Risks" },
        architectureReview: { state: "not_started", count: 0, label: "Architecture" },
        baselineAndHandoff: { state: "not_started", count: 0, label: "Baseline" },
      },
      nextActions: ["Prepare for source document intake."],
    };

    expect(projectDashboardResponseSchema.parse(dashboard).cards.requirements.count).toBe(0);
    const { sourceDocuments: _omit, ...missing } = dashboard.cards;
    expect(() => projectDashboardResponseSchema.parse({ ...dashboard, cards: missing })).toThrow();
  });
});
