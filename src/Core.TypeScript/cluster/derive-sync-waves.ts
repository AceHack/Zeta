#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/derive-sync-waves.ts
 *
 * DERIVE THE APP-OF-APPS SYNC-WAVE ORDER FROM DECLARED DEPENDENCIES, AND
 * REFUSE WHEN THE HAND-WRITTEN ANNOTATIONS CONTRADICT THE DERIVATION.
 *
 * -- WHAT THIS REPLACES ----------------------------------------------------
 * `full-ai-cluster/dev-cluster/SYNC-WAVES.md` was the only statement of
 * bring-up order and it was maintained by hand. On 2026-08-21 an audit read it
 * as stale: it names 34 components while 46 `kind: Application` manifests ship,
 * so twelve Applications appeared nowhere in its graph.
 *
 * "Stale" was the wrong diagnosis, and the right one is the reason this file
 * exists (Aaron, 2026-08-21): *"for our sync waves, we are supposed to use our
 * ace package manager to calculate the sync waves so the order of the helm
 * charts can be derived where there are dependencies."* Nobody had failed to
 * update a document. A HAND-MAINTAINED artifact was standing where a DERIVED
 * one was intended. Correcting the twelve omissions would have restored the
 * document to accurate-for-now; deriving the order makes the omission
 * IMPOSSIBLE, because an Application absent from the dependency declaration is
 * a refusal rather than a gap nobody can see.
 *
 * -- THE ENGINE IS ace, NOT A REIMPLEMENTATION -----------------------------
 * `src/Core.TypeScript/ace/deps.ts` already carries the whole calculation and
 * says so in its header: "Resolves dependency graphs, calculates topo-sort &
 * sync-waves". `resolveGraph()` does a DFS topological sort with cycle
 * detection and then assigns `wave = 1 + max(wave of dependencies)` -- heights
 * in the DAG. This module calls it. It computes no order of its own.
 *
 * The roster likewise is NOT recomputed here: `listApplicationManifests()` from
 * `app-of-apps-discovery.ts` is the roster, because that module already
 * established -- against the live cluster -- that ArgoCD's include glob is not
 * path-segment bounded and therefore reaches depth 2 (`game-hosting/gmod`).
 *
 * -- WHAT IT ASSERTS -------------------------------------------------------
 * Six findings, each of which is a REFUSAL and never a skip:
 *
 *   1. UNDECLARED    -- an Application in the roster with no node in the
 *                       declaration. This is the exact hole the twelve fell
 *                       through. `dependsOn: []` is an allowed answer; absence
 *                       is not.
 *   2. PHANTOM       -- a declared node naming no shipped Application.
 *   3. UNANNOTATED   -- an Application manifest carrying no
 *                       `argocd.argoproj.io/sync-wave`.
 *   4. UNCITED-EDGE  -- a `dependsOn` entry with no `citations` entry. A wave
 *                       with no cited dependency is the hand-written document's
 *                       defect wearing a new filename.
 *   5. ORDER         -- a declared edge `dep -> app` where the hand-written
 *                       waves do NOT put `dep` strictly earlier. This is the
 *                       derivation disagreeing with the live cluster.
 *   6. CNI-FLOOR     -- an Application (other than argocd, which self-manages
 *                       first) whose wave is at or below cilium's. Pod
 *                       networking is the precondition for every workload, and
 *                       stating it as one checked invariant is honest where
 *                       restating it as 44 identical edges would be padding.
 *
 * -- WHAT IT DELIBERATELY DOES NOT DO --------------------------------------
 * It does not renumber anything. Wave order controls bring-up sequencing on a
 * real cluster; a wrong reorder is a broken bootstrap, and a renumbering nobody
 * reviewed is worse than a reported disagreement. Finding 5 prints the
 * disagreement and the citation that grounds it, and a human adjudicates.
 *
 * Note also what is NOT checked: the derived wave NUMBERS are not compared to
 * the hand-written numbers. ace's heights are 0..N and the live annotations run
 * -90..50; requiring equality would be numerology (a coincidence of counts, not
 * an identification). The defensible claim is that the hand-written assignment
 * must be a LINEAR EXTENSION of the derived partial order -- which is exactly
 * findings 5 and 6.
 *
 * Beacon: Kahn, "Topological sorting of large networks", CACM 5(11) 1962 --
 * the classical construction `resolveGraph` implements.
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { resolveGraph, type AppDependencyGraphSpec, type DependencyNode } from "../ace/deps.ts";
import { listApplicationManifests } from "./app-of-apps-discovery.ts";
// THE ONE DEFINITION OF "deliberately manual-sync" (see that module's header).
// The manual-sync-floor check below needs to know which shipped Applications
// are manual for the SAME reason manual-sync-policy.ts itself exists: an
// absent `spec.syncPolicy.automated` block is indistinguishable from a
// forgotten one, so "manual" must be read from the declared annotation, never
// inferred from the block's absence.
import { classifySyncPolicy } from "./manual-sync-policy.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/** The declaration ace derives the waves from. */
export const DECLARATION_PATH = "full-ai-cluster/k8s/sync-wave-dependency-graph.yaml";

