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
import {
  evaluateControlPlaneAccess,
  type ControlPlaneBudgetCeiling,
  type ControlPlaneFlag,
  type ControlPlaneUsage,
} from "./control-plane-guard.ts";

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
  /** hard-control guard evaluated before any reaction-plan side effect. */
  controlPlane?: ReactionPlanControlPlane | undefined;
};

export type ReactionPlanControlPlane = {
  flags?: readonly ControlPlaneFlag[] | undefined;
  loadFlags?: ((action: ReactionPlanAction) => Promise<readonly ControlPlaneFlag[]>) | undefined;
  budgets?: readonly ControlPlaneBudgetCeiling[] | undefined;
  usageForAction?: ((action: ReactionPlanAction) => ControlPlaneUsage | undefined) | undefined;
  availableSecretScopes?: readonly string[] | undefined;
  now: () => string;
};

export function createOrganizationReactionPlanActionExecutor(
  input: CreateOrganizationReactionPlanActionExecutorInput,
): ReactionPlanActionExecutorPort {
  return {
    executeReactionPlanAction: async (
      action: ReactionPlanAction,
      context: ReactionPlanActionExecutionContext,
    ): Promise<ReactionPlanActionExecutionResult> => {
      const controlPlaneDecision = await authorizeReactionPlanControlPlane(action, input.controlPlane);
      if (controlPlaneDecision !== undefined) {
        return controlPlaneDecision;
      }

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

async function authorizeReactionPlanControlPlane(
  action: ReactionPlanAction,
  controlPlane: ReactionPlanControlPlane | undefined,
): Promise<ReactionPlanActionExecutionResult | undefined> {
  if (controlPlane === undefined) {
    return undefined;
  }
  const flags = [...(controlPlane.flags ?? []), ...await (controlPlane.loadFlags?.(action) ?? Promise.resolve([]))];
  const decision = evaluateControlPlaneAccess({
    organizationId: action.organizationId,
    actorHatId: action.requiredHat,
    tenantId: action.organizationId,
    boundary: "reaction_plan_execution",
    actionType: action.actionType,
    evaluatedAt: controlPlane.now(),
    flags,
    budgets: controlPlane.budgets,
    usage: controlPlane.usageForAction?.(action),
    availableSecretScopes: controlPlane.availableSecretScopes,
  });

  if (decision.status === "allowed") {
    return undefined;
  }

  return {
    status: ReactionPlanExecutionStatus.Failed,
    failure: {
      message: decision.message,
      retryable: true,
    },
  };
}
