import { describe, expect, it } from "vitest";
import {
  createAtlasApiClient,
  DEFAULT_API_BASE_URL,
  getAuthContextQueryKey,
  getClientQueryKey,
  getClientsListQueryKey,
  getHealthQueryKey,
  getOrganizationUsersListQueryKey,
  getProjectAuditEventsQueryKey,
  getProjectDashboardQueryKey,
  getProjectMembershipsQueryKey,
  getProjectQueryKey,
  getProjectsListQueryKey,
} from "./index.js";

const HEALTH_BODY = { status: "ok", service: "api", version: "0.0.0" } as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createAtlasApiClient", () => {
  it("defaults to the same-origin base URL", () => {
    expect(DEFAULT_API_BASE_URL).toBe("");
  });

  it("defaults to cookie-authenticated requests", async () => {
    let captured: Request | undefined;
    const client = createAtlasApiClient({
      baseUrl: "https://api.example.test",
      fetch: async (input) => {
        captured = input instanceof Request ? input : new Request(input);
        return jsonResponse(HEALTH_BODY);
      },
    });

    const { data, error } = await client.GET("/api/v1/health");

    expect(captured?.credentials).toBe("include");
    expect(error).toBeUndefined();
    expect(data).toEqual(HEALTH_BODY);
  });

  it("allows overriding the credentials mode", async () => {
    let captured: Request | undefined;
    const client = createAtlasApiClient({
      baseUrl: "https://api.example.test",
      credentials: "omit",
      fetch: async (input) => {
        captured = input instanceof Request ? input : new Request(input);
        return jsonResponse(HEALTH_BODY);
      },
    });

    await client.GET("/api/v1/health");

    expect(captured?.credentials).toBe("omit");
  });

  it("preserves a custom base URL", async () => {
    let capturedUrl = "";
    const client = createAtlasApiClient({
      baseUrl: "https://api.example.test",
      fetch: async (input) => {
        capturedUrl = input instanceof Request ? input.url : String(input);
        return jsonResponse(HEALTH_BODY);
      },
    });

    await client.GET("/api/v1/health");

    expect(capturedUrl).toBe("https://api.example.test/api/v1/health");
  });
});

describe("query-key factories", () => {
  it("keeps the existing health key", () => {
    expect(getHealthQueryKey()).toEqual(["api", "health"]);
  });

  it("produces stable auth, client, and project keys that include filters and ids", () => {
    expect(getAuthContextQueryKey()).toEqual(["api", "auth", "context"]);

    expect(getClientsListQueryKey()).toEqual(["api", "clients", "list", {}]);
    expect(getClientsListQueryKey({ status: "active", limit: 10 })).toEqual([
      "api",
      "clients",
      "list",
      { status: "active", limit: 10 },
    ]);
    expect(getClientQueryKey("client-1")).toEqual(["api", "clients", "detail", "client-1"]);

    expect(getProjectsListQueryKey({ type: "client" })).toEqual([
      "api",
      "projects",
      "list",
      { type: "client" },
    ]);
    expect(getProjectQueryKey("project-1")).toEqual(["api", "projects", "detail", "project-1"]);
    expect(getProjectDashboardQueryKey("project-1")).toEqual([
      "api",
      "projects",
      "detail",
      "project-1",
      "dashboard",
    ]);
    expect(getProjectMembershipsQueryKey("project-1", { role: "Developer" })).toEqual([
      "api",
      "projects",
      "detail",
      "project-1",
      "memberships",
      { role: "Developer" },
    ]);
    expect(getProjectAuditEventsQueryKey("project-1", { entityType: "project" })).toEqual([
      "api",
      "projects",
      "detail",
      "project-1",
      "audit-events",
      { entityType: "project" },
    ]);

    expect(getOrganizationUsersListQueryKey()).toEqual([
      "api",
      "organizations",
      "current",
      "users",
      "list",
      {},
    ]);
    expect(getOrganizationUsersListQueryKey({ search: "grace", status: "active" })).toEqual([
      "api",
      "organizations",
      "current",
      "users",
      "list",
      { search: "grace", status: "active" },
    ]);
  });
});
