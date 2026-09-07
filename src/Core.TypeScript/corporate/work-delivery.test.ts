/**
 * work-delivery.test.ts — the agent's choice has to CAUSE the delivery.
 *
 * The defect this file guards is not "the pipeline is broken". The pipeline works. It is that the
 * agent loop and the pipeline met at the surface and not at the return: `PickWork` advanced the
 * state machine and nothing ran, and the dispatcher reported an outcome it had not caused.
 *
 * So the load-bearing tests here are about CAUSATION — did choosing this item actually open a
 * change, walk the phases and merge — and about the four distinct ways a delivery can fail to
 * become a success, none of which may be rounded into the others.
 */

import { describe, expect, test } from "bun:test";
import { deliverWorkItem } from "./work-delivery";
import { DEFAULT_PIPELINE, withProducers, type ProducerPort } from "./pipeline";
import { GateKind, GateOutcome } from "./quality-gate";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { Fidelity, Port, type ChangeControlPort, type ProviderSet, type ReviewPort } from "./providers";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import {
  autoApproveReview,
  simulatedChangeControl,
  simulatedIntake,
  simulatedTestRunner,
  simulatedWorkExecutor,
} from "./adapters";
import { RunOutcome } from "./qa";
import { AgentLoopMode, dispatcherFor, evaluatePromotionGate, type PromotionWindow } from "./slot-dispatch";
import type { MenuOption } from "../workflow-engine/agent-loop/state-machine";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const node: CascadeNode = {
  workId: "task-1",
  workType: WorkType.Task,
  title: "stop the double-apply",
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  assigneeHatId: "backend_implementer",
};

const PASSED = { outcome: GateOutcome.Approved, reason: "3 test run(s) passed" } as const;

function providers(over: Partial<ProviderSet> = {}): ProviderSet {
  return {
    intake: simulatedIntake([]),
    work: simulatedWorkExecutor(true),
    tests: simulatedTestRunner(new Map(), RunOutcome.Passed),
    review: autoApproveReview(),
    change: simulatedChangeControl(),
    ...over,
  };
}

/** A producer for every phase, so the pipeline can actually complete. */
const producer = (gate: GateKind): ProducerPort => ({
  meta: { port: Port.WorkExecution, name: `producer:${gate}`, fidelity: Fidelity.Simulated, describes: "test" },
  produce: async () => ({ ok: true, value: { refs: [`ref:${gate}`], summary: `made ${gate}` }, evidence: [] }),
});

const FULL = withProducers(
  DEFAULT_PIPELINE,
  new Map(DEFAULT_PIPELINE.map((p) => [p.gate, producer(p.gate)])),
);

const base = {
  chart,
  node,
  pipeline: FULL,
  atMs: 1_000,
  proposerHatId: "backend_implementer",
  qaVerdict: PASSED,
};

describe("a delivery MERGES, and that is what success means", () => {
  test("the change is opened, the phases walked, and the branch merged", async () => {
    const merged: string[] = [];
    const change: ChangeControlPort = {
      ...simulatedChangeControl(),
      merge: async (h) => {
        merged.push(h.branch);
        return { ok: true, value: h, evidence: [] };
      },
    };
    const out = await deliverWorkItem({ ...base, providers: providers({ change }) });

    expect(out.complete).toBe(true);
    expect(out.landed).toBe(true);
    expect(out.doraContribution).toBe(1);
    // CAUSATION, not correlation: this exact branch was merged by this delivery.
    expect(merged).toEqual(["work/task-1"]);
    expect(out.evidenceRefs).toContain("merge:work/task-1");
  });

  test("the evidence is what the PHASES produced, not a label", async () => {
    const out = await deliverWorkItem({ ...base, providers: providers() });
    expect(out.evidenceRefs).toContain(`ref:${GateKind.ImplementationReview}`);
    expect(out.evidenceRefs).toContain(`ref:${GateKind.ArchitectureDesign}`);
  });
});

