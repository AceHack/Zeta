/**
 * observe.ts — the single entrypoint an agent has to remember.
 *
 * Operator idea 5: agents remember only `observe.ts`. It is keyed by a run id
 * (a ZetaId rendered as a decimal — operator ideas 7/8), returns the current
 * run state plus the legal next options at varying scopes, and delegates the
 * *selection* (the intelligence) to an ephemeral, memoryless composer.
 *
 * Separation of concerns (the point of the keystone):
 *   - observe()      : pure logic. Computes a readout from an injected snapshot
 *                      and an explicit phase->options table. Holds NO state.
 *   - composer port  : pure selection. Receives the whole readout in its
 *                      argument and keeps NOTHING between calls.
 *   - decide()       : composes observe() -> composer.compose() -> a typed
 *                      selection result.
 *
 * Everything is an explicit discriminated union (operator idea 2; repo rule
 * "IMPLICIT-NOT-EXPLICIT in DUs is class error"). Failure is a first-class
 * `feedback` variant, never a thrown exception or a null
 * (repo convention: Result<T, TFeedback>).
 *
 * This slice is intentionally self-contained: it does not yet import the
 * tri-language ZetaId codec (src/Core.TypeScript/zeta-id). The run id is a
 * branded decimal string produced by that codec; wiring the real packer is
 * the next slice. See agentic-organization/docs/OBSERVE_COMPOSER_AND_RUN_STATE.md.
 */

import {
  CommandType,
  HatLevel,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalToolType,
  ToolBundle,
  type HatDefinition,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import type {
  MetricSeries,
  TelemetryQueryDegraded,
  TelemetryQueryPort,
  TelemetryTimeRange,
} from "../../observability/src/index.ts";
import { ActionClass, preflightHatAction } from "./hat-guardrails.ts";
import type {
  PromptFlowPhaseGate,
  PromptFlowRollbackPolicy,
  PromptFlowRunState,
} from "./prompt-flow.ts";

/**
 * ZetaId rendered as a base-10 string — the canonical index for git-as-db
 * (operator idea 8). Branded so a raw string cannot be passed by accident.
 */
export type ZetaIdDecimal = string & { readonly __brand: "ZetaIdDecimal" };

export function asZetaIdDecimal(value: string): ZetaIdDecimal {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`asZetaIdDecimal: '${value}' is not a base-10 ZetaId`);
  }
  return value as ZetaIdDecimal;
}

/** Varying scopes a single run can be observed at (operator idea 5). */
export const RunScope = {
  Run: "run",
  WorkItem: "work_item",
  Initiative: "initiative",
  Project: "project",
  Organization: "organization",
} as const;

export type RunScope = (typeof RunScope)[keyof typeof RunScope];

/**
 * The run lifecycle as an explicit DU. Mirrors the V0 spine
 * (signal -> triage -> gate -> assignment -> run -> evidence -> review) so the
 * Organization's deterministic rules apply at every step (operator idea 6).
 */
export const RunLifecyclePhase = {
  Observing: "observing",
  Composing: "composing",
  AwaitingGate: "awaiting_gate",
  Executing: "executing",
  AwaitingEvidence: "awaiting_evidence",
  AwaitingReview: "awaiting_review",
  Completed: "completed",
  Blocked: "blocked",
  Failed: "failed",
} as const;

export type RunLifecyclePhase = (typeof RunLifecyclePhase)[keyof typeof RunLifecyclePhase];

/** A legal next move, with its preconditions surfaced explicitly (never buried). */
export type AvailableOption = {
  actionType: string;
  toPhase: RunLifecyclePhase;
  toScope: RunScope;
  requiresGate: boolean;
  requiresEvidence: boolean;
  rationale: string;
};

/** Trace-envelope continuity carried through every readout (repo convention). */
export type RunTrace = {
  correlationId: string;
  causationId: string;
  traceId: string;
};

/**
 * The snapshot the caller loads (from CockroachDB / git-as-db) and hands to
 * observe(). observe() never reads state itself — it is pure over this input.
 */
export type RunSnapshot = {
  runId: ZetaIdDecimal;
  scope: RunScope;
  phase: RunLifecyclePhase;
  trace: RunTrace;
  hasGateApproval: boolean;
  hasEvidence: boolean;
};

export type AgentObserveSnapshot = RunSnapshot & {
  hatAssignmentId: ZetaIdDecimal;
  hat: HatDefinition;
  agentId?: string | undefined;
  organizationId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  supervisorHatAssignmentId?: string | undefined;
};

export type VetoedOption = {
  option: AvailableOption;
  ruleName: string;
  reason: string;
};

/** The readout: current state + available options + the rules that shaped it. */
export type RunStateReadout = {
  runId: ZetaIdDecimal;
  scope: RunScope;
  phase: RunLifecyclePhase;
  trace: RunTrace;
  observedAt: string;
  options: readonly AvailableOption[];
  vetoedOptions: readonly VetoedOption[];
  deterministicRulesApplied: readonly string[];
};

export const ObserveFeedbackReason = {
  UnknownPhase: "unknown_phase",
  TerminalPhase: "terminal_phase",
  DeterministicRuleViolation: "deterministic_rule_violation",
} as const;

export type ObserveFeedbackReason = (typeof ObserveFeedbackReason)[keyof typeof ObserveFeedbackReason];

export type ObserveFeedback = {
  reason: ObserveFeedbackReason;
  message: string;
};

/** Result<T, TFeedback> as an explicit two-variant DU. */
export const ObserveOutcome = {
  Readout: "readout",
  Feedback: "feedback",
} as const;

export type ObserveOutcome = (typeof ObserveOutcome)[keyof typeof ObserveOutcome];

export type ObserveResult =
  | { outcome: typeof ObserveOutcome.Readout; readout: RunStateReadout }
  | { outcome: typeof ObserveOutcome.Feedback; feedback: ObserveFeedback };

/**
 * A deterministic organizational rule (operator idea 6). Pure predicate over a
 * candidate option + snapshot; returns a veto reason or undefined. The set of
 * rule names that ran is recorded in the readout for full visibility.
 */
export type DeterministicRule = {
  name: string;
  veto: (option: AvailableOption, snapshot: RunSnapshot) => string | undefined;
};

export type ObserveDependencies = {
  clock: { now: () => string };
  deterministicRules?: readonly DeterministicRule[];
  scheduleBlocks?: readonly WorkScheduleBlock[];
};

export const ACTION_CLASS_FOR_ACTION_TYPE: Readonly<Partial<Record<string, ActionClass>>> = {
  execute: ActionClass.WriteCode,
  request_review: ActionClass.ReviewCode,
  complete: ActionClass.ApproveReview,
  submit_evidence: ActionClass.WriteDoc,
  request_gate: ActionClass.Prioritize,
} as const;

/**
 * Explicit phase -> raw options table. The single source of truth for what
 * moves exist; adding a phase is open-for-extension, existing rows are
 * closed-for-modification (OCP applied to control flow).
 */
const PHASE_OPTIONS: Readonly<Record<RunLifecyclePhase, readonly AvailableOption[]>> = {
  [RunLifecyclePhase.Observing]: [
    { actionType: "compose", toPhase: RunLifecyclePhase.Composing, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "selection needed before any side effect" },
    { actionType: "block", toPhase: RunLifecyclePhase.Blocked, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "no legal move available" },
  ],
  [RunLifecyclePhase.Composing]: [
    { actionType: "request_gate", toPhase: RunLifecyclePhase.AwaitingGate, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: false, rationale: "ratification required before execution" },
  ],
  [RunLifecyclePhase.AwaitingGate]: [
    { actionType: "execute", toPhase: RunLifecyclePhase.Executing, toScope: RunScope.WorkItem, requiresGate: true, requiresEvidence: false, rationale: "gate must be approved to execute" },
    { actionType: "block", toPhase: RunLifecyclePhase.Blocked, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: false, rationale: "gate rejected or stalled" },
  ],
  [RunLifecyclePhase.Executing]: [
    { actionType: "submit_evidence", toPhase: RunLifecyclePhase.AwaitingEvidence, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: false, rationale: "execution produced output to attest" },
    { actionType: "fail", toPhase: RunLifecyclePhase.Failed, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "execution failed" },
  ],
  [RunLifecyclePhase.AwaitingEvidence]: [
    { actionType: "request_review", toPhase: RunLifecyclePhase.AwaitingReview, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: true, rationale: "review needs evidence" },
  ],
  [RunLifecyclePhase.AwaitingReview]: [
    { actionType: "complete", toPhase: RunLifecyclePhase.Completed, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: true, rationale: "reviewer approved" },
    { actionType: "rework", toPhase: RunLifecyclePhase.Executing, toScope: RunScope.WorkItem, requiresGate: false, requiresEvidence: false, rationale: "reviewer requested changes" },
  ],
  [RunLifecyclePhase.Completed]: [],
  [RunLifecyclePhase.Blocked]: [
    { actionType: "resume", toPhase: RunLifecyclePhase.Observing, toScope: RunScope.Run, requiresGate: false, requiresEvidence: false, rationale: "blocker resolved" },
  ],
  [RunLifecyclePhase.Failed]: [],
};

const TERMINAL_PHASES: ReadonlySet<RunLifecyclePhase> = new Set([
  RunLifecyclePhase.Completed,
  RunLifecyclePhase.Failed,
]);

/** Built-in deterministic rules that always apply (operator idea 6). */
export const DefaultDeterministicRules: readonly DeterministicRule[] = [
  {
    name: "gate-precondition",
    veto: (option, snapshot) =>
      option.requiresGate && !snapshot.hasGateApproval
        ? `option '${option.actionType}' requires an approved gate`
        : undefined,
  },
  {
    name: "evidence-precondition",
    veto: (option, snapshot) =>
      option.requiresEvidence && !snapshot.hasEvidence
        ? `option '${option.actionType}' requires submitted evidence`
        : undefined,
  },
];

export function hatAuthorityRule(hat: HatDefinition): DeterministicRule {
  return {
    name: "hat-authority",
    veto: (option) => {
      const actionClass = ACTION_CLASS_FOR_ACTION_TYPE[option.actionType];
      if (actionClass === undefined) return undefined;
      const result = preflightHatAction(hat, actionClass);
      return result.allowed ? undefined : result.reason;
    },
  };
}

export function observeAgent(snapshot: AgentObserveSnapshot, deps: ObserveDependencies): ObserveResult {
  const rules = deps.deterministicRules ?? DefaultDeterministicRules;
  const agentRules = [...rules, hatAuthorityRule(snapshot.hat), ...createOptionalScheduleRules(deps)];
  return observe(snapshot, { ...deps, deterministicRules: agentRules });
}

const SCHEDULE_BLOCK_TYPES_FOR_ACTION: Readonly<Record<string, readonly ScheduleBlockType[]>> = {
  block: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution, ScheduleBlockType.Review],
  compose: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution],
  execute: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution],
  fail: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution],
  request_gate: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution],
  request_review: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution, ScheduleBlockType.Review],
  resume: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution, ScheduleBlockType.Review],
  rework: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution, ScheduleBlockType.Review],
  submit_evidence: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution],
  complete: [ScheduleBlockType.PrioritizedWork, ScheduleBlockType.PromptFlowExecution, ScheduleBlockType.Review],
} as const;

