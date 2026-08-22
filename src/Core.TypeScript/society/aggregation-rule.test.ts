import { describe, expect, test } from "bun:test";
import {
  allOf,
  anyOf,
  classify,
  dominanceAxes,
  imitationWitnesses,
  justificationsIn,
  ofKOfN,
  plurality,
  threshold,
  toBooleanRule,
  union,
  veto,
  verdictKey,
  weighted,
  type Justification,
  type Purpose,
  type Rule,
  type Verdict,
  type WeightBasis,
} from "./aggregation-rule";
import { aggregation } from "./levels";

// ── Why these tests exist ─────────────────────────────────────────────────────────────────────
//
// * `classify` / `ofKOfN` / `dominanceAxes` / `toBooleanRule` are real behaviour and get real
//   falsifiers — including the one the brief demanded: **a wrong-direction pairing must be
//   detectable.** A DU that cannot express a mismatch has not made mismatches impossible, it has
//   made them invisible.
// * THE INVENTORY is repo-meta: 21 rows read off PR #10955, which read them off the code. Its
//   verdicts are locked as text keys, and the fixture is duplicated in
//   `tests/Tests.FSharp/AggregationRule.Tests.fs`. If the two disagree, the oracles have diverged on
//   the classification, which is the reason for keeping both.
// * The lock is a lock, not a proof: it says the classifier is stable and cross-oracle consistent. It
//   says nothing about whether a classified site behaves as classified.
// * Ordinal string comparison only — `===` and `+`, no `localeCompare` anywhere
//   (`culture-invariant-by-default`).

const unstated = (note: string): Justification => ({ kind: "unstated", note });
const faultTolerance = (f: number): Justification => ({ kind: "fault-tolerance", toleratedFaults: f });
const nonAccuracy = (what: Justification): Purpose => ({ kind: "non-accuracy", what });

const recall: Purpose = { kind: "recall" };
const safety: Purpose = { kind: "safety" };
const twoSided: Purpose = { kind: "two-sided-accuracy" };

interface Site {
  readonly id: string;
  readonly path: string;
  readonly purpose: Purpose;
  readonly rule: Rule;
}

// ── §1 The inventory — PR #10955's 21 sites, each as exactly one DU case ──────────────────────

