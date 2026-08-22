#!/usr/bin/env bun
/**
 * infra/k8s/tests/validate-bootstrap.ts
 *
 * K3S FIRST-BOOT manifest validation for the `infra/` cluster substrate.
 *
 * Usage:
 *   bun infra/k8s/tests/validate-bootstrap.ts                  # validate infra/
 *   bun infra/k8s/tests/validate-bootstrap.ts --infra-dir DIR  # point at a copy
 *
 * Exit codes: 0 = all checks passed, 1 = one or more failed, 2 = usage error.
 *
 * ── WHY THIS FILE EXISTS (2026-08-18) ──────────────────────────────────────
 * `infra/k8s/bootstrap/` is the four-file set K3S auto-applies on a NixOS
 * control-plane's very first boot, declared in `services.k3s.manifests` in
 * infra/nixos/modules/k3s-server.nix. It is the entire distance between "the
 * machine powered on" and "ArgoCD is reconciling the cluster from git" —
 * steps 2-6 of the bootstrap order in infra/README.md.
 *
 * Nothing validated it. `helm-validate.yml` TRIGGERS on `infra/k8s/**`, so a
 * bootstrap change ran a lane — but that lane's validator only ever scanned
 * `infra/k8s/applications`, so the manifests that changed were never looked
 * at. A check that runs and cannot fail on the thing that changed is worse
 * than no check: it reports green. And no CI job evaluates the root flake's
 * `nixosConfigurations` at all, so the `services.k3s.manifests` roster that
 * points AT these files was equally unwitnessed.
 *
 * MEASURED consequence, on real K3S v1.31.4+k3s1 booted with exactly the four
 * manifests `k3s-server.nix` declared as of 2026-08-18:
 *
 *   Addon kube-system/argocd-install     CHECKSUM <empty>
 *   Addon kube-system/root-application   CHECKSUM <empty>
 *   Warning ApplyManifestFailed  ... argocd-install.yaml failed:
 *                                the server could not find the requested resource
 *   $ kubectl -n argocd get pods   -> No resources found
 *   $ kubectl get crd | grep argo  -> (nothing)
 *
 * retried every ~15s forever. `argocd-install.yaml` was a
 * `kustomize.config.k8s.io/v1beta1` Kustomization — a build-time kustomize
 * input, not a Kubernetes API object. K3S does support kustomize, but only
 * for a DIRECTORY in the manifests tree containing a file named
 * `kustomization.yaml` / `kustomization.yml` / `Kustomization`. NixOS's
 * `services.k3s.manifests` cannot emit that shape: every attribute becomes a
 * single flat file `/var/lib/rancher/k3s/server/manifests/<name>.yaml`. So
 * the API server was asked for a resource it does not serve, ArgoCD never
 * installed, and therefore nothing in `infra/k8s/applications/` ever
 * deployed.
 *
 * Every check below is proved able to go RED by
 * `infra/k8s/tests/validate-bootstrap.test.ts`, which copies the real tree,
 * applies one mutation, and asserts this script exits 1 with the specific
 * reason. Check 4 goes red on the pre-2026-08-18 `argocd-install.yaml`
 * verbatim — that mutation case is the regression guard for the bug above.
 *
 * ── WHAT THIS DOES NOT CATCH (stated, not hidden) ──────────────────────────
 * This is a STRUCTURAL check on what K3S can apply. It does not run K3S, does
 * not resolve Helm charts, and does not know whether a pinned chart version
 * exists upstream or whether the workload it installs is healthy. It would
 * not, for instance, catch a HelmChart pinned to a real-looking but
 * non-existent version — only a live boot notices that. The live k3s/kind
 * lanes are where that belongs.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseAllDocuments } from "yaml";

// ── Small helpers ────────────────────────────────────────────────────────────

/**
 * Ordinal string order, deliberately NOT `localeCompare`:
 * .claude/rules/culture-invariant-by-default.md — discovery order (and so the
 * order failures are reported in) must not vary with the runner's locale.
 */
function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function firstLine(text: string): string {
  return text.split("\n", 1)[0] ?? text;
}

function reason(e: unknown): string {
  return firstLine(e instanceof Error ? e.message : String(e));
}

// ── Result accumulation ──────────────────────────────────────────────────────

let passCount = 0;
const failures: string[] = [];

