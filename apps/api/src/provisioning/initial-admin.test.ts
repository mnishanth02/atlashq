import { describe, expect, it, vi } from "vitest";
import {
  type ExistingAdminUser,
  type ExistingOrganization,
  InitialAdminError,
  type InitialAdminGateway,
  provisionInitialAdmin,
  resolveInitialAdminPlan,
} from "./initial-admin.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const NEW_USER_ID = "44444444-4444-4444-8444-444444444444";

const validInput = {
  organizationName: "Acme",
  adminName: "Ada Admin",
  adminEmail: "ada@acme.test",
  adminPassword: "BootstrapPass!2345",
};

/**
 * In-memory fake gateway so idempotency and decision execution are covered
 * without any shared database. Records the calls a test wants to assert on.
 */
function createFakeGateway(
  state: {
    organization?: ExistingOrganization;
    user?: ExistingAdminUser;
    newOrganizationId?: string;
    newUserId?: string;
  } = {},
): InitialAdminGateway & {
  calls: {
    createOrganization: string[];
    provisionUser: Array<{ email: string; organizationId: string }>;
    promoteToAdmin: string[];
  };
} {
  const calls = {
    createOrganization: [] as string[],
    provisionUser: [] as Array<{ email: string; organizationId: string }>,
    promoteToAdmin: [] as string[],
  };

  return {
    calls,
    async findOrganizationByName() {
      return state.organization ?? null;
    },
    async findUserByEmail() {
      return state.user ?? null;
    },
    async createOrganization(name) {
      calls.createOrganization.push(name);
      return state.newOrganizationId ?? ORG_ID;
    },
    async provisionUser(input) {
      calls.provisionUser.push({ email: input.email, organizationId: input.organizationId });
      return { id: state.newUserId ?? NEW_USER_ID };
    },
    async promoteToAdmin(userId) {
      calls.promoteToAdmin.push(userId);
    },
  };
}

const silentLogger = { log: () => {}, error: () => {} };

describe("resolveInitialAdminPlan", () => {
  it("creates a new organization and user when nothing exists", () => {
    const plan = resolveInitialAdminPlan({ organization: null, user: null });
    expect(plan).toEqual({ kind: "create", createOrganization: true, organizationId: null });
  });

  it("reuses an existing organization when the user does not yet exist", () => {
    const plan = resolveInitialAdminPlan({
      organization: { id: ORG_ID, name: "Acme" },
      user: null,
    });
    expect(plan).toEqual({ kind: "create", createOrganization: false, organizationId: ORG_ID });
  });

  it("plans an idempotent promote when the admin already exists in the target org", () => {
    const plan = resolveInitialAdminPlan({
      organization: { id: ORG_ID, name: "Acme" },
      user: { id: USER_ID, organizationId: ORG_ID, organizationRole: "member" },
    });
    expect(plan).toEqual({
      kind: "promote",
      userId: USER_ID,
      organizationId: ORG_ID,
      alreadyAdmin: false,
    });
  });

  it("reports the admin is already provisioned when they are already an org admin", () => {
    const plan = resolveInitialAdminPlan({
      organization: { id: ORG_ID, name: "Acme" },
      user: { id: USER_ID, organizationId: ORG_ID, organizationRole: "admin" },
    });
    expect(plan).toMatchObject({ kind: "promote", alreadyAdmin: true });
  });

  it("flags a conflict when the email belongs to a different organization", () => {
    const plan = resolveInitialAdminPlan({
      organization: { id: ORG_ID, name: "Acme" },
      user: { id: USER_ID, organizationId: OTHER_ORG_ID, organizationRole: "member" },
    });
    expect(plan.kind).toBe("conflict");
  });

  it("flags a conflict when the email exists but the target org does not", () => {
    const plan = resolveInitialAdminPlan({
      organization: null,
      user: { id: USER_ID, organizationId: OTHER_ORG_ID, organizationRole: "member" },
    });
    expect(plan.kind).toBe("conflict");
  });
});

