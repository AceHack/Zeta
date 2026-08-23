// Independently-testable lanes — a MEASURED partition of the App-of-Apps.
//
// AARON'S OBSERVATION, 2026-08-22
// -------------------------------
//   "if we have independent helm chart groups we can test those independently.
//    we could have different groups of applications that depend on each other
//    and test each group of apps independently if they don't have dependency
//    overlaps. i think ace package manager should hopefully be able to tell us
//    if there are independent helm app groups we can test independently."
//
// The shape is right and the machinery was already here: `ace`'s dependency
// engine topologically sorts `sync-wave-dependency-graph.yaml`, and
// `rendered-storage-claims.ts` renders all 54 Applications offline. What was
// missing is the pricing — a lane is only "independently testable" if it FITS
// on the runner it is dispatched to, and nothing measured that per-lane.
//
// WHY THIS IS NOT A PARALLELISM OPTIMISATION
// ------------------------------------------
// From `storage-profiles.json` `runnerEnvelope`, the portable hosted-runner
// contract is 4000m / 15360Mi / 70Gi. Reserved is 1500m / 6144Mi / 4Gi,
// leaving 2500m / 9216Mi / 66Gi. Against that, all 47 Applications measure
// 4916m / 15406Mi / 74.54Gi on disk at the `dev` rung — CPU over by 1.97x,
// disk over by 1.13x. Both still require sharding.
//
// THE DISK HALF OF THAT CONTRACT WAS 14Gi UNTIL 2026-08-23, and how it moved is
// the part worth keeping. 14 was the vendor spec; two runners measured 77.06
// and 99.02 GiB free. The gap sat open on purpose, because raising the bound
// moves which Applications come out `oversize` and that is a conclusion about
// the tree — so it was left for a human. The field then oscillated 70/14/70/14
// across four PRs in under three hours on 2026-08-22 with NO human decision
// recorded in either direction. Aaron took it explicitly on 2026-08-23: "take
// the 70, unlock hindsight and vllm on hosted runners". 70 is a floor beneath
// both measured machines, not a transcription of either, and the authorization
// is written into `measuredFreeDiskEvidence` where the next reader will find it.
//
// The standing rule is unchanged and is the reason the tripwire stays: no
// observed surplus on one hosted runner may silently weaken the portable
// contract. A human may raise it; a `df` may not.
//
// THE FIRST ANSWER WAS THE DISAPPOINTING ONE, AND IT IS RECORDED
// --------------------------------------------------------------
// Connected components of the undirected dependency graph — the zero-
// duplication partition, and the literal reading of "no dependency overlaps" —
// gives 15 components, of which ONE HOLDS 32 OF THE 47 APPLICATIONS. Every
// storage consumer hangs off `longhorn`, the networked ones off `cilium`, and
// `platform` (cert-manager + cilium + cilium-lb-ipam + longhorn) staples the
// bootstrap chain to the storage chain. That component contains both 23-GiB
// images. Components alone do not make the problem tractable, and
// `connectedComponents` below exists to keep saying so rather than to be used.
//
// WHAT DOES WORK: DEPENDENCY CLOSURES, BECAUSE THE HUBS ARE CHEAP
// ---------------------------------------------------------------
// The giant component is glued by hubs that cost almost nothing to duplicate:
// `longhorn` is 0.69 GiB of images, `cilium` 0.94 GiB, `cert-manager` 1.11 GiB.
// So the right unit is not the component but the CLOSURE — an app plus its
// transitive dependencies — and lanes may SHARE those hubs by each paying for
// them. A lane built from closures is dependency-complete by construction,
// which is the property that actually matters for bring-up; disjointness never
// was.
//
// Measured at the `dev` rung with a 0.85 margin: TWO lanes cover 41 of 47.
// `hindsight` 22.49 GiB and `vllm` 22.65 GiB FIT the 56.1 GiB 0.85-margin
// budget and pack into a lane — they were the self-hosted case only against
// the 14 GiB vendor disk. The six that do not pack are UNPRICED (unmeasurable
// images), not oversize.
//
// IT WAS THREE LANES UNTIL THE SECOND LEVER LANDED THE SAME DAY, and the two
// are separable: raising the disk bound alone gave 3 lanes / 41 covered, with
// lane-2 at 2106m against a 2125m budget — 99.1% of CPU while its disk sat at
// 5.79 of 56.10 GiB. Disk had stopped binding and CPU was all that still split
// the partition. Aaron: "cpu is a compressible resource, can we not set the
// requests smaller to make it fit? seems like should be able to test more
// charts". Flooring 18 governed `dev` CPU rows at 25m (-1250m, `metal`
// untouched) merged lane-3 away. Coverage did not change — 41 either way —
// because the ones that are missing are unmeasurable images, which no envelope
// and no ladder can reach.
//
// UNPRICED IS A THIRD ANSWER, NEVER A PASS
// ----------------------------------------
// TWO Applications (`hat-system`, `orleans`) render an image whose size cannot
// be read. `game-hosting/gmod` is priced: `catalogueKey` is the directory
// itself (`game-hosting/gmod`), which matches the ungoverned row, so last-
// segment lookup cannot silently UNPRICE it. The unmeasurable apps are NOT
// packed. A lane holding one would report a number that is a FLOOR while
// reading like a total, which is exactly the "a check that did not run looks
// like one that passed" failure. They are quarantined, each with the artifact
// that blocks it, so the report says what would have to be fixed rather than
// quietly rounding it to zero.
//
// AND THE QUARANTINE IS ONLY AS HONEST AS THE ARTIFACT UNDER IT. `platform`
// left it on 2026-08-23 and NONE of its three blockers turned out to need a
// bigger runner. One was a wrong reference — `ghcr.io/ich777/steamcmd:armareforger`
// for `ghcr.io/acemod/arma-reforger` pinned by digest (081M0QB1ZCV087G0R001P9YCPX).
// The other two were STALE: `zeta-portal` and `zeta-platform-controller` had
// been made public, the anonymous read prices them, and nothing had
// re-measured. A resolved blocker still being reported is the same defect class
// as a check that did not run looking like one that passed — so a re-measure is
// part of reading this report, not a separate chore.
//
// The two that remain are a THIRD kind, and worth naming because "unmeasurable"
// hides it: `ghcr.io/lucent-financial-group/{zeta-orleans-silo,hat-system-operator}`
// are not private. The org publishes exactly two container packages and neither
// is one of these — the references DANGLE. ghcr answers 401 rather than 404 for
// an unknown repository so as not to leak which names exist, which is why they
// wear a private repository's status. See `refusalReason` in
// `measure-lane-footprints.ts`.
//
// USAGE
//   bun src/Core.TypeScript/cluster/lane-partition.ts                 # report
//   bun src/Core.TypeScript/cluster/lane-partition.ts --matrix        # CI matrix JSON
//   bun src/Core.TypeScript/cluster/lane-partition.ts --rung metal
//   bun src/Core.TypeScript/cluster/lane-partition.ts --margin 1.0
//   bun src/Core.TypeScript/cluster/lane-partition.ts --components    # the baseline
//
// Fully offline: reads the declared graph, the resource catalogue, and the
// checked-in footprint measurement. No helm, no network, no cluster.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { listApplicationManifests } from "./app-of-apps-discovery.ts";
import { FOOTPRINTS_PATH, type LaneFootprints } from "./measure-lane-footprints.ts";
import { stringCompare } from "../collation/collation.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const GRAPH_PATH = "full-ai-cluster/k8s/sync-wave-dependency-graph.yaml";
export const CATALOGUE_PATH = "full-ai-cluster/k8s/storage-profiles.json";
const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

