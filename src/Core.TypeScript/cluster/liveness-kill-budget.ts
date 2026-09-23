#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/liveness-kill-budget.ts
 *
 * DOES A CONTAINER'S OWN LIVENESS PROBE KILL IT BEFORE IT CAN FINISH STARTING?
 *
 * -- THE DEFECT THIS CLOSES (WP15, PR #17505) --------------------------------
 * The live-kind "included" lane's post-Healthy soak phase caught
 * `hindsight-api-... [api] restartCount 1 -> 2`: `Liveness probe failed: Get
 * "http://...:8888/health/live": connect: connection refused` while the
 * container was still running its alembic migrations. The chart's default
 * liveness probe (`initialDelaySeconds: 30, periodSeconds: 10,
 * failureThreshold: 3`) gives a KILL BUDGET of `30 + (3-1)*10 = 50s` from
 * container start to first restart -- and migrations plus warmup on a busy
 * node routinely exceed that. A liveness probe that fires before the app can
 * listen is a first-boot crash loop on any busy node, metal included, and
 * hindsight was not provably the only container shaped this way.
 *
 * -- WHAT "KILL BUDGET" MEANS -------------------------------------------------
 * The kubelet's first liveness check runs `initialDelaySeconds` after the
 * container starts, then every `periodSeconds`; the container is killed after
 * `failureThreshold` CONSECUTIVE failures. So the last failing check before
 * the kill lands at `initialDelaySeconds + (failureThreshold - 1) *
 * periodSeconds` -- `probeKillBudgetSeconds` below computes exactly that, and
 * it is the same formula used in the hindsight Application.yaml comment this
 * PR also edits, so the two never silently disagree.
 *
 * Defaults filled in when a probe omits them are the documented Kubernetes
 * API defaults (`periodSeconds: 10`, `failureThreshold: 3`,
 * `initialDelaySeconds: 0`) -- see
 * https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.34/#probe-v1-core.
 *
 * -- WHY startupProbe IS PREFERRED, AND WHY THIS TOOL DOES NOT ASSUME IT EXISTS
 * A `startupProbe` holds the kubelet off `livenessProbe` entirely until the
 * container reports ready once, which is the correct fix wherever a chart
 * exposes the key. MEASURED (hindsight 0.9.2, extracted with `helm pull
 * oci://ghcr.io/vectorize-io/charts/hindsight --version 0.9.2 --untar`):
 * `templates/api-deployment.yaml` renders `livenessProbe` and `readinessProbe`
 * from values and NOTHING ELSE -- no `startupProbe` key exists to set. Charts
 * differ on this, so this module reports what a container actually HAS
 * (`hasStartup`) rather than assuming every chart can be handed one; deciding
 * "widen liveness" vs "add startupProbe" is a per-chart, per-PR call.
 *
 * -- RENDERING ----------------------------------------------------------------
 * Same technique as `full-ai-cluster/k8s/tests/validate-applications.ts`
 * (`helm template <release> <chart> --repo/oci ... --values <tmp>`) and
 * `crd-provider-consumer-order.ts` (`renderHelmApp` in this same directory) --
 * REIMPLEMENTED rather than imported, for the reason that file's own header
 * gives: both are top-level scripts / return a narrower `RenderedDoc` (no pod
 * spec), and duplicating ~30 lines of `helm template` plumbing is cheaper than
 * reshaping a type three other modules already depend on. `readShippedApplications`
 * (roster) and `readAppSource` (Application.yaml -> chart/values) ARE imported
 * from their siblings in this directory -- those return exactly what this
 * module needs with no narrowing.
 *
 * Directory-sourced (in-repo) Applications are read straight off disk: no
 * `helm template` involved, since what ships IS what ArgoCD applies.
 *
 * Exit codes: 0 clean (or `--report`, which never gates), 1 an unacknowledged
 * container crosses the kill-budget floor, 2 usage / helm missing.
 */

import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { readShippedApplications, type ShippedApplication } from "./derive-sync-waves.ts";
import { readAppSource, type AppSource } from "./crd-provider-consumer-order.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

// ── Kill-budget arithmetic ───────────────────────────────────────────────────

/** Kubernetes API defaults for a Probe, applied only where the field is absent. */
const DEFAULT_PERIOD_SECONDS = 10;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_INITIAL_DELAY_SECONDS = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ordinal string order, deliberately NOT `localeCompare`:
 * .claude/rules/culture-invariant-by-default.md -- table row order (and so
 * `formatTable`'s output) must not vary with the runner's locale. Mirrors
 * `validate-applications.ts`'s own `compareOrdinal`.
 */
function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Seconds from container start to first kill, or `null` when `probe` is not a
 * probe object (liveness absent) or declares a non-positive period/threshold
 * (malformed -- refused rather than silently treated as "safe").
 */
export function probeKillBudgetSeconds(probe: unknown): number | null {
  if (!isRecord(probe)) return null;
  const initialDelay =
    typeof probe.initialDelaySeconds === "number" ? probe.initialDelaySeconds : DEFAULT_INITIAL_DELAY_SECONDS;
  const period = typeof probe.periodSeconds === "number" ? probe.periodSeconds : DEFAULT_PERIOD_SECONDS;
  const failureThreshold =
    typeof probe.failureThreshold === "number" ? probe.failureThreshold : DEFAULT_FAILURE_THRESHOLD;
  if (period <= 0 || failureThreshold <= 0) return null;
  return initialDelay + (failureThreshold - 1) * period;
}

// ── Container extraction ─────────────────────────────────────────────────────

export interface ContainerProbeSummary {
  readonly app: string;
  readonly kind: string;
  readonly resource: string;
  readonly namespace: string;
  readonly container: string;
  readonly hasLiveness: boolean;
  readonly hasReadiness: boolean;
  readonly hasStartup: boolean;
  readonly killBudgetSeconds: number | null;
}

/**
 * Every container-shaped object under `doc` — anything with a string `name`
 * AND a string `image`. Mirrors `render-kube-version-image-drift.ts`'s
 * `collectImages`: no pod-kind awareness (Deployment/StatefulSet/DaemonSet/
 * CronJob/Pod all differ in WHERE `containers:` sits; a container itself
 * looks the same everywhere), so `initContainers` are caught for free and no
 * per-kind path table needs to stay in sync with the cluster's own kinds.
 */
export function collectContainers(doc: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(doc)) {
    for (const v of doc) collectContainers(v, out);
  } else if (isRecord(doc)) {
    if (typeof doc.name === "string" && typeof doc.image === "string") out.push(doc);
    for (const v of Object.values(doc)) collectContainers(v, out);
  }
  return out;
}

/** One rendered/read manifest -> its containers' probe summaries. Non-pod-template kinds (Service, ConfigMap, …) yield []. */
export function summarizeDoc(app: string, doc: unknown): ContainerProbeSummary[] {
  if (!isRecord(doc)) return [];
  const kind = typeof doc.kind === "string" ? doc.kind : "";
  const metadata = isRecord(doc.metadata) ? doc.metadata : {};
  const resource = typeof metadata.name === "string" ? metadata.name : "";
  const namespace = typeof metadata.namespace === "string" ? metadata.namespace : "";
  if (kind === "" || resource === "") return [];
  return collectContainers(doc).map((c) => ({
    app,
    kind,
    resource,
    namespace,
    container: typeof c.name === "string" ? c.name : "",
    hasLiveness: c.livenessProbe !== undefined,
    hasReadiness: c.readinessProbe !== undefined,
    hasStartup: c.startupProbe !== undefined,
    killBudgetSeconds: probeKillBudgetSeconds(c.livenessProbe),
  }));
}

// ── Classification ────────────────────────────────────────────────────────────

/** Below this, a livenessProbe with no startupProbe is flagged. Matches the WP15 default. */
export const DEFAULT_KILL_BUDGET_THRESHOLD_SECONDS = 120;

export function needsStartupProbe(
  c: ContainerProbeSummary,
  thresholdSeconds = DEFAULT_KILL_BUDGET_THRESHOLD_SECONDS,
): boolean {
  return c.hasLiveness && !c.hasStartup && c.killBudgetSeconds !== null && c.killBudgetSeconds < thresholdSeconds;
}

export interface AllowlistEntry {
  readonly app: string;
  /** Container name, or `"*"` for every container in `app`. */
  readonly container: string;
  readonly reason: string;
}

/**
 * REASONED EXCEPTIONS ONLY. Every entry names a container this audit would
 * otherwise flag, and says WHY its short kill budget is not a first-boot
 * crash-loop risk (a genuinely fast starter, a probe that is intentionally
 * strict because a wedged process must die quickly, etc.) -- never "reviewed,
 * looks fine". An entry that stops matching anything (the container's budget
 * moved above the threshold, or it grew a startupProbe) is dead weight, not a
 * defect; `auditIsClean`-style tooling elsewhere in this tree treats an unused
 * acknowledgement as a finding, this module does not yet and that is a known
 * gap rather than a claim of cleanliness.
 */
/**
 * WP15's own first catalog-wide run (2026-09-22, `--report`, 217 containers / 49
 * Applications) found 45 containers matching this shape beyond the one PR #17505
 * actually measured (hindsight `api`). Fixing all 45 was out of that WP's bounded
 * scope -- per-container remediation needs chart-specific research (does THIS
 * chart expose a `startupProbe` key? which `*.livenessProbe` fields does it
 * accept?) that a single audit pass cannot answer for 30 unrelated Applications at
 * once. Grandfathered here rather than left as a permanently-red gate on day one
 * -- same reasoning `ratchet-app-failures.ts`'s header gives for why a lane that
 * is always red is one people learn to skim -- and tracked in one place so the
 * grandfathering itself stays visible and finite.
 */
/**
 * WP18 (this pass, 2026-09-22) ranked the 45-container WP15 set against CI evidence --
 * per-container restart counts and "Liveness probe failed"/"Killing" events extracted
 * from 5 recent kind-included-lane runs (35713533700, 35709838861, 35707656488,
 * 35703810167, 35703051689) plus one first-boot-replica run (35700790207, real k3s
 * roster). 17 containers with either a direct restart hit or a known-slow-starter
 * classification (JVM/DB/migration-on-start) AND a values coordinate were fixed and
 * dropped from this allowlist -- see the individual Application.yaml comments in
 * cockroachdb/, keda/, loki/, mimir/, orleans/, argo-rollouts/, kube-prometheus-stack/
 * and gitlab/ for the per-chart evidence and the coordinate each one used.
 *
 * The containers below are what remains, split two ways:
 */
const WP18_NO_COORDINATE_REASON =
  "ranked (a)/(b) at WP18's 2026-09-22 pass but NOT fixed: the chart hardcodes this " +
  "probe's timing with no values coordinate at all (verified by extracting the chart -- " +
  "no toYaml/.Values reference on the relevant fields) -- same shape as hindsight's own " +
  "postgresql row below. Upstream chart PR is the only route; " +
  "tracked in workitems/081M348H97G087G0R0020EA0NY-fix-remaining-livenessprobe-kill-budget-risks-flagged-by-liv.md";

const WP18_RANK_C_REASON =
  "ranked (c) at WP18's 2026-09-22 pass -- fast controller/webhook/exporter/binary, " +
  "not a JVM/DB/migration-on-start shape, and NOT observed restarting in the 5 " +
  "kind-included-lane CI runs examined 2026-09-22 (35713533700, 35709838861, 35707656488, " +
  "35703810167, 35703051689) despite that lane deploying its full catalog including this " +
  "container. Still un-individually-vetted, so still allowlisted rather than assumed safe; " +
  "tracked in workitems/081M348H97G087G0R0020EA0NY-fix-remaining-livenessprobe-kill-budget-risks-flagged-by-liv.md";

export const KILL_BUDGET_ALLOWLIST: readonly AllowlistEntry[] = [
  { app: "argocd", container: "repo-server", reason: WP18_RANK_C_REASON },
  { app: "argocd", container: "server", reason: WP18_RANK_C_REASON },
  { app: "cdi", container: "cdi-operator", reason: WP18_RANK_C_REASON },
  { app: "cert-manager", container: "cert-manager-controller", reason: WP18_RANK_C_REASON },
  { app: "cert-manager", container: "cert-manager-webhook", reason: WP18_RANK_C_REASON },
  { app: "cilium", container: "cilium-operator", reason: WP18_RANK_C_REASON },
  { app: "cilium", container: "frontend", reason: WP18_RANK_C_REASON },
  // gitlab-exporter: hardcoded `exec: [pgrep, -f, gitlab-exporter]` liveness in
  // charts/gitlab-exporter/templates/deployment.yaml -- no toYaml, no .Values
  // reference on initialDelaySeconds/periodSeconds/failureThreshold at all.
  { app: "gitlab", container: "gitlab-exporter", reason: WP18_NO_COORDINATE_REASON },
  // kas: charts/kas/templates/deployment.yaml hardcodes
  // `initialDelaySeconds: 15, periodSeconds: 20` with no .Values reference on
  // either field (only the httpGet path/port route through Values).
  { app: "gitlab", container: "kas", reason: WP18_NO_COORDINATE_REASON },
  { app: "hat-system", container: "operator", reason: WP18_RANK_C_REASON },
  { app: "headlamp", container: "headlamp", reason: WP18_RANK_C_REASON },
  { app: "headscale", container: "headscale", reason: WP18_RANK_C_REASON },
  // hindsight/postgresql: NOT a values-coordinate gap like the others in this
  // list -- the chart hardcodes this probe (see Application.yaml's own comment
  // on `controlPlane.livenessProbe`), so there is no valuesObject fix at all,
  // only an upstream chart PR. Left in the shared workitem rather than split out.
  { app: "hindsight", container: "postgresql", reason: WP18_NO_COORDINATE_REASON },
  { app: "kube-prometheus-stack", container: "kube-prometheus-stack", reason: WP18_RANK_C_REASON },
  { app: "kube-prometheus-stack", container: "node-exporter", reason: WP18_RANK_C_REASON },
  { app: "kubevirt", container: "virt-operator", reason: WP18_RANK_C_REASON },
  { app: "node-feature-discovery", container: "gc", reason: WP18_RANK_C_REASON },
  { app: "node-feature-discovery", container: "worker", reason: WP18_RANK_C_REASON },
  { app: "ollama", container: "ollama", reason: WP18_RANK_C_REASON },
  // Covers BOTH gatekeeper-audit and gatekeeper-controller-manager Deployments --
  // both containers are literally named "manager" and share the same shape.
  { app: "open-policy-agent", container: "manager", reason: WP18_RANK_C_REASON },
  { app: "sealed-secrets", container: "controller", reason: WP18_RANK_C_REASON },
  { app: "spire", container: "node-driver-registrar", reason: WP18_RANK_C_REASON },
  // spire-controller-manager: DIRECTLY OBSERVED restarting (restartCount 2, pod
  // spire-server-0) in CI run 35707656488 -- but charts/spire-server/templates/
  // _controller-manager-container.tpl hardcodes this container's livenessProbe with
  // NO .Values reference on any field (httpGet path/port are the only templated
  // parts). Unlike its sibling spire-server container below (which DOES have a
  // `.Values.livenessProbe` coordinate), there is nothing to widen here.
  { app: "spire", container: "spire-controller-manager", reason: WP18_NO_COORDINATE_REASON },
  // spire-server: has a values coordinate (`.Values.livenessProbe`) but was not
  // itself observed restarting in the evidence sweep -- only its sidecar
  // (spire-controller-manager, above) was. Left un-widened rather than
  // speculatively fixed without a measured symptom.
  { app: "spire", container: "spire-server", reason: WP18_RANK_C_REASON },
  { app: "tempo", container: "tempo", reason: WP18_RANK_C_REASON },
  // admin-tools: charts/temporal/templates/admintools-deployment.yaml hardcodes
  // `exec: [ls, /], initialDelaySeconds: 5, periodSeconds: 5` -- no .Values
  // reference anywhere on this probe.
  { app: "temporal", container: "admin-tools", reason: WP18_NO_COORDINATE_REASON },
  // temporal-web: charts/temporal/templates/web-deployment.yaml hardcodes
  // `tcpSocket: {port: http}, initialDelaySeconds: 10` -- no .Values reference on
  // this probe either (temporal-frontend/history/matching, already `ok` at 170s in
  // the same chart, prove the chart CAN expose a coordinate elsewhere; it simply
  // does not here).
  { app: "temporal", container: "temporal-web", reason: WP18_NO_COORDINATE_REASON },
];

function isAllowlisted(c: ContainerProbeSummary): AllowlistEntry | null {
  for (const entry of KILL_BUDGET_ALLOWLIST) {
    if (entry.app === c.app && (entry.container === "*" || entry.container === c.container)) return entry;
  }
  return null;
}

/** Substring match against the app name, for the audit table's "known slow starter" marker only -- NEVER read by `needsStartupProbe` or the allowlist. Informational triage aid, not a gate input. */
const KNOWN_SLOW_STARTERS = [
  "opensearch",
  "cockroachdb",
  "temporal",
  "gitlab",
  "mimir",
  "weaviate",
  "loki",
  "keycloak",
  "orleans", // JVM-adjacent .NET cluster membership warmup; grouped with the JVM starters by symptom, not by runtime
];

function isKnownSlowStarter(app: string): boolean {
  const lower = app.toLowerCase();
  return KNOWN_SLOW_STARTERS.some((needle) => lower.includes(needle));
}

// ── Rendering (Helm) ──────────────────────────────────────────────────────────

function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "/") start++;
  while (end > start && value[end - 1] === "/") end--;
  return value.slice(start, end);
}

