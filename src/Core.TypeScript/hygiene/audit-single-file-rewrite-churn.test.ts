// audit-single-file-rewrite-churn.test.ts
//
// EVERY TEST HERE IS A MUTATION PROOF. The point is not that the audit passes on a
// well-formed register -- a check that cannot fail would also do that. Each block below
// constructs the exact defect the audit exists to catch and asserts it goes red, so deleting
// the corresponding branch in the audit turns a test red rather than leaving a green check
// that constrains nothing.
//
// The audit's own header warns that count is a proxy and that boundedness is a property of the
// WRITER which history cannot reveal. Nothing here pretends otherwise: these tests pin the
// audit's REFUSALS, not the truth of any row's claims.

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";

import {
  audit,
  isBoundedTipUnboundedHistory,
  isStepThree,
  isUnfounded,
  isUnknown,
  livenessProblem,
  loadRegister,
  measure,
  parseHistory,
  validateRegister,
  MIN_COMMITS_FOR_LIVENESS,
  type RegisterRow,
} from "./audit-single-file-rewrite-churn";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

/** A minimal well-formed unbounded row. Tests mutate ONE field at a time from this. */
function unboundedRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    path: "some/path.json",
    kind: "file",
    tip: "unbounded",
    history: "unbounded",
    rate: "3 versions/day, measured over 30 days",
    costPerUnit: "500 bytes on disk per version",
    breaksFirst: "clone time, in about two years at this rate",
    generator: "none -- nothing reproduces it, the bytes are the information",
    fidelityNeeded: "exact, because it is a reproducibility artifact",
    satelliteChain: "depth 0, no colder level exists",
    demotionPlan: "none yet; nothing ages it out",
    ceiling: 10,
    liftsWhen: "none -- its history is the product and a carved rule requires it",
    reason: "A reason long enough to be refusable by a reviewer who disagrees with it.",
    ...over,
  };
}

function boundedRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    path: "frozen/thing.md",
    kind: "file",
    tip: "bounded",
    tipBoundedBy: "frozen 2026-04-30; the writer was replaced by per-event shards",
    history: "bounded",
    historyBoundedBy: "the writer stopped and the documented path back to it was removed",
    ceiling: 86,
    liftsWhen: "none -- already in its end state; kept as a regression pin",
    reason: "A reason long enough to be refusable by a reviewer who disagrees with it.",
    ...over,
  };
}

function rowsOf(...raw: Record<string, unknown>[]): RegisterRow[] {
  return validateRegister(raw);
}

// ============================================================================================
// parseHistory -- the measurement itself
// ============================================================================================

describe("parseHistory", () => {
  const raw = [
    "C aaa 2026-09-10",
    "a.json",
    "b.json",
    "",
    "C bbb 2026-09-01",
    "a.json",
    "node_modules/x.json",
    "",
    "C ccc 2026-08-01",
    "a.json",
  ].join("\n");

  test("counts touches per path and both date bounds", () => {
    const h = parseHistory(raw);
    expect(h.commits).toBe(3);
    expect(h.paths.get("a.json")?.touches).toBe(3);
    expect(h.paths.get("b.json")?.touches).toBe(1);
    // git emits newest-first, so `last` is the newest sighting and `first` the oldest.
    expect(h.paths.get("a.json")?.last).toBe("2026-09-10");
    expect(h.paths.get("a.json")?.first).toBe("2026-08-01");
  });

  test("MUTATION: excludes node_modules -- vendored trees are not ours to police", () => {
    expect(parseHistory(raw).paths.has("node_modules/x.json")).toBe(false);
  });

  test("an empty walk yields nothing rather than throwing -- the liveness floor catches it", () => {
    const h = parseHistory("");
    expect(h.commits).toBe(0);
    expect(h.paths.size).toBe(0);
  });
});

// ============================================================================================
// validateRegister -- every refusal, one mutation each
// ============================================================================================

