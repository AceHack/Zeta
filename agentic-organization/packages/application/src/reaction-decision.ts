/**
 * Reaction decision — turns a reaction-plan action into a *real, computed*
 * agent decision through the deterministic decision kernel (observe -> decide),
 * instead of a hardcoded outcome string.
 *
 * This is the determinism/autonomy split the org is built on:
 *   - observe() + DefaultDeterministicRules compute the LEGAL options (the
 *     determinism that keeps the run — and so the org — within bounds),
 *   - the composer (EphemeralComposerPort) makes the autonomous CHOICE among
 *     them. A choice outside the legal set is rejected as a rule violation: the
 *     agent cannot escape the rules, it only selects within them.
 *
 * The default composer here is a deterministic first-legal-option policy ("take
 * the highest-priority legal move"); a real LLM/sandbox backend implements the
 * same EphemeralComposerPort and swaps in without touching any wiring.
 */

import type { ReactionPlanAction } from "../../domain/src/index.ts";
import {
  ComposerDecision,
  DecideOutcome,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  decide,
  decideAsync,
  type AsyncEphemeralComposerPort,
  type DecideResult,
  type EphemeralComposerPort,
  type ObserveFeedback,
  type RunSnapshot,
} from "./observe.ts";

/** The deterministic baseline agent intelligence: take the highest-priority legal move. */
export function createFirstLegalOptionComposer(): EphemeralComposerPort {
  return {
    compose: (request) => {
      const option = request.readout.options[0];
      if (option === undefined) {
        return { decision: ComposerDecision.Hold, reason: "no legal option to select" };
      }
      return { decision: ComposerDecision.Select, option, reason: option.rationale };
    },
  };
}

export type DecideReactionActionInput = {
  action: ReactionPlanAction;
  composer: EphemeralComposerPort;
  now: () => string;
};

/**
 * Run the deterministic decision kernel for a freshly-triggered reaction-plan
 * action. The action enters the run lifecycle at the Observing phase (the
 * keystone read), and the composer selects a legal next move.
 */
export function decideReactionAction(input: DecideReactionActionInput): DecideResult {
  return decide(snapshotForAction(input.action), input.composer, { clock: { now: input.now } });
}

export type DecideReactionActionAsyncInput = {
  action: ReactionPlanAction;
  composer: AsyncEphemeralComposerPort;
  now: () => string;
};

/** Async sibling: the agent decides through an async (e.g. model-backed) composer, same guardrail. */
export async function decideReactionActionAsync(input: DecideReactionActionAsyncInput): Promise<DecideResult> {
  return decideAsync(snapshotForAction(input.action), input.composer, { clock: { now: input.now } });
}

function snapshotForAction(action: ReactionPlanAction): RunSnapshot {
  return {
    runId: deterministicRunIdForAction(action),
    scope: RunScope.Run,
    phase: RunLifecyclePhase.Observing,
    trace: {
      correlationId: action.triggerEventId,
      causationId: action.triggerEventId,
      traceId: action.triggerEventId,
    },
    hasGateApproval: false,
    hasEvidence: false,
  };
}

/** Result-as-DU summary: either a run-request summary, or a feedback to fail the run on. */
export type ReactionDecisionSummary =
  | { kind: "summary"; actionSummary: string; learned: string }
  | { kind: "feedback"; feedback: ObserveFeedback };

export function summarizeReactionDecision(result: DecideResult): ReactionDecisionSummary {
  switch (result.outcome) {
    case DecideOutcome.Selected:
      return {
        kind: "summary",
        actionSummary: `decided '${result.selection.option.actionType}' -> ${result.selection.option.toPhase}: ${result.selection.reason}`,
        learned: `selected ${result.selection.option.actionType} from ${result.readout.options.length} legal option(s) under rules [${result.readout.deterministicRulesApplied.join(", ")}]`,
      };
    case DecideOutcome.Held:
      return {
        kind: "summary",
        actionSummary: `held: ${result.reason}`,
        learned: `held at phase '${result.readout.phase}' — agent chose to wait`,
      };
    case DecideOutcome.Feedback:
      return { kind: "feedback", feedback: result.feedback };
    default: {
      const unhandled: never = result;
      return unhandled;
    }
  }
}

/**
 * A stable base-10 ZetaId derived from the action's trigger event (FNV-1a).
 * Pure + deterministic: the same action always yields the same run id, so the
 * decision is replayable under DST.
 */
export function deterministicRunIdForAction(action: ReactionPlanAction): ReturnType<typeof asZetaIdDecimal> {
  const FNV_OFFSET = 2166136261;
  const FNV_PRIME = 16777619;
  let hash = FNV_OFFSET;
  for (const codeUnit of action.triggerEventId) {
    hash ^= codeUnit.codePointAt(0) ?? 0;
    hash = Math.imul(hash, FNV_PRIME);
  }
  // >>> 0 → unsigned 32-bit, guaranteeing a non-negative base-10 string.
  return asZetaIdDecimal(String(hash >>> 0));
}
