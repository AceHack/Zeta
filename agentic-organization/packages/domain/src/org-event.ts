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
  // Work OS overhaul (W1–W6) — the living work loop's transitions.
  WorkItemTransition: "work_item_transition",
  WorkBatchTransition: "work_batch_transition",
  TestCaseAuthored: "test_case_authored",
  TestRunRecorded: "test_run_recorded",
  RegressionDetected: "regression_detected",
  DefectOpened: "defect_opened",
  ChurnDetected: "churn_detected",
  EscalationDecision: "escalation_decision",
  IntakeReceived: "intake_received",
  // Memory system (MEM1–MEM8) — the dynamic-memory loop's transitions.
  MemoryRetained: "memory_retained",
  MemoryInjected: "memory_injected",
  MemoryCited: "memory_cited",
  MemoryOutcomeObserved: "memory_outcome_observed",
  MemoryPhaseTransition: "memory_phase_transition",
  MemoryReinforced: "memory_reinforced",
  MemoryArchived: "memory_archived",
  MemoryPromoted: "memory_promoted",
  MemoryDemoted: "memory_demoted",
  MemoryConflictFlagged: "memory_conflict_flagged",
  MemoryMaintenanceCycle: "memory_maintenance_cycle",
  // Org-Native Change Control (CC0–CC6) — the internal review fabric's transitions.
  ChangeSetOpened: "change_set_opened",
  ReviewStageAdvanced: "review_stage_advanced",
  ReviewFindingRaised: "review_finding_raised",
  ChangesRequested: "changes_requested",
  StageApproved: "stage_approved",
  ChangeSetApproved: "change_set_approved",
  ChangeSetApplied: "change_set_applied",
  ChangeSetRejected: "change_set_rejected",
  ProjectionCreated: "projection_created",
  ProjectionSynced: "projection_synced",
  HumanSignoffRequested: "human_signoff_requested",
  // Document Intelligence (D0–D5) — the ingest/organize/retrieve knowledge layer.
  DocIngested: "doc_ingested",
  DocClassified: "doc_classified",
  DocLifecycleTransition: "doc_lifecycle_transition",
  DocCanonicalized: "doc_canonicalized",
  DocSuperseded: "doc_superseded",
  DocStaleFlagged: "doc_stale_flagged",
  DocArchived: "doc_archived",
  DocConsulted: "doc_consulted",
  DocMaintenanceCycle: "doc_maintenance_cycle",
  // Knowledge Graph (G0–G5) — the node/edge construction engine.
  GraphNodeExtracted: "graph_node_extracted",
  GraphEdgeInferred: "graph_edge_inferred",
  GraphConfidencePromoted: "graph_confidence_promoted",
  GraphEdgeRetracted: "graph_edge_retracted",
  GraphDerivedIntelligence: "graph_derived_intelligence",
  // Model eval + optimization (G2/M3) — closed-loop decision quality evidence.
  ModelEvalCompleted: "model_eval_completed",
  DecisionOptimizationProposed: "decision_optimization_proposed",
  // Recovery scanners (G3) — observability over stale/stranded/abandoned runtime rows.
  RecoveryIncidentDetected: "recovery_incident_detected",
  RecoveryScanCompleted: "recovery_scan_completed",
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
