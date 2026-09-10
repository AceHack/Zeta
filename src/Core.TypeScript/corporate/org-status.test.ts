/**
 * org-status.test.ts + the admin surface — the readouts and the operator actions.
 *
 * These exist because a predicate with no caller is a question the organization cannot answer about
 * itself. The tests here drive them from a REAL runtime report rather than hand-built fixtures, so
 * what they read is what the pipeline actually produced.
 */

import { describe, expect, test } from "bun:test";
import {
  anchorIsCloseable,
  cascadeHealth,
  chartHealth,
  churnHealth,
  deliberationDebt,
  escalationPreview,
  gateHealth,
  meetingHealth,
  moreUrgent,
  orgStatus,
  priorityBoard,
  qaHealth,
  queueHealth,
  reputationExposure,
  scheduleHealth,
  shardHolder,
} from "./org-status";
import {
  beat,
  briefFor,
  cadenceAuthority,
  cancelBlock,
  decideGate,
  dropAnchor,
  escalationOptions,
  gateOptionsFor,
  handBack,
  ingestThenTriage,
  menuForHatNow,
  normalizedSignal,
  previewSignal,
  priorityOptions,
  proposedOwner,
  revokeHat,
  validateChart,
} from "./org-admin";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, normalize, type ExternalEvent } from "./intake";
import { RunOutcome } from "./qa";
import { GateKind, GateOutcome, NO_PROPOSER , ORDERED_GATES} from "./quality-gate";
import { EscalationAction, EscalationTrigger } from "./escalation";
import { BindingPhase } from "./hat-binding";
import { ScheduleBlockState, ScheduleBlockType } from "./work-schedule";
import { PriorityClass, type PriorityDecision } from "./prioritization";
import { UNIFORM_PRIOR, OutcomeClass, type ReputationObservation } from "./reputation";
import type { NextAction } from "../observe/observe";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();
const agents = agentsFromChart(chart);

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
    agents,
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

const run = (over?: Partial<OrgRuntimeDeps>) => runOrgRuntime(deps(over));
const at = (r: Awaited<ReturnType<typeof run>>) => Math.max(...r.bindings.map((b) => b.warmupEndsMs), 0);

// ─── Status ─────────────────────────────────────────────────────────────────


/** Every gate before `gate` — derived, so extending the chain does not edit this file. */
function priorsOf(gate: GateKind): Set<GateKind> {
  return new Set(ORDERED_GATES.slice(0, ORDERED_GATES.indexOf(gate)));
}

