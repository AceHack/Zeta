/**
 * Builds the standalone Identity DLA client into the root GitHub Pages artifact.
 * This is intentionally TypeScript rather than a shell wrapper: the page path,
 * package manager version, output directory, and failure boundary are explicit.
 *
 * WHY pnpm is fetched here instead of installed at the repo root:
 * `demo/identity-dla-site` is a separate project living inside a bun repo — it has
 * its own `pnpm-lock.yaml` and its own `packageManager` pin, while the root declares
 * `bun`. Carrying `pnpm` in ROOT devDependencies made every `bun install` call site in
 * CI fetch and extract a tarball that exactly one consumer uses, and that extraction
 * flaked four times across unrelated jobs on 2026-08-13
 * (`error: Fail extracting tarball for "pnpm"`). So the cost sits with the consumer:
 * this builder provisions pnpm on demand, at the version the site itself declares.
 * See workitem 081KZYAGTB6087G0R002W8CWQK.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writePagesArtifactEvidence } from "./identity-dla-pages-artifact";
import { buildGoWasmOracle } from "./identity-dla-pages-go-build";
import { stagePagesWasmAssets } from "./identity-dla-pages-wasm-assets";

const repoRoot = process.cwd();
const siteRoot = join(repoRoot, "demo", "identity-dla-site");
const builtSite = join(siteRoot, "dist", "pages");
const artifactTarget = join(repoRoot, "dist", "demo", "identity-dla-site");

function run(command: string, args: readonly string[], cwd: string): void {
  const result = Bun.spawnSync([command, ...args], { cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0)
    throw new Error(`teaching error: ${command} ${args.join(" ")} failed with exit ${String(result.exitCode)}`);
}

/**
 * The site's own `packageManager` field is the SINGLE source of truth for which pnpm
 * builds it. Reading it here means there is no second pin anywhere to drift against —
 * the previous root devDependency (`pnpm@10.15.1`) had already drifted from the version
 * the site declares and locks against (`pnpm@10.4.1`).
 */
function declaredPnpmVersion(): string {
  const manifestPath = join(siteRoot, "package.json");
  if (!existsSync(manifestPath)) throw new Error(`teaching error: site manifest is missing at ${manifestPath}`);
  const declared: unknown = (JSON.parse(readFileSync(manifestPath, "utf8")) as { packageManager?: unknown })
    .packageManager;
  // Accepts "pnpm@<exact version>" with the optional "+sha512..." integrity suffix that
  // corepack-style pins carry. An exact version is required: a range would make the build
  // non-reproducible, which is the drift this change exists to remove.
  const match = typeof declared === "string" ? /^pnpm@(\d+\.\d+\.\d+)(?:\+|$)/.exec(declared) : null;
  const version = match === null ? undefined : match[1];
  if (version === undefined) {
    throw new Error(
      `teaching error: ${manifestPath} must declare "packageManager": "pnpm@<exact.version>"; found ${JSON.stringify(declared)}`,
    );
  }
  return version;
}

/**
 * Escape hatch for an environment that pre-provisions pnpm (an air-gapped runner, or a
 * future CI step that restores a cached binary). The caller owns the version match —
 * we do not silently accept whatever `pnpm` happens to be on PATH, because that would
 * reintroduce exactly the version drift this change removes.
 */
const preProvisioned = process.env.ZETA_PNPM_BIN;
const pnpmVersion = declaredPnpmVersion();

function pnpm(...args: readonly string[]): void {
  if (preProvisioned !== undefined && preProvisioned !== "") {
    if (!existsSync(preProvisioned)) {
      throw new Error(`teaching error: ZETA_PNPM_BIN points at ${preProvisioned}, which does not exist`);
    }
    run(preProvisioned, args, siteRoot);
    return;
  }
  // `process.execPath` is the bun binary already running this script, so this needs
  // nothing on PATH and behaves identically on a dev laptop, in the devcontainer, and
  // on a CI runner — one code path, three environments (GOVERNANCE.md §24).
  run(process.execPath, ["x", `pnpm@${pnpmVersion}`, ...args], siteRoot);
}

// Oracle 10's seventh substrate is compiled here rather than committed (~1.9 MB). It runs
// BEFORE the Vite build so the staging step below has something to stage. `ZETA_PAGES_REQUIRE_GO`
// is set by `pages-deploy.yml`, where an `actions/setup-go` step guarantees the toolchain:
// there, a missing `go` is a hard failure rather than a quietly smaller artifact.
const goBuild = buildGoWasmOracle(repoRoot, (process.env.ZETA_PAGES_REQUIRE_GO ?? "") !== "");
console.log(
  goBuild.kind === "built"
    ? `[pages] Go WASM oracle built: ${goBuild.module} (${String(goBuild.moduleBytes)} bytes) + bridge from ${goBuild.goRoot}`
    : `[pages] Go WASM oracle SKIPPED: ${goBuild.reason}`,
);

console.log(`[pages] identity-dla-site: using pnpm@${pnpmVersion} (declared by the site manifest)`);
pnpm("install", "--frozen-lockfile");
pnpm("check");
pnpm("exec", "vite", "build", "--config", "vite.config.pages.ts");

if (!existsSync(builtSite)) throw new Error("teaching error: Race Mode Vite build produced no Pages artifact");
rmSync(artifactTarget, { recursive: true, force: true });
mkdirSync(artifactTarget, { recursive: true });
cpSync(builtSite, artifactTarget, { recursive: true });
const staging = stagePagesWasmAssets(repoRoot, artifactTarget);
for (const missing of staging.absent) console.log(`[pages] WASM asset NOT published — ${missing}`);
const revision = new TextDecoder().decode(Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repoRoot }).stdout).trim();
if (!/^[0-9a-f]{40}$/i.test(revision)) throw new Error("teaching error: Pages build could not bind its artifact evidence to an immutable Git revision");
const evidence = writePagesArtifactEvidence(artifactTarget, revision);
console.log(`[pages] Race Mode artifact ready: ${artifactTarget} (${evidence.entryAsset}; ${evidence.wasmAssets.length} WASM assets verified; Go oracle ${evidence.goOracle})`);
