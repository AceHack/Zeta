#!/usr/bin/env bun
/**
 * chart-assertion-census.ts -- per chart: is it asserted, and CAN THAT ASSERTION FAIL?
 *
 * -- THE QUESTION THIS ANSWERS ----------------------------------------------
 * "How many charts are green" is the easy half and the misleading one. The half
 * that decides whether green means anything is: does something assert it, and is
 * that assertion capable of failing? A chart nobody asserts is untested however
 * green it looks. An assertion that cannot fail is WORSE, because it reads as
 * coverage.
 *
 * -- WHY THE SECOND HALF IS NOT OBVIOUS -------------------------------------
 * ArgoCD assesses health PER RESOURCE KIND, and it has no health check for most
 * kinds. A Namespace, a ConfigMap, a Secret, a ServiceAccount, an RBAC object, a
 * CRD, a Gatekeeper Constraint -- none of them contribute anything to an
 * Application's health verdict. So an Application whose ENTIRE committed
 * resource set is health-less reports `Healthy` with the same confidence whether
 * its resources were applied or not.
 *
 * That is not hypothetical here. MEASURED 2026-09-09 over the committed
 * manifests:
 *
 *   deepseek-coder   2 resources, 2 health-less  -- ASSERTED under the full contract
 *   qwen-coder       1 resource,  1 health-less  -- ASSERTED under the full contract
 *   cilium-lb-ipam   2 resources, 2 health-less  -- not applied on kind
 *   ddns             1 resource,  1 health-less  -- no Application at all
 *
 * `deepseek-coder` and `qwen-coder` are counted inside the lane's 37/37. They
 * were LIFTED into the asserted set on the reasoning that they "render exactly
 * one Namespace + one ConfigMap between them" -- which is the correct reason to
 * apply them and, unremarked, the exact reason their `Healthy` verdict carries no
 * information.
 *
 * STATED PRECISELY, because the overclaim is tempting: this does NOT say those
 * two are asserted by nothing. `Synced` is still a real signal, and
 * `failedSyncMessage` refuses an app carrying ArgoCD's own `SyncError` condition.
 * What it says is that the HEALTH half of `Synced+Healthy` is empty for them, so
 * the whole assertion rests on the sync half plus a condition check that landed
 * on 2026-09-09 and has one day of evidence behind it. Counting them beside
 * `cockroachdb` in one "37/37" hides that difference.
 *
 * The same blindness is what let `hat-system` pass with all seven Hat Constraints
 * unapplied (081M241X2YQ087G0R001K95PAB): 30 of its 32 committed resources are
 * health-less, so its Deployment being up said almost nothing about the rest.
 *
 * -- THE SECOND REFUSAL: A CHART THAT BELONGS TO NO JOB ---------------------
 * Nine directories are excluded from the dev root's glob, so no lane applies
 * them. Their reasons live in prose inside `ports.ts` -- readable, but not
 * machine-checkable, and saying nothing about whether ANOTHER job covers them.
 * `cilium` and `cilium-lb-ipam` are covered (the Cilium CNI leg and the k3d leg
 * bootstrap Cilium directly); the other seven are covered by nothing live and
 * that fact was not written down anywhere a check could read.
 *
 * So every never-applied directory must carry a registry entry naming its
 * covering job or stating that it has none. The registry is checked THREE ways,
 * because an excuse that outlives its defect is how a registry becomes a lie: a
 * new never-applied directory with no entry FAILS; an entry for a directory a lane
 * now applies fails as STALE; and an entry naming a directory the tree no longer
 * has fails as an ORPHAN. That third one was written and never falsified until
 * 2026-09-09 -- see the test file, which explains why the fix was to USE the
 * flagged import rather than delete it.
 *
 * -- ONE STATED LIMIT, so it is not mistaken for coverage ------------------
 * The census keys on Application DIRECTORIES, so a directory carrying manifests
 * and NO `Application.yaml` is invisible to it. There is exactly one today:
 * `full-ai-cluster/k8s/applications/ddns`, a lone CronJob. No lane applies it,
 * nothing asserts it, and this file does not report it -- which is recorded here
 * rather than quietly fixed, because widening the key would change what every
 * other row means.
 *
 * Run:   bun src/Core.TypeScript/cluster/chart-assertion-census.ts [--markdown]
 * Exit:  0 -- every chart is accounted for
 *        1 -- an unregistered gap, a stale entry, or an empty census
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";
import { discoverExpectedApplications } from "./argocd-health-test.ts";
import { applicationDirs, devLaneAppliedDirs } from "./storage-profiles.ts";
import { stringCompare } from "../collation/collation.ts";

/** Where the Application directories live. */
export const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