describe("the status reads a REAL run", () => {
  test("the whole readout comes back populated", async () => {
    const r = await run();
    const s = orgStatus({
      chart,
      cascade: r.cascade,
      bindings: r.bindings,
      calendar: r.calendar,
      board: r.board,
      queue: r.queue,
      testCases: r.testCases,
      testRuns: r.qa.flatMap((q) => q.runs),
      gateEvaluations: r.gateEvaluations,
      priorities: r.priorities,
      observations: [],
      agentIds: agents.map((a) => a.agentId),
      goalWorkId: r.goalWorkId!,
      nowMs: at(r),
    });
    expect(s.goalDelivered).toBe(true);
    expect(s.chart.wornHats).toHaveLength(2);
    expect(s.schedules).toHaveLength(2);
    expect(s.gates.length).toBeGreaterThan(0);
    expect(s.qa.totalRuns).toBeGreaterThan(0);
  });

  test("schedule reliability RECONCILES missed blocks rather than assuming adherence", async () => {
    const r = await run();
    const hatId = r.bindings[0]!.hatId;
    // Inside the window: nothing has passed, so nothing is missed.
    expect(scheduleHealth(r.calendar, hatId, at(r)).reliability).toBe(1);
    // Long after: the blocks were never started, so they are missed and reliability drops.
    const later = scheduleHealth(r.calendar, hatId, at(r) + 100 * 3_600_000);
    expect(later.missed).toBeGreaterThan(0);
    expect(later.reliability).toBeLessThan(1);
    expect(later.busyNow).toBe(false);
  });

  test("it reports what a hat is doing right now", async () => {
    const r = await run();
    const h = scheduleHealth(r.calendar, r.bindings[0]!.hatId, at(r));
    expect(h.busyNow).toBe(true);
    expect(h.doingNow).toBe(ScheduleBlockType.PrioritizedWork);
    expect(h.doubleBookedMeetings).toBe(0);
  });

  test("meeting health names the attendees and finds no conflicts in a clean run", async () => {
    const r = await run();
    const meetingId = r.calendar.blocks.find((b) => b.blockType === ScheduleBlockType.Meeting)?.meetingId;
    expect(meetingId).toBeDefined();
    const m = meetingHealth(r.calendar, meetingId!);
    expect(m.attendees).toHaveLength(4);
    expect(m.conflicted).toEqual([]);
  });

  test("QA health separates regressions, unbuilt features and UNTESTED", async () => {
    const r = await run({ qaFallback: RunOutcome.Failed });
    const h = qaHealth(r.testCases, r.qa.flatMap((q) => q.runs));
    expect(h.passRate).toBe(0);
    expect(h.failedFeatures).toBeGreaterThan(0);
    // Never passed, but also never previously passed — so not a regression.
    expect(h.regressions).toBe(0);
    // Untested is a THIRD state a pass rate hides.
    expect(qaHealth(r.testCases, []).untested).toBe(r.testCases.length);
  });

  test("gate health reports progress and where a rejection would send it", async () => {
    const r = await run({ qaFallback: RunOutcome.Failed });
    const taskId = r.gateRuns[0]!.taskId;
    // THE TYPE TRAVELS WITH THE ID. Without it `gateHealth` reports against every canonical gate
    // and named `business_context_grooming` as next for a task whose type never walks it.
    const node = r.cascade.nodes.find((n) => n.workId === taskId);
    const g = gateHealth(chart, taskId, r.gateEvaluations, node?.workType);
    expect(g.merged).toBe(false);
    expect(g.progress).toBeGreaterThan(0);
    expect(g.nextGate).toBe(GateKind.RuntimeValidation);
    expect(g.recoveryIfRejected).toBe("validation_process_improvement");
    // Every verdict in a real run came from an authorized hat.
    expect(g.unauthorizedEvaluations).toBe(0);
  });

  test("gate health COUNTS an unauthorized verdict when one is present", async () => {
    // `evaluateGate` refuses these, so this shape can only reach an audit some other way — which is
    // exactly why the audit must not trust its writer.
    const r = await run();
    const forged = [
      ...r.gateEvaluations,
      { workId: "w", gate: GateKind.RuntimeValidation, outcome: GateOutcome.Approved, byHatId: "backend_implementer", reason: "", atMs: 0, evidenceRefs: [] },
    ];
    expect(gateHealth(chart, "w", forged).unauthorizedEvaluations).toBe(1);
  });

  test("queue health names the review backlog and the stale claims", async () => {
    const r = await run();
    const q = queueHealth(r.queue, at(r));
    expect(q.merged).toBe(2);
    expect(q.awaitingReview).toEqual([]);
    expect(q.staleClaims).toEqual([]);
    // A merged shard still records WHO did it — provenance outlives the claim.
    const holder = shardHolder(r.queue, r.queue.shards[0]!.shardId, at(r));
    expect(holder?.agentId).toBe(r.queue.claims[0]!.ownerAgentId);
    expect(holder?.stale).toBe(false);
    expect(shardHolder(r.queue, "ghost", at(r))).toBeUndefined();
  });

  test("churn health counts bounce-backs and names the gate it sticks on", async () => {
    const r = await run({ qaFallback: RunOutcome.Failed });
    const c = churnHealth(r.gateRuns[0]!.taskId, r.gateEvaluations);
    expect(c.bounceBacks).toBeGreaterThan(0);
    expect(c.stuckAt).toBe(GateKind.RuntimeValidation);
    expect(c.churning).toBe(true);
    expect(churnHealth("nothing", r.gateEvaluations).churning).toBe(false);
  });

  test("escalation preview says what each action would DO", () => {
    const p = escalationPreview([EscalationAction.AddAgents, EscalationAction.Pause]);
    expect(p).toEqual([
      { action: EscalationAction.AddAgents, effect: "changes_the_input" },
      { action: EscalationAction.Pause, effect: "halts_the_loop" },
    ]);
  });

  test("deliberation debt is what an anchor OWES, not how many are open", async () => {
    const r = await run();
    const hatId = r.signals[0]!.fromHatId;
    const d = deliberationDebt(r.board, hatId);
    // The staffing anchors were resolved, so nothing is open and nothing is owed.
    expect(d.openAnchors).toBe(0);
    expect(d.owing).toEqual([]);
    expect(anchorIsCloseable(r.board, r.signals[0]!.anchorId)).toBe(true);
    expect(anchorIsCloseable(r.board, "ghost")).toBe(false);
  });

  test("REPUTATION EXPOSURE names the agents who would gain by restarting", () => {
    const hatId = "backend_implementer";
    // "bad" gets ONE success on purpose. An agent with zero successes gains by restarting under
    // EVERY prior — the ratio f/s is undefined — so a zero-success record cannot tell two priors
    // apart, and a test built on one would pass whatever the threshold was.
    const observations: ReputationObservation[] = [
      { agentId: "bad", hatId, outcomeClass: OutcomeClass.Quality, success: true, atMs: 0 },
      { agentId: "bad", hatId, outcomeClass: OutcomeClass.Quality, success: false, atMs: 0 },
      { agentId: "bad", hatId, outcomeClass: OutcomeClass.Quality, success: false, atMs: 0 },
      { agentId: "good", hatId, outcomeClass: OutcomeClass.Quality, success: true, atMs: 0 },
    ];
    // f/s = 2. Above the uniform threshold of 1.0, below the default of 3.0.
    const uniform = reputationExposure(observations, hatId, ["bad", "good"], 0, UNIFORM_PRIOR);
    expect(uniform.whitewashThreshold).toBe(1);
    expect(uniform.agentsWhoGainByRestarting).toEqual(["bad"]);
    // Under the default prior the threshold is 3.0, so the same record does not qualify.
    const strict = reputationExposure(observations, hatId, ["bad", "good"], 0);
    expect(strict.whitewashThreshold).toBe(3);
    expect(strict.agentsWhoGainByRestarting).toEqual([]);
    // …and the better record ranks first either way.
    expect(strict.rated[0]?.agentId).toBe("good");
  });

  test("cascade health gives the accountable chain and the rung", async () => {
    const r = await run();
    const taskId = r.cascade.nodes.find((n) => n.assigneeHatId !== undefined)!.workId;
    const h = cascadeHealth(r.cascade, taskId)!;
    expect(h.accountableChain).toHaveLength(4);
    expect(h.rung).toBe("lead");
    expect(h.nextRungDown).toBeUndefined(); // a task is the bottom rung
    expect(h.delivered).toBe(true);
    expect(cascadeHealth(r.cascade, "ghost")).toBeUndefined();
  });

  test("chart health finds supervisors with nobody beneath them", () => {
    const h = chartHealth(chart, [], 0);
    expect(h.levels[0]?.level).toBe("executive_board");
    // The seed genuinely has supervisors with no team — that is a staffing fact worth surfacing,
    // and WHICH ones is a property of the org chart rather than of this test. Asserting a specific
    // id pinned the old eight-department subset; `team_lead` is named because it is the one the
    // cascade would otherwise have handed work it could not staff.
    expect(h.childlessSupervisors.length).toBeGreaterThan(0);
    expect(h.childlessSupervisors).toContain("team_lead");
    // ...and a supervisor WITH a team is never listed.
    expect(h.childlessSupervisors).not.toContain("tech_lead");
    expect(h.wornHats).toEqual([]);
  });

  test("the priority board orders and flags overrides", () => {
    const d = (workId: string, cls: PriorityClass, rec: PriorityClass): PriorityDecision => ({
      workId, priorityClass: cls, decidedByHatId: "cto", reason: "", recommended: rec, reasonCodes: [],
    });
    const board = priorityBoard([
      d("b", PriorityClass.Defer, PriorityClass.Defer),
      d("a", PriorityClass.Expedite, PriorityClass.Normal),
    ]);
    expect(board.map((x) => x.workId)).toEqual(["a", "b"]);
    expect(board[0]?.overridden).toBe(true);
    expect(board[1]?.overridden).toBe(false);
    expect(moreUrgent(d("a", PriorityClass.High, PriorityClass.High), d("b", PriorityClass.Defer, PriorityClass.Defer))).toBe(true);
  });
});