const APPLICATIONS_TREE = "full-ai-cluster/k8s/applications";

/**
 * `argocd` self-manages and is installed by the K3S bootstrap, so it legitimately
 * sits below the CNI floor. It is the ONLY exemption, and it is named here rather
 * than inferred so that adding a second one is a visible edit.
 */
const CNI_FLOOR_EXEMPT: ReadonlySet<string> = new Set(["argocd"]);

const CNI_CHART = "cilium";

/**
 * ORDER disagreements that exist on `main` today, each with the reason it is
 * REGISTERED rather than repaired.
 *
 * Same shape as `DISCOVERED_BUT_UNASSERTED_REASONS` in
 * `app-of-apps-discovery.ts`, and for the same reason: the alternative to a
 * registry is either a red check on `main` (which gets ignored, then deleted)
 * or a silent skip (which is the failure this whole file exists to stop). A
 * registered disagreement is still PRINTED on every run -- visible, not muted
 * -- and:
 *
 *   - a NEW disagreement is not registered, so it FAILS;
 *   - a registration whose disagreement no longer exists is STALE, and that
 *     FAILS too, so the registry cannot rot into a permanent allowlist;
 *   - a reason is mandatory. An entry without one is a mute button.
 *
 * None is repaired here because every repair is a live-cluster sequencing
 * change -- precisely the class this module refuses to make unreviewed.
 */
