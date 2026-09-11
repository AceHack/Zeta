/**
 * org-policy-gate.test.ts — the org's rules actually reach the gate.
 *
 * `org-policy.test.ts` proves the rules are well-formed and check correctly. This proves they are
 * CONSULTED — the reader-with-no-writer gap. A policy module nothing calls is configuration that
 * looks like governance, so the tests here are about `evaluateGate`'s behaviour changing when a
 * policy is supplied, and about the two places it deliberately does not change.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { RuleKind, VerificationApproach, type OrgPolicy } from "./org-policy";
import { SEED_HATS } from "./org-seed";
import { evaluateGate, GateKind, GateOutcome, isPassing } from "./quality-gate";
import { preferChooser } from "./org-decision";

function chartOf(): OrgChart {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  return built.chart;
}
const CHART = chartOf();
const AT = 1_700_000_000_000;

/** The first gate in the canonical chain, so `nextLegalGate` is satisfied with an empty passed set. */
const GATE = GateKind.BusinessContextGrooming;

function ownerOf(gate: GateKind): string {
  const hats = SEED_HATS.filter((h) => (h.approvalScopes ?? []).includes(gate));
  const first = hats[0];
  if (first === undefined) throw new Error(`no owner for ${gate}`);
  return first.id;
}

const EVALUATOR = ownerOf(GATE);

const DEMANDS_REPORT: OrgPolicy = {
  orgId: "new-venture",
  verification: VerificationApproach.AuthoredScripts,
  gates: [
    {
      gate: GATE,
      rules: [
        {
          id: "spec-attached",
          kind: RuleKind.EvidenceMatching,
          needle: "playwright-report",
          because: "this org verifies with repeatable scripts",
        },
      ],
    },
  ],
};

function run(over: Partial<Parameters<typeof evaluateGate>[1]> = {}) {
  return evaluateGate(CHART, {
    workId: "T-1",
    gate: GATE,
    evaluatorHatId: EVALUATOR,
    passed: new Set<GateKind>(),
    chooser: preferChooser<GateOutcome>(GateOutcome.Approved),
    atMs: AT,
    proposerHatId: "backend_implementer",
    evidenceRefs: ["notes.md"],
    ...over,
  });
}