function ok(msg: string): void {
  console.log(`  PASS: ${msg}`);
  passCount++;
}

function err(msg: string): void {
  console.log(`  FAIL: ${msg}`);
  failures.push(msg);
}

// ── Arguments ────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "infra-dir": { type: "string" },
  },
  strict: true,
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const infraDir = args["infra-dir"] ? resolve(args["infra-dir"]) : join(repoRoot, "infra");

const k3sServerModule = join(infraDir, "nixos", "modules", "k3s-server.nix");
const bootstrapDir = join(infraDir, "k8s", "bootstrap");

for (const [label, path] of [
  ["k3s-server module", k3sServerModule],
  ["bootstrap dir", bootstrapDir],
] as const) {
  if (!existsSync(path)) {
    console.error(`${label} not found at ${path}`);
    process.exit(1);
  }
}

// ── The roster: what `services.k3s.manifests` actually declares ──────────────

interface RosterEntry {
  /** The attribute name, e.g. `argocd-install`. */
  readonly attr: string;
  /** The literal written in the .nix file, e.g. `../../k8s/bootstrap/x.yaml`. */
  readonly literal: string;
  /** Absolute path, or null when the literal is not a resolvable path. */
  readonly path: string | null;
}

/** The `manifests = { ... }` attrset body, located by brace matching. */
function extractManifestsAttrset(nixSource: string): string {
  const anchor = nixSource.indexOf("manifests = {");
  if (anchor === -1) {
    throw new Error("no `manifests = {` attrset found in k3s-server.nix");
  }
  let depth = 0;
  for (let i = anchor + "manifests = ".length; i < nixSource.length; i++) {
    const ch = nixSource[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return nixSource.slice(anchor, i);
    }
  }
  throw new Error("unterminated `manifests = {` attrset in k3s-server.nix");
}

/**
 * One `<attr>.source = <literal>;` binding, or null if this line is not one.
 *
 * Parsed by hand rather than by regex: the bindings are one per line and
 * trivially delimited, so a regex here would be both harder to read and (per
 * sonarjs/slow-regex) a backtracking hazard for no benefit.
 */
function parseSourceBinding(rawLine: string, moduleDir: string): RosterEntry | null {
  const line = rawLine.trim();
  const eq = line.indexOf("=");
  if (eq === -1) return null;
  const lhs = line.slice(0, eq).trim();
  const SOURCE_ATTR = ".source";
  if (!lhs.endsWith(SOURCE_ATTR)) return null;
  const attr = lhs.slice(0, lhs.length - SOURCE_ATTR.length);
  if (attr.length === 0) return null;
  const semi = line.indexOf(";", eq);
  if (semi === -1) return null;

  const literal = line.slice(eq + 1, semi).trim();
  const isPathLiteral = literal.startsWith("./") || literal.startsWith("../") || literal.startsWith("/");
  if (!isPathLiteral) return { attr, literal, path: null };
  const path = isAbsolute(literal) ? resolve(literal) : resolve(join(moduleDir, literal));
  return { attr, literal, path };
}

/**
 * Read the `services.k3s.manifests` roster out of k3s-server.nix.
 *
 * Deliberately narrow: it understands the ONE shape the module actually uses.
 * Anything else is reported as a failure rather than skipped — a roster entry
 * this parser cannot see is a manifest nothing in CI is looking at, which is
 * the exact condition that let the ArgoCD bug live.
 */
function readManifestRoster(nixSource: string, moduleDir: string): RosterEntry[] {
  const entries: RosterEntry[] = [];
  for (const rawLine of extractManifestsAttrset(nixSource).split("\n")) {
    const entry = parseSourceBinding(rawLine, moduleDir);
    if (entry !== null) entries.push(entry);
  }
  return entries.sort((a, b) => compareOrdinal(a.attr, b.attr));
}

let roster: RosterEntry[];
try {
  roster = readManifestRoster(readFileSync(k3sServerModule, "utf-8"), dirname(k3sServerModule));
} catch (e) {
  console.error(`cannot read the services.k3s.manifests roster: ${reason(e)}`);
  process.exit(1);
}

if (roster.length === 0) {
  console.error(
    "services.k3s.manifests declares no `<attr>.source = <path>;` bindings — " +
      "either the control-plane bootstraps nothing, or this parser has gone blind to the shape used.",
  );
  process.exit(1);
}