export function scheduleAuthorityRule(
  scheduleBlocks: readonly WorkScheduleBlock[],
  evaluatedAt: string,
): DeterministicRule {
  return {
    name: "schedule-authority",
    veto: (option, snapshot) => {
      const allowedBlockTypes = SCHEDULE_BLOCK_TYPES_FOR_ACTION[option.actionType];
      if (allowedBlockTypes === undefined) return undefined;
      const hatAssignmentId = (snapshot as Partial<AgentObserveSnapshot>).hatAssignmentId;
      if (hatAssignmentId === undefined) {
        return `option '${option.actionType}' requires a hat assignment before schedule authorization`;
      }
      const activeBlocks = scheduleBlocks.filter((block) =>
        block.assignedHatAssignmentId === hatAssignmentId &&
        optionalMatches(block.assignedAgentId, (snapshot as Partial<AgentObserveSnapshot>).agentId) &&
        optionalMatches(block.organizationId, (snapshot as Partial<AgentObserveSnapshot>).organizationId) &&
        optionalMatches(block.projectId, (snapshot as Partial<AgentObserveSnapshot>).projectId) &&
        optionalMatches(block.teamId, (snapshot as Partial<AgentObserveSnapshot>).teamId) &&
        optionalMatches(block.workItemId, (snapshot as Partial<AgentObserveSnapshot>).workItemId) &&
        block.state === ScheduleBlockState.Active &&
        block.startsAt <= evaluatedAt &&
        evaluatedAt < block.endsAt
      );
      if (activeBlocks.length === 0) {
        return `option '${option.actionType}' requires a current schedule block for hat assignment ${hatAssignmentId}`;
      }
      const allowed = activeBlocks.some((block) => allowedBlockTypes.includes(block.blockType));
      return allowed
        ? undefined
        : `current schedule block type '${activeBlocks[0]?.blockType}' does not allow ${option.actionType}`;
    },
  };
}

function optionalMatches(actual: string | undefined, expected: string | undefined): boolean {
  return expected === undefined || actual === expected;
}

function createOptionalScheduleRules(deps: ObserveDependencies): readonly DeterministicRule[] {
  return deps.scheduleBlocks === undefined
    ? []
    : [scheduleAuthorityRule(deps.scheduleBlocks, deps.clock.now())];
}

export const TriAvailability = {
  True: "T",
  Neutral: "N",
  False: "F",
} as const;

export type TriAvailability = (typeof TriAvailability)[keyof typeof TriAvailability];

export type SlotImpl =
  | { kind: "command"; commandType: string; command?: unknown }
  | { kind: "mcp"; tool: string; args?: unknown; requiredSecretScopes?: readonly string[] | undefined }
  | { kind: "observe"; toScope: RunScope; menuPage?: MenuPageTarget | undefined }
  | { kind: "status"; status: GlassHaloStatusSignal }
  | { kind: "prompt_flow"; request: PromptFlowContextRequest }
  | { kind: "grammar_branch"; reason: string }
  | { kind: "rest"; reason: string };

export const ObserveCommandType = {
  LifecycleTransition: "observe.lifecycle_transition",
} as const;

export type ObserveCommandType = (typeof ObserveCommandType)[keyof typeof ObserveCommandType];

export type LifecycleTransitionCommandPayload = {
  runId: ZetaIdDecimal;
  fromPhase: RunLifecyclePhase;
  actionType: string;
  toPhase: RunLifecyclePhase;
  toScope: RunScope;
  hatAssignmentId?: ZetaIdDecimal;
};

export type Menu16Slot = {
  index: number;
  direction: string;
  label: string;
  availability: TriAvailability;
  action?: AvailableOption;
  reason?: string;
  impl?: SlotImpl;
};

export type Menu16 = {
  slots: readonly Menu16Slot[];
  page?: Menu16PageState | undefined;
};

export type RenderMenu16Options = {
  hatAssignmentId?: ZetaIdDecimal;
  promptFlows?: PromptFlowReadout;
  promptFlowPage?: number | undefined;
  status?: GlassHaloStatusContext | undefined;
  escalation?: SupervisorEscalationContext | undefined;
  escalationDisabledReason?: string | undefined;
};

export type SupervisorEscalationContext = {
  teamId: string;
  workItemId: string;
  targetHatAssignmentId: string;
  sourceLevel: SupervisorChainLevel;
  targetLevel: SupervisorChainLevel;
  toolType?: SupervisorSignalToolType | undefined;
  title?: string | undefined;
  message?: string | undefined;
};

export type GlassHaloStatusSignal = {
  kind: "glass_halo_status";
  runId: ZetaIdDecimal;
  scope: RunScope;
  phase: RunLifecyclePhase;
  observedAt: string;
  trace: RunTrace;
  legalOptionCount: number;
  vetoedOptionCount: number;
  deterministicRulesApplied: readonly string[];
  metricBlockIds: readonly string[];
  promptFlowIds: readonly string[];
  promptFlowTaskCount: number;
  vetoedPromptFlowTaskCount: number;
  hierarchy?: GlassHaloHierarchyStatus | undefined;
};

export type GlassHaloStatusContext = {
  metricBlockIds?: readonly string[] | undefined;
  promptFlowIds?: readonly string[] | undefined;
  promptFlowTaskCount?: number | undefined;
  vetoedPromptFlowTaskCount?: number | undefined;
  hierarchy?: GlassHaloHierarchyStatus | undefined;
};

export type GlassHaloHierarchyStatus = {
  level: HatLevel;
  priorityScope: HierarchyPriorityScope;
  policyViolationCount: number;
  priorityItemCount: number;
  actionCount: number;
  vetoedActionCount: number;
  missionStatus?: HierarchyMissionStatus | undefined;
  missionVariancePercent?: number | undefined;
};

export type PromptFlowPageState = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

export type Menu16PageState = {
  promptFlows?: PromptFlowPageState | undefined;
};

export type MenuPageTarget = {
  promptFlows?: number | undefined;
};

export type ActDependencies = {
  runCommand: (commandType: string, command: unknown, slot: Menu16Slot) => Promise<unknown>;
  dispatchTool: (tool: string, args: unknown, slot: Menu16Slot) => Promise<unknown>;
  loadPromptFlowContext?: ((request: PromptFlowContextRequest, slot: Menu16Slot) => Promise<PromptFlowContext>) | undefined;
  authorizeSlot?: ((slot: Menu16Slot) => Promise<SlotAuthorizationDecision>) | undefined;
};

export type SlotAuthorizationDecision =
  | { status: "allowed" }
  | { status: "denied"; reason?: string | undefined; message: string };

export const ActRejectionReason = {
  NoSelectableSlot: "no_selectable_slot",
  SlotOutOfRange: "slot_out_of_range",
  SlotNotRendered: "slot_not_rendered",
  SlotNotSelectable: "slot_not_selectable",
  MissingImplementation: "missing_implementation",
  MissingPromptFlowContextLoader: "missing_prompt_flow_context_loader",
  ControlPlaneDenied: "control_plane_denied",
  ScheduleAuthorityDenied: "schedule_authority_denied",
  UnsupportedImplementation: "unsupported_implementation",
} as const;

export type ActRejectionReason = (typeof ActRejectionReason)[keyof typeof ActRejectionReason];

export type ActResult =
  | { outcome: "dispatched"; kind: "command" | "mcp"; result: unknown }
  | { outcome: "loaded_context"; context: PromptFlowContext }
  | { outcome: "status_report"; status: GlassHaloStatusSignal }
  | { outcome: "grammar_branch_requested"; reason: string }
  | { outcome: "rested"; reason: string }
  | { outcome: "reobserve"; scope: RunScope; menuPage?: MenuPageTarget | undefined }
  | { outcome: "rejected"; reason: ActRejectionReason; message: string };

export type MetricBlock = {
  id: string;
  label: string;
  value: number | string | boolean;
  unit?: string;
};

export type ScopedReadout = {
  scope: RunScope;
  blocks: readonly MetricBlock[];
};

export type HierarchyProject = {
  projectId: string;
  organizationId: string;
  departmentId: string;
  name: string;
  status: "active" | "archived";
  trajectory: readonly MetricBlock[];
  metrics: readonly MetricBlock[];
};

export type HierarchyInitiative = {
  initiativeId: string;
  projectId: string;
  organizationId: string;
  title: string;
  status: "proposed" | "active" | "completed" | "archived";
  priorityScore?: number | undefined;
  metrics: readonly MetricBlock[];
};

export type HierarchyWorkBatch = {
  batchId: string;
  projectId: string;
  initiativeId: string;
  organizationId: string;
  title: string;
  status: "active" | "scheduled" | "blocked" | "completed" | "archived";
  priorityScore?: number | undefined;
  metrics: readonly MetricBlock[];
};

export type HierarchyWorkItem = {
  workItemId: string;
  projectId: string;
  initiativeId?: string | undefined;
  organizationId: string;
  title: string;
  state: string;
  priorityScore?: number | undefined;
  metrics: readonly MetricBlock[];
};

export type HierarchyPolicyViolation = {
  ruleName: "department-active-project-limit";
  departmentId: string;
  projectIds: readonly string[];
  reason: string;
};

export type HierarchyPriorityScope =
  | "organization_portfolio"
  | "project_trajectory"
  | "department_initiatives"
  | "initiative_execution"
  | "team_work_items"
  | "current_work_item";

export type PrioritizableHierarchyItem = {
  itemId: string;
  kind: "project" | "initiative" | "work_batch" | "work_item" | "policy_violation";
  label: string;
  scope: RunScope;
  priorityScore?: number | undefined;
  metrics: readonly MetricBlock[];
  rationale: string;
};

export type HierarchyActionKind =
  | "record_priority_decision"
  | "schedule_coordination_meeting"
  | "schedule_prioritized_work"
  | "request_staffing"
  | "send_supervisor_signal"
  | "request_status_update";

export type HierarchyAction = {
  actionId: string;
  kind: HierarchyActionKind;
  label: string;
  requiredToolBundle: ToolBundle;
  targetScope: RunScope;
  rationale: string;
};

export type VetoedHierarchyAction = {
  action: HierarchyAction;
  ruleName: "hat-tool-bundle";
  reason: string;
};

export type HierarchyMissionStatus = "on_track" | "at_risk" | "behind" | "blocked" | "complete";

export type HierarchyMissionTimeframe = {
  startsAt: string;
  targetAt: string;
};

export type HierarchyMissionMilestone = {
  milestoneId: string;
  title: string;
  targetAt: string;
  status: HierarchyMissionStatus;
  progressPercent?: number | undefined;
  metrics: readonly MetricBlock[];
};

export type HierarchyMission = {
  missionId: string;
  issuedByHatId: string;
  assignedHatId?: string | undefined;
  departmentId?: string | undefined;
  projectId?: string | undefined;
  initiativeId?: string | undefined;
  level?: HatLevel | undefined;
  goal: string;
  strategy: readonly string[];
  successCriteria: readonly string[];
  timeframe: HierarchyMissionTimeframe;
  status: HierarchyMissionStatus;
  progressPercent: number;
  metrics: readonly MetricBlock[];
  milestones: readonly HierarchyMissionMilestone[];
};

export type HierarchyMissionLagSignal = {
  id: string;
  label: string;
  value: number | string | boolean;
  unit?: string | undefined;
  severity: "at_risk" | "behind" | "blocked";
  rationale: string;
};

export type HierarchyMissionReadout = {
  mission: HierarchyMission;
  status: HierarchyMissionStatus;
  expectedProgressPercent: number;
  actualProgressPercent: number;
  variancePercent: number;
  daysRemaining: number;
  objectives: readonly string[];
  nextMilestones: readonly HierarchyMissionMilestone[];
  metrics: readonly MetricBlock[];
  lagSignals: readonly HierarchyMissionLagSignal[];
  correctiveActions: readonly HierarchyAction[];
  vetoedCorrectiveActions: readonly VetoedHierarchyAction[];
};

