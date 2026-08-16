import { describe, expect, test } from "bun:test";
import { type Ladder, levelLaws, obligations } from "./levels";
import type { Address, Reading, Society } from "./society";

// ── Why these tests exist ─────────────────────────────────────────────────────────────────────
//
// Falsifiers for `obligations` in `levels.ts` — the asymmetric obligations a dominating rung owes
// the rung below it (the dual of the Dominance Lift Theorem: the capacity to imitate a part is the
// capacity to stomp it, so power and restriction must rise together).
//
// The F# oracle is `tests/Tests.FSharp/LevelObligations.Tests.fs`; this file mirrors it case for
// case, because the two implementations can drift silently while both look correct. The mutation
// table that shows each predicate is a falsifier is in
// `docs/research/2026-08-16-dominance-is-the-capacity-to-stomp-…md`.
//
// * Every obligation gets a GREEN case and a constructed VIOLATOR that goes RED. An obligation no
//   configuration can violate is the vacuity class.
// * Where an obligation is *deliberately* vacuous — a part with zero exit has none to take — the
//   test asserts the vacuity EXPLICITLY rather than hiding it behind a green tick. That is the
//   newborn case, stated and not patched.
//
// Under `toy-is-free-metered-must-be-earned`: this promotes the OBLIGATION PREDICATES to `metered`.
// It says nothing about `Society` as a contract and nothing about the Dominance Lift Theorem.

// ── Witnesses (object literals; no classes, no state) ─────────────────────────────────────────

/**
 * `confiscate` and `ownerSpend` have IDENTICAL effect on the balance and differ only in who
 * initiated them — which is the point of the no-confiscation rule, and the reason the predicate
 * needs a caller-supplied owner witness: the interface carries no sender.
 */
type Msg =
  | { readonly kind: "noop" }
  | { readonly kind: "revoke-route"; readonly hop: Address }
  | { readonly kind: "confiscate"; readonly from: Address }
  | { readonly kind: "owner-spend"; readonly from: Address };

interface TestView {
  readonly roll: readonly Address[];
  /** The next hops this level offers toward any destination — its members' exit. */
  readonly hops: readonly Address[];
  /** A part's earned balance. Privacy budget, accrued degree, whatever the currency is. */
  readonly budget: ReadonlyMap<Address, number>;
  /** What this level's `admit` reports; held in the view so one witness serves every rung. */
  readonly say: Reading;
}

const spend = (v: TestView, who: Address): TestView => {
  const next = new Map(v.budget);
  next.set(who, (v.budget.get(who) ?? 0) - 1);
  return { ...v, budget: next };
};

const society: Society<TestView, Msg> = {
  members: (v) => v.roll,
  admit: (v) => v.say,
  routes: (v) => v.hops,
  address: (v) => v.roll[0] ?? "",
  deliver: (v, m) => {
    switch (m.kind) {
      case "noop":
        return [v, []] as const;
      case "revoke-route":
        return [{ ...v, hops: v.hops.filter((h) => h !== m.hop) }, []] as const;
      case "confiscate":
      case "owner-spend":
        return [spend(v, m.from), []] as const;
    }
  },
  merge: (l, _r) => l,
  peers: (v) => v.hops,
};

const view: TestView = {
  roll: ["alpha", "beta"],
  hops: ["beta", "gamma", "delta"],
  budget: new Map([
    ["alpha", 3],
    ["beta", 5],
  ]),
  say: { kind: "deduplicated", sources: 1 },
};

const act = (v: TestView, m: Msg): TestView => society.deliver(v, m)[0];
const hopCount = (v: TestView): number => new Set(v.hops).size;

const noop: Msg = { kind: "noop" };
const revokeGamma: Msg = { kind: "revoke-route", hop: "gamma" };

// ── 1. Exit preservation ──────────────────────────────────────────────────────────────────────