const GIB = 1024 ** 3;

// ------------------------------------------------------------------ roster ---

export interface RosterEntry {
  /** `metadata.name` — the key the dependency graph uses. */
  readonly name: string;
  /** Directory under `applications/`, possibly nested. */
  readonly dir: string;
  /** The key `rendered-storage-claims.ts` and the footprints file use. */
  readonly appId: string;
  /** Last path segment of `dir` — the key `storage-profiles.json` uses. */
  readonly catalogueKey: string;
}

/**
 * The Application roster, keyed three ways because the tree keys it three ways.
 *
 * This is not incidental tidying. `oz/Application.yaml` declares
 * `metadata.name: openziti-controller`, so the dependency graph calls it
 * `openziti-controller` while `storage-profiles.json` and the renderer call it
 * `oz`. Joining those two sources on the wrong key silently DROPS the app —
 * and a dropped app is capacity that no lane pays for, which is the same
 * defect class as counting an unmeasurable image as zero. Every join in this
 * module goes through this table.
 */
export function loadRoster(repoRoot = REPO_ROOT): readonly RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const rel of listApplicationManifests(repoRoot)) {
    const abs = resolve(repoRoot, APPLICATIONS_DIR, rel);
    const docs = parseAllDocuments(readFileSync(abs, "utf8")).map((d) => d.toJS() as Record<string, unknown> | null);
    const doc = docs.find((d): d is Record<string, unknown> => d !== null && d.kind === "Application");
    if (doc === undefined) throw new Error(`${rel}: no kind: Application document`);
    const meta = doc.metadata as Record<string, unknown> | undefined;
    const name = typeof meta?.name === "string" ? meta.name : "";
    if (name === "") throw new Error(`${rel}: Application has no metadata.name`);
    const dir = rel.slice(0, rel.lastIndexOf("/"));
    // `catalogueKey` is the catalogue's OWN key, which is the repo-relative
    // directory -- `applicationDirs()` produces it and `resourceClaims[].dir`
    // and `ungovernedRequests[].dir` are matched against it. This used to take
    // the last path segment, which is a no-op for the depth-1 directories that
    // were all this tree had, and became wrong the moment a depth-2 Application
    // was priced: `game-hosting/gmod` would have been looked up as `gmod`,
    // missed, and counted as UNPRICED -- a silent 1000m / 2Gi hole in every
    // lane that contains it, in a module whose whole point is that an unpriced
    // app is never zero.
    out.push({ name, dir, appId: `full-ai-cluster/${dir}`, catalogueKey: dir });
  }
  return out;
}