describe("FOUR WAYS TO FAIL, and none of them is another", () => {
  test("the change would not open — NOTHING WAS ATTEMPTED", async () => {
    const change: ChangeControlPort = {
      ...simulatedChangeControl(),
      open: async () => ({ ok: false, reason: "the remote refused" }),
    };
    const out = await deliverWorkItem({ ...base, providers: providers({ change }) });

    expect(out.complete).toBe(false);
    expect(out.landed).toBe(false);
    expect(out.evaluations).toEqual([]);
    // Told apart from a failed delivery IN THE TEXT: an agent told "your work failed" when no
    // branch could be made would go looking for a defect in the work.
    expect(out.summary).toContain("nothing was attempted");
  });

  test("A BLOCKED PIPELINE SCORES ZERO — no partial credit for getting part way", async () => {
    // Survived the first mutation pass: nothing asserted the contribution on a blocked delivery, so
    // a mutant paying a full 1 for a pipeline that never merged went unnoticed.
    const out = await deliverWorkItem({
      ...base,
      providers: providers(),
      qaVerdict: { outcome: GateOutcome.Rejected, reason: "tests failed" },
    });
    expect(out.complete).toBe(false);
    expect(out.doraContribution).toBe(0);
  });

  test("a producer refused — the pipeline STOPPED, and the phase is named", async () => {
    const broken: ProducerPort = {
      meta: { port: Port.WorkExecution, name: "broken", fidelity: Fidelity.Simulated, describes: "refuses" },
      produce: async () => ({ ok: false, reason: "the executor died" }),
    };
    const pipeline = withProducers(FULL, new Map([[GateKind.ImplementationReview, broken]]));
    const out = await deliverWorkItem({ ...base, pipeline, providers: providers() });

    expect(out.complete).toBe(false);
    expect(out.landed).toBe(false);
    expect(out.blockedAt).toBe(GateKind.ImplementationReview);
    expect(out.refusals.some((r) => r.includes("the executor died"))).toBe(true);
  });

  test("THE GATES PASSED AND THE MERGE REFUSED — complete AND not landed, both reported", async () => {
    // The disagreement change control exists to catch. Collapsing these into one boolean destroys
    // it, and scoring it as delivered would launder it into a metric.
    const change: ChangeControlPort = {
      ...simulatedChangeControl(),
      merge: async () => ({ ok: false, reason: "the branch is behind" }),
    };
    const out = await deliverWorkItem({ ...base, providers: providers({ change }) });

    expect(out.complete).toBe(true);
    expect(out.landed).toBe(false);
    expect(out.doraContribution).toBe(0);
    expect(out.summary).toContain("did NOT merge");
  });

  test("A REVIEW THAT COULD NOT BE OBTAINED IS NOT AN APPROVAL", async () => {
    const review: ReviewPort = {
      ...autoApproveReview(),
      review: async () => ({ ok: false, reason: "nobody was available" }),
    };
    const out = await deliverWorkItem({ ...base, providers: providers({ review }) });

    expect(out.landed).toBe(false);
    expect(out.refusals.some((r) => r.includes("nobody was available"))).toBe(true);
  });
});

describe("the reviewer is shown the WHOLE TRAIL, not just its own phase", () => {
  test("a late gate's reviewer sees what every earlier phase produced", async () => {
    // Survived the first mutation pass: dropping the trail changed nothing any assertion looked at.
    // A final architecture review judging only whatever the last step emitted is nearly as blind as
    // one judging from a title.
    const shown = new Map<string, readonly string[]>();
    const review: ReviewPort = {
      ...autoApproveReview(),
      review: async (req) => {
        shown.set(req.gate, req.evidence.map((e) => e.ref));
        return autoApproveReview().review(req);
      },
    };
    await deliverWorkItem({ ...base, providers: providers({ review }) });

    const late = shown.get(GateKind.FinalArchitectureReview) ?? [];
    // Its own phase...
    expect(late).toContain(`ref:${GateKind.FinalArchitectureReview}`);
    // ...and the design and the implementation from much earlier in the pipeline.
    expect(late).toContain(`ref:${GateKind.ArchitectureDesign}`);
    expect(late).toContain(`ref:${GateKind.ImplementationReview}`);
  });

  test("the FIRST gate's reviewer has only its own phase, which is not a bug", () => {
    // Stated so the test above cannot be read as "more is always better": there is nothing behind
    // the first phase, and showing it something would mean inventing it.
    expect(DEFAULT_PIPELINE[0]?.gate).toBe(GateKind.BusinessContextGrooming);
  });
});

describe("runtime_validation is decided by the EVIDENCE", () => {
  test("no test runs blocks the delivery rather than passing it", async () => {
    // The caller states what the tests said, and "none ran" is a rejection. Treating an absent
    // test result as a pass is a check that cannot fail because it never looked.
    const out = await deliverWorkItem({
      ...base,
      providers: providers(),
      qaVerdict: { outcome: GateOutcome.Rejected, reason: "no test runs were recorded" },
    });
    expect(out.landed).toBe(false);
    expect(out.blockedAt).toBe(GateKind.RuntimeValidation);
  });

  test("...and a passing verdict lets it through", async () => {
    const out = await deliverWorkItem({ ...base, providers: providers() });
    expect(out.landed).toBe(true);
  });
});