export type HierarchySnapshot = {
  projects: readonly HierarchyProject[];
  initiatives: readonly HierarchyInitiative[];
  workBatches?: readonly HierarchyWorkBatch[] | undefined;
  workItems?: readonly HierarchyWorkItem[] | undefined;
  missions?: readonly HierarchyMission[] | undefined;
};

export type HierarchyReadout = {
  level: HatLevel;
  projects: readonly HierarchyProject[];
  initiatives: readonly HierarchyInitiative[];
  metrics: readonly MetricBlock[];
  policyViolations: readonly HierarchyPolicyViolation[];
  priorityScope: HierarchyPriorityScope;
  priorityItems: readonly PrioritizableHierarchyItem[];
  scopedMetrics: readonly MetricBlock[];
  actions: readonly HierarchyAction[];
  vetoedActions: readonly VetoedHierarchyAction[];
  mission?: HierarchyMissionReadout | undefined;
};

export type PromptFlowToolInjection = {
  tool: string;
  args?: unknown;
  requiredSecretScopes?: readonly string[] | undefined;
};

export type PromptFlowTask = {
  taskId: string;
  workItemId: string;
  title: string;
  promptFlowId: string;
  label: string;
  scope: RunScope;
  priority: number;
  allowedHatIds?: readonly string[] | undefined;
  actionClass?: ActionClass | undefined;
  requiredToolBundles?: readonly ToolBundle[] | undefined;
  directions: readonly string[];
  toolInjections: readonly PromptFlowToolInjection[];
  metrics: readonly MetricBlock[];
  contextArtifactRefs: readonly string[];
  definitionVersion?: string | undefined;
  phaseId?: string | undefined;
  runState?: PromptFlowRunState | undefined;
  permittedUniversalActions?: readonly string[] | undefined;
  requiredEvidenceRefs?: readonly string[] | undefined;
  gate?: PromptFlowPhaseGate | undefined;
  reviewerHatIds?: readonly string[] | undefined;
  timeoutSeconds?: number | undefined;
  retryLimit?: number | undefined;
  rollbackPolicy?: PromptFlowRollbackPolicy | undefined;
};

export type VetoedPromptFlowTask = {
  task: PromptFlowTask;
  ruleName: string;
  reason: string;
};

export type PromptFlowReadout = {
  tasks: readonly PromptFlowTask[];
  vetoedTasks: readonly VetoedPromptFlowTask[];
};

export type PromptFlowContextRequest = {
  runId: ZetaIdDecimal;
  scope: RunScope;
  hatAssignmentId: ZetaIdDecimal;
  trace: RunTrace;
  taskId: string;
  workItemId: string;
  promptFlowId: string;
  directions: readonly string[];
  toolInjections: readonly PromptFlowToolInjection[];
  metrics: readonly MetricBlock[];
  contextArtifactRefs: readonly string[];
  definitionVersion?: string | undefined;
  phaseId?: string | undefined;
  runState?: PromptFlowRunState | undefined;
  permittedUniversalActions?: readonly string[] | undefined;
  requiredEvidenceRefs?: readonly string[] | undefined;
  gate?: PromptFlowPhaseGate | undefined;
  reviewerHatIds?: readonly string[] | undefined;
  timeoutSeconds?: number | undefined;
  retryLimit?: number | undefined;
  rollbackPolicy?: PromptFlowRollbackPolicy | undefined;
};

export type PromptFlowContextArtifact = {
  id: string;
  label: string;
  value: string;
};

export type PromptFlowContext = {
  taskId: string;
  promptFlowId: string;
  directions: readonly string[];
  toolInjections: readonly PromptFlowToolInjection[];
  metrics: readonly MetricBlock[];
  contextArtifacts: readonly PromptFlowContextArtifact[];
  definitionVersion?: string | undefined;
  phaseId?: string | undefined;
  runState?: PromptFlowRunState | undefined;
  permittedUniversalActions?: readonly string[] | undefined;
  requiredEvidenceRefs?: readonly string[] | undefined;
  gate?: PromptFlowPhaseGate | undefined;
  reviewerHatIds?: readonly string[] | undefined;
  timeoutSeconds?: number | undefined;
  retryLimit?: number | undefined;
  rollbackPolicy?: PromptFlowRollbackPolicy | undefined;
};

export type QueryContext = {
  runId: ZetaIdDecimal;
  scope: RunScope;
  hatAssignmentId: ZetaIdDecimal;
  trace: RunTrace;
};

export type ScopedMetricAgent = {
  id: string;
  scope: RunScope;
  compute: (ctx: QueryContext) => Promise<MetricBlock>;
};

export type CreateTelemetryScopedMetricAgentsInput = {
  telemetry: TelemetryQueryPort;
  range: TelemetryTimeRange;
};

export type AgentObserveDependencies = ObserveDependencies & {
  metricAgents?: readonly ScopedMetricAgent[];
  promptFlowTasks?: readonly PromptFlowTask[];
  promptFlowPage?: number | undefined;
  hierarchy?: HierarchySnapshot;
  availableSecretScopes?: readonly string[] | undefined;
};

export type AgentObserveResult =
  | {
      outcome: typeof ObserveOutcome.Readout;
      readout: RunStateReadout;
      actions: Menu16;
      metrics: ScopedReadout;
      promptFlows: PromptFlowReadout;
      hierarchy: HierarchyReadout;
    }
  | { outcome: typeof ObserveOutcome.Feedback; feedback: ObserveFeedback };

const MENU16_DIRECTIONS: readonly string[] = [
  "navigate.previous",
  "navigate.next",
  "navigate.context_previous",
  "navigate.context_next",
  "commit.a",
  "commit.b",
  "inspect.more",
  "branch.fork",
  "scope.out",
  "scope.in",
  "history.retract",
  "history.redo",
  "meta.refresh",
  "meta.status",
  "meta.pause",
  "meta.escalate",
];
const COMMIT_SLOT_INDICES: readonly number[] = [4, 5];
const PROMPT_FLOW_SLOT_INDICES: readonly number[] = [6];
const PROMPT_FLOW_PAGE_SIZE = PROMPT_FLOW_SLOT_INDICES.length;
const MENU16_SLOT_COUNT = 16;
const RUN_SCOPE_LADDER: readonly RunScope[] = [
  RunScope.Run,
  RunScope.WorkItem,
  RunScope.Initiative,
  RunScope.Project,
  RunScope.Organization,
];

export function renderMenu16(readout: RunStateReadout, options: RenderMenu16Options = {}): Menu16 {
  const rendered = MENU16_DIRECTIONS.map((direction, index) => createNeutralSlot(index, direction));
  const vetoesByAction = new Map(readout.vetoedOptions.map((vetoed) => [vetoed.option.actionType, vetoed]));
  const survivorsByAction = new Map(readout.options.map((option) => [option.actionType, option]));
  const orderedOptions = PHASE_OPTIONS[readout.phase] ?? [];
  let page: Menu16PageState | undefined;

  for (const [offset, option] of orderedOptions.entries()) {
    const slotIndex = COMMIT_SLOT_INDICES[offset];
    if (slotIndex === undefined) break;
    const survivor = survivorsByAction.get(option.actionType);
    const vetoed = vetoesByAction.get(option.actionType);
    if (survivor !== undefined) {
      rendered[slotIndex] = createCommandSlot(slotIndex, MENU16_DIRECTIONS[slotIndex]!, readout, survivor, options);
    } else if (vetoed !== undefined) {
      rendered[slotIndex] = createVetoedSlot(slotIndex, MENU16_DIRECTIONS[slotIndex]!, vetoed);
    }
  }
  if (readout.options.length > 0) {
    renderScopeSlots(rendered, readout.scope);
    const promptFlowPage = renderPromptFlowSlots(rendered, readout, options.promptFlows, options.hatAssignmentId, options.promptFlowPage);
    page = promptFlowPage === undefined ? undefined : { promptFlows: promptFlowPage };
  }
  if (readout.options.length > 0 || readout.vetoedOptions.length > 0) {
    renderBranchSlot(rendered);
    renderMetaSlots(rendered, readout, options.status, options.escalation, options.escalationDisabledReason);
  }
  return {
    slots: rendered,
    ...createOptionalMenuPage(page),
  };
}

function createNeutralSlot(index: number, direction: string): Menu16Slot {
  return {
    index,
    direction,
    label: "empty",
    availability: TriAvailability.Neutral,
    reason: "no action rendered for this direction",
  };
}

function createCommandSlot(
  index: number,
  direction: string,
  readout: RunStateReadout,
  option: AvailableOption,
  options: RenderMenu16Options,
): Menu16Slot {
  return {
    index,
    direction,
    label: option.actionType,
    availability: TriAvailability.True,
    action: option,
    impl: {
      kind: "command",
      commandType: ObserveCommandType.LifecycleTransition,
      command: createLifecycleTransitionCommand(readout, option, options),
    },
  };
}

function createVetoedSlot(index: number, direction: string, vetoed: VetoedOption): Menu16Slot {
  return {
    index,
    direction,
    label: vetoed.option.actionType,
    availability: TriAvailability.False,
    action: vetoed.option,
    reason: vetoed.reason,
  };
}

function renderScopeSlots(rendered: Menu16Slot[], currentScope: RunScope): void {
  const currentIndex = RUN_SCOPE_LADDER.indexOf(currentScope);
  const coarserScope = currentIndex >= 0 ? RUN_SCOPE_LADDER[currentIndex + 1] : undefined;
  const finerScope = currentIndex > 0 ? RUN_SCOPE_LADDER[currentIndex - 1] : undefined;

  rendered[8] = coarserScope === undefined
    ? createDisabledGrammarSlot(8, MENU16_DIRECTIONS[8]!, "scope out", "already at organization scope")
    : createObserveSlot(8, MENU16_DIRECTIONS[8]!, `scope out to ${coarserScope}`, coarserScope);
  rendered[9] = finerScope === undefined
    ? createDisabledGrammarSlot(9, MENU16_DIRECTIONS[9]!, "scope in", "already at run scope")
    : createObserveSlot(9, MENU16_DIRECTIONS[9]!, `scope in to ${finerScope}`, finerScope);
  rendered[10] = createDisabledGrammarSlot(10, MENU16_DIRECTIONS[10]!, "retract", "retraction is not wired for this run state");
  rendered[11] = createDisabledGrammarSlot(11, MENU16_DIRECTIONS[11]!, "redo", "redo is not wired for this run state");
}

function renderBranchSlot(rendered: Menu16Slot[]): void {
  rendered[7] = {
    index: 7,
    direction: MENU16_DIRECTIONS[7]!,
    label: "edit-grammar / branch",
    availability: TriAvailability.True,
    impl: {
      kind: "grammar_branch",
      reason: "edit-grammar/branch selected; no side effects for this tick",
    },
  };
}

function renderMetaSlots(
  rendered: Menu16Slot[],
  readout: RunStateReadout,
  statusContext: GlassHaloStatusContext | undefined,
  escalationContext: SupervisorEscalationContext | undefined,
  escalationDisabledReason: string | undefined,
): void {
  const currentScope = readout.scope;
  rendered[12] = createObserveSlot(12, MENU16_DIRECTIONS[12]!, "refresh", currentScope);
  rendered[13] = createStatusSlot(13, MENU16_DIRECTIONS[13]!, readout, statusContext);
  rendered[14] = createRestSlot(14, MENU16_DIRECTIONS[14]!);
  rendered[15] = createEscalationSlot(15, MENU16_DIRECTIONS[15]!, readout, escalationContext, escalationDisabledReason);
}