function isOciRepo(repoURL: string): boolean {
  return !repoURL.includes("://");
}

function helmOnPath(): boolean {
  return Bun.spawnSync(["sh", "-c", "command -v helm"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
}

interface RawRenderResult {
  readonly ok: boolean;
  readonly docs: readonly unknown[];
  readonly error?: string;
}

/** Full (unnarrowed) rendered documents for a Helm-sourced Application — this module needs the whole pod spec, not `RenderedDoc`'s summary fields. */
function renderHelmRaw(source: AppSource): RawRenderResult {
  const chart = source.chart ?? "";
  const version = source.version ?? "";
  const repoURL = source.repoURL ?? "";
  const releaseName = source.releaseName ?? chart;
  const namespace = source.namespace ?? "default";
  const tmp = join(
    Bun.env.TMPDIR ?? Bun.env.TEMP ?? REPO_ROOT,
    `.liveness-kill-budget-values-${Math.random().toString(36).slice(2)}.yaml`,
  );
  writeFileSync(tmp, stringifyYaml(source.valuesObject ?? {}), "utf8");
  try {
    const chartArgs = isOciRepo(repoURL) ? [`oci://${trimSlashes(repoURL)}/${chart}`] : [chart, "--repo", repoURL];
    const result = Bun.spawnSync(
      ["helm", "template", releaseName, ...chartArgs, "--version", version, "--namespace", namespace, "--values", tmp],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (result.exitCode !== 0) {
      return { ok: false, docs: [], error: result.stderr.toString().split("\n").slice(0, 3).join(" ").trim() };
    }
    const docs: unknown[] = [];
    for (const doc of parseAllDocuments(result.stdout.toString())) {
      try {
        docs.push(doc.toJS({ maxAliasCount: -1 }));
      } catch {
        // one malformed document does not invalidate the render's other documents
      }
    }
    return { ok: true, docs };
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort scratch cleanup
    }
  }
}

/** Every `*.yaml`/`*.yml` under `dir`, recursively, `Application.yaml` excluded. */
function listManifestYamls(dir: string): string[] {
  let entries: { name: string; isDir: boolean }[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const { name, isDir } of entries) {
    const full = join(dir, name);
    if (isDir) out.push(...listManifestYamls(full));
    else if ((name.endsWith(".yaml") || name.endsWith(".yml")) && name !== "Application.yaml") out.push(full);
  }
  return out.sort();
}

/** Directory-sourced Application: read straight off disk, no render. */
function readDirectoryRaw(source: AppSource): RawRenderResult {
  const path = source.path ?? "";
  if (path === "") return { ok: false, docs: [], error: "no spec.source.path" };
  const abs = resolve(REPO_ROOT, path);
  const docs: unknown[] = [];
  for (const file of listManifestYamls(abs)) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const doc of parseAllDocuments(text)) {
      try {
        docs.push(doc.toJS({ maxAliasCount: -1 }));
      } catch {
        // one malformed document does not invalidate the rest of the file
      }
    }
  }
  return { ok: true, docs };
}

