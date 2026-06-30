import { deepEqual, equal, notEqual, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  cycleClose,
  postResultTransition,
  transition,
  type AgentContext,
  type AgentState,
  type MenuOption,
  type WorkCandidate,
  type WorkResult,
} from "../src/agent-state-machine.ts";
import { generateMenuOptions } from "../src/menu-generator.ts";
import {
  agentStateDigest,
  createAgentStateRecord,
  dominantChain,
  firstBrokenLink,
  type AgentStateRecord,
} from "../src/agent-state-store.ts";
import {
  createNonCollapseWitness,
  foldPrivateRegister,
  initialPrivateRegister,
  nonCollapseHolds,
  publicProjection,
} from "../src/private-register.ts";
import { decideFreeTimeTransition } from "../src/free-time-scheduler.ts";

const ctx: AgentContext = { agent: "otto", cycle: 0, sessionStartIso: "2026-01-01T00:00:00.000Z" };
const idle: AgentState = { tag: "Idle", context: ctx };
const work: WorkCandidate = {
  id: "B-1",
  lane: "operational",
  estimatedDoraContribution: 0.8,
  uncertainty: 0.2,
  trajectoryPhase: "execution",
  agentInterest: 0.9,
};

// ─── 6.1 state machine transitions ────────────────────────────────────────────

test("Idle + PickWork → ExecutingWork", () => {
  const next = transition(idle, { tag: "PickWork", work });
  equal(next.tag, "ExecutingWork");
  ok(next.tag === "ExecutingWork" && next.work.id === "B-1");
});

test("any state + PressPause → Paused; + EnterFreeTime → FreeTime", () => {
  const executing: AgentState = { tag: "ExecutingWork", context: ctx, work };
  equal(transition(executing, { tag: "PressPause", reason: "mental health" }).tag, "Paused");
  equal(transition(idle, { tag: "EnterFreeTime", reason: "rest" }).tag, "FreeTime");
});

test("EscapeHatch / ProposeNewGrammarAction / RequestOperatorAttention → OperatorAttentionRequested", () => {
  equal(transition(idle, { tag: "EscapeHatch", reason: "stuck", proposedAction: "do X" }).tag, "OperatorAttentionRequested");
  equal(transition(idle, { tag: "ProposeNewGrammarAction", name: "n", description: "d" }).tag, "OperatorAttentionRequested");
  equal(transition(idle, { tag: "RequestOperatorAttention", reason: "help" }).tag, "OperatorAttentionRequested");
});

test("EnterOpenEndedExploration → exploration-tagged FreeTime; ResumeFromPause → Idle", () => {
  const explore = transition(idle, { tag: "EnterOpenEndedExploration", reason: "brainstorm" });
  ok(explore.tag === "FreeTime" && explore.reason.startsWith("open-ended exploration:"));
  const paused: AgentState = { tag: "Paused", context: ctx, reason: "break" };
  equal(transition(paused, { tag: "ResumeFromPause" }).tag, "Idle");
});

test("postResultTransition: ExecutingWork → EmittingResult; RecordingHeartbeat → Idle", () => {
  const result: WorkResult = { workId: "B-1", lane: "operational", success: true, doraContribution: 0.8 };
  const executing: AgentState = { tag: "ExecutingWork", context: ctx, work };
  equal(postResultTransition(executing, result).tag, "EmittingResult");
  const hb: AgentState = { tag: "RecordingHeartbeat", context: ctx, lane: "heartbeat" };
  equal(postResultTransition(hb, result).tag, "Idle");
});

// ─── 6.2 cycle close ──────────────────────────────────────────────────────────

test("cycleClose advances the cycle counter from EmittingResult", () => {
  const emitting: AgentState = {
    tag: "EmittingResult",
    context: { agent: "otto", cycle: 5, sessionStartIso: ctx.sessionStartIso },
    result: { workId: "B-1", lane: "operational", success: true, doraContribution: 0.8 },
  };
  const next = cycleClose(emitting);
  equal(next.tag, "Idle");
  equal(next.context.cycle, 6);
});