/**
 * Kinds ArgoCD assigns a HEALTH verdict to, out of the box.
 *
 * Deliberately CONSERVATIVE -- every kind not listed is treated as health-less,
 * so an unfamiliar CRD counts against an app rather than for it. The error this
 * biases toward is over-reporting blindness, which prompts a look; the opposite
 * bias would quietly certify coverage that does not exist.
 *
 * `Service` is absent on purpose: ArgoCD assesses health for a `LoadBalancer`
 * Service only, and the overwhelming majority in this tree are ClusterIP.
 */
export const HEALTH_BEARING_KINDS = new Set([
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Pod",
  "Job",
  "Ingress",
  "PersistentVolumeClaim",
  "APIService",
]);

/** What a never-applied directory is covered by, or the statement that it is not. */
export interface NoLaneCoverage {
  /** The job that DOES exercise it, or null when nothing does. */
  readonly coveredBy: string | null;
  readonly reason: string;
}

/**
 * Every directory the dev root's `excludeGlob` keeps out of every cluster, with
 * what covers it instead. Checked both ways -- see the header.
 *
 * MEASURED 2026-09-09 against `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`: nine dirs,
 * two covered, seven not.
 */
export const NEVER_APPLIED_COVERAGE = new Map<string, NoLaneCoverage>();

NEVER_APPLIED_COVERAGE.set("cilium", {
  coveredBy: "live kind Cilium CNI + live k3d ArgoCD health",
  reason:
    "both legs bootstrap Cilium DIRECTLY rather than through ArgoCD, so the chart is exercised where it owns the CNI slot; the kindnetd leg must not assert it",
});

NEVER_APPLIED_COVERAGE.set("cilium-lb-ipam", {
  coveredBy: "live kind Cilium CNI + live k3d ArgoCD health",
  reason:
    "the kind lane substitutes dev-cluster/manifests/cilium-lb-ipam.kind.yaml; the Application itself is exercised only where Cilium owns the CNI slot",
});

NEVER_APPLIED_COVERAGE.set("longhorn", {
  coveredBy: null,
  reason:
    "a kind node has no second disk to give it. The dev lane substitutes a StorageClass NAMED longhorn over rancher.io/local-path, so PVCs bind and the CONSUMERS are asserted -- the chart itself is not, and no job renders or applies it",
});

NEVER_APPLIED_COVERAGE.set("ollama", {
  coveredBy: null,
  reason: "GPU model-serving; no CI runner has a GPU, and the local-models phase is deferred",
});

NEVER_APPLIED_COVERAGE.set("vllm", {
  coveredBy: null,
  reason: "GPU model-serving, same as ollama",
});

NEVER_APPLIED_COVERAGE.set("gitlab", {
  coveredBy: null,
  reason:
    "20 images and the largest single footprint in the catalogue; excluded on lane cost. Aaron 2026-09-06 retired the either/or posture with forgejo, so this is a COST deferral and not a design one -- forgejo is asserted and gitlab is not",
});

NEVER_APPLIED_COVERAGE.set("temporal", {
  coveredBy: null,
  reason: "excluded on lane cost; nothing renders or applies it in CI",
});