const inventory: readonly Site[] = [
  // 1.1 does-not-qualify (3)
  {
    id: "review-board",
    path: "agentic-organization/packages/metrics/src/review-board.ts:115",
    purpose: recall,
    rule: threshold(
      3,
      unstated("module attributes its design to the constitution gate (legitimacy); no precision trade is named"),
    ),
  },
  {
    id: "workflow-consensus",
    path: "src/Core.TypeScript/workflow-engine/consensus.ts:195",
    purpose: twoSided,
    rule: threshold(2, unstated("Robin-architecture majority over an arbitrary analyzer array")),
  },
  {
    id: "rmo-target-median",
    path: "agentic-organization/packages/application/src/rmo.ts:331-338",
    purpose: twoSided,
    rule: threshold(2, unstated("median of approver targets: the k-th order statistic at k = ceil(n/2)")),
  },

  // 1.2 weighted, but the weights are not competence (2)
  {
    id: "thousand-brains",
    path: "src/Bayesian/ThousandBrains.fs:73",
    purpose: twoSided,
    rule: weighted({ kind: "experience-proxy", quantity: "log(1 + accumulated information value)" }),
  },
  {
    id: "quorum-algebra",
    path: "src/Core/QuorumAlgebra.fs:151",
    purpose: twoSided,
    rule: weighted({ kind: "self-asserted", quantity: "complex amplitude" }),
  },

  // 1.3 qualifies (6 in #10955; 7 here — see the delta test)
  { id: "society-useful-work", path: "src/Core/SocietyUsefulWork.fs:32,82", purpose: recall, rule: union },
  {
    id: "belief-convergence",
    path: "src/Core/BeliefConvergence.fs:33,63",
    purpose: twoSided,
    rule: weighted({ kind: "endogenous-evidence", quantity: "likelihood ratio" }),
  },
  {
    id: "society-bootstrap",
    path: "src/Bayesian/SocietyBootstrap.fs:138 + SparseSocietyNetwork.fs:105,178",
    purpose: twoSided,
    rule: weighted({ kind: "endogenous-evidence", quantity: "inverse variance" }),
  },
  {
    id: "local-consensus",
    path: "src/Bayesian/LocalConsensus.fs:52",
    purpose: twoSided,
    rule: weighted({ kind: "endogenous-evidence", quantity: "inverse variance" }),
  },
  { id: "mutual-falsification", path: "src/Bayesian/MutualFalsification.fs:185", purpose: recall, rule: union },
  {
    id: "decorrelation-meter",
    path: "src/Core/DecorrelationMeter.fs:136 + DecorrelationExcessFusion.fs:116,196",
    purpose: recall,
    rule: union,
  },

  // 1.4 not an accuracy aggregator (10 in #10955; 9 here — see the delta test)
  {
    id: "bft-consensus",
    path: "src/Core.CSharp/Consensus.cs:18,47 + src/Core/Consensus.fs",
    purpose: nonAccuracy(faultTolerance(1)),
    rule: threshold(3, faultTolerance(1)),
  },
  {
    id: "sybil-bft",
    path: "src/Core/SybilBft.fs:82-95 + SybilBftProtocol.fs:91,107",
    purpose: nonAccuracy(faultTolerance(1)),
    rule: threshold(3, faultTolerance(1)),
  },
  {
    id: "nway-diff",
    path: "tests/cross-verification/_harness/nway-diff.ts:407,456",
    purpose: nonAccuracy({ kind: "integrity-check" }),
    rule: plurality({ kind: "integrity-check" }),
  },
  {
    id: "constitution-gate",
    path: "agentic-organization/packages/governance/src/constitution-gate.ts:93-110",
    purpose: nonAccuracy({ kind: "legitimacy" }),
    rule: allOf([veto, threshold(2, { kind: "legitimacy" })]),
  },
  {
    id: "change-control-security",
    path: "agentic-organization/packages/application/src/change-control-policy.ts:35 + change-control-kernel.ts:142-145",
    purpose: safety,
    rule: veto,
  },
  {
    id: "work-market",
    path: "agentic-organization/packages/application/src/work-market.ts:625-645",
    purpose: nonAccuracy({ kind: "authorization" }),
    rule: threshold(2, { kind: "authorization" }),
  },
  {
    id: "mutual-repair",
    path: "agentic-organization/packages/application/src/mutual-repair.ts:34-40",
    purpose: nonAccuracy({ kind: "liveness-precondition" }),
    rule: threshold(3, { kind: "liveness-precondition" }),
  },
  {
    id: "veridicality",
    path: "src/Core/Veridicality.fs:200",
    purpose: nonAccuracy({ kind: "independence-check" }),
    rule: threshold(2, { kind: "independence-check" }),
  },
  {
    id: "diversity-coercive-step",
    path: "src/Core/Diversity.fs:45",
    purpose: nonAccuracy({ kind: "model-not-mechanism" }),
    rule: plurality({ kind: "model-not-mechanism" }),
  },
  {
    id: "condorcet-boundary",
    path: "src/Bayesian/CondorcetBoundary.fs",
    purpose: nonAccuracy({ kind: "model-not-mechanism" }),
    rule: threshold(2, { kind: "model-not-mechanism" }),
  },
];

/**
 * **Configuration-dependent regimes.** Several sites are one rule at their default configuration and
 * a DIFFERENT rule at another, because `ofKOfN` normalises at the endpoints. This is where the mirror
 * sweep actually lands. Kept separate so the count of *sites* stays #10955's 21.
 */