function createRestSlot(index: number, direction: string): Menu16Slot {
  return {
    index,
    direction,
    label: "free-time / rest",
    availability: TriAvailability.True,
    impl: {
      kind: "rest",
      reason: "free-time/rest selected; no side effects for this tick",
    },
  };
}

function createEscalationSlot(
  index: number,
  direction: string,
  readout: RunStateReadout,
  context: SupervisorEscalationContext | undefined,
  disabledReason: string | undefined,
): Menu16Slot {
  if (context === undefined) {
    return createDisabledGrammarSlot(
      index,
      direction,
      "escalate",
      disabledReason ?? "supervisor escalation requires team, work item, and target supervisor hat assignment",
    );
  }
  return {
    index,
    direction,
    label: `escalate to ${formatSupervisorChainLevel(context.targetLevel)}`,
    availability: TriAvailability.True,
    impl: {
      kind: "command",
      commandType: CommandType.SendSupervisorSignal,
      command: createSupervisorSignalCommand(readout, context),
    },
  };
}

function createSupervisorSignalCommand(
  readout: RunStateReadout,
  context: SupervisorEscalationContext,
): {
  targetHatAssignmentId: string;
  title: string;
  message: string;
  policyContext: {
    scope: { teamId: string; workItemId: string };
    toolType: SupervisorSignalToolType;
    supervisorChain: { sourceLevel: SupervisorChainLevel; targetLevel: SupervisorChainLevel };
  };
} {
  return {
    targetHatAssignmentId: context.targetHatAssignmentId,
    title: context.title ?? `Observe-act escalation for ${readout.scope} ${readout.phase}`,
    message: context.message ?? [
      `Agent requested supervisor triage for run ${readout.runId} at ${readout.scope}/${readout.phase}.`,
      `Legal options: ${readout.options.length}; vetoed options: ${readout.vetoedOptions.length}.`,
    ].join(" "),
    policyContext: {
      scope: {
        teamId: context.teamId,
        workItemId: context.workItemId,
      },
      toolType: context.toolType ?? SupervisorSignalToolType.RequestEscalation,
      supervisorChain: {
        sourceLevel: context.sourceLevel,
        targetLevel: context.targetLevel,
      },
    },
  };
}

function formatSupervisorChainLevel(level: SupervisorChainLevel): string {
  switch (level) {
    case SupervisorChainLevel.TeamMember:
      return "team member";
    case SupervisorChainLevel.Manager:
      return "manager";
    case SupervisorChainLevel.Director:
      return "director";
    case SupervisorChainLevel.CSuite:
      return "c-suite";
    case SupervisorChainLevel.ExecutiveBoard:
      return "executive board";
  }
}

function createStatusSlot(
  index: number,
  direction: string,
  readout: RunStateReadout,
  statusContext: GlassHaloStatusContext | undefined,
): Menu16Slot {
  return {
    index,
    direction,
    label: "status / glass-halo",
    availability: TriAvailability.True,
    impl: {
      kind: "status",
      status: createGlassHaloStatusSignal(readout, statusContext),
    },
  };
}

function createGlassHaloStatusSignal(
  readout: RunStateReadout,
  context: GlassHaloStatusContext | undefined,
): GlassHaloStatusSignal {
  return {
    kind: "glass_halo_status",
    runId: readout.runId,
    scope: readout.scope,
    phase: readout.phase,
    observedAt: readout.observedAt,
    trace: readout.trace,
    legalOptionCount: readout.options.length,
    vetoedOptionCount: readout.vetoedOptions.length,
    deterministicRulesApplied: readout.deterministicRulesApplied,
    metricBlockIds: context?.metricBlockIds ?? [],
    promptFlowIds: context?.promptFlowIds ?? [],
    promptFlowTaskCount: context?.promptFlowTaskCount ?? 0,
    vetoedPromptFlowTaskCount: context?.vetoedPromptFlowTaskCount ?? 0,
    ...createOptionalGlassHaloHierarchyStatus(context?.hierarchy),
  };
}

function createOptionalGlassHaloHierarchyStatus(
  hierarchy: GlassHaloHierarchyStatus | undefined,
): { hierarchy?: GlassHaloHierarchyStatus } {
  return hierarchy === undefined ? {} : { hierarchy };
}

function createObserveSlot(
  index: number,
  direction: string,
  label: string,
  toScope: RunScope,
  menuPage?: MenuPageTarget | undefined,
): Menu16Slot {
  return {
    index,
    direction,
    label,
    availability: TriAvailability.True,
    impl: {
      kind: "observe",
      toScope,
      ...createOptionalMenuPageTarget(menuPage),
    },
  };
}

function createDisabledGrammarSlot(
  index: number,
  direction: string,
  label: string,
  reason: string,
): Menu16Slot {
  return {
    index,
    direction,
    label,
    availability: TriAvailability.False,
    reason,
  };
}

function renderPromptFlowSlots(
  rendered: Menu16Slot[],
  readout: RunStateReadout,
  promptFlows: PromptFlowReadout | undefined,
  hatAssignmentId: ZetaIdDecimal | undefined,
  requestedPage = 0,
): PromptFlowPageState | undefined {
  if (promptFlows === undefined || hatAssignmentId === undefined) return undefined;
  const ordered = [
    ...[...promptFlows.tasks].sort(comparePromptFlowTasks),
    ...promptFlows.vetoedTasks.map((vetoed) => vetoed.task).sort(comparePromptFlowTasks),
  ];
  if (ordered.length === 0) return undefined;
  const pageCount = Math.ceil(ordered.length / PROMPT_FLOW_PAGE_SIZE);
  const page = clampPromptFlowPage(requestedPage, pageCount);
  const pageStart = page * PROMPT_FLOW_PAGE_SIZE;
  const pageTasks = ordered.slice(pageStart, pageStart + PROMPT_FLOW_PAGE_SIZE);
  const vetoesByTask = new Map(promptFlows.vetoedTasks.map((vetoed) => [vetoed.task.taskId, vetoed]));
  const allowedTaskIds = new Set(promptFlows.tasks.map((task) => task.taskId));

  for (const [offset, task] of pageTasks.entries()) {
    const slotIndex = PROMPT_FLOW_SLOT_INDICES[offset];
    if (slotIndex === undefined) break;
    if (rendered[slotIndex]?.availability !== TriAvailability.Neutral) continue;
    const direction = MENU16_DIRECTIONS[slotIndex]!;
    if (allowedTaskIds.has(task.taskId)) {
      rendered[slotIndex] = createPromptFlowSlot(slotIndex, direction, readout, task, hatAssignmentId);
    } else {
      const vetoed = vetoesByTask.get(task.taskId);
      rendered[slotIndex] = createPromptFlowVetoedSlot(slotIndex, direction, task, vetoed?.reason ?? "prompt flow is not executable by this hat");
    }
  }
  renderPromptFlowNavigationSlots(rendered, readout.scope, page, pageCount);
  return {
    page,
    pageSize: PROMPT_FLOW_PAGE_SIZE,
    pageCount,
    total: ordered.length,
  };
}

function renderPromptFlowNavigationSlots(
  rendered: Menu16Slot[],
  currentScope: RunScope,
  page: number,
  pageCount: number,
): void {
  rendered[0] = page <= 0
    ? createDisabledGrammarSlot(0, MENU16_DIRECTIONS[0]!, "previous prompt-flow page", "already at first prompt-flow page")
    : createObserveSlot(0, MENU16_DIRECTIONS[0]!, "previous prompt-flow page", currentScope, { promptFlows: page - 1 });
  rendered[1] = page >= pageCount - 1
    ? createDisabledGrammarSlot(1, MENU16_DIRECTIONS[1]!, "next prompt-flow page", "already at last prompt-flow page")
    : createObserveSlot(1, MENU16_DIRECTIONS[1]!, "next prompt-flow page", currentScope, { promptFlows: page + 1 });
}

function clampPromptFlowPage(requestedPage: number, pageCount: number): number {
  if (!Number.isInteger(requestedPage) || requestedPage < 0) return 0;
  return Math.min(requestedPage, Math.max(0, pageCount - 1));
}

function createOptionalMenuPage(page: Menu16PageState | undefined): { page?: Menu16PageState } {
  return page === undefined ? {} : { page };
}

function createOptionalMenuPageTarget(menuPage: MenuPageTarget | undefined): { menuPage?: MenuPageTarget } {
  return menuPage === undefined ? {} : { menuPage };
}

function createPromptFlowSlot(
  index: number,
  direction: string,
  readout: RunStateReadout,
  task: PromptFlowTask,
  hatAssignmentId: ZetaIdDecimal,
): Menu16Slot {
  return {
    index,
    direction,
    label: task.label,
    availability: TriAvailability.True,
    impl: {
      kind: "prompt_flow",
      request: createPromptFlowContextRequest(readout, task, hatAssignmentId),
    },
  };
}

function createPromptFlowVetoedSlot(
  index: number,
  direction: string,
  task: PromptFlowTask,
  reason: string,
): Menu16Slot {
  return {
    index,
    direction,
    label: task.label,
    availability: TriAvailability.False,
    reason,
  };
}

function createPromptFlowContextRequest(
  readout: RunStateReadout,
  task: PromptFlowTask,
  hatAssignmentId: ZetaIdDecimal,
): PromptFlowContextRequest {
  return {
    runId: readout.runId,
    scope: readout.scope,
    hatAssignmentId,
    trace: readout.trace,
    taskId: task.taskId,
    workItemId: task.workItemId,
    promptFlowId: task.promptFlowId,
    directions: task.directions,
    toolInjections: task.toolInjections,
    metrics: task.metrics,
    contextArtifactRefs: task.contextArtifactRefs,
    ...copyOptionalPromptFlowTaskMetadata(task),
  };
}

function createLifecycleTransitionCommand(
  readout: RunStateReadout,
  option: AvailableOption,
  options: RenderMenu16Options,
): LifecycleTransitionCommandPayload {
  return {
    runId: readout.runId,
    fromPhase: readout.phase,
    actionType: option.actionType,
    toPhase: option.toPhase,
    toScope: option.toScope,
    ...createOptionalHatAssignment(options.hatAssignmentId),
  };
}

function createOptionalHatAssignment(
  hatAssignmentId: ZetaIdDecimal | undefined,
): { hatAssignmentId?: ZetaIdDecimal } {
  return hatAssignmentId === undefined ? {} : { hatAssignmentId };
}