NEVER_APPLIED_COVERAGE.set("platform", {
  coveredBy: null,
  reason:
    "33 committed resources, 31 of them health-less (7 CRDs plus RBAC, gateway and policy objects). The largest unasserted surface in the tree, and the one where an Application-level verdict would have said least even if it were applied",
});

NEVER_APPLIED_COVERAGE.set("game-hosting/gmod", {
  coveredBy: null,
  reason:
    "2048Mi of a 9216Mi dev budget -- 18% -- to prove a Source-engine server loads a map and idles. Its own manifest calls it a sample workload, not on the PoC critical path",
});

/**
 * Applications asserted under the FULL `Synced+Healthy` contract whose committed
 * resources are ALL health-less -- so the `Healthy` half of that contract carries
 * no information about them.
 *
 * Registered rather than excluded, deliberately. Neither of these should stop
 * being applied: applying them proves the manifests still parse and reconcile,
 * which is real. What is recorded here is that they must not be READ as the same
 * kind of evidence as an app with a workload behind it.
 */
export const HEALTH_BLIND_ASSERTED_REASONS = new Map<string, string>();

HEALTH_BLIND_ASSERTED_REASONS.set(
  "deepseek-coder",
  "one Namespace + one ConfigMap, and NOTHING CONSUMES IT. Measured 2026-09-09 across the tree: " +
    "no Deployment, no envFrom, no configMapKeyRef, no volume anywhere mounts or reads it -- every " +
    "reference is metadata ABOUT the chart (lane footprints, storage profiles, sync-wave graph, test " +
    "rosters), never a consumer. Its own Application header calls it `structural`. " +
    "AND THE HARNESS ALREADY CARRIES THE SAME TWO FACTS, from a different place: the worker reads " +
    "LLM_BASE_URL / LLM_MODEL from the ENVIRONMENT (apps/workers/src/config.ts), set as literals in " +
    "agentic-organization/deploy/k8s/30-worker.yaml. Two declarations of one pair, and THEY DISAGREE " +
    "-- the worker uses http://ollama:11434 with qwen2:0.5b, this ConfigMap says " +
    "http://ollama.ollama.svc.cluster.local:11434 with deepseek-coder:33b. The one nothing reads is " +
    "the one shipped as an ArgoCD Application. Disposition proposed: RETIRE (see the census doc); " +
    "kept here until the maintainer rules, because deleting a chart is a catalogue decision",
);

HEALTH_BLIND_ASSERTED_REASONS.set(
  "qwen-coder",
  "one ConfigMap -- not even a Namespace, which it inherits from deepseek-coder's. Same shape, same " +
    "measurement, same disposition as deepseek-coder: nothing consumes it, the harness carries the " +
    "same pair in env, and the two disagree. Note the coupling this exposes -- if deepseek-coder were " +
    "retired alone, the `models` Namespace would go with it and this chart would lose the namespace it " +
    "targets. They retire together or not at all",
);

/** How strongly a lane asserts a chart. */
export type AssertionTier =
  | "full"
  | "manual-sync"
  | "applied-unasserted"
  | "not-applied";

/** One row of the census. */
export interface CensusRow {
  readonly dir: string;
  readonly tier: AssertionTier;
  /** Committed resources ArgoCD assigns a health verdict to. */
  readonly healthBearing: number;
  /** Committed resources it does not. */
  readonly healthBlind: number;
  /** For a helm-chart Application the resources are not in the tree at all. */
  readonly resourcesInTree: boolean;
  /** Only meaningful for `not-applied`. */
  readonly coveredBy: string | null;
  /** The post-deploy functional assertion that exercises it, or null. */
  readonly functional: string | null;
}

/** Every committed `.yaml` under an Application directory, except its Application.yaml. */
function manifestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...manifestFiles(full));
    else if (entry.name === "Application.yaml") continue;
    else if (entry.name.endsWith(".yaml")) out.push(full);
  }
  return out;
}