// ── Test 1: every declared manifest source resolves to a file ────────────────
//
// A renamed or deleted bootstrap manifest does not fail any build: the flake
// is never evaluated in CI. It fails at `nixos-install` time on the metal,
// which is the worst possible place to find out.

console.log("\n=== Test 1: every services.k3s.manifests source resolves ===");
for (const entry of roster) {
  if (entry.path === null) {
    err(
      `${entry.attr}: source is \`${entry.literal}\`, not a path literal this check can resolve — ` +
        `a manifest nothing can validate is a manifest nothing is watching`,
    );
  } else if (!existsSync(entry.path)) {
    err(`${entry.attr}: source ${entry.literal} resolves to ${entry.path}, which does not exist`);
  } else {
    ok(`${entry.attr}: ${relative(infraDir, entry.path)}`);
  }
}

const resolved = roster.filter((e): e is RosterEntry & { path: string } => e.path !== null && existsSync(e.path));

// ── Test 2: every file in bootstrap/ is on the roster ────────────────────────
//
// The mirror of Test 1. A manifest sitting in bootstrap/ that no
// `services.k3s.manifests` attribute names is never applied by anything — it
// reads as cluster desired-state and is inert.

console.log("\n=== Test 2: every infra/k8s/bootstrap file is declared in services.k3s.manifests ===");
const declaredPaths = new Set(resolved.map((e) => e.path));
const bootstrapFiles = readdirSync(bootstrapDir)
  .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
  .map((f) => join(bootstrapDir, f))
  .filter((f) => statSync(f).isFile())
  .sort(compareOrdinal);

if (bootstrapFiles.length === 0) {
  err(`${relative(infraDir, bootstrapDir)}/ contains no manifests`);
}
for (const file of bootstrapFiles) {
  if (declaredPaths.has(file)) {
    ok(`${relative(bootstrapDir, file)}: declared`);
  } else {
    err(
      `${relative(bootstrapDir, file)}: present in bootstrap/ but NOT declared in services.k3s.manifests — ` +
        `K3S will never apply it`,
    );
  }
}

// ── Parse every rostered manifest ────────────────────────────────────────────

interface ManifestDoc {
  readonly apiVersion: unknown;
  readonly kind: unknown;
  readonly metadata: unknown;
  readonly spec: unknown;
}

interface ParsedManifest {
  readonly entry: RosterEntry & { path: string };
  readonly docs: ManifestDoc[] | null;
  readonly parseError: string | null;
}

/**
 * Strict multi-document parse. `uniqueKeys: true` makes a duplicate mapping
 * key an ERROR rather than a last-write-wins silent merge; empty documents
 * (the leading comment block before a file's first `---`) are dropped.
 */
function parseManifest(content: string): ManifestDoc[] {
  const docs = parseAllDocuments(content, { uniqueKeys: true, strict: true });
  const out: ManifestDoc[] = [];
  for (const doc of docs) {
    if (doc.errors.length > 0) throw new Error(doc.errors[0]?.message ?? "YAML error");
    const value = doc.toJS() as unknown;
    if (value === null || value === undefined) continue;
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error("document is not a YAML mapping");
    }
    out.push(value as ManifestDoc);
  }
  return out;
}

const manifests: ParsedManifest[] = resolved.map((entry) => {
  try {
    return { entry, docs: parseManifest(readFileSync(entry.path, "utf-8")), parseError: null };
  } catch (e) {
    return { entry, docs: null, parseError: reason(e) };
  }
});

// ── Test 3: strict YAML parse ────────────────────────────────────────────────

console.log("\n=== Test 3: strict YAML parse (syntax + duplicate keys) ===");
for (const m of manifests) {
  if (m.docs === null) {
    err(`${m.entry.attr}: YAML parse failed: ${String(m.parseError)}`);
  } else if (m.docs.length === 0) {
    err(`${m.entry.attr}: contains no YAML documents — K3S would apply nothing`);
  } else {
    ok(`${m.entry.attr}: parses strictly (${String(m.docs.length)} document(s))`);
  }
}

