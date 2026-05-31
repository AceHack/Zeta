import { ToolBundle } from "../../domain/src/index.ts";
import { isContentAddressedEvidenceRef } from "./content-addressed-evidence.ts";
import { ActionClass } from "./hat-guardrails.ts";
import {
  RunScope,
  type MetricBlock,
  type PromptFlowTask,
  type PromptFlowToolInjection,
} from "./observe.ts";

export const PromptFlowRunState = {
  Created: "created",
  ContextLoaded: "context_loaded",
  RunningPhase: "running_phase",
  AwaitingGate: "awaiting_gate",
  Paused: "paused",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type PromptFlowRunState = (typeof PromptFlowRunState)[keyof typeof PromptFlowRunState];

export const PromptFlowGateKind = {
  Evidence: "evidence",
  Reviewer: "reviewer",
  HumanApproval: "human_approval",
} as const;
export type PromptFlowGateKind = (typeof PromptFlowGateKind)[keyof typeof PromptFlowGateKind];

export type PromptFlowPhaseGate = {
  kind: PromptFlowGateKind;
  requiredEvidenceRefs: readonly string[];
  reviewerHatIds?: readonly string[] | undefined;
};

export type PromptFlowRollbackPolicy = {
  kind: "compensating_action" | "revert_artifact" | "cancel_only";
  description: string;
};

export type PromptFlowPhaseDefinition = {
  phaseId: string;
  label: string;
  actionClass?: ActionClass | undefined;
  permittedUniversalActions: readonly string[];
  directions: readonly string[];
  requiredToolBundles?: readonly ToolBundle[] | undefined;
  toolInjections: readonly PromptFlowToolInjection[];
  contextArtifactRefs: readonly string[];
  requiredEvidenceRefs: readonly string[];
  gate: PromptFlowPhaseGate;
  timeoutSeconds: number;
  retryLimit: number;
  metrics?: readonly MetricBlock[] | undefined;
};

export type PromptFlowDefinition = {
  promptFlowId: string;
  version: string;
  name: string;
  ownerDepartmentId: string;
  allowedHatIds: readonly string[];
  requiredScope: RunScope;
  phases: readonly PromptFlowPhaseDefinition[];
  reviewerHatIds: readonly string[];
  rollbackPolicy: PromptFlowRollbackPolicy;
};

export type PromptFlowRun = {
  runId: string;
  promptFlowId: string;
  definitionVersion: string;
  workItemId: string;
  scope: RunScope;
  currentPhaseId: string;
  state: PromptFlowRunState;
  priority: number;
};

export type PromptFlowLintDiagnostic = {
  code:
    | "missing_prompt_flow_id"
    | "missing_version"
    | "missing_owner_department"
    | "missing_allowed_hats"
    | "missing_phases"
    | "missing_phase_id"
    | "missing_permitted_actions"
    | "missing_directions"
    | "missing_required_evidence"
    | "missing_gate"
    | "invalid_timeout"
    | "missing_rollback"
    | "evidence_gate_mismatch";
  message: string;
  phaseId?: string | undefined;
};

export type CompilePromptFlowTasksInput = {
  definitions: readonly PromptFlowDefinition[];
  runs: readonly PromptFlowRun[];
};

export type PromptFlowAdvanceResult =
  | { outcome: "advanced"; run: PromptFlowRun }
  | {
      outcome: "blocked";
      reason: "missing_evidence" | "invalid_evidence";
      missingEvidenceRefs: readonly string[];
      invalidEvidenceRefs: readonly string[];
    }
  | { outcome: "rejected"; reason: "unknown_phase" | "terminal_state" | "definition_mismatch"; message: string };

type GateEvidenceCheck =
  | { outcome: "satisfied" }
  | Extract<PromptFlowAdvanceResult, { outcome: "blocked" }>;

const executableRunStates: ReadonlySet<PromptFlowRunState> = new Set([
  PromptFlowRunState.Created,
  PromptFlowRunState.ContextLoaded,
  PromptFlowRunState.RunningPhase,
  PromptFlowRunState.AwaitingGate,
]);

export function lintPromptFlowDefinition(definition: PromptFlowDefinition): readonly PromptFlowLintDiagnostic[] {
  const diagnostics: PromptFlowLintDiagnostic[] = [];
  if (definition.promptFlowId.trim() === "") {
    diagnostics.push({ code: "missing_prompt_flow_id", message: "prompt flow id is required" });
  }
  if (definition.version.trim() === "") {
    diagnostics.push({ code: "missing_version", message: "prompt flow version is required" });
  }
  if (definition.ownerDepartmentId.trim() === "") {
    diagnostics.push({ code: "missing_owner_department", message: "prompt flow owner department is required" });
  }
  if (definition.allowedHatIds.length === 0) {
    diagnostics.push({ code: "missing_allowed_hats", message: "prompt flow must name at least one allowed hat" });
  }
  if (definition.phases.length === 0) {
    diagnostics.push({ code: "missing_phases", message: "prompt flow must define at least one phase" });
  }
  if (definition.rollbackPolicy.description.trim() === "") {
    diagnostics.push({ code: "missing_rollback", message: "prompt flow rollback policy must describe the compensating path" });
  }

  for (const phase of definition.phases) {
    diagnostics.push(...lintPromptFlowPhase(phase));
  }

  return diagnostics;
}

export function compilePromptFlowTasks(input: CompilePromptFlowTasksInput): readonly PromptFlowTask[] {
  const definitionsByKey = new Map(input.definitions.map((definition) => [definitionKey(definition.promptFlowId, definition.version), definition]));
  const tasks: PromptFlowTask[] = [];
  for (const run of input.runs) {
    if (!executableRunStates.has(run.state)) continue;
    const definition = definitionsByKey.get(definitionKey(run.promptFlowId, run.definitionVersion));
    if (definition === undefined) continue;
    if (run.scope !== definition.requiredScope) continue;
    const phase = definition.phases.find((candidate) => candidate.phaseId === run.currentPhaseId);
    if (phase === undefined) continue;
    tasks.push(compilePromptFlowTask(definition, phase, run));
  }
  return tasks.sort((left, right) => right.priority - left.priority || left.taskId.localeCompare(right.taskId));
}

export function canAdvancePromptFlowRun(
  definition: PromptFlowDefinition,
  run: PromptFlowRun,
  evidenceRefs: readonly string[] = [],
): PromptFlowAdvanceResult {
  return advancePromptFlowRun(definition, run, evidenceRefs);
}

export function advancePromptFlowRun(
  definition: PromptFlowDefinition,
  run: PromptFlowRun,
  evidenceRefs: readonly string[] = [],
): PromptFlowAdvanceResult {
  if (definition.promptFlowId !== run.promptFlowId || definition.version !== run.definitionVersion) {
    return {
      outcome: "rejected",
      reason: "definition_mismatch",
      message: `run ${run.runId} targets ${run.promptFlowId}@${run.definitionVersion}, not ${definition.promptFlowId}@${definition.version}`,
    };
  }
  const phaseIndex = definition.phases.findIndex((phase) => phase.phaseId === run.currentPhaseId);
  if (phaseIndex < 0) {
    return { outcome: "rejected", reason: "unknown_phase", message: `run ${run.runId} phase ${run.currentPhaseId} is not in prompt flow ${definition.promptFlowId}` };
  }
  if (run.state === PromptFlowRunState.Completed || run.state === PromptFlowRunState.Failed || run.state === PromptFlowRunState.Cancelled) {
    return { outcome: "rejected", reason: "terminal_state", message: `run ${run.runId} is terminal in state ${run.state}` };
  }
  if (run.state === PromptFlowRunState.Paused) {
    return { outcome: "advanced", run: { ...run, state: PromptFlowRunState.RunningPhase } };
  }
  if (run.state === PromptFlowRunState.Created) {
    return { outcome: "advanced", run: { ...run, state: PromptFlowRunState.ContextLoaded } };
  }
  if (run.state === PromptFlowRunState.ContextLoaded) {
    return { outcome: "advanced", run: { ...run, state: PromptFlowRunState.RunningPhase } };
  }
  if (run.state === PromptFlowRunState.RunningPhase) {
    return { outcome: "advanced", run: { ...run, state: PromptFlowRunState.AwaitingGate } };
  }

  const phase = definition.phases[phaseIndex]!;
  const evidenceCheck = checkGateEvidence(phase, evidenceRefs);
  if (evidenceCheck.outcome === "blocked") {
    return evidenceCheck;
  }
  const nextPhase = definition.phases[phaseIndex + 1];
  if (nextPhase === undefined) {
    return { outcome: "advanced", run: { ...run, state: PromptFlowRunState.Completed } };
  }
  return { outcome: "advanced", run: { ...run, currentPhaseId: nextPhase.phaseId, state: PromptFlowRunState.ContextLoaded } };
}

function compilePromptFlowTask(
  definition: PromptFlowDefinition,
  phase: PromptFlowPhaseDefinition,
  run: PromptFlowRun,
): PromptFlowTask {
  return {
    taskId: run.runId,
    workItemId: run.workItemId,
    title: definition.name,
    promptFlowId: definition.promptFlowId,
    label: phase.label,
    scope: run.scope,
    priority: run.priority,
    actionClass: phase.actionClass,
    allowedHatIds: definition.allowedHatIds,
    requiredToolBundles: phase.requiredToolBundles,
    directions: phase.directions,
    toolInjections: phase.toolInjections,
    metrics: phase.metrics ?? [],
    contextArtifactRefs: phase.contextArtifactRefs,
    definitionVersion: definition.version,
    phaseId: phase.phaseId,
    runState: run.state,
    permittedUniversalActions: phase.permittedUniversalActions,
    requiredEvidenceRefs: phase.requiredEvidenceRefs,
    gate: phase.gate,
    reviewerHatIds: phase.gate.reviewerHatIds ?? definition.reviewerHatIds,
    timeoutSeconds: phase.timeoutSeconds,
    retryLimit: phase.retryLimit,
    rollbackPolicy: definition.rollbackPolicy,
  };
}

function lintPromptFlowPhase(phase: PromptFlowPhaseDefinition): readonly PromptFlowLintDiagnostic[] {
  const diagnostics: PromptFlowLintDiagnostic[] = [];
  const phaseId = phase.phaseId.trim() === "" ? undefined : phase.phaseId;
  if (phase.phaseId.trim() === "") {
    diagnostics.push({ code: "missing_phase_id", message: "prompt flow phase id is required" });
  }
  if (phase.permittedUniversalActions.length === 0) {
    diagnostics.push({ code: "missing_permitted_actions", message: "prompt flow phase must name permitted universal actions", phaseId });
  }
  if (phase.directions.length === 0) {
    diagnostics.push({ code: "missing_directions", message: "prompt flow phase must provide directions", phaseId });
  }
  if (phase.requiredEvidenceRefs.length === 0) {
    diagnostics.push({ code: "missing_required_evidence", message: "prompt flow phase must declare required evidence", phaseId });
  }
  if (phase.gate.requiredEvidenceRefs.length === 0) {
    diagnostics.push({ code: "missing_gate", message: "prompt flow phase gate must declare evidence requirements", phaseId });
  }
  if (!sameStringSet(phase.requiredEvidenceRefs, phase.gate.requiredEvidenceRefs)) {
    diagnostics.push({
      code: "evidence_gate_mismatch",
      message: "prompt flow phase required evidence must match the gate evidence contract",
      phaseId,
    });
  }
  if (!Number.isInteger(phase.timeoutSeconds) || phase.timeoutSeconds <= 0) {
    diagnostics.push({ code: "invalid_timeout", message: "prompt flow phase timeout must be a positive integer", phaseId });
  }
  return diagnostics;
}

function checkGateEvidence(
  phase: PromptFlowPhaseDefinition,
  evidenceRefs: readonly string[],
): GateEvidenceCheck {
  const invalidEvidenceRefs = evidenceRefs.filter((ref) => !isContentAddressedEvidenceRef(ref));
  if (invalidEvidenceRefs.length > 0) {
    return {
      outcome: "blocked",
      reason: "invalid_evidence",
      missingEvidenceRefs: [],
      invalidEvidenceRefs,
    };
  }
  const provided = new Set(evidenceRefs);
  const missingEvidenceRefs = phase.gate.requiredEvidenceRefs.filter((ref) => !provided.has(ref));
  if (missingEvidenceRefs.length > 0) {
    return {
      outcome: "blocked",
      reason: "missing_evidence",
      missingEvidenceRefs,
      invalidEvidenceRefs: [],
    };
  }
  return { outcome: "satisfied" };
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function definitionKey(promptFlowId: string, version: string): string {
  return `${promptFlowId}@${version}`;
}
