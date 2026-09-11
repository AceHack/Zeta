/**
 * org-runtime-review.test.ts — the gates are DECIDED now, not assumed.
 *
 * Measured before this port existed, over one run: 14 gate verdicts, 12 of them
 * `approved (reviewed)` — a constant — and 2 `runtime_validation approved (1/1 passed)`. Six of the
 * seven gate kinds could not fail, and `fidelityOf` reported four ports while saying nothing about
 * it. A gate that cannot fail is the vacuity class standing exactly where the organization makes
 * its quality claim.
 *
 * These tests are the falsifiers for the fix: a reviewer that rejects must STOP delivery, a
 * reviewer that cannot answer must not approve, and runtime validation must stay evidence-driven
 * rather than becoming one more opinion.
 */

import { describe, expect, test } from "bun:test";
import { agentsFromChart, gateChooserFrom, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { GateKind, GateOutcome , ORDERED_GATES} from "./quality-gate";
import { RunOutcome } from "./qa";
import { agentReview, autoApproveReview, simulatedChangeControl, simulatedIntake, simulatedTestRunner, simulatedWorkExecutor } from "./adapters";
import { Fidelity, Port, type ProviderSet, type ReviewPort, type ReviewVerdict } from "./providers";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const GOOD: ExternalEvent = {
  source: "portal",
  externalId: "T-1",
  kind: IntakeKind.Defect,
  severity: Severity.High,
  title: "checkout double-charges",
  reproduction: "twice",
  evidenceRefs: ["log/1"],
};

const providersWith = (review: ReviewPort): ProviderSet => ({
  intake: simulatedIntake([GOOD]),
  work: simulatedWorkExecutor(true),
  tests: simulatedTestRunner(new Map(), RunOutcome.Passed),
  review,
  change: simulatedChangeControl(),
});

function deps(over: Partial<OrgRuntimeDeps> = {}): OrgRuntimeDeps {
  let n = 0;
  return {
    chart,
    externalEvents: [GOOD],
    agents: agentsFromChart(chart),
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p) => `${p}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    priorityInputsFor: () => ({
      executivePriority: 0.5, customerImpact: 1, severity: 1, releaseRisk: 0.2,
      blockedDownstreamCount: 2, dependencyFanOut: 1, queueAgeMs: 0, hatScarcity: 0,
      budgetBurn: 0, estimatedEffort: 0.2,
    }),
    ...over,
  };
}

describe("A REJECTING REVIEWER STOPS DELIVERY", () => {
  test("rejecting ONE gate blocks the whole item — nothing merges past it", async () => {
    // Before the port, no reviewer could have said this: the chooser returned `Approved` for every
    // gate but runtime validation, so the architecture gate had no way to fail no matter what was
    // wrong with the design.
    const approved = await runOrgRuntime(deps({ providers: providersWith(autoApproveReview()) }));
    expect(approved.delivered).toBe(true);

    const blocked = await runOrgRuntime(
      deps({
        providers: providersWith(
          agentReview((request) =>
            request.gate === GateKind.ArchitectureApproval
              ? { outcome: GateOutcome.Rejected, reason: "payment is coupled to the coupon path" }
              : { outcome: GateOutcome.Approved, reason: "read it, fine" },
          ),
        ),
      }),
    );
    expect(blocked.delivered).toBe(false);
    // The record says which gate and why — not merely that something went wrong.
    const turned = blocked.gateEvaluations.filter((g) => g.outcome === GateOutcome.Rejected);
    expect(turned.length).toBeGreaterThan(0);
    expect(turned[0]?.gate).toBe(GateKind.ArchitectureApproval);
    expect(turned[0]?.reason).toContain("coupon path");
    // ...and no change landed, so the repository and the record agree about it.
    expect(blocked.changesLanded).toEqual([]);
  });

  test("the reviewer's REASON reaches the gate record, never a bare outcome", async () => {
    const report = await runOrgRuntime(
      deps({
        providers: providersWith(
          agentReview(() => ({ outcome: GateOutcome.Approved, reason: "reviewed by the on-call architect" })),
        ),
      }),
    );
    const reviewed = report.gateEvaluations.filter((g) => g.gate !== GateKind.RuntimeValidation);
    expect(reviewed.length).toBeGreaterThan(0);
    for (const g of reviewed) expect(g.reason).toContain("on-call architect");
  });
});

describe("A REVIEW THAT COULD NOT BE OBTAINED IS NOT AN APPROVAL", () => {
  test("a refusing reviewer BLOCKS, and the refusal names the gate", async () => {
    // Failing closed is the only safe direction. "Nobody was available to review this" and "this
    // was reviewed and approved" are the two sentences an organization must never confuse — and a
    // reviewer that is down would otherwise become the fastest path to shipping.
    const report = await runOrgRuntime(
      deps({
        providers: providersWith({
          meta: { port: Port.Review, name: "offline", fidelity: "real", describes: "always unavailable" },
          review: async () => ({ ok: false, reason: "the review service is unreachable" }),
        }),
      }),
    );
    expect(report.delivered).toBe(false);
    expect(report.refusals.some((r) => r.includes("unreachable"))).toBe(true);
    // The FIRST gate, derived. Reviews are now asked at their own phase, so a run stops at the
    // first reviewer that cannot be reached rather than pre-collecting refusals for phases it
    // never gets to — asking about an architecture the run will never reach is work nobody needs.
    expect(report.refusals.some((r) => r.includes(ORDERED_GATES[0]!))).toBe(true);
    // The gate record shows it was turned back rather than silently skipped.
    expect(report.gateEvaluations.some((g) => g.outcome === GateOutcome.Rejected && g.reason.includes("not reviewed"))).toBe(true);
  });
});

describe("RUNTIME VALIDATION STAYS EVIDENCE-DRIVEN", () => {
  test("a reviewer approving everything cannot overturn failing tests", async () => {
    // The one gate that was already earned must not be demoted to an opinion by this change. Green
    // tests are green tests; letting a reviewer outrank them would put the sole honest verdict back
    // on the same footing as the six that were not.
    const report = await runOrgRuntime(
      deps({
        qaFallback: RunOutcome.Failed,
        providers: {
          ...providersWith(agentReview(() => ({ outcome: GateOutcome.Approved, reason: "approve everything" }))),
          tests: simulatedTestRunner(new Map(), RunOutcome.Failed),
        },
      }),
    );
    expect(report.delivered).toBe(false);
    const runtime = report.gateEvaluations.filter((g) => g.gate === GateKind.RuntimeValidation);
    expect(runtime.length).toBeGreaterThan(0);
    for (const g of runtime) {
      expect(g.outcome).not.toBe(GateOutcome.Approved);
      // Its reason comes from QA, not from the reviewer that approved everything.
      expect(g.reason).not.toContain("approve everything");
    }
  });

  test("the review port is never consulted about runtime validation", async () => {
    const asked: GateKind[] = [];
    await runOrgRuntime(
      deps({
        providers: providersWith(
          agentReview((request) => {
            asked.push(request.gate);
            return { outcome: GateOutcome.Approved, reason: "fine" };
          }),
        ),
      }),
    );
    expect(asked.length).toBeGreaterThan(0);
    expect(asked).not.toContain(GateKind.RuntimeValidation);
    // ...and it IS asked about the others, or this test would pass by asking nothing at all.
    expect(asked).toContain(GateKind.ArchitectureApproval);
  });

  test("THE REVIEWER IS TOLD WHICH WORK ITEM — verdicts are keyed by it", async () => {
    // `directoryReview` looks a verdict up at `<dir>/<workId>/<gate>.json`, so a wrong or constant
    // id would make every lookup miss — or, worse, apply one item's approval to another's work.
    const asked: { gate: GateKind; workId: string }[] = [];
    const report = await runOrgRuntime(
      deps({
        providers: providersWith(
          agentReview((request) => {
            asked.push({ gate: request.gate, workId: request.workId });
            return { outcome: GateOutcome.Approved, reason: "fine" };
          }),
        ),
      }),
    );
    const leaves = report.cascade.nodes.filter((n) => n.assigneeHatId !== undefined).map((n) => n.workId);
    expect(leaves.length).toBeGreaterThan(0);
    const seen = new Set(asked.map((a) => a.workId));
    // EVERY LEAF IS STILL ASKED ABOUT — that is the property under test, and it holds.
    for (const id of leaves) expect(seen.has(id)).toBe(true);
    // AND SO ARE THE RUNGS ABOVE, which is new and deliberate: a director's initiative and a
    // manager's project now cross their own gates, so a reviewer is asked about them too. The old
    // assertion was set equality against leaves alone, which would fail the moment the hierarchy
    // started governing rather than decorating.
    const governed = report.cascade.nodes
      .filter((n) => n.assigneeHatId === undefined && n.state !== "canceled")
      .map((n) => n.workId);
    expect(governed.some((id) => seen.has(id))).toBe(true);
    // Nothing OUTSIDE the cascade is ever asked about.
    const known = new Set(report.cascade.nodes.map((n) => n.workId));
    for (const id of seen) expect(known.has(id)).toBe(true);
  });

  test("the reviewer is handed the QA EVIDENCE, so it can judge from more than a title", async () => {
    const evidence: string[] = [];
    await runOrgRuntime(
      deps({
        providers: providersWith(
          agentReview((request) => {
            evidence.push(...request.evidence.map((e) => e.ref));
            return { outcome: GateOutcome.Approved, reason: "fine" };
          }),
        ),
      }),
    );
    expect(evidence.length).toBeGreaterThan(0);
  });
});

describe("the run says who reviewed it", () => {
  test("an auto-approving run reports the review port as simulated, and admits it reads nothing", async () => {
    const report = await runOrgRuntime(deps({ providers: providersWith(autoApproveReview()) }));
    const review = report.fidelity.ports.find((p) => p.port === Port.Review);
    expect(review).toBeDefined();
    expect(review?.fidelity).toBe("simulated");
    expect(review?.describes).toContain("consults nobody");
    expect(report.fidelity.replayable).toBe(true);
  });

  test("THE DEFAULT SET IS PINNED — a run given no providers reports these five by name", async () => {
    // Otherwise the default composition can drift silently: the run would still print five rows and
    // nobody would notice which adapter had been swapped underneath.
    const report = await runOrgRuntime(deps());
    expect(report.fidelity.ports.map((p) => `${p.port}:${p.name}`)).toEqual([
      "intake:fixture",
      "work_execution:assumed",
      "test_execution:planned",
      "review:auto-approve",
      "change_control:in-memory",
    ]);
    expect(report.fidelity.replayable).toBe(true);
  });

  test("A REAL REVIEWER MAKES THE RUN UNREPLAYABLE, and the review port is named", async () => {
    const report = await runOrgRuntime(
      deps({ providers: providersWith(agentReview(() => ({ outcome: GateOutcome.Approved, reason: "fine" }))) }),
    );
    expect(report.fidelity.replayable).toBe(false);
    expect(report.fidelity.realPorts).toEqual([Port.Review]);
  });
});

describe("gateChooserFrom — every branch, including the one the runtime cannot reach", () => {
  const QA = { outcome: GateOutcome.Approved, reason: "1/1 passed" };
  const ctxFor = (gate: GateKind) => `gate ${gate} for task-1`;
  const LEGAL = [GateOutcome.Approved, GateOutcome.ChangesRequested, GateOutcome.Rejected];

  test("runtime validation takes QA's answer and its reason", () => {
    const choose = gateChooserFrom(new Map(), { outcome: GateOutcome.Rejected, reason: "0/3 passed" });
    const picked = choose(LEGAL, ctxFor(GateKind.RuntimeValidation));
    expect(LEGAL[picked.index]).toBe(GateOutcome.Rejected);
    expect(picked.reason).toBe("0/3 passed");
  });

  test("every other gate takes the REVIEWER's answer", () => {
    const reviewed = new Map<GateKind, ReviewVerdict>([
      [GateKind.ArchitectureApproval, { outcome: GateOutcome.ChangesRequested, reason: "coupled" }],
    ]);
    const picked = gateChooserFrom(reviewed, QA)(LEGAL, ctxFor(GateKind.ArchitectureApproval));
    expect(LEGAL[picked.index]).toBe(GateOutcome.ChangesRequested);
    expect(picked.reason).toBe("coupled");
  });

  test("A GATE NOBODY REVIEWED IS REJECTED — the back door into the rubber stamp", () => {
    // Unreachable from the runtime today, which is exactly why it is tested here: the runtime fills
    // a verdict for every non-runtime gate, so inline this branch could never fire and could never
    // be checked. A hole in the map is what a future caller would hand it.
    const picked = gateChooserFrom(new Map(), QA)(LEGAL, ctxFor(GateKind.BrdApproval));
    expect(LEGAL[picked.index]).toBe(GateOutcome.Rejected);
    expect(picked.reason).toContain("no reviewer answered");
  });

  test("a context naming NO gate is rejected too", () => {
    const picked = gateChooserFrom(new Map(), QA)(LEGAL, "something else entirely");
    expect(LEGAL[picked.index]).toBe(GateOutcome.Rejected);
  });

  test("AN OUTCOME THIS HAT MAY NOT GIVE IS CLAMPED TO REJECTED, never upgraded to one that fits", () => {
    // The reviewer asked for `Waived`, which this hat does not hold. Silently substituting the
    // nearest legal outcome would let a reviewer's unauthorised waiver read as an approval.
    const reviewed = new Map<GateKind, ReviewVerdict>([
      [GateKind.ReleaseReadiness, { outcome: GateOutcome.Waived, reason: "not applicable" }],
    ]);
    const picked = gateChooserFrom(reviewed, QA)(LEGAL, ctxFor(GateKind.ReleaseReadiness));
    expect(LEGAL[picked.index]).toBe(GateOutcome.Rejected);
    expect(picked.reason).toContain("not open to this hat");
    expect(picked.reason).toContain("not applicable");
  });
});

describe("A REFUSED MERGE CONTRADICTS THE CLAIM, rather than being logged beside it", () => {
  /** Change control that opens fine and then refuses to land anything. */
  const refusingChange = (): ProviderSet["change"] => ({
    meta: {
      port: Port.ChangeControl,
      name: "refuses-to-merge",
      fidelity: Fidelity.Real,
      describes: "opens changes and refuses every merge",
    },
    open: async (node, ctx) => ({
      ok: true,
      value: { changeId: `c-${node.workId}`, branch: ctx.branch },
      evidence: [],
    }),
    merge: async () => ({ ok: false, reason: "the branch has no commits" }),
  });

  test("the goal is NOT DELIVERED when a change projected as merged did not merge", async () => {
    // The runtime's own comment beside this call has always said a refusal CONTRADICTS the claim.
    // Until 2026-09-04 it did not: `delivered` was the cascade's state alone, so the refusal went
    // into a list nothing read and the run still reported `goal DELIVERED`.
    //
    // Measured on the first real end-to-end agent run — both merges refused, `delivered: true`,
    // and `deliveryRate.deliveredForReal` counted the run as shipped.
    const report = await runOrgRuntime(
      deps({ providers: { ...providersWith(autoApproveReview()), change: refusingChange() } }),
    );
    expect(report.delivered).toBe(false);
    expect(report.refusals.some((r) => r.includes("could not merge"))).toBe(true);
  });

  test("...and the SAME organization with a change control that lands delivers", async () => {
    // Without this the assertion above could be satisfied by an organization that never delivers,
    // which would be the opposite defect and just as invisible.
    const report = await runOrgRuntime(deps({ providers: providersWith(autoApproveReview()) }));
    expect(report.delivered).toBe(true);
  });

  test("the fidelity report still names change control REAL — refusing is doing something", async () => {
    // A port that reached a repository and was told no is not a simulated port. Conflating them
    // would make `realPorts` mean "succeeded" instead of "touched", which is a different claim.
    const report = await runOrgRuntime(
      deps({ providers: { ...providersWith(autoApproveReview()), change: refusingChange() } }),
    );
    expect(report.fidelity.replayable).toBe(false);
    expect(report.fidelity.realPorts).toContain(Port.ChangeControl);
  });
});