export async function act(index: number, menu: Menu16, deps: ActDependencies): Promise<ActResult> {
  if (!Number.isInteger(index) || index < 0 || index >= MENU16_SLOT_COUNT) {
    return rejectAct(ActRejectionReason.SlotOutOfRange, `slot index ${index} is outside the rendered menu`);
  }
  const slot = menu.slots[index];
  if (slot === undefined) {
    return rejectAct(ActRejectionReason.SlotNotRendered, `slot index ${index} is not rendered`);
  }
  if (slot.availability !== TriAvailability.True) {
    return rejectAct(ActRejectionReason.SlotNotSelectable, slot.reason ?? `slot ${index} is not selectable`);
  }
  if (slot.impl === undefined) {
    return rejectAct(ActRejectionReason.MissingImplementation, `slot ${index} has no implementation`);
  }
  const authorization = await deps.authorizeSlot?.(slot);
  if (authorization?.status === "denied") {
    const reason = authorization.reason === ActRejectionReason.ControlPlaneDenied
      ? ActRejectionReason.ControlPlaneDenied
      : ActRejectionReason.ScheduleAuthorityDenied;
    return rejectAct(reason, authorization.message);
  }
  switch (slot.impl.kind) {
    case "command":
      return {
        outcome: "dispatched",
        kind: "command",
        result: await deps.runCommand(slot.impl.commandType, slot.impl.command, slot),
      };
    case "mcp":
      return {
        outcome: "dispatched",
        kind: "mcp",
        result: await deps.dispatchTool(slot.impl.tool, slot.impl.args, slot),
      };
    case "observe":
      return {
        outcome: "reobserve",
        scope: slot.impl.toScope,
        ...createOptionalMenuPageTarget(slot.impl.menuPage),
      };
    case "status":
      return {
        outcome: "status_report",
        status: slot.impl.status,
      };
    case "grammar_branch":
      return {
        outcome: "grammar_branch_requested",
        reason: slot.impl.reason,
      };
    case "rest":
      return {
        outcome: "rested",
        reason: slot.impl.reason,
      };
    case "prompt_flow":
      if (deps.loadPromptFlowContext === undefined) {
        return rejectAct(ActRejectionReason.MissingPromptFlowContextLoader, `slot ${index} requires a prompt-flow context loader`);
      }
      return {
        outcome: "loaded_context",
        context: await deps.loadPromptFlowContext(slot.impl.request, slot),
      };
    default: {
      const unhandled: never = slot.impl;
      return rejectAct(ActRejectionReason.UnsupportedImplementation, `unsupported slot implementation ${(unhandled as { kind?: string }).kind}`);
    }
  }
}

export function rejectAct(reason: ActRejectionReason, message: string): ActResult {
  return { outcome: "rejected", reason, message };
}

export async function observeAgentSurface(
  snapshot: AgentObserveSnapshot,
  deps: AgentObserveDependencies,
): Promise<AgentObserveResult> {
  const observed = observeAgent(snapshot, deps);
  if (observed.outcome === ObserveOutcome.Feedback) {
    return observed;
  }
  const ctx: QueryContext = {
    runId: snapshot.runId,
    scope: snapshot.scope,
    hatAssignmentId: snapshot.hatAssignmentId,
    trace: snapshot.trace,
  };
  const matchingAgents = (deps.metricAgents ?? []).filter((agent) => agent.scope === snapshot.scope);
  const blocks = await Promise.all(matchingAgents.map((agent) => agent.compute(ctx)));
  const promptFlows = promptFlowReadoutForHat(snapshot.hat, deps.promptFlowTasks ?? [], deps.availableSecretScopes);
  const hierarchy = hierarchyReadoutForHat(snapshot.hat, deps.hierarchy, observed.readout.observedAt);
  return {
    outcome: ObserveOutcome.Readout,
    readout: observed.readout,
    actions: renderMenu16(observed.readout, {
      hatAssignmentId: snapshot.hatAssignmentId,
      promptFlows,
      promptFlowPage: deps.promptFlowPage,
      status: createGlassHaloStatusContext(blocks, promptFlows, hierarchy),
      ...createOptionalSupervisorEscalationContext(snapshot, deps.scheduleBlocks),
    }),
    metrics: {
      scope: snapshot.scope,
      blocks,
    },
    promptFlows,
    hierarchy,
  };
}

function createOptionalSupervisorEscalationContext(
  snapshot: AgentObserveSnapshot,
  scheduleBlocks: readonly WorkScheduleBlock[] | undefined,
): { escalation?: SupervisorEscalationContext; escalationDisabledReason?: string } {
  if (
    snapshot.teamId === undefined ||
    snapshot.workItemId === undefined ||
    snapshot.supervisorHatAssignmentId === undefined
  ) {
    return {};
  }
  const guardrail = preflightHatAction(snapshot.hat, ActionClass.Prioritize);
  if (!guardrail.allowed) {
    return { escalationDisabledReason: guardrail.reason };
  }
  const scheduleDenial = supervisorEscalationScheduleDenial(snapshot, scheduleBlocks);
  if (scheduleDenial !== undefined) {
    return { escalationDisabledReason: scheduleDenial };
  }
  const sourceLevel = supervisorChainLevelForHat(snapshot.hat.level);
  const targetLevel = nextSupervisorLevel(sourceLevel);
  if (targetLevel === undefined) {
    return {};
  }
  return {
    escalation: {
      teamId: snapshot.teamId,
      workItemId: snapshot.workItemId,
      targetHatAssignmentId: snapshot.supervisorHatAssignmentId,
      sourceLevel,
      targetLevel,
    },
  };
}

function supervisorEscalationScheduleDenial(
  snapshot: AgentObserveSnapshot,
  scheduleBlocks: readonly WorkScheduleBlock[] | undefined,
): string | undefined {
  if (scheduleBlocks === undefined) return undefined;
  const matchingScopeBlocks = scheduleBlocks.filter((block) =>
    block.organizationId === snapshot.organizationId &&
    block.projectId === snapshot.projectId &&
    block.assignedAgentId === snapshot.agentId &&
    block.assignedHatAssignmentId === snapshot.hatAssignmentId &&
    optionalMatches(block.teamId, snapshot.teamId) &&
    optionalMatches(block.workItemId, snapshot.workItemId)
  );
  if (matchingScopeBlocks.length === 0) {
    return "supervisor escalation requires a current schedule block for this work item";
  }
  const stateMatchedBlocks = matchingScopeBlocks.filter((block) =>
    SUPERVISOR_SIGNAL_ALLOWED_SCHEDULE_STATES.includes(block.state)
  );
  if (stateMatchedBlocks.length === 0) {
    return "current schedule block state does not allow supervisor escalation";
  }
  const allowedBlock = stateMatchedBlocks.find((block) =>
    SUPERVISOR_SIGNAL_ALLOWED_SCHEDULE_TYPES.includes(block.blockType)
  );
  return allowedBlock === undefined
    ? "current schedule block type does not allow supervisor escalation"
    : undefined;
}

const SUPERVISOR_SIGNAL_ALLOWED_SCHEDULE_STATES: readonly ScheduleBlockState[] = [
  ScheduleBlockState.Active,
  ScheduleBlockState.Scheduled,
];

const SUPERVISOR_SIGNAL_ALLOWED_SCHEDULE_TYPES: readonly ScheduleBlockType[] = [
  ScheduleBlockType.FreeTime,
  ScheduleBlockType.Meeting,
  ScheduleBlockType.PrioritizedWork,
  ScheduleBlockType.PromptFlowExecution,
  ScheduleBlockType.Reflection,
  ScheduleBlockType.Reporting,
  ScheduleBlockType.Review,
];

function supervisorChainLevelForHat(level: HatLevel): SupervisorChainLevel {
  switch (level) {
    case HatLevel.ExecutiveBoard:
      return SupervisorChainLevel.ExecutiveBoard;
    case HatLevel.CSuite:
      return SupervisorChainLevel.CSuite;
    case HatLevel.Director:
      return SupervisorChainLevel.Director;
    case HatLevel.Manager:
      return SupervisorChainLevel.Manager;
    case HatLevel.Lead:
    case HatLevel.IndividualContributor:
      return SupervisorChainLevel.TeamMember;
  }
}

function nextSupervisorLevel(level: SupervisorChainLevel): SupervisorChainLevel | undefined {
  switch (level) {
    case SupervisorChainLevel.TeamMember:
      return SupervisorChainLevel.Manager;
    case SupervisorChainLevel.Manager:
      return SupervisorChainLevel.Director;
    case SupervisorChainLevel.Director:
      return SupervisorChainLevel.CSuite;
    case SupervisorChainLevel.CSuite:
      return SupervisorChainLevel.ExecutiveBoard;
    case SupervisorChainLevel.ExecutiveBoard:
      return undefined;
  }
}

function createGlassHaloStatusContext(
  blocks: readonly MetricBlock[],
  promptFlows: PromptFlowReadout,
  hierarchy: HierarchyReadout,
): GlassHaloStatusContext {
  return {
    metricBlockIds: uniqueStrings(blocks.map((block) => block.id)),
    promptFlowIds: uniqueStrings([
      ...promptFlows.tasks.map((task) => task.promptFlowId),
      ...promptFlows.vetoedTasks.map((vetoed) => vetoed.task.promptFlowId),
    ]),
    promptFlowTaskCount: promptFlows.tasks.length,
    vetoedPromptFlowTaskCount: promptFlows.vetoedTasks.length,
    hierarchy: {
      level: hierarchy.level,
      priorityScope: hierarchy.priorityScope,
      policyViolationCount: hierarchy.policyViolations.length,
      priorityItemCount: hierarchy.priorityItems.length,
      actionCount: hierarchy.actions.length,
      vetoedActionCount: hierarchy.vetoedActions.length,
      ...(hierarchy.mission === undefined ? {} : {
        missionStatus: hierarchy.mission.status,
        missionVariancePercent: hierarchy.mission.variancePercent,
      }),
    },
  };
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function hierarchyReadoutForHat(
  hat: HatDefinition,
  hierarchy: HierarchySnapshot | undefined,
  observedAt = "1970-01-01T00:00:00.000Z",
): HierarchyReadout {
  const projects = activeProjects(hierarchy?.projects ?? []);
  const initiatives = visibleInitiatives(hierarchy?.initiatives ?? []);
  const policyViolations = departmentActiveProjectLimitViolations(projects)
    .filter((violation) => hierarchyViolationVisibleToHat(hat, violation));
  const visibleProjects = visibleProjectsForHat(hat, projects);
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.projectId));
  const visibleInitiativeRows = visibleInitiativesForHat(hat, initiatives, visibleProjectIds);
  const visibleInitiativeIds = new Set(visibleInitiativeRows.map((initiative) => initiative.initiativeId));
  const visibleWorkBatches = visibleWorkBatchesForHat(hat, hierarchy?.workBatches ?? [], visibleProjectIds, visibleInitiativeIds);
  const visibleWorkItems = visibleWorkItemsForHat(hat, hierarchy?.workItems ?? [], visibleProjectIds, visibleInitiativeIds);
  const priorityScope = hierarchyPriorityScopeForHat(hat);
  const priorityItems = prioritizableItemsForHat(
    hat,
    visibleProjects,
    visibleInitiativeRows,
    visibleWorkBatches,
    visibleWorkItems,
    policyViolations,
  );
  const actions = hierarchyActionsForHat(hat, priorityScope);
  const mission = hierarchyMissionReadoutForHat(
    hat,
    hierarchy?.missions ?? [],
    observedAt,
    visibleProjects,
    visibleInitiativeRows,
    actions.allowed,
    actions.vetoed,
  );

  return {
    level: hat.level,
    projects: visibleProjects,
    initiatives: visibleInitiativeRows,
    metrics: hierarchyMetricsForHat(hat, visibleProjects, visibleInitiativeRows),
    policyViolations,
    priorityScope,
    priorityItems,
    scopedMetrics: scopedHierarchyMetricsForHat(hat, visibleProjects, visibleInitiativeRows, visibleWorkBatches, visibleWorkItems),
    actions: actions.allowed,
    vetoedActions: actions.vetoed,
    ...createOptionalHierarchyMission(mission),
  };
}

function activeProjects(projects: readonly HierarchyProject[]): readonly HierarchyProject[] {
  return projects
    .filter((project) => project.status === "active")
    .sort((left, right) => left.projectId.localeCompare(right.projectId));
}