describe("validateRegister refusals", () => {
  test("a well-formed row is accepted (the control -- without it the refusals prove nothing)", () => {
    expect(() => rowsOf(unboundedRow())).not.toThrow();
    expect(() => rowsOf(boundedRow())).not.toThrow();
  });

  test("MUTATION: a non-array register is refused", () => {
    expect(() => validateRegister({} as unknown)).toThrow(/must be a JSON array/);
  });

  test("MUTATION: duplicate paths are refused -- two rows for one path is two ceilings", () => {
    expect(() => rowsOf(unboundedRow(), unboundedRow())).toThrow(/duplicate row/);
  });

  test("MUTATION: a bad 'kind' is refused", () => {
    expect(() => rowsOf(unboundedRow({ kind: "folder" }))).toThrow(/'kind' must be/);
  });

  test("MUTATION: tip and history are SEPARATE verdicts and both are required", () => {
    expect(() => rowsOf(unboundedRow({ tip: undefined }))).toThrow(/'tip' must be/);
    expect(() => rowsOf(unboundedRow({ history: undefined }))).toThrow(/'history' must be/);
    // The message must teach the distinction, not just reject -- this is the defect that made
    // `data/tick-latest.json` look bounded when git kept 1091 versions of it.
    expect(() => rowsOf(unboundedRow({ tip: "maybe" }))).toThrow(/rolling window bounds the tip/);
  });

  test("MUTATION: a ceiling that is not a positive integer is refused -- the ratchet needs a number", () => {
    for (const bad of [0, -1, 1.5, "10", undefined]) {
      expect(() => rowsOf(unboundedRow({ ceiling: bad }))).toThrow(/'ceiling' must be a positive integer/);
    }
  });

  test("MUTATION: a short or missing reason is refused -- an unreasoned row is an escape hatch", () => {
    expect(() => rowsOf(unboundedRow({ reason: "because" }))).toThrow(/at least 40 characters/);
    expect(() => rowsOf(unboundedRow({ reason: undefined }))).toThrow(/at least 40 characters/);
  });

  test("MUTATION: liftsWhen is mandatory in BOTH directions", () => {
    expect(() => rowsOf(unboundedRow({ liftsWhen: undefined }))).toThrow(/at least 20 characters/);
  });

  test("MUTATION: a bare 'none' liftsWhen is refused -- permanence must be argued, not asserted", () => {
    expect(() => rowsOf(unboundedRow({ liftsWhen: "none, it is forced forever and always" }))).toThrow(
      /must be written "none -- <why there is no exit>"/,
    );
    // ...and the argued form passes, so the refusal is about the ARGUMENT, not the word.
    expect(() => rowsOf(unboundedRow({ liftsWhen: "none -- its history is the product" }))).not.toThrow();
  });

  test("MUTATION: a tip-bounded row must name the mechanism", () => {
    expect(() => rowsOf(boundedRow({ tipBoundedBy: undefined }))).toThrow(/name the MECHANISM/);
  });

  test("MUTATION: a history-bounded row must say what stopped it", () => {
    expect(() => rowsOf(boundedRow({ historyBoundedBy: undefined }))).toThrow(/what STOPPED it accumulating/);
  });

  test("MUTATION: every one of the seven model fields is required when history is unbounded", () => {
    const required = [
      "rate",
      "costPerUnit",
      "breaksFirst",
      "generator",
      "fidelityNeeded",
      "satelliteChain",
      "demotionPlan",
    ] as const;
    for (const field of required) {
      expect(() => rowsOf(unboundedRow({ [field]: undefined }))).toThrow(new RegExp(`'${field}'`));
    }
    // And the count is pinned: adding a field without a refusal would be an unchecked field.
    expect(required.length).toBe(7);
  });

  test("a history-BOUNDED row needs none of the model fields -- its bound IS its model", () => {
    const [row] = rowsOf(boundedRow());
    expect(row?.rate).toBeNull();
    expect(row?.generator).toBeNull();
    expect(row?.satelliteChain).toBeNull();
  });
});

// ============================================================================================
// the classifiers
// ============================================================================================

