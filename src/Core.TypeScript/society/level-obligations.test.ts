import { describe, expect, test } from "bun:test";
import { type Ladder, levelLaws, obligations } from "./levels";
import type { Address, Addressed, Reading, Society } from "./society";

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
 * initiated them — the point of the no-confiscation rule.
 *
 * **They are now redundant, and that redundancy is the result.** #10968 needed two variants because
 * the substrate carried no sender, so the *body* had to encode the initiator and a caller-supplied
 * `ownerInitiated` witness read it back out. With `Addressed.from` the initiator is on the envelope,
 * so one body under two senders suffices — see the single-body falsifier below. Both variants are
 * kept because #10968's assertions are kept.
 *
 * `who` is the address whose budget moves — renamed from `from`, which now means the **sender** and
 * lives on the envelope. `cross-spend` lowers TWO balances at once, to exhibit the gap the old
 * whole-message boolean left open.
 */
type Msg =
  | { readonly kind: "noop" }
  | { readonly kind: "revoke-route"; readonly hop: Address }
  | { readonly kind: "confiscate"; readonly who: Address }
  | { readonly kind: "owner-spend"; readonly who: Address }
  | { readonly kind: "cross-spend"; readonly payer: Address; readonly victim: Address };

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
        return [spend(v, m.who), []] as const;
      case "cross-spend":
        return [spend(spend(v, m.payer), m.victim), []] as const;
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
      obligations.exitReductionWitnesses(hopCount, act, view, [noop, revokeGamma, { kind: "confiscate", who: "beta" }]),
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
const confiscateBeta: Msg = { kind: "confiscate", who: "beta" };
const ownerSpendBeta: Msg = { kind: "owner-spend", who: "beta" };

/** The rung ABOVE alpha and beta — not a part, and the sender on every attempted stomp below. */
const theLevel: Address = "level";

/** An envelope. `from` is the initiator — the whole discriminator, now read off the substrate. */
const envelope = (from: Address, to: Address, body: Msg): Addressed<Msg> => ({ from, to, body });

