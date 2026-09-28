/**
 * src/Core.TypeScript/cluster/gitlab-upgrade-path-guard.ts
 *
 * DOES THIS PR MOVE GITLAB ALONG ITS REQUIRED UPGRADE PATH?
 *
 * The gitlab chart ships its own guard: a `pre-upgrade` hook Job that runs
 * `templates/_runcheck.tpl` against the previous release's `<release>-chart-info`
 * ConfigMap and refuses an upgrade that skips a GitLab required stop. Under ArgoCD
 * that hook deadlocks the FIRST sync (PreSync runs before chart-info exists), so
 * `full-ai-cluster/k8s/applications/gitlab/Application.yaml` sets
 * `upgradeCheck.enabled: false` -- see `upgrade-only-hook-first-sync.ts`.
 *
 * In GitOps an upgrade only ever happens through a PR that changes the
 * Application's chart pin (or `global.gitlabVersion`), so the check moves here,
 * to the PR, and runs the chart's OWN script rather than a reimplementation of
 * GitLab's upgrade-stop table:
 *
 *   1. read the Application at the PR base and at HEAD;
 *   2. pin unchanged (or the Application absent on either side) -> NOT APPLICABLE;
 *   3. otherwise render the OLD pin's chart-info (exactly what the cluster holds
 *      after the last sync) and the NEW pin's upgrade-check ConfigMap + Job env
 *      (`upgradeCheck.enabled` forced on), then execute the new `runcheck`
 *      offline with a synthetic `/chart-info` holding the old values. Its exit
 *      status is the verdict and its stdout is the failure message.
 *   4. a DOWNGRADE fails too. MEASURED 2026-09-27: the chart's script does not
 *      refuse one (8.6.0's runcheck only asks that the old release be >= 17.5,
 *      which a 17.7 release satisfies), so this is the one comparison the guard
 *      makes itself -- a plain version order, not an upgrade-path table.
 *
 * Three states, printed distinctly: PASSED / FAILED / NOT APPLICABLE. Exit 1 only
 * on FAILED; exit 2 when the guard could not run (render failure) -- a check that
 * did not run is not a pass.
 *
 * HONEST LIMITS: the script only knows what its chart release knows (one
 * minimum-previous-version per chart), so it is exactly as strong as the in-cluster
 * hook it replaces -- no stronger. Per-component image-tag overrides are not read;
 * only `global.gitlabVersion` / the chart appVersion, which is also all the hook
 * reads. The PostgreSQL-secrets branch of the script is not exercised (the
 * secrets dir is pointed at a path that does not exist).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { readAppSource } from "./crd-provider-consumer-order.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const GITLAB_APPLICATION_PATH = "full-ai-cluster/k8s/applications/gitlab/Application.yaml";

export interface GitlabPin {
  readonly repoURL: string;
  readonly chart: string;
  readonly version: string;
  readonly releaseName: string;
  readonly namespace: string;
  readonly valuesObject: Record<string, unknown>;
  /** `global.gitlabVersion` when the Application pins it; otherwise the chart appVersion applies. */
  readonly gitlabVersion: string | null;
}

export type GuardState = "passed" | "failed" | "not-applicable";

export interface Verdict {
  readonly state: GuardState;
  readonly detail: string;
}

export interface UpgradeCheckRender {
  /** The `runcheck` script the upgrade-check Job executes. */
  readonly runcheck: string;
  /** The Job container's env (GITLAB_VERSION, CHART_VERSION). */
  readonly env: Record<string, string>;
  /** What this release's `<release>-chart-info` ConfigMap holds. */
  readonly chartInfo: Record<string, string>;
}

export type Renderer = (pin: GitlabPin) => UpgradeCheckRender;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readGitlabPin(applicationYamlText: string | null): GitlabPin | null {
  if (applicationYamlText === null) return null;
  const source = readAppSource(applicationYamlText);
  if (source.kind !== "helm") return null;
  const values = isRecord(source.valuesObject) ? source.valuesObject : {};
  const global = isRecord(values.global) ? values.global : {};
  const pinned = global.gitlabVersion;
  return {
    repoURL: source.repoURL ?? "",
    chart: source.chart ?? "",
    version: source.version ?? "",
    releaseName: source.releaseName ?? source.chart ?? "",
    namespace: source.namespace ?? "default",
    valuesObject: values,
    gitlabVersion: typeof pinned === "string" || typeof pinned === "number" ? String(pinned) : null,
  };
}

