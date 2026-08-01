import { describe, expect, test } from "bun:test";

import {
  findingRule,
  foldMtth,
  newlyBreaching,
  nextTick,
  normalizeSloConfig,
  parseFindings,
  reconcileFiled,
  sloBreaches,
  type FiledMap,
  type SweepEvent,
} from "./drift-ledger";

// Workitem 081KX3KA3EW — tick-indexed MTTH: the flip's safety net.
// Proofs:
//   1. parseFindings reuses the scoped-lint formats and dedupes by path+rule.
//   2. Birth at tick B, absent at tick H ⇒ healed in H−B ticks; MTTH is the
//      mean per class; unhealed findings report open age at the latest tick.
//   3. The fold is a pure function of the event SET (order-independent input,
//      tick-ordered internally) and wallclock metadata never affects it.

const sweep = (tick: number, findings: [string, string][]): SweepEvent => ({
  tick,
  at: `IGNORED-${String(tick)}`,
  findings: findings.map(([path, rule]) => ({ path, rule })),
});

describe("parseFindings", () => {
  test("parses linter formats, extracts rules, dedupes by path+rule", () => {
    const out = parseFindings(
      [
        "docs/a.md:19 MD022/blanks Headings",
        "docs/a.md:44 MD022/blanks Headings again", // same path+rule → dedupe
        "src/x.ts(12,3): error TS2322: nope",
        "tools/a.sh:35:10: note: … [SC1091]",
        "Build succeeded.",
      ].join("\n"),
    );
    expect(out).toEqual([
      { path: "docs/a.md", rule: "MD022" },
      { path: "src/x.ts", rule: "TS2322" },
      { path: "tools/a.sh", rule: "SC1091" },
    ]);
  });

  test("findingRule falls back to the agnostic class", () => {
    expect(findingRule("docs/a.md:3 something unclassified")).toBe("finding");
  });

  test("knownPaths guard: path-shaped tool preamble never enters the ledger", () => {
    const known = new Set(["docs/a.md"]);
    const out = parseFindings(
      [
        "markdownlint-cli2 v0.22.1 (markdownlint v0.38.0)",
        "Finding: docs", // glob-echo preamble, path-shaped
        "Linting: 105 file(s)",
        "Summary: 3 error(s)",
        "docs/a.md:19 MD022/blanks Headings",
        "./docs/a.md:20 MD009/no-trailing-spaces", // normalized to the same key space
      ].join("\n"),
      known,
    );
    expect(out).toEqual([
      { path: "docs/a.md", rule: "MD022" },
      { path: "docs/a.md", rule: "MD009" },
    ]);
  });
});

describe("foldMtth", () => {
  test("birth→heal duration in ticks; MTTH is the per-class mean", () => {
    const r = foldMtth([
      sweep(1, [["a.md", "MD022"], ["b.md", "MD022"]]),
      sweep(2, [["b.md", "MD022"]]), // a healed in 1 tick
      sweep(3, []), // b healed in 2 ticks
    ]);
    const md = r.classes.find((c) => c.rule === "MD022")!;
    expect(md.healedCount).toBe(2);
    expect(md.mtthTicks).toBe(1.5);
    expect(md.openCount).toBe(0);
  });

  test("unhealed findings report open age at the latest tick", () => {
    const r = foldMtth([sweep(1, [["a.md", "MD009"]]), sweep(4, [["a.md", "MD009"]])]);
    const md = r.classes.find((c) => c.rule === "MD009")!;
    expect(md.healedCount).toBe(0);
    expect(md.mtthTicks).toBeNull();
    expect(md.openCount).toBe(1);
    expect(md.oldestOpenAgeTicks).toBe(3);
  });

  test("re-minted drift after a heal is a NEW birth, not a resurrection", () => {
    const r = foldMtth([
      sweep(1, [["a.md", "MD022"]]),
      sweep(2, []), // healed in 1
      sweep(3, [["a.md", "MD022"]]), // re-minted
      sweep(5, []), // healed in 2
    ]);
    const md = r.classes.find((c) => c.rule === "MD022")!;
    expect(md.healedCount).toBe(2);
    expect(md.mtthTicks).toBe(1.5);
  });

  test("fold is order-independent over the event set (agreed order, not arrival order)", () => {
    const events = [sweep(3, []), sweep(1, [["a.md", "MD022"]]), sweep(2, [["a.md", "MD022"]])];
    const shuffled = [events[1]!, events[2]!, events[0]!];
    expect(foldMtth(events).lines).toEqual(foldMtth(shuffled).lines);
  });

  test("wallclock metadata never enters the fold", () => {
    const a = [sweep(1, [["a.md", "MD022"]]), sweep(2, [])];
    const b = a.map((e) => ({ ...e, at: "2099-01-01T00:00:00Z" }));
    expect(foldMtth(a).lines).toEqual(foldMtth(b).lines);
  });

  test("empty ledger folds to tick 0, no classes", () => {
    const r = foldMtth([]);
    expect(r.latestTick).toBe(0);
    expect(r.classes).toHaveLength(0);
  });
});

