import type { Auth } from "@atlashq/auth";
import { type Database, organization, user } from "@atlashq/db";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

/**
 * Trusted, explicit initial-admin provisioning.
 *
 * This is the ONLY supported way to create the very first organization admin.
 * Public email/password sign-up is closed on the mounted API (see
 * `@atlashq/auth` `createAuth` / `disableSignUp`), so no unauthenticated browser
 * caller can enrol themselves into a tenant by supplying an `organizationId`.
 *
 * The provisioning path is:
 *   1. validate strictly-typed, environment-supplied inputs (no raw secrets in
 *      arguments or logs),
 *   2. reconcile against the current database state through an injectable
 *      {@link InitialAdminGateway} (so the decision logic is unit-testable
 *      without a database),
 *   3. create the organization if absent, provision the admin user through a
 *      trusted, **non-mounted** Better Auth instance whose sign-up is explicitly
 *      enabled, promote them to `admin`, and treat reruns idempotently, and
 *   4. fail loudly if the admin email already belongs to a different tenant or
 *      the inputs are unsafe.
 */

/** Raised for every explicit, operator-actionable provisioning failure. */
export class InitialAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitialAdminError";
  }
}

/** Server-controlled organization role granted to the bootstrapped admin. */
export const INITIAL_ADMIN_ROLE = "admin";

/** Mirrors Better Auth's configured password bounds so we fail fast with a clear message. */
export const INITIAL_ADMIN_MIN_PASSWORD_LENGTH = 12;
export const INITIAL_ADMIN_MAX_PASSWORD_LENGTH = 128;

const trimmed = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, `${label} is required.`),
  );

/**
 * Strict schema for the operator-supplied initial-admin inputs. Email is trimmed
 * and lower-cased so reruns reconcile against the same stored user regardless of
 * casing/whitespace.
 */
export const initialAdminInputSchema = z.object({
  organizationName: trimmed("Organization name"),
  adminName: trimmed("Admin name"),
  adminEmail: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.email("A valid admin email is required."),
  ),
  adminPassword: z
    .string()
    .min(
      INITIAL_ADMIN_MIN_PASSWORD_LENGTH,
      `Admin password must be at least ${INITIAL_ADMIN_MIN_PASSWORD_LENGTH} characters.`,
    )
    .max(
      INITIAL_ADMIN_MAX_PASSWORD_LENGTH,
      `Admin password must be at most ${INITIAL_ADMIN_MAX_PASSWORD_LENGTH} characters.`,
    ),
});

export type InitialAdminInput = z.infer<typeof initialAdminInputSchema>;

/** Existing organization matched by exact (non-deleted) name, or `null`. */
export type ExistingOrganization = { id: string; name: string } | null;

/** Existing user matched by email, or `null`. */
export type ExistingAdminUser = {
  id: string;
  organizationId: string;
  organizationRole: string;
} | null;

/**
 * Pure decision output describing the single action to take. Keeping this free
 * of I/O makes every branch (create / idempotent promote / cross-tenant
 * conflict) trivially unit-testable without a database.
 */
export type InitialAdminPlan =
  | { kind: "create"; createOrganization: boolean; organizationId: string | null }
  | { kind: "promote"; userId: string; organizationId: string; alreadyAdmin: boolean }
  | { kind: "conflict"; reason: string };

/**
 * Decide what to do given the current organization/user state. This never
 * mutates and never moves an existing user between tenants.
 */
export function resolveInitialAdminPlan(state: {
  organization: ExistingOrganization;
  user: ExistingAdminUser;
}): InitialAdminPlan {
  const { organization: existingOrganization, user: existingUser } = state;

  if (existingUser) {
    // The admin email is already registered. It is only safe to reconcile when
    // the user already belongs to the exact organization we are bootstrapping.
    if (existingOrganization && existingUser.organizationId === existingOrganization.id) {
      return {
        kind: "promote",
        userId: existingUser.id,
        organizationId: existingOrganization.id,
        alreadyAdmin: existingUser.organizationRole === INITIAL_ADMIN_ROLE,
      };
    }

    return {
      kind: "conflict",
      reason:
        "The admin email already belongs to a different organization. Refusing to move an " +
        "existing user between tenants; use a fresh email or the matching organization name.",
    };
  }

  return {
    kind: "create",
    createOrganization: existingOrganization === null,
    organizationId: existingOrganization?.id ?? null,
  };
}

/**
 * Injectable data-access boundary for provisioning. The real implementation is
 * Drizzle-backed ({@link createDrizzleInitialAdminGateway}); tests supply an
 * in-memory fake so idempotency and decision logic run without a shared DB.
 */
export type InitialAdminGateway = {
  findOrganizationByName(name: string): Promise<ExistingOrganization>;
  findUserByEmail(email: string): Promise<ExistingAdminUser>;
  createOrganization(name: string): Promise<string>;
  provisionUser(input: {
    email: string;
    password: string;
    name: string;
    organizationId: string;
  }): Promise<{ id: string }>;
  promoteToAdmin(userId: string): Promise<void>;
};