export const ORDER_ADJUDICATION_PENDING: ReadonlyMap<string, string> = new Map([
  [
    "platform -> kube-prometheus-stack",
    "FOUND 2026-09-03 by deriving edges from the CRD evidence class -- scanning in-repo manifests for " +
      "non-core apiVersions and mapping each custom kind to its installing Application. It was the ONLY " +
      "missing edge that class found across all 47 Applications, and service-DNS derivation cannot see it. " +
      "`platform/monitoring.yaml` ships a monitoring.coreos.com/v1 ServiceMonitor and PrometheusRule, both " +
      "applied (`monitoring` is one of the 15 names in the Application's own directory.include glob), while " +
      "kube-prometheus-stack installs those CRDs at wave 0 against platform's -20. " +
      "THIS ONE DEGRADES DIFFERENTLY FROM ITS TWO SIBLINGS, which is why it is registered separately rather " +
      "than folded in: a Gateway with no pool is ADMITTED and simply address-less, and a PVC with no " +
      "StorageClass PENDS -- both are quiet waits. A custom resource whose CRD does not exist is REJECTED by " +
      "the API server, so platform reports SyncFailed on those two objects on every cold boot until wave 0 " +
      "lands. ArgoCD's retry does converge it, so this is bootstrap noise and a degraded-status window, not a " +
      "permanent failure. " +
      "FOUR REPAIRS, NOT EQUIVALENT: (1) move platform after kube-prometheus-stack -- but platform installs " +
      "eight CRDs other Applications create resources against, so this is the expensive one; (2) split " +
      "monitoring.yaml into its own Application at a later wave -- cheapest, and it is the only object in " +
      "platform needing a wave later than -20; (3) add SkipDryRunOnMissingResource=true to platform's " +
      "syncOptions -- silences the symptom and keeps the inversion; (4) drop the ServiceMonitor/PrometheusRule. " +
      "(2) looks right and is still a maintainer call, because it changes which Application owns the " +
      "platform's own telemetry. " +
      "REPAIR (3) APPLIED 2026-09-22 (crd-provider-consumer-order.ts, WP3): both resources in " +
      "platform/monitoring.yaml now carry `argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true`. " +
      "This was upgraded from a bootstrap-noise annoyance to a genuine deadlock risk by the SAME change: once " +
      "`resource.customizations.health.argoproj.io_Application` is restored in argocd-cm (081M1...WP3 defect 1), " +
      "ArgoCD's wave progression actually WAITS for wave -20 (platform) to be Healthy before starting wave 0 " +
      "(kube-prometheus-stack) -- and a permanently SyncFailed ServiceMonitor/PrometheusRule would have made " +
      "platform permanently non-Healthy, wedging every later wave behind it forever. The order registration " +
      "below is UNCHANGED and still correct to keep: the wave NUMBERS still disagree (kube-prometheus-stack " +
      "still reconciles after platform), which is exactly what this registry tracks; what changed is that the " +
      "disagreement can no longer fail the sync outright.",
  ],
  [
    "platform -> longhorn",
    "The portal StatefulSet's PVC is Longhorn-backed but `platform` syncs at -20 and longhorn at -15, so the " +
      "PVC pends until Longhorn lands. This is fact #6 of vault/TOPOLOGY.md repeating on a second Application: " +
      "there it was MEASURED (`PVCs pend in the interim`) and repaired by moving vault to the bootstrap " +
      "`zeta-local-path` StorageClass. Two repairs are available here -- move platform after longhorn, or move " +
      "the portal volume to zeta-local-path -- and they differ in the durability guarantee for the Room/event " +
      "log, which is a design call for the maintainer, not a mechanical renumber.",
  ],
  [
    "platform -> cilium-lb-ipam",
    "`platform` (-20) renders the zeta-gateway Gateway whose LoadBalancer Service draws its address from the " +
      "cilium-lb-ipam pool, but that pool syncs at -10. The Gateway is admitted either way; it simply has no " +
      "external address until the pool arrives, and ArgoCD's retry converges it. Reordering touches the ingress " +
      "path of a cluster with live external DNS, so it is reported rather than performed.",
  ],
  [
    "alloy -> loki",
    "alloy, loki, mimir and tempo all sit at wave 0, so the shipper reconciles alongside the sinks it writes to. " +
      "Alloy retries its remote-write endpoints indefinitely, so the steady state is correct and only first-boot " +
      "telemetry is dropped. Splitting the observability stack across two waves is a deliberate choice about " +
      "bootstrap latency for a maintainer to make explicitly.",
  ],
  [
    "alloy -> tempo",
    "Same wave-0 observability cohort as `alloy -> loki`; see that entry. Registered separately so repairing one " +
      "edge does not silently retire another's registration.",
  ],
  [
    "alloy -> mimir",
    "Same wave-0 observability cohort as `alloy -> loki`; see that entry. Registered separately so repairing one " +
      "edge does not silently retire another's registration.",
  ],
  [
    "weaviate -> ollama",
    "The sharpest of the eight: weaviate is wave 0 with BOTH `text2vec-ollama` and `generative-ollama` enabled, " +
      "while ollama is wave 50 AND manual-sync-only by default (SYNC-WAVES.md: `these need explicit argocd app " +
      "sync`). So in the default configuration weaviate's vectorizer has no backend at all, not merely a late " +
      "one. Whether to move weaviate after ollama, disable the modules by default, or accept a degraded " +
      "vectorizer is a product call.",
  ],
  [
    "deepseek-coder -> ollama",
    "deepseek-coder and ollama share wave 50. The ConfigMap's `served-by: \"ollama|vllm\"` is explicitly a " +
      "choose-one switch, so the edge may be conditional rather than absolute -- but the declaration cannot " +
      "express a disjunctive dependency today, and dropping the edge would assert an independence the endpoint " +
      "reference contradicts. Registered until the served-by choice is made declarative.",
  ],
  [
    "qwen-coder -> ollama",
    "Identical to `deepseek-coder -> ollama`: same wave 50, same `served-by: \"ollama|vllm\"` disjunction in " +
      "qwen-coder/configmap.yaml. See that entry.",
  ],
]);

/** The registry key for an order disagreement. */
export function orderViolationKey(v: OrderViolation): string {
  return `${v.dependent} -> ${v.dependency}`;
}

// ---------------------------------------------------------------------------
// Reading the shipped Applications
// ---------------------------------------------------------------------------