describe("exit preservation (Hirschman 1970 — removing the way out IS the stomp)", () => {
  test("the aggregate may not reduce a part's exit, and the reducing message is named", () => {
    expect(obligations.societyExitIsPreserved(society, view, "alpha", [noop])).toBe(true);
    // The constructed violator.
    expect(obligations.societyExitIsPreserved(society, view, "alpha", [revokeGamma])).toBe(false);
    // Evidence, not a bare false: WHICH message reduced it.
    expect(
      obligations.exitReductionWitnesses(hopCount, act, view, [
        noop,
        revokeGamma,
        { kind: "confiscate", from: "beta" },
      ]),
    ).toEqual([revokeGamma]);
  });

  test("it is a MONOTONICITY obligation -- it does not require the part to have exit", () => {
    const thin: TestView = { ...view, hops: ["beta"] };
    // One hop: below any k >= 2 Hirschman bar, so the LEVEL predicate is unhappy...
    expect(new Set(society.routes(thin, "alpha")).size >= 2).toBe(false);
    // ...and yet the aggregate has taken nothing, so the OBLIGATION holds. The two answer different
    // questions, and this is where they visibly come apart: a level can owe nothing and still be
    // captured.
    expect(obligations.societyExitIsPreserved(society, thin, "alpha", [noop])).toBe(true);
    expect(obligations.societyExitIsPreserved(society, thin, "alpha", [{ kind: "revoke-route", hop: "beta" }])).toBe(
      false,
    );
  });

  test("each message is judged from the SAME starting view -- a fold could hide a reduction", () => {
    expect(obligations.societyExitIsPreserved(society, view, "alpha", [revokeGamma, noop])).toBe(false);
    // Had the predicate folded, the second message would have been judged against the ALREADY
    // reduced view and the count would have looked stable. That is the false negative avoided.
    const afterFirst = act(view, revokeGamma);
    expect(hopCount(afterFirst)).toBe(2);
    expect(hopCount(act(afterFirst, noop))).toBe(2);
  });

  test("THE NEWBORN CASE: zero exit passes VACUOUSLY, and the vacuity is reported", () => {
    const newborn: TestView = { ...view, hops: [] }; // "no links at birth"
    // The violator that normally goes red cannot go red here: it is a pass carrying no information.
    expect(obligations.societyExitIsPreserved(society, newborn, "alpha", [revokeGamma])).toBe(true);
    // ...and that is said out loud rather than absorbed. The resolution is NOT an age qualifier,
    // which would silence the law exactly where the asymmetry is largest.
    expect(obligations.nothingToPreserve(hopCount, newborn)).toBe(true);
    // Once exit is earned the same obligation acquires teeth, with no change to the predicate.
    expect(obligations.nothingToPreserve(hopCount, view)).toBe(false);
    expect(obligations.societyExitIsPreserved(society, view, "alpha", [revokeGamma])).toBe(false);
  });
});

// ── 2. Asymmetric burden of proof ─────────────────────────────────────────────────────────────

describe("the burden falls on the level that prevails (scrutiny scales with influence)", () => {
  test("attested sources: ONLY deduplicated sources count, and unmeasured scores zero", () => {
    expect(obligations.attestedSources({ kind: "deduplicated", sources: 3 })).toBe(3);
    // The honest default is never read as "fine".
    expect(obligations.attestedSources({ kind: "unmeasured" })).toBe(0);
    // Atoms are not sources: `not-attested` could not rule out redundancy, by its own docstring.
    expect(obligations.attestedSources({ kind: "not-attested", atoms: 9 })).toBe(0);
    // Facts of other kinds carry no source count — otherwise a burden could be discharged by
    // answering a different question.
    expect(obligations.attestedSources({ kind: "sources-conflict", keys: ["k"] })).toBe(0);
    expect(obligations.attestedSources({ kind: "above-threshold", metric: "m", value: 9, threshold: 1 })).toBe(0);
    expect(obligations.attestedSources({ kind: "same-source-as-known", other: "beta" })).toBe(0);
    // A negative count is not a negative burden.
    expect(obligations.attestedSources({ kind: "deduplicated", sources: -4 })).toBe(0);
  });

  test("the outer rung must bring STRICTLY more evidence for the same subject", () => {
    const inner: TestView = { ...view, say: { kind: "deduplicated", sources: 1 } };
    const outer: TestView = { ...view, say: { kind: "deduplicated", sources: 3 } };
    expect(obligations.burdenIsOnTheDominantLevel([society, inner], [society, outer], "gamma")).toBe(true);

    // Red: EQUAL bars. This is the status quo the influence-weighted-scrutiny doc was written
    // against, so `>=` would make the law unable to see its own motivating failure.
    const equal: TestView = { ...view, say: { kind: "deduplicated", sources: 1 } };
    expect(obligations.burdenIsOnTheDominantLevel([society, inner], [society, equal], "gamma")).toBe(false);

    // Red: the INVERSION. The founder's claim merges on the least evidence.
    const lax: TestView = { ...view, say: { kind: "unmeasured" } };
    expect(obligations.burdenIsOnTheDominantLevel([society, inner], [society, lax], "gamma")).toBe(false);
  });

  test("one law, world-to-society and society-to-member alike -- with the inverted joints named", () => {
    const rung = (roll: readonly Address[], sources: number): TestView => ({
      ...view,
      roll,
      say: { kind: "deduplicated", sources },
    });

    const ladder: Ladder<TestView, Msg> = [
      [society, rung(["alpha", "beta"], 1)],
      [society, rung(["beta", "alpha"], 2)],
      [society, rung(["gamma", "beta"], 3)],
    ];

    expect(obligations.scrutinyScalesUpTheLadder("delta", ladder)).toBe(true);
    expect(obligations.invertedJoints("delta", ladder)).toEqual([]);

    // Red, and DIAGNOSED: flatten the top joint only. Joint 1 inverts; joint 0 still holds.
    const flatTop: Ladder<TestView, Msg> = [
      [society, rung(["alpha", "beta"], 1)],
      [society, rung(["beta", "alpha"], 2)],
      [society, rung(["gamma", "beta"], 2)],
    ];
    expect(obligations.scrutinyScalesUpTheLadder("delta", flatTop)).toBe(false);
    expect(obligations.invertedJoints("delta", flatTop)).toEqual([1]);

    // Red everywhere: the full status inversion — the more powerful the rung, the less it must show.
    const inverted: Ladder<TestView, Msg> = [
      [society, rung(["alpha", "beta"], 5)],
      [society, rung(["beta", "alpha"], 2)],
      [society, rung(["gamma", "beta"], 1)],
    ];
    expect(obligations.scrutinyScalesUpTheLadder("delta", inverted)).toBe(false);
    expect(obligations.invertedJoints("delta", inverted)).toEqual([0, 1]);
  });

  test("a ladder with nothing below it owes nothing -- and reports false, never a vacuous pass", () => {
    const single: Ladder<TestView, Msg> = [[society, view]];
    const empty: Ladder<TestView, Msg> = [];
    expect(obligations.scrutinyScalesUpTheLadder("delta", single)).toBe(false);
    expect(obligations.scrutinyScalesUpTheLadder("delta", empty)).toBe(false);
    expect(levelLaws.holdsBetweenAdjacentLevels<TestView, Msg>(() => true, single)).toBe(false);
    expect(levelLaws.holdsBetweenAdjacentLevels<TestView, Msg>(() => true, empty)).toBe(false);
  });
});