const regimes: readonly Site[] = [
  // The board convenes only when reviewerCount >= quorum (review-board.ts:146). At the MINIMUM
  // convening size the quorum IS every reviewer, so k = n and the rule normalises to veto —
  // unanimity on a discovery task, the exact mirror of the dominant rule.
  {
    id: "review-board@n=quorum",
    path: "agentic-organization/packages/metrics/src/review-board.ts:146 + :115",
    purpose: recall,
    rule: ofKOfN(3, 3, unstated("quorum equals the convening minimum")),
  },
  {
    id: "work-market@k=1",
    path: "agentic-organization/deploy/run-org-cadence.ts:761",
    purpose: nonAccuracy({ kind: "authorization" }),
    rule: ofKOfN(1, 3, { kind: "authorization" }),
  },
  {
    id: "workflow-consensus@unanimous",
    path: "src/Core.TypeScript/workflow-engine/consensus.ts:200",
    purpose: twoSided,
    rule: ofKOfN(3, 3, unstated("mechanism = unanimous")),
  },
  {
    id: "workflow-consensus@first-1-agree",
    path: "src/Core.TypeScript/workflow-engine/consensus.ts:204",
    purpose: twoSided,
    rule: ofKOfN(1, 3, unstated("mechanism = first-n-agree with n = 1")),
  },
  {
    id: "workflow-consensus@supermajority",
    path: "src/Core.TypeScript/workflow-engine/consensus.ts:198",
    purpose: twoSided,
    rule: ofKOfN(3, 4, unstated("mechanism = supermajority; a higher unweighted bar")),
  },
];

// ── §2 THE CROSS-ORACLE FIXTURE — byte-identical to the F# twin, same order ────────────────────

const expectedInventoryKeys: readonly (readonly [string, string])[] = [
  ["review-board", "does-not-dominate:unstated"],
  ["workflow-consensus", "does-not-dominate:unstated"],
  ["rmo-target-median", "does-not-dominate:unstated"],
  ["thousand-brains", "deference-reachable-not-chosen:experience-proxy:log(1 + accumulated information value)"],
  ["quorum-algebra", "deference-reachable-not-chosen:self-asserted:complex amplitude"],
  ["society-useful-work", "dominates:recall"],
  ["belief-convergence", "dominates:accuracy"],
  ["society-bootstrap", "dominates:accuracy"],
  ["local-consensus", "dominates:accuracy"],
  ["mutual-falsification", "dominates:recall"],
  ["decorrelation-meter", "dominates:recall"],
  ["bft-consensus", "out-of-scope:fault-tolerance:1"],
  ["sybil-bft", "out-of-scope:fault-tolerance:1"],
  ["nway-diff", "out-of-scope:integrity-check"],
  ["constitution-gate", "out-of-scope:legitimacy"],
  ["change-control-security", "dominates:safety"],
  ["work-market", "out-of-scope:authorization"],
  ["mutual-repair", "out-of-scope:liveness-precondition"],
  ["veridicality", "out-of-scope:independence-check"],
  ["diversity-coercive-step", "out-of-scope:model-not-mechanism"],
  ["condorcet-boundary", "out-of-scope:model-not-mechanism"],
];

const expectedRegimeKeys: readonly (readonly [string, string])[] = [
  ["review-board@n=quorum", "mirror-mismatch:recall:safety"],
  ["work-market@k=1", "out-of-scope:authorization"],
  ["workflow-consensus@unanimous", "wrong-axis:accuracy:safety"],
  ["workflow-consensus@first-1-agree", "wrong-axis:accuracy:recall"],
  ["workflow-consensus@supermajority", "does-not-dominate:unstated"],
];

