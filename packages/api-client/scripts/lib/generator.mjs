/**
 * Bespoke OpenAPI 3.1 -> openapi-fetch type generator.
 *
 * This module contains the pure, importable generation logic so it can be unit
 * tested in isolation. The CLI (`scripts/generate.mjs`) wires it up to the file
 * system and drift checking. The emitted output mirrors the structure that
 * `openapi-fetch` + `openapi-typescript-helpers` expect: a `paths` map whose
 * methods reference an `operations` map keyed by operationId, plus an exported
 * `components.schemas` map.
 */

export const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

const SCHEMA_REF_PREFIX = "#/components/schemas/";
const PARAMETER_REF_PREFIX = "#/components/parameters/";
const REQUEST_BODY_REF_PREFIX = "#/components/requestBodies/";
const RESPONSE_REF_PREFIX = "#/components/responses/";
const PARAMETER_LOCATIONS = ["query", "header", "path", "cookie"];

function indent(value, spaces = 2) {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function objectBlock(lines) {
  if (lines.length === 0) {
    return "{}";
  }
  return `{\n${indent(lines.join("\n"))}\n}`;
}

function tsPropertyKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function tsStringLiteral(value) {
  return JSON.stringify(value);
}

function statusCodeKey(code) {
  return /^[0-9]+$/.test(code) ? code : tsPropertyKey(code);
}

function unionType(members) {
  const unique = [];
  for (const member of members) {
    if (!unique.includes(member)) {
      unique.push(member);
    }
  }
  if (unique.length === 0) {
    return "never";
  }
  return unique.join(" | ");
}

function literalType(value) {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
    case "boolean":
      return String(value);
    default:
      throw new Error(`Unsupported enum/const literal value: ${JSON.stringify(value)}`);
  }
}

function refName(ref, prefix) {
  if (typeof ref !== "string" || !ref.startsWith(prefix)) {
    return null;
  }
  return ref.slice(prefix.length);
}

function schemaRefToType(ref, ctx) {
  const name = refName(ref, SCHEMA_REF_PREFIX);
  if (name === null) {
    throw new Error(`Unsupported OpenAPI schema reference: ${ref}`);
  }
  if (!ctx.schemas.has(name)) {
    throw new Error(`Dangling OpenAPI schema reference: ${ref}`);
  }
  return `components["schemas"][${tsStringLiteral(name)}]`;
}

/**
 * Convert an OpenAPI 3.1 schema node into a TypeScript type expression.
 * `unknown` is only used for genuinely unconstrained schemas; unsupported
 * shapes throw so drift/malformed contracts fail loudly.
 */
export function schemaToType(schema, ctx) {
  if (schema === true || schema === undefined) {
    return "unknown";
  }
  if (schema === false) {
    return "never";
  }
  if (typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`Unsupported OpenAPI schema node: ${JSON.stringify(schema)}`);
  }

  if (typeof schema.$ref === "string") {
    return withNullable(schema, schemaRefToType(schema.$ref, ctx));
  }

  if ("const" in schema) {
    return withNullable(schema, literalType(schema.const));
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return withNullable(schema, unionType(schema.enum.map(literalType)));
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const members = schema.allOf.map((member) => wrapIntersectionMember(schemaToType(member, ctx)));
    return withNullable(schema, members.join(" & "));
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return withNullable(schema, unionType(schema.oneOf.map((member) => schemaToType(member, ctx))));
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return withNullable(schema, unionType(schema.anyOf.map((member) => schemaToType(member, ctx))));
  }

  if (Array.isArray(schema.type)) {
    if (schema.type.length === 0) {
      throw new Error("Unsupported OpenAPI schema: empty type array.");
    }
    const members = schema.type.map((type) => scalarOrStructuredType({ ...schema, type }, ctx));
    return withNullable(schema, unionType(members));
  }

  return withNullable(schema, scalarOrStructuredType(schema, ctx));
}

function withNullable(schema, type) {
  if (schema && schema.nullable === true) {
    return unionType([type, "null"]);
  }
  return type;
}

function wrapIntersectionMember(type) {
  return /[|&]/.test(type) ? `(${type})` : type;
}

function scalarOrStructuredType(schema, ctx) {
  switch (schema.type) {
    case "array":
      return arraySchemaToType(schema, ctx);
    case "object":
      return objectSchemaToType(schema, ctx);
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "null":
      return "null";
    case undefined:
      if (schema.properties || schema.additionalProperties !== undefined) {
        return objectSchemaToType(schema, ctx);
      }
      if (schema.items !== undefined) {
        return arraySchemaToType(schema, ctx);
      }
      return "unknown";
    default:
      throw new Error(`Unsupported OpenAPI schema type: ${JSON.stringify(schema.type)}`);
  }
}

function arraySchemaToType(schema, ctx) {
  const itemType = schema.items === undefined ? "unknown" : schemaToType(schema.items, ctx);
  return `Array<${itemType}>`;
}

