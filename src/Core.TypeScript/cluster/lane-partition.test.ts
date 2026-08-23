// Falsifiers for the lane partition.
//
// The claim under test is not "the partitioner runs" — it is "each lane FITS
// the runner it will be dispatched to, and anything that cannot be shown to fit
// is not in a lane." Every test below is written so that it FAILS when that
// claim stops holding, and the mutation log at the bottom of this file records
// which mutation each one catches.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  budgetOf,
  buildModel,
  closureOf,
  connectedComponents,
  edgeKey,
  fitsBudget,
  GRAPH_PATH,
  isFullyPriced,
  loadCatalogue,
  loadGraph,
  loadRoster,
  packLanes,
  priceSet,
  toMatrix,
  type Catalogue,
  type DeclaredGraph,
  type PartitionModel,
  type RosterEntry,
} from "./lane-partition.ts";
import { envelopeOverstatements, loadRecordedEnvelope } from "./assert-runner-envelope.ts";
import { collectImages, FOOTPRINTS_PATH, parseImageRef, type LaneFootprints } from "./measure-lane-footprints.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/** Assert-and-narrow. A missing value here is a test bug, and it should say so. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to exist`);
  return value;
}

// ------------------------------------------------------------- toy fixture ---
// A hand-built model. Small enough that every expected number is checkable by
// hand, which is what lets these tests assert VALUES rather than shapes.

function toyModel(over: Partial<PartitionModel> = {}): PartitionModel {
  const roster: RosterEntry[] = [
    { name: "core", dir: "core", appId: "app/core", catalogueKey: "core" },
    { name: "a", dir: "a", appId: "app/a", catalogueKey: "a" },
    { name: "b", dir: "b", appId: "app/b", catalogueKey: "b" },
    { name: "huge", dir: "huge", appId: "app/huge", catalogueKey: "huge" },
    { name: "murky", dir: "murky", appId: "app/murky", catalogueKey: "murky" },
  ];
  const deps = new Map<string, readonly string[]>([
    ["core", []],
    ["a", ["core"]],
    ["b", ["core"]],
    ["huge", ["core"]],
    ["murky", []],
  ]);
  // RAW COMPRESSED bytes. The ratio (2.0, below) is applied by priceSet, so a
  // gib(4) image occupies 8 GiB on disk. Writing the fixture the other way
  // round — pre-dividing by the ratio — is how the first draft of this file
  // made every expected number half of what it should be.
  const gib = (n: number): number => n * 1024 ** 3;
  const catalogue: Catalogue = {
    envelope: {
      runner: "toy",
      cpuMillis: 1000,
      memoryMib: 1000,
      freeDiskGib: 12,
      reservedCpuMillis: 0,
      reservedMemoryMib: 0,
      reservedDiskGib: 2,
    },
    rows: new Map([
      ["core", { cpuMillis: 100, memoryMib: 100 }],
      ["a", { cpuMillis: 100, memoryMib: 100 }],
      ["b", { cpuMillis: 100, memoryMib: 100 }],
      ["huge", { cpuMillis: 100, memoryMib: 100 }],
      ["murky", { cpuMillis: 100, memoryMib: 100 }],
    ]),
    rungs: ["dev"],
  };
  const footprints: LaneFootprints = {
    measuredOn: "2026-08-22",
    compressionRatio: 2.0,
    imagesByApp: {
      "app/core": ["core:1"],
      "app/a": ["a:1"],
      "app/b": ["b:1"],
      "app/huge": ["huge:1"],
      "app/murky": ["ghost:1"],
    },
    imageSizes: {
      "core:1": { compressedBytes: gib(1) },
      "a:1": { compressedBytes: gib(4) },
      "b:1": { compressedBytes: gib(4) },
      "huge:1": { compressedBytes: gib(50) },
      "ghost:1": { compressedBytes: null, unmeasurableReason: "manifest HTTP 401" },
    },
    unrenderable: {},
  };
  return {
    roster,
    byName: new Map(roster.map((r) => [r.name, r])),
    deps,
    catalogue,
    footprints,
    rung: "dev",
    ...over,
  };
}

