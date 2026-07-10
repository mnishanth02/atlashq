import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { RequestSessionContext } from "../../auth/session-context.js";
import type { ProjectDetailRow } from "./projects.types.js";
import {
  assertActiveReference,
  assertOrganizationAdmin,
  buildProjectDashboard,
  decodeAuditCursor,
  decodeMembershipCursor,
  decodeProjectCursor,
  encodeAuditCursor,
  encodeMembershipCursor,
  encodeProjectCursor,
  isArchived,
  mergeProjectUpdate,
  paginate,
  toProjectResponse,
} from "./projects.utils.js";

const ORG = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const OWNER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "33333333-3333-4333-8333-333333333333";
const PROJECT = "22222222-2222-4222-8222-222222222222";

function adminSession(): RequestSessionContext {
  return {
    user: {
      id: "67dcb6b0-14b9-444a-9cf0-6eb033af62b0",
      email: "admin@example.com",
      name: "Ada Lovelace",
      organizationId: ORG,
      organizationRole: "admin",
      status: "active",
    },
    session: {
      id: "61e6c6c8-6f1a-4c62-84ca-3e4d2a18c2f8",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    },
  };
}

function detailRow(overrides: Partial<ProjectDetailRow> = {}): ProjectDetailRow {
  return {
    id: PROJECT,
    organizationId: ORG,
    clientId: null,
    name: "Apollo",
    type: "internal",
    status: "active",
    ownerId: OWNER,
    techLeadId: null,
    businessOwnerId: null,
    startDate: null,
    targetDate: null,
    currentPhase: "intake",
    tags: ["alpha"],
    priority: "medium",
    visibility: "organization",
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: OWNER,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedBy: OWNER,
    softDeletedAt: null,
    version: 3,
    clientName: null,
    ownerName: "Owner User",
    techLeadName: null,
    businessOwnerName: null,
    ...overrides,
  };
}

describe("project cursor helpers", () => {
  it("round-trips project, membership, and audit cursors", () => {
    const project = encodeProjectCursor({
      sort: "updated_desc",
      value: "2026-01-02T00:00:00.000Z",
      id: PROJECT,
    });
    const membership = encodeMembershipCursor({
      createdAt: "2026-01-02T00:00:00.000Z",
      id: "44444444-4444-4444-8444-444444444444",
    });
    const audit = encodeAuditCursor({
      at: "2026-01-02T00:00:00.000Z",
      id: "77777777-7777-4777-8777-777777777777",
    });

    expect(decodeProjectCursor(project, "updated_desc")).toEqual({
      sort: "updated_desc",
      value: "2026-01-02T00:00:00.000Z",
      id: PROJECT,
    });
    expect(decodeMembershipCursor(membership).id).toBe("44444444-4444-4444-8444-444444444444");
    expect(decodeAuditCursor(audit).at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeProjectCursor("not-base64", "updated_desc")).toThrow(BadRequestException);
    expect(() =>
      decodeProjectCursor(
        encodeProjectCursor({ sort: "name_asc", value: "apollo", id: PROJECT }),
        "name_desc",
      ),
    ).toThrow("does not match");
    expect(() => decodeMembershipCursor("!!!")).toThrow(BadRequestException);
    expect(() =>
      decodeAuditCursor(
        encodeProjectCursor({ sort: "updated_desc", value: "not-a-date", id: PROJECT }),
      ),
    ).toThrow(BadRequestException);
  });
});

describe("paginate", () => {
  it("marks hasMore and derives the next cursor from the last kept item", () => {
    const page = paginate([{ n: 1 }, { n: 2 }, { n: 3 }], 2, (item) => `cursor-${item.n}`);

    expect(page.items).toHaveLength(2);
    expect(page.pageInfo.hasMore).toBe(true);
    expect(page.pageInfo.nextCursor).toBe("cursor-2");
  });

  it("reports no next cursor when the page is not full", () => {
    const page = paginate([{ n: 1 }], 2, (item) => `cursor-${item.n}`);

    expect(page.pageInfo.hasMore).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });
});