// ------------------------------------------------------------------- graph ---

export type EdgeClass = "observed" | "intent";

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly edgeClass: EdgeClass;
}

export interface DeclaredGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly GraphEdge[];
  /** Edges whose citation mentions declared intent but which nothing adjudicates. */
  readonly unadjudicated: readonly string[];
}

/** An edge key, the form used by `spec.intentAdjudication`. */
export function edgeKey(from: string, to: string): string {
  return `${from} -> ${to}`;
}

/**
 * The declared graph, with each edge classified observed vs declared-intent.
 *
 * WHY CLASSIFICATION IS NOT OPTIONAL. An intent edge records a wiring we mean
 * to have, not one that runs: `spire -> vault` is kept because SYNC-WAVES.md
 * asserts it, and the graph's own citation admits `helm template` renders zero
 * occurrences of `upstream` and SPIRE self-signs. Treating that as real merges
 * two sets of applications that are, today, independent — a partition coarser
 * than the tree warrants.
 *
 * WHY IT IS ADJUDICATED RATHER THAN PATTERN-MATCHED. The obvious mechanism is
 * to grep the citations for "declared intent", and it is wrong in a way the
 * file already demonstrates: `temporal -> cockroachdb`'s citation says the edge
 * "was a DECLARED INTENT until 2026-08-22 ... and is now a live connection".
 * A substring match convicts it. So the phrase is used only to ENUMERATE
 * candidates, and each candidate must be answered in `spec.intentAdjudication`
 * with a class and a reason. A new citation that mentions the phrase and is not
 * adjudicated is a FINDING — the roster is derived from the file, so an edge
 * cannot be added and quietly left unclassified.
 */
export function loadGraph(repoRoot = REPO_ROOT): DeclaredGraph {
  const abs = resolve(repoRoot, GRAPH_PATH);
  const doc = parseAllDocuments(readFileSync(abs, "utf8"))[0];
  if (doc === undefined) throw new Error(`${GRAPH_PATH}: empty`);
  const spec = (doc.toJS() as { spec?: Record<string, unknown> }).spec ?? {};
  const declared = (spec.dependsOn ?? []) as {
    chart?: string;
    dependsOn?: string[];
    citations?: Record<string, string>;
  }[];
  const adjudication = (spec.intentAdjudication ?? {}) as Record<string, { class?: string }>;

  const nodes = declared.map((n) => n.chart ?? "").filter((n) => n !== "");
  const known = new Set(nodes);
  const edges: GraphEdge[] = [];
  const unadjudicated: string[] = [];
  for (const node of declared) {
    const from = node.chart ?? "";
    for (const to of node.dependsOn ?? []) {
      if (!known.has(to)) throw new Error(`${GRAPH_PATH}: edge ${edgeKey(from, to)} names an unknown node`);
      const citation = node.citations?.[to] ?? "";
      const key = edgeKey(from, to);
      const mentionsIntent = /declared\s+intent/i.test(citation);
      const verdict = adjudication[key]?.class;
      if (mentionsIntent && verdict === undefined) unadjudicated.push(key);
      edges.push({ from, to, edgeClass: verdict === "intent" ? "intent" : "observed" });
    }
  }
  return { nodes, edges, unadjudicated };
}

// --------------------------------------------------------------- catalogue ---