export interface ShippedApplication {
  /** `metadata.name` -- the key ArgoCD orders by, and this graph's node key. */
  readonly name: string;
  /** Path relative to the repo root. */
  readonly path: string;
  /** The hand-written `argocd.argoproj.io/sync-wave`, or null when absent. */
  readonly wave: number | null;
  /**
   * `classifySyncPolicy(...).kind === "manual"` -- a WELL-FORMED declared
   * manual-sync posture (manual-sync-policy.ts). `invalid` and `automated`
   * both read as `false` here: an invalid declaration must never be cheaper to
   * satisfy than a correct one (manual-sync-policy.ts's own stated invariant),
   * so it stays under the full automated-Application floor requirement rather
   * than earning the manual exemption it failed to declare correctly.
   */
  readonly manualSync: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every shipped `kind: Application`, keyed by `metadata.name`.
 *
 * The roster comes from `listApplicationManifests()` rather than a fresh walk:
 * that function is where the depth-2 glob finding lives, and re-deriving it
 * here would be a second implementation to keep in step.
 */
export function readShippedApplications(repoRoot = REPO_ROOT): readonly ShippedApplication[] {
  const appsDir = resolve(repoRoot, APPLICATIONS_TREE);
  const out: ShippedApplication[] = [];
  for (const rel of listApplicationManifests(repoRoot)) {
    const abs = resolve(appsDir, rel);
    const text = readFileSync(abs, "utf8");
    for (const doc of parseAllDocuments(text)) {
      const value: unknown = doc.toJS({ maxAliasCount: -1 });
      if (!isRecord(value)) continue;
      if (typeof value.apiVersion !== "string" || !value.apiVersion.startsWith("argoproj.io/")) continue;
      if (value.kind !== "Application") continue;
      const metadata = isRecord(value.metadata) ? value.metadata : undefined;
      const name = typeof metadata?.name === "string" ? metadata.name : "";
      if (name === "") continue;
      const annotations = isRecord(metadata?.annotations) ? metadata.annotations : undefined;
      const raw = annotations?.["argocd.argoproj.io/sync-wave"];
      // ArgoCD parses the annotation with strconv.Atoi, so only an integer
      // literal counts. A float or a stray word is NOT a wave -- treat it as
      // absent rather than silently coercing it to something plausible.
      const text2 = raw === undefined || raw === null ? "" : String(raw).trim();
      const wave = /^-?\d+$/.test(text2) ? Number.parseInt(text2, 10) : null;
      const manualSync = classifySyncPolicy(text).kind === "manual";
      out.push({ name, path: relative(repoRoot, abs), wave, manualSync });
    }
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Reading the declaration
// ---------------------------------------------------------------------------

/** A `spec.dependsOn` node plus the citation map the checker requires. */
export interface DeclaredNode extends DependencyNode {
  readonly citations?: Record<string, unknown>;
}

export interface Declaration {
  readonly spec: AppDependencyGraphSpec;
  readonly nodes: readonly DeclaredNode[];
}

export function readDeclaration(repoRoot = REPO_ROOT): Declaration {
  const abs = resolve(repoRoot, DECLARATION_PATH);
  const docs = parseAllDocuments(readFileSync(abs, "utf8"));
  const first = docs[0];
  if (first === undefined) throw new Error(`${DECLARATION_PATH}: no YAML document`);
  const value: unknown = first.toJS({ maxAliasCount: -1 });
  if (!isRecord(value)) throw new Error(`${DECLARATION_PATH}: must be a YAML mapping`);
  if (value.kind !== "AppDependencyGraph") {
    throw new Error(`${DECLARATION_PATH}: expected kind AppDependencyGraph (got ${String(value.kind)})`);
  }
  const spec = isRecord(value.spec) ? value.spec : undefined;
  if (!Array.isArray(spec?.dependsOn)) {
    throw new Error(`${DECLARATION_PATH}: spec.dependsOn must be an array`);
  }
  const nodes = spec.dependsOn.filter(isRecord) as unknown as readonly DeclaredNode[];
  return { spec: value as unknown as AppDependencyGraphSpec, nodes };
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

export interface OrderViolation {
  readonly dependent: string;
  readonly dependency: string;
  readonly dependentWave: number;
  readonly dependencyWave: number;
  readonly citation: string;
}

export interface CniFloorViolation {
  readonly app: string;
  readonly wave: number;
  readonly cniWave: number;
}

export interface ManualSyncFloorViolation {
  readonly app: string;
  readonly wave: number;
  readonly maxAutomatedWave: number;
}

export interface WaveAudit {
  /** Shipped Applications with no node in the declaration. Finding 1. */
  readonly undeclared: readonly string[];
  /** Declared nodes naming no shipped Application. Finding 2. */
  readonly phantom: readonly string[];
  /** Shipped Applications with no parseable sync-wave annotation. Finding 3. */
  readonly unannotated: readonly string[];
  /** `"<dependent> -> <dependency>"` edges with no citation. Finding 4. */
  readonly uncitedEdges: readonly string[];
  /** Hand-written waves that contradict a declared edge. Finding 5. */
  readonly orderViolations: readonly OrderViolation[];
  /** Order disagreements NOT in `ORDER_ADJUDICATION_PENDING`. These fail. */
  readonly unregisteredOrderViolations: readonly OrderViolation[];
  /** Registry entries whose disagreement no longer exists. These fail too. */
  readonly staleAdjudications: readonly string[];
  /** Applications at or below the CNI's wave. Finding 6. */
  readonly cniFloorViolations: readonly CniFloorViolation[];
  /**
   * A declared manual-sync Application sitting BEFORE some automated
   * Application's wave. Finding 7.
   *
   * WHY THIS CHECK EXISTS: `resource.customizations.health.argoproj.io_Application`
   * in argocd-cm (full-ai-cluster/k8s/bootstrap/argocd-install.yaml +
   * applications/argocd/Application.yaml) restores real health assessment for
   * child Applications, which means sync-wave progression across zeta-root's
   * ~50 children now WAITS for each wave to be Healthy before starting the
   * next one -- GLOBALLY, not per dependency edge. A manual-sync Application
   * (cdi, kubevirt, ollama, vllm -- manual-sync-policy.ts) is, by design,
   * never auto-synced: its honest health on a fresh cluster is "Missing"
   * forever, until a human runs `argocd app sync <name>`. Left at any wave
   * other than the tail, it would wedge every automated Application behind it
   * -- forever, on every fresh install, cluster-wide. This is NOT a
   * per-edge dependency question (the CNI-floor check's shape); it is a
   * global-ordering safety property, so it is checked the same way: as one
   * invariant rather than as N edges.
   */
  readonly manualSyncFloorViolations: readonly ManualSyncFloorViolation[];
  /** ace's derived DAG heights, by chart. Reported, never enforced numerically. */
  readonly derivedWaves: ReadonlyMap<string, number>;
  /** ace's topological order, with the synthetic graph root removed. */
  readonly derivedOrder: readonly string[];
}

export function auditSyncWaveDerivation(repoRoot = REPO_ROOT): WaveAudit {
  const declaration = readDeclaration(repoRoot);
  return auditInputs(readShippedApplications(repoRoot), declaration);
}

/**
 * The audit, over inputs rather than over the repo.
 *
 * Split out so the falsifiers can drive it with a synthetic roster + declaration
 * and prove each finding actually fires. An audit that can only be run against a
 * tree that happens to be clean is a check nobody has watched fail.
 */
export function auditInputs(
  shipped: readonly ShippedApplication[],
  declaration: Declaration,
  /** Injectable so the falsifiers can drive the registry mechanism both ways. */
  pending: ReadonlyMap<string, string> = ORDER_ADJUDICATION_PENDING,
): WaveAudit {
  const shippedByName = new Map(shipped.map((a) => [a.name, a]));
  const { spec, nodes } = declaration;

  const declaredNames = new Set<string>();
  for (const node of nodes) {
    if (typeof node.chart === "string" && node.chart !== "") declaredNames.add(node.chart);
  }

  const undeclared = shipped.filter((a) => !declaredNames.has(a.name)).map((a) => a.name);
  const phantom = [...declaredNames].filter((n) => !shippedByName.has(n)).sort();
  const unannotated = shipped.filter((a) => a.wave === null).map((a) => a.name);

  const uncitedEdges: string[] = [];
  const orderViolations: OrderViolation[] = [];

  for (const node of nodes) {
    const chart = typeof node.chart === "string" ? node.chart : "";
    const deps = Array.isArray(node.dependsOn) ? node.dependsOn : [];
    const citations = isRecord(node.citations) ? node.citations : {};
    for (const dep of deps) {
      if (typeof dep !== "string") continue;
      const cited = citations[dep];
      const citation = typeof cited === "string" ? cited.trim() : "";
      if (citation === "") {
        uncitedEdges.push(`${chart} -> ${dep}`);
        continue;
      }
      const here = shippedByName.get(chart);
      const there = shippedByName.get(dep);
      // A missing endpoint is already reported as UNDECLARED/PHANTOM. Reporting
      // it a second time as an order violation would double-count one defect.
      if (here?.wave === undefined || here.wave === null) continue;
      if (there?.wave === undefined || there.wave === null) continue;
      if (there.wave >= here.wave) {
        orderViolations.push({
          dependent: chart,
          dependency: dep,
          dependentWave: here.wave,
          dependencyWave: there.wave,
          citation,
        });
      }
    }
  }

  // The CNI floor. Checked only when cilium itself is annotated -- an
  // unannotated CNI is already finding 3, and inventing a floor from a missing
  // number would be a check that cannot fail.
  const cniFloorViolations: CniFloorViolation[] = [];
  const cniWave = shippedByName.get(CNI_CHART)?.wave ?? null;
  if (cniWave !== null) {
    for (const app of shipped) {
      if (app.name === CNI_CHART) continue;
      if (CNI_FLOOR_EXEMPT.has(app.name)) continue;
      if (app.wave === null) continue;
      if (app.wave <= cniWave) {
        cniFloorViolations.push({ app: app.name, wave: app.wave, cniWave });
      }
    }
  }

  // The manual-sync floor. A manual-sync app never auto-converges, so it must
  // sit at or after every AUTOMATED app's wave -- otherwise, once Application
  // health gating is live, its permanent "Missing" health wedges every
  // automated app behind it. Only checked among apps with a parseable wave;
  // an unannotated app is already finding 3.
  const manualSyncFloorViolations: ManualSyncFloorViolation[] = [];
  {
    const automatedWaves = shipped
      .filter((a) => !a.manualSync && a.wave !== null)
      .map((a) => a.wave as number);
    const maxAutomatedWave = automatedWaves.length === 0 ? null : Math.max(...automatedWaves);
    if (maxAutomatedWave !== null) {
      for (const app of shipped) {
        if (!app.manualSync) continue;
        if (app.wave === null) continue;
        if (app.wave < maxAutomatedWave) {
          manualSyncFloorViolations.push({ app: app.name, wave: app.wave, maxAutomatedWave });
        }
      }
    }
  }

  // The derivation itself. `resolveGraph` throws on a cycle or an edge to an
  // unknown chart; both are genuine refusals, so they are allowed to propagate.
  const resolved = resolveGraph(spec);
  const rootName = spec.metadata.name;
  const derivedWaves = new Map<string, number>();
  for (const [chart, wave] of resolved.waves) {
    if (chart === rootName) continue;
    derivedWaves.set(chart, wave);
  }

  const seenKeys = new Set(orderViolations.map(orderViolationKey));
  const unregisteredOrderViolations = orderViolations.filter(
    (v) => (pending.get(orderViolationKey(v)) ?? "").trim() === "",
  );
  const staleAdjudications = [...pending.keys()].filter((k) => !seenKeys.has(k)).sort();

  return {
    undeclared,
    phantom,
    unannotated,
    uncitedEdges: uncitedEdges.sort(),
    orderViolations,
    unregisteredOrderViolations,
    staleAdjudications,
    cniFloorViolations,
    manualSyncFloorViolations,
    derivedWaves,
    derivedOrder: resolved.order.filter((c) => c !== rootName),
  };
}

export function auditIsClean(audit: WaveAudit): boolean {
  return (
    audit.undeclared.length === 0 &&
    audit.phantom.length === 0 &&
    audit.unannotated.length === 0 &&
    audit.uncitedEdges.length === 0 &&
    audit.unregisteredOrderViolations.length === 0 &&
    audit.staleAdjudications.length === 0 &&
    audit.cniFloorViolations.length === 0 &&
    audit.manualSyncFloorViolations.length === 0
  );
}

export function formatWaveAudit(audit: WaveAudit): string {
  const lines: string[] = [];
  const push = (header: string, body: readonly string[]) => {
    if (body.length === 0) return;
    lines.push(header);
    for (const b of body) lines.push(`  ${b}`);
    lines.push("");
  };

  push(
    `UNDECLARED -- ${audit.undeclared.length} shipped Application(s) have no node in ${DECLARATION_PATH}.`,
    audit.undeclared.map(
      (n) => `${n}: add a node. \`dependsOn: []\` is a real answer; absence is how twelve apps went missing.`,
    ),
  );
  push(
    `PHANTOM -- ${audit.phantom.length} declared node(s) name no shipped Application.`,
    audit.phantom.map((n) => `${n}: declared, but no kind: Application manifest carries that metadata.name.`),
  );
  push(
    `UNANNOTATED -- ${audit.unannotated.length} Application(s) carry no integer argocd.argoproj.io/sync-wave.`,
    audit.unannotated,
  );
  push(
    `UNCITED-EDGE -- ${audit.uncitedEdges.length} declared edge(s) have no citation.`,
    audit.uncitedEdges.map((e) => `${e}: add a \`citations\` entry naming the artifact that grounds this edge.`),
  );
  const describe = (v: OrderViolation) =>
    `${v.dependent} (wave ${v.dependentWave}) depends on ${v.dependency} (wave ${v.dependencyWave}) -- ` +
    `the dependency does not reconcile first. Grounded by: ${v.citation.replace(/\s+/g, " ").trim()}`;

  push(
    `ORDER (NEW) -- ${audit.unregisteredOrderViolations.length} hand-written wave(s) contradict a declared ` +
      `dependency and are NOT registered in ORDER_ADJUDICATION_PENDING.`,
    audit.unregisteredOrderViolations.map(describe),
  );
  push(
    `ORDER (STALE REGISTRATION) -- ${audit.staleAdjudications.length} entr(ies) in ORDER_ADJUDICATION_PENDING no ` +
      `longer describe a real disagreement. Delete them; a registry that outlives its finding is an allowlist.`,
    audit.staleAdjudications,
  );
  push(
    `CNI-FLOOR -- ${audit.cniFloorViolations.length} Application(s) reconcile at or before the CNI.`,
    audit.cniFloorViolations.map(
      (v) => `${v.app} (wave ${v.wave}) is not strictly after ${CNI_CHART} (wave ${v.cniWave}).`,
    ),
  );
  push(
    `MANUAL-SYNC-FLOOR -- ${audit.manualSyncFloorViolations.length} declared manual-sync Application(s) sit ` +
      `before an automated Application's wave.`,
    audit.manualSyncFloorViolations.map(
      (v) =>
        `${v.app} (wave ${v.wave}) is manual-sync and never auto-converges, but an automated Application syncs ` +
        `as late as wave ${v.maxAutomatedWave} -- move ${v.app} to wave ${v.maxAutomatedWave} or later, or every ` +
        `wave from ${v.wave} on wedges behind its permanent "Missing" health once Application health gating is live.`,
    ),
  );

  // Registered disagreements are printed on EVERY run, pass or fail. A finding
  // that stops being visible once it is registered is a finding nobody fixes.
  const unregisteredKeys = new Set(audit.unregisteredOrderViolations.map(orderViolationKey));
  const registered = audit.orderViolations.filter((v) => !unregisteredKeys.has(orderViolationKey(v)));
  push(
    `ORDER (AWAITING ADJUDICATION) -- ${registered.length} known disagreement(s) between the ace-derived order ` +
      `and the live annotations. Reported, deliberately not repaired.`,
    registered.map(
      (v) => `${describe(v)}\n    WHY NOT REPAIRED: ${ORDER_ADJUDICATION_PENDING.get(orderViolationKey(v)) ?? "(registered)"}`,
    ),
  );

  lines.push(
    `sync-wave derivation: ${audit.derivedWaves.size} charts declared, ` +
      `${audit.orderViolations.length} order disagreement(s) ` +
      `(${audit.unregisteredOrderViolations.length} new, ${registered.length} awaiting adjudication).`,
    "",
    "NOT RENUMBERED ON PURPOSE. Wave order sequences bring-up on a real cluster; a wrong reorder is a broken",
    "bootstrap. Every ORDER finding is a disagreement between the derivation and the live annotations, for a",
    "human to adjudicate -- by moving the wave, or by removing an edge the tree does not actually carry.",
  );
  return lines.join("\n");
}

function main(): void {
  const audit = auditSyncWaveDerivation();
  const derived = [...audit.derivedWaves.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  console.log(`ace-derived DAG heights (${derived.length} charts), from ${DECLARATION_PATH}:`);
  let lastHeight = -1;
  for (const [chart, height] of derived) {
    if (height !== lastHeight) {
      console.log(`  height ${height}:`);
      lastHeight = height;
    }
    console.log(`    ${chart}`);
  }
  console.log("");
  console.log(formatWaveAudit(audit));
  if (!auditIsClean(audit)) process.exit(1);
}

if (import.meta.main) {
  main();
}
