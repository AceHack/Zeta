/**
 * Builds the standalone Identity DLA client into the root GitHub Pages artifact.
 * This is intentionally TypeScript rather than a shell wrapper: the page path,
 * package manager version, output directory, and failure boundary are explicit.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const siteRoot = join(repoRoot, "demo", "identity-dla-site");
const builtSite = join(siteRoot, "dist", "pages");
const artifactTarget = join(repoRoot, "dist", "demo", "identity-dla-site");
const pnpm = join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "pnpm.cmd" : "pnpm");

function run(command: string, args: readonly string[], cwd: string): void {
  const result = Bun.spawnSync([command, ...args], { cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`teaching error: ${command} ${args.join(" ")} failed with exit ${result.exitCode}`);
}

if (!existsSync(pnpm)) {
  throw new Error("teaching error: declared pnpm tool is missing; run the root frozen dependency installation before Pages build");
}

run(pnpm, ["install", "--frozen-lockfile"], siteRoot);
run(pnpm, ["check"], siteRoot);
run(pnpm, ["exec", "vite", "build", "--config", "vite.config.pages.ts"], siteRoot);

if (!existsSync(builtSite)) throw new Error("teaching error: Race Mode Vite build produced no Pages artifact");
rmSync(artifactTarget, { recursive: true, force: true });
mkdirSync(artifactTarget, { recursive: true });
cpSync(builtSite, artifactTarget, { recursive: true });
console.log(`[pages] Race Mode artifact ready: ${artifactTarget}`);
