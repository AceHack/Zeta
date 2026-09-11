/**
 * org-fold.test.ts — the organization rebuilt from its own event log.
 *
 * The centrepiece is the ROUND TRIP: run the real runtime, fold its own trace, and assert the
 * result equals the runtime's cascade and calendar node for node. That is what makes "the log is
 * sufficient to rebuild the organization" a checkable claim — a fold that reproduces something
 * simpler than what it folded is not a fold, it is a summary.
 *
 * It is also the test that fails when somebody adds a state-constituting emit and forgets its fact,
 * which is the failure mode this whole approach is exposed to.
 */

import { describe, expect, test } from "bun:test";
import { factEvents, foldCalendar, foldCascade, foldGateEvaluations, foldLandedChanges, foldOrganization, foldPortfolioBook, foldPriorities, foldQaCycles, foldQueues, foldRefusals } from "./org-fold";
import { isStudyBlock } from "./study-session";
import { ClaimState, ShardState, emptyQueue, type WorkQueue } from "./work-market";
import { mergeQueues } from "./run-agent";
import { PriorityClass } from "./prioritization";
import { GateKind, GateOutcome } from "./quality-gate";
import { PortfolioKind, portfolioHistory } from "./portfolio";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { emit } from "./org-event";
import { conflictsFor } from "./work-schedule";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { RunOutcome } from "./qa";
import { WorkState, WorkType } from "./goal-cascade";
import { ScheduleBlockState, ScheduleBlockType } from "./work-schedule";
import { OrgEventKind, type OrgEvent } from "./org-event";

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

const byWorkId = <T extends { workId: string }>(xs: readonly T[]) =>
  [...xs].sort((a, b) => (a.workId < b.workId ? -1 : 1));
const byBlockId = <T extends { blockId: string }>(xs: readonly T[]) =>
  [...xs].sort((a, b) => (a.blockId < b.blockId ? -1 : 1));

const ev = (over: Partial<OrgEvent> = {}): OrgEvent => ({
  id: "e1",
  kind: OrgEventKind.WorkItemTransition,
  atMs: 1_000,
  subjectId: "w1",
  decision: "d",
  supervisorChain: [],
  evidenceRefs: [],
  ...over,
});