describe("the classification pass over PR #10955's inventory", () => {
  test("inventory has 21 sites, no more and no fewer", () => {
    expect(inventory.length).toBe(21);
  });

  test("every inventory site classifies to its locked verdict", () => {
    const actual = inventory.map((s) => [s.id, verdictKey(classify(s.purpose, s.rule))] as const);
    expect(actual).toEqual([...expectedInventoryKeys]);
  });

  test("every configuration regime classifies to its locked verdict", () => {
    const actual = regimes.map((s) => [s.id, verdictKey(classify(s.purpose, s.rule))] as const);
    expect(actual).toEqual([...expectedRegimeKeys]);
  });

  test("the bucket counts, and the one delta from PR #10955", () => {
    const verdicts = inventory.map((s) => classify(s.purpose, s.rule));
    const count = (kind: Verdict["kind"]): number => verdicts.filter((v) => v.kind === kind).length;

    // #10955: 3 does-not-qualify, 2 weights-not-competence, 6 qualifies, 10 not-an-accuracy-aggregator.
    expect(count("does-not-dominate")).toBe(3);
    expect(count("deference-reachable-not-chosen")).toBe(2);
    // THE DELTA, a promotion not a demotion: `change-control-security` is 3-of-3, i.e. k = n, i.e.
    // veto, on a stated SAFETY objective — so it does not merely fall outside the accuracy theorem,
    // it DOMINATES on the safety axis. #10955's own triangle already says veto dominates on safety.
    expect(count("dominates")).toBe(7);
    expect(count("out-of-scope")).toBe(9);
    expect(verdicts.length).toBe(21);
  });
});

// ── §3 The falsifier the brief asked for: a wrong-direction pairing is DETECTABLE ─────────────

describe("mirror defects are visible, not invisible", () => {
  test("a safety rule on a recall task is a mirror mismatch, not a pass", () => {
    expect(classify(recall, veto)).toEqual({ kind: "mirror-mismatch", needed: "recall", offered: "safety" });
  });

  test("a recall rule on a safety task is a mirror mismatch, not a pass", () => {
    expect(classify(safety, union)).toEqual({ kind: "mirror-mismatch", needed: "safety", offered: "recall" });
  });

  test("the negative controls: right-direction pairings are NOT mismatches", () => {
    // Without these, a classifier returning `mirror-mismatch` for everything would pass the two tests
    // above. This is the half that makes them a falsifier rather than a slogan.
    expect(classify(recall, union)).toEqual({ kind: "dominates", axis: "recall" });
    expect(classify(safety, veto)).toEqual({ kind: "dominates", axis: "safety" });
    expect(classify(twoSided, weighted({ kind: "log-odds-competence" }))).toEqual({
      kind: "dominates",
      axis: "accuracy",
    });
  });

  test("a two-sided rule on a one-sided task is wrong-axis, a weaker finding than a mirror", () => {
    expect(classify(recall, weighted({ kind: "log-odds-competence" }))).toEqual({
      kind: "wrong-axis",
      needed: "recall",
      offered: "accuracy",
    });
    expect(classify(twoSided, union)).toEqual({ kind: "wrong-axis", needed: "accuracy", offered: "recall" });
  });
});

// ── §4 The generator, and why the mirror sweep falls out of it for free ───────────────────────

describe("k-of-n is the generator and it normalises", () => {
  const why = unstated("witness");

  test("k=1 is union, k=n is veto, only the strict middle is a threshold", () => {
    expect(ofKOfN(1, 5, why)).toEqual(union);
    expect(ofKOfN(0, 5, why)).toEqual(union);
    expect(ofKOfN(-3, 5, why)).toEqual(union);
    expect(ofKOfN(5, 5, why)).toEqual(veto);
    expect(ofKOfN(9, 5, why)).toEqual(veto);
    expect(ofKOfN(3, 5, why)).toEqual(threshold(3, why));
    // n clamped to at least 1: a rule over no units is not a rule.
    expect(ofKOfN(1, 0, why)).toEqual(union);
  });

  test("a quorum equal to the roll size IS a veto — the review board's mirror defect, surfaced", () => {
    const rule = ofKOfN(3, 3, unstated("DEFAULT_REVIEW_QUORUM at the minimum convening size"));
    expect(rule).toEqual(veto);
    expect(classify(recall, rule)).toEqual({ kind: "mirror-mismatch", needed: "recall", offered: "safety" });
  });

  test("the strict middle dominates on nothing, for every k and every purpose", () => {
    for (let k = 2; k <= 12; k += 1) {
      const rule = threshold(k, unstated("any k"));
      expect(dominanceAxes(rule)).toEqual([]);
      for (const purpose of [recall, safety, twoSided]) {
        expect(classify(purpose, rule).kind).toBe("does-not-dominate");
      }
    }
  });
});

