import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateClient } from "./lib/generator.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const openApiPath = resolve(repoRoot, "apps", "api", "openapi", "openapi.json");
const generatedClientPath = resolve(packageRoot, "src", "generated", "openapi.ts");

function readOpenApiDocument() {
  if (!existsSync(openApiPath)) {
    throw new Error(`Missing OpenAPI artifact at ${openApiPath}. Run pnpm openapi:check first.`);
  }

  const document = JSON.parse(readFileSync(openApiPath, "utf8"));

  if (document.openapi !== "3.1.0") {
    throw new Error("Expected OpenAPI 3.1.0 document.");
  }

  if (!document.paths?.["/api/v1/health"]) {
    throw new Error("Expected /api/v1/health path in OpenAPI document.");
  }

  return document;
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
const expectedClient = generateClient(readOpenApiDocument());

if (args.includes("--check")) {
  checkGeneratedClient(expectedClient);
} else if (args.includes("--write") || args.length === 0) {
  writeGeneratedClient(expectedClient);
} else {
  throw new Error(`Unknown API client generator arguments: ${args.join(" ")}`);
}
