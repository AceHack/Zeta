import { deepEqual, equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";
import {
  asZetaIdDecimal,
  ComposerDecision,
  DecideOutcome,
  decide,
  observe,
  ObserveFeedbackReason,
  ObserveOutcome,
  RunLifecyclePhase,
  RunScope,
  type EphemeralComposerPort,
  type ObserveDependencies,
  type RunSnapshot,
} from "../src/observe.ts";

const deps: ObserveDependencies = {
  clock: { now: () => "2026-05-29T00:00:00.000Z" },
};

function snapshot(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    runId: asZetaIdDecimal("42"),
    scope: RunScope.Run,
    phase: RunLifecyclePhase.Observing,
    trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
    hasGateApproval: false,
    hasEvidence: false,
    ...overrides,
  };
}

test("asZetaIdDecimal rejects non base-10 ids", () => {
  throws(() => asZetaIdDecimal("0x2a"), /not a base-10 ZetaId/);
  equal(asZetaIdDecimal("128"), "128");
});

test("observe returns a readout with surviving options and applied rule names", () => {
  const result = observe(snapshot(), deps);
  equal(result.outcome, ObserveOutcome.Readout);
  if (result.outcome !== ObserveOutcome.Readout) return;
  equal(result.readout.phase, RunLifecyclePhase.Observing);
  equal(result.readout.observedAt, "2026-05-29T00:00:00.000Z");
  deepEqual(result.readout.trace, snapshot().trace);
  ok(result.readout.options.some((o) => o.actionType === "compose"));
  deepEqual(result.readout.deterministicRulesApplied, ["gate-precondition", "evidence-precondition"]);
});

test("gate precondition vetoes execute until gate is approved", () => {
  const blocked = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: false }), deps);
  equal(blocked.outcome, ObserveOutcome.Readout);
  if (blocked.outcome !== ObserveOutcome.Readout) return;
  ok(!blocked.readout.options.some((o) => o.actionType === "execute"));

  const approved = observe(snapshot({ phase: RunLifecyclePhase.AwaitingGate, hasGateApproval: true }), deps);
  equal(approved.outcome, ObserveOutcome.Readout);
  if (approved.outcome !== ObserveOutcome.Readout) return;
  ok(approved.readout.options.some((o) => o.actionType === "execute"));
});

test("terminal phase yields feedback, not a readout", () => {
  const result = observe(snapshot({ phase: RunLifecyclePhase.Completed }), deps);
  equal(result.outcome, ObserveOutcome.Feedback);
  if (result.outcome !== ObserveOutcome.Feedback) return;
  equal(result.feedback.reason, ObserveFeedbackReason.TerminalPhase);
});

test("unknown phase yields unknown-phase feedback", () => {
  const result = observe(snapshot({ phase: "nonsense" as RunLifecyclePhase }), deps);
  equal(result.outcome, ObserveOutcome.Feedback);
  if (result.outcome !== ObserveOutcome.Feedback) return;
  equal(result.feedback.reason, ObserveFeedbackReason.UnknownPhase);
});

test("decide selects an option the memoryless composer picks from the readout", () => {
  const composer: EphemeralComposerPort = {
    compose: ({ readout }) => ({
      decision: ComposerDecision.Select,
      option: readout.options[0]!,
      reason: "first legal move",
    }),
  };
  const result = decide(snapshot(), composer, deps);
  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  equal(result.selection.option.actionType, "compose");
});

test("decide rejects a composer that selects an option outside the readout", () => {
  const rogue: EphemeralComposerPort = {
    compose: () => ({
      decision: ComposerDecision.Select,
      option: { actionType: "execute", toPhase: RunLifecyclePhase.Executing, toScope: RunScope.WorkItem, requiresGate: true, requiresEvidence: false, rationale: "smuggled" },
      reason: "tries to skip the gate",
    }),
  };
  const result = decide(snapshot(), rogue, deps);
  equal(result.outcome, DecideOutcome.Feedback);
  if (result.outcome !== DecideOutcome.Feedback) return;
  equal(result.feedback.reason, ObserveFeedbackReason.DeterministicRuleViolation);
});

test("decide surfaces a hold when the composer declines to move", () => {
  const cautious: EphemeralComposerPort = {
    compose: () => ({ decision: ComposerDecision.Hold, reason: "waiting for more context" }),
  };
  const result = decide(snapshot(), cautious, deps);
  equal(result.outcome, DecideOutcome.Held);
});
