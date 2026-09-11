import { describe, expect, test } from "bun:test";
import {
  chooseWithinLegal,
  firstLegalChooser,
  preferChooser,
  type OrgChooser,
} from "./org-decision";
import {
  CHECKPOINT_GATE,
  GateKind,
  GateOutcome,
  HumanCheckpoint,
  NO_PROPOSER,
  ORDERED_GATES,
  RecoveryPath,
  allGatesPassed,
  evaluateGate,
  gateOwners,
  gateProgress,
  humanGatesFor,
  isPassing,
  legalGateOutcomes,
  legalGateOutcomesFor,
  mayEvaluate,
  nextLegalGate,
  recoveryPathFor,
  runGateChain,
} from "./quality-gate";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const approve: OrgChooser<GateOutcome> = preferChooser<GateOutcome>(GateOutcome.Approved, "approve");
const reject: OrgChooser<GateOutcome> = preferChooser<GateOutcome>(GateOutcome.Rejected, "reject");

// ─── The decision kernel ────────────────────────────────────────────────────

describe("THE ORDER OF THE CHAIN IS A DECISION, NOT AN ACCIDENT", () => {
  test("the gates run in the agreed sequence, architecture before business at the end", () => {
    // Pinned because the order was changed once and NOTHING failed. A sequence every other part of
    // the system trusts — `nextLegalGate` refuses to skip, recovery paths are keyed to position —
    // was resting on the order somebody happened to type.
    //
    // Architecture sits before business deliberately: the architect asks whether the code does what
    // it claims, the business validator whether it delivers the outcome. Business-first lets the
    // organization accept an outcome built on a structure it has not examined, and then treat
    // re-opening that structure as a regression against its own approval.
    expect([...ORDERED_GATES]).toEqual([
      GateKind.BusinessContextGrooming,
      GateKind.CustomerRfpReview,
      GateKind.BrdApproval,
      GateKind.PeerReview,
      GateKind.ArchitectureDesign,
      GateKind.ArchitectureApproval,
      GateKind.CostApproval,
      GateKind.AdversarialReview,
      // A defect is reproduced immediately before it is fixed — see `GateKind.Reproduction`.
      GateKind.Reproduction,
      GateKind.ImplementationReview,
      GateKind.QaUat,
      GateKind.RuntimeValidation,
      GateKind.FinalArchitectureReview,
      GateKind.FinalBusinessValidation,
      GateKind.ReleaseReadiness,
    ]);
  });

  test("no gate is legal until every prior one has passed", () => {
    // The north star's words: `nextLegalGate` makes a gate legal iff all priors passed. Asserted
    // against the WHOLE chain rather than a sample, so a gate added in the middle cannot quietly
    // become skippable.
    const passed = new Set<GateKind>();
    for (const gate of ORDERED_GATES) {
      expect(nextLegalGate(passed)).toBe(gate);
      passed.add(gate);
    }
    expect(nextLegalGate(passed)).toBeUndefined();
  });
});

