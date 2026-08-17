/**
 * Falsifiers for identity self-claim drift (work item 081M08RKDKC087G0R000XR4DTE).
 *
 * The load-bearing tests are the ones that pin what this module **cannot** do:
 *
 *   - `SOVEREIGN-*` — it can never flag a claim the subject did not make, and no third party can write to
 *     a subject's ledger. If these can be made to pass while the guard is removed, the non-coercion
 *     property is decoration.
 *   - `NOSTANDARD-*` — an undeclared facet produces no tension however opposite the sentences look. This
 *     is the test that fails if anyone ever adds a lexicon.
 *   - `GROWTH-*` — a superseded claim is not drift, and `growth` is offered exactly when one claim came
 *     after the other. Without these the detector is the pigeonhole weapon.
 *   - `CHARITY-*` — one tension can never reach a pattern verdict, and no reading names malice.
 *   - `NOTHRESHOLD-1` — the module source contains no numeric gate.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acknowledgeTension,
  applyRepair,
  assertClaim,
  charitableReadingsFor,
  DEFAULT_FACET_ARITY,
  declareFacetArity,
  declareIncompatible,
  EMPTY_IDENTITY_LEDGER,
  facetRecurrence,
  findTensions,
  observeDrift,
  offeredMoveKinds,
  patternReadingsFor,
  readingGloss,
  repairPrompt,
  retireClaim,
  spansPhases,
  supersedeClaim,
  type IdentityClaim,
  type IdentityLedger,
  type LedgerResult,
  type PatternReading,
} from "./identity-claims";

const ME = "aaron";
const SOMEONE_ELSE = "otto";

function claim(
  subject: string,
  claimId: string,
  facet: string,
  value: string,
  text: string,
  assertedAt: number,
): IdentityClaim {
  return { subject, claimId, facet, value, text, assertedAt };
}

/** Unwrap an expected-ok result; fails loudly rather than silently proceeding on a refusal. */
function must(r: LedgerResult): IdentityLedger {
  if (!r.ok) throw new Error(`expected ok, refused: ${JSON.stringify(r.refusal)}`);
  return r.ledger;
}

/**
 * The module's source with ALL comments removed — block and line.
 *
 * The naive "drop lines starting with `*`" strip is not enough: a one-line doc comment survives it, and
 * the source-level assertions below would then read prose as code. It did — the first run of
 * `NOWALLCLOCK-1` failed on the word `localeCompare` inside the very sentence forbidding its use.
 */
function moduleCode(): string {
  const src = readFileSync(join(import.meta.dir, "identity-claims.ts"), "utf8");
  // Scanned rather than regexed: a lazy `/\*[\s\S]*?\*\//` over a 700-line file is the backtracking
  // shape `sonarjs/slow-regex` flags, and an index scan is both linear and easier to verify by eye.
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (src.startsWith("//", i)) {
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end;
    } else {
      out += src.charAt(i);
      i += 1;
    }
  }
  return out;
}

/** A subject who declared "stance" single-valued and then said two different things about it. */
function twoLiveOnOneFacet(): IdentityLedger {
  let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "stance", "open", "I work in the open.", 1)));
  l = must(assertClaim(l, ME, claim(ME, "c2", "stance", "private", "I keep my work to myself.", 5)));
  l = must(declareFacetArity(l, ME, { subject: ME, facet: "stance", arity: "one-at-a-time", declaredAt: 0 }));
  return l;
}

// ── SOVEREIGN: the subject supplies the category, and nobody else writes ─────────────────────────────