describe("an org's rules are CONSULTED, not merely configured", () => {
  test("without a policy the gate approves as it always did", () => {
    const r = run();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.Approved);
    expect(r.passed.has(GATE)).toBe(true);
  });

  test("AN APPROVAL THAT MISSES THE ORG'S RULE IS HELD, not passed", () => {
    // The reader-with-no-writer falsifier. If nothing consulted the policy this would approve.
    const r = run({ policy: { policy: DEMANDS_REPORT } });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.ChangesRequested);
    expect(isPassing(r.evaluation.outcome)).toBe(false);
    expect(r.passed.has(GATE)).toBe(false);
  });

  test("the record names the org and the rule that held it", () => {
    const r = run({ policy: { policy: DEMANDS_REPORT } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.reason).toContain("new-venture");
    expect(r.evaluation.reason).toContain("spec-attached");
    expect(r.evaluation.reason).toContain("playwright-report");
  });

  test("satisfying the rule lets the same approval through", () => {
    const r = run({
      evidenceRefs: ["ci/playwright-report/index.html"],
      policy: { policy: DEMANDS_REPORT },
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.Approved);
    expect(r.passed.has(GATE)).toBe(true);
  });

  test("a policy that says nothing about THIS gate does not interfere", () => {
    const elsewhere: OrgPolicy = {
      ...DEMANDS_REPORT,
      gates: [{ ...(DEMANDS_REPORT.gates ?? [])[0]!, gate: GateKind.ReleaseReadiness }],
    };
    const r = run({ policy: { policy: elsewhere } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.Approved);
  });
});

describe("a held gate feeds the rework loop rather than vanishing", () => {
  test("the evaluation is still RECORDED — the attempt happened", () => {
    // Refusing outright would leave no evidence anybody tried, and `gate-demand` counts attempts
    // off the record to know a step is rework.
    const r = run({ policy: { policy: DEMANDS_REPORT } });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.workId).toBe("T-1");
    expect(r.evaluation.gate).toBe(GATE);
    expect(r.evaluation.byHatId).toBe(EVALUATOR);
  });

  test("a recovery path is supplied, exactly as for any non-passing outcome", () => {
    const r = run({ policy: { policy: DEMANDS_REPORT } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.recovery).toBeDefined();
  });
});

describe("policy gates approvals only — never rejections", () => {
  test("A REJECTION IS RECORDED UNCHANGED even with every rule unmet", () => {
    // Backwards otherwise: the failing case is the one where checks are missing, and that is
    // precisely what a rejection reports.
    const r = run({
      chooser: preferChooser<GateOutcome>(GateOutcome.Rejected),
      policy: { policy: DEMANDS_REPORT },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.Rejected);
    expect(r.evaluation.reason).not.toContain("policy");
  });

  test("a waiver is a passing outcome and IS policy-checked", () => {
    // A waiver says the gate does not apply; the org's rules are about what evidence a PASS needs,
    // and a waiver passes. Letting it through unchecked would be the obvious way around a policy.
    const r = run({
      chooser: preferChooser<GateOutcome>(GateOutcome.Waived),
      policy: { policy: DEMANDS_REPORT },
    });
    if (!r.ok) throw new Error(r.reason);
    // Waived IS legal for this hat and IS a passing outcome, so an unmet policy must hold it.
    expect(r.evaluation.outcome).toBe(GateOutcome.ChangesRequested);
    expect(r.passed.has(GATE)).toBe(false);
  });
});

describe("MinApprovers counts across evaluations, so the caller supplies the priors", () => {
  const TWO_EYES: OrgPolicy = {
    orgId: "strict-co",
    verification: VerificationApproach.ExistingHarness,
    gates: [
      {
        gate: GATE,
        rules: [
          { id: "two-eyes", kind: RuleKind.MinApprovers, atLeast: 2, because: "two sets of eyes" },
        ],
      },
    ],
  };

  test("a lone approval is held when the org wants two", () => {
    const r = run({ policy: { policy: TWO_EYES } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.ChangesRequested);
    expect(r.evaluation.reason).toContain("two-eyes");
  });

  test("a prior approver plus this one satisfies it", () => {
    const r = run({ policy: { policy: TWO_EYES, priorApproverHatIds: ["qa_manager"] } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.Approved);
  });

  test("THE SAME HAT TWICE IS STILL ONE APPROVER", () => {
    const r = run({ policy: { policy: TWO_EYES, priorApproverHatIds: [EVALUATOR] } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.ChangesRequested);
  });
});

describe("artifact rules read produced artifacts", () => {
  const WANTS_BDD: OrgPolicy = {
    orgId: "bdd-co",
    verification: VerificationApproach.BehaviourSpecs,
    gates: [
      {
        gate: GATE,
        rules: [{ id: "feature-file", kind: RuleKind.ArtifactPresent, needle: ".feature", because: "BDD" }],
      },
    ],
  };

  test("no feature file holds the gate", () => {
    const r = run({ policy: { policy: WANTS_BDD, artifactPaths: ["design.md"] } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.ChangesRequested);
  });

  test("a feature file satisfies it", () => {
    const r = run({ policy: { policy: WANTS_BDD, artifactPaths: ["specs/login.feature"] } });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.Approved);
  });

  test("evidence is not artifacts — a ref does not satisfy an artifact rule", () => {
    const r = run({
      evidenceRefs: ["someone/mentioned/a.feature"],
      policy: { policy: WANTS_BDD, artifactPaths: [] },
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.evaluation.outcome).toBe(GateOutcome.ChangesRequested);
  });
});