describe("determinism sets the legal options; the agent picks inside them", () => {
  test("an in-range pick is taken as given", () => {
    const c = chooseWithinLegal(["a", "b", "c"], "ctx", () => ({ index: 1, reason: "b" }));
    expect(c.outcome).toBe("chosen");
    if (c.outcome !== "chosen") return;
    expect(c.option).toBe("b");
    expect(c.clamped).toBe(false);
  });

  test("AN OUT-OF-RANGE INDEX IS CLAMPED, never followed", () => {
    // The load-bearing line: a chooser returning 999 must not read past the legal set. Reading the
    // option out by an unclamped index is how a model's arithmetic slip becomes an authorization
    // bypass.
    const high = chooseWithinLegal(["a", "b"], "ctx", () => ({ index: 999, reason: "?" }));
    expect(high.outcome === "chosen" && high.option).toBe("b");
    const low = chooseWithinLegal(["a", "b"], "ctx", () => ({ index: -5, reason: "?" }));
    expect(low.outcome === "chosen" && low.option).toBe("a");
  });

  test("clamping is REPORTED, not swallowed", () => {
    // A chooser that keeps asking out of range is malfunctioning, and the pick is still legal —
    // which is exactly what makes the failure quiet unless it is surfaced.
    const c = chooseWithinLegal(["a", "b"], "ctx", () => ({ index: 99, reason: "?" }));
    expect(c.outcome === "chosen" && c.clamped).toBe(true);
  });

  test("NaN and fractional indices do not escape the clamp", () => {
    // NaN survives both Math.max and Math.min untouched — the one input that defeats a naive clamp,
    // and it would index to `undefined`.
    const nan = chooseWithinLegal(["a", "b"], "ctx", () => ({ index: Number.NaN, reason: "?" }));
    expect(nan.outcome).toBe("chosen");
    expect(nan.outcome === "chosen" && nan.option).toBe("a");

    const frac = chooseWithinLegal(["a", "b", "c"], "ctx", () => ({ index: 1.9, reason: "?" }));
    expect(frac.outcome === "chosen" && frac.option).toBe("b");
  });

  test("a chooser that THROWS does not take the organization down", () => {
    const c = chooseWithinLegal(["a", "b"], "ctx", () => {
      throw new Error("model died");
    });
    expect(c.outcome).toBe("chosen");
    if (c.outcome !== "chosen") return;
    expect(c.option).toBe("a");
    // …and the record says nobody actually chose.
    expect(c.reason).toContain("threw");
  });

  test("an EMPTY legal set is a result with the RIGHT reason, not a default", () => {
    const c = chooseWithinLegal([], "gate x", firstLegalChooser());
    expect(c.outcome).toBe("no_legal_option");
    if (c.outcome !== "no_legal_option") return;
    expect(c.reason).toContain("gate x");
    // Asserting only the outcome passed for the wrong reason: without the empty-set guard the
    // clamp-failure branch catches it too, and reports "clamp failed". Those are different
    // diagnoses — "the rules permit nothing here" versus "the clamp logic broke" — and conflating
    // them sends someone debugging the wrong half.
    expect(c.reason).toContain("no legal option");
    expect(c.reason).not.toContain("clamp failed");
  });

  test("preferChooser falls back when its preference is not legal", () => {
    expect(chooseWithinLegal(["a", "b"], "c", preferChooser("z"))).toMatchObject({ option: "a" });
  });
});


/**
 * Every gate strictly before `gate`, which is what `passed` must hold to evaluate it.
 *
 * Derived from `ORDERED_GATES` so extending the chain does not require editing each test — the
 * failure that made this helper necessary. Six gates were added and sixteen tests broke, every one
 * of them because it had written down a position in the chain rather than asked for one.
 */
function priorsOf(gate: GateKind): Set<GateKind> {
  return new Set(ORDERED_GATES.slice(0, ORDERED_GATES.indexOf(gate)));
}

// ─── The chain ──────────────────────────────────────────────────────────────

