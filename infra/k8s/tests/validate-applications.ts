#!/usr/bin/env bun
/**
 * infra/k8s/tests/validate-applications.ts
 *
 * ArgoCD Application + Helm chart validation for the `infra/k8s` GitOps tree.
 *
 * Usage:
 *   bun infra/k8s/tests/validate-applications.ts                 # structural + chart pin (online)
 *   bun infra/k8s/tests/validate-applications.ts --offline       # structural only, no network
 *   bun infra/k8s/tests/validate-applications.ts --render        # + helm template + kubeconform
 *   bun infra/k8s/tests/validate-applications.ts --apps-dir DIR  # point at another tree
 *   bun infra/k8s/tests/validate-applications.ts --root-app PATH # root-application.yaml elsewhere
 *
 * Exit codes: 0 = all checks passed, 1 = one or more failed, 2 = usage error.
 *
 * ── WHY THIS FILE WAS REWRITTEN (2026-08-14, Dejan) ─────────────────────────
 * The previous version shipped a ~120-line hand-rolled YAML parser and a
 * substring chart check. Both were measured to be UNABLE TO GO RED on real
 * breakage:
 *
 *   1. `simpleYamlParse` never threw. It skipped any line it did not
 *      understand. MEASURED: a manifest with a tab-indented line, an
 *      unterminated double-quoted scalar and an unclosed flow sequence
 *      printed `PASS: orleans/Application.yaml: valid YAML`. The "YAML syntax
 *      validation" test could only fail if the parser threw, and it never did.
 *   2. Duplicate keys parsed clean. MEASURED: injecting a second
 *      `destination.namespace` — a YAML-spec violation the API server
 *      rejects — produced `37 passed, 0 failed`, exit 0.
 *   3. The online chart check was `index.yaml.includes("name: " + chart)`.
 *      MEASURED: pinning cockroachdb to `targetRevision: 999.999.999`
 *      produced `44 passed, 0 failed`, exit 0. The one check that existed to
 *      catch a bad chart pin before ArgoCD tried to sync it on real hardware
 *      could not see a version at all, and the substring form also matched
 *      any chart whose name merely had ours as a prefix.
 *
 * The fix is to stop hand-rolling: parse with the `yaml` package (already a
 * direct dependency) with `uniqueKeys: true`, resolve the exact version out
 * of the parsed repo index, and — under `--render` — hand the actual work to
 * `helm template` and `kubeconform`, which are pinned in `.mise.full.toml`.
 *
 * Every claim above is re-proved on every run of
 * `infra/k8s/tests/validate-applications.test.ts`, which mutates manifests in
 * a temp tree and asserts this script exits 1. A check that is not proved to
 * go red is occupying the slot where a real one would go.
 *
 * ── WHAT THIS DOES NOT CATCH (stated, not hidden) ───────────────────────────
 * `helm template` + `kubeconform` validate STRUCTURE and SCHEMA, not SEMANTICS.
 * MEASURED: setting `statefulset.replicas: "not-a-number"` on the cockroachdb
 * chart renders `replicas: 0` — schema-valid, silently wrong. Only a live
 * cluster notices that no pod ever appears. That gap is the live kind lane's
 * job (.github/workflows/k8s-argocd-health-test.yml), not this file's.
 */

import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parse as parseYamlStrict, stringify as stringifyYaml } from "yaml";

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

/** First line of a message, for one-line failure reporting. */
function firstLine(text: string): string {
  return text.split("\n", 1)[0] ?? text;
}

/** One-line reason from an unknown thrown value. */
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

// ── YAML ─────────────────────────────────────────────────────────────────────

/**
 * Strict parse. `uniqueKeys: true` makes a duplicate mapping key an ERROR
 * rather than a last-write-wins silent merge — that is the mutation the old
 * hand-rolled parser waved through.
 */
function parseStrict(content: string): Record<string, unknown> {
  const doc = parseYamlStrict(content, { uniqueKeys: true, strict: true }) as unknown;
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("document is not a YAML mapping");
  }
  return doc as Record<string, unknown>;
}

function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ── Discovery ────────────────────────────────────────────────────────────────