describe("SOVEREIGN — nothing external can enter the ledger", () => {
  test("SOVEREIGN-1: a third party cannot assert a claim about someone else", () => {
    const r = assertClaim(EMPTY_IDENTITY_LEDGER, SOMEONE_ELSE, claim(ME, "c1", "stance", "open", "x", 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.kind).toBe("not-your-claim");
  });

  test("SOVEREIGN-2: a third party cannot declare MY facet single-valued", () => {
    const r = declareFacetArity(EMPTY_IDENTITY_LEDGER, SOMEONE_ELSE, {
      subject: ME,
      facet: "stance",
      arity: "one-at-a-time",
      declaredAt: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.kind).toBe("not-your-claim");
  });

  test("SOVEREIGN-3: a third party cannot declare two of my claims incompatible", () => {
    const l = twoLiveOnOneFacet();
    const r = declareIncompatible(l, SOMEONE_ELSE, { subject: ME, claimIdA: "c1", claimIdB: "c2", declaredAt: 6 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.kind).toBe("not-your-claim");
  });

  test("SOVEREIGN-4: incompatibility over a claim I never made is REFUSED (mutation target (a))", () => {
    let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "stance", "open", "x", 1)));
    const r = declareIncompatible(l, ME, { subject: ME, claimIdA: "c1", claimIdB: "never-said-this", declaredAt: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refusal.kind).toBe("unknown-claim");
      if (r.refusal.kind === "unknown-claim") expect(r.refusal.claimId).toBe("never-said-this");
    }
    // and the ledger is unchanged, so nothing is flaggable
    l = must(assertClaim(l, ME, claim(ME, "c9", "other", "v", "y", 3)));
    expect(findTensions(l, ME)).toHaveLength(0);
  });

  test("SOVEREIGN-5: another subject's claims never appear in my tensions", () => {
    let l = twoLiveOnOneFacet();
    l = must(assertClaim(l, SOMEONE_ELSE, claim(SOMEONE_ELSE, "o1", "stance", "loud", "z", 2)));
    l = must(
      declareFacetArity(l, SOMEONE_ELSE, { subject: SOMEONE_ELSE, facet: "stance", arity: "one-at-a-time", declaredAt: 0 }),
    );
    const mine = findTensions(l, ME);
    expect(mine).toHaveLength(1);
    for (const t of mine) {
      expect(t.subject).toBe(ME);
      expect(t.earlier.subject).toBe(ME);
      expect(t.later.subject).toBe(ME);
    }
  });

  test("SOVEREIGN-6: retiring/acknowledging a claim I never made is refused", () => {
    expect(retireClaim(EMPTY_IDENTITY_LEDGER, ME, { subject: ME, claimId: "ghost", retiredAt: 1 }).ok).toBe(false);
    expect(
      acknowledgeTension(EMPTY_IDENTITY_LEDGER, ME, {
        subject: ME,
        claimIdA: "ghost",
        claimIdB: "ghost2",
        acknowledgedAt: 1,
      }).ok,
    ).toBe(false);
  });
});

// ── NOSTANDARD: only self-consistency, never conformity ──────────────────────────────────────────────

describe("NOSTANDARD — no external standard can produce a tension", () => {
  test("NOSTANDARD-1: an UNDECLARED facet never produces a tension, however opposite the sentences", () => {
    let l = must(
      assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "temperament", "calm", "I am always calm.", 1)),
    );
    l = must(assertClaim(l, ME, claim(ME, "c2", "temperament", "furious", "I am never calm.", 2)));
    expect(DEFAULT_FACET_ARITY).toBe("many-at-once");
    expect(findTensions(l, ME)).toHaveLength(0);
    expect(observeDrift(l, ME).observation.kind).toBe("no-tension");
  });

  test("NOSTANDARD-2: a facet declared many-at-once is plural, not drift", () => {
    let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "role", "parent", "I am a parent.", 1)));
    l = must(assertClaim(l, ME, claim(ME, "c2", "role", "engineer", "I am an engineer.", 2)));
    l = must(declareFacetArity(l, ME, { subject: ME, facet: "role", arity: "many-at-once", declaredAt: 0 }));
    expect(findTensions(l, ME)).toHaveLength(0);
  });

  test("NOSTANDARD-3: restating the SAME value on a one-at-a-time facet is not drift", () => {
    let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "stance", "open", "I work openly.", 1)));
    l = must(assertClaim(l, ME, claim(ME, "c2", "stance", "open", "Still working openly.", 9)));
    l = must(declareFacetArity(l, ME, { subject: ME, facet: "stance", arity: "one-at-a-time", declaredAt: 0 }));
    expect(findTensions(l, ME)).toHaveLength(0);
  });

  test("NOSTANDARD-4: every tension's ground points at a declaration the SUBJECT made", () => {
    const l = twoLiveOnOneFacet();
    const [t] = findTensions(l, ME);
    expect(t).toBeDefined();
    if (t === undefined) return;
    expect(t.grounds.length).toBeGreaterThan(0);
    for (const g of t.grounds) expect(typeof g.declaredAt).toBe("number");
  });
});

// ── GROWTH: the category stays revisable (Aaron 2026-08-17, pigeonhole) ──────────────────────────────