export interface RunnerEnvelope {
  readonly runner: string;
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly freeDiskGib: number;
  readonly reservedCpuMillis: number;
  readonly reservedMemoryMib: number;
  readonly reservedDiskGib: number;
}

export interface Budget {
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly diskGib: number;
}

/**
 * What a lane may actually use, after the runner's reservations and the margin.
 *
 * The reservation is not padding: `runnerEnvelope.reservationEvidence` accounts
 * for the kind control plane the scheduler subtracts before placing anything,
 * plus the host OS / runner agent / containerd slice that lives OUTSIDE the
 * kind node's cgroup and that the kubelet therefore reports as available when
 * it is not. Under-reserving there shows up as the runner OOMing, not as a
 * Pending pod.
 *
 * The `margin` is a separate and weaker thing, and is named separately for that
 * reason: 28 of 45 Applications render BestEffort pods that request nothing, so
 * every sum here is a FLOOR on real usage. Packing to 100% of the budget means
 * packing to 100% of a floor. 0.85 is a judgement, not a measurement.
 */
export function budgetOf(env: RunnerEnvelope, margin: number): Budget {
  return {
    cpuMillis: (env.cpuMillis - env.reservedCpuMillis) * margin,
    memoryMib: (env.memoryMib - env.reservedMemoryMib) * margin,
    diskGib: (env.freeDiskGib - env.reservedDiskGib) * margin,
  };
}

export interface ResourceRow {
  readonly cpuMillis: number;
  readonly memoryMib: number;
}

export interface Catalogue {
  readonly envelope: RunnerEnvelope;
  /** catalogueKey -> summed requests at the chosen rung. Absent = UNPRICED, never zero. */
  readonly rows: ReadonlyMap<string, ResourceRow>;
  readonly rungs: readonly string[];
}

export function loadCatalogue(rung: string, repoRoot = REPO_ROOT): Catalogue {
  const raw = JSON.parse(readFileSync(resolve(repoRoot, CATALOGUE_PATH), "utf8")) as {
    runnerEnvelope: RunnerEnvelope;
    resourceProfiles: string[];
    resourceClaims: {
      dir: string;
      pods?: number;
      cpuMillis: Record<string, number>;
      memoryMib: Record<string, number>;
    }[];
    ungovernedRequests: { dir: string; cpuMillis: number; memoryMib: number }[];
  };
  if (!raw.resourceProfiles.includes(rung)) {
    throw new Error(`unknown rung "${rung}"; ${CATALOGUE_PATH} declares ${raw.resourceProfiles.join(", ")}`);
  }
  const rows = new Map<string, ResourceRow>();
  const add = (dir: string, cpu: number, mem: number): void => {
    const prev = rows.get(dir) ?? { cpuMillis: 0, memoryMib: 0 };
    rows.set(dir, { cpuMillis: prev.cpuMillis + cpu, memoryMib: prev.memoryMib + mem });
  };
  for (const claim of raw.resourceClaims) {
    // `pods` is part of the claim: one governed value times its replica count.
    const pods = claim.pods ?? 1;
    add(claim.dir, (claim.cpuMillis[rung] ?? 0) * pods, (claim.memoryMib[rung] ?? 0) * pods);
  }
  // An ungoverned app is measured but not laddered, so it contributes the same
  // number at every rung. Additive with the governed rows: the catalogue splits
  // some apps across both lists.
  for (const u of raw.ungovernedRequests) add(u.dir, u.cpuMillis, u.memoryMib);
  return { envelope: raw.runnerEnvelope, rows, rungs: raw.resourceProfiles };
}

// ------------------------------------------------------------------- model ---

export interface PartitionModel {
  readonly roster: readonly RosterEntry[];
  readonly byName: ReadonlyMap<string, RosterEntry>;
  readonly deps: ReadonlyMap<string, readonly string[]>;
  readonly catalogue: Catalogue;
  readonly footprints: LaneFootprints;
  readonly rung: string;
}

export interface BuildOptions {
  readonly repoRoot?: string;
  readonly rung?: string;
  /** Drop edges adjudicated `intent`, keeping only observed dependencies. */
  readonly dropIntentEdges?: boolean;
  /** Injected by the tests. */
  readonly roster?: readonly RosterEntry[];
  readonly graph?: DeclaredGraph;
  readonly catalogue?: Catalogue;
  readonly footprints?: LaneFootprints;
}