// ── Test 4: every document is something K3S's auto-deploy can apply ──────────
//
// THE REGRESSION GUARD. `services.k3s.manifests` writes each attribute as one
// flat file under /var/lib/rancher/k3s/server/manifests/, and K3S applies each
// file's documents as Kubernetes API objects. Build-time inputs to a manifest
// GENERATOR are not API objects; the API server answers "the server could not
// find the requested resource" and the addon retries forever.
//
// K3S's kustomize support is real, but it is directory-scoped: it triggers on
// a directory containing kustomization.yaml / kustomization.yml / Kustomization.
// NixOS cannot produce that from `services.k3s.manifests`.

/** apiVersion groups that are inputs to a build step, never served by the API server. */
const BUILD_TIME_ONLY_GROUPS = new Set(["kustomize.config.k8s.io"]);

function apiGroupOf(apiVersion: string): string {
  const slash = apiVersion.indexOf("/");
  return slash === -1 ? "" : apiVersion.slice(0, slash);
}

console.log("\n=== Test 4: every bootstrap document is a K3S-appliable Kubernetes object ===");
for (const m of manifests) {
  const docs = m.docs;
  if (docs === null) continue; // already failed Test 3; do not double-report
  docs.forEach((doc, i) => {
    const where = docs.length > 1 ? `${m.entry.attr}[doc ${String(i)}]` : m.entry.attr;
    const apiVersion = doc.apiVersion;
    const kind = doc.kind;

    if (typeof apiVersion !== "string" || apiVersion.length === 0) {
      err(`${where}: missing or non-string apiVersion — not a Kubernetes object`);
      return;
    }
    if (typeof kind !== "string" || kind.length === 0) {
      err(`${where}: missing or non-string kind — not a Kubernetes object`);
      return;
    }

    const group = apiGroupOf(apiVersion);
    if (BUILD_TIME_ONLY_GROUPS.has(group)) {
      err(
        `${where}: apiVersion ${apiVersion} (kind ${kind}) is a BUILD-TIME kustomize input, not an API object. ` +
          `services.k3s.manifests writes flat files, so K3S applies this directly and the API server has no ` +
          `such resource ("the server could not find the requested resource"), retried forever. ` +
          `K3S kustomize needs a DIRECTORY containing kustomization.yaml, which NixOS cannot emit here — ` +
          `use a helm.cattle.io/v1 HelmChart or plain resources instead`,
      );
      return;
    }

    const name = (doc.metadata as { name?: unknown } | null | undefined)?.name;
    if (typeof name !== "string" || name.length === 0) {
      err(`${where}: ${apiVersion} ${kind} has no metadata.name`);
      return;
    }
    ok(`${where}: ${apiVersion} ${kind}/${name}`);
  });
}

// ── Test 5: HelmChart CRs pin an exact chart version ─────────────────────────
//
// An unpinned HelmChart resolves "latest" at first boot, so two nodes
// installed a week apart get different clusters from the same commit. That is
// the reproducibility claim in infra/README.md ("every text file in this
// directory is the desired state") failing silently.

console.log("\n=== Test 5: HelmChart CRs pin an exact chart version ===");
let helmChartCount = 0;
for (const m of manifests) {
  const docs = m.docs;
  if (docs === null) continue;
  docs.forEach((doc, i) => {
    if (apiGroupOf(String(doc.apiVersion)) !== "helm.cattle.io" || doc.kind !== "HelmChart") return;
    helmChartCount++;
    const where = docs.length > 1 ? `${m.entry.attr}[doc ${String(i)}]` : m.entry.attr;
    const spec = (doc.spec ?? {}) as { version?: unknown; chart?: unknown; repo?: unknown };
    if (typeof spec.chart !== "string" || spec.chart.length === 0) {
      err(`${where}: HelmChart has no spec.chart`);
      return;
    }
    if (typeof spec.version !== "string" || spec.version.length === 0) {
      err(
        `${where}: HelmChart ${spec.chart} has no spec.version — first boot would resolve "latest", so the ` +
          `same commit produces different clusters on different days`,
      );
      return;
    }
    if (typeof spec.repo !== "string" || spec.repo.length === 0) {
      err(`${where}: HelmChart ${spec.chart} has no spec.repo`);
      return;
    }
    ok(`${where}: HelmChart ${spec.chart} pinned to ${spec.version}`);
  });
}
if (helmChartCount === 0) {
  console.log("  (no HelmChart CRs in the bootstrap set)");
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${String(passCount)} passed, ${String(failures.length)} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("All checks passed.");
