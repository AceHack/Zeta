// Collation regression for `graphMerkleRoot` — the root must be culture-invariant.
//
// `graphMerkleRoot` sorts the entries and concatenates them into the hash, so the
// COLLATION is part of the proof lineage. It previously used `localeCompare`,
// which is culture-sensitive and linguistic: for mixed-case ASCII it orders
// `["Bravo","acme"]` as `acme, Bravo`, where UTF-16 code-unit order gives
// `Bravo, acme`. Two machines — or two of the language oracles — could therefore
// compute different roots for the same graph. That is the
// 081KT07NV0008QG0R001YDB73K class of defect
// (`.claude/rules/culture-invariant-by-default.md`).
//
// WHY IT SURVIVED 22 EXISTING TESTS: every name in `STUB_REGISTRY` is lowercase
// ASCII, and on lowercase ASCII the two collations agree. The defect is only
// reachable through `applyDelta`, which accepts arbitrary names.
//
// FALSIFIER: these fail against the pre-fix `localeCompare` implementation and
// pass against the ordinal one.

import { describe, it, expect } from "bun:test";
import { emptyGraph, applyDelta, graphMerkleRoot, type DependencyGraph } from "./ace-cli";

/** Independent reference implementation of the documented hash, over an explicit ordinal sort. */
function referenceRoot(rows: ReadonlyArray<readonly [string, string, string, number]>): string {
  const lines = [...rows]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, version, addr, weight]) => `${name}@${version}:${addr}:${weight}`);
  let hash = 0;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      hash = ((hash << 5) - hash + line.charCodeAt(i)) | 0;
    }
  }
  return `zeta:${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

const MIXED = [
  ["Bravo", "sha256:b"],
  ["acme", "sha256:a"],
] as const;

function buildGraph(order: ReadonlyArray<readonly [string, string]>): DependencyGraph {
  let g = emptyGraph;
  for (const [name, contentAddress] of order) {
    g = applyDelta(g, {
      name,
      version: "1.0.0",
      contentAddress,
      deltaWeight: +1,
      packageManager: "ace",
    });
  }
  return g;
}

describe("ACE CLI — Merkle root collation is ordinal, not cultural", () => {
  it("the premise: ordinal and linguistic collation genuinely disagree on this input", () => {
    // Asserted, not assumed. If this ever became true, the tests below would be
    // vacuous — a check that cannot fail is not a check.
    const names = MIXED.map(([n]) => n);
    const ordinal = [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(",");
    const cultural = [...names].sort((a, b) => a.localeCompare(b)).join(",");
    expect(ordinal).toBe("Bravo,acme");
    expect(cultural).toBe("acme,Bravo");
    expect(ordinal).not.toBe(cultural);
  });

  it("ACE-C1: root over mixed-case names matches the ordinal reference", () => {
    expect(graphMerkleRoot(buildGraph(MIXED))).toBe(
      referenceRoot([
        ["Bravo", "1.0.0", "sha256:b", 1],
        ["acme", "1.0.0", "sha256:a", 1],
      ]),
    );
  });

  it("ACE-C2: insertion order does not change the root", () => {
    const forward = graphMerkleRoot(buildGraph(MIXED));
    const reversed = graphMerkleRoot(buildGraph([...MIXED].reverse()));
    expect(reversed).toBe(forward);
  });
});