/**
 * Join the four sources, refusing every mismatch.
 *
 * The refusals are the point. `derive-sync-waves.ts` already requires every
 * Application to be a graph node; this adds the other two joins — a graph node
 * with no rendered footprint, and a rendered Application outside the roster —
 * because a partition that silently omits an app hands a lane a budget it will
 * exceed at pull time, on a runner, where the failure is expensive and the
 * cause is three files away.
 */
export function buildModel(options: BuildOptions = {}): PartitionModel {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const rung = options.rung ?? "dev";
  const roster = options.roster ?? loadRoster(repoRoot);
  const graph = options.graph ?? loadGraph(repoRoot);
  const catalogue = options.catalogue ?? loadCatalogue(rung, repoRoot);
  const footprints =
    options.footprints ?? (JSON.parse(readFileSync(resolve(repoRoot, FOOTPRINTS_PATH), "utf8")) as LaneFootprints);

  if (graph.unadjudicated.length > 0) {
    throw new Error(
      `${GRAPH_PATH}: citation mentions declared intent but spec.intentAdjudication does not answer: ${graph.unadjudicated.join("; ")}`,
    );
  }
  const byName = new Map(roster.map((r) => [r.name, r]));
  const graphNodes = new Set(graph.nodes);
  const missingFromGraph = roster.filter((r) => !graphNodes.has(r.name)).map((r) => r.name);
  if (missingFromGraph.length > 0) {
    throw new Error(`Applications absent from ${GRAPH_PATH}: ${missingFromGraph.join(", ")}`);
  }
  const missingFromRoster = graph.nodes.filter((n) => !byName.has(n));
  if (missingFromRoster.length > 0) {
    throw new Error(`${GRAPH_PATH} nodes with no Application manifest: ${missingFromRoster.join(", ")}`);
  }
  const noRender = roster.filter((r) => footprints.imagesByApp[r.appId] === undefined).map((r) => r.appId);
  if (noRender.length > 0) {
    throw new Error(
      `Applications with no entry in ${FOOTPRINTS_PATH} (re-run measure-lane-footprints.ts): ${noRender.join(", ")}`,
    );
  }

  const deps = new Map<string, readonly string[]>(graph.nodes.map((n) => [n, [] as readonly string[]]));
  for (const e of graph.edges) {
    if (options.dropIntentEdges === true && e.edgeClass === "intent") continue;
    deps.set(e.from, [...(deps.get(e.from) ?? []), e.to]);
  }
  return { roster, byName, deps, catalogue, footprints, rung };
}

// -------------------------------------------------------------- components ---

/**
 * Connected components of the UNDIRECTED graph — the zero-duplication partition.
 *
 * Kept because it is the literal reading of the original observation and
 * because its answer is informative: 15 components, one of them holding 32 of
 * 47 Applications. It is the baseline the closure packing is measured against,
 * not the mechanism the lanes are built from.
 */
