import { organization, user } from "@atlashq/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  createDrizzleInitialAdminGateway,
  InitialAdminError,
  provisionInitialAdmin,
} from "../provisioning/index.js";
import { uniqueEmail } from "./fixtures.js";
import { useHarness } from "./suite.js";

const getHarness = useHarness();
const silentLogger = { log: () => {}, error: () => {} };

describe("integration: trusted initial-admin provisioning", () => {
  it("creates the org, provisions the admin, and is idempotent on rerun", async () => {
    const harness = getHarness();
    const gateway = createDrizzleInitialAdminGateway({
      db: harness.db,
      auth: harness.provisioningAuth,
    });

    const email = uniqueEmail("bootstrap-admin");
    const input = {
      organizationName: `Bootstrap Org ${email}`,
      adminName: "Bootstrap Admin",
      adminEmail: email,
      adminPassword: "BootstrapPass!2345",
    };

    const first = await provisionInitialAdmin(gateway, input, silentLogger);
    expect(first).toMatchObject({
      organizationCreated: true,
      userCreated: true,
      promoted: true,
      alreadyProvisioned: false,
    });

    const [createdUser] = await harness.db
      .select({ id: user.id, role: user.organizationRole, organizationId: user.organizationId })
      .from(user)
      .where(eq(user.id, first.userId));
    expect(createdUser?.role).toBe("admin");
    expect(createdUser?.organizationId).toBe(first.organizationId);

    // Rerun is a no-op: same org, same user, still admin, nothing re-created.
    const second = await provisionInitialAdmin(gateway, input, silentLogger);
    expect(second).toMatchObject({
      organizationId: first.organizationId,
      userId: first.userId,
      organizationCreated: false,
      userCreated: false,
      promoted: false,
      alreadyProvisioned: true,
    });

    const orgs = await harness.db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, input.organizationName));
    expect(orgs).toHaveLength(1);
  });

  it("promotes an existing member to admin idempotently", async () => {
    const harness = getHarness();
    const gateway = createDrizzleInitialAdminGateway({
      db: harness.db,
      auth: harness.provisioningAuth,
    });

    const [org] = await harness.db
      .insert(organization)
      .values({ name: `Existing Org ${uniqueEmail()}` })
      .returning({ id: organization.id, name: organization.name });
    if (!org) {
      throw new Error("Failed to seed organization.");
    }

    const email = uniqueEmail("existing-member");
    await harness.provisioningAuth.api.signUpEmail({
      body: {
        email,
        password: "BootstrapPass!2345",
        name: "Existing Member",
        organizationId: org.id,
      },
    });

    const result = await provisionInitialAdmin(
      gateway,
      {
        organizationName: org.name,
        adminName: "Existing Member",
        adminEmail: email,
        adminPassword: "BootstrapPass!2345",
      },
      silentLogger,
    );

    expect(result).toMatchObject({
      organizationId: org.id,
      userCreated: false,
      promoted: true,
      alreadyProvisioned: false,
    });

    const [promoted] = await harness.db
      .select({ role: user.organizationRole })
      .from(user)
      .where(eq(user.email, email));
    expect(promoted?.role).toBe("admin");
  });

  it("refuses to move an admin email that already belongs to a different organization", async () => {
    const harness = getHarness();
    const gateway = createDrizzleInitialAdminGateway({
      db: harness.db,
      auth: harness.provisioningAuth,
    });

    const [orgA] = await harness.db
      .insert(organization)
      .values({ name: `Tenant A ${uniqueEmail()}` })
      .returning({ id: organization.id });
    if (!orgA) {
      throw new Error("Failed to seed organization A.");
    }

    const email = uniqueEmail("cross-tenant");
    await harness.provisioningAuth.api.signUpEmail({
      body: {
        email,
        password: "BootstrapPass!2345",
        name: "Tenant A User",
        organizationId: orgA.id,
      },
    });

    await expect(
      provisionInitialAdmin(
        gateway,
        {
          organizationName: `Tenant B ${uniqueEmail()}`,
          adminName: "Tenant B User",
          adminEmail: email,
          adminPassword: "BootstrapPass!2345",
        },
        silentLogger,
      ),
    ).rejects.toBeInstanceOf(InitialAdminError);
  });
});
