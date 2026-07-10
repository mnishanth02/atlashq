export {
  type Auth,
  type AuthSession,
  type AuthSessionRecord,
  type AuthUser,
  betterAuthBasePath,
  betterAuthExpressWildcardPath,
  betterAuthRouteMountPath,
  type CreateAuthOptions,
  createAuth,
} from "./config.js";
export {
  type AuthEnv,
  type AuthRuntimeEnv,
  authEnvSchema,
  resolveTrustedOrigins,
  toOrigin,
} from "./env.js";
export {
  canAccessProject,
  canProjectRole,
  evaluateProjectAccess,
  isMutationPermission,
  type ProjectAccessActor,
  type ProjectAccessContext,
  type ProjectAccessDecision,
  type ProjectAccessDecisionInput,
  type ProjectAccessMembership,
  type ProjectAccessProject,
  type ProjectAccessReason,
  type ProjectPermission,
  type ProjectRole,
  rolePermissions,
} from "./permissions.js";
export {
  createAuthNodeHandler,
  getSessionFromNodeHeaders,
  type ResolvedAuthSession,
} from "./server.js";