/** The `kind` of every committed document under an Application directory. */
export function committedKinds(repoRoot: string, dir: string): string[] {
  const out: string[] = [];
  const base = join(repoRoot, APPLICATIONS_DIR, dir);
  for (const file of manifestFiles(base)) {
    for (const doc of parseAllDocuments(readFileSync(file, "utf8"))) {
      const value = doc.toJS() as { kind?: unknown } | null;
      if (value === null) continue;
      if (typeof value.kind === "string") out.push(value.kind);
    }
  }
  return out;
}

/** The census: one row per Application directory the tree carries. */
export function census(repoRoot: string): CensusRow[] {
  const applied = new Set(devLaneAppliedDirs(repoRoot));
  const expected = discoverExpectedApplications(repoRoot);
  const byDir = new Map(expected.map((app) => [app.dir, app]));
  const rows: CensusRow[] = [];
  for (const dir of applicationDirs(repoRoot)) {
    const kinds = committedKinds(repoRoot, dir);
    const healthBearing = kinds.filter((k) => HEALTH_BEARING_KINDS.has(k)).length;
    const healthBlind = kinds.length - healthBearing;
    const app = byDir.get(dir);
    let tier: AssertionTier = "not-applied";
    if (applied.has(dir)) tier = tierOfApplied(app);
    const coverage = NEVER_APPLIED_COVERAGE.get(dir);
    const coveredBy = coverage === undefined ? null : coverage.coveredBy;
    const resourcesInTree = kinds.length > 0;
    const functional = FUNCTIONAL_ASSERTIONS.get(dir) ?? null;
    rows.push({ dir, tier, healthBearing, healthBlind, resourcesInTree, coveredBy, functional });
  }
  rows.sort((a, b) => stringCompare(a.dir, b.dir));
  return rows;
}

/** An expected-application record, as much of it as the census needs. */
interface ExpectedShape {
  readonly manualSync: boolean;
  readonly excludedFromDev: boolean;
}

/** The tier of a directory the dev root DOES apply. */
export function tierOfApplied(app: ExpectedShape | undefined): AssertionTier {
  if (app === undefined) return "applied-unasserted";
  if (app.manualSync) return "manual-sync";
  if (app.excludedFromDev) return "applied-unasserted";
  return "full";
}

/**
 * Everything the census refuses. Empty array means every chart is accounted for.
 *
 * FIVE refusals, and the last one is what stops this file joining the class it
 * exists to catch.
 *
 * The two registries are INJECTABLE, defaulted to the module's own. Not for
 * flexibility -- for falsifiability. Both "the registry names a directory the
 * tree no longer has" branches read a module-level `Map`, and the
 * `FUNCTIONAL_ASSERTIONS` one is EMPTY by design, so that branch could never
 * fire and no test could reach it. A branch that cannot execute is the vacuity
 * class hiding inside the file that exists to name it. Injection is what makes
 * both orphan checks testable rather than merely present.
 */