describe("THE ROUND TRIP — the log rebuilds what produced it", () => {
  test("a DELIVERED run folds back to its own cascade and calendar, exactly", async () => {
    const report = await runOrgRuntime(deps());
    const folded = foldOrganization(report.trace);

    expect(byWorkId(folded.cascade.nodes)).toEqual(byWorkId(report.cascade.nodes));
    expect(byBlockId(folded.calendar.blocks)).toEqual(byBlockId(report.calendar.blocks));
    // Nothing in the log went unaccounted for.
    expect(folded.refusals).toEqual([]);
    // And it is a real organization, not an empty one that happens to match.
    expect(folded.cascade.nodes.length).toBeGreaterThan(3);
    expect(folded.calendar.blocks.length).toBeGreaterThan(0);
  });

  test("a FAILING run folds back too — and to a different organization", async () => {
    const ok = await runOrgRuntime(deps());
    const bad = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    const foldedBad = foldOrganization(bad.trace);

    expect(byWorkId(foldedBad.cascade.nodes)).toEqual(byWorkId(bad.cascade.nodes));
    expect(foldedBad.refusals).toEqual([]);
    // The discriminating half: the two folds differ, so this is reading the log rather than
    // reconstructing a fixture that happens to fit both.
    const doneIn = (nodes: readonly { state: string }[]) => nodes.filter((n) => n.state === WorkState.Done).length;
    expect(doneIn(foldedBad.cascade.nodes)).not.toBe(doneIn(foldOrganization(ok.trace).cascade.nodes));
  });

  test("the fold carries work TYPE, owner, parent and assignee — not just ids", async () => {
    // The fields that were only ever in the prose. If any of them came back wrong the equality
    // above would fail, but naming them here says what the log had to be carrying.
    const report = await runOrgRuntime(deps());
    const folded = foldCascade(report.trace);
    const leaf = folded.nodes.find((n) => n.assigneeHatId !== undefined);
    expect(leaf).toBeDefined();
    expect(leaf?.workType).not.toBe(WorkType.Goal);
    expect(leaf?.parentWorkId).toBeDefined();
    expect(leaf?.ownerHatId).toBeDefined();

    const goal = folded.nodes.find((n) => n.workType === WorkType.Goal);
    expect(goal?.parentWorkId).toBeUndefined(); // a goal has no parent, and none was invented
  });

  test("MEETINGS come back as one block per attendee, sharing a meeting id", async () => {
    const report = await runOrgRuntime(deps());
    const meetings = foldCalendar(report.trace).blocks.filter((b) => b.blockType === ScheduleBlockType.Meeting);
    expect(meetings.length).toBeGreaterThan(1);
    // One fact, N legs: all the legs share one id, and each sits on a different hat's calendar.
    expect(new Set(meetings.map((b) => b.meetingId)).size).toBe(1);
    expect(new Set(meetings.map((b) => b.hatId)).size).toBe(meetings.length);
  });

  test("FREE TIME IS BOOKED TIME — a studying hat is not free", () => {
    const chart = buildOrgChart(SEED_HATS);
    if (!chart.ok) throw new Error(chart.reason);
    const at = Date.parse("2026-09-09T13:00:00.000Z");
    const events = [
      emit(chart.chart, "e1", {
        kind: OrgEventKind.DecisionRecorded,
        subjectId: "architect",
        decision: "architect spent free time on the repository",
        atMs: at,
        fact: {
          kind: "self_directed",
          hatId: "architect",
          selfDirectedKind: "study_repository",
          subject: "the module this hat reviews most often",
          startMs: at,
          endMs: at + 3_600_000,
          producesKey: "study_repository:the-module-this-hat-reviews-most-often",
        },
      }),
    ];

    // ASSERTED ON THE PROPERTY THIS TEST IS NAMED FOR — the hour is BOOKED — not on the block
    // type it happened to have. It read `blockType === FreeTime`, which held only while every
    // self-directed hour was flattened to free time; that flattening is precisely what made the
    // study budget unspendable (`isStudyBlock` tests for `Reflection`, so `studySpentIn` answered
    // zero over a log full of study). Pinning the type here would have pinned the defect.
    const booked = foldCalendar(events).blocks;
    expect(booked.length).toBe(1);
    expect(booked[0]?.hatId).toBe("architect");
    expect(booked[0]?.endMs).toBe(at + 3_600_000);
    // The memory the block owes, so an hour that produced nothing is visible as one.
    expect(booked[0]?.workItemId).toBe("study_repository:the-module-this-hat-reviews-most-often");

    // AND IT IS RECOGNISABLE AS STUDY, which is the half the old assertion actively prevented.
    // Without this the hour is booked and still invisible to the allowance that is supposed to
    // bound it.
    expect(isStudyBlock(booked[0]!)).toBe(true);

    // The point of putting it on the calendar at all: the hat is BUSY. Before this, the hour
    // existed only as a fact, so a meeting could be booked straight over it.
    expect(conflictsFor(foldCalendar(events), "architect", at + 60_000, at + 120_000).length).toBe(1);
  });

  test("a NON-study self-directed hour is still free time — the split is by kind, not by blanket", () => {
    const chart = buildOrgChart(SEED_HATS);
    if (!chart.ok) throw new Error(chart.reason);
    const at = Date.parse("2026-09-09T13:00:00.000Z");
    const events = [
      emit(chart.chart, "e1", {
        kind: OrgEventKind.DecisionRecorded,
        subjectId: "architect",
        decision: "architect wrote down how a subsystem works",
        atMs: at,
        fact: {
          kind: "self_directed",
          hatId: "architect",
          selfDirectedKind: "write_context_doc",
          subject: "how the fold works",
          startMs: at,
          endMs: at + 3_600_000,
          producesKey: "write_context_doc:how-the-fold-works",
        },
      }),
    ];
    const blocks = foldCalendar(events).blocks;
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.blockType).toBe(ScheduleBlockType.FreeTime);
    // Still booked — the hat is busy writing, and a meeting must not land on top of it.
    expect(conflictsFor(foldCalendar(events), "architect", at + 60_000, at + 120_000).length).toBe(1);
    // But it does NOT spend the study allowance: documenting is not studying.
    expect(isStudyBlock(blocks[0]!)).toBe(false);
  });

  test("re-folding a self-directed hour does not book it twice", () => {
    const chart = buildOrgChart(SEED_HATS);
    if (!chart.ok) throw new Error(chart.reason);
    const at = Date.parse("2026-09-09T13:00:00.000Z");
    const one = emit(chart.chart, "e1", {
      kind: OrgEventKind.DecisionRecorded,
      subjectId: "architect",
      decision: "studied",
      atMs: at,
      fact: {
        kind: "self_directed",
        hatId: "architect",
        selfDirectedKind: "study_repository",
        subject: "s",
        startMs: at,
        endMs: at + 3_600_000,
        producesKey: "k",
      },
    });
    expect(foldCalendar([one, one]).blocks.length).toBe(1);
  });
});