function visibleInitiatives(initiatives: readonly HierarchyInitiative[]): readonly HierarchyInitiative[] {
  return initiatives
    .filter((initiative) => initiative.status !== "archived")
    .sort((left, right) => left.initiativeId.localeCompare(right.initiativeId));
}

function visibleWorkBatchesForHat(
  hat: HatDefinition,
  workBatches: readonly HierarchyWorkBatch[],
  visibleProjectIds: ReadonlySet<string>,
  visibleInitiativeIds: ReadonlySet<string>,
): readonly HierarchyWorkBatch[] {
  if (hat.level === HatLevel.IndividualContributor) return [];
  return workBatches
    .filter((batch) => batch.status !== "archived")
    .filter((batch) => visibleProjectIds.has(batch.projectId) || visibleInitiativeIds.has(batch.initiativeId))
    .sort(comparePriorityRows);
}

function visibleWorkItemsForHat(
  hat: HatDefinition,
  workItems: readonly HierarchyWorkItem[],
  visibleProjectIds: ReadonlySet<string>,
  visibleInitiativeIds: ReadonlySet<string>,
): readonly HierarchyWorkItem[] {
  if (hat.level === HatLevel.IndividualContributor) return [];
  return workItems
    .filter((item) => visibleProjectIds.has(item.projectId) || (item.initiativeId !== undefined && visibleInitiativeIds.has(item.initiativeId)))
    .sort(comparePriorityRows);
}

function visibleProjectsForHat(
  hat: HatDefinition,
  projects: readonly HierarchyProject[],
): readonly HierarchyProject[] {
  switch (hat.level) {
    case HatLevel.ExecutiveBoard:
    case HatLevel.CSuite:
      return projects;
    case HatLevel.Director:
    case HatLevel.Manager:
    case HatLevel.Lead:
      return projects.filter((project) => project.departmentId === hat.departmentId);
    case HatLevel.IndividualContributor:
      return [];
  }
}

function visibleInitiativesForHat(
  hat: HatDefinition,
  initiatives: readonly HierarchyInitiative[],
  visibleProjectIds: ReadonlySet<string>,
): readonly HierarchyInitiative[] {
  switch (hat.level) {
    case HatLevel.ExecutiveBoard:
    case HatLevel.CSuite:
      return [];
    case HatLevel.Director:
    case HatLevel.Manager:
    case HatLevel.Lead:
      return initiatives.filter((initiative) => visibleProjectIds.has(initiative.projectId));
    case HatLevel.IndividualContributor:
      return [];
  }
}

function hierarchyMetricsForHat(
  hat: HatDefinition,
  projects: readonly HierarchyProject[],
  initiatives: readonly HierarchyInitiative[],
): readonly MetricBlock[] {
  switch (hat.level) {
    case HatLevel.ExecutiveBoard:
    case HatLevel.CSuite:
      return projects.flatMap((project) => project.metrics);
    case HatLevel.Director:
    case HatLevel.Manager:
    case HatLevel.Lead:
      return initiatives.flatMap((initiative) => initiative.metrics);
    case HatLevel.IndividualContributor:
      return [];
  }
}

function hierarchyPriorityScopeForHat(hat: HatDefinition): HierarchyPriorityScope {
  switch (hat.level) {
    case HatLevel.ExecutiveBoard:
      return "organization_portfolio";
    case HatLevel.CSuite:
      return "project_trajectory";
    case HatLevel.Director:
      return "department_initiatives";
    case HatLevel.Manager:
      return hat.id === "tpm" || hat.id === "senior_tpm" ? "initiative_execution" : "team_work_items";
    case HatLevel.Lead:
      return "team_work_items";
    case HatLevel.IndividualContributor:
      return "current_work_item";
  }
}

function prioritizableItemsForHat(
  hat: HatDefinition,
  projects: readonly HierarchyProject[],
  initiatives: readonly HierarchyInitiative[],
  workBatches: readonly HierarchyWorkBatch[],
  workItems: readonly HierarchyWorkItem[],
  violations: readonly HierarchyPolicyViolation[],
): readonly PrioritizableHierarchyItem[] {
  switch (hierarchyPriorityScopeForHat(hat)) {
    case "organization_portfolio":
      return [
        ...violations.map(policyViolationPriorityItem),
        ...projects.map(projectPriorityItem),
      ].sort(comparePriorityItems);
    case "project_trajectory":
      return projects.map(projectPriorityItem).sort(comparePriorityItems);
    case "department_initiatives":
      return initiatives.map(initiativePriorityItem).sort(comparePriorityItems);
    case "initiative_execution":
      return [
        ...workBatches.map(workBatchPriorityItem),
        ...workItems.map(workItemPriorityItem),
      ].sort(comparePriorityItems);
    case "team_work_items":
      return workItems.map(workItemPriorityItem).sort(comparePriorityItems);
    case "current_work_item":
      return [];
  }
}

function projectPriorityItem(project: HierarchyProject): PrioritizableHierarchyItem {
  return {
    itemId: project.projectId,
    kind: "project",
    label: project.name,
    scope: RunScope.Project,
    metrics: [...project.trajectory, ...project.metrics],
    rationale: "project trajectory belongs to executive and C-suite portfolio prioritization",
  };
}

function initiativePriorityItem(initiative: HierarchyInitiative): PrioritizableHierarchyItem {
  return {
    itemId: initiative.initiativeId,
    kind: "initiative",
    label: initiative.title,
    scope: RunScope.Initiative,
    ...optionalPriorityScore(initiative.priorityScore),
    metrics: initiative.metrics,
    rationale: "director-level priority is the ordered set of initiatives under the department's active project",
  };
}

function workBatchPriorityItem(batch: HierarchyWorkBatch): PrioritizableHierarchyItem {
  return {
    itemId: batch.batchId,
    kind: "work_batch",
    label: batch.title,
    scope: RunScope.Initiative,
    ...optionalPriorityScore(batch.priorityScore),
    metrics: batch.metrics,
    rationale: "TPM priority is driven by initiative execution batches, blockers, and dependency pressure",
  };
}

function workItemPriorityItem(workItem: HierarchyWorkItem): PrioritizableHierarchyItem {
  return {
    itemId: workItem.workItemId,
    kind: "work_item",
    label: workItem.title,
    scope: RunScope.WorkItem,
    ...optionalPriorityScore(workItem.priorityScore),
    metrics: workItem.metrics,
    rationale: "management priority can drill into ready, blocked, or aging work items",
  };
}

function policyViolationPriorityItem(violation: HierarchyPolicyViolation): PrioritizableHierarchyItem {
  return {
    itemId: violation.departmentId,
    kind: "policy_violation",
    label: violation.reason,
    scope: RunScope.Organization,
    priorityScore: 1_000,
    metrics: [{ id: "policy.active_projects", label: "active projects", value: violation.projectIds.length }],
    rationale: "policy violations outrank ordinary project sequencing until the org shape is legal",
  };
}

function optionalPriorityScore(priorityScore: number | undefined): { priorityScore?: number } {
  return priorityScore === undefined ? {} : { priorityScore };
}

function scopedHierarchyMetricsForHat(
  hat: HatDefinition,
  projects: readonly HierarchyProject[],
  initiatives: readonly HierarchyInitiative[],
  workBatches: readonly HierarchyWorkBatch[],
  workItems: readonly HierarchyWorkItem[],
): readonly MetricBlock[] {
  switch (hierarchyPriorityScopeForHat(hat)) {
    case "organization_portfolio":
    case "project_trajectory":
      return projects.flatMap((project) => [...project.trajectory, ...project.metrics]);
    case "department_initiatives":
      return initiatives.flatMap((initiative) => initiative.metrics);
    case "initiative_execution":
      return [
        ...workBatches.flatMap((batch) => batch.metrics),
        ...workItems.flatMap((item) => item.metrics),
      ];
    case "team_work_items":
      return workItems.flatMap((item) => item.metrics);
    case "current_work_item":
      return [];
  }
}

function hierarchyActionsForHat(
  hat: HatDefinition,
  priorityScope: HierarchyPriorityScope,
): { allowed: readonly HierarchyAction[]; vetoed: readonly VetoedHierarchyAction[] } {
  const actions = candidateHierarchyActions(priorityScope);
  const allowed: HierarchyAction[] = [];
  const vetoed: VetoedHierarchyAction[] = [];
  for (const action of actions) {
    if (hat.allowedToolBundles.includes(action.requiredToolBundle)) {
      allowed.push(action);
    } else {
      vetoed.push({
        action,
        ruleName: "hat-tool-bundle",
        reason: `hat "${hat.id}" lacks the "${action.requiredToolBundle}" tool bundle required for hierarchy action "${action.kind}"`,
      });
    }
  }
  return { allowed, vetoed };
}

function candidateHierarchyActions(priorityScope: HierarchyPriorityScope): readonly HierarchyAction[] {
  switch (priorityScope) {
    case "organization_portfolio":
      return [
        hierarchyAction("record_priority_decision", ToolBundle.Voting, RunScope.Organization, "Record org priority decision"),
        hierarchyAction("schedule_coordination_meeting", ToolBundle.Meeting, RunScope.Organization, "Schedule executive coordination meeting"),
        hierarchyAction("request_status_update", ToolBundle.Status, RunScope.Organization, "Request C-suite trajectory update"),
      ];
    case "project_trajectory":
      return [
        hierarchyAction("record_priority_decision", ToolBundle.PortfolioAndInitiative, RunScope.Project, "Record portfolio priority decision"),
        hierarchyAction("schedule_coordination_meeting", ToolBundle.Meeting, RunScope.Project, "Schedule trajectory review"),
        hierarchyAction("request_status_update", ToolBundle.Status, RunScope.Project, "Request director status update"),
      ];
    case "department_initiatives":
      return [
        hierarchyAction("record_priority_decision", ToolBundle.Project, RunScope.Initiative, "Rank department initiatives"),
        hierarchyAction("request_staffing", ToolBundle.HatAuthorization, RunScope.Project, "Request staffing or hat supply"),
        hierarchyAction("schedule_coordination_meeting", ToolBundle.Meeting, RunScope.Project, "Schedule department initiative review"),
      ];
    case "initiative_execution":
      return [
        hierarchyAction("record_priority_decision", ToolBundle.BacklogAndDefect, RunScope.Initiative, "Rank work batches and blockers"),
        hierarchyAction("schedule_coordination_meeting", ToolBundle.Meeting, RunScope.Initiative, "Schedule coordination meeting"),
        hierarchyAction("schedule_prioritized_work", ToolBundle.TeamRuntime, RunScope.WorkItem, "Schedule prioritized work block"),
        hierarchyAction("send_supervisor_signal", ToolBundle.Messaging, RunScope.Initiative, "Escalate blocker or dependency"),
      ];
    case "team_work_items":
      return [
        hierarchyAction("schedule_coordination_meeting", ToolBundle.Meeting, RunScope.WorkItem, "Coordinate team execution"),
        hierarchyAction("schedule_prioritized_work", ToolBundle.TeamRuntime, RunScope.WorkItem, "Schedule prioritized work"),
        hierarchyAction("send_supervisor_signal", ToolBundle.Messaging, RunScope.WorkItem, "Escalate team blocker"),
      ];
    case "current_work_item":
      return [
        hierarchyAction("send_supervisor_signal", ToolBundle.Messaging, RunScope.WorkItem, "Raise blocker on current work"),
      ];
  }
}

