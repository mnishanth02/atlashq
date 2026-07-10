import { betterAuthBasePath, betterAuthExpressWildcardPath } from "@atlashq/auth";
import { type INestApplication, RequestMethod } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { createOpenApiDocument } from "./openapi.js";
import { API_GLOBAL_PREFIX, applyGlobalApiPrefix, SWAGGER_UI_PATH } from "./swagger.js";

type OpenApiSchema = {
  $ref?: string;
  type?: string;
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
  enum?: string[];
  format?: string;
  anyOf?: OpenApiSchema[];
};

type OpenApiResponse = {
  content?: {
    "application/json"?: {
      schema?: OpenApiSchema;
    };
  };
};

type OpenApiOperation = {
  operationId?: string;
  parameters?: Array<{
    in?: string;
    name?: string;
    required?: boolean;
    schema?: OpenApiSchema;
  }>;
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: OpenApiSchema;
      };
    };
  };
  responses?: Record<string, OpenApiResponse>;
};

describe("api routing helpers", () => {
  it("exposes stable prefixes", () => {
    expect(API_GLOBAL_PREFIX).toBe("api/v1");
    expect(SWAGGER_UI_PATH).toBe("api/v1/docs");
  });

  it("mounts Better Auth at an unprefixed origin-relative base path", () => {
    expect(betterAuthBasePath).toBe("/api/auth");
    expect(betterAuthExpressWildcardPath).toBe("/api/auth/*splat");
  });

  it("applies the api/v1 prefix while excluding the Better Auth mount", () => {
    const calls: Array<{ prefix: string; options: unknown }> = [];
    const app = {
      setGlobalPrefix: (prefix: string, options: unknown) => {
        calls.push({ prefix, options });
      },
    } as unknown as INestApplication;

    applyGlobalApiPrefix(app);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.prefix).toBe("api/v1");
    const options = calls[0]?.options as {
      exclude: Array<{ path: string; method: RequestMethod }>;
    };
    expect(options.exclude).toEqual([
      { path: "api/auth", method: RequestMethod.ALL },
      { path: "api/auth/{*path}", method: RequestMethod.ALL },
    ]);
  });

  it("builds a deterministic OpenAPI 3.1 document with cleaned Zod schemas", async () => {
    const [first, second] = await Promise.all([createOpenApiDocument(), createOpenApiDocument()]);

    expect(second).toEqual(first);
    expect(first.openapi).toBe("3.1.0");

    const meResponses = first.paths["/api/v1/me"]?.get?.responses as
      | Record<string, OpenApiResponse>
      | undefined;
    expect(meResponses?.["200"]?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/MeResponseDto_Output",
    );
    expect(meResponses?.["401"]?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/ApiErrorDto",
    );
    expect(meResponses?.["403"]?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/ApiErrorDto",
    );

    const organizationResponses = first.paths["/api/v1/organizations/current"]?.get?.responses as
      | Record<string, OpenApiResponse>
      | undefined;
    expect(organizationResponses?.["200"]?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/CurrentOrganizationDto_Output",
    );
    expect(organizationResponses?.["404"]?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/ApiErrorDto",
    );

    const schemas = first.components?.schemas as Record<string, OpenApiSchema> | undefined;
    expect(schemas?.ApiErrorDto?.additionalProperties).toBe(false);
    expect(schemas?.ApiErrorDto?.required).toEqual(
      expect.arrayContaining(["statusCode", "code", "message"]),
    );
    expect(schemas?.MeResponseDto_Output?.additionalProperties).toBe(false);
    expect(schemas?.MeResponseDto_Output?.properties?.session?.properties?.expiresAt?.format).toBe(
      "date-time",
    );
    expect(schemas?.CurrentOrganizationDto_Output?.properties?.role?.enum).toEqual([
      "admin",
      "member",
    ]);
  });

  it("fully documents every Module 1 operation and request shape", async () => {
    const document = await createOpenApiDocument();
    const expectations = [
      ["get", "/api/v1/me", "MeController_getCurrentUser", "200", ["401", "403", "500"], false],
      [
        "get",
        "/api/v1/organizations/current",
        "OrganizationController_getCurrentOrganization",
        "200",
        ["401", "403", "404", "500"],
        false,
      ],
      [
        "get",
        "/api/v1/organizations/current/users",
        "OrganizationUsersController_listOrganizationUsers",
        "200",
        ["400", "401", "403", "500"],
        false,
      ],
      [
        "get",
        "/api/v1/clients",
        "ClientsController_listClients",
        "200",
        ["400", "401", "403", "500"],
        false,
      ],
      [
        "post",
        "/api/v1/clients",
        "ClientsController_createClient",
        "201",
        ["400", "401", "403", "500"],
        true,
      ],
      [
        "get",
        "/api/v1/clients/{clientId}",
        "ClientsController_getClient",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "patch",
        "/api/v1/clients/{clientId}",
        "ClientsController_updateClient",
        "200",
        ["400", "401", "403", "404", "500"],
        true,
      ],
      [
        "post",
        "/api/v1/clients/{clientId}/archive",
        "ClientsController_archiveClient",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "get",
        "/api/v1/projects",
        "ProjectsController_listProjects",
        "200",
        ["400", "401", "403", "500"],
        false,
      ],
      [
        "post",
        "/api/v1/projects",
        "ProjectsController_createProject",
        "201",
        ["400", "401", "403", "500"],
        true,
      ],
      [
        "get",
        "/api/v1/projects/{projectId}",
        "ProjectsController_getProject",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "patch",
        "/api/v1/projects/{projectId}",
        "ProjectsController_updateProject",
        "200",
        ["400", "401", "403", "404", "500"],
        true,
      ],
      [
        "post",
        "/api/v1/projects/{projectId}/archive",
        "ProjectsController_archiveProject",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "post",
        "/api/v1/projects/{projectId}/restore",
        "ProjectsController_restoreProject",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "get",
        "/api/v1/projects/{projectId}/memberships",
        "ProjectsController_listMemberships",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "post",
        "/api/v1/projects/{projectId}/memberships",
        "ProjectsController_addMembership",
        "201",
        ["400", "401", "403", "404", "409", "500"],
        true,
      ],
      [
        "patch",
        "/api/v1/projects/{projectId}/memberships/{membershipId}",
        "ProjectsController_updateMembership",
        "200",
        ["400", "401", "403", "404", "500"],
        true,
      ],
      [
        "delete",
        "/api/v1/projects/{projectId}/memberships/{membershipId}",
        "ProjectsController_removeMembership",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "get",
        "/api/v1/projects/{projectId}/dashboard",
        "ProjectsController_getDashboard",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
      [
        "get",
        "/api/v1/projects/{projectId}/audit-events",
        "ProjectsController_listAuditEvents",
        "200",
        ["400", "401", "403", "404", "500"],
        false,
      ],
    ] as const;

    const operationIds = new Set<string>();
    for (const [method, path, operationId, successStatus, errorStatuses, hasBody] of expectations) {
      const operation = document.paths[path]?.[method] as OpenApiOperation | undefined;
      expect(operation, `${method.toUpperCase()} ${path}`).toBeDefined();
      expect(operation?.operationId).toBe(operationId);
      expect(operationIds.has(operationId)).toBe(false);
      operationIds.add(operationId);

      expect(
        operation?.responses?.[successStatus]?.content?.["application/json"]?.schema,
      ).toBeDefined();
      for (const status of errorStatuses) {
        expect(operation?.responses?.[status]?.content?.["application/json"]?.schema?.$ref).toBe(
          "#/components/schemas/ApiErrorDto",
        );
      }

      expect(Boolean(operation?.requestBody)).toBe(hasBody);
      if (hasBody) {
        expect(operation?.requestBody?.content?.["application/json"]?.schema?.$ref).toBeDefined();
      }

      for (const pathParam of path.matchAll(/\{([^}]+)\}/g)) {
        expect(operation?.parameters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              in: "path",
              name: pathParam[1],
              required: true,
              schema: expect.any(Object),
            }),
          ]),
        );
      }
    }

    const schemas = document.components?.schemas as Record<string, OpenApiSchema>;
    expect(schemas.MembershipCreateBodyDto?.required).toEqual(["userId", "role"]);
    expect(schemas.MembershipCreateBodyDto?.properties?.projectId).toBeUndefined();
    expect(schemas.ClientUpdateBodyDto?.properties?.email?.anyOf).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "null" })]),
    );
    expect(schemas.ProjectUpdateBodyDto?.properties?.clientId?.anyOf).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "null" })]),
    );

    const membershipList = document.paths["/api/v1/projects/{projectId}/memberships"]
      ?.get as OpenApiOperation;
    expect(
      membershipList.parameters?.filter(
        (parameter) => parameter.name === "projectId" && parameter.in === "query",
      ),
    ).toEqual([]);

    const auditList = document.paths["/api/v1/projects/{projectId}/audit-events"]
      ?.get as OpenApiOperation;
    expect(
      auditList.parameters?.filter(
        (parameter) => parameter.name === "projectId" && parameter.in === "query",
      ),
    ).toEqual([]);
  });
});
