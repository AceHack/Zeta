// tier0-disjointness.test.ts — roster TEST, not a 4th certify() law.
//
// Builtin fixtures fire none of these five (identity ∘ identity). A mixed
// tree that fires ≥2 is the control. File-level write-set disjointness on
// that tree is a property of THIS roster-plus-fixture, not of the harness:
// unused-import and exact-optional both filter *.{ts,tsx}. certify() still
// only proves a composite reaches a fixed point, not that every order
// reaches the same one.
//
// Lumen 2026-08-27: do not identify "5 healers commute" with "the algebra
// is an antichain." The discriminating invariant is Bernstein on spans;
// file-level writeSet is a cheap sufficient check. Co-locate the first
// potential critical pair on one .ts so the mixed tree cannot hide it.

import { describe, expect, test } from "bun:test";
import { composeHealers, tree, treesEqual, writeSet, type Detector, type FileTree, type Healer } from "../healer-harness";
import { exactOptionalDetector, exactOptionalHealer } from "./exact-optional-spread";
import { staleDocCrossRefDetector, staleDocCrossRefHealer } from "./stale-doc-cross-ref";
import { staleJsDetector, staleJsHealer } from "./stale-js";
import { unpinnedActionsDetector, unpinnedActionsHealer } from "./unpinned-actions";
import { unusedImportDetector, unusedImportHealer } from "./unused-import";

const TIER0: readonly Healer[] = [
  staleJsHealer,
  unpinnedActionsHealer,
  unusedImportHealer,
  exactOptionalHealer,
  staleDocCrossRefHealer,
];

/** One defect per file — constructs file-disjoint write-sets by fixture design. */
const mixed: FileTree = tree({
  "src/a.ts": 'import { unused } from "./b.ts";\nimport { used } from "./c.ts";\nexport const x = used;\n',
  "src/a.js": "// stale sibling of a.ts\n",
  ".github/workflows/w.yml": "jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n",
  "src/opt.ts": "export const p = {\n  a: flag ? used : undefined,\n};\n",
  "docs/d.md": "See [gone](../src/removed.ts) and [a](../src/a.ts).\n",
});

/** The first potential critical pair mixed cannot see: both write src/a.ts. */
const colocated: FileTree = tree({
  "src/a.ts":
    'import { unused } from "./b.ts";\nimport { used } from "./c.ts";\nexport const p = {\n  a: used ? used : undefined,\n};\nexport const x = used;\n',
});

function firedOn(t: FileTree): readonly Healer[] {
  return TIER0.filter((h) => writeSet(t, h.heal(t)).length > 0);
}

function commuteAll(t: FileTree): void {
  for (let i = 0; i < TIER0.length; i++) {
    for (let j = 0; j < TIER0.length; j++) {
      if (i === j) continue;
      const ab = TIER0[j]!.heal(TIER0[i]!.heal(t));
      const ba = TIER0[i]!.heal(TIER0[j]!.heal(t));
      expect(treesEqual(ab, ba)).toBe(true);
    }
  }
}

describe("Tier-0 mixed trigger (vacuity-guarded, one defect per file)", () => {
  test("at least two healers actually write — otherwise commute is identity", () => {
    expect(firedOn(mixed).length).toBeGreaterThanOrEqual(2);
  });

  test("pairwise file write-sets do not overlap on this fixture", () => {
    const sets = TIER0.map((h) => ({ name: h.name, paths: new Set(writeSet(mixed, h.heal(mixed))) }));
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const inter = [...sets[i]!.paths].filter((p) => sets[j]!.paths.has(p));
        expect(inter).toEqual([]);
      }
    }
  });

  test("all 20 ordered pairs commute (treesEqual, not Map iteration order)", () => {
    commuteAll(mixed);
  });

  test("compose in roster order equals compose in reverse on this fixture", () => {
    const fwd = composeHealers("fwd", TIER0);
    const rev = composeHealers("rev", [...TIER0].reverse());
    expect(treesEqual(fwd.heal(mixed), rev.heal(mixed))).toBe(true);
  });
});

describe("unused-import × exact-optional co-located on one .ts", () => {
  test("both write the same path — the overlap mixed hid by construction", () => {
    const u = new Set(writeSet(colocated, unusedImportHealer.heal(colocated)));
    const e = new Set(writeSet(colocated, exactOptionalHealer.heal(colocated)));
    expect([...u]).toEqual(["src/a.ts"]);
    expect([...e]).toEqual(["src/a.ts"]);
  });

  test("they still commute — file overlap is not a Bernstein W∩W on spans", () => {
    const ue = exactOptionalHealer.heal(unusedImportHealer.heal(colocated));
    const eu = unusedImportHealer.heal(exactOptionalHealer.heal(colocated));
    expect(treesEqual(ue, eu)).toBe(true);
  });
});

/** Join key is Finding.rule, not Healer.name / Detector.name. Heuristic "names contain each other" is false here. */
const RULE_ROSTER: readonly {
  readonly healer: Healer;
  readonly detector: Detector;
  readonly rule: string;
}[] = [
  { healer: staleJsHealer, detector: staleJsDetector, rule: "STALE-JS" },
  { healer: unpinnedActionsHealer, detector: unpinnedActionsDetector, rule: "UNPINNED-ACTION" },
  { healer: unusedImportHealer, detector: unusedImportDetector, rule: "TS6133" },
  { healer: exactOptionalHealer, detector: exactOptionalDetector, rule: "TS2375" },
  { healer: staleDocCrossRefHealer, detector: staleDocCrossRefDetector, rule: "STALE-DOC-XREF" },
];

describe("shared rule identity (roster, not a Healer.rule field)", () => {
  const corpus: FileTree = new Map([...mixed, ...colocated]);

  test("names are pinned — a rename without a roster edit fails here", () => {
    expect(RULE_ROSTER.map((r) => r.healer.name)).toEqual([
      "stale-js-remover",
      "action-sha-pinner",
      "unused-import-remover",
      "exact-optional-spread-fixer",
      "stale-doc-cross-ref",
    ]);
    expect(RULE_ROSTER.map((r) => r.detector.name)).toEqual([
      "stale-js-sibling",
      "unpinned-github-actions",
      "unused-import-ts6133",
      "exact-optional-TS2375",
      "stale-doc-cross-ref",
    ]);
  });

  test("every row fires at least one finding with that rule id (vacuity)", () => {
    for (const row of RULE_ROSTER) {
      const hits = row.detector.detect(corpus).filter((f) => f.rule === row.rule);
      expect(hits.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("no finding on the corpus uses a different rule id than its detector's roster row", () => {
    for (const row of RULE_ROSTER) {
      for (const f of row.detector.detect(corpus)) {
        expect(f.rule).toBe(row.rule);
      }
    }
  });
});
