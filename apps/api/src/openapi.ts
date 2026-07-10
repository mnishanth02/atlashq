import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module.js";
import { applyGlobalApiPrefix, buildOpenApiDocument } from "./swagger.js";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

const defaultOpenApiPath = "openapi/openapi.json";

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJson(nestedValue)]),
    );
  }

  return value;
}

function toComparableJson(value: unknown) {
  return JSON.stringify(sortJson(value as JsonValue));
}

export async function createOpenApiDocument() {
  // `AppModule.forRoot()` defaults to a null runtime, so no database connection
  // or auth secret is required to generate the contract.
  const app = await NestFactory.create(AppModule.forRoot(), { logger: false });

  try {
    applyGlobalApiPrefix(app);
    return buildOpenApiDocument(app);
  } finally {
    await app.close();
  }
}

function getOutputPath(args: readonly string[]) {
  const outputIndex = args.indexOf("--output");

  if (outputIndex >= 0) {
    const output = args[outputIndex + 1];

    if (!output) {
      throw new Error("Missing value for --output.");
    }

    return output;
  }

  const inlineOutput = args.find((arg) => arg.startsWith("--output="));
  return inlineOutput?.slice("--output=".length) || defaultOpenApiPath;
}

async function writeOpenApi(outputPath: string) {
  const document = await createOpenApiDocument();
  const resolvedOutputPath = resolve(outputPath);

  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, `${JSON.stringify(document, null, 2)}\n`);

  console.log(`Wrote OpenAPI contract to ${outputPath}.`);
}

async function checkOpenApi(outputPath: string) {
  const resolvedOutputPath = resolve(outputPath);

  if (!existsSync(resolvedOutputPath)) {
    throw new Error(`Missing generated OpenAPI contract at ${outputPath}. Run pnpm openapi first.`);
  }

  const expectedDocument = await createOpenApiDocument();
  const currentDocument = JSON.parse(readFileSync(resolvedOutputPath, "utf8"));

  if (toComparableJson(currentDocument) !== toComparableJson(expectedDocument)) {
    throw new Error(
      `OpenAPI contract drift detected in ${outputPath}. Run pnpm openapi to update it.`,
    );
  }

  console.log(`OpenAPI contract is current: ${outputPath}.`);
}

async function runOpenApiCli(args: readonly string[]) {
  const outputPath = getOutputPath(args);

  if (args.includes("--check")) {
    await checkOpenApi(outputPath);
    return;
  }

  if (args.includes("--write") || args.length === 0) {
    await writeOpenApi(outputPath);
    return;
  }

  throw new Error(`Unknown OpenAPI command arguments: ${args.join(" ")}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  void runOpenApiCli(process.argv.slice(2));
}