describe("the fold is idempotent, and its order is the log's", () => {
  test("folding the same log twice gives the same organization", async () => {
    const report = await runOrgRuntime(deps());
    expect(foldCascade(report.trace)).toEqual(foldCascade(report.trace));
  });

  test("A DUPLICATED EVENT IS ONE EVENT — a merge must not multiply the organization", async () => {
    const report = await runOrgRuntime(deps());
    const doubled = [...report.trace, ...report.trace];
    expect(byWorkId(foldCascade(doubled).nodes)).toEqual(byWorkId(foldCascade(report.trace).nodes));
    expect(foldCalendar(doubled).blocks.length).toBe(foldCalendar(report.trace).blocks.length);
  });

  test("THE FIRST creation wins — a re-creation does not overwrite what is there", () => {
    // A doubled IDENTICAL event proves nothing here: a map keyed by work id gives the same answer
    // whether the guard exists or not. Two creations of the same id with DIFFERENT content are what
    // separate first-wins from last-wins.
    const events = [
      ev({ id: "a", atMs: 1_000, fact: { kind: "work_created", workId: "w1", workType: WorkType.Task, title: "the real one", ownerHatId: "tech_lead" } }),
      ev({ id: "b", atMs: 2_000, fact: { kind: "work_created", workId: "w1", workType: WorkType.Defect, title: "a later duplicate", ownerHatId: "qa_engineer" } }),
    ];
    const nodes = foldCascade(events).nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.title).toBe("the real one");
    expect(nodes[0]?.workType).toBe(WorkType.Task);
  });

  test("the first BLOCK booking wins too", () => {
    const events = [
      ev({ id: "a", atMs: 1_000, fact: { kind: "block_planned", blockId: "b1", hatId: "tech_lead", blockType: ScheduleBlockType.PrioritizedWork, startMs: 0, endMs: 10 } }),
      ev({ id: "b", atMs: 2_000, fact: { kind: "block_planned", blockId: "b1", hatId: "qa_engineer", blockType: ScheduleBlockType.Review, startMs: 99, endMs: 100 } }),
    ];
    const blocks = foldCalendar(events).blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.hatId).toBe("tech_lead");
  });

  test("SHUFFLED events fold to the same state — order comes from the log, not the reader", async () => {
    const report = await runOrgRuntime(deps());
    // Reversed: a fold that depended on file order would give a different organization here, which
    // is exactly what would happen reading shards off two different filesystems.
    const reversed = [...report.trace].reverse();
    expect(byWorkId(foldCascade(reversed).nodes)).toEqual(byWorkId(foldCascade(report.trace).nodes));
  });

  test("only fact-carrying events are folded, in time order", () => {
    const events = [
      ev({ id: "c", atMs: 3_000, fact: { kind: "work_created", workId: "w3", workType: WorkType.Task, title: "c", ownerHatId: "tech_lead" } }),
      ev({ id: "a", atMs: 1_000, fact: { kind: "work_created", workId: "w1", workType: WorkType.Task, title: "a", ownerHatId: "tech_lead" } }),
      ev({ id: "no-fact", atMs: 2_000, kind: OrgEventKind.Refusal }),
    ];
    expect(factEvents(events).map((e) => e.id)).toEqual(["a", "c"]);
  });
});