// ── §5 BFT and the integrity detectors stay honest — expressible, not mislabelled ─────────────

describe("the justification field is what keeps BFT honest", () => {
  const bft = threshold(3, faultTolerance(1));

  test("a Byzantine quorum is out of scope, never a defect", () => {
    expect(classify(nonAccuracy(faultTolerance(1)), bft)).toEqual({
      kind: "out-of-scope",
      what: faultTolerance(1),
    });
  });

  test("the same k at a site claiming an accuracy objective IS a finding — the purpose is what moved", () => {
    const verdict = classify(twoSided, bft);
    expect(verdict.kind).toBe("does-not-dominate");
    expect(verdict.kind === "does-not-dominate" && verdict.why.kind).toBe("fault-tolerance");
  });

  test("a bare quorum cannot be laundered by borrowing a comfortable justification", () => {
    // Without this, `non-accuracy` would be a universal escape hatch.
    const laundered = threshold(3, unstated("nothing at the site says why"));
    expect(classify(nonAccuracy(faultTolerance(1)), laundered).kind).toBe("justification-disagrees");
  });

  test("a priced precision trade is expressible and is not the same verdict as an unpriced one", () => {
    const priced = threshold(3, {
      kind: "priced-precision-trade",
      rationale: "suppresses noisy-reviewer spam at a measured recall cost",
    });
    const unpriced = threshold(3, unstated("nothing names the trade"));
    // Both dominate on nothing — the theorem does not care about intentions. But the verdicts are
    // distinguishable, which is what lets a defensible quorum exist without being called a defect.
    expect(verdictKey(classify(recall, priced))).not.toBe(verdictKey(classify(recall, unpriced)));
  });
});

// ── §6 Weight basis is what decides whether the lift actually holds ───────────────────────────

test("deference reachable but not chosen is distinguished from deference achieved", () => {
  const achieved: readonly WeightBasis[] = [
    { kind: "log-odds-competence" },
    { kind: "endogenous-evidence", quantity: "likelihood ratio" },
  ];
  const reachable: readonly WeightBasis[] = [
    { kind: "experience-proxy", quantity: "tenure" },
    { kind: "self-asserted", quantity: "amplitude" },
  ];

  for (const basis of achieved) {
    expect(classify(twoSided, weighted(basis))).toEqual({ kind: "dominates", axis: "accuracy" });
  }
  for (const basis of reachable) {
    expect(classify(twoSided, weighted(basis))).toEqual({ kind: "deference-reachable-not-chosen", basis });
  }
});

// ── §7 Composition — earned by exactly one site, and its law is checked ───────────────────────

test("conjunction keeps safety, disjunction keeps recall, and neither manufactures accuracy", () => {
  const quorum = threshold(2, { kind: "legitimacy" });
  expect(dominanceAxes(allOf([veto, quorum]))).toEqual(["safety"]);
  expect(dominanceAxes(anyOf([union, quorum]))).toEqual(["recall"]);
  expect(dominanceAxes(allOf([union, quorum]))).toEqual([]);
  expect(dominanceAxes(anyOf([veto, quorum]))).toEqual([]);
  expect(dominanceAxes(allOf([weighted({ kind: "log-odds-competence" }), quorum]))).toEqual([]);
  // An empty composite is not a rule and must not read as accept-always / reject-always.
  expect(dominanceAxes(allOf([]))).toEqual([]);
  expect(dominanceAxes(anyOf([]))).toEqual([]);
  expect(toBooleanRule(allOf([]))).toBeUndefined();
  expect(toBooleanRule(anyOf([]))).toBeUndefined();
});

// ── §8 The boolean semantics agree with the k-of-n counting they claim to be ──────────────────