export interface AuditResult {
  readonly containers: readonly ContainerProbeSummary[];
  readonly renderErrors: readonly { readonly app: string; readonly error: string }[];
}

/** Render/read every shipped Application and summarize every container's probes. Requires `helm` on PATH for Helm-sourced Applications. */
export function auditCatalog(apps: readonly ShippedApplication[], repoRoot = REPO_ROOT): AuditResult {
  const containers: ContainerProbeSummary[] = [];
  const renderErrors: { app: string; error: string }[] = [];
  const helmAvailable = helmOnPath();
  for (const app of apps) {
    const text = readFileSync(resolve(repoRoot, app.path), "utf8");
    const source = readAppSource(text);
    let raw: RawRenderResult;
    if (source.kind === "helm") {
      if (!helmAvailable) {
        renderErrors.push({ app: app.name, error: "helm not on PATH" });
        continue;
      }
      raw = renderHelmRaw(source);
    } else if (source.kind === "directory") {
      raw = readDirectoryRaw(source);
    } else {
      continue; // no source this module knows how to read
    }
    if (!raw.ok) {
      renderErrors.push({ app: app.name, error: raw.error ?? "render failed" });
      continue;
    }
    for (const doc of raw.docs) containers.push(...summarizeDoc(app.name, doc));
  }
  return { containers, renderErrors };
}

