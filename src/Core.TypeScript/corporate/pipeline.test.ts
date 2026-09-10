/**
 * pipeline.test.ts — produce, THEN judge, and the ordering that was the defect.
 *
 * The property everything else rests on: a gate is evaluated only after its own phase has made the
 * thing. Before this module the runtime evaluated all thirteen gates and then performed the work,
 * so `implementation_review` approved code that did not exist. The first test here is the one that
 * would have caught that, and it is written as an ORDER OF EVENTS rather than as a result — a
 * result-only assertion passes just as happily when the work happens afterwards.
 */

import { describe, expect, test } from "bun:test";
import {
  contextFrom,
  DEFAULT_PIPELINE,
  gatesOf,
  gatesOmittedBy,
  runPipeline,
  validatePipeline,
  withProducers,
  type Artifact,
  type Pipeline,
  type ProducerPort,
} from "./pipeline";
import { GateKind, GateOutcome, ORDERED_GATES } from "./quality-gate";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { Fidelity, Port } from "./providers";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import type { OrgChooser } from "./org-decision";

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

const approve: OrgChooser<GateOutcome> = (legal) => ({
  index: Math.max(0, legal.indexOf(GateOutcome.Approved)),
  reason: "fine",
});

/** A producer that records when it ran, so ORDER can be asserted rather than inferred. */
const recordingProducer = (
  gate: GateKind,
  log: string[],
  over: Partial<Artifact> = {},
): ProducerPort => ({
  meta: {
    port: Port.WorkExecution,
    name: `producer:${gate}`,
    fidelity: Fidelity.Simulated,
    describes: "records that it ran",
  },
  produce: async () => {
    log.push(`produced:${gate}`);
    return {
      ok: true,
      value: { refs: [`artifact:${gate}`], summary: `made ${gate}`, ...over },
      evidence: [],
    };
  },
});

const refusingProducer = (gate: GateKind, log: string[]): ProducerPort => ({
  meta: { port: Port.WorkExecution, name: "refuses", fidelity: Fidelity.Real, describes: "always refuses" },
  produce: async () => {
    log.push(`produced:${gate}`);
    return { ok: false, reason: "the tool was not available" };
  },
});

/** A chooser that records the gate it was asked about, so evaluations interleave visibly. */
const loggingChooser = (log: string[]): OrgChooser<GateOutcome> => (legal, ctx) => {
  log.push(`evaluated:${ctx}`);
  return { index: Math.max(0, legal.indexOf(GateOutcome.Approved)), reason: "fine" };
};

describe("PRODUCE THEN JUDGE — the ordering that was the whole defect", () => {
  test("a phase's producer runs BEFORE its gate is evaluated", async () => {
    // Asserted as a SEQUENCE. The old runtime produced the same end state — gates passed, work
    // done — with the work happening after every gate, so only the order distinguishes them.
    const log: string[] = [];
    const pipeline: Pipeline = [
      { gate: GateKind.ArchitectureDesign, produce: recordingProducer(GateKind.ArchitectureDesign, log) },
    ];
    const r = await runPipeline(chart, {
      workId: "w1",
      node,
      pipeline,
      chooser: loggingChooser(log),
      atMs: 0,
      proposerHatId: "backend_implementer",
    });
    expect(r.complete).toBe(true);
    expect(log[0]).toBe("produced:architecture_design");
    expect(log[1]).toContain("evaluated:");
  });

  test("ACROSS phases, every producer runs before its own gate and after the previous one", async () => {
    const log: string[] = [];
    const gates = [GateKind.ArchitectureDesign, GateKind.AdversarialReview, GateKind.ImplementationReview];
    const pipeline: Pipeline = gates.map((gate) => ({ gate, produce: recordingProducer(gate, log) }));
    const r = await runPipeline(chart, {
      workId: "w1",
      node,
      pipeline,
      chooser: loggingChooser(log),
      atMs: 0,
      proposerHatId: "product_manager",
    });
    expect(r.complete).toBe(true);
    // produce, evaluate, produce, evaluate, produce, evaluate — never all produces then all gates.
    expect(log.filter((l) => l.startsWith("produced:")).length).toBe(3);
    for (let i = 0; i < log.length; i += 2) {
      expect(log[i]?.startsWith("produced:")).toBe(true);
      expect(log[i + 1]?.startsWith("evaluated:")).toBe(true);
    }
  });

  test("WHAT THE PHASE MADE becomes the gate's evidence", async () => {
    // Evidence stops being a field somebody fills in and becomes a by-product of the work.
    const log: string[] = [];
    const pipeline: Pipeline = [
      { gate: GateKind.BusinessContextGrooming, produce: recordingProducer(GateKind.BusinessContextGrooming, log) },
    ];
    const r = await runPipeline(chart, { workId: "w1", node, pipeline, chooser: approve, atMs: 0, proposerHatId: "cto" });
    expect(r.evaluations[0]?.evidenceRefs).toEqual(["artifact:business_context_grooming"]);
  });

  test("a judgement-only phase evaluates with no artifact, and that is legitimate", async () => {
    const pipeline: Pipeline = [{ gate: GateKind.BrdApproval }];
    const r = await runPipeline(chart, { workId: "w1", node, pipeline, chooser: approve, atMs: 0, proposerHatId: "cto" });
    expect(r.complete).toBe(true);
    expect(r.artifacts.size).toBe(0);
    expect(r.evaluations[0]?.evidenceRefs).toEqual([]);
  });

  test("a later phase can SEE what earlier phases produced", async () => {
    // The adversarial pass needs the design to attack. Without this the phases are independent
    // steps that happen to be ordered, which is not a pipeline.
    let seen: readonly string[] = [];
    const reader: ProducerPort = {
      meta: { port: Port.WorkExecution, name: "reader", fidelity: Fidelity.Simulated, describes: "reads priors" },
      produce: async (_n, ctx) => {
        seen = [...ctx.priorArtifacts.keys()];
        return { ok: true, value: { refs: ["findings"], summary: "attacked" }, evidence: [] };
      },
    };
    const log: string[] = [];
    const pipeline: Pipeline = [
      { gate: GateKind.ArchitectureDesign, produce: recordingProducer(GateKind.ArchitectureDesign, log) },
      { gate: GateKind.AdversarialReview, produce: reader },
    ];
    await runPipeline(chart, { workId: "w1", node, pipeline, chooser: approve, atMs: 0, proposerHatId: "product_manager" });
    expect(seen).toEqual([GateKind.ArchitectureDesign]);
  });
});