test("union, veto and threshold agree with counting, over every 4-vote input", () => {
  const apply = (rule: Rule, votes: readonly boolean[]): boolean => {
    const f = toBooleanRule(rule);
    if (f === undefined) throw new Error("rule has no boolean reading");
    return f(votes);
  };

  for (let mask = 0; mask < 16; mask += 1) {
    const votes = [0, 1, 2, 3].map((bit) => (mask & (1 << bit)) !== 0);
    const yes = votes.filter((v) => v).length;
    expect(apply(union, votes)).toBe(yes >= 1);
    expect(apply(veto, votes)).toBe(yes >= 4);
    expect(apply(threshold(3, unstated("count")), votes)).toBe(yes >= 3);
  }
});

// ── §9 The connection to `aggregation.canImitateEveryProjection`, and its honest limit ─────────

const boolEq = (a: boolean, b: boolean): boolean => a === b;

const asFunction = (rule: Rule): ((votes: readonly boolean[]) => boolean) => {
  const f = toBooleanRule(rule);
  if (f === undefined) throw new Error("rule has no boolean reading");
  return f;
};

describe("the witness check in ./levels, used where it works and pinned where it does not", () => {
  test("union and veto discharge it with witnesses derived from the rule itself", () => {
    for (const rule of [union, veto]) {
      const witnesses = imitationWitnesses(4, rule);
      expect(witnesses).toBeDefined();
      expect(
        aggregation.canImitateEveryProjection<boolean, boolean>(boolEq, asFunction(rule), (p) => p, witnesses ?? []),
      ).toBe(true);
    }
  });

  test("THE COUNTEREXAMPLE: unweighted 2-of-3 also discharges it, so a discharge is not dominance", () => {
    // This is why this module is not redundant with `canImitateEveryProjection`. That predicate asks
    // for pointwise agreement on ONE caller-chosen input per index, which is far weaker than "the
    // projection lies in the rule class" — and unweighted majority, the canonical NON-deferential
    // rule, passes it with cherry-picked witnesses. Its docstring already forbids reading a discharge
    // as dominance; this pins WHY that caveat is load-bearing, and locks the counterexample so a
    // future strengthening of the helper has something to be measured against.
    const majority2of3 = threshold(2, unstated("the canonical non-deferential rule"));
    const cherryPicked: readonly (readonly boolean[])[] = [
      [true, true, false],
      [false, true, true],
      [false, true, true],
    ];
    expect(
      aggregation.canImitateEveryProjection<boolean, boolean>(boolEq, asFunction(majority2of3), (p) => p, cherryPicked),
    ).toBe(true);
    // And the structural verdict, which is the one that discriminates, says the opposite.
    expect(dominanceAxes(majority2of3)).toEqual([]);
    expect(classify(twoSided, majority2of3).kind).toBe("does-not-dominate");
  });
});

// ── §10 Exhaustiveness — every case is used by a site or is DECLARED unpopulated ───────────────
//
// `Record<Union, true>` is the compile-time half: adding a case to any of these unions makes the
// corresponding literal fail to typecheck until it is listed. The runtime half then insists each
// listed case is either exercised by the inventory or explicitly declared unpopulated, with a reason.

const ALL_RULE_KINDS: Record<Rule["kind"], true> = {
  union: true,
  veto: true,
  weighted: true,
  threshold: true,
  plurality: true,
  "all-of": true,
  "any-of": true,
};

const ALL_JUSTIFICATION_KINDS: Record<Justification["kind"], true> = {
  "fault-tolerance": true,
  "integrity-check": true,
  "independence-check": true,
  legitimacy: true,
  authorization: true,
  "liveness-precondition": true,
  "model-not-mechanism": true,
  "priced-precision-trade": true,
  unstated: true,
};

const ALL_WEIGHT_BASIS_KINDS: Record<WeightBasis["kind"], true> = {
  "log-odds-competence": true,
  "endogenous-evidence": true,
  "experience-proxy": true,
  "self-asserted": true,
};

const ALL_PURPOSE_KINDS: Record<Purpose["kind"], true> = {
  recall: true,
  safety: true,
  "two-sided-accuracy": true,
  "non-accuracy": true,
};