function hierarchyAction(
  kind: HierarchyActionKind,
  requiredToolBundle: ToolBundle,
  targetScope: RunScope,
  label: string,
): HierarchyAction {
  return {
    actionId: `hierarchy.${kind}.${targetScope}`,
    kind,
    label,
    requiredToolBundle,
    targetScope,
    rationale: `requires ${requiredToolBundle} authority at ${targetScope} scope`,
  };
}

function comparePriorityItems(left: PrioritizableHierarchyItem, right: PrioritizableHierarchyItem): number {
  return (right.priorityScore ?? 0) - (left.priorityScore ?? 0) || left.itemId.localeCompare(right.itemId);
}

function comparePriorityRows<T extends { priorityScore?: number | undefined }>(left: T, right: T): number {
  return (right.priorityScore ?? 0) - (left.priorityScore ?? 0);
}

function departmentActiveProjectLimitViolations(
  projects: readonly HierarchyProject[],
): readonly HierarchyPolicyViolation[] {
  const byDepartment = new Map<string, string[]>();
  for (const project of projects) {
    const existing = byDepartment.get(project.departmentId) ?? [];
    existing.push(project.projectId);
    byDepartment.set(project.departmentId, existing);
  }
  return [...byDepartment.entries()]
    .filter(([, projectIds]) => projectIds.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([departmentId, projectIds]) => ({
      ruleName: "department-active-project-limit" as const,
      departmentId,
      projectIds: projectIds.sort(),
      reason: `department "${departmentId}" has ${projectIds.length} active projects; departments may run exactly one active project at a time`,
    }));
}

function hierarchyViolationVisibleToHat(hat: HatDefinition, violation: HierarchyPolicyViolation): boolean {
  switch (hat.level) {
    case HatLevel.ExecutiveBoard:
    case HatLevel.CSuite:
      return true;
    case HatLevel.Director:
    case HatLevel.Manager:
    case HatLevel.Lead:
      return violation.departmentId === hat.departmentId;
    case HatLevel.IndividualContributor:
      return false;
  }
}

function hierarchyMissionReadoutForHat(
  hat: HatDefinition,
  missions: readonly HierarchyMission[],
  observedAt: string,
  projects: readonly HierarchyProject[],
  initiatives: readonly HierarchyInitiative[],
  actions: readonly HierarchyAction[],
  vetoedActions: readonly VetoedHierarchyAction[],
): HierarchyMissionReadout | undefined {
  if (!isManagementHat(hat)) return undefined;
  const mission = mostSpecificMissionForHat(hat, missions, projects, initiatives);
  if (mission === undefined) return undefined;

  const expectedProgressPercent = expectedMissionProgressPercent(mission.timeframe, observedAt);
  const actualProgressPercent = clampPercent(mission.progressPercent);
  const variancePercent = actualProgressPercent - expectedProgressPercent;
  const daysRemaining = missionDaysRemaining(mission.timeframe, observedAt);
  const lagSignals = missionLagSignals(mission, expectedProgressPercent, actualProgressPercent, daysRemaining);
  const status = missionStatus(mission.status, lagSignals);
  const corrective = missionCorrectiveActions(status, actions, vetoedActions);

  return {
    mission,
    status,
    expectedProgressPercent,
    actualProgressPercent,
    variancePercent,
    daysRemaining,
    objectives: mission.strategy,
    nextMilestones: mission.milestones
      .filter((milestone) => milestone.status !== "complete")
      .sort((left, right) => Date.parse(left.targetAt) - Date.parse(right.targetAt) || left.milestoneId.localeCompare(right.milestoneId)),
    metrics: [...mission.metrics, ...mission.milestones.flatMap((milestone) => milestone.metrics)],
    lagSignals,
    correctiveActions: corrective.allowed,
    vetoedCorrectiveActions: corrective.vetoed,
  };
}

function createOptionalHierarchyMission(
  mission: HierarchyMissionReadout | undefined,
): { mission?: HierarchyMissionReadout } {
  return mission === undefined ? {} : { mission };
}

function isManagementHat(hat: HatDefinition): boolean {
  return hat.level !== HatLevel.IndividualContributor;
}

function mostSpecificMissionForHat(
  hat: HatDefinition,
  missions: readonly HierarchyMission[],
  projects: readonly HierarchyProject[],
  initiatives: readonly HierarchyInitiative[],
): HierarchyMission | undefined {
  const visibleProjectIds = new Set(projects.map((project) => project.projectId));
  const visibleInitiativeIds = new Set(initiatives.map((initiative) => initiative.initiativeId));
  return missions
    .map((mission) => ({ mission, score: missionSpecificityScore(hat, mission, visibleProjectIds, visibleInitiativeIds) }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        Date.parse(left.mission.timeframe.targetAt) - Date.parse(right.mission.timeframe.targetAt) ||
        left.mission.missionId.localeCompare(right.mission.missionId),
    )
    .at(0)?.mission;
}

function missionSpecificityScore(
  hat: HatDefinition,
  mission: HierarchyMission,
  visibleProjectIds: ReadonlySet<string>,
  visibleInitiativeIds: ReadonlySet<string>,
): number {
  if (mission.assignedHatId !== undefined && mission.assignedHatId !== hat.id) return 0;
  if (mission.departmentId !== undefined && mission.departmentId !== hat.departmentId) return 0;
  if (mission.level !== undefined && mission.level !== hat.level) return 0;
  if (mission.projectId !== undefined && !visibleProjectIds.has(mission.projectId)) return 0;
  if (mission.initiativeId !== undefined && !visibleInitiativeIds.has(mission.initiativeId)) return 0;

  let score = 1;
  if (mission.assignedHatId === hat.id) score += 1_000;
  if (mission.departmentId === hat.departmentId) score += 300;
  if (mission.level === hat.level) score += 200;
  if (mission.projectId !== undefined) score += 100;
  if (mission.initiativeId !== undefined) score += 50;
  return score;
}

function expectedMissionProgressPercent(timeframe: HierarchyMissionTimeframe, observedAt: string): number {
  const start = Date.parse(timeframe.startsAt);
  const target = Date.parse(timeframe.targetAt);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(start) || !Number.isFinite(target) || !Number.isFinite(observed)) return 0;
  if (target <= start) return observed >= target ? 100 : 0;
  return Math.floor(clampPercent(((observed - start) / (target - start)) * 100));
}

function missionDaysRemaining(timeframe: HierarchyMissionTimeframe, observedAt: string): number {
  const target = Date.parse(timeframe.targetAt);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(target) || !Number.isFinite(observed)) return 0;
  return Math.ceil((target - observed) / (24 * 60 * 60 * 1000));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function missionLagSignals(
  mission: HierarchyMission,
  expectedProgressPercent: number,
  actualProgressPercent: number,
  daysRemaining: number,
): readonly HierarchyMissionLagSignal[] {
  const signals: HierarchyMissionLagSignal[] = [];
  const variance = actualProgressPercent - expectedProgressPercent;
  if (mission.status === "blocked") {
    signals.push({
      id: "mission.status_blocked",
      label: "mission status",
      value: mission.status,
      severity: "blocked",
      rationale: "the mission is explicitly marked blocked",
    });
  }
  if (mission.status === "behind") {
    signals.push({
      id: "mission.status_behind",
      label: "mission status",
      value: mission.status,
      severity: "behind",
      rationale: "the mission is explicitly marked behind",
    });
  }
  if (variance < -10) {
    signals.push({
      id: "mission.progress_variance",
      label: "progress variance",
      value: variance,
      unit: "pct",
      severity: variance < -25 ? "behind" : "at_risk",
      rationale: "actual mission progress is below expected progress for the elapsed timeframe",
    });
  }
  if (daysRemaining < 0 && mission.status !== "complete") {
    signals.push({
      id: "mission.target_missed",
      label: "days past target",
      value: Math.abs(daysRemaining),
      unit: "day",
      severity: "behind",
      rationale: "the mission target date has passed without completion",
    });
  }
  for (const milestone of mission.milestones) {
    if (milestone.status === "blocked" || milestone.status === "behind") {
      signals.push({
        id: `mission.milestone.${milestone.milestoneId}`,
        label: milestone.title,
        value: milestone.status,
        severity: milestone.status,
        rationale: `milestone "${milestone.milestoneId}" is ${milestone.status}`,
      });
    }
  }
  return signals;
}

function missionStatus(
  declared: HierarchyMissionStatus,
  lagSignals: readonly HierarchyMissionLagSignal[],
): HierarchyMissionStatus {
  if (declared === "complete") return "complete";
  if (lagSignals.some((signal) => signal.severity === "blocked")) return "blocked";
  if (lagSignals.some((signal) => signal.severity === "behind")) return "behind";
  if (lagSignals.some((signal) => signal.severity === "at_risk")) return "at_risk";
  return declared;
}

function missionCorrectiveActions(
  status: HierarchyMissionStatus,
  actions: readonly HierarchyAction[],
  vetoedActions: readonly VetoedHierarchyAction[],
): { allowed: readonly HierarchyAction[]; vetoed: readonly VetoedHierarchyAction[] } {
  if (status !== "at_risk" && status !== "behind" && status !== "blocked") {
    return { allowed: [], vetoed: [] };
  }
  const correctiveKinds: ReadonlySet<HierarchyActionKind> = new Set([
    "request_staffing",
    "schedule_coordination_meeting",
    "schedule_prioritized_work",
    "send_supervisor_signal",
    "request_status_update",
  ]);
  return {
    allowed: actions.filter((action) => correctiveKinds.has(action.kind)),
    vetoed: vetoedActions.filter((vetoed) => correctiveKinds.has(vetoed.action.kind)),
  };
}

export function promptFlowReadoutForHat(
  hat: HatDefinition,
  tasks: readonly PromptFlowTask[],
  availableSecretScopes?: readonly string[] | undefined,
): PromptFlowReadout {
  const allowed: PromptFlowTask[] = [];
  const vetoedTasks: VetoedPromptFlowTask[] = [];
  for (const task of tasks) {
    const veto = firstPromptFlowTaskVeto(hat, task, availableSecretScopes);
    if (veto === undefined) {
      allowed.push(task);
    } else {
      vetoedTasks.push({ task, ruleName: veto.ruleName, reason: veto.reason });
    }
  }
  return {
    tasks: allowed.sort(comparePromptFlowTasks),
    vetoedTasks: vetoedTasks.sort((left, right) => comparePromptFlowTasks(left.task, right.task)),
  };
}

function firstPromptFlowTaskVeto(
  hat: HatDefinition,
  task: PromptFlowTask,
  availableSecretScopes: readonly string[] | undefined,
): { ruleName: string; reason: string } | undefined {
  if (task.allowedHatIds !== undefined && !task.allowedHatIds.includes(hat.id)) {
    return {
      ruleName: "prompt-flow-allowed-hat",
      reason: `hat "${hat.id}" is not in allowed hats [${task.allowedHatIds.join(", ")}] for prompt flow "${task.promptFlowId}"`,
    };
  }
  if (task.actionClass !== undefined) {
    const result = preflightHatAction(hat, task.actionClass);
    if (!result.allowed) {
      return { ruleName: "hat-authority", reason: result.reason };
    }
  }
  for (const required of task.requiredToolBundles ?? []) {
    if (!hat.allowedToolBundles.includes(required)) {
      return {
        ruleName: "hat-tool-bundle",
        reason: `hat "${hat.id}" lacks the "${required}" tool bundle required to run prompt flow "${task.promptFlowId}"`,
      };
    }
  }
  const missingSecretScopes = requiredSecretScopesForPromptFlowTask(task)
    .filter((scope) => !(availableSecretScopes ?? []).includes(scope));
  if (missingSecretScopes.length > 0) {
    return {
      ruleName: "prompt-flow-secret-scope",
      reason: `prompt flow "${task.promptFlowId}" requires unavailable secret scope(s): ${missingSecretScopes.join(", ")}`,
    };
  }
  return undefined;
}