// ─── Admin ──────────────────────────────────────────────────────────────────

describe("the admin surface CHECKS AUTHORITY before acting", () => {
  test("a supervisor may revoke a binding; a stranger may not", async () => {
    const r = await run();
    const binding = r.bindings[0]!;
    const stranger = revokeHat(chart, r.bindings, {
      bindingId: binding.bindingId, byHatId: "qa_engineer", nowMs: at(r), reason: "policy",
    });
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) expect(stranger.reason).toContain("does not supervise");

    const boss = revokeHat(chart, r.bindings, {
      bindingId: binding.bindingId, byHatId: "tech_lead", nowMs: at(r), reason: "incident",
    });
    expect(boss.ok).toBe(true);
    if (!boss.ok) return;
    expect(boss.value.find((b) => b.bindingId === binding.bindingId)?.phase).toBe(BindingPhase.Revoked);
  });

  test("an unknown binding is refused", async () => {
    const r = await run();
    expect(revokeHat(chart, r.bindings, { bindingId: "ghost", byHatId: "cto", nowMs: 0, reason: "x" }).ok).toBe(false);
  });

  test("a supervisor may cancel a block; a stranger may not", async () => {
    const r = await run();
    const block = r.calendar.blocks[0]!;
    expect(cancelBlock(chart, r.calendar, { blockId: block.blockId, byHatId: "qa_engineer" }).ok).toBe(false);
    const ok = cancelBlock(chart, r.calendar, { blockId: block.blockId, byHatId: block.hatId });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.blocks.find((b) => b.blockId === block.blockId)?.state).toBe(ScheduleBlockState.Canceled);
  });

  test("cadence authority reports the owning level and whether this hat has it", () => {
    const mgr = cadenceAuthority(chart, "engineering_manager", ScheduleBlockType.Review);
    expect(mgr.ok).toBe(true);
    if (!mgr.ok) return;
    expect(mgr.value.owner).toBe("c_suite");
    expect(mgr.value.permitted).toBe(false);
    expect(cadenceAuthority(chart, "ghost", ScheduleBlockType.Review).ok).toBe(false);
  });

  test("the operator can see WHY a hat is idle", async () => {
    const r = await run();
    const menu: readonly NextAction[] = [
      { kind: "do_item", item: { id: "x", title: "t", ready: true, ambiguous: false } },
      { kind: "explore", reason: "curiosity" },
    ];
    const hatId = r.bindings[0]!.hatId;
    // During its prioritized-work block, work is in scope.
    const working = menuForHatNow(r.calendar, hatId, at(r), menu);
    expect(working.workInScope).toBe(true);
    expect(working.offered).toHaveLength(2);
    // During the meeting it is not, and the free modes survive.
    const meeting = r.calendar.blocks.find((b) => b.blockType === ScheduleBlockType.Meeting && b.hatId === "tech_lead");
    if (meeting !== undefined) {
      const inMeeting = menuForHatNow(r.calendar, "tech_lead", meeting.startMs, menu);
      expect(inMeeting.workInScope).toBe(false);
      expect(inMeeting.offered.every((a) => a.kind === "explore")).toBe(true);
    }
  });

  test("a heartbeat on a finished claim is refused, and a live one accepted", async () => {
    const r = await run();
    const claim = r.queue.claims[0]!;
    // Every claim completed in a clean run, so the beat is refused.
    const dead = beat(r.queue, claim.claimId, at(r));
    expect(dead.ok).toBe(false);
    expect(handBack(r.queue, { claimId: claim.claimId, nowMs: at(r), reason: "stuck" }).ok).toBe(false);
    expect(beat(r.queue, "ghost", 0).ok).toBe(false);
  });

  test("gate options differ by level — only a director and above may waive", () => {
    const mgr = gateOptionsFor(chart, "engineering_manager");
    const dir = gateOptionsFor(chart, "qa_director");
    expect(mgr.ok && mgr.value.mine).not.toContain(GateOutcome.Waived);
    expect(dir.ok && dir.value.mine).toContain(GateOutcome.Waived);
    expect(mgr.ok && mgr.value.ordinary).toHaveLength(3);
    expect(gateOptionsFor(chart, "ghost").ok).toBe(false);
  });

  test("an operator drives a gate THROUGH the gate, not around it", () => {
    // Out of order is still refused, even from the admin path.
    const early = decideGate(chart, {
      workId: "w", gate: GateKind.ReleaseReadiness, evaluatorHatId: "tpm",
      passed: new Set(), outcome: GateOutcome.Approved, atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(early.ok).toBe(false);

    const inOrder = decideGate(chart, {
      workId: "w", gate: GateKind.CustomerRfpReview, evaluatorHatId: "product_manager",
      passed: priorsOf(GateKind.CustomerRfpReview), outcome: GateOutcome.Rejected, atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(inOrder.ok).toBe(true);
    if (!inOrder.ok) return;
    expect(inOrder.evaluation.outcome).toBe(GateOutcome.Rejected);
    expect(inOrder.recovery).toBeDefined();
  });

  test("a manager asking to WAIVE through the admin path is still clamped", () => {
    const r = decideGate(chart, {
      workId: "w", gate: GateKind.ImplementationReview, evaluatorHatId: "engineering_manager",
      passed: priorsOf(GateKind.ImplementationReview),
      outcome: GateOutcome.Waived, atMs: 0,
      proposerHatId: NO_PROPOSER,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evaluation.outcome).not.toBe(GateOutcome.Waived);
  });

  test("escalation options depend on level and trigger", () => {
    const lead = escalationOptions(chart, "tech_lead", EscalationTrigger.RepeatedGateRejection);
    expect(lead.ok && lead.value.authorized).toBe(false);
    expect(lead.ok && lead.value.actions).toEqual([]);
    const mgr = escalationOptions(chart, "engineering_manager", EscalationTrigger.ReviewQueueSaturated);
    expect(mgr.ok && mgr.value.actions).toContain(EscalationAction.ReassignReviewer);
    expect(mgr.ok && mgr.value.actions).not.toContain(EscalationAction.ReScope);
  });

  test("an anchor can be dropped, and only once", async () => {
    const r = await run({ agents: [] });
    // With no agents, staffing anchors are opened and never resolved — real open anchors to drop.
    const open = r.board.anchors.find((a) => a.state === "open");
    expect(open).toBeDefined();
    const dropped = dropAnchor(r.board, open!.anchorId);
    expect(dropped.ok).toBe(true);
    if (!dropped.ok) return;
    expect(dropAnchor(dropped.value, open!.anchorId).ok).toBe(false);
  });

  test("a brief tells a hat where each tool routes, before it sends", () => {
    const b = briefFor(chart, "backend_implementer", "rmo_office");
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value.supervisorHatId).toBe("tech_lead");
    expect(b.value.tools).toHaveLength(8);
    expect(briefFor(chart, "ghost", "rmo_office").ok).toBe(false);
  });

  test("a signal can be previewed — target and evidence — before it is sent", () => {
    const bad = previewSignal(chart, {
      fromHatId: "backend_implementer", tool: "report_blocker", evidence: [],
      resourceAuthorityHatId: "rmo_office",
    });
    expect(bad.ok && bad.value.evidenceOk).toBe(false);
    expect(bad.ok && bad.value.targetHatId).toBe("tech_lead");

    const good = previewSignal(chart, {
      fromHatId: "backend_implementer", tool: "report_blocker",
      evidence: [{ kind: "log", ref: "l" }], resourceAuthorityHatId: "rmo_office",
    });
    expect(good.ok && good.value.evidenceOk).toBe(true);
    expect(previewSignal(chart, { fromHatId: "ghost", tool: "ask_question", evidence: [], resourceAuthorityHatId: "rmo_office" }).ok).toBe(false);
  });

  test("ingest and triage are separable, so an operator sees WHICH one refused", () => {
    const n = normalize(GOOD);
    expect(n.ok).toBe(true);
    if (!n.ok) return;

    const fresh = ingestThenTriage(n.value, { itemId: "i", nowMs: 0, seen: new Set() });
    expect(fresh.ingested.ok).toBe(true);
    expect(fresh.triaged?.ok).toBe(true);

    // A duplicate never reaches triage at all.
    const dup = ingestThenTriage(n.value, { itemId: "i", nowMs: 0, seen: new Set([n.value.externalRef]) });
    expect(dup.ingested.ok).toBe(false);
    expect(dup.triaged).toBeUndefined();

    // Ingested fine, refused at triage — the distinction the combined call collapses.
    const bare = normalize({ source: "s", externalId: "x", kind: IntakeKind.Defect, title: "broken" });
    expect(bare.ok).toBe(true);
    if (!bare.ok) return;
    const partial = ingestThenTriage(bare.value, { itemId: "i2", nowMs: 0, seen: new Set() });
    expect(partial.ingested.ok).toBe(true);
    expect(partial.triaged?.ok).toBe(false);
  });

  test("priority options and signal normalization", () => {
    const lead = priorityOptions(chart, "tech_lead");
    expect(lead.ok).toBe(true);
    if (lead.ok) expect(lead.value).toEqual([]);
    const cto = priorityOptions(chart, "cto");
    expect(cto.ok).toBe(true);
    if (cto.ok) expect(cto.value).toContain(PriorityClass.Paused);
    const clamped = normalizedSignal(5);
    expect(clamped.ok).toBe(true);
    if (clamped.ok) expect(clamped.value).toBe(1);
    expect(normalizedSignal(Number.NaN).ok).toBe(false);
  });

  test("a proposed owner is derived, and refused when the line is empty", () => {
    const ok = proposedOwner(chart, "cto", "director", "manager");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.id).toBe("engineering_director");
    expect(proposedOwner(chart, "backend_implementer", "manager").ok).toBe(false);
  });

  test("a proposed chart is validated before adoption", () => {
    expect(validateChart(SEED_HATS).ok).toBe(true);
    const broken = validateChart([
      { id: "a", name: "A", level: "director", departmentId: "d" },
      { id: "b", name: "B", level: "director", departmentId: "d" },
    ]);
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.reason).toContain("2 root hats");
  });
});