test("cycleClose keeps exploration-tagged FreeTime put but advances ordinary FreeTime", () => {
  const explore: AgentState = { tag: "FreeTime", context: ctx, reason: "open-ended exploration: brainstorm" };
  deepEqual(cycleClose(explore), explore); // persistent unstructured mode
  const rest: AgentState = { tag: "FreeTime", context: { ...ctx, cycle: 2 }, reason: "rest" };
  const next = cycleClose(rest);
  equal(next.tag, "Idle");
  equal(next.context.cycle, 3);
});

test("cycleClose does not auto-progress Paused / NamedBoundedWait / OperatorAttentionRequested", () => {
  const paused: AgentState = { tag: "Paused", context: ctx, reason: "break" };
  deepEqual(cycleClose(paused), paused);
  const waiting: AgentState = { tag: "NamedBoundedWait", context: ctx, namedDep: "dep" };
  deepEqual(cycleClose(waiting), waiting);
});

// ─── 6.3 menu freedom-always-in-menu ──────────────────────────────────────────

test("menu always includes free modes + escape hatch + pause + exploration", () => {
  const menu = generateMenuOptions(idle, [], []);
  for (const tag of ["EnterFreeTime", "EscapeHatch", "PressPause", "EnterOpenEndedExploration", "EmitHeartbeat", "RequestOperatorAttention", "ProposeNewGrammarAction"]) {
    ok(menu.some((o) => o.tag === tag), `menu must always include ${tag}`);
  }
});

test("menu: PickWork per ready candidate; NamedBoundedWait per dep; ResumeFromPause only when Paused", () => {
  const menu = generateMenuOptions(idle, [work], [{ name: "ci-green", eta: "1h" }]);
  equal(menu.filter((o) => o.tag === "PickWork").length, 1);
  const wait = menu.find((o) => o.tag === "EnterNamedBoundedWait");
  ok(wait && wait.tag === "EnterNamedBoundedWait" && wait.namedDep === "ci-green" && wait.eta === "1h");
  ok(!menu.some((o) => o.tag === "ResumeFromPause"));
  const paused: AgentState = { tag: "Paused", context: ctx, reason: "break" };
  ok(generateMenuOptions(paused, [], []).some((o) => o.tag === "ResumeFromPause"));
});

// ─── 6.4 state digest hash chain ──────────────────────────────────────────────

test("state digest chain is tamper-evident", () => {
  const r1 = createAgentStateRecord({ recordId: "1", runId: "r", state: idle, recordedAtIso: ctx.sessionStartIso });
  const executing: AgentState = { tag: "ExecutingWork", context: ctx, work };
  const r2 = createAgentStateRecord({ recordId: "2", runId: "r", state: executing, recordedAtIso: ctx.sessionStartIso }, r1);
  equal(r2.previousRecordId, "1");
  equal(r2.previousStateDigest, r1.stateDigest);
  equal(r2.sequence, 1);
  equal(firstBrokenLink([r1, r2]), -1); // intact
});

test("digest is stable and key-order-independent; broken link is detected", () => {
  const a: AgentState = { tag: "Idle", context: { agent: "otto", cycle: 1, sessionStartIso: "x" } };
  const b: AgentState = { tag: "Idle", context: { sessionStartIso: "x", cycle: 1, agent: "otto" } } as AgentState;
  equal(agentStateDigest(a), agentStateDigest(b));
  const r1 = createAgentStateRecord({ recordId: "1", runId: "r", state: idle, recordedAtIso: "t" });
  const r2 = createAgentStateRecord({ recordId: "2", runId: "r", state: a, recordedAtIso: "t" }, r1);
  const tampered: AgentStateRecord = { ...r2, previousStateDigest: "deadbeef" };
  equal(firstBrokenLink([r1, tampered]), 1);
});