export function pinsDiffer(base: GitlabPin | null, head: GitlabPin | null): boolean {
  if (base === null || head === null) return false;
  return (
    base.repoURL !== head.repoURL ||
    base.chart !== head.chart ||
    base.version !== head.version ||
    base.gitlabVersion !== head.gitlabVersion
  );
}

/** Numeric dotted-version order; a leading `v` and any `-suffix` are ignored. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parts = (v: string) =>
    v
      .trim()
      .replace(/^v/, "")
      .split("-")[0]!
      .split(".")
      .map((p) => Number.parseInt(p, 10) || 0);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Render (helm) -- chart archives cached in <repo>/.helm-render-cache, the same
// convention rendered-storage-claims.ts uses.
// ---------------------------------------------------------------------------

function helm(args: string[]): string {
  return execFileSync("helm", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

function chartArchive(pin: GitlabPin, cacheDir: string): string {
  const archive = join(cacheDir, `${pin.chart}-${pin.version}`.replace(/[^A-Za-z0-9._-]/g, "_") + ".tgz");
  try {
    if (statSync(archive).size > 0) return archive;
  } catch {
    // not cached -- pull below
  }
  const scratch = mkdtempSync(join(cacheDir, "pull-gitlab-upgrade-path-"));
  try {
    helm(["pull", "--repo", pin.repoURL, pin.chart, "--version", pin.version, "--destination", scratch]);
    const produced = readdirSync(scratch).filter((f) => f.endsWith(".tgz"));
    if (produced.length !== 1) throw new Error(`helm pull ${pin.chart}@${pin.version} left ${produced.length} archives`);
    renameSync(join(scratch, produced[0]!), archive);
    return archive;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Render the pin's upgrade-check ConfigMap + Job and its chart-info ConfigMap,
 * with the Application's own values and `upgradeCheck.enabled` forced on.
 */
