export const E2E_BASE_URL = "http://127.0.0.1:4187";
export const E2E_API_URL = "http://127.0.0.1:3000";

export const E2E_ORGANIZATION_NAME = "AtlasHQ Lifecycle E2E";
export const E2E_USER_NAME = "Lifecycle E2E Admin";
export const E2E_USER_EMAIL = "lifecycle.admin@atlashq.test";
export const E2E_USER_PASSWORD = "E2E-Test-Password!2345";

export const E2E_PROJECT_NAME = "Internal Delivery Readiness";

// A second, non-admin organization member used only by the Source Vault permission-boundary
// coverage: an "Architect / Tech Lead" project role has `sources:read`/`sources:write` but never
// `project:admin`, so it can exercise upload/version flows while still being correctly denied the
// admin-only IP-review actions (module-02 §7).
export const E2E_MEMBER_NAME = "Source Vault Contributor";
export const E2E_MEMBER_EMAIL = "source.contributor@atlashq.test";
export const E2E_MEMBER_PASSWORD = "E2E-Test-Password!6789";

export const E2E_SOURCE_VAULT_PROJECT_NAME = "Source Vault E2E Workspace";
