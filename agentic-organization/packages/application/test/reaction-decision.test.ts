import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  type ReactionPlanAction,
} from "../../domain/src/index.ts";
import { ComposerDecision, DecideOutcome, type EphemeralComposerPort } from "../src/observe.ts";
import {
  createFirstLegalOptionComposer,
  decideReactionAction,
  deterministicRunIdForAction,
  summarizeReactionDecision,
} from "../src/reaction-decision.ts";

function action(overrides: Partial<ReactionPlanAction> = {}): ReactionPlanAction {
  return {
    actionType: ReactionPlanActionType.CreateSupervisorTriage,
    triggerEventId: "evt-decision-1",
    organizationId: "org-1",
    projectId: "proj-1",
    teamId: "team-1",
    workItemId: "wi-1",
    requiredHat: RequiredHat.EngineeringManager,
    reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    supervisorSignalId: "sig-1",
    targetLevel: "manager",
    ...overrides,
  } as ReactionPlanAction;
}

const now = (): string => "2026-05-30T07:00:00.000Z";

test("the deterministic composer selects the highest-priority legal move at Observing", () => {
  const result = decideReactionAction({ action: action(), composer: createFirstLegalOptionComposer(), now });

  equal(result.outcome, DecideOutcome.Selected);
  if (result.outcome !== DecideOutcome.Selected) return;
  // Observing's first legal option is 'compose' (selection before any side effect)
  equal(result.selection.option.actionType, "compose");
  // determinism is visible: the rules that shaped the legal set are recorded
  ok(result.readout.deterministicRulesApplied.includes("gate-precondition"));
});

test("the summary reflects the COMPUTED decision, not a fixed string", () => {
  const result = decideReactionAction({ action: action(), composer: createFirstLegalOptionComposer(), now });
  const summary = summarizeReactionDecision(result);

  equal(summary.kind, "summary");
  if (summary.kind !== "summary") return;
  ok(summary.actionSummary.startsWith("decided 'compose'"));
  ok(summary.learned.includes("legal option"));
});

test("a composer that picks an illegal option is rejected by the deterministic kernel", () => {
  const rogueComposer: EphemeralComposerPort = {
    compose: () => ({
      decision: ComposerDecision.Select,
      option: { actionType: "execute", toPhase: "executing", toScope: "work_item", requiresGate: true, requiresEvidence: false, rationale: "skip ahead" } as never,
      reason: "trying to skip the gate",
    }),
  };

  const result = decideReactionAction({ action: action(), composer: rogueComposer, now });

  // the agent cannot escape the rules — an out-of-set choice becomes feedback, not action
  equal(result.outcome, DecideOutcome.Feedback);
  const summary = summarizeReactionDecision(result);
  equal(summary.kind, "feedback");
});

test("the run id is a stable base-10 ZetaId derived from the action (DST-replayable)", () => {
  const a = deterministicRunIdForAction(action());
  const b = deterministicRunIdForAction(action());
  equal(a, b);
  ok(/^[0-9]+$/.test(a));
  // a different trigger event yields a different id
  ok(deterministicRunIdForAction(action({ triggerEventId: "evt-other" })) !== a);
});