describe("provisionInitialAdmin input validation", () => {
  it("rejects a missing organization name", async () => {
    const gateway = createFakeGateway();
    await expect(
      provisionInitialAdmin(gateway, { ...validInput, organizationName: "   " }, silentLogger),
    ).rejects.toBeInstanceOf(InitialAdminError);
  });

  it("rejects an invalid admin email", async () => {
    const gateway = createFakeGateway();
    await expect(
      provisionInitialAdmin(gateway, { ...validInput, adminEmail: "not-an-email" }, silentLogger),
    ).rejects.toBeInstanceOf(InitialAdminError);
  });

  it("rejects a password shorter than the 12-character minimum", async () => {
    const gateway = createFakeGateway();
    await expect(
      provisionInitialAdmin(gateway, { ...validInput, adminPassword: "short" }, silentLogger),
    ).rejects.toBeInstanceOf(InitialAdminError);
  });

  it("rejects entirely missing input", async () => {
    const gateway = createFakeGateway();
    await expect(provisionInitialAdmin(gateway, {}, silentLogger)).rejects.toBeInstanceOf(
      InitialAdminError,
    );
  });
});

describe("provisionInitialAdmin execution", () => {
  it("creates the org, provisions the user, and promotes to admin on a clean run", async () => {
    const gateway = createFakeGateway();
    const result = await provisionInitialAdmin(gateway, validInput, silentLogger);

    expect(result).toMatchObject({
      organizationCreated: true,
      userCreated: true,
      promoted: true,
      alreadyProvisioned: false,
    });
    expect(gateway.calls.createOrganization).toEqual(["Acme"]);
    expect(gateway.calls.provisionUser).toEqual([
      { email: "ada@acme.test", organizationId: ORG_ID },
    ]);
    expect(gateway.calls.promoteToAdmin).toEqual([NEW_USER_ID]);
  });

  it("normalises the admin email to lower case before provisioning", async () => {
    const gateway = createFakeGateway();
    await provisionInitialAdmin(
      gateway,
      { ...validInput, adminEmail: "  Ada@ACME.test  " },
      silentLogger,
    );
    expect(gateway.calls.provisionUser[0]?.email).toBe("ada@acme.test");
  });

  it("reuses an existing organization instead of creating a duplicate", async () => {
    const gateway = createFakeGateway({ organization: { id: ORG_ID, name: "Acme" } });
    const result = await provisionInitialAdmin(gateway, validInput, silentLogger);

    expect(result.organizationCreated).toBe(false);
    expect(gateway.calls.createOrganization).toEqual([]);
    expect(gateway.calls.provisionUser).toEqual([
      { email: "ada@acme.test", organizationId: ORG_ID },
    ]);
  });

  it("promotes an existing member idempotently without re-provisioning", async () => {
    const gateway = createFakeGateway({
      organization: { id: ORG_ID, name: "Acme" },
      user: { id: USER_ID, organizationId: ORG_ID, organizationRole: "member" },
    });
    const result = await provisionInitialAdmin(gateway, validInput, silentLogger);

    expect(result).toMatchObject({ userCreated: false, promoted: true, alreadyProvisioned: false });
    expect(gateway.calls.provisionUser).toEqual([]);
    expect(gateway.calls.promoteToAdmin).toEqual([USER_ID]);
  });

  it("is a no-op when the admin is already provisioned (rerun idempotency)", async () => {
    const gateway = createFakeGateway({
      organization: { id: ORG_ID, name: "Acme" },
      user: { id: USER_ID, organizationId: ORG_ID, organizationRole: "admin" },
    });
    const result = await provisionInitialAdmin(gateway, validInput, silentLogger);

    expect(result).toMatchObject({
      userCreated: false,
      promoted: false,
      alreadyProvisioned: true,
    });
    expect(gateway.calls.createOrganization).toEqual([]);
    expect(gateway.calls.provisionUser).toEqual([]);
    expect(gateway.calls.promoteToAdmin).toEqual([]);
  });

  it("refuses to move an existing user between tenants", async () => {
    const gateway = createFakeGateway({
      organization: { id: ORG_ID, name: "Acme" },
      user: { id: USER_ID, organizationId: OTHER_ORG_ID, organizationRole: "member" },
    });
    const provisionSpy = vi.spyOn(gateway, "provisionUser");

    await expect(provisionInitialAdmin(gateway, validInput, silentLogger)).rejects.toBeInstanceOf(
      InitialAdminError,
    );
    expect(provisionSpy).not.toHaveBeenCalled();
  });
});
