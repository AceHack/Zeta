/**
 * Organization reaction-plan action executor — composes the autonomous DATA PLANE
 * with the durable ORG STRUCTURE in one executor:
 *
 *   1. run the action through a Hermes agent run (durable run + memory + the
 *      agent-liveness the keep-alive control plane watches),
 *   2. ensure the work item the action targets exists (so the org artifact has a
 *      valid anchor),
 *   3. create the org artifact through the command pipeline (a supervisor-triage
 *      discussion anchor — a durable, auditable organizational record).
 *
 * This is where "the entire organizational structure" meets "the agents doing
 * the autonomous work": an agent runs, stays watched, and produces real org
 * substrate. Short-circuits if the agent run fails (no org artifact for a run
 * that never happened).
 */

import type { ReactionPlanAction } from "../../domain/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutionContext,
  type ReactionPlanActionExecutionResult,
  type ReactionPlanActionExecutorPort,
} from "../../runtime/src/index.ts";

/** Ensure the work item an action targets exists (idempotent), so an org artifact can anchor to it. */
export type EnsureWorkItemPort = {
  ensureWorkItem: (action: ReactionPlanAction) => Promise<void>;
};

export type CreateOrganizationReactionPlanActionExecutorInput = {
  /** runs the action as a Hermes agent run (durable run + memory + agent liveness) */
  agentExecutor: ReactionPlanActionExecutorPort;
  /** ensures the target work item exists before the org artifact is created */
  ensureWorkItem: EnsureWorkItemPort;
  /** creates the durable org artifact (discussion anchor) via the command pipeline */
  organizationExecutor: ReactionPlanActionExecutorPort;
};

export function createOrganizationReactionPlanActionExecutor(
  input: CreateOrganizationReactionPlanActionExecutorInput,
): ReactionPlanActionExecutorPort {
  return {
    executeReactionPlanAction: async (
      action: ReactionPlanAction,
      context: ReactionPlanActionExecutionContext,
    ): Promise<ReactionPlanActionExecutionResult> => {
      // 1. the agent runs (durable run + memory + liveness)
      const agentResult = await input.agentExecutor.executeReactionPlanAction(action, context);
      if (agentResult.status === ReactionPlanExecutionStatus.Failed) {
        return agentResult;
      }

      // 2. ensure the work item exists so the org artifact has a valid anchor
      await input.ensureWorkItem.ensureWorkItem(action);

      // 3. create the durable org artifact (discussion anchor) — this is the result
      return await input.organizationExecutor.executeReactionPlanAction(action, context);
    },
  };
}
