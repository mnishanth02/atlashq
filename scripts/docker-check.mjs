import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const composePath = join(repoRoot, "docker-compose.yml");
const devComposePath = join(repoRoot, "docker-compose.dev.yml");
const caddyPath = join(repoRoot, "infra", "caddy", "Caddyfile");
const devCaddyPath = join(repoRoot, "infra", "caddy", "Caddyfile.dev");

const requiredComposeSnippets = [
  "caddy:",
  "api:",
  "web:",
  "worker:",
  "postgres:",
  "redis:",
  "minio:",
  "clamav:",
  'profiles: ["core"]',
  'profiles: ["storage"]',
  'profiles: ["scan"]',
  'profiles: ["worker", "ai"]',
  "healthcheck:",
];

const requiredCaddySnippets = [
  "root * /srv/atlashq/web",
  "path /api/v1 /api/v1/*",
  "path /api/auth /api/auth/*",
  "path /health",
  "rewrite * /api/v1/health",
];

const requiredDevComposeSnippets = [
  'profiles: ["core", "worker", "storage", "ai"]',
  "atlas-nm-web:/workspace/apps/web/node_modules",
  "atlas-nm-api-client:/workspace/packages/api-client/node_modules",
  "atlas-nm-validators:/workspace/packages/validators/node_modules",
  'CHOKIDAR_USEPOLLING: "true"',
  "Caddyfile.dev:/etc/caddy/Caddyfile.dev:ro",
];

const requiredDevCaddySnippets = [
  "reverse_proxy web:4187",
  "path /api/v1 /api/v1/*",
  "path /api/auth /api/auth/*",
  "path /health",
  "rewrite * /api/v1/health",
];

function assertFileContains(path, snippets) {
  if (!existsSync(path)) {
    throw new Error(`Missing required infrastructure file: ${path}`);
  }

  const content = readFileSync(path, "utf8");
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      throw new Error(`${path} is missing required snippet: ${snippet}`);
    }
  }
}

assertFileContains(composePath, requiredComposeSnippets);
assertFileContains(caddyPath, requiredCaddySnippets);
assertFileContains(devComposePath, requiredDevComposeSnippets);
assertFileContains(devCaddyPath, requiredDevCaddySnippets);

function runComposeConfig(composeFiles) {
  return spawnSync(
    "docker",
    [
      "compose",
      "--profile",
      "core",
      "--profile",
      "storage",
      "--profile",
      "scan",
      "--profile",
      "worker",
      "--profile",
      "ai",
      ...composeFiles.flatMap((composeFile) => ["-f", composeFile]),
      "config",
      "--quiet",
    ],
    { cwd: repoRoot, stdio: "inherit" },
  );
}

const baseCompose = runComposeConfig([composePath]);

if (baseCompose.error?.code === "ENOENT") {
  console.warn("Docker Compose CLI is not installed; completed static compose checks only.");
  process.exit(0);
}

if (baseCompose.error) {
  throw baseCompose.error;
}

if (baseCompose.status !== 0) {
  process.exit(baseCompose.status ?? 1);
}

const devCompose = runComposeConfig([composePath, devComposePath]);

if (devCompose.error) {
  throw devCompose.error;
}

process.exit(devCompose.status ?? 1);