describe("priorities and gate verdicts", () => {
  const priorityEvent = (id: string, atMs: number, cls: PriorityClass) =>
    ev({ id, atMs, fact: { kind: "priority_decided", workId: "w1", priorityClass: cls, decidedByHatId: "cto", reason: "r", recommended: PriorityClass.Normal, reasonCodes: [] } });

  test("THE LATEST priority wins — a re-prioritization is the organization changing its mind", () => {
    const folded = foldPriorities([
      priorityEvent("a", 1_000, PriorityClass.Defer),
      priorityEvent("b", 2_000, PriorityClass.Expedite),
    ]);
    expect(folded).toHaveLength(1);
    // Keeping the first would report a decision that has been superseded.
    expect(folded[0]?.priorityClass).toBe(PriorityClass.Expedite);
  });

  test("EVERY gate verdict is kept — the churn signal IS the count", () => {
    // Collapsing to the newest verdict per gate would erase exactly the history that makes churn
    // visible, and `movement`/`deriveDora` both count rejections.
    const rejection = (atMs: number) => ({
      workId: "w1", gate: GateKind.ImplementationReview, outcome: GateOutcome.Rejected,
      byHatId: "tech_lead", reason: "again", atMs, evidenceRefs: [],
    });
    const folded = foldGateEvaluations([
      ev({ id: "a", atMs: 1_000, fact: { kind: "gates_evaluated", evaluations: [rejection(1_000)] } }),
      ev({ id: "b", atMs: 2_000, fact: { kind: "gates_evaluated", evaluations: [rejection(2_000)] } }),
    ]);
    expect(folded).toHaveLength(2);
  });

  test("a DUPLICATED gate run does not double-count churn", () => {
    // The other direction: a merge must not manufacture a rejection that never happened.
    const one = ev({
      id: "a", atMs: 1_000,
      fact: { kind: "gates_evaluated", evaluations: [{ workId: "w1", gate: GateKind.ImplementationReview, outcome: GateOutcome.Rejected, byHatId: "tech_lead", reason: "r", atMs: 1_000 , evidenceRefs: []}] },
    });
    expect(foldGateEvaluations([one, one])).toHaveLength(1);
  });

  test("a real run's verdicts survive the fold", async () => {
    const report = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    expect(foldGateEvaluations(report.trace).length).toBeGreaterThan(0);
    expect(foldPriorities(report.trace).length).toBeGreaterThan(0);
  });
});

describe("an INCOMPLETE log says so", () => {
  test("a change to work the log never created is refused, not invented", () => {
    // Inventing a node to hang the change on would manufacture work nobody planned, and the fold
    // would return a plausible organization with no sign anything was missing.
    const orphaned = [ev({ fact: { kind: "work_assigned", workId: "never-created", assigneeHatId: "backend_implementer" } })];
    expect(foldCascade(orphaned).nodes).toEqual([]);
    expect(foldRefusals(orphaned)).toHaveLength(1);
    expect(foldRefusals(orphaned)[0]).toContain("never-created");
  });

  test("a state change for unknown work, and a block state for an unknown block", () => {
    const orphaned = [
      ev({ id: "a", fact: { kind: "work_state", workId: "ghost", state: WorkState.Done } }),
      ev({ id: "b", fact: { kind: "block_state", blockId: "ghost-blk", state: ScheduleBlockState.Missed } }),
    ];
    expect(foldRefusals(orphaned)).toHaveLength(2);
    expect(foldCalendar(orphaned).blocks).toEqual([]);
  });

  test("a COMPLETE log refuses nothing — so the refusal list is not always populated", async () => {
    const report = await runOrgRuntime(deps());
    expect(foldRefusals(report.trace)).toEqual([]);
  });
});

describe("an empty log", () => {
  test("folds to an empty organization rather than throwing", () => {
    const folded = foldOrganization([]);
    expect(folded.cascade.nodes).toEqual([]);
    expect(folded.calendar.blocks).toEqual([]);
    expect(folded.factCount).toBe(0);
    expect(folded.refusals).toEqual([]);
  });

  test("a log of pure COMMENTARY is distinguishable from a broken one", () => {
    // `factCount: 0` with no refusals means the log holds events that decide nothing about state —
    // real events, no facts. A broken log shows up as refusals instead.
    const commentary = [ev({ kind: OrgEventKind.Refusal }), ev({ id: "e2", kind: OrgEventKind.ChurnDetected })];
    const folded = foldOrganization(commentary);
    expect(folded.factCount).toBe(0);
    expect(folded.refusals).toEqual([]);
  });
});

