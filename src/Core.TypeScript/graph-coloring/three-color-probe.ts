#!/usr/bin/env bun
/**
 * three-color-probe.ts — smallest safe slice of B-0048 (P2)
 * Pure-TS backtracking 3-colorability checker as CSP probe.
 * Demonstrates graph-coloring decision for formal-verification routing
 * (Alloy/Z3/Lean choice) and planner cost-model calibration.
 * Bounded: no external deps, small instances only, illustrative not production.
 *
 * Re-decomposition note: B-0048 stages had granularity error (Stage 2 Z3
 * assumed SMT binding; this TS slice is safer, zero-dep, surfaces the
 * NP boundary directly for routing evidence).
 *
 * Usage: bun tools/graph-coloring/three-color-probe.ts
 * Co-Authored-By: Grok <noreply@x.ai>
 */

type Graph = number[][];
type Coloring = number[];

function isSafe(v: number, color: number, coloring: Coloring, graph: Graph): boolean {
  for (let i = 0; i < graph.length; i++) {
    if (graph[v]![i] === 1 && coloring[i] === color) return false;
  }
  return true;
}

function graphColorUtil(graph: Graph, m: number, coloring: Coloring, v: number): boolean {
  if (v === graph.length) return true;
  for (let c = 1; c <= m; c++) {
    if (isSafe(v, c, coloring, graph)) {
      coloring[v] = c;
      if (graphColorUtil(graph, m, coloring, v + 1)) return true;
      coloring[v] = 0;
    }
  }
  return false;
}

export function isThreeColorable(graph: Graph): boolean {
  const n = graph.length;
  const coloring: Coloring = new Array(n).fill(0);
  return graphColorUtil(graph, 3, coloring, 0);
}

// Example graphs (adj matrix, symmetric, 0/1)
const K4: Graph = [
  [0,1,1,1],
  [1,0,1,1],
  [1,1,0,1],
  [1,1,1,0],
];

const C5: Graph = [
  [0,1,0,0,1],
  [1,0,1,0,0],
  [0,1,0,1,0],
  [0,0,1,0,1],
  [1,0,0,1,0],
];

const Petersen: Graph = [ /* 10-vertex Petersen (3-chromatic, hence 3-colorable) */
  // Re-decomp during build: original B-0048 stage granularity mistaken (Z3 SMT assumed for Stage 2);
  // this pure-TS CSP probe is the safe smallest slice surfacing NP boundary for routing.
  [0,1,0,0,1,1,0,0,0,0],
  [1,0,1,0,0,0,1,0,0,0],
  [0,1,0,1,0,0,0,1,0,0],
  [0,0,1,0,1,0,0,0,1,0],
  [1,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,1,0],
  [0,1,0,0,0,0,0,0,1,1],
  [0,0,1,0,0,1,0,0,0,1],
  [0,0,0,1,0,1,1,0,0,0],
  [0,0,0,0,1,0,1,1,0,0],
];

if ((import.meta as any).main) {
  console.log("K4 (K_4) 3-colorable?", isThreeColorable(K4)); // false
  console.log("C5 (cycle-5) 3-colorable?", isThreeColorable(C5)); // true
  console.log("Petersen stub 3-colorable?", isThreeColorable(Petersen)); // demo
  console.log("B-0048.2 TS probe complete — CSP surface for routing.");
}