describe("the gate chain", () => {
  test("the chain runs context -> design -> adversarial -> build -> validate -> release", () => {
    // Asserted as ORDERING CONSTRAINTS rather than as a transcribed copy of the array. A copy is a
    // second place to edit, and a test that only restates the source cannot disagree with it —
    // which is the shape that lets a reordering land green.
    const at = (g: GateKind) => ORDERED_GATES.indexOf(g);
    for (const g of Object.values(GateKind)) expect(at(g)).toBeGreaterThanOrEqual(0);

    // Context is groomed before anything argues about it.
    expect(at(GateKind.BusinessContextGrooming)).toBeLessThan(at(GateKind.BrdApproval));
    // A peer sees the context before an architecture is designed against it.
    expect(at(GateKind.PeerReview)).toBeLessThan(at(GateKind.ArchitectureDesign));
    // The document is produced before it is approved.
    expect(at(GateKind.ArchitectureDesign)).toBeLessThan(at(GateKind.ArchitectureApproval));
    // The adversarial pass comes AFTER the design and BEFORE the build — its whole value is
    // breaking the plan while changing it is still cheap.
    expect(at(GateKind.ArchitectureApproval)).toBeLessThan(at(GateKind.AdversarialReview));
    expect(at(GateKind.AdversarialReview)).toBeLessThan(at(GateKind.ImplementationReview));
    // Acceptance and the automated run both precede the business sign-off.
    expect(at(GateKind.QaUat)).toBeLessThan(at(GateKind.FinalBusinessValidation));
    expect(at(GateKind.RuntimeValidation)).toBeLessThan(at(GateKind.FinalBusinessValidation));
    // The architect looks at what was BUILT, so that review follows the build and the tests.
    expect(at(GateKind.ImplementationReview)).toBeLessThan(at(GateKind.FinalArchitectureReview));
    expect(at(GateKind.RuntimeValidation)).toBeLessThan(at(GateKind.FinalArchitectureReview));
    // Release is last, always.
    expect(at(GateKind.ReleaseReadiness)).toBe(ORDERED_GATES.length - 1);
  });

  test("every gate appears exactly once — a duplicate would make the chain unreachable", () => {
    expect(new Set(ORDERED_GATES).size).toBe(ORDERED_GATES.length);
    expect(ORDERED_GATES.length).toBe(Object.values(GateKind).length);
  });

  test("the next gate is the first unpassed one", () => {
    expect(nextLegalGate(new Set())).toBe(ORDERED_GATES[0]);
    expect(nextLegalGate(new Set([ORDERED_GATES[0]!]))).toBe(ORDERED_GATES[1]);
  });

  test("passing a LATER gate does not skip an earlier one", () => {
    // The whole point of ordering: an item cannot reach release readiness without an architecture
    // review by having the gates evaluated in a convenient order.
    expect(nextLegalGate(new Set([GateKind.ReleaseReadiness]))).toBe(ORDERED_GATES[0]);
  });

  test("all seven passed means merged", () => {
    expect(allGatesPassed(new Set(ORDERED_GATES))).toBe(true);
    expect(nextLegalGate(new Set(ORDERED_GATES))).toBeUndefined();
    expect(gateProgress(new Set(ORDERED_GATES))).toBe(1);
    expect(gateProgress(new Set())).toBe(0);
  });

  test("every gate has a recovery path", () => {
    for (const g of ORDERED_GATES) expect(recoveryPathFor(g)).toBeDefined();
    expect(recoveryPathFor(GateKind.ImplementationReview)).toBe(RecoveryPath.BackToEngineering);
    expect(recoveryPathFor(GateKind.ArchitectureApproval)).toBe(RecoveryPath.ReopenArchitecture);
  });
});

describe("who owns a gate is DERIVED from the hats' approval scopes", () => {
  test("every gate has at least one owner in this seed", () => {
    // A gate nobody owns blocks the chain — that is a staffing fact, and it must not read as a pass.
    for (const g of ORDERED_GATES) expect(gateOwners(chart, g).length).toBeGreaterThan(0);
  });

  test("owners are the hats that hold the scope, and nobody else", () => {
    // The reference catalog grants `runtime_validation` to its own QA reviewer and verifier as
    // well, so the owner set grew with the seed. What the test is about is that ownership is
    // DERIVED from the scope and held by nobody else — so it asserts the membership rule rather
    // than a headcount that changes whenever the organization does.
    const owners = gateOwners(chart, GateKind.RuntimeValidation).map((h) => h.id);
    expect(owners.sort()).toEqual(["qa_director", "qa_engineer", "qa_manager", "qa_reviewer", "qa_verifier"]);
    expect(owners.every((id) => chart.byId.get(id)?.approvalScopes?.includes(GateKind.RuntimeValidation))).toBe(true);
    expect(mayEvaluate(chart, "qa_engineer", GateKind.RuntimeValidation)).toBe(true);
    // A dev is not a QA reviewer, however senior its own line.
    expect(mayEvaluate(chart, "backend_implementer", GateKind.RuntimeValidation)).toBe(false);
    expect(mayEvaluate(chart, "cto", GateKind.RuntimeValidation)).toBe(false);
  });

  test("a hat holding one scope does not thereby hold another", () => {
    expect(mayEvaluate(chart, "tech_lead", GateKind.ImplementationReview)).toBe(true);
    expect(mayEvaluate(chart, "tech_lead", GateKind.ReleaseReadiness)).toBe(false);
  });
});