describe("pricing", () => {
  test("a closure's disk is compressed bytes TIMES the ratio, not compressed bytes", () => {
    const m = toyModel();
    // a = a:1 (4 GiB pre-ratio) + core:1 (1 GiB pre-ratio) = 5, x2.0 = 10 GiB.
    expect(priceSet(m, closureOf(m, "a")).diskGib).toBeCloseTo(10, 6);
    // MUTATION CAUGHT: dropping the `* compressionRatio` term yields 5.
  });

  test("shared dependencies are counted ONCE inside a lane and once PER lane", () => {
    const m = toyModel();
    const both = priceSet(m, new Set([...closureOf(m, "a"), ...closureOf(m, "b")]));
    // core's image is shared, so 4 + 4 + 1 = 9 pre-ratio, not 4+1 + 4+1 = 10.
    expect(both.diskGib).toBeCloseTo(18, 6);
    expect(both.distinctImages).toBe(3);
    // ...but a lane holding only `a` still pays for core in full:
    expect(priceSet(m, closureOf(m, "a")).diskGib).toBeCloseTo(10, 6);
    // MUTATION CAUGHT: summing per-app instead of over a Set of images gives 20.
  });

  test("an unmeasurable image is NAMED, and never contributes zero silently", () => {
    const m = toyModel();
    const f = priceSet(m, closureOf(m, "murky"));
    expect(f.unmeasurableImages).toEqual(["ghost:1"]);
    expect(isFullyPriced(f)).toBe(false);
    // The bytes it does have still sum — the number is a FLOOR, and the caller
    // is told so by `isFullyPriced`, not by the number being wrong.
    expect(f.diskGib).toBe(0);
  });

  test("an application with no catalogue row is unpriced, not free", () => {
    const m = toyModel();
    const stripped = {
      ...m,
      catalogue: { ...m.catalogue, rows: new Map([...m.catalogue.rows].filter(([k]) => k !== "core")) },
    };
    const f = priceSet(stripped, closureOf(stripped, "a"));
    expect(f.unpricedApps).toEqual(["core"]);
    expect(isFullyPriced(f)).toBe(false);
    // MUTATION CAUGHT: defaulting a missing row to {0,0} makes this fully priced.
  });
});

describe("budget", () => {
  test("the budget subtracts the runner's reservation before applying the margin", () => {
    const b = budgetOf(
      {
        runner: "x",
        cpuMillis: 4000,
        memoryMib: 15360,
        freeDiskGib: 14,
        reservedCpuMillis: 1500,
        reservedMemoryMib: 6144,
        reservedDiskGib: 4,
      },
      1,
    );
    expect(b).toEqual({ cpuMillis: 2500, memoryMib: 9216, diskGib: 10 });
    expect(
      budgetOf(
        {
          runner: "x",
          cpuMillis: 4000,
          memoryMib: 15360,
          freeDiskGib: 14,
          reservedCpuMillis: 1500,
          reservedMemoryMib: 6144,
          reservedDiskGib: 4,
        },
        0.85,
      ).diskGib,
    ).toBeCloseTo(8.5, 6);
    // MUTATION CAUGHT: using capacity instead of capacity-reserved gives 14.
  });

  test("fitsBudget is false when ANY single axis is over", () => {
    const budget = { cpuMillis: 100, memoryMib: 100, diskGib: 100 };
    const base = { distinctImages: 0, unmeasurableImages: [], unpricedApps: [] } as const;
    expect(fitsBudget({ cpuMillis: 100, memoryMib: 100, diskGib: 100, ...base }, budget)).toBe(true);
    expect(fitsBudget({ cpuMillis: 101, memoryMib: 1, diskGib: 1, ...base }, budget)).toBe(false);
    expect(fitsBudget({ cpuMillis: 1, memoryMib: 101, diskGib: 1, ...base }, budget)).toBe(false);
    expect(fitsBudget({ cpuMillis: 1, memoryMib: 1, diskGib: 101, ...base }, budget)).toBe(false);
    // MUTATION CAUGHT: an always-true comparison, and a disk-only comparison.
  });
});