describe("classifiers", () => {
  test("isUnknown treats a declared gap as a gap and a real value as a value", () => {
    expect(isUnknown("UNKNOWN -- one version, no rate derivable from n=1")).toBe(true);
    expect(isUnknown(null)).toBe(true);
    expect(isUnknown("3 versions/day")).toBe(false);
  });

  test("MUTATION: UNFOUNDED fires on ANY missing model field, and only when history is unbounded", () => {
    const [full] = rowsOf(unboundedRow());
    expect(isUnfounded(full as RegisterRow)).toBe(false);
    for (const field of ["rate", "costPerUnit", "breaksFirst", "generator", "fidelityNeeded", "satelliteChain", "demotionPlan"]) {
      const [r] = rowsOf(unboundedRow({ [field]: "UNKNOWN -- nobody has measured this" }));
      expect(isUnfounded(r as RegisterRow)).toBe(true);
    }
    const [b] = rowsOf(boundedRow());
    expect(isUnfounded(b as RegisterRow)).toBe(false);
  });

  test("MUTATION: STEP 3 is exactly 'unbounded history with no generator'", () => {
    const [none] = rowsOf(unboundedRow());
    expect(isStepThree(none as RegisterRow)).toBe(true); // generator starts with "none --"
    const [has] = rowsOf(
      unboundedRow({ generator: "derive-index.ts, exact fidelity, run in CI on every PR" }),
    );
    expect(isStepThree(has as RegisterRow)).toBe(false);
    const [b] = rowsOf(boundedRow());
    expect(isStepThree(b as RegisterRow)).toBe(false);
  });

  test("MUTATION: bounded-at-tip + unbounded-in-history is its own class -- the tick-latest case", () => {
    const [window] = rowsOf(
      unboundedRow({ tip: "bounded", tipBoundedBy: "a rolling window of size one; 251 bytes at tip" }),
    );
    expect(isBoundedTipUnboundedHistory(window as RegisterRow)).toBe(true);
    const [plain] = rowsOf(unboundedRow());
    expect(isBoundedTipUnboundedHistory(plain as RegisterRow)).toBe(false);
    const [b] = rowsOf(boundedRow());
    expect(isBoundedTipUnboundedHistory(b as RegisterRow)).toBe(false);
  });
});

// ============================================================================================
// measure -- files count commits, directories count files
// ============================================================================================

describe("measure", () => {
  const history = parseHistory(
    ["C a 2026-09-10", "some/path.json", "d/one.md", "", "C b 2026-09-09", "some/path.json", "d/two.md"].join("\n"),
  );

  test("a file row measures COMMITS TOUCHING IT", () => {
    const [row] = rowsOf(unboundedRow());
    const m = measure(row as RegisterRow, history, new Set(["some/path.json"]));
    expect(m.actual).toBe(2);
    expect(m.present).toBe(true);
  });

  test("a directory row measures LIVE FILE COUNT, not commits -- a folder is an accumulating path", () => {
    const [row] = rowsOf(unboundedRow({ path: "d", kind: "directory", ceiling: 5 }));
    const m = measure(row as RegisterRow, history, new Set(["d/one.md", "d/two.md", "d/three.md"]));
    expect(m.actual).toBe(3);
    expect(m.everSeen).toBe(2); // only two ever appeared in this synthetic history
  });

  test("MUTATION: the directory prefix must not match a sibling with a shared name stem", () => {
    const [row] = rowsOf(unboundedRow({ path: "d", kind: "directory", ceiling: 5 }));
    const m = measure(row as RegisterRow, history, new Set(["d/one.md", "docs/other.md"]));
    expect(m.actual).toBe(1);
  });
});

// ============================================================================================
// audit -- the ratchet, and everything that must only report
// ============================================================================================