describe("waiving is not one of three normal verdicts", () => {
  test("the ordinary legal set excludes it", () => {
    // Offering `waived` beside `approved` in every evaluation makes the cheapest way past a hard
    // gate a single index.
    expect(legalGateOutcomes()).not.toContain(GateOutcome.Waived);
  });

  test("a director and above may waive; a manager and below may not", () => {
    const dir = chart.byId.get("qa_director")!;
    const mgr = chart.byId.get("qa_manager")!;
    const ic = chart.byId.get("qa_engineer")!;
    expect(legalGateOutcomesFor(dir)).toContain(GateOutcome.Waived);
    expect(legalGateOutcomesFor(mgr)).not.toContain(GateOutcome.Waived);
    expect(legalGateOutcomesFor(ic)).not.toContain(GateOutcome.Waived);
  });

  test("a waiver PASSES the gate but is a different fact from approval", () => {
    expect(isPassing(GateOutcome.Waived)).toBe(true);
    expect(isPassing(GateOutcome.Approved)).toBe(true);
    expect(isPassing(GateOutcome.ChangesRequested)).toBe(false);
    expect(isPassing(GateOutcome.Rejected)).toBe(false);

    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.CustomerRfpReview,
      evaluatorHatId: "product_director",
      passed: priorsOf(GateKind.CustomerRfpReview),
      chooser: preferChooser<GateOutcome>(GateOutcome.Waived, "waive"),
      atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The record keeps `waived`, so an audit can tell a satisfied control from a skipped one.
    expect(r.evaluation.outcome).toBe(GateOutcome.Waived);
    expect(r.passed.has(GateKind.CustomerRfpReview)).toBe(true);
  });

  test("a MANAGER asking to waive gets clamped to a legal verdict instead", () => {
    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.ImplementationReview,
      evaluatorHatId: "engineering_manager",
      passed: priorsOf(GateKind.ImplementationReview),
      chooser: preferChooser<GateOutcome>(GateOutcome.Waived, "waive"),
      atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evaluation.outcome).not.toBe(GateOutcome.Waived);
  });
});

describe("evaluating one gate", () => {
  test("an approval advances the passed set", () => {
    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.CustomerRfpReview,
      evaluatorHatId: "product_manager",
      passed: priorsOf(GateKind.CustomerRfpReview),
      chooser: approve,
      atMs: 7,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evaluation.outcome).toBe(GateOutcome.Approved);
    expect(r.evaluation.byHatId).toBe("product_manager");
    expect(r.evaluation.atMs).toBe(7);
    expect(r.passed.has(GateKind.CustomerRfpReview)).toBe(true);
    expect(r.passed.size).toBe(priorsOf(GateKind.CustomerRfpReview).size + 1);
    expect(r.recovery).toBeUndefined();
  });

  test("a rejection does NOT advance, and names the recovery path", () => {
    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.CustomerRfpReview,
      evaluatorHatId: "product_manager",
      passed: priorsOf(GateKind.CustomerRfpReview),
      chooser: reject,
      atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.passed.has(GateKind.CustomerRfpReview)).toBe(false);
    expect(r.passed.size).toBe(priorsOf(GateKind.CustomerRfpReview).size);
    expect(r.recovery).toBe(RecoveryPath.ReopenDiscoveryOrBrd);
  });

  test("OUT OF ORDER is refused", () => {
    // Evaluating a gate whose priors have not passed is how an item reaches release readiness with
    // no architecture review.
    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.ReleaseReadiness,
      evaluatorHatId: "tpm",
      // EMPTY on purpose. An automated rewrite of this file once replaced this with the gate's
      // priors, which made the call in-order and left the test asserting nothing while still
      // passing — the vacuity class, introduced by a fix for an unrelated break.
      passed: new Set<GateKind>(),
      chooser: approve,
      atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("crossed in order");
  });

  test("a NON-OWNER is refused", () => {
    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.CustomerRfpReview,
      evaluatorHatId: "backend_implementer",
      passed: priorsOf(GateKind.CustomerRfpReview),
      chooser: approve,
      atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("approval scope");
  });

  test("RE-EVALUATING a passed gate is refused", () => {
    // Otherwise a rejection gets overwritten by a second opinion nobody asked for.
    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.CustomerRfpReview,
      evaluatorHatId: "product_manager",
      passed: new Set([...priorsOf(GateKind.CustomerRfpReview), GateKind.CustomerRfpReview]),
      chooser: approve,
      atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("already passed");
  });

  test("an unknown evaluator is refused", () => {
    const r = evaluateGate(chart, {
      workId: "w1",
      gate: GateKind.CustomerRfpReview,
      evaluatorHatId: "ghost",
      passed: priorsOf(GateKind.CustomerRfpReview),
      chooser: approve,
      atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("unknown hat");
  });
});