function requiredSecretScopesForPromptFlowTask(task: PromptFlowTask): readonly string[] {
  return uniqueStrings(task.toolInjections.flatMap((injection) => injection.requiredSecretScopes ?? []));
}

function copyOptionalPromptFlowTaskMetadata(task: PromptFlowTask): Partial<PromptFlowContextRequest> {
  return {
    ...(task.definitionVersion !== undefined ? { definitionVersion: task.definitionVersion } : {}),
    ...(task.phaseId !== undefined ? { phaseId: task.phaseId } : {}),
    ...(task.runState !== undefined ? { runState: task.runState } : {}),
    ...(task.permittedUniversalActions !== undefined ? { permittedUniversalActions: task.permittedUniversalActions } : {}),
    ...(task.requiredEvidenceRefs !== undefined ? { requiredEvidenceRefs: task.requiredEvidenceRefs } : {}),
    ...(task.gate !== undefined ? { gate: task.gate } : {}),
    ...(task.reviewerHatIds !== undefined ? { reviewerHatIds: task.reviewerHatIds } : {}),
    ...(task.timeoutSeconds !== undefined ? { timeoutSeconds: task.timeoutSeconds } : {}),
    ...(task.retryLimit !== undefined ? { retryLimit: task.retryLimit } : {}),
    ...(task.rollbackPolicy !== undefined ? { rollbackPolicy: task.rollbackPolicy } : {}),
  };
}

function comparePromptFlowTasks(left: PromptFlowTask, right: PromptFlowTask): number {
  return right.priority - left.priority || left.taskId.localeCompare(right.taskId);
}

export function createTelemetryScopedMetricAgents(
  input: CreateTelemetryScopedMetricAgentsInput,
): readonly ScopedMetricAgent[] {
  return Object.values(RunScope).flatMap((scope) => [
    createTelemetryCommandCountAgent(scope, input),
    createTelemetryTraceCountAgent(scope, input),
    createTelemetryWarningLogCountAgent(scope, input),
  ]);
}

function createTelemetryCommandCountAgent(
  scope: RunScope,
  input: CreateTelemetryScopedMetricAgentsInput,
): ScopedMetricAgent {
  return {
    id: `telemetry.command_total.${scope}`,
    scope,
    compute: async () => {
      const result = await input.telemetry.queryMetrics(`sum(org_command_total{agentic_scope="${scope}"})`, input.range);
      if (result.status === "degraded") {
        return telemetryDegradedMetricBlock("telemetry.command_total", "commands in range", result);
      }
      return {
        id: "telemetry.command_total",
        label: "commands in range",
        value: sumLatestMetricValues(result.data),
        unit: "count",
      };
    },
  };
}

function createTelemetryTraceCountAgent(
  scope: RunScope,
  input: CreateTelemetryScopedMetricAgentsInput,
): ScopedMetricAgent {
  return {
    id: `telemetry.trace_count.${scope}`,
    scope,
    compute: async () => {
      const result = await input.telemetry.queryTraces(`{ agentic.scope = "${scope}" }`, input.range);
      if (result.status === "degraded") {
        return telemetryDegradedMetricBlock("telemetry.trace_count", "traces in range", result);
      }
      return {
        id: "telemetry.trace_count",
        label: "traces in range",
        value: result.data.length,
        unit: "trace",
      };
    },
  };
}

function createTelemetryWarningLogCountAgent(
  scope: RunScope,
  input: CreateTelemetryScopedMetricAgentsInput,
): ScopedMetricAgent {
  return {
    id: `telemetry.warning_log_count.${scope}`,
    scope,
    compute: async () => {
      const result = await input.telemetry.queryLogs(
        `{app="agentic-org-worker", agentic_scope="${scope}", level=~"warn|error"}`,
        input.range,
      );
      if (result.status === "degraded") {
        return telemetryDegradedMetricBlock("telemetry.warning_log_count", "warning logs in range", result);
      }
      return {
        id: "telemetry.warning_log_count",
        label: "warning logs in range",
        value: result.data.length,
        unit: "log",
      };
    },
  };
}

function telemetryDegradedMetricBlock(
  id: string,
  label: string,
  result: TelemetryQueryDegraded,
): MetricBlock {
  return {
    id,
    label,
    value: "degraded",
    unit: `${result.source}:${result.reason}`,
  };
}

function sumLatestMetricValues(series: readonly MetricSeries[]): number {
  return series.reduce((total, item) => total + (item.points.at(-1)?.value ?? 0), 0);
}

/**
 * The keystone read. Pure over the snapshot; holds no memory. Returns the
 * current state and the options that survive every deterministic rule. If every
 * raw option is vetoed, the readout still surfaces the disabled menu and veto
 * reasons so the agent can see the legal boundary it hit.
 */
export function observe(snapshot: RunSnapshot, deps: ObserveDependencies): ObserveResult {
  const rawOptions = PHASE_OPTIONS[snapshot.phase];
  if (rawOptions === undefined) {
    return {
      outcome: ObserveOutcome.Feedback,
      feedback: { reason: ObserveFeedbackReason.UnknownPhase, message: `unknown run phase '${snapshot.phase}'` },
    };
  }

  const rules = deps.deterministicRules ?? DefaultDeterministicRules;
  const surviving: AvailableOption[] = [];
  const vetoedOptions: VetoedOption[] = [];
  for (const option of rawOptions) {
    const veto = firstVeto(option, snapshot, rules);
    if (veto === undefined) {
      surviving.push(option);
    } else {
      vetoedOptions.push({ option, ruleName: veto.ruleName, reason: veto.reason });
    }
  }

  if (TERMINAL_PHASES.has(snapshot.phase)) {
    return {
      outcome: ObserveOutcome.Feedback,
      feedback: { reason: ObserveFeedbackReason.TerminalPhase, message: `run ${snapshot.runId} is terminal at '${snapshot.phase}'` },
    };
  }

  return {
    outcome: ObserveOutcome.Readout,
    readout: {
      runId: snapshot.runId,
      scope: snapshot.scope,
      phase: snapshot.phase,
      trace: snapshot.trace,
      observedAt: deps.clock.now(),
      options: surviving,
      vetoedOptions,
      deterministicRulesApplied: rules.map((rule) => rule.name),
    },
  };
}

function firstVeto(
  option: AvailableOption,
  snapshot: RunSnapshot,
  rules: readonly DeterministicRule[],
): { ruleName: string; reason: string } | undefined {
  for (const rule of rules) {
    const reason = rule.veto(option, snapshot);
    if (reason !== undefined) {
      return { ruleName: rule.name, reason };
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Ephemeral, memoryless composer (operator idea 5: the intelligence) */
/* ------------------------------------------------------------------ */

export type ComposerSelectionRequest = {
  /** The whole readout — everything the composer needs is in the argument. */
  readout: RunStateReadout;
  telemetry?: {
    hat?: string;
    model?: string;
  };
};

export const ComposerDecision = {
  Select: "select",
  Hold: "hold",
} as const;

export type ComposerDecision = (typeof ComposerDecision)[keyof typeof ComposerDecision];

export type ComposerSelection =
  | { decision: typeof ComposerDecision.Select; option: AvailableOption; reason: string }
  | { decision: typeof ComposerDecision.Hold; reason: string };

/**
 * The composer is a pure function of the request. No constructor state, no
 * memory across calls. An LLM-backed composer must put all of its context
 * INTO the request (the readout), never into instance memory.
 */
export interface EphemeralComposerPort {
  compose: (request: ComposerSelectionRequest) => ComposerSelection;
}

export const DecideOutcome = {
  Selected: "selected",
  Held: "held",
  Feedback: "feedback",
} as const;

export type DecideOutcome = (typeof DecideOutcome)[keyof typeof DecideOutcome];

export type DecideResult =
  | { outcome: typeof DecideOutcome.Selected; readout: RunStateReadout; selection: { option: AvailableOption; reason: string } }
  | { outcome: typeof DecideOutcome.Held; readout: RunStateReadout; reason: string }
  | { outcome: typeof DecideOutcome.Feedback; feedback: ObserveFeedback };

/**
 * Compose observe() with a memoryless composer. The composer may only pick from
 * the surviving options the readout exposes; a selection outside that set is
 * rejected as a deterministic-rule violation (the composer cannot escape the
 * rules — it only selects within them).
 */
export function decide(
  snapshot: RunSnapshot,
  composer: EphemeralComposerPort,
  deps: ObserveDependencies,
): DecideResult {
  const observed = observe(snapshot, deps);
  if (observed.outcome === ObserveOutcome.Feedback) {
    return { outcome: DecideOutcome.Feedback, feedback: observed.feedback };
  }
  return resolveSelection(observed.readout, composer.compose({ readout: observed.readout }));
}

/** Async sibling of the EphemeralComposerPort — for backends that do I/O (real model calls). */
export interface AsyncEphemeralComposerPort {
  compose: (request: ComposerSelectionRequest) => Promise<ComposerSelection>;
}

/**
 * Async sibling of decide(): identical deterministic guardrail (same observe()
 * + same legality enforcement via resolveSelection), but the composer may be
 * asynchronous (e.g. an LLM call). The model still cannot escape the rules — an
 * out-of-set choice is rejected exactly as in the synchronous path.
 */
export async function decideAsync(
  snapshot: RunSnapshot,
  composer: AsyncEphemeralComposerPort,
  deps: ObserveDependencies,
  requestTelemetry?: ComposerSelectionRequest["telemetry"],
): Promise<DecideResult> {
  const observed = observe(snapshot, deps);
  if (observed.outcome === ObserveOutcome.Feedback) {
    return { outcome: DecideOutcome.Feedback, feedback: observed.feedback };
  }
  return resolveSelection(observed.readout, await composer.compose({ readout: observed.readout, ...createOptionalRequestTelemetry(requestTelemetry) }));
}

function createOptionalRequestTelemetry(
  telemetry: ComposerSelectionRequest["telemetry"] | undefined,
): { telemetry?: NonNullable<ComposerSelectionRequest["telemetry"]> } {
  return telemetry === undefined ? {} : { telemetry };
}

/**
 * Shared legality enforcement for both decide paths: a Hold passes through; a
 * Select is admitted only if the option is in the readout's surviving set —
 * otherwise it is rejected as a deterministic-rule violation. This is the single
 * choke point that guarantees no composer (sync, async, or LLM) escapes the rules.
 */
function resolveSelection(readout: RunStateReadout, selection: ComposerSelection): DecideResult {
  if (selection.decision === ComposerDecision.Hold) {
    return { outcome: DecideOutcome.Held, readout, reason: selection.reason };
  }
  const isLegal = readout.options.some(
    (option) => option.actionType === selection.option.actionType && option.toPhase === selection.option.toPhase,
  );
  if (!isLegal) {
    return {
      outcome: DecideOutcome.Feedback,
      feedback: {
        reason: ObserveFeedbackReason.DeterministicRuleViolation,
        message: `composer selected illegal option '${selection.option.actionType}' not in the readout`,
      },
    };
  }
  return { outcome: DecideOutcome.Selected, readout, selection: { option: selection.option, reason: selection.reason } };
}