function findApplicationYamls(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findApplicationYamls(full));
    } else if (entry === "Application.yaml") {
      results.push(full);
    }
  }
  return results.sort(compareOrdinal);
}

/**
 * Every `*.yaml` / `*.yml` under `dir`, regardless of filename.
 *
 * `findApplicationYamls` selects by the EXACT filename `Application.yaml`, which
 * is a convention nothing in either tree enforced. This walk is the control for
 * it: Test 0 compares the two sets, so an ArgoCD Application that lands in a
 * differently-named file is reported as UNREACHABLE instead of silently dropping
 * out of every check in this file.
 */
function findAllYamls(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findAllYamls(full));
    } else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
      results.push(full);
    }
  }
  return results.sort(compareOrdinal);
}

/**
 * Does this file contain an ArgoCD `Application` document?
 *
 * Deliberately textual and deliberately narrow. A full multi-document parse of
 * every YAML in the tree would fail on the Helm-templated files that live
 * alongside the manifests, and a parse error there is not evidence about
 * Application coverage. `kind: Application` at column 0 is how every manifest in
 * both trees is written, and it is the same anchored form this repo's other
 * audits use. `ApplicationSet` does NOT match: the trailing `$` is load-bearing.
 */
function looksLikeArgoApplication(path: string): boolean {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return false;
  }
  return /^kind: Application[ \t]*$/m.test(text) && /^apiVersion: argoproj\.io\//m.test(text);
}

// ── Arguments ────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    offline: { type: "boolean", default: false },
    render: { type: "boolean", default: false },
    "apps-dir": { type: "string" },
    // ADDED 2026-08-20 (Dejan). The root App-of-Apps does not live in the same
    // place in every tree: infra/k8s keeps it inside applications/, while
    // full-ai-cluster/k8s keeps it in bootstrap/ (k3s applies it at first boot,
    // so it must be on the `services.k3s.manifests` roster). Hardcoding
    // `<apps-dir>/root-application.yaml` made Test 6 report ENOENT against
    // full-ai-cluster -- a failure of the validator's assumption, not of the
    // manifest. A red that names the wrong culprit trains people to ignore reds.
    "root-app": { type: "string" },
    "kube-version": { type: "string", default: "1.33.0" },
  },
  strict: true,
});

const offline = args.offline;
const render = args.render;
const kubeVersion = args["kube-version"];

