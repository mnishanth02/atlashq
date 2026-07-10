import { describe, expect, it } from "vitest";
import { collectOperations, generateClient, schemaToType } from "./generator.mjs";

const schemaCtx = { document: { components: { schemas: {} } }, schemas: new Set() };

function refCtx(names) {
  return {
    document: { components: { schemas: Object.fromEntries(names.map((name) => [name, {}])) } },
    schemas: new Set(names),
  };
}

/**
 * Minimal but representative OpenAPI 3.1 fixture exercising the shapes the
 * generator must support: required path params, optional/coerced query params,
 * required create bodies, nullable update fields, typed 2xx + 4xx responses,
 * operationId mapping, and no-body operations.
 */
function baseDocument() {
  return {
    openapi: "3.1.0",
    paths: {
      "/api/v1/widgets": {
        get: {
          operationId: "WidgetsController_list",
          parameters: [
            { name: "cursor", in: "query", required: false, schema: { type: "string" } },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 25 },
            },
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["active", "archived"] },
            },
          ],
          responses: {
            200: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WidgetListResponseDto" },
                },
              },
            },
            400: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ApiErrorDto" } },
              },
            },
          },
        },
        post: {
          operationId: "WidgetsController_create",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/WidgetCreateBodyDto" } },
            },
          },
          responses: {
            201: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/WidgetResponseDto" } },
              },
            },
            400: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ApiErrorDto" } },
              },
            },
          },
        },
      },
      "/api/v1/widgets/{widgetId}": {
        get: {
          operationId: "WidgetsController_get",
          parameters: [
            { name: "widgetId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/WidgetResponseDto" } },
              },
            },
            404: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ApiErrorDto" } },
              },
            },
          },
        },
        patch: {
          operationId: "WidgetsController_update",
          parameters: [
            { name: "widgetId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/WidgetUpdateBodyDto" } },
            },
          },
          responses: {
            200: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/WidgetResponseDto" } },
              },
            },
          },
        },
      },
      "/api/v1/widgets/{widgetId}/archive": {
        post: {
          operationId: "WidgetsController_archive",
          parameters: [
            { name: "widgetId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            204: { description: "No Content" },
          },
        },
      },
    },
    components: {
      schemas: {
        ApiErrorDto: {
          type: "object",
          properties: { code: { type: "string" }, message: { type: "string" } },
          required: ["code", "message"],
          additionalProperties: false,
        },
        WidgetResponseDto: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            notes: { anyOf: [{ type: "string" }, { type: "null" }] },
            version: { type: "integer" },
          },
          required: ["id", "name", "notes", "version"],
          additionalProperties: false,
        },
        WidgetListResponseDto: {
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/WidgetResponseDto" } },
          },
          required: ["items"],
          additionalProperties: false,
        },
        WidgetCreateBodyDto: {
          type: "object",
          properties: { name: { type: "string" }, notes: { type: "string" } },
          required: ["name"],
          additionalProperties: false,
        },
        WidgetUpdateBodyDto: {
          type: "object",
          properties: {
            name: { type: "string" },
            notes: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          additionalProperties: false,
        },
      },
    },
  };
}