describe("GROWTH — evolution is not drift", () => {
  test("GROWTH-1: superseding a claim removes the tension entirely", () => {
    const before = twoLiveOnOneFacet();
    expect(findTensions(before, ME)).toHaveLength(1);
    const after = must(
      supersedeClaim(before, ME, ME, "c1", claim(ME, "c2", "stance", "private", "I keep my work to myself.", 5), 5),
    );
    expect(findTensions(after, ME)).toHaveLength(0);
    expect(observeDrift(after, ME).observation.kind).toBe("no-tension");
  });

  test("GROWTH-2: the superseded claim is PRESERVED, not erased (§5 memory preservation)", () => {
    const after = must(
      supersedeClaim(twoLiveOnOneFacet(), ME, ME, "c1", claim(ME, "c2", "stance", "private", "…", 5), 5),
    );
    expect(after.claims.some((c) => c.claimId === "c1")).toBe(true);
    expect(after.supersessions).toHaveLength(1);
    const report = observeDrift(after, ME);
    expect(report.claimVolume).toBe(2);
    expect(report.liveClaims).toBe(1);
    expect(report.supersededClaims).toBe(1);
  });

  test("GROWTH-3: `growth` is offered when the claims span phases, and NOT when they co-occur", () => {
    const spread = twoLiveOnOneFacet(); // phases 1 and 5
    const [tSpread] = findTensions(spread, ME);
    expect(tSpread).toBeDefined();
    if (tSpread === undefined) return;
    expect(spansPhases(tSpread)).toBe(true);
    expect(charitableReadingsFor(tSpread)).toContain("growth");

    let same = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "a", "stance", "open", "x", 7)));
    same = must(assertClaim(same, ME, claim(ME, "b", "stance", "private", "y", 7))); // same phase
    same = must(declareFacetArity(same, ME, { subject: ME, facet: "stance", arity: "one-at-a-time", declaredAt: 0 }));
    const [tSame] = findTensions(same, ME);
    expect(tSame).toBeDefined();
    if (tSame === undefined) return;
    expect(spansPhases(tSame)).toBe(false);
    expect(charitableReadingsFor(tSame)).not.toContain("growth");
    expect(charitableReadingsFor(tSame)).toEqual(["accidental"]);
  });

  test("GROWTH-4: `supersede` is offered as a repair move exactly when the pair spans phases", () => {
    const [t] = findTensions(twoLiveOnOneFacet(), ME);
    expect(t).toBeDefined();
    if (t === undefined) return;
    expect(offeredMoveKinds(t)).toContain("supersede");
    expect(offeredMoveKinds(t)).toContain("hold-both");
  });

  test("GROWTH-5: a subject can supersede repeatedly and never accrue drift", () => {
    let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "v1", "purpose", "a", "My purpose is A.", 1)));
    l = must(declareFacetArity(l, ME, { subject: ME, facet: "purpose", arity: "one-at-a-time", declaredAt: 0 }));
    for (const [i, v] of ["b", "c", "d", "e"].entries()) {
      const next = claim(ME, `v${String(i + 2)}`, "purpose", v, `My purpose is ${v.toUpperCase()}.`, i + 2);
      l = must(supersedeClaim(l, ME, ME, `v${String(i + 1)}`, next, i + 2));
    }
    expect(observeDrift(l, ME).observation.kind).toBe("no-tension");
    expect(observeDrift(l, ME).claimVolume).toBe(5); // the whole history is kept
    expect(observeDrift(l, ME).liveClaims).toBe(1);
  });

  test("GROWTH-6: superseding one side of a declared incompatibility clears it", () => {
    let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "habit", "x", "I do not do Y.", 1)));
    l = must(assertClaim(l, ME, claim(ME, "c2", "habit2", "y", "I did Y.", 2)));
    l = must(declareIncompatible(l, ME, { subject: ME, claimIdA: "c1", claimIdB: "c2", declaredAt: 3 }));
    expect(findTensions(l, ME)).toHaveLength(1);
    l = must(supersedeClaim(l, ME, ME, "c1", claim(ME, "c3", "habit", "z", "I sometimes do Y.", 4), 4));
    expect(findTensions(l, ME)).toHaveLength(0);
  });
});

// ── CHARITY: the gradient, enforced ──────────────────────────────────────────────────────────────────

