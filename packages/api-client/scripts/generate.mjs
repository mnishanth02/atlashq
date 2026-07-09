import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const openApiPath = resolve(repoRoot, "apps", "api", "openapi", "openapi.json");
const generatedClientPath = resolve(packageRoot, "src", "generated", "openapi.ts");
const httpMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

function readOpenApiDocument() {
  if (!existsSync(openApiPath)) {
    throw new Error(`Missing OpenAPI artifact at ${openApiPath}. Run pnpm openapi:check first.`);
  }

  const document = JSON.parse(readFileSync(openApiPath, "utf8"));

  if (document.openapi !== "3.1.0") {
    throw new Error("Expected OpenAPI 3.1.0 document.");
  }

  return document;
}

function tsPropertyKey(key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function tsStringLiteral(value) {
  return JSON.stringify(value);
}

function indent(value, spaces = 2) {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function schemaReferenceName(ref) {
  const prefix = "#/components/schemas/";

  if (!ref.startsWith(prefix)) {
    throw new Error(`Unsupported OpenAPI schema reference: ${ref}`);
  }

  return ref.slice(prefix.length);
}

function schemaToType(schema, document) {
  if (!schema || typeof schema !== "object") {
    return "unknown";
  }

  if (schema.$ref) {
    return `components["schemas"][${tsStringLiteral(schemaReferenceName(schema.$ref))}]`;
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((value) => tsStringLiteral(value)).join(" | ");
  }

  if (schema.oneOf || schema.anyOf) {
    return (schema.oneOf ?? schema.anyOf).map((item) => schemaToType(item, document)).join(" | ");
  }

  if (schema.allOf) {
    return schema.allOf.map((item) => schemaToType(item, document)).join(" & ");
  }

  if (schema.type === "array") {
    return `Array<${schemaToType(schema.items, document)}>`;
  }

  if (schema.type === "object" || schema.properties) {
    return objectSchemaToType(schema, document);
  }

  if (schema.type === "integer" || schema.type === "number") {
    return "number";
  }

  if (schema.type === "boolean") {
    return "boolean";
  }

  if (schema.type === "string") {
    return "string";
  }

  if (Array.isArray(schema.type)) {
    return schema.type
      .map((schemaType) => schemaToType({ ...schema, type: schemaType }, document))
      .join(" | ");
  }

  return "unknown";
}

function objectSchemaToType(schema, document) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const propertyEntries = Object.entries(properties);

  if (propertyEntries.length === 0) {
    if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      return `Record<string, ${schemaToType(schema.additionalProperties, document)}>`;
    }

    return schema.additionalProperties ? "Record<string, unknown>" : "Record<string, never>";
  }

  const lines = propertyEntries.map(([propertyName, propertySchema]) => {
    const optional = required.has(propertyName) ? "" : "?";
    return `${tsPropertyKey(propertyName)}${optional}: ${schemaToType(propertySchema, document)};`;
  });

  if (schema.additionalProperties) {
    const additionalType =
      typeof schema.additionalProperties === "object"
        ? schemaToType(schema.additionalProperties, document)
        : "unknown";
    lines.push(`[key: string]: ${additionalType};`);
  }

  return `{\n${indent(lines.join("\n"))}\n}`;
}

function getJsonContentSchema(response) {
  return response?.content?.["application/json"]?.schema;
}

function generateResponses(operation, document) {
  const responses = operation.responses ?? {};
  const responseEntries = Object.entries(responses);

  if (responseEntries.length === 0) {
    return "responses: Record<string, never>;";
  }

  const responseLines = responseEntries.map(([statusCode, response]) => {
    const schema = getJsonContentSchema(response);
    const contentType = schema
      ? `content: {\n${indent(
          `${tsPropertyKey("application/json")}: ${schemaToType(schema, document)};`,
        )}\n};`
      : "content: Record<string, never>;";

    return `${tsPropertyKey(statusCode)}: {\n${indent(contentType)}\n};`;
  });

  return `responses: {\n${indent(responseLines.join("\n"))}\n};`;
}

function generateOperation(operation, document) {
  return `{\n${indent(generateResponses(operation, document))}\n}`;
}

function generatePaths(document) {
  const paths = document.paths ?? {};
  const pathEntries = Object.entries(paths);

  if (pathEntries.length === 0) {
    return "export type paths = Record<string, never>;";
  }

  const pathLines = pathEntries.map(([pathName, pathItem]) => {
    const operationLines = httpMethods
      .filter((method) => pathItem?.[method])
      .map((method) => `${method}: ${generateOperation(pathItem[method], document)};`);

    return `${tsPropertyKey(pathName)}: {\n${indent(operationLines.join("\n"))}\n};`;
  });

  return `export type paths = {\n${indent(pathLines.join("\n"))}\n};`;
}

function generateComponents(document) {
  const schemas = document.components?.schemas ?? {};
  const schemaEntries = Object.entries(schemas);

  if (schemaEntries.length === 0) {
    return "export type components = {\n  schemas: Record<string, never>;\n};";
  }

  const schemaLines = schemaEntries.map(
    ([schemaName, schema]) => `${tsPropertyKey(schemaName)}: ${schemaToType(schema, document)};`,
  );

  return `export type components = {\n  schemas: {\n${indent(schemaLines.join("\n"), 4)}\n  };\n};`;
}

function generateClientTypes(document) {
  if (!document.paths?.["/api/v1/health"]) {
    throw new Error("Expected /api/v1/health path in OpenAPI document.");
  }

  return [
    "/* Generated from apps/api/openapi/openapi.json. Do not edit by hand. */",
    "",
    generatePaths(document),
    "",
    generateComponents(document),
    "",
  ].join("\n");
}

function checkGeneratedClient(expected) {
  if (!existsSync(generatedClientPath)) {
    throw new Error(
      `Missing generated API client types at ${generatedClientPath}. Run pnpm --filter @atlashq/api-client api-client:generate.`,
    );
  }

  const current = readFileSync(generatedClientPath, "utf8").replace(/\r\n/g, "\n");

  if (current !== expected) {
    throw new Error(
      "Generated API client drift detected. Run pnpm --filter @atlashq/api-client api-client:generate.",
    );
  }

  console.log("Generated API client types are current.");
}

function writeGeneratedClient(content) {
  mkdirSync(dirname(generatedClientPath), { recursive: true });
  writeFileSync(generatedClientPath, content);
  console.log(`Wrote generated API client types to ${generatedClientPath}.`);
}

const args = process.argv.slice(2);
const expectedClient = generateClientTypes(readOpenApiDocument());

if (args.includes("--check")) {
  checkGeneratedClient(expectedClient);
} else if (args.includes("--write") || args.length === 0) {
  writeGeneratedClient(expectedClient);
} else {
  throw new Error(`Unknown API client generator arguments: ${args.join(" ")}`);
}