export function censusFailures(
  rows: readonly CensusRow[],
  coverage: ReadonlyMap<string, NoLaneCoverage> = NEVER_APPLIED_COVERAGE,
  functional: ReadonlyMap<string, string> = FUNCTIONAL_ASSERTIONS,
): string[] {
  const failures: string[] = [];
  const dirs = new Set(rows.map((r) => r.dir));
  if (rows.length === 0) {
    const why = "a table over zero charts is not a census, it is a check that cannot fail";
    failures.push("the census is EMPTY -- " + why);
  }
  for (const row of rows) {
    const registered = coverage.has(row.dir);
    if (row.tier === "not-applied" && registered === false) {
      const why = "no lane applies it and NEVER_APPLIED_COVERAGE does not name a covering job or a reason -- a chart that belongs to no job";
      failures.push(row.dir + ": " + why);
    }
    if (row.tier !== "not-applied" && registered) {
      const why = "a lane applies it now, so its NEVER_APPLIED_COVERAGE entry is STALE -- an excuse that outlives its defect is how a registry becomes a lie";
      failures.push(row.dir + ": " + why);
    }
    const blind = row.resourcesInTree && row.healthBearing === 0;
    const named = HEALTH_BLIND_ASSERTED_REASONS.has(row.dir);
    if (row.tier === "full" && blind && named === false) {
      const why = "asserted Synced+Healthy, but EVERY committed resource is a kind ArgoCD gives no health verdict, so the Healthy half carries no information; name it in HEALTH_BLIND_ASSERTED_REASONS or give it a resource-level assertion";
      failures.push(row.dir + ": " + why);
    }
    if (named && blind === false) {
      const why = "carries a health-bearing resource now, so its HEALTH_BLIND_ASSERTED_REASONS entry is STALE";
      failures.push(row.dir + ": " + why);
    }
  }
  for (const dir of coverage.keys()) {
    if (dirs.has(dir)) continue;
    failures.push(dir + ": NEVER_APPLIED_COVERAGE names a directory the tree no longer has");
  }
  for (const dir of functional.keys()) {
    if (dirs.has(dir)) continue;
    failures.push(dir + ": FUNCTIONAL_ASSERTIONS names a directory the tree no longer has");
  }
  return failures;
}

/**
 * The census as a markdown table.
 *
 * Emitted rather than hand-written so the doc cannot go stale independently of
 * the tree -- a census maintained by hand is a dated finding, and a dated finding
 * ages.
 */
export function renderMarkdown(rows: readonly CensusRow[]): string {
  const lines: string[] = [];
  lines.push("| chart | assertion tier | health-bearing | health-blind | what could fail | functional assertion | covered by |");
  lines.push("|---|---|---:|---:|---|---|---|");
  for (const row of rows) {
    const covered = row.coveredBy === null ? "" : row.coveredBy;
    const fn = row.functional === null ? "NONE" : row.functional;
    const cells = [row.dir, row.tier, String(row.healthBearing), String(row.healthBlind), healthVerdict(row), fn, covered];
    lines.push("| " + cells.join(" | ") + " |");
  }
  return lines.join("\n");
}

/**
 * THE NAME FOR THE CATEGORY, because it is its own thing and was going unnamed.
 *
 * Aaron 2026-09-09, on `deepseek-coder` and `qwen-coder`: a chart whose only
 * resources are health-less does not report `Healthy` because it is well --
 * it reports `Healthy` because **nothing exists that could be unhealthy**. That
 * is not a weak pass; it is a different KIND of pass, and reading it as the
 * first is how two uninformative greens got counted inside a 37/37.
 */
export const HEALTHY_BY_VACUITY = "healthy-by-vacuity -- nothing exists that could be unhealthy";

/**
 * THE VACUITY COLUMN. Whether the `Healthy` half of the contract can carry a
 * verdict about this chart at all.
 *
 * `helm-unknown` is the honest answer for a chart Application: its resources are
 * not in this tree, so nothing here can say. Reporting `yes` for them would be
 * the exact move this census exists to refuse.
 */
export function healthVerdict(row: CensusRow): string {
  if (row.tier === "not-applied") return "n/a -- never applied";
  if (row.resourcesInTree === false) return "helm-unknown";
  if (row.healthBearing === 0) return HEALTHY_BY_VACUITY;
  return "reconciliation-only";
}

/** The step-level env key by which a functional assertion declares itself. */
export const FUNCTIONAL_ASSERTION_MARKER = "ZETA_FUNCTIONAL_ASSERTION_FOR";

/** Where workflows live, relative to the repo root. */
export const WORKFLOWS_DIR = ".github/workflows";