if (offline && render) {
  console.error("usage: --offline and --render are mutually exclusive (rendering pulls charts)");
  process.exit(2);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const appsDir = args["apps-dir"] ? resolve(args["apps-dir"]) : join(repoRoot, "infra", "k8s", "applications");

// ── Parse every Application.yaml up front ────────────────────────────────────

interface AppEntry {
  readonly path: string;
  readonly name: string;
  readonly yaml: Record<string, unknown> | null;
  readonly parseError: string | null;
}

const rootAppPath = args["root-app"] ? resolve(args["root-app"]) : join(appsDir, "root-application.yaml");
const appFiles = findApplicationYamls(appsDir);
const apps: AppEntry[] = [];

for (const path of appFiles) {
  const name = relative(appsDir, path).replace(/\/Application\.yaml$/, "");
  try {
    apps.push({ path, name, yaml: parseStrict(readFileSync(path, "utf-8")), parseError: null });
  } catch (e) {
    apps.push({ path, name, yaml: null, parseError: reason(e) });
  }
}

if (apps.length === 0) {
  console.error(`no Application.yaml found under ${appsDir}`);
  process.exit(1);
}

// ── Test 0: every Application in the tree is REACHABLE by this validator ─────
//
// ADDED 2026-08-26. Every other test in this file runs over `apps`, which is
// built by `findApplicationYamls` -- a match on the exact filename
// `Application.yaml`. That convention was never enforced anywhere, so an ArgoCD
// Application committed as `foo-app.yaml` would be validated by NOTHING here and
// this file would still print "All checks passed". A check whose input set can
// silently shrink is not a check on the tree; it is a check on whatever happened
// to be named correctly.
//
// MEASURED at the commit that added this: 48 Application documents under
// full-ai-cluster/k8s (47 + the root) and 8 under infra/k8s/applications (7 +
// the root); every one of them is either named `Application.yaml` or IS the
// declared root app, so this test lands GREEN on both trees and is a ratchet
// against regression rather than a debt.
//
// The declared root app is exempt BY PATH, not by name: the two trees put it in
// different places (infra/k8s/applications/root-application.yaml vs
// full-ai-cluster/k8s/bootstrap/root-application.yaml), which is exactly why
// `--root-app` exists. Test 6 is what validates that file.

console.log("\n=== Test 0: every Application under apps-dir is reachable ===");
{
  const reachable = new Set<string>(appFiles.map((p) => resolve(p)));
  reachable.add(resolve(rootAppPath));
  let unreachable = 0;
  for (const path of findAllYamls(appsDir)) {
    if (reachable.has(resolve(path))) continue;
    if (!looksLikeArgoApplication(path)) continue;
    unreachable++;
    err(
      `${relative(appsDir, path)}: contains an ArgoCD Application but NO check in this file reads it — ` +
        `rename it to Application.yaml, or declare it with --root-app`,
    );
  }
  if (unreachable === 0) {
    ok(`all ${String(appFiles.length)} discovered Application.yaml + the declared root app cover every Application in ${relative(repoRoot, appsDir)}`);
  }
}

// ── Test 1: YAML parses strictly (syntax + duplicate keys) ───────────────────

console.log("\n=== Test 1: strict YAML parse (syntax + duplicate keys) ===");
for (const app of apps) {
  if (app.yaml === null) {
    err(`${app.name}/Application.yaml: YAML parse failed: ${String(app.parseError)}`);
  } else {
    ok(`${app.name}/Application.yaml: parses strictly`);
  }
}

/** Only manifests that parsed can be inspected further. */
const parsedApps = apps.filter((a): a is AppEntry & { yaml: Record<string, unknown> } => a.yaml !== null);

// ── Test 2: required ArgoCD Application fields ───────────────────────────────

const REQUIRED_FIELDS = [
  "apiVersion",
  "kind",
  "metadata.name",
  "metadata.namespace",
  "spec.project",
  "spec.source.repoURL",
  "spec.destination.server",
  "spec.destination.namespace",
  "spec.syncPolicy.automated.prune",
  "spec.syncPolicy.automated.selfHeal",
];

console.log("\n=== Test 2: required ArgoCD Application fields ===");
for (const app of parsedApps) {
  let allOk = true;
  for (const field of REQUIRED_FIELDS) {
    const val = get(app.yaml, field);
    if (val === undefined || val === null) {
      err(`${app.name}/Application.yaml: missing required field .${field}`);
      allOk = false;
    }
  }
  const finalizers = get(app.yaml, "metadata.finalizers");
  if (
    !Array.isArray(finalizers) ||
    !finalizers.some((f) => typeof f === "string" && f.includes("resources-finalizer"))
  ) {
    err(`${app.name}/Application.yaml: missing resources-finalizer.argocd.argoproj.io`);
    allOk = false;
  }
  const syncOpts = get(app.yaml, "spec.syncPolicy.syncOptions");
  if (!Array.isArray(syncOpts) || !syncOpts.includes("CreateNamespace=true")) {
    err(`${app.name}/Application.yaml: missing CreateNamespace=true in syncOptions`);
    allOk = false;
  }
  if (allOk) ok(`${app.name}/Application.yaml: all required fields present`);
}

// ── Test 3: apiVersion / kind ────────────────────────────────────────────────

console.log("\n=== Test 3: apiVersion and kind ===");
for (const app of parsedApps) {
  const api = get(app.yaml, "apiVersion");
  const kind = get(app.yaml, "kind");
  if (api === "argoproj.io/v1alpha1" && kind === "Application") {
    ok(`${app.name}/Application.yaml: argoproj.io/v1alpha1 Application`);
  } else {
    err(`${app.name}/Application.yaml: wrong apiVersion (${String(api)}) or kind (${String(kind)})`);
  }
}

// ── Test 4: destination.server is in-cluster ─────────────────────────────────

console.log("\n=== Test 4: destination.server is in-cluster ===");
for (const app of parsedApps) {
  const server = get(app.yaml, "spec.destination.server");
  if (server === "https://kubernetes.default.svc") {
    ok(`${app.name}/Application.yaml: destination.server is in-cluster`);
  } else {
    err(`${app.name}/Application.yaml: destination.server is NOT in-cluster (${String(server)})`);
  }
}

// ── Test 5: Helm source shape ────────────────────────────────────────────────

interface ChartRef {
  readonly appName: string;
  readonly chart: string;
  readonly version: string;
  readonly repoURL: string;
  readonly releaseName: string;
  readonly namespace: string;
  readonly valuesObject: unknown;
}

const charts: ChartRef[] = [];

console.log("\n=== Test 5: Helm source shape ===");
for (const app of parsedApps) {
  const chart = get(app.yaml, "spec.source.chart");
  if (chart === undefined || chart === null) {
    ok(`${app.name}/Application.yaml: directory source, not a Helm chart (skipped)`);
    continue;
  }
  const version = get(app.yaml, "spec.source.targetRevision");
  const repoURL = get(app.yaml, "spec.source.repoURL");
  if (typeof chart !== "string" || typeof version !== "string" || typeof repoURL !== "string") {
    err(`${app.name}/Application.yaml: chart/targetRevision/repoURL must all be strings`);
    continue;
  }
  const releaseName = get(app.yaml, "spec.source.helm.releaseName");
  const namespace = get(app.yaml, "spec.destination.namespace");
  charts.push({
    appName: app.name,
    chart,
    version,
    repoURL,
    releaseName: typeof releaseName === "string" ? releaseName : chart,
    namespace: typeof namespace === "string" ? namespace : "default",
    valuesObject: get(app.yaml, "spec.source.helm.valuesObject") ?? {},
  });
  ok(`${app.name}/Application.yaml: Helm source (chart=${chart}, version=${version})`);
}

// ── Test 6: root-application.yaml ────────────────────────────────────────────

console.log("\n=== Test 6: root-application.yaml ===");
try {
  const rootYaml = parseStrict(readFileSync(rootAppPath, "utf-8"));
  if (get(rootYaml, "spec.source.directory.recurse") === true) {
    ok("root-application.yaml: directory.recurse=true");
  } else {
    err("root-application.yaml: directory.recurse is not true");
  }
  const include = get(rootYaml, "spec.source.directory.include");
  if (typeof include === "string" && include.length > 0) {
    ok("root-application.yaml: directory.include is set");
  } else {
    err("root-application.yaml: directory.include is missing (would pick up non-Application files)");
  }
} catch (e) {
  err(`root-application.yaml: ${reason(e)}`);
}

// ── Test 7: exact chart VERSION exists in the repo index (online) ────────────
//
// The old check was `index.yaml.includes("name: " + chart)`, which ignored the
// pinned version entirely and matched on a substring. This resolves the parsed
// index and requires an exact `version` match on the named entry.

/**
 * OCI registries have no `/index.yaml`. ArgoCD's convention for an OCI Helm
 * source is a `repoURL` with NO scheme (`ghcr.io/actions/...`) plus a `chart`;
 * an HTTP chart repo always carries `https://` / `http://`. So the absence of
 * a scheme is the discriminator, and it is the same one ArgoCD itself uses.
 *
 * ADDED 2026-08-20 (Dejan). Before this, the three OCI-sourced apps in
 * full-ai-cluster (arc-controller, arc-runner-set, hindsight) produced SIX of
 * the tree's 29 failures -- three "repo index unreachable
 * (fetch() URL is invalid): ghcr.io/.../index.yaml" and three "helm template
 * failed: could not find protocol handler for:". Both were the validator
 * asking an OCI registry an HTTP-repo question. Those are false reds, and a
 * lane with false reds in it is a lane people learn to skim.
 */
function isOciRepo(repoURL: string): boolean {
  return !repoURL.includes("://");
}

/**
 * `oci://host/path/chart` -- the reference helm actually accepts.
 *
 * Slashes are trimmed with string ops rather than a regex: the obvious
 * `/^\\/+|\\/+$/` is a backtracking hazard (sonarjs/slow-regex) and buys
 * nothing over two while-loops on a short string.
 */
function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "/") start++;
  while (end > start && value[end - 1] === "/") end--;
  return value.slice(start, end);
}