function objectSchemaToType(schema, ctx) {
  const properties = schema.properties ?? {};
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const entries = Object.entries(properties);
  const additional = schema.additionalProperties;

  const lines = entries.map(([name, propertySchema]) => {
    const optional = required.has(name) ? "" : "?";
    return `${tsPropertyKey(name)}${optional}: ${schemaToType(propertySchema, ctx)};`;
  });

  if (additional !== undefined && additional !== false) {
    const additionalType = additional === true ? "unknown" : schemaToType(additional, ctx);
    lines.push(`[key: string]: ${additionalType};`);
  }

  if (lines.length === 0) {
    return "Record<string, never>";
  }

  return objectBlock(lines);
}

function resolveParameter(parameter, ctx) {
  let resolved = parameter;

  if (typeof parameter.$ref === "string") {
    const name = refName(parameter.$ref, PARAMETER_REF_PREFIX);
    if (name === null) {
      throw new Error(`Unsupported parameter reference: ${parameter.$ref}`);
    }
    const target = ctx.document.components?.parameters?.[name];
    if (!target) {
      throw new Error(`Dangling parameter reference: ${parameter.$ref}`);
    }
    resolved = target;
  }

  if (typeof resolved.name !== "string" || typeof resolved.in !== "string") {
    throw new Error(`Malformed OpenAPI parameter: ${JSON.stringify(parameter)}`);
  }
  if (!PARAMETER_LOCATIONS.includes(resolved.in)) {
    throw new Error(`Unsupported parameter location "${resolved.in}" for "${resolved.name}".`);
  }

  return {
    name: resolved.name,
    in: resolved.in,
    required: resolved.required === true,
    schema: resolved.schema ?? {},
  };
}

function resolveParameters(parameters, ctx) {
  if (parameters === undefined) {
    return [];
  }
  if (!Array.isArray(parameters)) {
    throw new Error(`Malformed OpenAPI parameters: ${JSON.stringify(parameters)}`);
  }
  return parameters.map((parameter) => resolveParameter(parameter, ctx));
}

function renderParametersObject(resolvedParameters, ctx) {
  const groups = new Map(PARAMETER_LOCATIONS.map((location) => [location, []]));
  for (const parameter of resolvedParameters) {
    groups.get(parameter.in).push(parameter);
  }

  const lines = PARAMETER_LOCATIONS.map((location) => {
    const params = groups.get(location);
    if (params.length === 0) {
      return `${location}?: never;`;
    }

    const groupRequired = params.some((parameter) => parameter.required);
    const groupOptional = groupRequired ? "" : "?";
    const propertyLines = params.map((parameter) => {
      const optional = parameter.required ? "" : "?";
      return `${tsPropertyKey(parameter.name)}${optional}: ${schemaToType(parameter.schema, ctx)};`;
    });
    return `${location}${groupOptional}: ${objectBlock(propertyLines)};`;
  });

  return objectBlock(lines);
}