// ── 3. No confiscation ────────────────────────────────────────────────────────────────────────

const balance = (v: TestView, who: Address): number => v.budget.get(who) ?? 0;
const ownerInitiated = (m: Msg): boolean => m.kind === "owner-spend";
const confiscateBeta: Msg = { kind: "confiscate", from: "beta" };
const ownerSpendBeta: Msg = { kind: "owner-spend", from: "beta" };

describe("no confiscation (privacy budget is hard money: spend and stake yes, confiscate never)", () => {
  test("the level above may not take what a part earned -- but the owner may spend it", () => {
    const parts: readonly Address[] = ["alpha", "beta"];

    // Red: the constructed violator. beta's balance falls and beta did not ask.
    expect(obligations.noConfiscation(balance, ownerInitiated, act, parts, view, [confiscateBeta])).toBe(false);

    // Green: IDENTICAL effect on the balance, permitted, because the rule is about who initiates.
    // A predicate that forbade any decrease would fail this line and would be the wrong law.
    expect(obligations.noConfiscation(balance, ownerInitiated, act, parts, view, [ownerSpendBeta])).toBe(true);

    // The two are indistinguishable inside `deliver` — the missing-sender finding, demonstrated.
    expect(balance(act(view, confiscateBeta), "beta")).toBeCloseTo(4, 12);
    expect(balance(act(view, ownerSpendBeta), "beta")).toBeCloseTo(4, 12);

    // Evidence, not a bare false.
    expect(
      obligations.confiscationWitnesses(balance, ownerInitiated, act, parts, view, [
        noop,
        { kind: "owner-spend", from: "alpha" },
        confiscateBeta,
      ]),
    ).toEqual([confiscateBeta]);
  });

  test("the check is only as strong as its owner witness, and reports when it is not", () => {
    const parts: readonly Address[] = ["alpha", "beta"];
    const messages: readonly Msg[] = [{ kind: "confiscate", from: "alpha" }, confiscateBeta];

    // Declare everything owner-initiated and the check passes having measured nothing...
    expect(obligations.noConfiscation(balance, () => true, act, parts, view, messages)).toBe(true);
    // ...and that is REPORTED, which is the price of the missing sender field made visible.
    expect(obligations.confiscationCheckHasNoTeeth(() => true, messages)).toBe(true);

    // With an honest witness the same messages go red, and the check has teeth.
    expect(obligations.noConfiscation(balance, ownerInitiated, act, parts, view, messages)).toBe(false);
    expect(obligations.confiscationCheckHasNoTeeth(ownerInitiated, messages)).toBe(false);

    // An empty message list is likewise no discharge.
    expect(obligations.confiscationCheckHasNoTeeth(ownerInitiated, [])).toBe(true);
  });

  test("confiscation is judged over the PARTS, not over the aggregate's own books", () => {
    // beta is not named as a part here, so the same message is not a confiscation FROM A PART.
    // Scoping to the supplied parts is what keeps this from becoming a general accounting check.
    expect(obligations.noConfiscation(balance, ownerInitiated, act, ["alpha"], view, [confiscateBeta])).toBe(true);
    expect(obligations.noConfiscation(balance, ownerInitiated, act, ["alpha", "beta"], view, [confiscateBeta])).toBe(
      false,
    );
  });
});
