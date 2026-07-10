import { type Database, organization, user } from "@atlashq/db";
import { and, eq, isNull } from "drizzle-orm";

/** Fresh, authoritative user projection loaded from the database. */
export type DirectoryUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationRole: string;
  status: string;
};

/** Fresh organization projection loaded from the database. */
export type DirectoryOrganization = {
  id: string;
  name: string;
  plan: string;
};

/**
 * Read-only directory used by the protected `/me` and `/organizations/current`
 * endpoints to return authoritative, organization-scoped context straight from
 * the database rather than trusting only the cached session projection.
 */
export interface AuthDirectory {
  findUser(organizationId: string, userId: string): Promise<DirectoryUser | null>;
  findOrganization(organizationId: string): Promise<DirectoryOrganization | null>;
}

export class DrizzleAuthDirectory implements AuthDirectory {
  constructor(private readonly db: Database | null) {}

  private requireDb(): Database {
    if (!this.db) {
      throw new Error("Database client is not available for the auth directory.");
    }

    return this.db;
  }

  async findUser(organizationId: string, userId: string): Promise<DirectoryUser | null> {
    const rows = await this.requireDb()
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        organizationRole: user.organizationRole,
        status: user.status,
      })
      .from(user)
      .where(
        and(
          eq(user.id, userId),
          eq(user.organizationId, organizationId),
          isNull(user.softDeletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findOrganization(organizationId: string): Promise<DirectoryOrganization | null> {
    const rows = await this.requireDb()
      .select({
        id: organization.id,
        name: organization.name,
        plan: organization.plan,
      })
      .from(organization)
      .where(and(eq(organization.id, organizationId), isNull(organization.softDeletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }
}
