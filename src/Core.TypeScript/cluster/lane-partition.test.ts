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
    const stripped = { ...m, catalogue: { ...m.catalogue, rows: new Map([...m.catalogue.rows].filter(([k]) => k !== "core")) } };
    const f = priceSet(stripped, closureOf(stripped, "a"));
    expect(f.unpricedApps).toEqual(["core"]);
    expect(isFullyPriced(f)).toBe(false);
    // MUTATION CAUGHT: defaulting a missing row to {0,0} makes this fully priced.
  });
});

describe("budget", () => {
  test("the budget subtracts the runner's reservation before applying the margin", () => {
    const b = budgetOf(
      { runner: "x", cpuMillis: 4000, memoryMib: 15360, freeDiskGib: 14, reservedCpuMillis: 1500, reservedMemoryMib: 6144, reservedDiskGib: 4 },
      1,
    );
    expect(b).toEqual({ cpuMillis: 2500, memoryMib: 9216, diskGib: 10 });
    expect(budgetOf({ runner: "x", cpuMillis: 4000, memoryMib: 15360, freeDiskGib: 14, reservedCpuMillis: 1500, reservedMemoryMib: 6144, reservedDiskGib: 4 }, 0.85).diskGib).toBeCloseTo(8.5, 6);
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
    const laneOf = (name: string): string => must(p.lanes.find((l) => l.assigned.includes(name)), `a lane holding ${name}`).id;
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
    // The lane model intentionally prices against the published 14 GiB bound,
    // not a larger point measurement. The measured 77 GiB observation remains
    // evidence about one runner and must not silently reprice every lane.
    expect(model.catalogue.envelope.freeDiskGib).toBe(14);
    const budget = budgetOf(model.catalogue.envelope, 1);
    expect(budget.diskGib).toBe(10);
    const all = priceSet(model, model.roster.map((r) => r.name));
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
    expect(all.diskGib).toBeCloseTo(74.26, 2);
    expect(all.cpuMillis).toBeGreaterThan(budget.cpuMillis);
    expect(all.diskGib).toBeGreaterThan(budget.diskGib);
    const diskRatio = all.diskGib / budget.diskGib;
    const cpuRatio = all.cpuMillis / budget.cpuMillis;
    expect(cpuRatio).toBeGreaterThan(2);
    expect(diskRatio).toBeGreaterThan(1);
    expect(diskRatio).toBeGreaterThan(7);
    expect(diskRatio).toBeGreaterThan(cpuRatio);
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

  test("hindsight and vllm exceed the declared runner bound and remain quarantined", () => {
    // A larger observed runner can hold these images, but the declared 14 GiB
    // envelope intentionally remains the portable lane-planning constraint.
    const p = packLanes(model, { margin: 0.85 });
    expect(p.budget.diskGib).toBeCloseTo(8.5, 1);
    // `gitlab` JOINED THIS LIST BY BEING MEASURED, not by growing. It rendered
    // four Bitnami images whose tags Docker Hub had withdrawn, so it was
    // UNPRICED -- quarantined with no number at all. Re-pointed at the
    // `bitnamilegacy` archive it prices at 2525m / 11.53Gi, which is over the
    // dev budget on BOTH cpu and disk. Moving from "cannot be priced" to
    // "priced, and too big" is the honest outcome: the first says nothing, the
    // second is a number a larger rung can be checked against.
    expect(p.oversize.map((q) => q.name).sort()).toEqual(["gitlab", "hindsight", "vllm"]);
    const gitlab = priceSet(model, ["gitlab"]);
    expect(gitlab.diskGib).toBeCloseTo(11.53, 1);
    expect(gitlab.cpuMillis).toBe(2525);
    const hindsight = priceSet(model, ["hindsight"]);
    const vllm = priceSet(model, ["vllm"]);
    expect(hindsight.diskGib).toBeCloseTo(22.49, 1);
    expect(vllm.diskGib).toBeCloseTo(22.65, 1);
    expect(hindsight.diskGib).toBeGreaterThan(p.budget.diskGib);
    expect(vllm.diskGib).toBeGreaterThan(p.budget.diskGib);
    const assigned = new Set(p.lanes.flatMap((l) => l.assigned));
    expect(assigned.has("hindsight")).toBe(false);
    expect(assigned.has("vllm")).toBe(false);
  });

  test("at the declared runner bound, intent edges change closure but not the oversize-excluded partition", () => {
    // The intent edge still enlarges hindsight's closure. It cannot move lane
    // membership while hindsight is quarantined as oversize under the declared
    // 14 GiB runner bound.
    const withIntent = packLanes(buildModel({ repoRoot: REPO_ROOT, rung: "dev" }), { margin: 0.85 });
    const without = packLanes(buildModel({ repoRoot: REPO_ROOT, rung: "dev", dropIntentEdges: true }), { margin: 0.85 });
    expect(without.lanes.map((l) => l.members.join(","))).toEqual(withIntent.lanes.map((l) => l.members.join(",")));
    expect(without.coveredApplications).toBe(withIntent.coveredApplications);
    const closureWith = priceSet(buildModel({ repoRoot: REPO_ROOT }), closureOf(buildModel({ repoRoot: REPO_ROOT }), "hindsight"));
    const mNo = buildModel({ repoRoot: REPO_ROOT, dropIntentEdges: true });
    const closureWithout = priceSet(mNo, closureOf(mNo, "hindsight"));
    expect(closureWith.diskGib).toBeGreaterThan(closureWithout.diskGib);
    expect(closureWithout.diskGib).toBeCloseTo(23.19, 1);
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
    const intent = graph.edges.filter((e) => e.edgeClass === "intent").map((e) => edgeKey(e.from, e.to)).sort();
    expect(intent).toEqual(["hindsight -> cockroachdb", "spire -> vault"]);
    // temporal's citation contains the phrase and is adjudicated OBSERVED: the
    // case a grep would get backwards.
    expect(text.includes('temporal -> cockroachdb')).toBe(true);
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
      imagesByApp: Object.fromEntries(Object.entries(footprints.imagesByApp).filter(([k]) => k !== "full-ai-cluster/longhorn")),
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
    const small = { cpuMillis: recorded.cpuMillis - 1, memoryMib: recorded.memoryMib - 1, freeDiskGib: recorded.freeDiskGib - 1 };
    expect(envelopeOverstatements(recorded, small)).toHaveLength(3);
    expect(envelopeOverstatements(recorded, { ...small, memoryMib: recorded.memoryMib, freeDiskGib: recorded.freeDiskGib })).toHaveLength(1);
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