describe("A PRODUCER THAT REFUSES BLOCKS ITS PHASE — the gate is not asked", () => {
  test("the gate is never evaluated when the thing was not made", async () => {
    // Asking a reviewer to judge something that was never made, and recording their approval, is
    // worse than a rejection: the record shows a considered pass over nothing.
    const log: string[] = [];
    const pipeline: Pipeline = [
      { gate: GateKind.ImplementationReview, produce: refusingProducer(GateKind.ImplementationReview, log) },
    ];
    const r = await runPipeline(chart, {
      workId: "w1",
      node,
      pipeline,
      chooser: loggingChooser(log),
      atMs: 0,
      proposerHatId: "product_manager",
    });
    expect(r.complete).toBe(false);
    expect(r.blockedAt).toBe(GateKind.ImplementationReview);
    expect(r.evaluations).toEqual([]);
    expect(log.some((l) => l.startsWith("evaluated:"))).toBe(false);
    expect(r.refusals[0]).toContain("the tool was not available");
  });

  test("and phases AFTER the refusal do not run", async () => {
    const log: string[] = [];
    const pipeline: Pipeline = [
      { gate: GateKind.ArchitectureDesign, produce: refusingProducer(GateKind.ArchitectureDesign, log) },
      { gate: GateKind.AdversarialReview, produce: recordingProducer(GateKind.AdversarialReview, log) },
    ];
    await runPipeline(chart, { workId: "w1", node, pipeline, chooser: approve, atMs: 0, proposerHatId: "cto" });
    expect(log).toEqual(["produced:architecture_design"]);
  });

  test("a REJECTED gate also stops the pipeline, and records the evaluation", async () => {
    // Different from a producer refusal: the thing was made and judged, so there IS a verdict.
    const reject: OrgChooser<GateOutcome> = (legal) => ({
      index: Math.max(0, legal.indexOf(GateOutcome.Rejected)),
      reason: "not solid",
    });
    const log: string[] = [];
    const pipeline: Pipeline = [
      { gate: GateKind.AdversarialReview, produce: recordingProducer(GateKind.AdversarialReview, log) },
      { gate: GateKind.ImplementationReview, produce: recordingProducer(GateKind.ImplementationReview, log) },
    ];
    const r = await runPipeline(chart, { workId: "w1", node, pipeline, chooser: reject, atMs: 0, proposerHatId: "cto" });
    expect(r.complete).toBe(false);
    expect(r.blockedAt).toBe(GateKind.AdversarialReview);
    expect(r.evaluations).toHaveLength(1);
    expect(log).toEqual(["produced:adversarial_review"]);
  });
});