/**
 * Charts with a POST-DEPLOY FUNCTIONAL assertion -- something that exercises the
 * application and would FAIL if it deployed but did not work.
 *
 * -- WHY IT IS DERIVED AND NOT HAND-MAINTAINED -----------------------------
 * This started as a hand-written `Map` with a docstring promising "an entry must
 * name a path that EXISTS". THAT REFUSAL WAS NEVER IMPLEMENTED. It went unnoticed
 * because the map was empty, so the promise was never load-bearing -- unmetered
 * by virtue of being unused, which is the vacuity class in the file whose whole
 * job is naming it.
 *
 * It was also the drift shape refused two files over: `hat-constraint-roster.ts`
 * exists specifically so a list of seven policy names is DERIVED rather than
 * restated, and then this registry was hardcoded anyway.
 *
 * And a hand-written map made the number depend on MERGE ORDER. The workflow step
 * that is the first real functional assertion and this census live in two
 * different pull requests; whichever landed second had to carry a hand-edit, at an
 * unattended moment, or `main` would hold a census reporting a count that had
 * stopped being true.
 *
 * Deriving it removes all three at once:
 *   - a derived entry names a step that exists BY CONSTRUCTION, so the refusal is
 *     unnecessary rather than unimplemented;
 *   - nothing is restated, so nothing can drift;
 *   - the count is a function of the tree it is read in, so it is true in EVERY
 *     merge order and no hand-edit is owed to anyone at merge time.
 *
 * -- THE CONVENTION --------------------------------------------------------
 * A workflow step that is a post-deploy functional assertion declares itself:
 *
 *     env:
 *       ZETA_FUNCTIONAL_ASSERTION_FOR: <application directory>
 *
 * Declared on the STEP, so it cannot drift from the thing it describes, and
 * machine-readable, so "does a functional assertion exist for this chart" stops
 * being a question anyone answers from memory.
 *
 * STATED LIMIT: this finds steps that DECLARE themselves. A gating functional
 * check written without the marker is invisible here, which under-reports rather
 * than over-reports -- the safe direction, and the one that makes the number a
 * floor rather than a claim. The complementary risk, a marker on a step that
 * gates nothing, is not machine-checkable from the YAML and is the reason the
 * marker is a declaration a reviewer can see rather than a heuristic.
 *
 * -- WHAT IT MEASURED WHEN WRITTEN -----------------------------------------
 * Aaron 2026-09-09: "can we not look at the logs or have some post deploy tests
 * to tell what's working and what's not?"
 *
 * MEASURED the same day: `argocd-health-test.ts` carries 72 references to
 * `Synced`/`Healthy` and ZERO functional assertions. The lane workflow does
 * contain `nc -z` reachability probes and `git ls-remote` checks -- and every one
 * prints `OPEN`/`FAIL` and then `return 0`. They are DIAGNOSTICS, and diagnostics
 * are the right shape for what they do; none of them gates.
 *
 * So the whole lane asserts one class of thing: `Synced + Healthy`, which is
 * ARGOCD'S OPINION ABOUT RECONCILIATION, not evidence that anything works. The
 * proof that the gap is real arrived the same day: all seven Hat Constraints were
 * unapplied in runs that reported green (081M241X2YQ087G0R001K95PAB). A gatekeeper
 * holding zero policies is a gatekeeper that reconciled perfectly.
 */
/**
 * Every self-declared functional assertion in one workflow body, as
 * `chart -> "<workflow> :: <step name>"`.
 *
 * Parsed as YAML, never grepped: a `ZETA_FUNCTIONAL_ASSERTION_FOR` appearing in
 * one of this repo's long `#` comment blocks must not be mistaken for a
 * declaration, and that is exactly the mistake a grep makes.
 */