describe("the whole chain", () => {
  test("approving everything merges — one evaluation per gate, each by an authorized hat", () => {
    const run = runGateChain(chart, { workId: "w1", chooser: approve, atMs: 0, proposerHatId: NO_PROPOSER });
    expect(run.merged).toBe(true);
    expect(run.evaluations).toHaveLength(ORDERED_GATES.length);
    expect(run.refusals).toEqual([]);
    expect(run.evaluations.map((e) => e.gate)).toEqual([...ORDERED_GATES]);
    for (const e of run.evaluations) {
      expect(mayEvaluate(chart, e.byHatId, e.gate)).toBe(true);
    }
  });

  test("a rejection STOPS the chain where it happened, with a recovery path", () => {
    const rejectAtImplementation: OrgChooser<GateOutcome> = (legal, ctx) =>
      ctx.includes(GateKind.ImplementationReview)
        ? { index: legal.indexOf(GateOutcome.Rejected), reason: "not ready" }
        : { index: legal.indexOf(GateOutcome.Approved), reason: "fine" };

    const run = runGateChain(chart, { workId: "w1", chooser: rejectAtImplementation, atMs: 0, proposerHatId: NO_PROPOSER });
    expect(run.merged).toBe(false);
    expect(run.blockedAt).toBe(GateKind.ImplementationReview);
    expect(run.recovery).toBe(RecoveryPath.BackToEngineering);
    // Everything before it passed; the gate itself was evaluated and failed.
    const before = priorsOf(GateKind.ImplementationReview).size;
    expect(run.passed.size).toBe(before);
    expect(run.evaluations).toHaveLength(before + 1);
  });

  test("a gate nobody owns BLOCKS — it does not read as a pass", () => {
    // Strip the release-readiness scope from the whole organization.
    const stripped = buildOrgChart(
      SEED_HATS.map((h) =>
        h.approvalScopes === undefined
          ? h
          : { ...h, approvalScopes: h.approvalScopes.filter((s) => s !== GateKind.ReleaseReadiness) },
      ),
    );
    expect(stripped.ok).toBe(true);
    if (!stripped.ok) return;

    const run = runGateChain(stripped.chart, { workId: "w1", chooser: approve, atMs: 0, proposerHatId: NO_PROPOSER });
    expect(run.merged).toBe(false);
    expect(run.blockedAt).toBe(GateKind.ReleaseReadiness);
    expect(run.refusals[0]).toContain("no hat holds the approval scope");
    // Everything before it did pass — the chain got as far as it legitimately could.
    expect(run.passed.size).toBe(priorsOf(GateKind.ReleaseReadiness).size);
  });

  test("the evaluator can be chosen, and the choice is still authority-checked", () => {
    const run = runGateChain(chart, {
      workId: "w1",
      chooser: approve,
      atMs: 0,
      // Always take the most senior owner.
      evaluatorFor: (_gate, owners) => owners[owners.length - 1],
      proposerHatId: NO_PROPOSER,
    });
    expect(run.merged).toBe(true);
    for (const e of run.evaluations) expect(mayEvaluate(chart, e.byHatId, e.gate)).toBe(true);
  });

  test("an evaluatorFor that names an UNAUTHORIZED hat is refused, not honoured", () => {
    const run = runGateChain(chart, {
      workId: "w1",
      chooser: approve,
      atMs: 0,
      evaluatorFor: () => chart.byId.get("backend_implementer"),
      proposerHatId: NO_PROPOSER,
    });
    expect(run.merged).toBe(false);
    expect(run.refusals[0]).toContain("approval scope");
  });
});

