/**
 * OrgEvent — the universal, durable trace record. Generalizing the hat doc's
 * "exactly one HatSwap per transition", EVERY organizational state transition
 * (hat bind/warmup/expire/succeed, priority decision, supply vote, assignment,
 * pipeline stage, gate evaluation) emits exactly one OrgEvent.
 *
 * Each carries who acted (hat + agent + department), the supervisor-chain path
 * that authorized it, what changed (from→to), the decision, evidence, and the
 * correlation/causation/trace envelope. "What is happening" is one query over
 * the OrgEvent stream — that is the traceability contract.
 */

import type { DepartmentId } from "./department.ts";

export const OrgEventKind = {
  HatBindingTransition: "hat_binding_transition",
  HatSupplyDecision: "hat_supply_decision",
  PriorityDecision: "priority_decision",
  HatAssignment: "hat_assignment",
  PipelineStageTransition: "pipeline_stage_transition",
  QualityGateEvaluation: "quality_gate_evaluation",
  SuccessionPlanned: "succession_planned",
} as const;

export type OrgEventKind = (typeof OrgEventKind)[keyof typeof OrgEventKind];

export type OrgEvent = {
  id: string;
  kind: OrgEventKind;
  occurredAt: string;
  organizationId: string;
  /** the hat that acted (the authority under which the transition happened) */
  actorHatId?: string;
  actorAgentId?: string;
  departmentId?: DepartmentId;
  /** the entity that transitioned (binding id, work item id, hat id, …) */
  subjectId: string;
  fromState?: string;
  toState?: string;
  /** human-readable decision summary — must be crystal clear about what happened */
  decision: string;
  /** hat-id path from the Executive Board root down to the actor */
  supervisorChain: readonly string[];
  evidenceRefs: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};
