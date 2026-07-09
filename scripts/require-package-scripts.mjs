import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const [scriptName, ...requiredPackages] = process.argv.slice(2);

if (!scriptName || requiredPackages.length === 0) {
  throw new Error("Usage: node scripts/require-package-scripts.mjs <script> <package-name...>");
}

function readWorkspacePackages(workspaceDir) {
  const workspaceRoot = join(repoRoot, workspaceDir);

  if (!existsSync(workspaceRoot)) {
    return [];
  }

  return readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(workspaceRoot, entry.name, "package.json"))
    .filter(existsSync)
    .map((packageJsonPath) => JSON.parse(readFileSync(packageJsonPath, "utf8")));
}

const packages = [...readWorkspacePackages("apps"), ...readWorkspacePackages("packages")];
const packageByName = new Map(packages.map((packageJson) => [packageJson.name, packageJson]));
const missing = requiredPackages.filter(
  (packageName) => !packageByName.get(packageName)?.scripts?.[scriptName],
);

if (missing.length > 0) {
  throw new Error(`Required gate script "${scriptName}" is missing from: ${missing.join(", ")}`);
}

console.log(`Required gate script "${scriptName}" found in: ${requiredPackages.join(", ")}`);