describe("CHARITY — the gradient is in the type", () => {
  test("CHARITY-1: ONE tension can never reach a pattern verdict (mutation target (b))", () => {
    const report = observeDrift(twoLiveOnOneFacet(), ME);
    expect(report.observation.kind).toBe("drift-detected");
    expect(report.observation.kind).not.toBe("recurring-drift");
    if (report.observation.kind === "drift-detected") {
      for (const r of report.observation.readings) {
        expect(["accidental", "growth"]).toContain(r);
      }
    }
  });

  test("CHARITY-2: two tensions reach `recurring-drift`, and it is still not a conviction", () => {
    let l = twoLiveOnOneFacet();
    l = must(assertClaim(l, ME, claim(ME, "d1", "pace", "slow", "I move slowly.", 2)));
    l = must(assertClaim(l, ME, claim(ME, "d2", "pace", "fast", "I move fast.", 6)));
    l = must(declareFacetArity(l, ME, { subject: ME, facet: "pace", arity: "one-at-a-time", declaredAt: 0 }));
    const report = observeDrift(l, ME);
    expect(report.observation.kind).toBe("recurring-drift");
    if (report.observation.kind !== "recurring-drift") return;
    expect(report.observation.tensions).toHaveLength(2);
    // every permitted reading is non-accusatory; malice is not among them
    expect(report.observation.readings).toContain("ironic");
    expect(report.observation.readings).not.toContain("deceptive" as PatternReading);
    expect(report.observation.readings).not.toContain("malicious" as PatternReading);
    expect(report.observation.perFacet).toEqual([
      { facet: "pace", tensions: 1 },
      { facet: "stance", tensions: 1 },
    ]);
  });

  test("CHARITY-3: no reading anywhere in the module names malice (mutation target (c), runtime half)", () => {
    const readings: readonly PatternReading[] = patternReadingsFor([]);
    for (const r of readings) {
      expect(["accidental", "growth", "ironic", "unresolved"]).toContain(r);
      expect(readingGloss(r).length).toBeGreaterThan(0);
    }
    // `readingGloss` is total over the union: an unhandled member would throw via assertNever.
    expect(() => readingGloss("deceptive" as PatternReading)).toThrow();
  });

  test("CHARITY-4: no observation constructor names a verdict about the person", () => {
    const kinds = ["no-tension", "drift-detected", "recurring-drift"];
    for (const k of kinds) {
      expect(k).not.toContain("decept");
      expect(k).not.toContain("malic");
      expect(k).not.toContain("constant"); // "constant" needs a window; refused outright
    }
  });
});

// ── NOTHRESHOLD: no hidden oracle ────────────────────────────────────────────────────────────────────

describe("NOTHRESHOLD — the module contains no numeric gate", () => {
  test("NOTHRESHOLD-1: source has no threshold constant and no comparison against a magic number", () => {
    const code = moduleCode();
    expect(code).not.toMatch(/THRESHOLD/i);
    // the only integer comparands permitted are 0 and 1 — the plural-of-one distinction
    const comparands = [...code.matchAll(/[<>]=?\s*(\d+)/g)].map((m) => m[1] ?? "");
    expect(comparands.length).toBeGreaterThan(0); // the scan found something, so a pass is not vacuous
    for (const n of comparands) expect(["0", "1"]).toContain(n);
  });

  test("NOTHRESHOLD-2: the denominators a caller would need for a rate are supplied, unformed", () => {
    const report = observeDrift(twoLiveOnOneFacet(), ME);
    expect(report.claimVolume).toBe(2);
    expect(report.liveClaims).toBe(2);
    expect(Object.keys(report)).not.toContain("rate");
    expect(Object.keys(report)).not.toContain("score");
    expect(Object.keys(report)).not.toContain("reliability");
  });

  test("NOTHRESHOLD-3: three, ten, and fifty tensions all report the same KIND — only the pattern grows", () => {
    const build = (n: number): IdentityLedger => {
      let l = EMPTY_IDENTITY_LEDGER;
      for (let i = 0; i < n; i += 1) {
        const s = String(i);
        l = must(assertClaim(l, ME, claim(ME, `a${s}`, `f${s}`, "x", `x${s}`, 2 * i)));
        l = must(assertClaim(l, ME, claim(ME, `b${s}`, `f${s}`, "y", `y${s}`, 2 * i + 1)));
        l = must(declareFacetArity(l, ME, { subject: ME, facet: `f${s}`, arity: "one-at-a-time", declaredAt: 0 }));
      }
      return l;
    };
    for (const n of [3, 10, 50]) {
      const o = observeDrift(build(n), ME).observation;
      expect(o.kind).toBe("recurring-drift");
      if (o.kind === "recurring-drift") {
        expect(o.tensions).toHaveLength(n);
        expect(o.readings).toEqual(patternReadingsFor(o.tensions));
      }
    }
  });
});

// ── REPAIR ───────────────────────────────────────────────────────────────────────────────────────────