describe("no confiscation (privacy budget is hard money: spend and stake yes, confiscate never)", () => {
  test("the level above may not take what a part earned -- but the owner may spend it", () => {
    const parts: readonly Address[] = ["alpha", "beta"];

    // Red: the constructed violator. beta's balance falls and beta did not ask — and "beta did not
    // ask" is now READ FROM THE ENVELOPE (`from = theLevel`), not asserted.
    expect(obligations.noConfiscation(balance, act, parts, view, [envelope(theLevel, "beta", confiscateBeta)])).toBe(
      false,
    );

    // Green: IDENTICAL effect on the balance, permitted, because the rule is about who initiates.
    // A predicate that forbade any decrease would fail this line and would be the wrong law.
    expect(obligations.noConfiscation(balance, act, parts, view, [envelope("beta", "beta", ownerSpendBeta)])).toBe(
      true,
    );

    // The two BODIES are indistinguishable inside `deliver` — still true, and now irrelevant to the
    // verdict, because the verdict no longer reads the body.
    expect(balance(act(view, confiscateBeta), "beta")).toBeCloseTo(4, 12);
    expect(balance(act(view, ownerSpendBeta), "beta")).toBeCloseTo(4, 12);

    // Evidence, not a bare false.
    expect(
      obligations.confiscationWitnesses(balance, act, parts, view, [
        envelope(theLevel, "alpha", noop),
        envelope("alpha", "alpha", { kind: "owner-spend", who: "alpha" }),
        envelope(theLevel, "beta", confiscateBeta),
      ]),
    ).toEqual([envelope(theLevel, "beta", confiscateBeta)]);
  });

  test("THE SENDER IS THE DISCRIMINATOR: one body, two senders, opposite verdicts", () => {
    // The falsifier the `from` field exists for, and the one the old code could not express: a
    // single body sent twice with nothing differing but `from`. Under the old
    // `ownerInitiated: (m: M) => boolean` signature both calls were the SAME call — one body, one
    // boolean, one verdict — so no witness could separate them without being told the answer.
    const parts: readonly Address[] = ["alpha", "beta"];
    const body = confiscateBeta;

    expect(obligations.noConfiscation(balance, act, parts, view, [envelope(theLevel, "beta", body)])).toBe(false);
    expect(obligations.noConfiscation(balance, act, parts, view, [envelope("beta", "beta", body)])).toBe(true);
    // ...with the effect on the balance byte-identical, because it is the same body.
    expect(balance(act(view, body), "beta")).toBeCloseTo(4, 12);

    // **Why the OLD code provably could not do this, asserted rather than argued.** The old
    // discriminator had type `(m: M) => boolean`, so all it could see of these two calls is `body` —
    // and the two bodies are EQUAL. Equal inputs give equal outputs, so no `ownerInitiated` could
    // have returned `false` for the first and `true` for the second. The distinction is not merely
    // unmade by the old code, it is unmakeable at that signature.
    const taking = envelope(theLevel, "beta", body);
    const spending = envelope("beta", "beta", body);
    expect(taking.body).toEqual(spending.body);
    expect(taking.from).not.toEqual(spending.from);

    // A third party is not laundered by being *some* owner: alpha's signature does not license
    // taking beta's budget.
    expect(obligations.noConfiscation(balance, act, parts, view, [envelope("alpha", "beta", body)])).toBe(false);
  });

  test("the whole-message boolean excused CROSS-PART decreases; the per-part derivation does not", () => {
    // `cross-spend` lowers alpha's balance AND beta's. Sent by alpha it is a genuine owner spend *of
    // alpha's own budget*, so the old `ownerInitiated` boolean was true for it — and one true
    // boolean excused the whole message, beta's loss included.
    const cross = envelope("alpha", "beta", { kind: "cross-spend", payer: "alpha", victim: "beta" });

    const after = act(view, cross.body);
    expect(balance(after, "alpha")).toBeCloseTo(2, 12);
    expect(balance(after, "beta")).toBeCloseTo(4, 12);

    // Scoped to alpha alone it is exactly what it claims to be — alpha spending alpha's. Green.
    expect(obligations.noConfiscation(balance, act, ["alpha"], view, [cross])).toBe(true);
    // Scoped to both parts it is red: beta's decrease is checked against `from` on its own account.
    expect(obligations.noConfiscation(balance, act, ["alpha", "beta"], view, [cross])).toBe(false);
    expect(obligations.confiscationWitnesses(balance, act, ["alpha", "beta"], view, [cross])).toEqual([cross]);
    // And it is NOT self-attributed, precisely because it lowers a balance that is not its sender's.
    expect(obligations.confiscationCheckHasNoTeeth(balance, act, ["alpha", "beta"], view, [cross])).toBe(false);
  });

  test("the check is only as strong as its unsigned sender, and reports when it is not", () => {
    const parts: readonly Address[] = ["alpha", "beta"];

    // `from` is DERIVABLE but not SIGNED, so #10968's vacuity did not disappear — it changed shape.
    // Instead of declaring one boolean true, a caller writes the victim's own address into `from` on
    // every message (self-attribution) and the check passes having measured nothing...
    const forged: readonly Addressed<Msg>[] = [
      envelope("alpha", "alpha", { kind: "confiscate", who: "alpha" }),
      envelope("beta", "beta", confiscateBeta),
    ];
    expect(obligations.noConfiscation(balance, act, parts, view, forged)).toBe(true);
    // ...and that is REPORTED, which is why the guard was kept rather than deleted with the witness
    // parameter it originally guarded.
    expect(obligations.confiscationCheckHasNoTeeth(balance, act, parts, view, forged)).toBe(true);

    // With honest senders the same bodies go red, and the check has teeth.
    const honest: readonly Addressed<Msg>[] = [
      envelope(theLevel, "alpha", { kind: "confiscate", who: "alpha" }),
      envelope(theLevel, "beta", confiscateBeta),
    ];
    expect(obligations.noConfiscation(balance, act, parts, view, honest)).toBe(false);
    expect(obligations.confiscationCheckHasNoTeeth(balance, act, parts, view, honest)).toBe(false);

    // An empty message list is likewise no discharge.
    expect(obligations.confiscationCheckHasNoTeeth(balance, act, parts, view, [])).toBe(true);

    // A batch that touches no balance at all HAS teeth — it simply found nothing. Reporting it as
    // toothless would conflate "measured and clean" with "could not measure".
    expect(
      obligations.confiscationCheckHasNoTeeth(balance, act, parts, view, [envelope(theLevel, "alpha", noop)]),
    ).toBe(false);
  });

  test("confiscation is judged over the PARTS, not over the aggregate's own books", () => {
    // beta is not named as a part here, so the same message is not a confiscation FROM A PART.
    // Scoping to the supplied parts is what keeps this from becoming a general accounting check.
    const taking = envelope(theLevel, "beta", confiscateBeta);
    expect(obligations.noConfiscation(balance, act, ["alpha"], view, [taking])).toBe(true);
    expect(obligations.noConfiscation(balance, act, ["alpha", "beta"], view, [taking])).toBe(false);
  });
});