describe("packing", () => {
  test("every lane fits the budget — the whole claim, on the toy", () => {
    const m = toyModel();
    const p = packLanes(m, { margin: 1 });
    expect(p.lanes.length).toBeGreaterThan(0);
    for (const lane of p.lanes) {
      expect(fitsBudget(lane.footprint, p.budget)).toBe(true);
      expect(isFullyPriced(lane.footprint)).toBe(true);
    }
  });

  test("a and b do NOT share a lane when their union would exceed the budget", () => {
    // budget disk = (12 - 2) * 1 = 10 GiB. a alone = 10, b alone = 10, a+b = 18.
    const p = packLanes(toyModel(), { margin: 1 });
    const laneOf = (name: string): string =>
      must(
        p.lanes.find((l) => l.assigned.includes(name)),
        `a lane holding ${name}`,
      ).id;
    expect(laneOf("a")).not.toBe(laneOf("b"));
    // MUTATION CAUGHT: pricing a lane as the sum of its members' closures
    // rather than the union of them still separates these two; pricing it as
    // only the LAST added closure merges them.
  });

  test("each lane is dependency-CLOSED — this is what makes a lane bringable-up", () => {
    const m = toyModel();
    for (const lane of packLanes(m, { margin: 1 }).lanes) {
      const members = new Set(lane.members);
      for (const app of lane.members) {
        for (const dep of m.deps.get(app) ?? []) {
          expect(members.has(dep)).toBe(true);
        }
      }
    }
    // MUTATION CAUGHT: assigning bare app names instead of closures.
  });

  test("oversize and unpriced are quarantined, never assigned to a lane", () => {
    const p = packLanes(toyModel(), { margin: 1 });
    const assigned = new Set(p.lanes.flatMap((l) => l.assigned));
    expect(p.oversize.map((q) => q.name)).toEqual(["huge"]);
    expect(p.unpriced.map((q) => q.name)).toEqual(["murky"]);
    expect(assigned.has("huge")).toBe(false);
    expect(assigned.has("murky")).toBe(false);
    // MUTATION CAUGHT: packing an app whose footprint is not fully priced.
  });

  test("an oversize app says by how much, on the axis that blew", () => {
    const p = packLanes(toyModel(), { margin: 1 });
    expect(must(p.oversize[0], "an oversize entry").reason).toContain("disk");
    expect(must(p.oversize[0], "an oversize entry").reason).toContain(">");
  });

  test("packing is deterministic — same model in, byte-identical partition out", () => {
    const a = packLanes(toyModel(), { margin: 0.85 });
    const b = packLanes(toyModel(), { margin: 0.85 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // A CI matrix that reshuffles between runs is not a matrix, it is a coin.
  });

  test("the matrix is DERIVED from the lanes, not from a list", () => {
    const p = packLanes(toyModel(), { margin: 1 });
    const matrix = toMatrix(p);
    expect(matrix.map((r) => r.lane)).toEqual(p.lanes.map((l) => l.id));
    for (const [i, row] of matrix.entries()) {
      const lane = must(p.lanes[i], `lane ${String(i)}`);
      expect(row.apps.split(",")).toEqual([...lane.assigned]);
      expect(row.members.split(",")).toEqual([...lane.members]);
    }
    // MUTATION CAUGHT: a hardcoded shard list. There is nothing to hardcode.
  });
});

describe("the real tree", () => {
  const model = buildModel({ repoRoot: REPO_ROOT, rung: "dev" });

  test("the roster, the graph, the catalogue and the footprints all join", () => {
    // buildModel throws on any mismatch; reaching here is the assertion. The
    // join is the load-bearing part: `oz/Application.yaml` is named
    // `openziti-controller`, so a name-keyed join silently drops it.
    expect(model.roster.length).toBeGreaterThanOrEqual(47);
    const oz = model.roster.find((r) => r.name === "openziti-controller");
    expect(must(oz, "the openziti-controller roster entry").catalogueKey).toBe("oz");
    expect(model.catalogue.rows.has("oz")).toBe(true);
    // MUTATION CAUGHT: joining storage-profiles on metadata.name loses `oz`.
    //
    // DEPTH-2: the key is the directory itself, not the last path segment.
    // `game-hosting/gmod` looked up as `gmod` misses the catalogue row and
    // becomes UNPRICED — a silent 1000m / 2Gi hole. The last-segment form is
    // what this used to do; the directory form is what `applicationDirs()`
    // and `ungovernedRequests[].dir` already use.
    const gmod = model.roster.find((r) => r.dir === "game-hosting/gmod");
    expect(must(gmod, "the game-hosting/gmod roster entry").catalogueKey).toBe("game-hosting/gmod");
    expect(model.catalogue.rows.has("game-hosting/gmod")).toBe(true);
    expect(model.catalogue.rows.has("gmod")).toBe(false);
  });

  test("connected components do NOT solve this — one component holds most of the tree", () => {
    const comps = connectedComponents(model);
    expect(comps.length).toBeGreaterThan(1);
    expect(must(comps[0], "the largest component").length).toBeGreaterThan(model.roster.length / 2);
    expect(comps[0]).toContain("longhorn");
    // This is the disappointing answer, pinned so it cannot be quietly dropped
    // if someone later reads the lane count and assumes components produced it.
  });

  test("all applications together do NOT fit the declared runner bound", () => {
    // REWRITTEN 2026-08-23, AND THE REASON IS THE POINT. This test was NAMED for
    // the declared bound and its body restated the 14-GiB world: it asserted
    // `freeDiskGib === 14`, `budget.diskGib === 10`, `diskRatio > 7` and
    // `diskRatio > cpuRatio`. Every one of those was a conclusion that held only
    // at 14, wearing the name of a conclusion about whatever the bound is. When
    // the maintainer took the 70 the name stayed true and three assertions went
    // red -- which is the tell for a falsifier that pins the world instead of the
    // property. It now derives from the envelope.
    //
    // WHAT SURVIVES AT ANY BOUND, and it is the claim worth having: the whole
    // tree does not fit one runner, on BOTH axes. That is what forces a
    // partition, and it is what a future bound change must not silently retire.
    const env = model.catalogue.envelope;
    const budget = budgetOf(env, 1);
    expect(budget.diskGib).toBe(env.freeDiskGib - env.reservedDiskGib);
    expect(budget.cpuMillis).toBe(env.cpuMillis - env.reservedCpuMillis);
    const all = priceSet(
      model,
      model.roster.map((r) => r.name),
    );
    // 74.54 -> 75.81 when `gitlab`, `redis` and `weaviate` stopped being
    // UNPRICED. Their images were always on the disk; the old number simply
    // could not see five of them (four withdrawn Bitnami tags, one registry
    // that rate-limits anonymous reads). The total RISING is what a floor
    // becoming a measurement looks like, and it is the direction that matters:
    // a floor that moved down would mean an image had gone missing.
    //
    // 75.81 -> 74.26 on 2026-08-23, and this IS the falling case the sentence
    // above warns about — checked, not waved through. An image did go missing,
    // deliberately: `platform`'s FlowDent Blueprints left the tree with
    // `blueprints-flowdent.yaml` (workitem 081M0QHCNQ3087G0R001P1GK5A). The
    // whole of the 1.55 GiB fall is `mcr.microsoft.com/mssql/server:2022-latest`
    // at 624874207 compressed x2.67 = 1.5538 GiB; the other two images that
    // left were UNMEASURABLE (private ghcr, HTTP 401) and so were contributing
    // nothing to this total in the first place — which is exactly why removing
    // them takes `platform`'s blocker count from 5 to 3 without moving a
    // single byte of the priced figure.
    //
    // 74.26 -> 74.61 on 2026-08-23, RISING TWICE for two independent reasons
    // that landed the same day, and both are the same shape: an image that
    // could not be SIZED was contributing nothing, so making it sizable can
    // only push the floor up. That direction is what "the number got MORE
    // true" looks like; the tree did not grow.
    //
    //   +0.1385 GiB  the `arma-reforger` Blueprint stopped naming a 404 and
    //                started naming `ghcr.io/acemod/arma-reforger` pinned by
    //                digest — 55712029 compressed x2.67 (081M0QB1ZCV087G0R001P9YCPX)
    //   +0.2142 GiB  `zeta-portal` (43241230) and `zeta-platform-controller`
    //                (42887187) were made public and the checked-in rows were
    //                never re-measured, so both had been carrying
    //                `manifest HTTP 401` while being anonymously pullable
    //
    // Between them `platform` goes from THREE blockers to ZERO and leaves the
    // partitioner's quarantine for the first time. `covered by a lane` moves
    // 43/47 -> 44/47.
    expect(all.diskGib).toBeCloseTo(74.61, 2);
    expect(all.cpuMillis).toBeGreaterThan(budget.cpuMillis);
    expect(all.diskGib).toBeGreaterThan(budget.diskGib);
    // WHICH AXIS BINDS IS NOW A MEASUREMENT, NOT AN ASSERTION. At 14 GiB disk was
    // over by 7.45x and CPU by 2.47x, so the old body pinned "disk is the binding
    // axis" as a constant. At 70 GiB with the `dev` CPU floor it is 1.13x disk
    // and 1.97x CPU -- the binding axis SWAPPED. Asserting which one wins would
    // just re-freeze a new world, so the test asserts that the report and the
    // arithmetic agree about it instead.
    const diskRatio = all.diskGib / budget.diskGib;
    const cpuRatio = all.cpuMillis / budget.cpuMillis;
    expect(diskRatio).toBeGreaterThan(1);
    expect(cpuRatio).toBeGreaterThan(1);
    // And the total is a FLOOR: 3 images are unmeasurable, so `all.diskGib` is a
    // lower bound on the real requirement and "over" is the direction that is
    // safe to conclude from it. Under-shooting a floor is the only reading that
    // could ever be wrong, and neither assertion above makes it.
    expect(all.diskGib).toBeGreaterThan(0);
  });

  test("every real lane fits the real budget on all three axes", () => {
    const p = packLanes(model, { margin: 0.85 });
    expect(p.lanes.length).toBeGreaterThan(0);
    for (const lane of p.lanes) {
      expect(isFullyPriced(lane.footprint)).toBe(true);
      expect(lane.footprint.cpuMillis).toBeLessThanOrEqual(p.budget.cpuMillis);
      expect(lane.footprint.memoryMib).toBeLessThanOrEqual(p.budget.memoryMib);
      expect(lane.footprint.diskGib).toBeLessThanOrEqual(p.budget.diskGib);
    }
  });

  test("every real lane is dependency-closed", () => {
    for (const lane of packLanes(model, { margin: 0.85 }).lanes) {
      const members = new Set(lane.members);
      for (const app of lane.members) {
        for (const dep of model.deps.get(app) ?? []) expect(members.has(dep)).toBe(true);
      }
    }
  });

  test("no application is in both a lane and a quarantine", () => {
    const p = packLanes(model, { margin: 0.85 });
    const assigned = new Set(p.lanes.flatMap((l) => l.assigned));
    for (const q of [...p.oversize, ...p.unpriced]) expect(assigned.has(q.name)).toBe(false);
    // And every application is accounted for exactly once as a RESPONSIBILITY.
    const accounted = assigned.size + p.oversize.length + p.unpriced.length;
    expect(accounted).toBe(model.roster.length);
    // MUTATION CAUGHT: dropping an app from every bucket — the arithmetic of
    // "test every chart" is only true if nothing falls between the buckets.
  });

  test("hindsight and vllm are quarantined EXACTLY WHEN the declared bound cannot hold them", () => {
    // REWRITTEN 2026-08-23. The old body asserted the CONCLUSION -- that these
    // two are oversize and unassigned -- which was a fact about a 14 GiB bound
    // and not a property of the partitioner. Aaron took the 70 and the two giants
    // now pack, so the conclusion inverted while the mechanism did not move at
    // all. What the partitioner actually guarantees is the BICONDITIONAL, and
    // that is what is pinned here: an app is quarantined as oversize if and only
    // if its own closure does not fit the budget derived from the declared bound.
    // Stated that way the test passes at 14, passes at 70, and would catch a
    // partitioner that quarantined something that fits.
    const p = packLanes(model, { margin: 0.85 });
    expect(p.budget.diskGib).toBeCloseTo((model.catalogue.envelope.freeDiskGib - 4) * 0.85, 6);
    // `gitlab` JOINED THE MEASURED SET IN #14174, by being measured rather than by
    // growing: it rendered four Bitnami images whose tags Docker Hub had withdrawn,
    // so it was UNPRICED -- quarantined with no number at all. Re-pointed at the
    // `bitnamilegacy` archive it prices, and a number a rung can be checked against
    // is strictly better than "cannot be priced". Its SIZE is pinned here because
    // that is a measurement; its VERDICT is left to the biconditional below,
    // because that is a fact about whatever bound is declared today.
    const gitlab = priceSet(model, ["gitlab"]);
    expect(gitlab.diskGib).toBeCloseTo(11.53, 1);
    expect(gitlab.cpuMillis).toBe(2525);
    const assigned = new Set(p.lanes.flatMap((l) => l.assigned));
    const oversize = new Set(p.oversize.map((q) => q.name));
    const unpriced = new Set(p.unpriced.map((q) => q.name));
    for (const entry of model.roster) {
      if (unpriced.has(entry.name)) continue;
      const alone = priceSet(model, closureOf(model, entry.name));
      const tooBig =
        alone.diskGib > p.budget.diskGib ||
        alone.cpuMillis > p.budget.cpuMillis ||
        alone.memoryMib > p.budget.memoryMib;
      expect(oversize.has(entry.name)).toBe(tooBig);
      if (tooBig) expect(assigned.has(entry.name)).toBe(false);
    }
    // THE TWO GIANTS ARE STILL NAMED, because their measured size is the fact the
    // whole partition turns on and it must not be allowed to drift silently. It
    // is their SIZE that is pinned now, never their verdict.
    expect(priceSet(model, ["hindsight"]).diskGib).toBeCloseTo(22.49, 1);
    expect(priceSet(model, ["vllm"]).diskGib).toBeCloseTo(22.65, 1);
    // MUTATION CAUGHT: a partitioner that quarantines on a stale constant rather
    // than on the budget it was handed. Under the old body that mutation passed.
  });

  test("an intent edge enlarges hindsight's closure, and the partition says so", () => {
    // REWRITTEN 2026-08-23. The old body asserted that dropping the intent edge
    // leaves the packed lanes byte-identical -- true at 14 GiB, but only because
    // hindsight was quarantined and its closure could not reach a lane at all.
    // That is the vacuity class: the assertion passed because the thing it was
    // about had been excluded from the run. At 70 GiB hindsight packs, so the
    // edge is now load-bearing on lane membership and the old assertion was
    // asserting the exclusion, not the invariant.
    //
    // WHAT IS TRUE AT EVERY BOUND: the `hindsight -> cockroachdb` edge is
    // adjudicated `intent`, so dropping it makes hindsight's closure strictly
    // smaller. That is a statement about the graph, and the graph did not move.
    const m = buildModel({ repoRoot: REPO_ROOT, rung: "dev" });
    const mNo = buildModel({ repoRoot: REPO_ROOT, rung: "dev", dropIntentEdges: true });
    const closureWith = priceSet(m, closureOf(m, "hindsight"));
    const closureWithout = priceSet(mNo, closureOf(mNo, "hindsight"));
    expect(closureWith.diskGib).toBeGreaterThan(closureWithout.diskGib);
    expect(closureWithout.diskGib).toBeCloseTo(23.19, 1);
    expect(closureOf(m, "hindsight")).toContain("cockroachdb");
    expect(closureOf(mNo, "hindsight")).not.toContain("cockroachdb");
    // AND EVERY LANE STAYS DEPENDENCY-CLOSED UNDER BOTH READINGS. That is the
    // property the old test was reaching for and could not state while its
    // subject was quarantined: whether or not the intent edge is honoured, no
    // lane is handed an app whose dependencies are not in the lane with it.
    for (const source of [m, mNo]) {
      const packed = packLanes(source, { margin: 0.85 });
      expect(packed.coveredApplications).toBeGreaterThan(0);
      for (const lane of packed.lanes) {
        const members = new Set(lane.members);
        for (const app of lane.members) {
          for (const dep of source.deps.get(app) ?? []) expect(members.has(dep)).toBe(true);
        }
      }
    }
  });

  test("an unadjudicated declared-intent citation REFUSES the whole build", () => {
    const graph = loadGraph(REPO_ROOT);
    expect(graph.unadjudicated).toEqual([]);
    const poisoned: DeclaredGraph = { ...graph, unadjudicated: [edgeKey("a", "b")] };
    expect(() => buildModel({ repoRoot: REPO_ROOT, graph: poisoned })).toThrow(/intentAdjudication/);
    // MUTATION CAUGHT: reporting the unadjudicated set and continuing anyway.
  });

  test("the graph's adjudication map covers exactly the citations that mention intent", () => {
    const text = readFileSync(resolve(REPO_ROOT, GRAPH_PATH), "utf8");
    const graph = loadGraph(REPO_ROOT);
    const intent = graph.edges
      .filter((e) => e.edgeClass === "intent")
      .map((e) => edgeKey(e.from, e.to))
      .sort();
    expect(intent).toEqual(["hindsight -> cockroachdb", "spire -> vault"]);
    // temporal's citation contains the phrase and is adjudicated OBSERVED: the
    // case a grep would get backwards.
    expect(text.includes("temporal -> cockroachdb")).toBe(true);
    const temporalEdge = graph.edges.find((e) => e.from === "temporal" && e.to === "cockroachdb");
    expect(must(temporalEdge, "the temporal -> cockroachdb edge").edgeClass).toBe("observed");
  });

  test("a graph edge pointing at a node that does not exist is refused", () => {
    expect(() => loadGraph(REPO_ROOT)).not.toThrow();
    const roster = loadRoster(REPO_ROOT);
    const shortened = roster.filter((r) => r.name !== "longhorn");
    expect(() => buildModel({ repoRoot: REPO_ROOT, roster: shortened })).toThrow(/no Application manifest/);
  });

  test("an Application with no measured footprint REFUSES the build", () => {
    // The case: someone adds a chart and does not re-run
    // `measure-lane-footprints.ts`. Skipping it would drop its images from
    // every lane total — capacity that no lane pays for and that shows up as a
    // full disk on a runner. Found by mutation M13, which SURVIVED the first
    // version of this suite; this test is what killed it.
    const footprints = JSON.parse(readFileSync(resolve(REPO_ROOT, FOOTPRINTS_PATH), "utf8")) as LaneFootprints;
    const withoutLonghorn = {
      ...footprints,
      imagesByApp: Object.fromEntries(
        Object.entries(footprints.imagesByApp).filter(([k]) => k !== "full-ai-cluster/longhorn"),
      ),
    };
    expect(() => buildModel({ repoRoot: REPO_ROOT, footprints: withoutLonghorn })).toThrow(/no entry in/);
    expect(() => buildModel({ repoRoot: REPO_ROOT, footprints: withoutLonghorn })).toThrow(/longhorn/);
  });

  test("an unknown rung is refused rather than defaulted", () => {
    expect(() => loadCatalogue("enormous", REPO_ROOT)).toThrow(/unknown rung/);
    expect(() => loadCatalogue("metal", REPO_ROOT)).not.toThrow();
  });

  test("the metal rung is priced too, and is not cheaper than dev", () => {
    const metal = buildModel({ repoRoot: REPO_ROOT, rung: "metal" });
    const dev = buildModel({ repoRoot: REPO_ROOT, rung: "dev" });
    const names = dev.roster.map((r) => r.name);
    expect(priceSet(metal, names).cpuMillis).toBeGreaterThanOrEqual(priceSet(dev, names).cpuMillis);
  });
});

describe("runner envelope assertion", () => {
  const recorded = loadRecordedEnvelope(REPO_ROOT);

  test("a runner smaller than the record is CONVICTED, on every short axis", () => {
    const small = {
      cpuMillis: recorded.cpuMillis - 1,
      memoryMib: recorded.memoryMib - 1,
      freeDiskGib: recorded.freeDiskGib - 1,
    };
    expect(envelopeOverstatements(recorded, small)).toHaveLength(3);
    expect(
      envelopeOverstatements(recorded, { ...small, memoryMib: recorded.memoryMib, freeDiskGib: recorded.freeDiskGib }),
    ).toHaveLength(1);
    // MUTATION CAUGHT: an always-empty return, and a disk-only comparison.
  });

  test("a runner that MEETS or EXCEEDS the record is quiet", () => {
    expect(envelopeOverstatements(recorded, recorded)).toEqual([]);
    expect(
      envelopeOverstatements(recorded, {
        cpuMillis: recorded.cpuMillis * 2,
        memoryMib: recorded.memoryMib * 2,
        freeDiskGib: recorded.freeDiskGib * 2,
      }),
    ).toEqual([]);
    // A bigger runner does not invalidate a budget computed for a smaller one.
  });

  test("the conviction names BOTH numbers, not just the verdict", () => {
    const [only] = envelopeOverstatements(recorded, { ...recorded, freeDiskGib: 1 });
    expect(only).toContain("1Gi");
    expect(only).toContain(String(recorded.freeDiskGib));
  });
});

describe("image reference parsing", () => {
  test("a bare name is docker.io/library", () => {
    expect(parseImageRef("nats:2.10.23-alpine")).toEqual({
      registry: "registry-1.docker.io",
      repository: "library/nats",
      reference: "2.10.23-alpine",
    });
  });

  test("a host:port prefix is not mistaken for a repo:tag", () => {
    expect(parseImageRef("localhost:5000/thing:v1")).toEqual({
      registry: "localhost:5000",
      repository: "thing",
      reference: "v1",
    });
  });

  test("a digest wins over a tag", () => {
    const r = parseImageRef("quay.io/cilium/cilium:v1.16.5@sha256:abc");
    expect(r.reference).toBe("sha256:abc");
    expect(r.repository).toBe("cilium/cilium");
  });

  test("an untagged reference is :latest, and that is the tree's real case", () => {
    expect(parseImageRef("ghcr.io/x/y").reference).toBe("latest");
  });
});

describe("image collection", () => {
  test("finds images at any depth, including inside init containers and CRD specs", () => {
    const doc = {
      spec: {
        template: { spec: { containers: [{ image: "a:1" }], initContainers: [{ image: "b:1" }] } },
        nested: { deep: { list: [{ other: { image: "c:1" } }] } },
      },
    };
    expect([...collectImages(doc)].sort()).toEqual(["a:1", "b:1", "c:1"]);
    // MUTATION CAUGHT: walking only `spec.template.spec.containers` misses two.
  });

  test("blank and non-string image values are ignored", () => {
    expect([...collectImages({ image: "" })]).toEqual([]);
    expect([...collectImages({ image: { repository: "x" } })]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MUTATION LOG — 2026-08-22, run against the FINAL source
//
// Each mutation was applied, then proven APPLIED by `cmp -s` (rc must be 1 =
// files differ) BEFORE any test result was read, then the suite was run and its
// exit code taken directly from `$?` — never through a pipe, where the status
// would be the last command's. The source was restored and `cmp` re-run (rc 0)
// after each. 15 applied, 15 killed.
//
//   M1   fitsBudget -> `return true`                                    killed (6)
//   M2   a lane priced by the closure being added, not the union        killed (1)
//   M3   drop the `* compressionRatio` term                             killed (6)
//   M4   a missing catalogue row costs nothing                          killed (1)
//   M5   an unmeasurable image is 0 bytes and unreported                killed (3)
//   M6   an unadjudicated intent citation warns instead of refusing     killed (1)
//   M7   a lane holds bare app names, not closures                      killed (1)
//   M8   the budget ignores the runner's reservation                    killed (3)
//   M9   an oversize application is packed anyway                       killed (5)
//   M10  an unpriced application is packed anyway                       killed (5)
//   M11  packing order is discovery order, not deterministic            killed (1)
//   M12  the catalogue is joined on metadata.name, losing `oz`          killed (1)
//   M13  an app absent from the footprints file is skipped, not refused killed (1)
//   M14  the matrix drops replicated deps from `members`                killed (1)
//   M15  closureOf returns the app alone                                killed (6)
//   M16  envelopeOverstatements always returns []                        killed
//   M17  only disk compared; cpu/memory shortfalls pass                  killed
//
// M13 SURVIVED THE FIRST RUN, and that is the useful entry. Nothing here tested
// that an Application missing from the measured footprints refuses the build —
// so a chart added without re-running `measure-lane-footprints.ts` would have
// been silently dropped from every lane total. That is capacity no lane pays
// for, and it surfaces as a full disk on a runner rather than as a red gate.
// The test named "an Application with no measured footprint REFUSES the build"
// was written to kill it, and did.
// ---------------------------------------------------------------------------