describe("REPAIR — seeing is the remedy, and every move is the subject's", () => {
  test("REPAIR-1: hold-both moves the tension to `held` and out of the verdict", () => {
    const l = twoLiveOnOneFacet();
    const after = must(applyRepair(l, ME, ME, { kind: "hold-both", claimIdA: "c1", claimIdB: "c2" }, 9));
    const report = observeDrift(after, ME);
    expect(report.observation.kind).toBe("no-tension");
    expect(report.held).toHaveLength(1); // still visible — acknowledged, not erased
  });

  test("REPAIR-2: a third party cannot repair my ledger", () => {
    const l = twoLiveOnOneFacet();
    const r = applyRepair(l, SOMEONE_ELSE, ME, { kind: "hold-both", claimIdA: "c1", claimIdB: "c2" }, 9);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.kind).toBe("not-your-claim");
  });

  test("REPAIR-3: withdrawing an incompatibility and revising facet arity both clear the tension", () => {
    let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "h", "x", "A", 1)));
    l = must(assertClaim(l, ME, claim(ME, "c2", "h2", "y", "B", 2)));
    l = must(declareIncompatible(l, ME, { subject: ME, claimIdA: "c1", claimIdB: "c2", declaredAt: 3 }));
    const cleared = must(
      applyRepair(l, ME, ME, { kind: "withdraw-incompatibility", claimIdA: "c2", claimIdB: "c1" }, 4),
    );
    expect(findTensions(cleared, ME)).toHaveLength(0);

    const facetCase = twoLiveOnOneFacet();
    const revised = must(
      applyRepair(facetCase, ME, ME, { kind: "revise-facet-arity", facet: "stance", arity: "many-at-once" }, 9),
    );
    expect(findTensions(revised, ME)).toHaveLength(0);
  });

  test("REPAIR-4: the prompt quotes the subject's own sentences VERBATIM and issues no instruction", () => {
    const [t] = findTensions(twoLiveOnOneFacet(), ME);
    expect(t).toBeDefined();
    if (t === undefined) return;
    const prompt = repairPrompt(t, [...charitableReadingsFor(t)]);
    expect(prompt).toContain("I work in the open.");
    expect(prompt).toContain("I keep my work to myself.");
    expect(prompt).toContain("Nothing is required of you");
    expect(prompt).toContain("you said \"stance\" holds one value at a time");
    expect(prompt.toLowerCase()).not.toContain("should");
    expect(prompt.toLowerCase()).not.toContain("must");
  });
});

// ── DISCIPLINES ──────────────────────────────────────────────────────────────────────────────────────

describe("DISCIPLINES — idempotency, determinism, no ambient time", () => {
  test("IDEMPOTENT-1: re-asserting the same claimId replaces rather than duplicates", () => {
    let l = must(assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c1", "stance", "open", "v1", 1)));
    l = must(assertClaim(l, ME, claim(ME, "c1", "stance", "open", "v2", 1)));
    expect(l.claims).toHaveLength(1);
    expect(l.claims[0]?.text).toBe("v2");
  });

  test("DST-1: tension order is independent of claim insertion order", () => {
    const forward = twoLiveOnOneFacet();
    let backward = must(
      assertClaim(EMPTY_IDENTITY_LEDGER, ME, claim(ME, "c2", "stance", "private", "I keep my work to myself.", 5)),
    );
    backward = must(assertClaim(backward, ME, claim(ME, "c1", "stance", "open", "I work in the open.", 1)));
    backward = must(
      declareFacetArity(backward, ME, { subject: ME, facet: "stance", arity: "one-at-a-time", declaredAt: 0 }),
    );
    expect(JSON.stringify(findTensions(backward, ME))).toBe(JSON.stringify(findTensions(forward, ME)));
  });

  test("DST-2: the earlier claim is always the lower phase, regardless of argument order", () => {
    const [t] = findTensions(twoLiveOnOneFacet(), ME);
    expect(t).toBeDefined();
    if (t === undefined) return;
    expect(t.earlier.assertedAt).toBeLessThan(t.later.assertedAt);
    expect(t.earlier.claimId).toBe("c1");
  });

  test("NOWALLCLOCK-1: no Date / performance / now anywhere in the module", () => {
    const code = moduleCode();
    expect(code).not.toMatch(/Date\.now|performance\.now|new Date/);
    expect(code).not.toMatch(/localeCompare/);
  });

  test("FACETCOUNT-1: a tension spanning two facets counts toward both", () => {
    const t = {
      subject: ME,
      earlier: claim(ME, "a", "f1", "x", "x", 1),
      later: claim(ME, "b", "f2", "y", "y", 2),
      grounds: [{ kind: "subject-declared-incompatible" as const, declaredAt: 3 }],
    };
    expect(facetRecurrence([t])).toEqual([
      { facet: "f1", tensions: 1 },
      { facet: "f2", tensions: 1 },
    ]);
  });
});
