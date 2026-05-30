/**
 * Deterministic hat guardrails (C4) — a preflight that runs BEFORE any hat acts, rejecting an
 * illegal hat×action with zero model calls. Each action-class maps to the tool bundle that
 * grants it; a hat may perform an action only if its allowedToolBundles includes that bundle —
 * so a TPM (no Delivery bundle) literally cannot write code, and a code_author (no ReviewAndGates)
 * cannot approve a review. Plus separation-of-duties: the proposer of a change can never approve it.
 *
 * This is structural authority, not virtue: the guardrail is data + a pure check, so the same
 * rule holds for every agent regardless of what a prompt tries to make it do.
 */

import { ToolBundle, type HatDefinition } from "../../domain/src/index.ts";

/** The classes of action a hat can attempt — each gated by a tool bundle. */
export const ActionClass = {
  WriteCode: "write_code",
  ReviewCode: "review_code",
  ApproveReview: "approve_review",
  RunTests: "run_tests",
  Deploy: "deploy",
  WriteDoc: "write_doc",
  Prioritize: "prioritize",
  AssignHat: "assign_hat",
  DesignArchitecture: "design_architecture",
  WriteBusinessRequirements: "write_business_requirements",
} as const;
export type ActionClass = (typeof ActionClass)[keyof typeof ActionClass];

/** The tool bundle each action-class requires. A hat needs that bundle to perform the action. */
const ACTION_REQUIRED_BUNDLE: Readonly<Record<ActionClass, ToolBundle>> = {
  [ActionClass.WriteCode]: ToolBundle.Delivery,
  [ActionClass.ReviewCode]: ToolBundle.ReviewAndGates,
  [ActionClass.ApproveReview]: ToolBundle.ReviewAndGates,
  [ActionClass.RunTests]: ToolBundle.Qa,
  [ActionClass.Deploy]: ToolBundle.DevOps,
  [ActionClass.WriteDoc]: ToolBundle.DocumentationContext,
  [ActionClass.Prioritize]: ToolBundle.BacklogAndDefect,
  [ActionClass.AssignHat]: ToolBundle.HatAuthorization,
  [ActionClass.DesignArchitecture]: ToolBundle.Architecture,
  [ActionClass.WriteBusinessRequirements]: ToolBundle.Business,
};

export type GuardrailResult =
  | { allowed: true }
  | { allowed: false; reason: string; requiredBundle: ToolBundle };

/**
 * Preflight a hat action. Allowed iff the hat holds the tool bundle the action requires.
 * Deterministic — the same hat×action always yields the same verdict.
 */
export function preflightHatAction(hat: HatDefinition, action: ActionClass): GuardrailResult {
  const required = ACTION_REQUIRED_BUNDLE[action];
  if (hat.allowedToolBundles.includes(required)) return { allowed: true };
  return { allowed: false, reason: `hat "${hat.id}" lacks the "${required}" tool bundle required to ${action}`, requiredBundle: required };
}

export type ApprovalGuardrailResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Separation of duties: the proposer of a change can never approve it. A self-approval is the
 * canonical guardrail violation a review fabric must reject structurally.
 */
export function preflightApproval(proposerHatId: string, approverHatId: string): ApprovalGuardrailResult {
  if (proposerHatId === approverHatId) {
    return { allowed: false, reason: `separation-of-duties: "${approverHatId}" proposed this change and cannot approve its own review` };
  }
  return { allowed: true };
}