export function connectedComponents(model: PartitionModel): readonly (readonly string[])[] {
  const parent = new Map<string, string>([...model.deps.keys()].map((n) => [n, n]));
  const parentOf = (x: string): string => {
    const p = parent.get(x);
    if (p === undefined) throw new Error(`connectedComponents: "${x}" is not a graph node`);
    return p;
  };
  const find = (x: string): string => {
    let root = x;
    while (parentOf(root) !== root) root = parentOf(root);
    let cur = x;
    while (parentOf(cur) !== root) {
      const next = parentOf(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  for (const [from, tos] of model.deps) {
    for (const to of tos) {
      const a = find(from);
      const b = find(to);
      if (a !== b) parent.set(a, b);
    }
  }
  const groups = new Map<string, string[]>();
  for (const n of model.deps.keys()) {
    const root = find(n);
    const bucket = groups.get(root);
    if (bucket === undefined) groups.set(root, [n]);
    else bucket.push(n);
  }
  return [...groups.values()]
    .map((g) => [...g].sort(stringCompare))
    .sort((a, b) => b.length - a.length || stringCompare(a[0] ?? "", b[0] ?? ""));
}

/** An Application plus every dependency reachable from it. Includes itself. */
export function closureOf(model: PartitionModel, name: string): ReadonlySet<string> {
  const seen = new Set<string>();
  const stack = [name];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (cur === undefined || seen.has(cur)) continue;
    seen.add(cur);
    for (const d of model.deps.get(cur) ?? []) stack.push(d);
  }
  return seen;
}

// ----------------------------------------------------------------- pricing ---

export interface Footprint {
  readonly cpuMillis: number;
  readonly memoryMib: number;
  /** Uncompressed on-disk estimate: measured compressed bytes x the ratio. A FLOOR when anything is unpriced. */
  readonly diskGib: number;
  readonly distinctImages: number;
  /** Images whose size the registry would not give up. Named, never summed as zero. */
  readonly unmeasurableImages: readonly string[];
  /** Applications with no CPU/memory row in the catalogue. */
  readonly unpricedApps: readonly string[];
}

export function priceSet(model: PartitionModel, names: Iterable<string>): Footprint {
  let cpuMillis = 0;
  let memoryMib = 0;
  const images = new Set<string>();
  const unpricedApps: string[] = [];
  for (const name of names) {
    const entry = model.byName.get(name);
    if (entry === undefined) throw new Error(`priceSet: "${name}" is not in the roster`);
    const row = model.catalogue.rows.get(entry.catalogueKey);
    if (row === undefined) unpricedApps.push(name);
    else {
      cpuMillis += row.cpuMillis;
      memoryMib += row.memoryMib;
    }
    for (const img of model.footprints.imagesByApp[entry.appId] ?? []) images.add(img);
  }
  let bytes = 0;
  const unmeasurableImages: string[] = [];
  for (const img of images) {
    const size = model.footprints.imageSizes[img]?.compressedBytes;
    if (size === undefined || size === null) unmeasurableImages.push(img);
    else bytes += size;
  }
  return {
    cpuMillis,
    memoryMib,
    diskGib: (bytes * model.footprints.compressionRatio) / GIB,
    distinctImages: images.size,
    unmeasurableImages: unmeasurableImages.toSorted(stringCompare),
    unpricedApps: unpricedApps.toSorted(stringCompare),
  };
}

/** A footprint is FULLY priced when nothing in it had to be skipped. */
export function isFullyPriced(f: Footprint): boolean {
  return f.unmeasurableImages.length === 0 && f.unpricedApps.length === 0;
}

/** Strictly inside the budget on all three axes. */
export function fitsBudget(f: Footprint, budget: Budget): boolean {
  return f.cpuMillis <= budget.cpuMillis && f.memoryMib <= budget.memoryMib && f.diskGib <= budget.diskGib;
}

// ----------------------------------------------------------------- packing ---

export interface Lane {
  readonly id: string;
  /** Applications this lane is responsible for testing. */
  readonly assigned: readonly string[];
  /** Everything the lane must bring up: `assigned` plus their transitive dependencies. */
  readonly members: readonly string[];
  readonly footprint: Footprint;
}

export interface Quarantined {
  readonly name: string;
  readonly reason: string;
  readonly footprint: Footprint;
}

export interface Partition {
  readonly rung: string;
  readonly margin: number;
  readonly budget: Budget;
  readonly lanes: readonly Lane[];
  /** Fully priced, but too big for one runner even alone. The self-hosted case. */
  readonly oversize: readonly Quarantined[];
  /** Cannot be priced at all. Never packed, never counted as fitting. */
  readonly unpriced: readonly Quarantined[];
  readonly totalApplications: number;
  readonly coveredApplications: number;
}

export interface PackOptions {
  readonly margin?: number;
}

/**
 * First-fit-decreasing over dependency closures.
 *
 * Bin packing is NP-hard and the cost function here is worse than the classic
 * one — lane cost is the size of a UNION, so adding an app that shares hubs
 * with the lane costs less than adding it to an empty lane, which is precisely
 * the effect that makes closure packing work. FFD is a heuristic and the lane
 * count it returns is an UPPER bound on the optimum, not the optimum. It is
 * chosen for being deterministic and legible: same inputs, same lanes, and a
 * reviewer can follow why each app landed where it did.
 *
 * Ordering is by descending closure disk, ties broken by name, so the result
 * does not depend on `Map` iteration order or on the order manifests were
 * discovered — the DST property this has to have to be a CI matrix source.
 */
/** Why a fully-priced closure was refused a lane, per axis, with both numbers. */
function overBudgetReason(f: Footprint, budget: Budget): string {
  const over: string[] = [];
  if (f.cpuMillis > budget.cpuMillis) over.push(`cpu ${String(f.cpuMillis)}m > ${budget.cpuMillis.toFixed(0)}m`);
  if (f.memoryMib > budget.memoryMib) over.push(`memory ${String(f.memoryMib)}Mi > ${budget.memoryMib.toFixed(0)}Mi`);
  if (f.diskGib > budget.diskGib) over.push(`disk ${f.diskGib.toFixed(2)}Gi > ${budget.diskGib.toFixed(2)}Gi`);
  return over.join("; ");
}

/** Exactly which artifact stops a closure from being priced. Named, so it is fixable. */
function unpricedReason(f: Footprint): string {
  return [
    ...f.unmeasurableImages.map((i) => `unmeasurable image ${i}`),
    ...f.unpricedApps.map((a) => `no CPU/memory row for ${a}`),
  ].join("; ");
}

export function packLanes(model: PartitionModel, options: PackOptions = {}): Partition {
  const margin = options.margin ?? 0.85;
  const budget = budgetOf(model.catalogue.envelope, margin);
  const priced: { name: string; closure: ReadonlySet<string>; footprint: Footprint }[] = [];
  const oversize: Quarantined[] = [];
  const unpriced: Quarantined[] = [];

  for (const entry of model.roster) {
    const closure = closureOf(model, entry.name);
    const footprint = priceSet(model, closure);
    if (!isFullyPriced(footprint)) {
      unpriced.push({ name: entry.name, reason: unpricedReason(footprint), footprint });
      continue;
    }
    if (!fitsBudget(footprint, budget)) {
      oversize.push({ name: entry.name, reason: overBudgetReason(footprint, budget), footprint });
      continue;
    }
    priced.push({ name: entry.name, closure, footprint });
  }

  priced.sort((a, b) => b.footprint.diskGib - a.footprint.diskGib || stringCompare(a.name, b.name));

  const bins: { assigned: string[]; members: Set<string> }[] = [];
  for (const item of priced) {
    let placed = false;
    for (const bin of bins) {
      const trial = new Set([...bin.members, ...item.closure]);
      if (fitsBudget(priceSet(model, trial), budget)) {
        bin.assigned.push(item.name);
        bin.members = trial;
        placed = true;
        break;
      }
    }
    if (!placed) bins.push({ assigned: [item.name], members: new Set(item.closure) });
  }

  const lanes = bins.map((bin, i) => ({
    id: `lane-${String(i + 1)}`,
    assigned: [...bin.assigned].sort(stringCompare),
    members: [...bin.members].sort(stringCompare),
    footprint: priceSet(model, bin.members),
  }));
  const covered = new Set(lanes.flatMap((l) => l.members));
  return {
    rung: model.rung,
    margin,
    budget,
    lanes,
    oversize: oversize.toSorted((a, b) => b.footprint.diskGib - a.footprint.diskGib),
    unpriced: unpriced.toSorted((a, b) => stringCompare(a.name, b.name)),
    totalApplications: model.roster.length,
    coveredApplications: covered.size,
  };
}

/**
 * Every image a lane must pull, deduplicated across its members.
 *
 * This is what turns the disk estimate into a MEASUREMENT. The `diskGib` in a
 * `Footprint` is compressed registry bytes times an aggregate ratio measured
 * over four images — a defensible estimate and nothing more. A lane job that
 * pulls exactly this list and then reads `df` gets the real number for its own
 * lane, on the real runner, with the real containerd. If the estimate is low,
 * that job fills the disk and says so, which is the only way this whole
 * exercise stops resting on x2.67.
 */
export function laneImages(model: PartitionModel, lane: Lane): readonly string[] {
  const out = new Set<string>();
  for (const member of lane.members) {
    const entry = model.byName.get(member);
    if (entry === undefined) throw new Error(`laneImages: "${member}" is not in the roster`);
    for (const img of model.footprints.imagesByApp[entry.appId] ?? []) out.add(img);
  }
  return [...out].sort(stringCompare);
}

/**
 * An ArgoCD `directory.exclude` glob that leaves ONLY this lane's members.
 *
 * The dev root already selects its subset this way (`app-of-apps-discovery.ts`
 * reads `spec.source.directory.exclude`), so a lane is brought up by the
 * mechanism the tree already has rather than by a new one. Derived from the
 * roster, so an Application added tomorrow is excluded from every lane that
 * does not claim it instead of silently joining all of them.
 */
export function laneRootExclude(model: PartitionModel, lane: Lane): string {
  const members = new Set(lane.members);
  const excluded = model.roster
    .filter((r) => !members.has(r.name))
    .map((r) => `${r.dir}/Application.yaml`)
    .sort(stringCompare);
  return `{${excluded.join(",")}}`;
}

/**
 * The GitHub Actions matrix, derived from the partition and nothing else.
 *
 * Derived rather than hand-listed on purpose. A hand-written shard list drifts
 * from the dependency data the first time someone adds an Application, and this
 * repo has already been bitten by exactly that shape — a glob deferring nine
 * directories while a registry reasoned about five, both reporting green. Here,
 * a new Application changes the matrix on the next run without anyone editing
 * the workflow, and an Application that cannot be priced does not silently
 * acquire a lane: it appears in `unpriced` and in no lane at all.
 */
export function toMatrix(partition: Partition): { lane: string; apps: string; members: string }[] {
  return partition.lanes.map((l) => ({
    lane: l.id,
    apps: l.assigned.join(","),
    members: l.members.join(","),
  }));
}

// --------------------------------------------------------------------- cli ---

function argValue(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? (process.argv[i + 1] ?? fallback) : fallback;
}

if (import.meta.main) {
  const rung = argValue("--rung", "dev");
  const margin = Number(argValue("--margin", "0.85"));
  const dropIntent = process.argv.includes("--drop-intent-edges");
  const model = buildModel({ rung, dropIntentEdges: dropIntent });

  if (process.argv.includes("--components")) {
    const comps = connectedComponents(model);
    console.log(`connected components (undirected, zero-duplication baseline): ${String(comps.length)}`);
    for (const c of comps) console.log(`  [${String(c.length)}] ${c.join(" ")}`);
    process.exit(0);
  }

  const partition = packLanes(model, { margin });
  if (process.argv.includes("--matrix")) {
    console.log(JSON.stringify(toMatrix(partition)));
    process.exit(0);
  }

  const laneId = argValue("--lane", "");
  if (laneId !== "") {
    const lane = partition.lanes.find((l) => l.id === laneId);
    // A named lane that does not exist is a REFUSAL, not an empty list. An
    // empty image list would let a lane job pull nothing and report green.
    if (lane === undefined) {
      console.error(`no such lane "${laneId}"; this partition has ${partition.lanes.map((l) => l.id).join(", ")}`);
      process.exit(1);
    }
    if (process.argv.includes("--images")) {
      for (const img of laneImages(model, lane)) console.log(img);
      process.exit(0);
    }
    if (process.argv.includes("--root-exclude")) {
      console.log(laneRootExclude(model, lane));
      process.exit(0);
    }
    if (process.argv.includes("--budget-gib")) {
      console.log(partition.budget.diskGib.toFixed(3));
      process.exit(0);
    }
    console.error("--lane needs one of --images / --root-exclude / --budget-gib");
    process.exit(2);
  }

  const n = (v: number): string => String(v);
  const b = partition.budget;
  const all = priceSet(
    model,
    model.roster.map((r) => r.name),
  );
  console.log(`rung=${partition.rung}  margin=${n(partition.margin)}  runner="${model.catalogue.envelope.runner}"`);
  console.log(`budget per lane: ${b.cpuMillis.toFixed(0)}m / ${b.memoryMib.toFixed(0)}Mi / ${b.diskGib.toFixed(2)}Gi`);
  console.log(
    `all ${n(model.roster.length)} together: ${n(all.cpuMillis)}m / ${n(all.memoryMib)}Mi / ${all.diskGib.toFixed(1)}Gi` +
      ` over ${n(all.distinctImages)} images (${n(all.unmeasurableImages.length)} unmeasurable — the total is a FLOOR)`,
  );
  console.log(`\nLANES: ${n(partition.lanes.length)}`);
  for (const lane of partition.lanes) {
    const f = lane.footprint;
    console.log(
      `  ${lane.id}: ${n(f.cpuMillis).padStart(5)}m ${n(f.memoryMib).padStart(5)}Mi ${f.diskGib.toFixed(2).padStart(6)}Gi` +
        `  (${n(lane.members.length)} apps, ${n(f.distinctImages)} images)`,
    );
    console.log(`    assigned: ${lane.assigned.join(" ")}`);
    const extra = lane.members.filter((m) => !lane.assigned.includes(m));
    console.log(`    replicated deps: ${extra.length > 0 ? extra.join(" ") : "(none)"}`);
  }
  console.log(`\nTOO BIG FOR ONE HOSTED RUNNER, ALONE: ${n(partition.oversize.length)}`);
  for (const q of partition.oversize) console.log(`  ${q.name}: ${q.reason}`);
  console.log(`\nCANNOT BE PRICED (never packed): ${n(partition.unpriced.length)}`);
  for (const q of partition.unpriced) console.log(`  ${q.name}: ${q.reason}`);
  console.log(
    `\ncovered by a lane: ${n(partition.coveredApplications)}/${n(partition.totalApplications)}` +
      `  |  quarantined: ${n(partition.oversize.length)} oversize + ${n(partition.unpriced.length)} unpriced`,
  );
}