describe("audit", () => {
  const hist = (touches: number, path = "some/path.json"): ReturnType<typeof parseHistory> =>
    parseHistory(
      Array.from({ length: touches }, (_, i) => `C c${i} 2026-09-0${(i % 9) + 1}\n${path}`).join("\n\n"),
    );

  test("MUTATION: the ratchet FAILS when the measurement exceeds the ceiling", () => {
    const rows = rowsOf(unboundedRow({ ceiling: 3 }));
    const r = audit(hist(5), rows, new Set(["some/path.json"]), 100);
    expect(r.failures.length).toBe(1);
    expect(r.failures[0]).toContain("5 commit(s) touching it");
    expect(r.failures[0]).toContain("ceiling of 3");
    // The failure must teach the decision procedure, not merely say no.
    expect(r.failures[0]).toContain("BOUND IT");
    expect(r.failures[0]).toContain("REGENERATE IT");
    expect(r.failures[0]).toContain("TIER IT");
  });

  test("the ratchet PASSES at exactly the ceiling -- a seeded pin is meant to be reachable", () => {
    const rows = rowsOf(unboundedRow({ ceiling: 5 }));
    expect(audit(hist(5), rows, new Set(["some/path.json"]), 100).failures).toEqual([]);
  });

  test("MUTATION: a RETIRED path reports and does NOT fail -- retirement is the goal", () => {
    const rows = rowsOf(unboundedRow({ ceiling: 1 }));
    const r = audit(hist(500), rows, new Set(["something/else.json"]), 100);
    expect(r.failures).toEqual([]); // 500 > ceiling 1, and it still must not fail
    expect(r.retired.length).toBe(1);
    expect(r.retired[0]).toContain("RETIRED");
  });

  test("MUTATION: an over-provisioned ceiling reports and does NOT fail", () => {
    const rows = rowsOf(unboundedRow({ ceiling: 1000 }));
    const r = audit(hist(5), rows, new Set(["some/path.json"]), 100);
    expect(r.failures).toEqual([]);
    expect(r.overProvisioned.length).toBe(1);
    expect(r.overProvisioned[0]).toContain("constrains nothing");
  });

  test("MUTATION: UNFOUNDED and STEP 3 report and do NOT fail -- they are visible debts, not blockers", () => {
    const rows = rowsOf(unboundedRow({ ceiling: 100, rate: "UNKNOWN -- n=1, no rate derivable" }));
    const r = audit(hist(5), rows, new Set(["some/path.json"]), 100);
    expect(r.failures).toEqual([]);
    expect(r.unfounded.length).toBe(1);
    expect(r.unfounded[0]).toContain("rate");
    expect(r.stepThree.length).toBe(1);
  });

  test("MUTATION: hot paths are reported only when still in the tree", () => {
    const h = parseHistory(
      [...Array.from({ length: 150 }, (_, i) => `C c${i} 2026-09-01\nlive/hot.json\ndead/gone.json`)].join("\n\n"),
    );
    const r = audit(h, [], new Set(["live/hot.json"]), 100);
    const named = r.unregisteredHotPaths.map((s) => s.path);
    expect(named).toContain("live/hot.json");
    // A retired path's history cannot be changed, so reporting it asks for an impossible action.
    expect(named).not.toContain("dead/gone.json");
  });

  test("MUTATION: a registered path is not also reported as an unregistered hot path", () => {
    const h = parseHistory(Array.from({ length: 150 }, (_, i) => `C c${i} 2026-09-01\nsome/path.json`).join("\n\n"));
    const rows = rowsOf(unboundedRow({ ceiling: 200 }));
    expect(audit(h, rows, new Set(["some/path.json"]), 100).unregisteredHotPaths).toEqual([]);
  });

  test("MUTATION: a directory row absorbs the paths beneath it from the hot list", () => {
    const h = parseHistory(
      Array.from({ length: 150 }, (_, i) => `C c${i} 2026-09-01\nd/child.md`).join("\n\n"),
    );
    const rows = rowsOf(unboundedRow({ path: "d", kind: "directory", ceiling: 500 }));
    expect(audit(h, rows, new Set(["d/child.md"]), 100).unregisteredHotPaths).toEqual([]);
  });
});

// ============================================================================================
// liveness -- a check that inspected nothing is not a check that passed
// ============================================================================================

describe("livenessProblem", () => {
  test("MUTATION: an empty or near-empty walk is a FAILURE, never a pass", () => {
    expect(livenessProblem(0, 0)).not.toBeNull();
    expect(livenessProblem(MIN_COMMITS_FOR_LIVENESS - 1, 50_000)).not.toBeNull();
    expect(livenessProblem(50_000, 99)).not.toBeNull();
  });

  test("a real-sized walk passes", () => {
    expect(livenessProblem(MIN_COMMITS_FOR_LIVENESS, 100)).toBeNull();
  });
});

// ============================================================================================
// the COMMITTED register must itself be valid
// ============================================================================================

describe("the committed register", () => {
  test("loads and validates -- a malformed row added later fails here, not in production", () => {
    const rows = loadRegister(repoRoot);
    expect(rows.length).toBeGreaterThan(0);
  });

  test("carries at least one BOUNDED row -- otherwise the bounded branch is dead code", () => {
    expect(loadRegister(repoRoot).some((r) => r.history === "bounded")).toBe(true);
  });

  test("carries at least one STEP 2 row -- otherwise the generator test is never exercised", () => {
    expect(loadRegister(repoRoot).some((r) => r.history === "unbounded" && !isStepThree(r))).toBe(true);
  });

  test("carries the bounded-tip/unbounded-history case that motivated splitting the columns", () => {
    expect(loadRegister(repoRoot).some(isBoundedTipUnboundedHistory)).toBe(true);
  });

  test("every row's liftsWhen states an exit or argues there is none", () => {
    for (const row of loadRegister(repoRoot)) {
      const lifts = row.liftsWhen.trimStart().toLowerCase();
      if (lifts.startsWith("none")) expect(row.liftsWhen).toContain("--");
      expect(row.liftsWhen.trim().length).toBeGreaterThanOrEqual(20);
    }
  });
});