// ── Reporting ──────────────────────────────────────────────────────────────────

export function formatTable(result: AuditResult, thresholdSeconds = DEFAULT_KILL_BUDGET_THRESHOLD_SECONDS): string {
  const lines: string[] = [];
  lines.push(
    `| app | kind/resource | container | liveness | readiness | startup | kill budget | flag |`,
    `|---|---|---|---|---|---|---|---|`,
  );
  const sorted = [...result.containers].sort(
    (a, b) => compareOrdinal(a.app, b.app) || compareOrdinal(a.container, b.container),
  );
  for (const c of sorted) {
    const flagged = needsStartupProbe(c, thresholdSeconds);
    const allow = isAllowlisted(c);
    const marker = flagged ? (allow !== null ? `ALLOWLISTED (${allow.reason})` : "FLAG") : "ok";
    const slow = isKnownSlowStarter(c.app) ? " ★" : "";
    lines.push(
      `| ${c.app}${slow} | ${c.kind}/${c.resource} | ${c.container} | ${String(c.hasLiveness)} | ` +
        `${String(c.hasReadiness)} | ${String(c.hasStartup)} | ${c.killBudgetSeconds ?? "n/a"}s | ${marker} |`,
    );
  }
  if (result.renderErrors.length > 0) {
    lines.push("", "Render errors (excluded from the table above):");
    for (const e of result.renderErrors) lines.push(`- ${e.app}: ${e.error}`);
  }
  lines.push("", "★ = known slow starter (informational only; the flag column applies uniformly to every container).");
  return lines.join("\n");
}

