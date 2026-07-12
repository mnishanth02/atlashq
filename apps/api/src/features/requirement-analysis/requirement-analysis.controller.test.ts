import { describe, expect, it, vi } from "vitest";
import type { AuditRequestContext } from "../../audit/audit-request-context.js";
import type { RequestSessionContext } from "../../auth/session-context.js";
import {
  RequirementAnalysisController,
  RequirementAnalysisOrganizationController,
} from "./requirement-analysis.controller.js";
import type { RequirementAnalysisService } from "./requirement-analysis.service.js";

const ORG = "b12c5b83-4f10-4c58-8ce4-94bbf1adcd90";
const ADMIN = "67dcb6b0-14b9-444a-9cf0-6eb033af62b0";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const RUN = "44444444-4444-4444-8444-444444444444";
const POLICY = "55555555-5555-4555-8555-555555555555";

function session(): RequestSessionContext {
  return {
    user: {
      id: ADMIN,
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

const expectedContext: AuditRequestContext = {
  actor: { actorId: ADMIN, organizationId: ORG },
  correlationId: "corr-123",
};

function request() {
  return { headers: { "x-correlation-id": "corr-123" } };
}

function callArg<T = unknown>(
  mock: { mock: { calls: readonly (readonly unknown[])[] } },
  call: number,
  arg: number,
): T {
  return mock.mock.calls[call]?.[arg] as T;
}

describe("RequirementAnalysisOrganizationController audit-context forwarding", () => {
  it("forwards audit context to createOrganizationProviderPolicy", async () => {
    const createOrganizationProviderPolicy = vi.fn(async () => ({}));
    const controller = new RequirementAnalysisOrganizationController({
      createOrganizationProviderPolicy,
    } as unknown as RequirementAnalysisService);

    await controller.createProviderPolicy(session(), request(), {
      provider: "openai",
      policyName: "Policy A",
      modelAlias: "gpt-4o-mini",
      resolvedModelId: "gpt-4o-mini",
      dataRetentionMode: "provider_default",
    } as never);

    expect(callArg(createOrganizationProviderPolicy, 0, 2)).toEqual(expectedContext);
  });

  it("forwards policy id and audit context to approveOrganizationProviderPolicy", async () => {
    const approveOrganizationProviderPolicy = vi.fn(async () => ({}));
    const controller = new RequirementAnalysisOrganizationController({
      approveOrganizationProviderPolicy,
    } as unknown as RequirementAnalysisService);

    await controller.approveProviderPolicy(
      session(),
      request(),
      { policyId: POLICY } as never,
      { version: 1 } as never,
    );

    expect(callArg(approveOrganizationProviderPolicy, 0, 1)).toBe(POLICY);
    expect(callArg(approveOrganizationProviderPolicy, 0, 3)).toEqual(expectedContext);
  });
});

describe("RequirementAnalysisController audit-context forwarding", () => {
  it("forwards project/run ids and audit context to createFreshRun and cancelRun", async () => {
    const createFreshRun = vi.fn(async () => ({}));
    const cancelRun = vi.fn(async () => ({}));
    const controller = new RequirementAnalysisController({
      createFreshRun,
      cancelRun,
    } as unknown as RequirementAnalysisService);

    await controller.createFreshRun(
      session(),
      request(),
      { projectId: PROJECT } as never,
      { providerPolicyId: POLICY } as never,
    );
    expect(callArg(createFreshRun, 0, 1)).toBe(PROJECT);
    expect(callArg(createFreshRun, 0, 3)).toEqual(expectedContext);

    await controller.cancelRun(
      session(),
      request(),
      { projectId: PROJECT, runId: RUN } as never,
      {},
    );
    expect(callArg(cancelRun, 0, 1)).toBe(PROJECT);
    expect(callArg(cancelRun, 0, 2)).toBe(RUN);
    expect(callArg(cancelRun, 0, 4)).toEqual(expectedContext);
  });
});