export type InitialAdminLogger = Pick<Console, "log" | "error">;

export type InitialAdminResult = {
  organizationId: string;
  userId: string;
  organizationCreated: boolean;
  userCreated: boolean;
  promoted: boolean;
  alreadyProvisioned: boolean;
};

/**
 * Provision (or idempotently reconcile) the initial organization admin. Safe to
 * rerun: a second invocation with the same inputs is a no-op once the admin is
 * already provisioned. Throws {@link InitialAdminError} for unsafe inputs or a
 * cross-tenant email conflict.
 */
export async function provisionInitialAdmin(
  gateway: InitialAdminGateway,
  rawInput: unknown,
  logger: InitialAdminLogger = console,
): Promise<InitialAdminResult> {
  const parsed = initialAdminInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new InitialAdminError(message || "Invalid initial-admin input.");
  }
  const input = parsed.data;

  const [existingOrganization, existingUser] = await Promise.all([
    gateway.findOrganizationByName(input.organizationName),
    gateway.findUserByEmail(input.adminEmail),
  ]);

  const plan = resolveInitialAdminPlan({
    organization: existingOrganization,
    user: existingUser,
  });

  if (plan.kind === "conflict") {
    throw new InitialAdminError(plan.reason);
  }

  if (plan.kind === "promote") {
    if (plan.alreadyAdmin) {
      logger.log(
        `Initial admin already provisioned (${input.adminEmail} in organization ${plan.organizationId}); nothing to do.`,
      );
      return {
        organizationId: plan.organizationId,
        userId: plan.userId,
        organizationCreated: false,
        userCreated: false,
        promoted: false,
        alreadyProvisioned: true,
      };
    }

    await gateway.promoteToAdmin(plan.userId);
    logger.log(
      `Promoted existing user ${input.adminEmail} to organization admin in ${plan.organizationId}.`,
    );
    return {
      organizationId: plan.organizationId,
      userId: plan.userId,
      organizationCreated: false,
      userCreated: false,
      promoted: true,
      alreadyProvisioned: false,
    };
  }

  let organizationId = plan.organizationId;
  let organizationCreated = false;
  if (plan.createOrganization) {
    organizationId = await gateway.createOrganization(input.organizationName);
    organizationCreated = true;
    logger.log(`Created organization "${input.organizationName}" (${organizationId}).`);
  }

  if (!organizationId) {
    throw new InitialAdminError("Failed to resolve the target organization id.");
  }

  const provisioned = await gateway.provisionUser({
    email: input.adminEmail,
    password: input.adminPassword,
    name: input.adminName,
    organizationId,
  });

  await gateway.promoteToAdmin(provisioned.id);
  logger.log(
    `Provisioned initial admin ${input.adminEmail} (${provisioned.id}) as organization admin.`,
  );

  return {
    organizationId,
    userId: provisioned.id,
    organizationCreated,
    userCreated: true,
    promoted: true,
    alreadyProvisioned: false,
  };
}

/**
 * Build the production Drizzle/Better Auth gateway. `auth` MUST be a trusted,
 * non-mounted Better Auth instance created with `allowSignUp: true` — it is used
 * only for server-side provisioning and is never exposed over HTTP.
 */
export function createDrizzleInitialAdminGateway(deps: {
  db: Database;
  auth: Auth;
}): InitialAdminGateway {
  const { db, auth } = deps;

  return {
    async findOrganizationByName(name) {
      const rows = await db
        .select({ id: organization.id, name: organization.name })
        .from(organization)
        .where(and(eq(organization.name, name), isNull(organization.softDeletedAt)))
        .limit(2);

      if (rows.length > 1) {
        throw new InitialAdminError(
          `Multiple organizations named "${name}" exist; refusing to guess which to bootstrap.`,
        );
      }

      return rows[0] ?? null;
    },

    async findUserByEmail(email) {
      const rows = await db
        .select({
          id: user.id,
          organizationId: user.organizationId,
          organizationRole: user.organizationRole,
        })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      return rows[0] ?? null;
    },

    async createOrganization(name) {
      const [row] = await db
        .insert(organization)
        .values({ name })
        .returning({ id: organization.id });

      if (!row) {
        throw new InitialAdminError("Failed to create the organization.");
      }

      return row.id;
    },

    async provisionUser(input) {
      const result = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
          organizationId: input.organizationId,
        },
      });

      if (!result?.user?.id) {
        throw new InitialAdminError("Better Auth did not return a provisioned user.");
      }

      return { id: result.user.id };
    },

    async promoteToAdmin(userId) {
      await db
        .update(user)
        .set({ organizationRole: INITIAL_ADMIN_ROLE })
        .where(eq(user.id, userId));
    },
  };
}