function ociChartRef(ref: ChartRef): string {
  return `oci://${trimSlashes(ref.repoURL)}/${ref.chart}`;
}

/**
 * Existence of an OCI chart:version. Deliberately NOT a skip -- `helm show
 * chart` performs a real registry FetchReference and exits 1 on a version that
 * is not published, which is proved by the mutation suite. If helm is absent
 * this reports a failure rather than passing: a check that goes green when its
 * tool is missing is the shape this whole file exists to remove.
 */
function ociChartVersionExists(ref: ChartRef): string | null {
  if (toolMissing("helm")) {
    return `OCI chart ${ociChartRef(ref)} cannot be checked: helm is not on PATH (MISE_ENV=full provides it)`;
  }
  const shown = Bun.spawnSync(["helm", "show", "chart", ociChartRef(ref), "--version", ref.version], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (shown.exitCode === 0) return null;
  return `OCI chart ${ociChartRef(ref)} has no version '${ref.version}': ${shown.stderr
    .toString()
    .split("\n")
    .slice(0, 2)
    .join(" ")
    .trim()}`;
}

async function chartVersionExists(ref: ChartRef): Promise<string | null> {
  if (isOciRepo(ref.repoURL)) return ociChartVersionExists(ref);
  const indexUrl = `${ref.repoURL.replace(/\/$/, "")}/index.yaml`;
  let text: string;
  try {
    const res = await fetch(indexUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return `repo index returned HTTP ${String(res.status)}: ${indexUrl}`;
    text = await res.text();
  } catch (e) {
    return `repo index unreachable (${reason(e)}): ${indexUrl}`;
  }
  let index: unknown;
  try {
    index = parseYamlStrict(text);
  } catch {
    return `repo index is not valid YAML: ${indexUrl}`;
  }
  const entries = get(index, `entries.${ref.chart}`);
  if (!Array.isArray(entries)) return `chart '${ref.chart}' is not published in ${ref.repoURL}`;
  const versions = entries
    .map((e) => (e !== null && typeof e === "object" ? (e as Record<string, unknown>).version : undefined))
    .filter((v): v is string => typeof v === "string");
  if (!versions.includes(ref.version)) {
    return `chart '${ref.chart}' has no version '${ref.version}' in ${ref.repoURL} (${String(versions.length)} published versions; newest ${versions[0] ?? "none"})`;
  }
  return null;
}

if (offline) {
  console.log("\n=== Test 7: chart version existence (SKIPPED — offline) ===");
} else {
  console.log("\n=== Test 7: exact chart VERSION exists in repo index ===");
  const results = await Promise.all(charts.map(async (ref) => ({ ref, problem: await chartVersionExists(ref) })));
  for (const { ref, problem } of results) {
    if (problem === null) {
      ok(`${ref.appName}: ${ref.chart} ${ref.version} is published`);
    } else {
      err(`${ref.appName}: ${problem}`);
    }
  }
}

// ── Test 8: helm template renders, kubeconform validates the render ──────────
//
// This is the check that actually exercises the chart against the pinned
// values. `helm template` exits 1 on an unresolvable chart/version and on any
// template error; kubeconform then schema-validates the manifests that would
// really reach the API server. Both are pinned in .mise.full.toml.

function toolMissing(tool: string): boolean {
  return Bun.spawnSync(["sh", "-c", `command -v ${tool}`], { stdout: "pipe", stderr: "pipe" }).exitCode !== 0;
}

/**
 * How much work Test 8 actually did. THE POINT: these are printed and asserted
 * non-zero, because "Test 8 ran" and "Test 8 validated something" are different
 * claims and only the second one is worth a green tick.
 */
let renderedApps = 0;
let renderedDocs = 0;
let schemaValidResources = 0;
let schemaSkippedResources = 0;

/**
 * `kubeconform -summary` prints one line of the form
 *   `Summary: 19 resources found in 1 file - Valid: 14, Invalid: 0, Errors: 0, Skipped: 5`
 *
 * Reading Valid and Skipped SEPARATELY is deliberate. A render made entirely of
 * kinds kubeconform has no schema for comes back `Valid: 0 ... Skipped: N` and
 * exits 0 under `-ignore-missing-schemas` — schema-validating nothing while
 * looking exactly like success. Only `Valid` counts as validation.
 *
 * The `:?` is not cosmetic. kubeconform v0.7.0 emits `Valid: 14`; the first
 * version of this function matched only the colon-less `Valid 14` form, so it
 * fell through to `{0, 0}` and Test 9 reported "schema-validated ZERO
 * resources" against a render where kubeconform had in fact validated 132. A
 * parser that silently returns zero on no-match is itself a false-report
 * generator, so an unparseable summary is reported as `null` and refused by the
 * caller rather than quietly counted as nothing.
 */
function readKubeconformSummary(text: string): { valid: number; skipped: number } | null {
  const m = /Valid:? (\d+), Invalid:? \d+, Errors:? \d+, Skipped:? (\d+)/.exec(text);
  if (m === null) return null;
  return { valid: Number(m[1]), skipped: Number(m[2]) };
}

if (!render) {
  console.log("\n=== Test 8: helm template + kubeconform (SKIPPED — pass --render) ===");
} else if (toolMissing("helm") || toolMissing("kubeconform")) {
  // Hard failure, NOT a skip. A missing tool silently degrading to green is the
  // exact shape of a check that cannot fail; if --render was asked for, it runs.
  err("--render requested but helm and/or kubeconform is not on PATH (MISE_ENV=full provides both)");
} else {
  console.log("\n=== Test 8: helm template + kubeconform on the rendered output ===");
  const tmpDir = mkdtempSync(join(tmpdir(), "zeta-helm-render-"));
  for (const ref of charts) {
    const valuesPath = join(tmpDir, `${ref.appName.replace(/\//g, "_")}-values.yaml`);
    await Bun.write(valuesPath, stringifyYaml(ref.valuesObject));
    // An OCI chart is addressed as a single `oci://host/path/chart` argument;
    // `--repo ghcr.io/...` makes helm look for a protocol handler and fail.
    const chartArgs = isOciRepo(ref.repoURL) ? [ociChartRef(ref)] : [ref.chart, "--repo", ref.repoURL];
    const rendered = Bun.spawnSync(
      [
        "helm",
        "template",
        ref.releaseName,
        ...chartArgs,
        "--version",
        ref.version,
        "--namespace",
        ref.namespace,
        "--kube-version",
        kubeVersion,
        "--values",
        valuesPath,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (rendered.exitCode !== 0) {
      err(
        `${ref.appName}: helm template failed: ${rendered.stderr.toString().split("\n").slice(0, 3).join(" ").trim()}`,
      );
      continue;
    }
    renderedApps++;
    // `---` document separators in the render. `helm template` always emits a
    // leading one, so this is the document count for a non-empty render and 0
    // for a chart that renders to nothing at all.
    const renderText = rendered.stdout.toString();
    const docsHere = (renderText.match(/^---[ \t]*$/gm) ?? []).length;
    renderedDocs += docsHere;
    ok(
      `${ref.appName}: helm template ${ref.chart} ${ref.version} rendered ` +
        `(${String(rendered.stdout.length)} bytes, ${String(docsHere)} documents)`,
    );

    const renderPath = join(tmpDir, `${ref.appName.replace(/\//g, "_")}-rendered.yaml`);
    await Bun.write(renderPath, rendered.stdout);
    const conform = Bun.spawnSync(
      [
        "kubeconform",
        "-strict",
        "-ignore-missing-schemas",
        "-summary",
        "-kubernetes-version",
        kubeVersion,
        "-schema-location",
        "default",
        renderPath,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (conform.exitCode === 0) {
      const summaryText = `${conform.stdout.toString()}${conform.stderr.toString()}`;
      const summary = readKubeconformSummary(summaryText);
      if (summary === null) {
        // kubeconform exited 0 but printed a summary this parser cannot read.
        // Refuse it: counting an unreadable summary as zero would manufacture a
        // false "validated nothing" report, and counting it as success would
        // manufacture a false coverage number. Both are worse than a red.
        err(
          `${ref.appName}: kubeconform exited 0 but its -summary output could not be parsed, ` +
            `so the validated-resource count is unknown: ${summaryText.trim().split("\n").pop() ?? "(no output)"}`,
        );
      } else {
        schemaValidResources += summary.valid;
        schemaSkippedResources += summary.skipped;
        ok(`${ref.appName}: kubeconform clean — ${summaryText.trim().split("\n").pop() ?? ""}`);
      }
    } else {
      const detail = `${conform.stdout.toString()}${conform.stderr.toString()}`
        .split("\n")
        .slice(0, 4)
        .join(" ")
        .trim();
      err(`${ref.appName}: kubeconform rejected the rendered manifests: ${detail}`);
    }
  }
}

// ── Test 9: the render lane actually validated something ─────────────────────
//
// ADDED 2026-08-26, and this is the whole reason the counters above exist.
//
// MEASURED BEFORE THE FIX, on the tree at 89c8a23c40: an apps-dir containing one
// ArgoCD Application with a `directory` source and no Helm source at all makes
// `charts` empty, so Test 7 and Test 8 print their headings, iterate zero times,
// and this file reports `Results: 7 passed, 0 failed` / `All checks passed.` and
// EXITS 0 -- with `helm template` never invoked and kubeconform never invoked.
// A lane that renders nothing is indistinguishable from a lane that rendered
// everything cleanly, which is the vacuity class exactly.
//
// The full-ai-cluster tree is (accidentally) covered against this today because
// `ratchet-app-failures.ts` compares the failure count to an EXACT baseline, so a
// silent drop to zero renders moves the count and goes red. The default
// `infra/k8s/applications` tree has no ratchet: it is validated by a bare
// `--render` and a silent drop to zero renders there is a clean green. This test
// closes both, at the source, without depending on the ratchet.
//
// The three thresholds are deliberately DIFFERENT questions:
//   charts > 0            -- did we find anything to render?
//   renderedApps > 0      -- did helm actually run and succeed at least once?
//   schemaValidResources  -- did kubeconform SCHEMA-CHECK anything, as opposed
//                            to skipping every resource for want of a schema?
// The third is the one `-ignore-missing-schemas` can quietly zero out.

if (render) {
  console.log("\n=== Test 9: the render lane validated a non-zero amount ===");
  if (charts.length === 0) {
    err(
      `--render found ZERO Helm sources among ${String(parsedApps.length)} Applications in ${relative(repoRoot, appsDir)} — ` +
        "Test 7 and Test 8 validated nothing. A render lane with no charts is not a passing render lane.",
    );
  } else if (renderedApps === 0) {
    err(
      `--render found ${String(charts.length)} Helm sources but rendered NONE of them successfully — ` +
        "kubeconform schema-validated nothing.",
    );
  } else {
    ok(
      `rendered ${String(renderedApps)}/${String(charts.length)} charts into ${String(renderedDocs)} documents; ` +
        `kubeconform schema-validated ${String(schemaValidResources)} resources ` +
        `(${String(schemaSkippedResources)} skipped for want of a schema)`,
    );
    // Stated, not silent. A render that kubeconform skipped in its entirety is
    // a real outcome (a chart of nothing but CRs), and it is NOT a schema check.
    if (schemaValidResources === 0) {
      err(
        `helm rendered ${String(renderedDocs)} documents but kubeconform schema-validated ZERO resources ` +
          `(${String(schemaSkippedResources)} skipped). Under -ignore-missing-schemas that exits 0 and proves nothing about the schemas.`,
      );
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log("\n========================================");
console.log(`Results: ${String(passCount)} passed, ${String(failures.length)} failed`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  console.log("");
  process.exit(1);
}
console.log("All checks passed.");