describe("THE PORTFOLIO BOOK FOLDS OUT OF THE LOG", () => {
  const openedFact = (id: string, atMs: number) =>
    ev({ id, atMs, fact: { kind: "portfolio_opened", portfolioId: "checkout", title: "Checkout", portfolioKind: PortfolioKind.Product, ownerHatId: "engineering_director" } });
  const assocFact = (id: string, atMs: number, goalId: string, portfolioId = "checkout") =>
    ev({ id, atMs, fact: { kind: "goal_associated", goalId, portfolioId } });

  test("goals ACCUMULATE across runs — the reason the association is a fact", () => {
    // Recomputing the book per invocation would give every run a portfolio with one goal in it,
    // which is the same as not having one.
    const book = foldPortfolioBook([
      openedFact("a", 1_000),
      assocFact("b", 2_000, "g1"),
      assocFact("c", 3_000, "g2"),
      assocFact("d", 4_000, "g3"),
    ]);
    expect(book.portfolios).toHaveLength(1);
    expect(Object.keys(book.goalOf).sort()).toEqual(["g1", "g2", "g3"]);
  });

  test("a re-opened portfolio is ONE portfolio, and the FIRST open wins", () => {
    // Identical re-opens prove nothing: a map keyed by id collapses them either way. A second open
    // with DIFFERENT content is what separates first-wins from last-wins.
    const book = foldPortfolioBook([
      openedFact("a", 1_000),
      ev({ id: "b", atMs: 2_000, fact: { kind: "portfolio_opened", portfolioId: "checkout", title: "Renamed", portfolioKind: PortfolioKind.Platform, ownerHatId: "cto" } }),
    ]);
    expect(book.portfolios).toHaveLength(1);
    expect(book.portfolios[0]?.title).toBe("Checkout");
    expect(book.portfolios[0]?.kind).toBe(PortfolioKind.Product);
  });

  test("the LAST association wins — a goal moving product is a re-org", () => {
    const book = foldPortfolioBook([
      openedFact("a", 1_000),
      ev({ id: "b", atMs: 1_500, fact: { kind: "portfolio_opened", portfolioId: "payments", title: "Payments", portfolioKind: PortfolioKind.Platform, ownerHatId: "engineering_director" } }),
      assocFact("c", 2_000, "g1", "checkout"),
      assocFact("d", 3_000, "g1", "payments"),
    ]);
    expect(book.goalOf["g1"]).toBe("payments");
  });

  test("an association with a portfolio the log never opened is REFUSED, not invented", () => {
    const orphan = [assocFact("a", 1_000, "g1", "never-opened")];
    expect(foldPortfolioBook(orphan).goalOf).toEqual({});
    expect(foldRefusals(orphan)[0]).toContain("never-opened");
  });

  test("a REAL run's portfolio survives the fold, and its history is answerable", async () => {
    const report = await runOrgRuntime(
      deps({ portfolio: { portfolioId: "checkout", title: "Checkout", kind: PortfolioKind.Product, ownerHatId: "engineering_director" } }),
    );
    const folded = foldOrganization(report.trace);
    expect(folded.portfolios.portfolios).toHaveLength(1);
    expect(folded.refusals).toEqual([]);

    const goalId = report.cascade.nodes.find((n) => n.workType === WorkType.Goal)?.workId;
    expect(goalId).toBeDefined();
    expect(folded.portfolios.goalOf[goalId!]).toBe("checkout");

    const history = portfolioHistory(folded.portfolios, folded.cascade, "checkout");
    expect(history.goals).toBe(1);
    expect(history.delivered).toBe(1);
    expect(history.unknownGoals).toEqual([]);
  });

  test("a run with NO portfolio emits none — one is never invented", async () => {
    const report = await runOrgRuntime(deps());
    expect(foldPortfolioBook(report.trace).portfolios).toEqual([]);
  });
});

