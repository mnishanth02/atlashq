import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const composePath = join(repoRoot, "docker-compose.yml");
const caddyPath = join(repoRoot, "infra", "caddy", "Caddyfile");

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

const docker = spawnSync(
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
    "-f",
    composePath,
    "config",
    "--quiet",
  ],
  { cwd: repoRoot, stdio: "inherit" },
);

if (docker.error?.code === "ENOENT") {
  console.warn("Docker Compose CLI is not installed; completed static compose checks only.");
  process.exit(0);
}

if (docker.error) {
  throw docker.error;
}

process.exit(docker.status ?? 1);