describe("evidence survives a phase whose gate could not be judged", () => {
  test("AN ARTIFACT WITH NO EVALUATION STILL REPORTS ITS EVIDENCE", async () => {
    // The narrow path the outcome's artifact spread exists for, and the third mutant to survive the
    // first pass. A producer's artifact is stored BEFORE an evaluator is chosen, so when the only
    // hat holding the scope is the one that did the work, the pipeline returns with an artifact
    // that has no gate evaluation. Reading evidence off the evaluations alone would silently lose
    // what that phase actually produced.
    //
    // Reaching it needs a chart where the proposer is the sole owner, which the full seed never is
    // — so `product_manager` is dropped, leaving `product_director` alone on the first gate.
    const solo = buildOrgChart(SEED_HATS.filter((h) => h.id !== "product_manager"));
    if (!solo.ok) throw new Error(solo.reason);

    const out = await deliverWorkItem({
      ...base,
      chart: solo.chart,
      // The proposer IS the only owner of the first gate, so no eligible evaluator remains.
      proposerHatId: "product_director",
      providers: providers(),
    });

    expect(out.complete).toBe(false);
    expect(out.evaluations).toEqual([]);
    expect(out.refusals.some((r) => r.includes("did the work"))).toBe(true);
    // The produced artifact's reference survives anyway — the property the spread guards.
    expect(out.evidenceRefs).toContain(`ref:${GateKind.BusinessContextGrooming}`);
  });
});

describe("THE JOIN: a chosen slot causes the delivery", () => {
  const pickWork = {
    tag: "PickWork",
    work: { id: "task-1", lane: "operational", title: "t", priority: 1 },
  } as unknown as MenuOption;

  /** A window that earned primary, so the dispatcher is the real one. */
  const earned: PromotionWindow = {
    shadowTicks: 500,
    shadowSoakHours: 48,
    shadowIllegalSelections: 0,
    shadowDivergenceRate: 0.01,
    divergenceMeasured: true,
    primarySelectorRejections30m: 0,
    primaryControlBypassRejections30m: 0,
  };

  test("PICKING WORK IN PRIMARY OPENS AND MERGES A BRANCH — the gap this closes", async () => {
    // The whole point. Before this, `PickWork` returned a constant, then a LOOKUP into a run that
    // had already happened. Neither caused anything. This asserts the branch was opened and merged
    // BECAUSE the agent chose the item.
    const opened: string[] = [];
    const merged: string[] = [];
    const change: ChangeControlPort = {
      ...simulatedChangeControl(),
      open: async (n, ctx) => {
        opened.push(ctx.branch);
        return { ok: true, value: { changeId: `c-${n.workId}`, branch: ctx.branch }, evidence: [] };
      },
      merge: async (h) => {
        merged.push(h.branch);
        return { ok: true, value: h, evidence: [] };
      },
    };

    const verdict = evaluatePromotionGate(earned);
    expect(verdict.mode).toBe(AgentLoopMode.ObserveActPrimary);

    const dispatcher = dispatcherFor(verdict, async (workId) => {
      const out = await deliverWorkItem({ ...base, providers: providers({ change }) });
      return {
        succeeded: out.landed,
        evidenceRefs: out.evidenceRefs,
        summary: `${workId}: ${out.summary}`,
        doraContribution: out.doraContribution,
      };
    });

    const d = await dispatcher.dispatch(pickWork);

    expect(opened).toEqual(["work/task-1"]);
    expect(merged).toEqual(["work/task-1"]);
    expect(d.performed).toBe(true);
    expect(d.result?.success).toBe(true);
    expect(d.result?.doraContribution).toBe(1);
  });

  test("A FAILED DELIVERY REACHES THE AGENT AS A FAILURE, not silence", async () => {
    const change: ChangeControlPort = {
      ...simulatedChangeControl(),
      merge: async () => ({ ok: false, reason: "the branch is behind" }),
    };
    const dispatcher = dispatcherFor(evaluatePromotionGate(earned), async (workId) => {
      const out = await deliverWorkItem({ ...base, providers: providers({ change }) });
      return {
        succeeded: out.landed,
        evidenceRefs: out.evidenceRefs,
        summary: `${workId}: ${out.summary}`,
        doraContribution: out.doraContribution,
      };
    });

    const d = await dispatcher.dispatch(pickWork);
    expect(d.result?.success).toBe(false);
    expect(d.result?.doraContribution).toBe(0);
  });

  test("IN SHADOW THE SAME CHOICE DELIVERS NOTHING — no branch is opened at all", async () => {
    // The other half of the property. A shadow lane must not reach the repository, and the way to
    // prove that is that the change-control port was never called — not that the result was absent.
    const opened: string[] = [];
    const change: ChangeControlPort = {
      ...simulatedChangeControl(),
      open: async (n, ctx) => {
        opened.push(ctx.branch);
        return { ok: true, value: { changeId: `c-${n.workId}`, branch: ctx.branch }, evidence: [] };
      },
    };
    const unearned = evaluatePromotionGate({ ...earned, divergenceMeasured: false });
    const dispatcher = dispatcherFor(unearned, async () => {
      const out = await deliverWorkItem({ ...base, providers: providers({ change }) });
      return { succeeded: out.landed, evidenceRefs: [], summary: "", doraContribution: out.doraContribution };
    });

    const d = await dispatcher.dispatch(pickWork);
    expect(opened).toEqual([]);
    expect(d.performed).toBe(false);
    expect(d.result).toBeUndefined();
  });
});
