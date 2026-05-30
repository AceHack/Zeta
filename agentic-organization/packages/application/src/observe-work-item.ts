/**
 * Wire observe.ts to real work-item state (slice 4).
 *
 * This is the seam the state reconciliation table (slice 1) was built for: it
 * turns a real WorkItem (its WorkItemState + gate/evidence facts) into the
 * RunSnapshot that observe() is pure over, using RUN_PHASE_FOR_STATE to map the
 * work-item state to the observe RunLifecyclePhase. observe() then returns the
 * legal next options at the requested scope. This proves the keystone end to end
 * on real domain records rather than synthetic snapshots.
 *
 * RUN_PHASE_FOR_STATE returns a string (the domain package cannot depend on the
 * application package's RunLifecyclePhase type); we narrow it to the phase DU at
 * this boundary and surface an explicit feedback variant if it ever fails to
 * narrow (it cannot for the 8 enumerated states, but the seam stays honest).
 */

import { RUN_PHASE_FOR_STATE, type WorkItem } from "../../domain/src/index.ts";
import {
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  observe,
  type ObserveResult,
  type RunSnapshot,
  type RunTrace,
} from "./observe.ts";

const VALID_PHASES: ReadonlySet<string> = new Set(Object.values(RunLifecyclePhase));

export type ObserveWorkItemDeps = { clock: { now: () => string } };

export type ObserveWorkItemFacts = {
  /** the ZetaId-decimal run id addressing this observation */
  runId: string;
  scope?: RunScope;
  trace: RunTrace;
  /** whether the work item's current gate (per the reconciliation table) is approved */
  hasGateApproval: boolean;
  /** whether required evidence has been submitted */
  hasEvidence: boolean;
};

export const ObserveWorkItemFeedbackReason = {
  PhaseUnmapped: "phase_unmapped",
} as const;
export type ObserveWorkItemFeedbackReason =
  (typeof ObserveWorkItemFeedbackReason)[keyof typeof ObserveWorkItemFeedbackReason];

export type ObserveWorkItemResult =
  | { outcome: "ok"; snapshot: RunSnapshot; readout: ObserveResult }
  | { outcome: "feedback"; feedback: { reason: ObserveWorkItemFeedbackReason; message: string } };

/**
 * Build the RunSnapshot for a work item from its state + facts. Pure; returns a
 * feedback variant if the work-item state does not map to a known run phase.
 */
export function snapshotForWorkItem(
  workItem: WorkItem,
  facts: ObserveWorkItemFacts,
): { outcome: "ok"; snapshot: RunSnapshot } | { outcome: "feedback"; feedback: { reason: ObserveWorkItemFeedbackReason; message: string } } {
  const phaseString = RUN_PHASE_FOR_STATE[workItem.state];
  if (!VALID_PHASES.has(phaseString)) {
    return {
      outcome: "feedback",
      feedback: { reason: ObserveWorkItemFeedbackReason.PhaseUnmapped, message: `work item state '${workItem.state}' mapped to unknown run phase '${phaseString}'` },
    };
  }

  const snapshot: RunSnapshot = {
    runId: asZetaIdDecimal(facts.runId),
    scope: facts.scope ?? RunScope.WorkItem,
    phase: phaseString as RunLifecyclePhase,
    trace: facts.trace,
    hasGateApproval: facts.hasGateApproval,
    hasEvidence: facts.hasEvidence,
  };
  return { outcome: "ok", snapshot };
}

/**
 * Observe a real work item: build its snapshot from state + facts, then run the
 * pure observe() to get the current run state and legal next options.
 */
export function observeWorkItem(
  workItem: WorkItem,
  facts: ObserveWorkItemFacts,
  deps: ObserveWorkItemDeps,
): ObserveWorkItemResult {
  const built = snapshotForWorkItem(workItem, facts);
  if (built.outcome === "feedback") {
    return built;
  }
  return {
    outcome: "ok",
    snapshot: built.snapshot,
    readout: observe(built.snapshot, { clock: deps.clock }),
  };
}