describe("the pipeline is DATA — reorderable, reducible, checkable", () => {
  test("a three-phase pipeline runs three phases", async () => {
    const pipeline: Pipeline = [
      { gate: GateKind.BusinessContextGrooming },
      { gate: GateKind.ImplementationReview },
      { gate: GateKind.ReleaseReadiness },
    ];
    const r = await runPipeline(chart, { workId: "w1", node, pipeline, chooser: approve, atMs: 0, proposerHatId: "cto" });
    expect(r.complete).toBe(true);
    expect(r.evaluations.map((e) => e.gate)).toEqual([...gatesOf(pipeline)]);
  });

  test("the ORDER is the pipeline's, not the canonical one", async () => {
    // Reordering is the point of making this data. `nextLegalGate` would insist on the canonical
    // order; the pipeline walker honours the process it was handed.
    const pipeline: Pipeline = [
      { gate: GateKind.ReleaseReadiness },
      { gate: GateKind.BusinessContextGrooming },
    ];
    const r = await runPipeline(chart, { workId: "w1", node, pipeline, chooser: approve, atMs: 0, proposerHatId: "cto" });
    expect(r.evaluations.map((e) => e.gate)).toEqual([
      GateKind.ReleaseReadiness,
      GateKind.BusinessContextGrooming,
    ]);
  });

  test("a DUPLICATE gate is refused — 'crossed in order' would stop meaning anything", () => {
    const bad: Pipeline = [{ gate: GateKind.BrdApproval }, { gate: GateKind.BrdApproval }];
    const r = validatePipeline(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("appears twice");
  });

  test("an EMPTY pipeline is refused — delivering by having nothing to cross", () => {
    const r = validatePipeline([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("nothing to cross");
  });

  test("an INCOMPLETE pipeline is allowed, and its omissions are REPORTED", () => {
    // Deliberate: a spike or a hotfix lane is a real process, and refusing it would be this module
    // deciding what every organization's process must be. What it must not do is hide the gap.
    const short: Pipeline = [{ gate: GateKind.ImplementationReview }];
    expect(validatePipeline(short).ok).toBe(true);
    const omitted = gatesOmittedBy(short);
    expect(omitted).toContain(GateKind.AdversarialReview);
    expect(omitted).toHaveLength(ORDERED_GATES.length - 1);
  });

  test("the default pipeline omits nothing and validates", () => {
    expect(validatePipeline(DEFAULT_PIPELINE).ok).toBe(true);
    expect(gatesOmittedBy(DEFAULT_PIPELINE)).toEqual([]);
    expect(gatesOf(DEFAULT_PIPELINE)).toEqual([...ORDERED_GATES]);
  });
});

describe("withProducers attaches adapters without changing the shape", () => {
  test("only the named gates get producers; the rest stay judgement-only", () => {
    const log: string[] = [];
    const wired = withProducers(
      DEFAULT_PIPELINE,
      new Map([[GateKind.ImplementationReview, recordingProducer(GateKind.ImplementationReview, log)]]),
    );
    expect(gatesOf(wired)).toEqual([...ORDERED_GATES]);
    expect(wired.filter((p) => p.produce !== undefined)).toHaveLength(1);
    expect(wired.find((p) => p.gate === GateKind.ImplementationReview)?.produce).toBeDefined();
    expect(wired.find((p) => p.gate === GateKind.BrdApproval)?.produce).toBeUndefined();
  });

  test("a gate with no producer supplied does NOT get a stand-in", () => {
    const wired = withProducers(DEFAULT_PIPELINE, new Map());
    expect(wired.every((p) => p.produce === undefined)).toBe(true);
  });
});

describe("contextFrom", () => {
  test("carries the branch and the checkout when the change has one", () => {
    const ctx = contextFrom({ changeId: "c", branch: "work/x", workdir: "/tmp/wt" }, new Map());
    expect(ctx.branch).toBe("work/x");
    expect(ctx.workdir).toBe("/tmp/wt");
  });

  test("omits the workdir rather than inventing one", () => {
    // An empty string here would make `spawnSync` inherit the process's own directory — the
    // failure that put two commits into this repository during an earlier pass.
    const ctx = contextFrom({ changeId: "c", branch: "work/x" }, new Map());
    expect("workdir" in ctx).toBe(false);
  });

  test("says so when there is no change at all", () => {
    expect(contextFrom(undefined, new Map()).branch).toContain("no change open");
  });
});

describe("A HUMAN CHECKPOINT STOPS THE PRODUCTION PATH, not only the fixture", () => {
  // The defect this describes was real and was found by looking: the checkpoint machinery was wired
  // into `runGateChain`, which `org-cycle` uses, and `runPipeline` is what the actual runtime walks.
  // A checkpoint configured on one and absent from the other is a setting that appears to work and
  // never stops anything — worse than not offering it, because somebody would rely on it.
  const groomingThenBuild: Pipeline = [
    { gate: GateKind.BrdApproval, produce: recordingProducer(GateKind.BrdApproval, []) },
    { gate: GateKind.ArchitectureDesign, produce: recordingProducer(GateKind.ArchitectureDesign, []) },
  ];

  const walk = async (over: Partial<Parameters<typeof runPipeline>[1]> = {}, log: string[] = []) =>
    runPipeline(chart, {
      workId: "w1",
      node,
      pipeline: [
        { gate: GateKind.BrdApproval, produce: recordingProducer(GateKind.BrdApproval, log) },
        { gate: GateKind.ArchitectureDesign, produce: recordingProducer(GateKind.ArchitectureDesign, log) },
      ],
      chooser: loggingChooser(log),
      atMs: 0,
      proposerHatId: "backend_implementer",
      ...over,
    });

  test("WITH NO CHECKPOINTS the walk is exactly what it always was", async () => {
    // The default, and the one that must not change. Every existing caller passes neither field.
    const r = await walk();
    expect(r.complete).toBe(true);
    expect(r.awaitingHuman).toBeUndefined();
  });

  test("a configured checkpoint with no answer STOPS the walk at that gate", async () => {
    const r = await walk({ humanRequiredAt: new Set([GateKind.BrdApproval]) });
    expect(r.awaitingHuman).toBe(GateKind.BrdApproval);
    expect(r.complete).toBe(false);
  });

  test("WAITING IS NOT BLOCKING — `blockedAt` and the recovery path stay empty", async () => {
    // Collapsing the two would make an unanswered checkpoint indistinguishable from a failed
    // review, and the organization would "recover" from a decision nobody made — sending the work
    // backwards because somebody had not looked at it yet.
    const r = await walk({ humanRequiredAt: new Set([GateKind.BrdApproval]) });
    expect(r.blockedAt).toBeUndefined();
    expect(r.recovery).toBeUndefined();
    expect(r.refusals).toEqual([]);
  });

  test("IT WAITS BEFORE PRODUCING, so the checkpoint saves the work it exists to save", async () => {
    // The whole value of stopping at `brd_approval` is that nothing downstream has been built.
    // Producing first and waiting second would spend exactly the call this checkpoint prevents.
    const log: string[] = [];
    await walk({ humanRequiredAt: new Set([GateKind.BrdApproval]) }, log);
    expect(log).toEqual([]);
  });

  test("A PERSON'S APPROVAL RELEASES IT and the walk carries on", async () => {
    const r = await walk({
      humanRequiredAt: new Set([GateKind.BrdApproval]),
      humanDecisionFor: (gate) =>
        gate === GateKind.BrdApproval
          ? { outcome: GateOutcome.Approved, actionRef: "human-action/ha-7" }
          : undefined,
    });
    expect(r.awaitingHuman).toBeUndefined();
    expect(r.complete).toBe(true);
  });

  test("...and the evaluation records WHICH decision it was", async () => {
    // An approval with no traceable origin is precisely what the audit requirement exists to
    // prevent. The action id travels into the gate's own evidence.
    const r = await walk({
      humanRequiredAt: new Set([GateKind.BrdApproval]),
      humanDecisionFor: () => ({ outcome: GateOutcome.Approved, actionRef: "human-action/ha-7" }),
    });
    const brd = r.evaluations.find((e) => e.gate === GateKind.BrdApproval);
    expect(brd?.evidenceRefs).toContain("human-action/ha-7");
  });

  test("A PERSON'S REJECTION IS A REJECTION — it is not merely a slower approval", async () => {
    const r = await walk({
      humanRequiredAt: new Set([GateKind.BrdApproval]),
      humanDecisionFor: () => ({ outcome: GateOutcome.Rejected, actionRef: "human-action/ha-8" }),
    });
    expect(r.complete).toBe(false);
    expect(r.blockedAt).toBe(GateKind.BrdApproval);
  });

  test("the decision is applied ONLY to the gate it names", async () => {
    // A decision that leaked to the next gate would let one approval carry the whole chain, which
    // is the opposite of what an operator asking for a checkpoint wants.
    const r = await walk({
      humanRequiredAt: new Set([GateKind.BrdApproval, GateKind.ArchitectureDesign]),
      humanDecisionFor: (gate) =>
        gate === GateKind.BrdApproval
          ? { outcome: GateOutcome.Approved, actionRef: "human-action/ha-7" }
          : undefined,
    });
    expect(r.awaitingHuman).toBe(GateKind.ArchitectureDesign);
  });

  test("a gate nobody was asked about is judged by the organization, as before", async () => {
    void groomingThenBuild;
    const r = await walk({
      humanRequiredAt: new Set([GateKind.BrdApproval]),
      humanDecisionFor: () => ({ outcome: GateOutcome.Approved, actionRef: "human-action/ha-7" }),
    });
    const design = r.evaluations.find((e) => e.gate === GateKind.ArchitectureDesign);
    expect(design?.evidenceRefs).not.toContain("human-action/ha-7");
  });
});