describe("TWO OPTIONAL CHECKPOINTS — off unless an operator asks for them", () => {
  const chain = (over: Record<string, unknown> = {}) =>
    runGateChain(chart, {
      workId: "w1",
      chooser: preferChooser<GateOutcome>(GateOutcome.Approved, "approve"),
      atMs: 0,
      proposerHatId: NO_PROPOSER,
      ...over,
    });

  test("with NO checkpoints the whole chain runs agentically — the default is unchanged", () => {
    // Every existing caller depends on this. A checkpoint that switched itself on would be a change
    // of kind, not of configuration.
    const run = chain();
    expect(run.awaitingHuman).toBeUndefined();
    expect(run.merged).toBe(true);
  });

  test("grooming stops at brd_approval and WAITS — it does not fail", () => {
    const run = chain({ humanRequiredAt: humanGatesFor([HumanCheckpoint.Grooming]) });
    expect(run.awaitingHuman).toBe(GateKind.BrdApproval);
    expect(run.merged).toBe(false);
    // Waiting is not rejection: nobody looked, so there is nothing to recover FROM.
    expect(run.blockedAt).toBeUndefined();
    expect(run.recovery).toBeUndefined();
    // And no evaluation was recorded for the gate nobody answered.
    expect(run.evaluations.some((e) => e.gate === GateKind.BrdApproval)).toBe(false);
  });

  test("the approach checkpoint stops later, at architecture_approval", () => {
    const run = chain({ humanRequiredAt: humanGatesFor([HumanCheckpoint.Approach]) });
    expect(run.awaitingHuman).toBe(GateKind.ArchitectureApproval);
    // Everything before it still ran, so the person is deciding with the grooming already done.
    expect(run.passed.has(GateKind.BrdApproval)).toBe(true);
  });

  test("BOTH checkpoints stop at the FIRST one, not both at once", () => {
    const run = chain({ humanRequiredAt: humanGatesFor([HumanCheckpoint.Grooming, HumanCheckpoint.Approach]) });
    expect(run.awaitingHuman).toBe(GateKind.BrdApproval);
  });

  test("a person's APPROVAL lets the chain continue, and the evidence names the action", () => {
    const run = chain({
      humanRequiredAt: humanGatesFor([HumanCheckpoint.Grooming]),
      humanDecisionFor: (gate: GateKind) =>
        gate === GateKind.BrdApproval
          ? { outcome: GateOutcome.Approved, actionRef: "human-action/ha-1" }
          : undefined,
    });
    expect(run.awaitingHuman).toBeUndefined();
    expect(run.merged).toBe(true);
    const brd = run.evaluations.find((e) => e.gate === GateKind.BrdApproval);
    // An approval with no traceable origin is what the audit requirement exists to prevent.
    expect(brd?.evidenceRefs).toContain("human-action/ha-1");
  });

  test("a person's REJECTION stops the work and takes the recovery path", () => {
    const run = chain({
      humanRequiredAt: humanGatesFor([HumanCheckpoint.Grooming]),
      humanDecisionFor: () => ({ outcome: GateOutcome.Rejected, actionRef: "human-action/ha-2" }),
    });
    expect(run.awaitingHuman).toBeUndefined();
    expect(run.blockedAt).toBe(GateKind.BrdApproval);
    expect(run.merged).toBe(false);
  });

  test("a decision for a gate that is NOT a checkpoint is ignored", () => {
    // Otherwise a stray action could decide a gate the operator never handed to a person.
    const run = chain({
      humanRequiredAt: new Set<GateKind>(),
      humanDecisionFor: () => ({ outcome: GateOutcome.Rejected, actionRef: "human-action/ha-3" }),
    });
    expect(run.merged).toBe(true);
  });

  test("the checkpoints map to the two moments where a NO is still cheap", () => {
    expect(CHECKPOINT_GATE.grooming).toBe(GateKind.BrdApproval);
    expect(CHECKPOINT_GATE.approach).toBe(GateKind.ArchitectureApproval);
    // Both sit before implementation_review, so nothing has been built when a person is asked.
    const impl = ORDERED_GATES.indexOf(GateKind.ImplementationReview);
    expect(ORDERED_GATES.indexOf(CHECKPOINT_GATE.grooming)).toBeLessThan(impl);
    expect(ORDERED_GATES.indexOf(CHECKPOINT_GATE.approach)).toBeLessThan(impl);
  });
});