export function parseFunctionalAssertions(text: string, workflow: string): Map<string, string> {
  const out = new Map<string, string>();
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch {
    return out;
  }
  if (doc === null) return out;
  if (typeof doc !== "object") return out;
  const jobs = (doc as { jobs?: Record<string, unknown> }).jobs;
  if (jobs === undefined) return out;
  for (const job of Object.values(jobs)) {
    if (job === null) continue;
    if (typeof job !== "object") continue;
    const steps = (job as { steps?: unknown }).steps;
    if (Array.isArray(steps) === false) continue;
    for (const step of steps as unknown[]) {
      if (step === null) continue;
      if (typeof step !== "object") continue;
      const shaped = step as { name?: unknown; env?: Record<string, unknown> };
      const env = shaped.env;
      if (env === undefined) continue;
      const chart = env[FUNCTIONAL_ASSERTION_MARKER];
      if (typeof chart !== "string") continue;
      if (chart.length === 0) continue;
      const stepName = typeof shaped.name === "string" ? shaped.name : "<unnamed step>";
      out.set(chart, workflow + " :: " + stepName);
    }
  }
  return out;
}

/** A workflow file suffix. */
function isWorkflowFile(name: string): boolean {
  if (name.endsWith(".yml")) return true;
  if (name.endsWith(".yaml")) return true;
  return false;
}

/** Scan every workflow and union what they declare. */
export function readFunctionalAssertions(repoRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  let files: string[];
  try {
    files = readdirSync(join(repoRoot, WORKFLOWS_DIR)).sort();
  } catch {
    return out;
  }
  for (const file of files) {
    if (isWorkflowFile(file) === false) continue;
    let text: string;
    const full = join(repoRoot, WORKFLOWS_DIR, file);
    try {
      text = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    for (const [chart, where] of parseFunctionalAssertions(text, file)) out.set(chart, where);
  }
  return out;
}

/**
 * The derived registry, read once at module load from the workflows in THIS tree.
 *
 * Exported as a `Map` so every existing caller and test is unchanged -- what moved
 * is where the contents come from.
 */
export const FUNCTIONAL_ASSERTIONS: ReadonlyMap<string, string> = readFunctionalAssertions(
  join(import.meta.dir, "..", "..", ".."),
);

/** Repo root, from this file's location. */
export function defaultRepoRoot(): string {
  return join(import.meta.dir, "..", "..", "..");
}

/** The one-line summary that answers Aaron's question directly. */
export function summarise(rows: readonly CensusRow[]): string {
  const tally = new Map<AssertionTier, number>();
  for (const row of rows) tally.set(row.tier, (tally.get(row.tier) ?? 0) + 1);
  const functional = rows.filter((r) => r.functional !== null).length;
  const blind = rows.filter((r) => r.resourcesInTree && r.healthBearing === 0).length;
  const parts: string[] = [];
  parts.push(String(rows.length) + " charts");
  parts.push(String(tally.get("full") ?? 0) + " asserted Synced+Healthy");
  parts.push(String(tally.get("manual-sync") ?? 0) + " manual-sync");
  parts.push(String(tally.get("applied-unasserted") ?? 0) + " applied-unasserted");
  parts.push(String(tally.get("not-applied") ?? 0) + " never applied");
  parts.push(String(blind) + " healthy-by-vacuity");
  // THE RATIO, never the bare count. Aaron asked what is ACTUALLY tested, and
  // "1" answers that far worse than "1 of 49": a single entry is a foothold, not
  // post-deploy testing, and a non-zero flag would read as the latter.
  parts.push(String(functional) + " of " + String(rows.length) + " with a POST-DEPLOY FUNCTIONAL assertion");
  return parts.join(", ");
}

if (import.meta.main) {
  const rows = census(defaultRepoRoot());
  const failures = censusFailures(rows);
  if (process.argv.includes("--markdown")) console.log(renderMarkdown(rows));
  console.log("[chart-census] " + summarise(rows));
  for (const failure of failures) console.error("::error::" + failure);
  if (failures.length > 0) process.exit(1);
}