describe("authorization helpers", () => {
  it("allows organization admins and rejects everyone else", () => {
    expect(() => assertOrganizationAdmin(adminSession())).not.toThrow();
    expect(() =>
      assertOrganizationAdmin({
        ...adminSession(),
        user: { ...adminSession().user, organizationRole: "member" },
      }),
    ).toThrow(ForbiddenException);
  });

  it("asserts an active same-org reference", () => {
    expect(() => assertActiveReference({ status: "active" }, "nope")).not.toThrow();
    expect(() => assertActiveReference({ status: "invited" }, "nope")).toThrow(BadRequestException);
    expect(() => assertActiveReference(null, "nope")).toThrow(BadRequestException);
  });

  it("recognizes archived status", () => {
    expect(isArchived("archived")).toBe(true);
    expect(isArchived("active")).toBe(false);
  });
});

describe("mergeProjectUpdate", () => {
  it("clears clientId when switching a client project to internal", () => {
    const merged = mergeProjectUpdate(detailRow({ type: "client", clientId: CLIENT }), {
      version: 3,
      type: "internal",
    });

    expect(merged.type).toBe("internal");
    expect(merged.clientId).toBeNull();
  });

  it("rejects switching to a client project without a client", () => {
    expect(() =>
      mergeProjectUpdate(detailRow({ type: "internal" }), { version: 3, type: "client" }),
    ).toThrow();
  });

  it("re-runs the client rule when type and clientId arrive in separate fields", () => {
    const merged = mergeProjectUpdate(detailRow({ type: "internal" }), {
      version: 3,
      type: "client",
      clientId: CLIENT,
    });

    expect(merged.type).toBe("client");
    expect(merged.clientId).toBe(CLIENT);
  });

  it("preserves untouched fields from the persisted project", () => {
    const merged = mergeProjectUpdate(detailRow({ priority: "high", tags: ["kept"] }), {
      version: 3,
      name: "Renamed",
    });

    expect(merged.name).toBe("Renamed");
    expect(merged.priority).toBe("high");
    expect(merged.tags).toEqual(["kept"]);
  });

  it("distinguishes omitted nullable fields from explicit null", () => {
    const current = detailRow({
      techLeadId: OWNER,
      businessOwnerId: OWNER,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      targetDate: new Date("2026-05-01T00:00:00.000Z"),
      description: "Keep me",
    });

    const omitted = mergeProjectUpdate(current, { version: 3, name: "Renamed" });
    expect(omitted.techLeadId).toBe(OWNER);
    expect(omitted.description).toBe("Keep me");

    const cleared = mergeProjectUpdate(current, {
      version: 3,
      techLeadId: null,
      businessOwnerId: null,
      startDate: null,
      targetDate: null,
      description: null,
    });
    expect(cleared).toMatchObject({
      techLeadId: null,
      businessOwnerId: null,
      startDate: null,
      targetDate: null,
      description: null,
    });
  });
});

describe("buildProjectDashboard", () => {
  it("returns honest Module 1 zero-state cards", () => {
    const dashboard = buildProjectDashboard(toProjectResponse(detailRow()));

    expect(dashboard.cards.sourceDocuments.state).toBe("not_started");
    expect(dashboard.cards.requirements.state).toBe("not_started");
    expect(dashboard.cards.openQuestions.state).toBe("not_started");
    expect(dashboard.cards.risksAndDeliveryItems.state).toBe("zero");
    expect(dashboard.cards.architectureReview.state).toBe("not_started");
    expect(dashboard.cards.baselineAndHandoff.state).toBe("not_started");
    for (const card of Object.values(dashboard.cards)) {
      expect(card.count).toBe(0);
    }
    expect(dashboard.nextActions.length).toBeGreaterThan(0);
  });
});

describe("toProjectResponse", () => {
  it("maps the persisted phase column and serializes dates to ISO strings", () => {
    const response = toProjectResponse(
      detailRow({
        currentPhase: "requirements",
        startDate: new Date("2026-03-01T00:00:00.000Z"),
        ownerName: "Owner User",
      }),
    );

    expect(response.phase).toBe("requirements");
    expect(response.startDate).toBe("2026-03-01T00:00:00.000Z");
    expect(response.owner).toEqual({ id: OWNER, name: "Owner User" });
    expect(response.updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });
});
