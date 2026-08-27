import { describe, expect, it } from "bun:test";
import {
  buildAdjacency,
  clusteringCoefficient,
  computeTopologyMetrics,
  connectedComponents,
  largestComponentPathStats,
  nodeDegrees,
  reciprocity,
  smallWorldSigma,
  type MetricEdge,
} from "./swarm-graph-metrics.ts";

// Topology fixtures with hand-verifiable metrics. Each metric is checked
// against a graph whose value is known by construction — drift in the math
// turns these red rather than silently mis-drawing the swarm.

const triangle: MetricEdge[] = [
  { source: "a", target: "b", weight: 1 },
  { source: "b", target: "c", weight: 1 },
  { source: "c", target: "a", weight: 1 },
];
const star: MetricEdge[] = [
  { source: "hub", target: "a", weight: 1 },
  { source: "hub", target: "b", weight: 1 },
  { source: "hub", target: "c", weight: 1 },
];
const path: MetricEdge[] = [
  { source: "a", target: "b", weight: 1 },
  { source: "b", target: "c", weight: 1 },
];

describe("buildAdjacency", () => {
  it("is symmetric and drops self-loops", () => {
    const adj = buildAdjacency(["a", "b"], [
      { source: "a", target: "b", weight: 1 },
      { source: "a", target: "a", weight: 9 },
    ]);
    expect(adj.get("a")).toEqual(new Set(["b"]));
    expect(adj.get("b")).toEqual(new Set(["a"]));
    expect(adj.get("a")?.has("a")).toBe(false);
  });
});

describe("nodeDegrees", () => {
  it("counts distinct neighbours and sums weights (strength)", () => {
    const degs = nodeDegrees(["hub", "a", "b", "c"], [
      { source: "hub", target: "a", weight: 2 },
      { source: "hub", target: "b", weight: 3 },
      { source: "hub", target: "b", weight: 5 }, // parallel multi-channel edge
    ]);
    const hub = degs.find((d) => d.id === "hub")!;
    expect(hub.degree).toBe(2); // a, b — distinct neighbours
    expect(hub.strength).toBe(10); // 2 + 3 + 5
    expect(degs.find((d) => d.id === "c")!.degree).toBe(0);
  });
});

describe("clusteringCoefficient", () => {
  it("is 1 for a triangle (every triple closes)", () => {
    expect(clusteringCoefficient(["a", "b", "c"], triangle)).toBe(1);
  });
  it("is 0 for a star (the hub's neighbours never touch)", () => {
    expect(clusteringCoefficient(["hub", "a", "b", "c"], star)).toBe(0);
  });
  it("is 0 for a path (no closed triple)", () => {
    expect(clusteringCoefficient(["a", "b", "c"], path)).toBe(0);
  });
  it("is 0 (not NaN) for an edgeless graph", () => {
    expect(clusteringCoefficient(["a", "b"], [])).toBe(0);
  });
});

describe("connectedComponents", () => {
  it("splits disjoint subgraphs and orders largest first", () => {
    const edges: MetricEdge[] = [
      { source: "a", target: "b", weight: 1 },
      { source: "b", target: "c", weight: 1 },
      { source: "x", target: "y", weight: 1 },
      // "lonely" is isolated
    ];
    const comps = connectedComponents(["a", "b", "c", "x", "y", "lonely"], edges);
    expect(comps.length).toBe(3);
    expect(comps[0]!.length).toBe(3); // {a,b,c}
    expect(comps[2]!.length).toBe(1); // {lonely}
  });
});

describe("largestComponentPathStats", () => {
  it("path a-b-c: mean shortest path = 4/3, diameter = 2", () => {
    const stats = largestComponentPathStats(["a", "b", "c"], path);
    // distances: a-b 1, a-c 2, b-c 1 → mean over ordered pairs = (1+2+1+2+1+1... )
    // ordered: a→b1 a→c2 b→a1 b→c1 c→a2 c→b1 = 8 / 6 = 1.333...
    expect(stats.averagePathLength).toBeCloseTo(8 / 6, 6);
    expect(stats.diameter).toBe(2);
    expect(stats.size).toBe(3);
  });
  it("triangle: mean shortest path = 1, diameter = 1", () => {
    const stats = largestComponentPathStats(["a", "b", "c"], triangle);
    expect(stats.averagePathLength).toBe(1);
    expect(stats.diameter).toBe(1);
  });
  it("returns null for a component smaller than two nodes", () => {
    const stats = largestComponentPathStats(["solo"], []);
    expect(stats.averagePathLength).toBeNull();
    expect(stats.diameter).toBeNull();
  });
});

describe("reciprocity", () => {
  it("is 1 when every directed edge has its reverse", () => {
    expect(
      reciprocity([
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ]),
    ).toBe(1);
  });
  it("is 0 for a one-way channel", () => {
    expect(reciprocity([{ from: "a", to: "b" }])).toBe(0);
  });
  it("ignores self-directed pairs and dedupes", () => {
    expect(
      reciprocity([
        { from: "a", to: "a" },
        { from: "a", to: "b" },
        { from: "a", to: "b" },
      ]),
    ).toBe(0);
  });
});

describe("computeTopologyMetrics", () => {
  it("triangle is a fully-dense, fully-clustered, single component", () => {
    const m = computeTopologyMetrics(["a", "b", "c"], triangle);
    expect(m.nodeCount).toBe(3);
    expect(m.edgeCount).toBe(3);
    expect(m.density).toBe(1);
    expect(m.clusteringCoefficient).toBe(1);
    expect(m.averagePathLength).toBe(1);
    expect(m.componentCount).toBe(1);
    expect(m.largestComponentSize).toBe(3);
  });
  it("collapses parallel multi-channel edges to one topological edge", () => {
    const m = computeTopologyMetrics(["a", "b"], [
      { source: "a", target: "b", weight: 1 },
      { source: "a", target: "b", weight: 4 },
    ]);
    expect(m.edgeCount).toBe(1);
    expect(m.meanEdgeWeight).toBe(5); // total volume 1+4 over the single collapsed pair
    expect(m.density).toBe(1);
  });
});

describe("smallWorldSigma", () => {
  it("is null when the graph is too small or path length is undefined", () => {
    const m = computeTopologyMetrics(["a", "b"], [{ source: "a", target: "b", weight: 1 }]);
    expect(smallWorldSigma(m)).toBeNull();
  });
  it("returns a positive number for a clustered, connected graph", () => {
    // Two triangles sharing a node → clustered + connected, N=5.
    const edges: MetricEdge[] = [
      { source: "a", target: "b", weight: 1 },
      { source: "b", target: "c", weight: 1 },
      { source: "c", target: "a", weight: 1 },
      { source: "c", target: "d", weight: 1 },
      { source: "d", target: "e", weight: 1 },
      { source: "e", target: "c", weight: 1 },
    ];
    const m = computeTopologyMetrics(["a", "b", "c", "d", "e"], edges);
    const sigma = smallWorldSigma(m);
    expect(sigma).not.toBeNull();
    expect(sigma!).toBeGreaterThan(0);
  });
});
