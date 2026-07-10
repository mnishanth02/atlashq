import type { ProjectAccessMembership, ProjectAccessProject, ProjectRole } from "@atlashq/auth";
import { type Database, project, projectMembership } from "@atlashq/db";
import { and, eq, isNull, ne } from "drizzle-orm";

/**
 * Organization-scoped, parameterized read boundary used by the project
 * authorization guard. Modelled as an interface so the guard can be unit tested
 * with an in-memory fake and the Drizzle implementation stays free of NestJS.
 */
export interface ProjectAccessQueries {
  findProject(organizationId: string, projectId: string): Promise<ProjectAccessProject | null>;
  findActiveMembership(
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<ProjectAccessMembership | null>;
}

export class DrizzleProjectAccessQueries implements ProjectAccessQueries {
  constructor(private readonly db: Database | null) {}

  private requireDb(): Database {
    if (!this.db) {
      throw new Error("Database client is not available for project access queries.");
    }

    return this.db;
  }

  async findProject(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectAccessProject | null> {
    const rows = await this.requireDb()
      .select({
        organizationId: project.organizationId,
        status: project.status,
        softDeletedAt: project.softDeletedAt,
      })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.organizationId, organizationId)))
      .limit(1);

    const row = rows[0];
    return row
      ? {
          organizationId: row.organizationId,
          status: row.status,
          softDeletedAt: row.softDeletedAt,
        }
      : null;
  }

  async findActiveMembership(
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<ProjectAccessMembership | null> {
    const rows = await this.requireDb()
      .select({
        role: projectMembership.role,
        status: projectMembership.status,
        softDeletedAt: projectMembership.softDeletedAt,
      })
      .from(projectMembership)
      .where(
        and(
          eq(projectMembership.organizationId, organizationId),
          eq(projectMembership.projectId, projectId),
          eq(projectMembership.userId, userId),
          isNull(projectMembership.softDeletedAt),
          ne(projectMembership.status, "removed"),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row
      ? {
          role: row.role as ProjectRole,
          status: row.status,
          softDeletedAt: row.softDeletedAt,
        }
      : null;
  }
}