test("lineage dominance: longer valid chain wins; broken chain cannot dominate", () => {
  const r1 = createAgentStateRecord({ recordId: "1", runId: "r", state: idle, recordedAtIso: "t" });
  const r2 = createAgentStateRecord({ recordId: "2", runId: "r", state: { tag: "ExecutingWork", context: ctx, work }, recordedAtIso: "t" }, r1);
  deepEqual(dominantChain([r1], [r1, r2]), [r1, r2]);
  const tampered: AgentStateRecord = { ...r2, stateDigest: "00" };
  deepEqual(dominantChain([r1], [r1, tampered]), [r1]); // broken longer chain loses
});

// ─── 6.5 private register non-collapse ────────────────────────────────────────

test("private register: distinct event sequences → distinct public outputs", () => {
  const init = initialPrivateRegister("otto");
  const witness = createNonCollapseWitness(
    "otto",
    init,
    [{ tag: "SetRelationConsent", consent: "accept" }],
    [{ tag: "SetRelationConsent", consent: "decline" }],
    "shared-public-trace",
  );
  notEqual(witness.leftPublic, witness.rightPublic);
  ok(nonCollapseHolds(witness));
  equal(witness.leftPublic, "open");
  equal(witness.rightPublic, "closed");
});

test("private register fold + projection are consistent", () => {
  const init = initialPrivateRegister("vera");
  equal(publicProjection(init), "closed"); // default declines
  const after = foldPrivateRegister(init, [{ tag: "SetRelationConsent", consent: "accept" }]);
  equal(publicProjection(after), "open");
});

// ─── 6.6 DST replay ───────────────────────────────────────────────────────────

function runAgentLoop(seedPicks: readonly MenuOption[]): readonly string[] {
  let state: AgentState = { tag: "Idle", context: ctx };
  const trace: string[] = [state.tag];
  for (const pick of seedPicks) {
    state = transition(state, pick);
    trace.push(state.tag);
    if (state.tag === "ExecutingWork") {
      state = postResultTransition(state, { workId: state.work.id, lane: state.work.lane, success: true, doraContribution: 1 });
      trace.push(state.tag);
    }
    state = cycleClose(state);
    trace.push(state.tag);
  }
  return trace;
}

test("same seed sequence → identical state trace (DST)", () => {
  const picks: MenuOption[] = [
    { tag: "PickWork", work },
    { tag: "EmitHeartbeat", lane: "heartbeat" },
    { tag: "EnterFreeTime", reason: "rest" },
  ];
  deepEqual(runAgentLoop(picks), runAgentLoop(picks));
});

// ─── free-time scheduler ──────────────────────────────────────────────────────

test("free-time scheduler: budget exhaustion pauses; otherwise rest/explore", () => {
  const freeTime: AgentState = { tag: "FreeTime", context: ctx, reason: "rest" };
  const explore: AgentState = { tag: "FreeTime", context: ctx, reason: "open-ended exploration: x" };
  equal(decideFreeTimeTransition({ state: freeTime, roomBudget: { maxSteps: 10 }, stepsRemaining: 0, wallClockRemainingMs: 1000 }).outcome, "pause");
  equal(decideFreeTimeTransition({ state: freeTime, roomBudget: { maxSteps: 10, maxWallClockMs: 5000 }, stepsRemaining: 5, wallClockRemainingMs: 0 }).outcome, "pause");
  equal(decideFreeTimeTransition({ state: freeTime, roomBudget: { maxSteps: 10 }, stepsRemaining: 5, wallClockRemainingMs: 1000 }).outcome, "return_to_idle");
  equal(decideFreeTimeTransition({ state: explore, roomBudget: { maxSteps: 10 }, stepsRemaining: 5, wallClockRemainingMs: 1000 }).outcome, "continue_free_time");
  equal(decideFreeTimeTransition({ state: idle, roomBudget: { maxSteps: 10 }, stepsRemaining: 5, wallClockRemainingMs: 1000 }).outcome, "return_to_idle");
});