describe("THE QUEUE AND THE QA HISTORY FOLD OUT TOO — the resumed run is not empty", () => {
  /** A queue with one shard, one claim and one approval, so the merge has something to lose. */
  const queueWith = (queueId: string, workId: string, revision = 3): WorkQueue => ({
    ...emptyQueue(queueId, "rmo_office"),
    revision,
    shards: [{ shardId: `${queueId}-s`, workId, state: ShardState.Merged, fencingToken: 1 }],
    claims: [{
      claimId: `${queueId}-c`, shardId: `${queueId}-s`, ownerAgentId: "agent-a", state: ClaimState.Completed,
      claimedAtMs: 0, leaseExpiresMs: 10, heartbeatAtMs: 0, fencingToken: 1,
    }],
    approvals: [{ shardId: `${queueId}-s`, byAgentId: "agent-b", atMs: 5 }],
  });

  const snapshot = (queue: WorkQueue, atMs = 1_000) =>
    ev({ id: `q-${queue.queueId}-${String(atMs)}`, atMs, kind: OrgEventKind.QueueSnapshot, subjectId: queue.queueId, fact: { kind: "queue_snapshot", queue } });

  test("A REAL RUN'S QUEUE SURVIVES THE ROUND TRIP, shard for shard", async () => {
    // This is the boundary: the log used to carry the cascade and the calendar and NOT the market,
    // so a resumed organization had nothing to work on and reported zero deployments — an
    // organization that had been interrupted looked exactly like one that had never run.
    const report = await runOrgRuntime(deps());
    const folded = foldOrganization(report.trace);

    expect(folded.queues).toHaveLength(1);
    expect(mergeQueues(folded.queues).shards).toEqual(report.queue.shards);
    expect(mergeQueues(folded.queues).claims).toEqual(report.queue.claims);
    expect(mergeQueues(folded.queues).approvals).toEqual(report.queue.approvals);
    // And it is a real market, not an empty one that happens to match.
    expect(report.queue.shards.length).toBeGreaterThan(0);
    expect(folded.refusals).toEqual([]);
  });

  test("THE QA HISTORY SURVIVES — with its runs, which is what makes a regression knowable", async () => {
    const report = await runOrgRuntime(deps());
    const folded = foldOrganization(report.trace);
    expect(folded.qa).toEqual(report.qa);
    expect(folded.qa.flatMap((c) => c.runs).length).toBeGreaterThan(0);
  });

  test("QA cycles ACCUMULATE across runs rather than the latest replacing the rest", async () => {
    // A regression is *passed before, fails now*. Keeping only the newest cycle would destroy the
    // "before" for every regression the organization could ever report.
    const first = await runOrgRuntime(deps());
    const second = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    const both = foldQaCycles([...first.trace, ...second.trace]);
    expect(both.length).toBe(first.qa.length + second.qa.length);
    expect(both.some((c) => c.failed > 0)).toBe(true);
    expect(both.some((c) => c.passed > 0)).toBe(true);
  });

  test("LAST IN THE LOG WINS PER QUEUE — not the highest revision", () => {
    // The trap: a later run opens a fresh queue under the same id and its revision restarts at 0.
    // A max-revision fold would resurrect the abandoned queue and hand the resumed run work that
    // was already retired.
    const stale = queueWith("q1", "old-work", 9);
    const fresh = { ...queueWith("q1", "new-work", 0), shards: [{ shardId: "fresh-s", workId: "new-work", state: ShardState.Ready, fencingToken: 1 }] };
    // Later run, later instant — and note the revision runs BACKWARDS, 9 then 0, which is exactly
    // the case a max-revision fold gets wrong.
    const folded = foldQueues([snapshot(stale, 1_000), snapshot(fresh, 2_000)]);
    expect(folded).toHaveLength(1);
    expect(folded[0]?.shards.map((x) => x.workId)).toEqual(["new-work"]);
    // Log ORDER does not decide it — `factEvents` sorts, so handing them over reversed is the same
    // organization. A fold that trusted array order would disagree with itself after a merge.
    expect(foldQueues([snapshot(fresh, 2_000), snapshot(stale, 1_000)])).toEqual(folded);
  });

  test("two snapshots in the SAME instant break the tie on id, not on arrival", () => {
    // Deterministically, so the same log always folds to the same organization. Without a total
    // order two machines could resume the same store into different markets.
    const a = queueWith("q1", "w-a");
    const b = { ...queueWith("q1", "w-b"), shards: [{ shardId: "b-s", workId: "w-b", state: ShardState.Ready, fencingToken: 1 }] };
    const forward = foldQueues([ev({ id: "s-1", atMs: 5, fact: { kind: "queue_snapshot", queue: a } }), ev({ id: "s-2", atMs: 5, fact: { kind: "queue_snapshot", queue: b } })]);
    const reversed = foldQueues([ev({ id: "s-2", atMs: 5, fact: { kind: "queue_snapshot", queue: b } }), ev({ id: "s-1", atMs: 5, fact: { kind: "queue_snapshot", queue: a } })]);
    expect(forward).toEqual(reversed);
    expect(forward[0]?.shards.map((x) => x.workId)).toEqual(["w-b"]);
  });

  test("DIFFERENT queues both survive — one per hat that held one", () => {
    const folded = foldQueues([snapshot(queueWith("q1", "w1")), snapshot(queueWith("q2", "w2"))]);
    expect(folded.map((q) => q.queueId).sort()).toEqual(["q1", "q2"]);
  });

  test("a snapshot holding a shard for work the log never created is REPORTED", () => {
    // A resumed run would otherwise offer items nothing in its own history explains.
    const refusals = foldRefusals([snapshot(queueWith("q1", "ghost-work"))]);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain("ghost-work");
  });
});