function mergeOperationParameters(pathItem, operation, ctx) {
  const pathLevel = resolveParameters(pathItem.parameters, ctx);
  const operationLevel = resolveParameters(operation.parameters, ctx);
  const merged = new Map();
  for (const parameter of [...pathLevel, ...operationLevel]) {
    merged.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return [...merged.values()];
}

function resolveRequestBody(requestBody, ctx) {
  if (typeof requestBody.$ref === "string") {
    const name = refName(requestBody.$ref, REQUEST_BODY_REF_PREFIX);
    if (name === null) {
      throw new Error(`Unsupported requestBody reference: ${requestBody.$ref}`);
    }
    const target = ctx.document.components?.requestBodies?.[name];
    if (!target) {
      throw new Error(`Dangling requestBody reference: ${requestBody.$ref}`);
    }
    return target;
  }
  return requestBody;
}

function resolveResponse(response, ctx) {
  if (response && typeof response.$ref === "string") {
    const name = refName(response.$ref, RESPONSE_REF_PREFIX);
    if (name === null) {
      throw new Error(`Unsupported response reference: ${response.$ref}`);
    }
    const target = ctx.document.components?.responses?.[name];
    if (!target) {
      throw new Error(`Dangling response reference: ${response.$ref}`);
    }
    return target;
  }
  return response ?? {};
}

function renderContentBlock(content, ctx) {
  const entries = Object.entries(content ?? {});
  if (entries.length === 0) {
    return null;
  }
  const lines = entries.map(([mediaType, media]) => {
    const schema = media?.schema;
    const type = schema === undefined ? "unknown" : schemaToType(schema, ctx);
    return `${tsPropertyKey(mediaType)}: ${type};`;
  });
  return objectBlock(lines);
}

function renderRequestBody(operation, ctx) {
  if (!operation.requestBody) {
    return "requestBody?: never;";
  }

  const resolved = resolveRequestBody(operation.requestBody, ctx);
  const contentBlock = renderContentBlock(resolved.content, ctx);
  const optional = resolved.required === true ? "" : "?";
  const bodyLine = contentBlock === null ? "content?: never;" : `content: ${contentBlock};`;
  return `requestBody${optional}: ${objectBlock([bodyLine])};`;
}

function renderResponses(operation, ctx) {
  const responses = operation.responses ?? {};
  const entries = Object.entries(responses);
  if (entries.length === 0) {
    return "responses: Record<string, never>;";
  }

  const lines = entries.map(([status, response]) => {
    const resolved = resolveResponse(response, ctx);
    const contentBlock = renderContentBlock(resolved.content, ctx);
    const headerLine = `headers: ${objectBlock(["[name: string]: unknown;"])};`;
    const contentLine = contentBlock === null ? "content?: never;" : `content: ${contentBlock};`;
    return `${statusCodeKey(status)}: ${objectBlock([headerLine, contentLine])};`;
  });

  return `responses: ${objectBlock(lines)};`;
}

function renderOperationType(entry, ctx) {
  const parametersBlock = renderParametersObject(
    mergeOperationParameters(entry.pathItem, entry.operation, ctx),
    ctx,
  );
  const lines = [
    `parameters: ${parametersBlock};`,
    renderRequestBody(entry.operation, ctx),
    renderResponses(entry.operation, ctx),
  ];
  return objectBlock(lines);
}

/**
 * Walk every path/method, requiring a unique operationId on each operation.
 * Missing or duplicate operationIds throw so malformed contracts are rejected.
 */
export function collectOperations(document) {
  const paths = document.paths ?? {};
  const operations = [];
  const seen = new Map();

  for (const [pathName, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      throw new Error(`Malformed path item for ${pathName}.`);
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }

      const operationId = operation.operationId;
      if (typeof operationId !== "string" || operationId.length === 0) {
        throw new Error(`Missing operationId for ${method.toUpperCase()} ${pathName}.`);
      }
      if (seen.has(operationId)) {
        throw new Error(
          `Duplicate operationId "${operationId}" for ${method.toUpperCase()} ${pathName} (already used by ${seen.get(operationId)}).`,
        );
      }

      seen.set(operationId, `${method.toUpperCase()} ${pathName}`);
      operations.push({ pathName, method, pathItem, operation, operationId });
    }
  }

  return operations;
}

function renderPaths(document, ctx) {
  const paths = document.paths ?? {};
  const entries = Object.entries(paths);
  if (entries.length === 0) {
    return "export type paths = Record<string, never>;";
  }

  const pathBlocks = entries.map(([pathName, pathItem]) => {
    const pathLevelParameters = renderParametersObject(
      resolveParameters(pathItem.parameters, ctx),
      ctx,
    );
    const methodLines = HTTP_METHODS.map((method) => {
      const operation = pathItem[method];
      if (!operation) {
        return `${method}?: never;`;
      }
      return `${method}: operations[${tsStringLiteral(operation.operationId)}];`;
    });
    const lines = [`parameters: ${pathLevelParameters};`, ...methodLines];
    return `${tsPropertyKey(pathName)}: ${objectBlock(lines)};`;
  });

  return `export interface paths ${objectBlock(pathBlocks)}`;
}

function renderComponents(document, ctx) {
  const schemas = document.components?.schemas ?? {};
  const entries = Object.entries(schemas);
  const schemasBlock =
    entries.length === 0
      ? "schemas: Record<string, never>;"
      : `schemas: ${objectBlock(
          entries.map(([name, schema]) => `${tsPropertyKey(name)}: ${schemaToType(schema, ctx)};`),
        )};`;

  const lines = [
    schemasBlock,
    "responses: never;",
    "parameters: never;",
    "requestBodies: never;",
    "headers: never;",
    "pathItems: never;",
  ];

  return `export interface components ${objectBlock(lines)}`;
}

function renderOperations(operations, ctx) {
  if (operations.length === 0) {
    return "export type operations = Record<string, never>;";
  }

  const blocks = operations.map(
    (entry) => `${tsPropertyKey(entry.operationId)}: ${renderOperationType(entry, ctx)};`,
  );
  return `export interface operations ${objectBlock(blocks)}`;
}

/**
 * Produce the full generated module string for an OpenAPI 3.1 document.
 * Output is deterministic (document ordering is preserved throughout).
 */
export function generateClient(document) {
  if (!document || typeof document !== "object") {
    throw new Error("Expected an OpenAPI document object.");
  }

  const ctx = {
    document,
    schemas: new Set(Object.keys(document.components?.schemas ?? {})),
  };
  const operations = collectOperations(document);

  return [
    "/* Generated from apps/api/openapi/openapi.json. Do not edit by hand. */",
    "",
    renderPaths(document, ctx),
    "",
    "export type webhooks = Record<string, never>;",
    "",
    renderComponents(document, ctx),
    "",
    "export type $defs = Record<string, never>;",
    "",
    renderOperations(operations, ctx),
    "",
  ].join("\n");
}
