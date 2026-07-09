import { type ProjectRole, projectRoles } from "@atlashq/types";
import { z } from "zod";

export type { ProjectRole } from "@atlashq/types";

export const betterAuthRouteMountPath = "/api/auth";

export const authEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  WEB_ORIGIN: z.string().url(),
});

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

export type AuthSession = {
  user: AuthUser;
  sessionId: string;
  expiresAt: Date;
};

export type ProjectPermission =
  | "project:read"
  | "project:write"
  | "project:admin"
  | "requirements:review"
  | "architecture:review";

export const rolePermissions = {
  [projectRoles.admin]: [
    "project:read",
    "project:write",
    "project:admin",
    "requirements:review",
    "architecture:review",
  ],
  [projectRoles.projectOwner]: [
    "project:read",
    "project:write",
    "project:admin",
    "requirements:review",
    "architecture:review",
  ],
  [projectRoles.architectTechLead]: ["project:read", "project:write", "architecture:review"],
  [projectRoles.businessAnalystCoordinator]: [
    "project:read",
    "project:write",
    "requirements:review",
  ],
  [projectRoles.developer]: ["project:read", "project:write"],
  [projectRoles.qa]: ["project:read", "requirements:review"],
  [projectRoles.clientViewerApprover]: [],
} as const satisfies Record<ProjectRole, readonly ProjectPermission[]>;

export type ProjectAccessContext = {
  organizationId: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  visibility: "private" | "organization";
};

export type BetterAuthPlaceholderConfig = {
  provider: "better-auth";
  routeMountPath: typeof betterAuthRouteMountPath;
  emailAndPassword: { enabled: true };
  secret: "env:AUTH_SECRET";
  baseURL: "env:AUTH_URL";
  database: {
    adapter: "drizzle";
    provider: "postgresql";
    connection: "env:DATABASE_URL";
  };
  security: {
    secureCookies: boolean;
    csrfProtection: "origin-check-required";
    trustedOrigins: readonly string[];
  };
  optionalRedis?: {
    rateLimitStorage: "secondary-storage";
    sessionStorage: "secondary-storage";
    connection: "env:REDIS_URL";
  };
};

export function createBetterAuthPlaceholderConfig(
  input: z.input<typeof authEnvSchema>,
): BetterAuthPlaceholderConfig {
  const env = authEnvSchema.parse(input);

  return {
    provider: "better-auth",
    routeMountPath: betterAuthRouteMountPath,
    emailAndPassword: { enabled: true },
    secret: "env:AUTH_SECRET",
    baseURL: "env:AUTH_URL",
    database: {
      adapter: "drizzle",
      provider: "postgresql",
      connection: "env:DATABASE_URL",
    },
    security: {
      secureCookies: env.NODE_ENV === "production",
      csrfProtection: "origin-check-required",
      trustedOrigins: [env.AUTH_URL, env.WEB_ORIGIN],
    },
    ...(env.REDIS_URL
      ? {
          optionalRedis: {
            rateLimitStorage: "secondary-storage" as const,
            sessionStorage: "secondary-storage" as const,
            connection: "env:REDIS_URL" as const,
          },
        }
      : {}),
  };
}

export function canProjectRole(role: ProjectRole, permission: ProjectPermission): boolean {
  return (rolePermissions[role] as readonly ProjectPermission[]).includes(permission);
}
