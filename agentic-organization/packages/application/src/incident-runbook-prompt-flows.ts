import { ToolBundle } from "../../domain/src/index.ts";
import { createContentAddressedEvidenceRef } from "./content-addressed-evidence.ts";
import { ActionClass } from "./hat-guardrails.ts";
import {
  PromptFlowGateKind,
  type PromptFlowDefinition,
  type PromptFlowPhaseDefinition,
} from "./prompt-flow.ts";
import { RunScope } from "./observe.ts";

export const IncidentRunbookPromptFlowId = {
  ProviderOutage: "incident.provider-outage",
} as const;
export type IncidentRunbookPromptFlowId = (typeof IncidentRunbookPromptFlowId)[keyof typeof IncidentRunbookPromptFlowId];

export type BuildProductionIncidentRunbookPromptFlowDefinitionsInput = {
  ownerDepartmentId?: string | undefined;
  incidentCommanderHatId?: string | undefined;
  approverHatIds?: readonly string[] | undefined;
  reviewerHatIds?: readonly string[] | undefined;
};

export function buildProductionIncidentRunbookPromptFlowDefinitions(
  input: BuildProductionIncidentRunbookPromptFlowDefinitionsInput = {},
): readonly PromptFlowDefinition[] {
  const ownerDepartmentId = input.ownerDepartmentId ?? "operations_and_infrastructure";
  const incidentCommanderHatId = input.incidentCommanderHatId ?? "incident_commander";
  const approverHatIds = input.approverHatIds ?? ["operations_director"];
  const reviewerHatIds = input.reviewerHatIds ?? ["runbook_maintainer", "operations_director"];

  return [
    {
      promptFlowId: IncidentRunbookPromptFlowId.ProviderOutage,
      version: "1.0.0",
      name: "Provider outage incident runbook",
      ownerDepartmentId,
      allowedHatIds: [incidentCommanderHatId],
      requiredScope: RunScope.WorkItem,
      reviewerHatIds,
      rollbackPolicy: {
        kind: "compensating_action",
        description: "clear temporary freezes, close incident work, and attach post-incident evidence",
      },
      phases: [
        providerOutageAssessmentPhase(),
        providerOutageHumanApprovalPhase(approverHatIds),
        providerOutageRecoveryPhase(reviewerHatIds),
      ],
    },
  ];
}

function providerOutageAssessmentPhase(): PromptFlowPhaseDefinition {
  const evidenceRef = runbookEvidenceRef("provider-outage", "impact-assessment");
  return {
    phaseId: "assess-impact",
    label: "Assess provider outage impact",
    actionClass: ActionClass.Prioritize,
    permittedUniversalActions: ["load_context", "query_metrics", "send_status_update"],
    directions: [
      "Load active control-plane flags, affected tenants, queue pressure, and provider error telemetry.",
      "Classify blast radius and identify which non-control actions would keep failing.",
      "Prepare the operator approval packet before any freeze or failover action.",
    ],
    requiredToolBundles: [ToolBundle.Observability, ToolBundle.Status, ToolBundle.ArtifactAndEvidence],
    toolInjections: [
      { tool: "lgtm.query_provider_errors", args: { providerId: "provider-from-incident" } },
      { tool: "org.list_control_plane_flags", args: { scope: "incident-work-item" } },
    ],
    contextArtifactRefs: ["incident:work-item", "runbook:provider-outage", "control-plane:active-flags"],
    requiredEvidenceRefs: [evidenceRef],
    gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: [evidenceRef] },
    timeoutSeconds: 600,
    retryLimit: 1,
    metrics: [
      { id: "incident.provider_error_rate", label: "provider error rate", value: 0, unit: "errors/min" },
      { id: "incident.affected_tenants", label: "affected tenants", value: 0, unit: "count" },
    ],
  };
}

function providerOutageHumanApprovalPhase(approverHatIds: readonly string[]): PromptFlowPhaseDefinition {
  const evidenceRef = runbookEvidenceRef("provider-outage", "operator-approval-packet");
  return {
    phaseId: "operator-approval",
    label: "Request human approval for production control action",
    actionClass: ActionClass.Prioritize,
    permittedUniversalActions: ["request_human_approval", "set_control_plane_flag", "reobserve"],
    directions: [
      "Present blast radius, proposed freeze or failover, expected customer impact, rollback path, and approval deadline.",
      "Do not execute provider freeze, tenant freeze, budget freeze, or failover until a human approval artifact is attached.",
      "After approval, set only the narrowest control-plane flag needed for the incident scope.",
    ],
    requiredToolBundles: [ToolBundle.HumanOverride, ToolBundle.AlwaysOnRuntime, ToolBundle.ArtifactAndEvidence],
    toolInjections: [
      { tool: "ops.request_human_approval", args: { approverHatIds } },
      { tool: "org.set_control_plane_flag", args: { flag: "provider_freeze", scope: "provider-from-incident" } },
    ],
    contextArtifactRefs: ["incident:impact-assessment", "control-plane:freeze-policy"],
    requiredEvidenceRefs: [evidenceRef],
    gate: {
      kind: PromptFlowGateKind.HumanApproval,
      requiredEvidenceRefs: [evidenceRef],
      approverHatIds,
      requiredHumanApprovalCount: 1,
    },
    timeoutSeconds: 900,
    retryLimit: 0,
    metrics: [
      { id: "incident.operator_approval_age", label: "operator approval age", value: 0, unit: "minutes" },
    ],
  };
}

function providerOutageRecoveryPhase(reviewerHatIds: readonly string[]): PromptFlowPhaseDefinition {
  const evidenceRef = runbookEvidenceRef("provider-outage", "recovery-verified");
  return {
    phaseId: "recover-and-close",
    label: "Recover service and close incident",
    actionClass: ActionClass.Prioritize,
    permittedUniversalActions: ["execute_recovery", "submit_evidence", "request_review"],
    directions: [
      "Coordinate the approved recovery or failover action through the control-plane guarded dispatch path.",
      "Verify provider error rate, queue pressure, and stale claim rate return below incident thresholds.",
      "Attach recovery evidence and route the incident for post-incident runbook review.",
    ],
    requiredToolBundles: [ToolBundle.AlwaysOnRuntime, ToolBundle.Observability, ToolBundle.ArtifactAndEvidence],
    toolInjections: [
      { tool: "ops.coordinate_approved_recovery", args: { incidentScope: "incident-work-item" } },
      { tool: "lgtm.query_incident_recovery", args: { incidentScope: "incident-work-item" } },
    ],
    contextArtifactRefs: ["incident:operator-approval", "incident:recovery-plan"],
    requiredEvidenceRefs: [evidenceRef],
    gate: { kind: PromptFlowGateKind.Reviewer, requiredEvidenceRefs: [evidenceRef], reviewerHatIds },
    timeoutSeconds: 1200,
    retryLimit: 1,
    metrics: [
      { id: "incident.recovery_error_rate", label: "recovery error rate", value: 0, unit: "errors/min" },
      { id: "incident.queue_pressure", label: "queue pressure", value: 0, unit: "index" },
    ],
  };
}

function runbookEvidenceRef(runbook: string, artifact: string): string {
  return createContentAddressedEvidenceRef("incident-runbook-evidence-contract", { runbook, artifact });
}