describe("schemaToType", () => {
  it("resolves schema references", () => {
    expect(
      schemaToType(
        { $ref: "#/components/schemas/WidgetResponseDto" },
        refCtx(["WidgetResponseDto"]),
      ),
    ).toBe('components["schemas"]["WidgetResponseDto"]');
  });

  it("throws on malformed and dangling references", () => {
    expect(() => schemaToType({ $ref: "#/definitions/Foo" }, schemaCtx)).toThrow(/Unsupported/);
    expect(() => schemaToType({ $ref: "#/components/schemas/Missing" }, schemaCtx)).toThrow(
      /Dangling/,
    );
  });

  it("maps scalars, integers, and booleans", () => {
    expect(schemaToType({ type: "string" }, schemaCtx)).toBe("string");
    expect(schemaToType({ type: "integer" }, schemaCtx)).toBe("number");
    expect(schemaToType({ type: "number" }, schemaCtx)).toBe("number");
    expect(schemaToType({ type: "boolean" }, schemaCtx)).toBe("boolean");
    expect(schemaToType({ type: "null" }, schemaCtx)).toBe("null");
  });

  it("emits enum and const literal unions", () => {
    expect(schemaToType({ type: "string", enum: ["a", "b"] }, schemaCtx)).toBe('"a" | "b"');
    expect(schemaToType({ const: "fixed" }, schemaCtx)).toBe('"fixed"');
    expect(schemaToType({ enum: [1, 2, true] }, schemaCtx)).toBe("1 | 2 | true");
  });

  it("treats anyOf with a null branch as nullable", () => {
    expect(schemaToType({ anyOf: [{ type: "string" }, { type: "null" }] }, schemaCtx)).toBe(
      "string | null",
    );
  });

  it("handles oneOf unions and allOf intersections", () => {
    expect(schemaToType({ oneOf: [{ type: "string" }, { type: "number" }] }, schemaCtx)).toBe(
      "string | number",
    );
    expect(
      schemaToType(
        {
          allOf: [
            { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
            { type: "object", properties: { b: { type: "number" } }, required: ["b"] },
          ],
        },
        schemaCtx,
      ),
    ).toBe("{\n  a: string;\n} & {\n  b: number;\n}");
  });

  it("supports type arrays as unions", () => {
    expect(schemaToType({ type: ["string", "null"] }, schemaCtx)).toBe("string | null");
  });

  it("emits arrays with unknown items when unconstrained", () => {
    expect(schemaToType({ type: "array", items: {} }, schemaCtx)).toBe("Array<unknown>");
    expect(schemaToType({ type: "array", items: { type: "string" } }, schemaCtx)).toBe(
      "Array<string>",
    );
  });

  it("respects required vs optional object properties", () => {
    expect(
      schemaToType(
        {
          type: "object",
          properties: { a: { type: "string" }, b: { type: "number" } },
          required: ["a"],
          additionalProperties: false,
        },
        schemaCtx,
      ),
    ).toBe("{\n  a: string;\n  b?: number;\n}");
  });

  it("maps additionalProperties objects to index signatures", () => {
    expect(
      schemaToType({ type: "object", additionalProperties: { type: "string" } }, schemaCtx),
    ).toBe("{\n  [key: string]: string;\n}");
    expect(schemaToType({ type: "object", additionalProperties: true }, schemaCtx)).toBe(
      "{\n  [key: string]: unknown;\n}",
    );
    expect(schemaToType({ type: "object" }, schemaCtx)).toBe("Record<string, never>");
  });

  it("applies OpenAPI 3.0 nullable flags", () => {
    expect(schemaToType({ type: "string", nullable: true }, schemaCtx)).toBe("string | null");
  });

  it("uses unknown only for genuinely unconstrained schemas", () => {
    expect(schemaToType({}, schemaCtx)).toBe("unknown");
    expect(schemaToType(true, schemaCtx)).toBe("unknown");
    expect(schemaToType(false, schemaCtx)).toBe("never");
  });

  it("throws on unsupported schema types", () => {
    expect(() => schemaToType({ type: "widget" }, schemaCtx)).toThrow(
      /Unsupported OpenAPI schema type/,
    );
  });
});

describe("collectOperations", () => {
  it("maps every path/method to its operationId", () => {
    const operations = collectOperations(baseDocument());
    expect(operations.map((entry) => entry.operationId)).toEqual([
      "WidgetsController_list",
      "WidgetsController_create",
      "WidgetsController_get",
      "WidgetsController_update",
      "WidgetsController_archive",
    ]);
  });

  it("rejects operations without an operationId", () => {
    const document = baseDocument();
    delete document.paths["/api/v1/widgets"].get.operationId;
    expect(() => collectOperations(document)).toThrow(
      /Missing operationId for GET \/api\/v1\/widgets/,
    );
  });

  it("rejects duplicate operationIds", () => {
    const document = baseDocument();
    document.paths["/api/v1/widgets"].post.operationId = "WidgetsController_list";
    expect(() => collectOperations(document)).toThrow(
      /Duplicate operationId "WidgetsController_list"/,
    );
  });
});

describe("generateClient", () => {
  const output = generateClient(baseDocument());

  it("references operations by operationId from the paths map", () => {
    expect(output).toContain('get: operations["WidgetsController_list"];');
    expect(output).toContain('post: operations["WidgetsController_create"];');
    expect(output).toContain('patch: operations["WidgetsController_update"];');
  });

  it("emits a required path parameter as a non-optional path group", () => {
    expect(output).toContain("path: {\n        widgetId: string;\n      };");
  });

  it("emits optional/coerced query parameters", () => {
    expect(output).toContain(
      [
        "query?: {",
        "        cursor?: string;",
        "        limit?: number;",
        '        status?: "active" | "archived";',
        "      };",
      ].join("\n"),
    );
  });

  it("emits a required create body and no-body operations", () => {
    expect(output).toContain(
      'requestBody: {\n      content: {\n        "application/json": components["schemas"]["WidgetCreateBodyDto"];',
    );
    expect(output).toContain("requestBody?: never;");
  });

  it("emits nullable update fields", () => {
    expect(output).toContain("notes?: string | null;");
  });

  it("emits typed 2xx and 4xx responses with numeric status keys", () => {
    expect(output).toContain(
      '200: {\n        headers: {\n          [name: string]: unknown;\n        };\n        content: {\n          "application/json": components["schemas"]["WidgetListResponseDto"];',
    );
    expect(output).toContain(
      '400: {\n        headers: {\n          [name: string]: unknown;\n        };\n        content: {\n          "application/json": components["schemas"]["ApiErrorDto"];',
    );
  });

  it("emits no-content responses without a JSON body", () => {
    expect(output).toContain(
      "204: {\n        headers: {\n          [name: string]: unknown;\n        };\n        content?: never;",
    );
  });

  it("exports paths, operations, and components", () => {
    expect(output).toContain("export interface paths {");
    expect(output).toContain("export interface operations {");
    expect(output).toContain("export interface components {");
    expect(output).toContain("export type webhooks = Record<string, never>;");
    expect(output).toContain("export type $defs = Record<string, never>;");
  });

  it("is deterministic", () => {
    expect(generateClient(baseDocument())).toBe(output);
  });
});