export function unacknowledgedFindings(
  result: AuditResult,
  thresholdSeconds = DEFAULT_KILL_BUDGET_THRESHOLD_SECONDS,
): readonly ContainerProbeSummary[] {
  return result.containers.filter((c) => needsStartupProbe(c, thresholdSeconds) && isAllowlisted(c) === null);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main(): number {
  const { values: args } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      report: { type: "boolean", default: false }, // print the table, never gate (for the PR-body audit table)
      threshold: { type: "string", default: String(DEFAULT_KILL_BUDGET_THRESHOLD_SECONDS) },
    },
    strict: true,
  });
  const threshold = Number.parseInt(args.threshold, 10);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    console.error(`liveness-kill-budget: --threshold must be a positive integer, got '${args.threshold}'`);
    return 2;
  }
  if (!helmOnPath()) {
    console.error("liveness-kill-budget: helm is not on PATH (MISE_ENV=full provides it) — refusing rather than silently skipping Helm-sourced Applications");
    return 2;
  }

  const apps = readShippedApplications();
  const result = auditCatalog(apps);
  console.log(formatTable(result, threshold));

  const findings = unacknowledgedFindings(result, threshold);
  console.log(
    `\n[liveness-kill-budget] ${String(result.containers.length)} containers examined across ${String(apps.length)} Applications; ` +
      `${String(findings.length)} unacknowledged container(s) have a livenessProbe, no startupProbe, and a kill budget under ${String(threshold)}s.`,
  );
  if (args.report) return 0; // report-only: never gates, for generating the PR-body table
  if (findings.length > 0) {
    for (const f of findings) {
      console.log(`  FLAG: ${f.app} ${f.kind}/${f.resource} container=${f.container} killBudget=${String(f.killBudgetSeconds)}s`);
    }
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