describe("nextTick", () => {
  test("derived from the ledger itself — max + 1, starting at 1", () => {
    expect(nextTick([])).toBe(1);
    expect(nextTick([sweep(1, []), sweep(7, [])])).toBe(8);
  });
});

// ── SLO: the enforcement half ────────────────────────────────────────────────
// Proofs:
//   1. Breach is age STRICTLY OVER budget (age == max is at the boundary).
//   2. per_rule overrides defaults; snake_case YAML normalizes to the config.
//   3. Episode idempotency: filed rules are not re-filed while open; a fully
//      healed rule clears from the map so a re-breach files anew.

// snake_case shape, exactly as the YAML document parses (yaml itself stays a
// lazy CLI-edge dep — this test file must run under bare `bun test`).
const cfg = normalizeSloConfig({
  defaults: { max_open_age_ticks: 6 },
  per_rule: { MD022: { max_open_age_ticks: 2 } },
});

describe("sloBreaches", () => {
  // MD022 budget 2 (override), everything else 6 (default).
  const events = [
    sweep(1, [["a.md", "MD022"], ["b.md", "MD032"], ["c.md", "MD038"]]),
    sweep(4, [["a.md", "MD022"], ["b.md", "MD032"], ["c.md", "MD038"]]),
    sweep(7, [["a.md", "MD022"], ["b.md", "MD032"]]), // MD038 healed
  ];
  const report = foldMtth(events);

  test("age > budget breaches; age == budget does not; healed never does", () => {
    const b = sloBreaches(report, cfg);
    // MD022: open age 6 > budget 2 → breach. MD032: age 6 == default 6 → boundary, no breach.
    expect(b.map((x) => x.rule)).toEqual(["MD022"]);
    expect(b[0]!.maxOpenAgeTicks).toBe(2);
    expect(b[0]!.oldestOpenAgeTicks).toBe(6);
  });

  test("past the default budget, the default class breaches too", () => {
    const later = foldMtth([...events, sweep(8, [["a.md", "MD022"], ["b.md", "MD032"]])]);
    expect(sloBreaches(later, cfg).map((x) => x.rule)).toEqual(["MD022", "MD032"]);
  });
});

describe("filed-map episode idempotency", () => {
  const report = foldMtth([sweep(1, [["a.md", "MD022"]]), sweep(4, [["a.md", "MD022"]])]);
  const filed: FiledMap = { MD022: { workitem: "081KTESTONLY", filedAtTick: 3 } };

  test("still-open rule stays filed and is not re-filed", () => {
    const kept = reconcileFiled(report, filed);
    expect(kept).toEqual(filed);
    expect(newlyBreaching(sloBreaches(report, cfg), kept)).toEqual([]);
  });

  test("fully healed rule clears; a re-breach later files a NEW workitem", () => {
    const healed = foldMtth([sweep(1, [["a.md", "MD022"]]), sweep(2, [])]);
    expect(reconcileFiled(healed, filed)).toEqual({});
  });
});

describe("normalizeSloConfig", () => {
  test("rejects a config without a usable default budget", () => {
    expect(() => normalizeSloConfig({ per_rule: {} })).toThrow(/defaults\.max_open_age_ticks/);
    expect(() => normalizeSloConfig({ defaults: { max_open_age_ticks: 0 } })).toThrow();
    expect(() => normalizeSloConfig(null)).toThrow();
  });
});