export function renderUpgradeCheck(pin: GitlabPin, cacheDir = join(REPO_ROOT, ".helm-render-cache")): UpgradeCheckRender {
  mkdirSync(cacheDir, { recursive: true });
  const archive = chartArchive(pin, cacheDir);
  const values = structuredClone(pin.valuesObject);
  values.upgradeCheck = { ...(isRecord(values.upgradeCheck) ? values.upgradeCheck : {}), enabled: true };
  const dir = mkdtempSync(join(tmpdir(), "gitlab-upgrade-path-values-"));
  try {
    const valuesFile = join(dir, "values.yaml");
    writeFileSync(valuesFile, stringifyYaml(values), "utf8");
    const out = helm([
      "template", pin.releaseName, archive, "--namespace", pin.namespace, "--values", valuesFile,
      "--show-only", "templates/upgrade_check_hook.yaml", "--show-only", "templates/chart-info.yaml",
    ]);
    const docs = parseAllDocuments(out).map((d) => d.toJS() as unknown).filter(isRecord);
    const named = (kind: string, suffix: string) =>
      docs.find((d) => d.kind === kind && isRecord(d.metadata) && String(d.metadata.name).endsWith(suffix));
    const scripts = named("ConfigMap", "-upgrade-check");
    const job = named("Job", "-upgrade-check");
    const info = named("ConfigMap", "-chart-info");
    if (!isRecord(scripts?.data) || typeof scripts.data.runcheck !== "string") throw new Error("render has no upgrade-check runcheck script");
    if (!isRecord(info?.data)) throw new Error("render has no chart-info ConfigMap");
    const containers = (job as any)?.spec?.template?.spec?.containers;
    if (!Array.isArray(containers) || containers.length === 0) throw new Error("render has no upgrade-check Job container");
    const env: Record<string, string> = {};
    for (const e of containers[0].env ?? []) if (typeof e?.name === "string" && typeof e?.value === "string") env[e.name] = e.value;
    const chartInfo: Record<string, string> = {};
    for (const [k, v] of Object.entries(info.data)) chartInfo[k] = String(v);
    return { runcheck: scripts.data.runcheck, env, chartInfo };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Execute the chart's `runcheck` offline, as the in-cluster Job would see it:
 * `/chart-info` holds `chartInfo` (or is empty when null -- a first install),
 * `/etc/secrets/postgresql` does not exist, `/dev/termination-log` is a temp file.
 */
export function runRuncheckOffline(
  runcheck: string,
  env: Record<string, string>,
  chartInfo: Record<string, string> | null,
): { exitCode: number; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), "gitlab-runcheck-"));
  try {
    const posix = (p: string) => p.replaceAll("\\", "/");
    const chartInfoDir = join(dir, "chart-info");
    mkdirSync(chartInfoDir);
    for (const [key, value] of Object.entries(chartInfo ?? {})) writeFileSync(join(chartInfoDir, key), value, "utf8");
    const script = runcheck
      .replaceAll("/chart-info/", `${posix(chartInfoDir)}/`)
      .replaceAll("/etc/secrets/postgresql", posix(join(dir, "no-postgresql-secret")))
      .replaceAll("/dev/termination-log", posix(join(dir, "termination-log")));
    const scriptPath = join(dir, "runcheck");
    writeFileSync(scriptPath, script, "utf8");
    const run = Bun.spawnSync(["sh", posix(scriptPath)], { stdout: "pipe", stderr: "pipe", env: { ...process.env, ...env } });
    return { exitCode: run.exitCode, stdout: run.stdout.toString() + run.stderr.toString() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export function evaluateUpgrade(
  baseText: string | null,
  headText: string | null,
  options: { render?: Renderer } = {},
): Verdict {
  const base = readGitlabPin(baseText);
  const head = readGitlabPin(headText);
  if (base === null) return { state: "not-applicable", detail: "no Helm-sourced gitlab Application at the base -- a first install, not an upgrade" };
  if (head === null) return { state: "not-applicable", detail: "no Helm-sourced gitlab Application at HEAD -- nothing is being upgraded" };
  if (!pinsDiffer(base, head)) {
    return { state: "not-applicable", detail: `chart pin unchanged (${head.chart}@${head.version}, global.gitlabVersion ${head.gitlabVersion ?? "unset"})` };
  }
  const render = options.render ?? ((pin: GitlabPin) => renderUpgradeCheck(pin));
  const old = render(base);
  const next = render(head);
  const from = `chart ${old.chartInfo.gitlabChartVersion} (GitLab ${old.chartInfo.gitlabVersion})`;
  const to = `chart ${next.env.CHART_VERSION} (GitLab ${next.env.GITLAB_VERSION})`;

  if (
    compareVersions(next.env.CHART_VERSION ?? "", old.chartInfo.gitlabChartVersion ?? "") < 0 ||
    compareVersions(next.env.GITLAB_VERSION ?? "", old.chartInfo.gitlabVersion ?? "") < 0
  ) {
    return { state: "failed", detail: `${from} -> ${to} is a downgrade; GitLab does not support downgrading an installed release` };
  }
  const run = runRuncheckOffline(next.runcheck, next.env, old.chartInfo);
  if (run.exitCode === 0) return { state: "passed", detail: `${from} -> ${to}: the new chart's own upgrade check accepts it` };
  return { state: "failed", detail: `${from} -> ${to}: the new chart's own upgrade check refused it (exit ${run.exitCode}):\n${run.stdout.trim()}` };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

export function main(argv: string[] = process.argv.slice(2)): number {
  let base: string | null = null;
  let path = GITLAB_APPLICATION_PATH;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") base = argv[++i] ?? null;
    else if (argv[i] === "--path") path = argv[++i] ?? path;
    else {
      console.error(`usage: gitlab-upgrade-path-guard.ts [--base <rev>] [--path <Application.yaml>] (unknown: ${argv[i]})`);
      return 2;
    }
  }
  base ??= git(["merge-base", "HEAD", "origin/main"])?.trim() ?? null;
  if (base === null || base === "") {
    console.error("gitlab-upgrade-path-guard: could not resolve a base revision (pass --base) -- DID NOT RUN");
    return 2;
  }
  const baseText = git(["show", `${base}:${path}`]);
  const headText = git(["show", `HEAD:${path}`]);
  let verdict: Verdict;
  try {
    verdict = evaluateUpgrade(baseText, headText);
  } catch (error) {
    console.error(`gitlab-upgrade-path-guard: DID NOT RUN -- ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const label = verdict.state === "passed" ? "PASSED" : verdict.state === "failed" ? "FAILED" : "NOT APPLICABLE";
  console.log(`gitlab upgrade path (${path}, base ${base.slice(0, 12)}): ${label}\n  ${verdict.detail.replaceAll("\n", "\n  ")}`);
  return verdict.state === "failed" ? 1 : 0;
}

if (import.meta.main) process.exit(main());