describe("mergeQueues — a union, because picking one would hide the others' work", () => {
  const q = (id: string, shardId: string, revision: number): WorkQueue => ({
    ...emptyQueue(id, "rmo_office"),
    revision,
    shards: [{ shardId, workId: `w-${shardId}`, state: ShardState.Ready, fencingToken: 1 }],
    approvals: [{ shardId, byAgentId: "agent-b", atMs: 1 }],
  });

  test("every queue's shards and approvals arrive, and the revision is the MAX", () => {
    // A revision that went BACKWARDS would let an optimistic-concurrency check pass against a
    // stale expectation, which is the one thing the revision exists to prevent.
    const merged = mergeQueues([q("a", "s1", 4), q("b", "s2", 7)]);
    expect(merged.shards.map((s) => s.shardId).sort()).toEqual(["s1", "s2"]);
    expect(merged.approvals).toHaveLength(2);
    expect(merged.revision).toBe(7);
  });

  test("merging is IDEMPOTENT on a single queue, so folding a log twice is safe", () => {
    const one = q("a", "s1", 4);
    expect(mergeQueues([one]).shards).toEqual(one.shards);
    expect(mergeQueues([mergeQueues([one])])).toEqual(mergeQueues([one]));
  });

  test("no queues gives an EMPTY one — the answer for a log with no market, not for every log", () => {
    const empty = mergeQueues([]);
    expect(empty.shards).toEqual([]);
    expect(empty.revision).toBe(0);
  });
});

describe("A MERGE A PERSON UNDID IS NOT LANDED ANY MORE", () => {
  // MEASURED on the Agentic Team's first real run: two defects were merged into the clone's master,
  // which the operator never allows; the merges were reset, and without a fact saying so every later
  // run read them as landed and would never have handed them to people for review.
  const ev = (atMs: number, fact: unknown) =>
    ({ id: `evt-${String(atMs)}`, atMs, kind: "change_projected", subjectId: "task-1", decision: "", evidenceRefs: [], fact }) as never;
  const merged = (atMs: number) => ev(atMs, { kind: "change_merged", workId: "task-1", changeId: "c", branch: "defect/X" });
  const reverted = (atMs: number) => ev(atMs, { kind: "change_merge_reverted", workId: "task-1", branch: "defect/X", reason: "operator never allows" });

  test("merged then reverted reads as not landed; both facts stay in the log", () => {
    expect(foldLandedChanges([merged(1), reverted(2)]).has("task-1")).toBe(false);
  });

  test("merged again after a revert reads as landed - the fold is ordered, not a veto", () => {
    expect(foldLandedChanges([merged(1), reverted(2), merged(3)]).has("task-1")).toBe(true);
  });
});