const ALL_VERDICT_KINDS: Record<Verdict["kind"], true> = {
  dominates: true,
  "mirror-mismatch": true,
  "wrong-axis": true,
  "deference-reachable-not-chosen": true,
  "does-not-dominate": true,
  "out-of-scope": true,
  "justification-disagrees": true,
};

const allRows: readonly Site[] = [...inventory, ...regimes];

function assertExhaustive(
  label: string,
  declared: Record<string, true>,
  used: ReadonlySet<string>,
  unpopulated: readonly string[],
): void {
  const declaredNames = Object.keys(declared).sort();
  for (const name of unpopulated) {
    expect(declaredNames, `${label}: declared-unpopulated names no such case: ${name}`).toContain(name);
    expect(used.has(name), `${label}: listed as unpopulated but actually used: ${name}`).toBe(false);
  }
  const missing = declaredNames.filter((n) => !used.has(n) && !unpopulated.includes(n));
  expect(missing, `${label}: case neither used nor declared unpopulated`).toEqual([]);
}

function ruleKinds(rule: Rule): readonly string[] {
  if (rule.kind === "all-of" || rule.kind === "any-of") {
    return [rule.kind, ...rule.rules.flatMap(ruleKinds)];
  }
  return [rule.kind];
}

describe("exhaustiveness over the inventory", () => {
  test("every Rule case is exercised by a site or declared unpopulated", () => {
    const used = new Set(allRows.flatMap((s) => ruleKinds(s.rule)));
    // `any-of` ships because its dominance law is the exact dual of `all-of`'s and stating one half
    // of a lattice would misrepresent the algebra. No site composes disjunctively today. A register
    // label, not a hidden mechanism — if a site ever appears, delete this entry.
    assertExhaustive("Rule", ALL_RULE_KINDS, used, ["any-of"]);
  });

  test("every Justification case is exercised by a site or declared unpopulated", () => {
    const used = new Set(
      allRows.flatMap((s) => [
        ...justificationsIn(s.rule).map((j) => j.kind),
        ...(s.purpose.kind === "non-accuracy" ? [s.purpose.what.kind] : []),
      ]),
    );
    // `priced-precision-trade` is the defence a quorum gate is ENTITLED to make. #10955 looked for
    // one at the review board and did not find it. The case exists so a legitimate quorum can be
    // expressed WITHOUT being mislabelled a defect — a taxonomy that cannot say "justified" turns
    // every threshold into a finding, which makes the finding worthless.
    assertExhaustive("Justification", ALL_JUSTIFICATION_KINDS, used, ["priced-precision-trade"]);
  });

  test("every WeightBasis case is exercised by a site or declared unpopulated", () => {
    const used = new Set(allRows.flatMap((s) => (s.rule.kind === "weighted" ? [s.rule.basis.kind] : [])));
    // THE FINDING IN THIS LINE: no site in this repo weights by a MEASURED competence. Not an
    // oversight in the taxonomy — #10955's central recommendation restated as a type. The log-odds
    // route needs per-agent competence estimates and nobody has banked one, so the available
    // dominating rules today are the free ones (union, veto), not the weighted one.
    assertExhaustive("WeightBasis", ALL_WEIGHT_BASIS_KINDS, used, ["log-odds-competence"]);
  });

  test("every Purpose case is exercised by a site", () => {
    const used = new Set(allRows.map((s) => s.purpose.kind));
    assertExhaustive("Purpose", ALL_PURPOSE_KINDS, used, []);
  });

  test("every Verdict case is reached by a site or declared unreached", () => {
    const used = new Set(allRows.map((s) => classify(s.purpose, s.rule).kind));
    // `justification-disagrees` is a GUARD, not a classification: it fires only when a site labels its
    // threshold with a purpose the site does not claim. No site does that today, and that is the good
    // outcome. Its falsifier is the laundering test above, which constructs the disagreement.
    assertExhaustive("Verdict", ALL_VERDICT_KINDS, used, ["justification-disagrees"]);
  });
});
