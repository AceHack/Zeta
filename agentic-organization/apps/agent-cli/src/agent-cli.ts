import { createHash } from "node:crypto";

import {
  act,
  ActionClass,
  ActRejectionReason,
  asZetaIdDecimal,
  authorityScopeOf,
  authoritySubtree,
  buildHatDefinitions,
  compilePromptFlowTasks,
  createTelemetryScopedMetricAgents,
  decideContextPackRefresh,
  lintPromptFlowDefinition,
  listContextPackAttentionLaneDescriptors,
  listContextPackCurationProfileDescriptors,
  listTenantContextPackCompletenessRequirementSetDescriptors,
  listTenantContextPackSynthesisRequirementSetDescriptors,
  previewTenantContextPackCompletenessPolicy,
  previewTenantContextPackSynthesisRequirementPolicy,
  rejectAct,
  type DeterministicRule,
  observeAgentSurface,
  ObserveCommandType,
  ObserveOutcome,
  previewTenantContextPackCurationPolicy,
  PromptFlowGateKind,
  PromptFlowRunState,
  RuntimeLeaseState,
  RunLifecyclePhase,
  RunScope,
  TriAvailability,
  WorkMarketQuorumOutcome,
  WorkClaimState,
  WorkShardState,
  type ActDependencies,
  type ActResult,
  type AgentObserveSnapshot,
  type ChatCompletionPort,
  type ChatCompletionResult,
  ContextPackAdvisoryPromotionDecisionStatus,
  type ContextPackAdvisoryPromotionDecision,
  type ContextPackAdvisoryPromotionDecisionReadPort,
  type ContextPackAdvisoryPromotionFingerprint,
  type ContextPackAdvisoryPromotionPolicyRequest,
  type ContextPackBuilderPort,
  type ContextPackBuildRequest,
  type ContextPackCompletenessPolicyRequest,
  type ContextPackCompletenessPolicyResult,
  type ContextPackCurationPlan,
  type ContextPackCurationIntent,
  ContextPackInboxAnchorStatus,
  ContextPackInboxWorkflowActionKind,
  type ContextPackInboxWorkflowView,
  type ContextPackInboxWorkflowActionKind as ContextPackInboxWorkflowActionKindType,
  type ContextPackReadinessPolicyPort,
  type ContextPackSynthesisRequirement,
  type ContextPackSynthesisRequirementPolicyRequest,
  type ContextPackSnapshotRecord,
  type ContextPackSnapshotStorePort,
  type ContextPackRefreshDecision,
  ContextPackAttentionLaneRefKind,
  type ContextPackAttentionLaneRef,
  type ContextPackAttentionLaneKind,
  type ContextPackItem,
  ContextPackItemKind,
  ContextPackSourcePointerKind,
  type ContextPackSourcePointer,
  type ContextReadout,
  contextPackAdvisoryPromotionFingerprint,
  type HierarchyInitiative,
  type HierarchyMission,
  type HierarchyMissionMilestone,
  type HierarchyProject,
  type HierarchyReadout,
  type HierarchySnapshot,
  type HierarchyWorkBatch,
  type HierarchyWorkItem,
  type LifecycleTransitionCommandPayload,
  type Menu16,
  type Menu16Slot,
  type MetricBlock,
  type GlassHaloStatusSignal,
  type HatWorkQueue,
  type PromptFlowContext,
  type PromptFlowContextArtifact,
  type PromptFlowContextRequest,
  type PromptFlowDefinition,
  type PromptFlowPhaseDefinition,
  type PromptFlowPhaseGate,
  type PromptFlowReadout,
  type PromptFlowRun,
  type PromptFlowTask,
  type PromptFlowToolInjection,
  type ScopedMetricAgent,
  type ScopedReadout,
  type WorkMarketReadout,
  type WorkMarketScope,
  workMarketReadoutForHat,
} from "../../../packages/application/src/index.ts";
import {
  CommandType,
  HatLevel,
  isTenantContextPackCurationInstruction,
  isTenantContextPackCurationLaneKind,
  isTenantContextPackCurationProfileId,
  TenantContextPackCompletenessRequirementSetId,
  TenantContextPackSynthesisRequirementSetId,
  ToolBundle,
  type TenantContextPackCompletenessPolicy,
  type TenantContextPackCompletenessRequirementSetId as TenantContextPackCompletenessRequirementSetIdType,
  type TenantContextPackCurationInstruction,
  type TenantContextPackCurationLaneKind,
  type TenantContextPackCurationPolicy,
  type TenantContextPackCurationProfileId,
  type TenantContextPackSynthesisRequirementPolicy,
  type TenantContextPackSynthesisRequirementSetId as TenantContextPackSynthesisRequirementSetIdType,
  type ToolBundle as ToolBundleName,
  type WorkScheduleBlock,
} from "../../../packages/domain/src/index.ts";
import { createLgtmTelemetryQueryPort } from "../../../packages/observability/src/index.ts";
import { createOllamaChatPort } from "../../workers/src/adapters/ollama-chat-port.ts";

export type ParsedAgentCliArgs = {
  command: "observe";
  hatId: string;
  scope: RunScope;
  phase: RunLifecyclePhase;
  runId: string;
  hatAssignmentId: string;
  agentId: string;
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  workItemId: string;
  supervisorHatAssignmentId?: string | undefined;
  gateApproved: boolean;
  evidence: boolean;
  promptFlowPage?: number;
  selectIndex?: number;
  inboxAnchorId?: string;
  inboxAction?: ContextPackInboxWorkflowActionKindType;
  inboxSnoozedUntil?: string;
  contextCurationPreview?: AgentCliTenantContextPackCurationPreviewArgs;
  contextCompletenessPreview?: AgentCliTenantContextPackCompletenessPreviewArgs;
  contextSynthesisRequirementPreview?: AgentCliTenantContextPackSynthesisRequirementPreviewArgs;
  contextAdvisoryPromotionDecision?: AgentCliContextPackAdvisoryPromotionDecisionArgs;
};

export type ParseAgentCliArgsResult =
  | { ok: true; value: ParsedAgentCliArgs }
  | { ok: false; message: string };

type AgentCliZetaIdDecimal = ReturnType<typeof asZetaIdDecimal>;

type ParseAgentCliZetaIdResult =
  | { ok: true; value: AgentCliZetaIdDecimal }
  | { ok: false; message: string };

export type AgentCliScreen = {
  scope: RunScope;
  phase: RunLifecyclePhase;
  hatId: string;
  metrics: ScopedReadout;
  context?: ContextReadout;
  advisoryPromotionDecisions?: readonly ContextPackAdvisoryPromotionDecision[];
  inboxWorkflow?: ContextPackInboxWorkflowView;
  promptFlows?: PromptFlowReadout;
  page?: Menu16["page"];
  hierarchy?: HierarchyReadout;
  workMarket?: WorkMarketReadout;
  slots: readonly Pick<Menu16Slot, "index" | "direction" | "label" | "availability" | "reason">[];
};

export type AgentCliCycleInput = ActDependencies & {
  argv: readonly string[];
  now: () => string;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
  metricAgents?: readonly ScopedMetricAgent[];
  promptFlowTasks?: readonly PromptFlowTask[];
  hierarchy?: HierarchySnapshot;
  workQueues?: readonly HatWorkQueue[];
  scheduleBlocks?: readonly WorkScheduleBlock[];
  deterministicRules?: readonly DeterministicRule[];
  availableSecretScopes?: readonly string[];
  contextPackBuilder?: ContextPackBuilderPort;
  contextPackReadinessPolicy?: ContextPackReadinessPolicyPort;
  enforceContextReadiness?: boolean;
  loadLatestContextPackSnapshot?: ContextPackSnapshotStorePort["latestForScope"];
  recordContextPackSnapshot?: ContextPackSnapshotStorePort["record"];
  loadContextPackInboxWorkflow?: (lookup: ContextPackInboxWorkflowLookup) => Promise<ContextPackInboxWorkflowView>;
  loadContextPackAdvisoryPromotionDecisions?: ContextPackAdvisoryPromotionDecisionReadPort["listForPromotion"];
  selectSlot?: MenuSelector;
};

export type ContextPackInboxWorkflowLookup = {
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  observedAt: string;
};

const AgentCliInboxWorkflowFlag = {
  Action: "inbox-action",
  Anchor: "inbox-anchor",
  SnoozedUntil: "inbox-snoozed-until",
} as const;

const AgentCliInboxWorkflowActionErrorMessage = {
  ActionMissing: "--inbox-action is required when --inbox-anchor is provided",
  ActionUnavailable: "requested inbox action is not available for the workflow item",
  AnchorMissing: "--inbox-anchor is required when --inbox-action is provided",
  LoaderMissing: "inbox workflow actions require a context-pack inbox workflow loader",
  SnoozedUntilRequired: "--inbox-snoozed-until is required for snooze",
  WorkflowItemMissing: "requested inbox anchor is not visible in the workflow view",
} as const;

type AgentCliInboxWorkflowActionErrorMessage =
  (typeof AgentCliInboxWorkflowActionErrorMessage)[keyof typeof AgentCliInboxWorkflowActionErrorMessage];

const AGENT_CLI_INBOX_ACTION_SLOT_INDEX = -1;
const AGENT_CLI_INBOX_ACTION_DIRECTION = "inbox.action";
const AGENT_CLI_ADVISORY_PROMOTION_DECISION_SLOT_INDEX = -2;
const AGENT_CLI_ADVISORY_PROMOTION_DECISION_DIRECTION = "context.advisory_promotion_decision";
const AGENT_CLI_ADVISORY_PROMOTION_UNKNOWN_CURATION_PROFILE = "unknown";
const AGENT_CLI_CONTEXT_PACK_ADVISORY_PROMOTION_STATUS_QUERY =
  "observe-act advisory-promotion candidate status";
const AGENT_CLI_TENANT_CONTEXT_PACK_LANE_PRIORITY_SEPARATOR = "=";
const AGENT_CLI_TENANT_CONTEXT_PACK_COMPLETENESS_PREVIEW_QUERY = "observe-act tenant completeness authoring preview";
const AGENT_CLI_TENANT_CONTEXT_PACK_SYNTHESIS_PREVIEW_ANY_APPLIES_TO = "any";

const AgentCliTenantContextPackCurationFlag = {
  BlockInheritedInstructions: "context-block-inherited-instructions",
  DeterministicInstruction: "context-deterministic-instruction",
  LanePriority: "context-lane-priority",
  Preview: "context-curation-preview",
  Profile: "context-curation-profile",
  RequiredLane: "context-required-lane",
} as const;

type AgentCliTenantContextPackCurationPreviewArgs = {
  policy: TenantContextPackCurationPolicy;
};

const AgentCliTenantContextPackCompletenessFlag = {
  Preview: "context-completeness-preview",
  RequirementSet: "context-completeness-set",
} as const;

type AgentCliTenantContextPackCompletenessPreviewArgs = {
  policy: TenantContextPackCompletenessPolicy;
};

const AgentCliTenantContextPackSynthesisRequirementFlag = {
  Preview: "context-synthesis-preview",
  RequirementSet: "context-synthesis-set",
} as const;

type AgentCliTenantContextPackSynthesisRequirementPreviewArgs = {
  policy: TenantContextPackSynthesisRequirementPolicy;
};

const AGENT_CLI_TENANT_CONTEXT_PACK_EMPTY_CURATION_PLAN: ContextPackCurationPlan = {
  lanes: [],
  deterministicInstructions: [],
};

const AgentCliContextPackAdvisoryPromotionFlag = {
  Blocker: "context-advisory-promotion-blocker",
  Item: "context-advisory-promotion-item",
  Status: "context-advisory-promotion-status",
} as const;

const AgentCliContextPackAdvisoryPromotionErrorMessage = {
  FlagsIncomplete: "--context-advisory-promotion-item, --context-advisory-promotion-status, and --context-advisory-promotion-blocker are required together",
  ItemMissing: "requested advisory-promotion item is not visible in the current context pack",
  ItemNotPromotable: "requested advisory-promotion item is not a synthesis gap hypothesis",
  StatusUnknown: "unknown context advisory-promotion status",
} as const;

type AgentCliContextPackAdvisoryPromotionErrorMessage =
  (typeof AgentCliContextPackAdvisoryPromotionErrorMessage)[keyof typeof AgentCliContextPackAdvisoryPromotionErrorMessage];

type ContextPackAdvisoryPromotionDecisionStatusType =
  (typeof ContextPackAdvisoryPromotionDecisionStatus)[keyof typeof ContextPackAdvisoryPromotionDecisionStatus];

type AgentCliContextPackAdvisoryPromotionDecisionArgs = {
  itemId: string;
  status: ContextPackAdvisoryPromotionDecisionStatusType;
  lifecycleBlocker: string;
};

const AgentCliContextPackAdvisoryPromotionCandidateStatus = {
  Approved: ContextPackAdvisoryPromotionDecisionStatus.Approved,
  NotApproved: "not_approved",
  Unknown: "unknown",
} as const;

export type CreateAgentCliMetricAgentsFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
  now: () => string;
  fetchImpl?: typeof fetch;
};

export type CreateAgentCliPromptFlowTasksFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
};

export type CreateAgentCliHierarchyFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
};

export type CreateAgentCliWorkQueuesFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
};

export type AgentCliEnvLoadErrorSource = "prompt_flow_tasks" | "hierarchy" | "work_market";

export type AgentCliEnvLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; source: AgentCliEnvLoadErrorSource; message: string };

export const SelectorRejectionReason = {
  ModelError: "model_error",
  ParseFailure: "parse_failure",
  SlotOutOfRange: "slot_out_of_range",
  NonSelectableSlot: "non_selectable_slot",
} as const;

export type SelectorRejectionReason = (typeof SelectorRejectionReason)[keyof typeof SelectorRejectionReason];

export type MenuSelectorRejection = {
  reason: SelectorRejectionReason;
  fallbackIndex: number;
  rawOutput?: string | undefined;
  rejectedIndex?: number | undefined;
};

export type MenuSelectionResult = {
  index: number;
  reason: string;
  selectorRejection?: MenuSelectorRejection | undefined;
};

export type MenuSelectorOutput = number | MenuSelectionResult;

export type MenuSelectionSurface = {
  context?: ContextReadout | undefined;
  inboxWorkflow?: ContextPackInboxWorkflowView | undefined;
  metrics?: ScopedReadout | undefined;
  promptFlows?: PromptFlowReadout | undefined;
  hierarchy?: HierarchyReadout | undefined;
};

export type MenuSelector = (menu: Menu16, surface?: MenuSelectionSurface | undefined) => Promise<MenuSelectorOutput> | MenuSelectorOutput;

export type CreateModelBackedMenuSelectorInput = {
  chat: ChatCompletionPort;
  fallback: MenuSelector;
};

export type CreateAgentCliSelectorFromEnvInput = {
  env: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
};

export type AgentCliCycleResult = {
  exitCode: number;
  actionResult?: ActResult;
  evidence?: AgentCliCycleEvidence;
  failureEvidence?: AgentCliCycleFailureEvidence;
};

export const AgentCliCycleFailureKind = {
  ContextRefreshLookupFailed: "context_refresh_lookup_failed",
} as const;

export type AgentCliCycleFailureKind =
  (typeof AgentCliCycleFailureKind)[keyof typeof AgentCliCycleFailureKind];

export type AgentCliCycleFailureEvidence = {
  kind: AgentCliCycleFailureKind;
  message: string;
};

export type AgentCliCycleEvidence = {
  menuHash: string;
  selectedIndex: number;
  selectedImplKind?: string | undefined;
  actionOutcome?: ActResult["outcome"] | undefined;
  vetoCount: number;
  trueSlotCount: number;
  statusSignalKind?: GlassHaloStatusSignal["kind"] | undefined;
  statusScope?: RunScope | undefined;
  statusPhase?: RunLifecyclePhase | undefined;
  statusHierarchyPriorityScope?: HierarchyReadout["priorityScope"] | undefined;
  selectedCommandType?: string | undefined;
  promptFlowPage?: number | undefined;
  selectedPromptFlowTaskId?: string | undefined;
  selectedPromptFlowId?: string | undefined;
  reobservePromptFlowPage?: number | undefined;
  contextPackId?: string | undefined;
  contextPackStatus?: ContextReadout["status"] | undefined;
  contextRequiredItemCount?: number | undefined;
  contextOptionalItemCount?: number | undefined;
  contextOmissionCount?: number | undefined;
  contextContradictionCount?: number | undefined;
  contextStaleInputCount?: number | undefined;
  contextLifecycleBlockerCount?: number | undefined;
  contextRequiredItemIds: readonly string[];
  contextSourceGraphVersion?: string | undefined;
  contextPolicyVersion?: string | undefined;
  contextCurationStages: readonly string[];
  contextSourcePointerRefs: readonly string[];
  contextRefreshReason?: ContextPackRefreshDecision["reason"] | undefined;
  contextRefreshRequiresBuild?: boolean | undefined;
  previousContextPackId?: string | undefined;
  previousContextPackStatus?: ContextPackRefreshDecision["previousStatus"] | undefined;
  contextSnapshot?: ContextReadout | undefined;
  promptFlowIds: readonly string[];
  metricBlockIds: readonly string[];
  selectorRejections: readonly MenuSelectorRejection[];
  actionRejectionReason?: ActRejectionReason | undefined;
};

export function parseAgentCliArgs(argv: readonly string[]): ParseAgentCliArgsResult {
  if (argv[0] !== "observe") {
    return { ok: false, message: "usage: observe --hat <id> --scope <run|work_item|initiative|project|organization>" };
  }

  const values = parseFlags(argv.slice(1));
  if (!values.ok) return values;

  const hatId = values.flags.get("hat");
  if (hatId === undefined || hatId.length === 0) {
    return { ok: false, message: "missing required --hat <id>" };
  }

  const scope = parseRunScope(values.flags.get("scope") ?? RunScope.Run);
  if (scope === undefined) {
    return { ok: false, message: `unknown scope '${values.flags.get("scope")}'` };
  }

  const phase = parseRunLifecyclePhase(values.flags.get("phase") ?? RunLifecyclePhase.Observing);
  if (phase === undefined) {
    return { ok: false, message: `unknown phase '${values.flags.get("phase")}'` };
  }

  const runId = values.flags.get("run-id") ?? "1";
  const hatAssignmentId = values.flags.get("hat-assignment") ?? "1";
  const agentId = values.flags.get("agent") ?? "agent-local";
  const organizationId = values.flags.get("organization") ?? "org-local";
  const projectId = values.flags.get("project") ?? "project-local";
  const teamId = values.flags.get("team");
  const workItemId = values.flags.get("work-item") ?? runId;
  const supervisorHatAssignmentId = values.flags.get("supervisor-hat-assignment");
  const selectIndexValue = values.flags.get("select-index");
  const selectIndex = selectIndexValue === undefined ? undefined : Number.parseInt(selectIndexValue, 10);
  if (selectIndexValue !== undefined && (!Number.isInteger(selectIndex) || String(selectIndex) !== selectIndexValue)) {
    return { ok: false, message: `--select-index must be an integer, got '${selectIndexValue}'` };
  }
  const promptFlowPageValue = values.flags.get("prompt-flow-page");
  const promptFlowPage = promptFlowPageValue === undefined ? undefined : Number.parseInt(promptFlowPageValue, 10);
  if (promptFlowPageValue !== undefined) {
    if (!Number.isInteger(promptFlowPage) || String(promptFlowPage) !== promptFlowPageValue || (promptFlowPage ?? -1) < 0) {
      return { ok: false, message: `--prompt-flow-page must be a non-negative integer, got '${promptFlowPageValue}'` };
    }
  }
  const inboxAnchorId = values.flags.get(AgentCliInboxWorkflowFlag.Anchor);
  const inboxActionValue = values.flags.get(AgentCliInboxWorkflowFlag.Action);
  const inboxAction = parseContextPackInboxWorkflowActionKind(inboxActionValue);
  if (inboxActionValue !== undefined && inboxAction === undefined) {
    return { ok: false, message: `unknown --${AgentCliInboxWorkflowFlag.Action} '${inboxActionValue}'` };
  }
  if (inboxAnchorId !== undefined && inboxAction === undefined) {
    return { ok: false, message: AgentCliInboxWorkflowActionErrorMessage.ActionMissing };
  }
  if (inboxAction !== undefined && inboxAnchorId === undefined) {
    return { ok: false, message: AgentCliInboxWorkflowActionErrorMessage.AnchorMissing };
  }
  const inboxSnoozedUntil = values.flags.get(AgentCliInboxWorkflowFlag.SnoozedUntil);
  const contextCurationPreview = parseTenantContextPackCurationPreview(values);
  if (!contextCurationPreview.ok) return contextCurationPreview;
  const contextCompletenessPreview = parseTenantContextPackCompletenessPreview(values);
  if (!contextCompletenessPreview.ok) return contextCompletenessPreview;
  const contextSynthesisRequirementPreview = parseTenantContextPackSynthesisRequirementPreview(values);
  if (!contextSynthesisRequirementPreview.ok) return contextSynthesisRequirementPreview;
  const contextAdvisoryPromotionDecision = parseContextPackAdvisoryPromotionDecision(values);
  if (!contextAdvisoryPromotionDecision.ok) return contextAdvisoryPromotionDecision;

  return {
    ok: true,
    value: {
      command: "observe",
      hatId,
      scope,
      phase,
      runId,
      hatAssignmentId,
      agentId,
      organizationId,
      projectId,
      ...(teamId === undefined ? {} : { teamId }),
      workItemId,
      ...(supervisorHatAssignmentId === undefined ? {} : { supervisorHatAssignmentId }),
      gateApproved: values.booleans.has("gate-approved"),
      evidence: values.booleans.has("evidence"),
      ...createOptionalPromptFlowPage(promptFlowPageValue === undefined ? undefined : promptFlowPage),
      ...createOptionalSelectIndex(selectIndexValue === undefined ? undefined : selectIndex),
      ...createOptionalInboxWorkflowAction(inboxAnchorId, inboxAction, inboxSnoozedUntil),
      ...createOptionalTenantContextPackCurationPreview(contextCurationPreview.value),
      ...createOptionalTenantContextPackCompletenessPreview(contextCompletenessPreview.value),
      ...createOptionalTenantContextPackSynthesisRequirementPreview(contextSynthesisRequirementPreview.value),
      ...createOptionalContextPackAdvisoryPromotionDecision(contextAdvisoryPromotionDecision.value),
    },
  };
}

export function selectFirstTrueSlot(menu: Menu16): number {
  const selectable = menu.slots.filter((slot) => slot.availability === TriAvailability.True);
  return selectable.find((slot) => !slot.direction.startsWith("navigate."))?.index
    ?? selectable[0]?.index
    ?? -1;
}

export function formatAgentCliScreen(screen: AgentCliScreen): string {
  return [
    "observe",
    `scope: ${screen.scope}`,
    `phase: ${screen.phase}`,
    `hat: ${screen.hatId}`,
    "metrics:",
    ...formatMetricBlocks(screen.metrics.blocks),
    ...formatContextReadout(screen.context, screen.advisoryPromotionDecisions),
    ...formatContextPackInboxWorkflow(screen.inboxWorkflow),
    "prompt flows:",
    ...formatPromptFlowTasks(screen.promptFlows),
    ...formatMenuPage(screen.page),
    ...formatHierarchy(screen.hierarchy),
    ...formatWorkMarket(screen.workMarket),
    "menu:",
    ...screen.slots.map(formatSlot),
  ].join("\n");
}

function formatTenantContextPackCurationAuthoringPreview(preview: ContextPackCurationIntent): string {
  return [
    "tenant context-pack curation authoring:",
    ...formatTenantContextPackCurationProfileCatalog(),
    ...formatTenantContextPackCurationLaneCatalog(),
    `tenant curation preview: profile=${preview.curationProfile.profileId} focus=${preview.documentFocus.profileId} policy=${preview.curationProfile.policyVersion}`,
    `tenant curation preview docs: ${preview.documentFocus.preferredDocTypes.join(",")}`,
    `tenant curation preview query: ${preview.documentFocus.queryTerms.join(",")}`,
    ...formatTenantContextPackCurationPreviewLanePriorities(preview),
    ...formatTenantContextPackCurationPreviewRequiredLanes(preview),
    ...formatTenantContextPackCurationPreviewInstructions(preview),
  ].join("\n");
}

function formatTenantContextPackCurationProfileCatalog(): readonly string[] {
  return listContextPackCurationProfileDescriptors().map((profile) =>
    `- profile ${profile.profileId} focus=${profile.documentFocus.profileId} docs=${profile.documentFocus.preferredDocTypes.join(",")} terms=${profile.documentFocus.queryTerms.join(",")}`
  );
}

function formatTenantContextPackCurationLaneCatalog(): readonly string[] {
  return listContextPackAttentionLaneDescriptors().map((lane) =>
    `- lane ${lane.kind} defaultPriority=${lane.defaultPriority} required=${String(lane.defaultRequired)} objective=${lane.objective}`
  );
}

function formatTenantContextPackCurationPreviewLanePriorities(preview: ContextPackCurationIntent): readonly string[] {
  const overrides = preview.curationProfile.lanePriorityOverrides ?? {};
  return Object.entries(overrides)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([lane, priority]) => `- preview lane ${lane} priority=${priority}`);
}

function formatTenantContextPackCurationPreviewRequiredLanes(preview: ContextPackCurationIntent): readonly string[] {
  return [...(preview.curationProfile.requiredLanes ?? [])]
    .sort((left, right) => left.localeCompare(right))
    .map((lane) => `- preview required lane ${lane}`);
}

function formatTenantContextPackCurationPreviewInstructions(preview: ContextPackCurationIntent): readonly string[] {
  return [...(preview.curationProfile.deterministicInstructions ?? [])]
    .map((instruction) => `- preview instruction ${instruction}`);
}

function formatTenantContextPackCompletenessAuthoringPreview(preview: ContextPackCompletenessPolicyResult): string {
  return [
    "tenant context-pack completeness authoring:",
    ...formatTenantContextPackCompletenessRequirementSetCatalog(),
    ...formatTenantContextPackCompletenessPreviewOmissions(preview),
    ...formatTenantContextPackCompletenessPreviewBlockers(preview),
    ...formatTenantContextPackCompletenessPreviewEvidence(preview),
  ].join("\n");
}

function formatTenantContextPackCompletenessRequirementSetCatalog(): readonly string[] {
  return listTenantContextPackCompletenessRequirementSetDescriptors().map((descriptor) =>
    `- completeness set ${descriptor.setId} requirements=${descriptor.requirements.map(formatTenantContextPackCompletenessRequirement).join(",")}`
  );
}

function formatTenantContextPackCompletenessRequirement(
  requirement: ReturnType<typeof listTenantContextPackCompletenessRequirementSetDescriptors>[number]["requirements"][number],
): string {
  return `${requirement.requirementId}:${requirement.itemKind}:${requirement.requiredSourceScope}`;
}

function formatTenantContextPackCompletenessPreviewOmissions(
  preview: ContextPackCompletenessPolicyResult,
): readonly string[] {
  return preview.omittedItemsWithReason.map((item) =>
    `- completeness preview omission ${item.nodeId ?? "unspecified"} ${item.reason}: ${item.message}`
  );
}

function formatTenantContextPackCompletenessPreviewBlockers(
  preview: ContextPackCompletenessPolicyResult,
): readonly string[] {
  return (preview.lifecycleBlockers ?? []).map((blocker) => `- completeness preview blocker ${blocker}`);
}

function formatTenantContextPackCompletenessPreviewEvidence(
  preview: ContextPackCompletenessPolicyResult,
): readonly string[] {
  return (preview.evidenceRefs ?? []).map((evidenceRef) => `- completeness preview evidence ${evidenceRef}`);
}

function formatTenantContextPackSynthesisRequirementAuthoringPreview(
  preview: ContextPackSynthesisRequirement,
): string {
  return [
    "tenant context-pack synthesis-requirement authoring:",
    ...formatTenantContextPackSynthesisRequirementSetCatalog(),
    `tenant synthesis preview: decision=${preview.decision} reason=${preview.reason} policy=${preview.policyVersion}`,
  ].join("\n");
}

function formatTenantContextPackSynthesisRequirementSetCatalog(): readonly string[] {
  return listTenantContextPackSynthesisRequirementSetDescriptors().map((descriptor) =>
    `- synthesis set ${descriptor.setId} requirements=${descriptor.requirements.map(formatTenantContextPackSynthesisRequirement).join(",")}`
  );
}

function formatTenantContextPackSynthesisRequirement(
  requirement: ReturnType<typeof listTenantContextPackSynthesisRequirementSetDescriptors>[number]["requirements"][number],
): string {
  return [
    `${requirement.requirementId}:${requirement.reason}`,
    `phases=${formatTenantContextPackSynthesisAppliesToValues(requirement.appliesTo?.phases)}`,
    `scopes=${formatTenantContextPackSynthesisAppliesToValues(requirement.appliesTo?.scopes)}`,
  ].join(" ");
}

function formatTenantContextPackSynthesisAppliesToValues(values: readonly string[] | undefined): string {
  return values === undefined || values.length === 0
    ? AGENT_CLI_TENANT_CONTEXT_PACK_SYNTHESIS_PREVIEW_ANY_APPLIES_TO
    : values.join(",");
}

export function createAgentCliMetricAgentsFromEnv(
  input: CreateAgentCliMetricAgentsFromEnvInput,
): readonly ScopedMetricAgent[] {
  const mimirBaseUrl = input.env.AGENTIC_ORG_MIMIR_BASE_URL;
  const tempoBaseUrl = input.env.AGENTIC_ORG_TEMPO_BASE_URL;
  const lokiBaseUrl = input.env.AGENTIC_ORG_LOKI_BASE_URL;
  if (mimirBaseUrl === undefined || tempoBaseUrl === undefined || lokiBaseUrl === undefined) {
    return [];
  }

  const createTelemetryQueryPort: unknown = createLgtmTelemetryQueryPort;
  if (typeof createTelemetryQueryPort !== "function") {
    throw new Error("observability telemetry query port factory is unavailable");
  }

  const telemetry = (createTelemetryQueryPort as typeof createLgtmTelemetryQueryPort)({
    mimirBaseUrl,
    tempoBaseUrl,
    lokiBaseUrl,
    ...createOptionalFetchImpl(input.fetchImpl),
  });

  return createTelemetryScopedMetricAgents({
    telemetry,
    range: {
      start: input.env.AGENTIC_ORG_TELEMETRY_RANGE_START ?? oneHourBefore(input.now()),
      end: input.env.AGENTIC_ORG_TELEMETRY_RANGE_END ?? input.now(),
    },
  });
}

export function createAgentCliPromptFlowTasksFromEnv(
  input: CreateAgentCliPromptFlowTasksFromEnvInput,
): readonly PromptFlowTask[] {
  const compiled = compileAgentCliPromptFlowTasksFromEnv(input);
  const raw = input.env.AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON;
  if (raw === undefined || raw.trim().length === 0) {
    return compiled;
  }
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON");
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON must be a JSON array");
  }
  return [
    ...compiled,
    ...parsed.map(parsePromptFlowTask),
  ];
}

export function tryCreateAgentCliPromptFlowTasksFromEnv(
  input: CreateAgentCliPromptFlowTasksFromEnvInput,
): AgentCliEnvLoadResult<readonly PromptFlowTask[]> {
  try {
    return { ok: true, value: createAgentCliPromptFlowTasksFromEnv(input) };
  } catch (error) {
    return {
      ok: false,
      source: "prompt_flow_tasks",
      message: extractErrorMessage(error),
    };
  }
}

export function createAgentCliHierarchyFromEnv(
  input: CreateAgentCliHierarchyFromEnvInput,
): HierarchySnapshot {
  const raw = input.env.AGENTIC_ORG_HIERARCHY_JSON;
  if (raw === undefined || raw.trim().length === 0) {
    return { projects: [], initiatives: [] };
  }
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_HIERARCHY_JSON");
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("AGENTIC_ORG_HIERARCHY_JSON must be a JSON object");
  }
  const candidate = parsed as Record<string, unknown>;
  return {
    projects: parseHierarchyProjects(candidate.projects),
    initiatives: parseHierarchyInitiatives(candidate.initiatives),
    workBatches: parseOptionalHierarchyWorkBatches(candidate.workBatches),
    workItems: parseOptionalHierarchyWorkItems(candidate.workItems),
    missions: parseOptionalHierarchyMissions(candidate.missions),
  };
}

export function tryCreateAgentCliHierarchyFromEnv(
  input: CreateAgentCliHierarchyFromEnvInput,
): AgentCliEnvLoadResult<HierarchySnapshot> {
  try {
    return { ok: true, value: createAgentCliHierarchyFromEnv(input) };
  } catch (error) {
    return {
      ok: false,
      source: "hierarchy",
      message: extractErrorMessage(error),
    };
  }
}

export function createAgentCliWorkQueuesFromEnv(
  input: CreateAgentCliWorkQueuesFromEnvInput,
): readonly HatWorkQueue[] {
  const raw = input.env.AGENTIC_ORG_WORK_MARKET_QUEUES_JSON;
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_WORK_MARKET_QUEUES_JSON");
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_WORK_MARKET_QUEUES_JSON must be a JSON array");
  }
  return parsed.map(parseWorkMarketQueue);
}

export function tryCreateAgentCliWorkQueuesFromEnv(
  input: CreateAgentCliWorkQueuesFromEnvInput,
): AgentCliEnvLoadResult<readonly HatWorkQueue[]> {
  try {
    return { ok: true, value: createAgentCliWorkQueuesFromEnv(input) };
  } catch (error) {
    return {
      ok: false,
      source: "work_market",
      message: extractErrorMessage(error),
    };
  }
}

export function createModelBackedMenuSelector(input: CreateModelBackedMenuSelectorInput): MenuSelector {
  return async (menu, surface) => {
    const selectable = menu.slots.filter((slot) => slot.availability === TriAvailability.True);
    if (selectable.length === 0) {
      return await input.fallback(menu, surface);
    }

    let completion: ChatCompletionResult;
    try {
      completion = await input.chat.complete({
        system:
          "You are selecting from a deterministic 16-slot agent controller. Return JSON only. The `slot` value must be one selectable slot index, and `reason` must briefly explain the choice.",
        user: buildMenuSelectorPrompt(selectable, surface),
        format: buildMenuSelectionSchema(selectable),
      });
    } catch {
      const fallback = normalizeMenuSelectionResult(await input.fallback(menu, surface), "fallback_after_model_error");
      return {
        index: fallback.index,
        reason: "fallback_after_selector_rejection",
        selectorRejection: {
          reason: SelectorRejectionReason.ModelError,
          fallbackIndex: fallback.index,
        },
      };
    }

    const rawOutput = completionContent(completion);
    const parsed = parseModelSelectedIndex(rawOutput, menu);
    if (parsed.ok) return parsed.index;

    const fallback = normalizeMenuSelectionResult(await input.fallback(menu, surface), "fallback_after_selector_rejection");
    return {
      index: fallback.index,
      reason: "fallback_after_selector_rejection",
      selectorRejection: {
        reason: parsed.reason,
        rawOutput,
        fallbackIndex: fallback.index,
        ...createOptionalRejectedIndex(parsed.rejectedIndex),
      },
    };
  };
}

export function createAgentCliSelectorFromEnv(input: CreateAgentCliSelectorFromEnvInput): MenuSelector {
  const baseUrl = input.env.AGENTIC_ORG_LLM_BASE_URL;
  const model = input.env.AGENTIC_ORG_LLM_MODEL;
  if (baseUrl === undefined || model === undefined) {
    return selectFirstTrueSlot;
  }

  return createModelBackedMenuSelector({
    chat: createOllamaChatPort({
      baseUrl,
      model,
      ...createOptionalFetchImpl(input.fetchImpl),
    }),
    fallback: selectFirstTrueSlot,
  });
}

export async function runAgentCliCycle(input: AgentCliCycleInput): Promise<AgentCliCycleResult> {
  const parsed = parseAgentCliArgs(input.argv);
  if (!parsed.ok) {
    input.writeStderr?.(`${parsed.message}\n`);
    return { exitCode: 2 };
  }

  const hats = buildHatDefinitions();
  const hat = hats.find((candidate) => candidate.id === parsed.value.hatId);
  if (hat === undefined) {
    input.writeStderr?.(`unknown hat '${parsed.value.hatId}'\n`);
    return { exitCode: 2 };
  }

  const runId = parseAgentCliZetaId(parsed.value.runId, "--run-id");
  if (!runId.ok) {
    input.writeStderr?.(`${runId.message}\n`);
    return { exitCode: 2 };
  }

  const hatAssignmentId = parseAgentCliZetaId(parsed.value.hatAssignmentId, "--hat-assignment");
  if (!hatAssignmentId.ok) {
    input.writeStderr?.(`${hatAssignmentId.message}\n`);
    return { exitCode: 2 };
  }

  const snapshot: AgentObserveSnapshot = {
    runId: runId.value,
    scope: parsed.value.scope,
    phase: parsed.value.phase,
    trace: {
      correlationId: `observe-cli-${parsed.value.runId}`,
      causationId: `observe-cli-${parsed.value.runId}`,
      traceId: `observe-cli-${parsed.value.runId}`,
    },
    hasGateApproval: parsed.value.gateApproved,
    hasEvidence: parsed.value.evidence,
    hatAssignmentId: hatAssignmentId.value,
    hat,
    agentId: parsed.value.agentId,
    organizationId: parsed.value.organizationId,
    projectId: parsed.value.projectId,
    ...(parsed.value.teamId === undefined ? {} : { teamId: parsed.value.teamId }),
    workItemId: parsed.value.workItemId,
    ...(parsed.value.supervisorHatAssignmentId === undefined ? {} : { supervisorHatAssignmentId: parsed.value.supervisorHatAssignmentId }),
  };

  const refreshDecisionResult = await loadContextPackRefreshDecision(input, snapshot);
  if (!refreshDecisionResult.ok) {
    input.writeStderr?.(`agent CLI context-pack previous snapshot lookup failed: ${refreshDecisionResult.message}\n`);
    return {
      exitCode: 1,
      failureEvidence: {
        kind: AgentCliCycleFailureKind.ContextRefreshLookupFailed,
        message: refreshDecisionResult.message,
      },
    };
  }
  const contextRefresh = refreshDecisionResult.decision;

  const observed = await observeAgentSurface(snapshot, {
    clock: { now: input.now },
    ...createOptionalDeterministicRules(input.deterministicRules),
    ...createOptionalMetricAgents(input.metricAgents),
    ...createOptionalPromptFlowTasks(input.promptFlowTasks),
    ...createOptionalPromptFlowPage(parsed.value.promptFlowPage),
    ...createOptionalHierarchy(input.hierarchy),
    ...createOptionalScheduleBlocks(input.scheduleBlocks),
    ...createOptionalAvailableSecretScopes(input.availableSecretScopes),
    ...createOptionalContextPackBuilder(input.contextPackBuilder),
    ...createOptionalContextPackReadinessPolicy(input.contextPackReadinessPolicy),
    ...createOptionalContextPackWakeContext(contextRefresh),
    ...createOptionalContextReadinessEnforcement(input.enforceContextReadiness),
  });
  if (observed.outcome === ObserveOutcome.Feedback) {
    input.writeStderr?.(`${observed.feedback.message}\n`);
    return { exitCode: 1 };
  }

  if (input.recordContextPackSnapshot !== undefined) {
    const snapshotResult = await tryRecordContextPackSnapshot(input.recordContextPackSnapshot, {
      context: observed.context,
      phase: parsed.value.phase,
      recordedAt: input.now(),
      trace: snapshot.trace,
    });
    if (!snapshotResult.ok) {
      input.writeStderr?.(`agent CLI context-pack snapshot record failed: ${snapshotResult.message}\n`);
      return { exitCode: 1 };
    }
  }

  const inboxWorkflowResult = await loadContextPackInboxWorkflow(input, parsed.value);
  if (!inboxWorkflowResult.ok) {
    input.writeStderr?.(`agent CLI inbox workflow load failed: ${inboxWorkflowResult.message}\n`);
    return { exitCode: 1 };
  }

  const advisoryPromotionDecisionResult = await loadContextPackAdvisoryPromotionDecisions(
    input,
    snapshot,
    observed,
    contextRefresh,
  );
  if (!advisoryPromotionDecisionResult.ok) {
    input.writeStderr?.(`agent CLI advisory-promotion decision status load failed: ${advisoryPromotionDecisionResult.message}\n`);
  }

  input.writeStdout?.(`${formatAgentCliScreen({
    scope: parsed.value.scope,
    phase: parsed.value.phase,
    hatId: parsed.value.hatId,
    metrics: observed.metrics,
    context: observed.context,
    ...createOptionalContextPackAdvisoryPromotionDecisions(advisoryPromotionDecisionResult.decisions),
    ...createOptionalInboxWorkflow(inboxWorkflowResult.view),
    promptFlows: observed.promptFlows,
    page: observed.actions.page,
    hierarchy: observed.hierarchy,
    workMarket: workMarketReadoutForHat(input.workQueues ?? [], {
      organizationId: parsed.value.organizationId,
      hatId: hat.id,
      visibleHatIds: visibleWorkMarketHatIds(hat, hats, input.workQueues ?? []),
      now: input.now(),
    }),
    slots: observed.actions.slots,
  })}\n`);

  if (parsed.value.contextCurationPreview !== undefined) {
    const preview = await previewTenantContextPackCurationPolicy({
      policy: parsed.value.contextCurationPreview.policy,
      request: {
        request: contextPackBuildRequestForAgentCliPreview(snapshot, observed, contextRefresh),
      },
    });
    input.writeStdout?.(`${formatTenantContextPackCurationAuthoringPreview(preview)}\n`);
    return {
      exitCode: 0,
      actionResult: rejectAct(
        ActRejectionReason.MissingImplementation,
        "tenant context-pack curation authoring preview rendered without dispatching side effects",
      ),
    };
  }

  if (parsed.value.contextCompletenessPreview !== undefined) {
    const preview = await previewTenantContextPackCompletenessPolicy({
      policy: parsed.value.contextCompletenessPreview.policy,
      request: contextPackCompletenessPolicyRequestForAgentCliPreview(
        contextPackBuildRequestForAgentCliPreview(snapshot, observed, contextRefresh),
        observed.context.pack.items,
      ),
    });
    input.writeStdout?.(`${formatTenantContextPackCompletenessAuthoringPreview(preview)}\n`);
    return {
      exitCode: 0,
      actionResult: rejectAct(
        ActRejectionReason.MissingImplementation,
        "tenant context-pack completeness authoring preview rendered without dispatching side effects",
      ),
    };
  }

  if (parsed.value.contextSynthesisRequirementPreview !== undefined) {
    const preview = await previewTenantContextPackSynthesisRequirementPolicy({
      policy: parsed.value.contextSynthesisRequirementPreview.policy,
      request: contextPackSynthesisRequirementPolicyRequestForAgentCliPreview(
        contextPackBuildRequestForAgentCliPreview(snapshot, observed, contextRefresh),
        observed.context.pack,
      ),
    });
    input.writeStdout?.(`${formatTenantContextPackSynthesisRequirementAuthoringPreview(preview)}\n`);
    return {
      exitCode: 0,
      actionResult: rejectAct(
        ActRejectionReason.MissingImplementation,
        "tenant context-pack synthesis-requirement authoring preview rendered without dispatching side effects",
      ),
    };
  }

  if (parsed.value.contextAdvisoryPromotionDecision !== undefined) {
    const advisoryPromotionResult = await dispatchContextPackAdvisoryPromotionDecision({
      input,
      args: {
        ...parsed.value,
        contextAdvisoryPromotionDecision: parsed.value.contextAdvisoryPromotionDecision,
      },
      menu: observed.actions,
      contextRefresh,
      observed,
    });
    return advisoryPromotionResult;
  }

  if (parsed.value.inboxAction !== undefined && parsed.value.inboxAnchorId !== undefined) {
    const inboxActionResult = await dispatchContextPackInboxWorkflowAction({
      input,
      args: {
        ...parsed.value,
        inboxAction: parsed.value.inboxAction,
        inboxAnchorId: parsed.value.inboxAnchorId,
      },
      menu: observed.actions,
      inboxWorkflow: inboxWorkflowResult.view,
      contextRefresh,
      observed,
    });
    return inboxActionResult;
  }

  const selection = parsed.value.selectIndex === undefined
    ? normalizeMenuSelectionResult(
      await (input.selectSlot?.(observed.actions, createMenuSelectionSurface(observed, inboxWorkflowResult.view)) ?? selectFirstTrueSlot(observed.actions)),
      "selector_selected",
    )
    : {
        index: parsed.value.selectIndex,
        reason: "cli_select_index",
      };
  const selectedIndex = selection.index;
  if (!observed.actions.slots.some((slot) => slot.availability === TriAvailability.True)) {
    const actionResult = rejectAct(
      ActRejectionReason.NoSelectableSlot,
      "no TriAvailability.True slots in rendered menu",
    );
    const evidence = createAgentCliCycleEvidence(
      observed.actions,
      selection,
      observed.promptFlows,
      observed.metrics,
      observed.context,
      contextRefresh,
      actionResult,
    );
    input.writeStdout?.(`action: ${formatActResult(actionResult)}\n`);
    return { exitCode: 1, actionResult, evidence };
  }
  const actionResult = await act(selectedIndex, observed.actions, {
    runCommand: async (commandType, command, slot) =>
      await input.runCommand(commandType, materializeCommand(commandType, command, slot, parsed.value), slot),
    dispatchTool: input.dispatchTool,
    loadPromptFlowContext: input.loadPromptFlowContext ?? loadPromptFlowContextFromRequest,
    ...createOptionalSlotAuthorizer(input.authorizeSlot),
  });
  input.writeStdout?.(`action: ${formatActResult(actionResult)}\n`);
  if (actionResult.outcome === "loaded_context") {
    input.writeStdout?.(`${formatPromptFlowContext(actionResult.context)}\n`);
  }
  return {
    exitCode: actionResult.outcome === "rejected" ? 1 : 0,
    actionResult,
    evidence: createAgentCliCycleEvidence(
      observed.actions,
      selection,
      observed.promptFlows,
      observed.metrics,
      observed.context,
      contextRefresh,
      actionResult,
    ),
  };
}

async function dispatchContextPackInboxWorkflowAction(input: {
  input: AgentCliCycleInput;
  args: ParsedAgentCliArgs & { inboxAction: ContextPackInboxWorkflowActionKindType; inboxAnchorId: string };
  menu: Menu16;
  inboxWorkflow: ContextPackInboxWorkflowView | undefined;
  contextRefresh: ContextPackRefreshDecision | undefined;
  observed: {
    actions: Menu16;
    promptFlows: PromptFlowReadout;
    metrics: ScopedReadout;
    context: ContextReadout;
  };
}): Promise<AgentCliCycleResult> {
  const actionCommand = createContextPackInboxWorkflowActionCommand(input);
  if (!actionCommand.ok) {
    input.input.writeStderr?.(`agent CLI inbox workflow action failed: ${actionCommand.message}\n`);
    const actionResult = rejectAct(ActRejectionReason.MissingImplementation, actionCommand.message);
    return {
      exitCode: 1,
      actionResult,
      evidence: createAgentCliCycleEvidence(
        input.menu,
        { index: AGENT_CLI_INBOX_ACTION_SLOT_INDEX, reason: "cli_inbox_action_rejected" },
        input.observed.promptFlows,
        input.observed.metrics,
        input.observed.context,
        input.contextRefresh,
        actionResult,
      ),
    };
  }

  const actionSlot = createContextPackInboxWorkflowActionSlot(input.args.inboxAction, actionCommand.value);
  const actionResult: ActResult = {
    outcome: "dispatched",
    kind: "command",
    result: await input.input.runCommand(CommandType.UpdateContextPackInboxAnchorStatus, actionCommand.value, actionSlot),
  };
  input.input.writeStdout?.(`action: ${formatActResult(actionResult)}\n`);
  return {
    exitCode: 0,
    actionResult,
    evidence: createAgentCliCycleEvidence(
      menuWithInboxWorkflowActionSlot(input.menu, actionSlot),
      { index: AGENT_CLI_INBOX_ACTION_SLOT_INDEX, reason: "cli_inbox_action" },
      input.observed.promptFlows,
      input.observed.metrics,
      input.observed.context,
      input.contextRefresh,
      actionResult,
    ),
  };
}

async function dispatchContextPackAdvisoryPromotionDecision(input: {
  input: AgentCliCycleInput;
  args: ParsedAgentCliArgs & { contextAdvisoryPromotionDecision: AgentCliContextPackAdvisoryPromotionDecisionArgs };
  menu: Menu16;
  contextRefresh: ContextPackRefreshDecision | undefined;
  observed: {
    actions: Menu16;
    promptFlows: PromptFlowReadout;
    metrics: ScopedReadout;
    context: ContextReadout;
  };
}): Promise<AgentCliCycleResult> {
  const actionCommand = createContextPackAdvisoryPromotionDecisionCommand(input);
  if (!actionCommand.ok) {
    input.input.writeStderr?.(`agent CLI advisory-promotion decision failed: ${actionCommand.message}\n`);
    const actionResult = rejectAct(ActRejectionReason.MissingImplementation, actionCommand.message);
    return {
      exitCode: 1,
      actionResult,
      evidence: createAgentCliCycleEvidence(
        input.menu,
        { index: AGENT_CLI_ADVISORY_PROMOTION_DECISION_SLOT_INDEX, reason: "cli_advisory_promotion_decision_rejected" },
        input.observed.promptFlows,
        input.observed.metrics,
        input.observed.context,
        input.contextRefresh,
        actionResult,
      ),
    };
  }

  const actionSlot = createContextPackAdvisoryPromotionDecisionSlot(actionCommand.value);
  const actionResult: ActResult = {
    outcome: "dispatched",
    kind: "command",
    result: await input.input.runCommand(CommandType.AuthorContextPackAdvisoryPromotionDecision, actionCommand.value, actionSlot),
  };
  input.input.writeStdout?.(`action: ${formatActResult(actionResult)}\n`);
  return {
    exitCode: 0,
    actionResult,
    evidence: createAgentCliCycleEvidence(
      menuWithContextPackActionSlot(input.menu, actionSlot),
      { index: AGENT_CLI_ADVISORY_PROMOTION_DECISION_SLOT_INDEX, reason: "cli_advisory_promotion_decision" },
      input.observed.promptFlows,
      input.observed.metrics,
      input.observed.context,
      input.contextRefresh,
      actionResult,
    ),
  };
}

async function loadContextPackRefreshDecision(
  input: Pick<AgentCliCycleInput, "loadLatestContextPackSnapshot" | "now">,
  snapshot: AgentObserveSnapshot,
): Promise<{ ok: true; decision?: ContextPackRefreshDecision | undefined } | { ok: false; message: string }> {
  if (input.loadLatestContextPackSnapshot === undefined || snapshot.organizationId === undefined || snapshot.agentId === undefined) {
    return { ok: true };
  }
  try {
    const previous = await input.loadLatestContextPackSnapshot({
      organizationId: snapshot.organizationId,
      agentId: snapshot.agentId,
    });
    return {
      ok: true,
      decision: decideContextPackRefresh({
        current: snapshot,
        observedAt: input.now(),
        previous,
      }),
    };
  } catch (error) {
    return { ok: false, message: extractErrorMessage(error) };
  }
}

async function tryRecordContextPackSnapshot(
  record: ContextPackSnapshotStorePort["record"],
  snapshot: ContextPackSnapshotRecord,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await record(snapshot);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: extractErrorMessage(error) };
  }
}

async function loadContextPackInboxWorkflow(
  input: Pick<AgentCliCycleInput, "loadContextPackInboxWorkflow" | "now">,
  parsed: ParsedAgentCliArgs,
): Promise<{ ok: true; view?: ContextPackInboxWorkflowView | undefined } | { ok: false; message: string }> {
  if (input.loadContextPackInboxWorkflow === undefined) {
    return { ok: true };
  }
  try {
    return {
      ok: true,
      view: await input.loadContextPackInboxWorkflow({
        organizationId: parsed.organizationId,
        projectId: parsed.projectId,
        ...(parsed.teamId === undefined ? {} : { teamId: parsed.teamId }),
        targetHatAssignmentId: parsed.hatAssignmentId,
        targetAgentId: parsed.agentId,
        observedAt: input.now(),
      }),
    };
  } catch (error) {
    return { ok: false, message: extractErrorMessage(error) };
  }
}

async function loadContextPackAdvisoryPromotionDecisions(
  input: Pick<AgentCliCycleInput, "loadContextPackAdvisoryPromotionDecisions">,
  snapshot: AgentObserveSnapshot,
  observed: {
    readout: ContextPackBuildRequest["readout"];
    metrics: ContextPackBuildRequest["metrics"];
    promptFlows: ContextPackBuildRequest["promptFlows"];
    hierarchy: ContextPackBuildRequest["hierarchy"];
    context: ContextReadout;
  },
  contextRefresh: ContextPackRefreshDecision | undefined,
): Promise<
  | { ok: true; decisions?: readonly ContextPackAdvisoryPromotionDecision[] | undefined }
  | { ok: false; message: string; decisions?: undefined }
> {
  if (input.loadContextPackAdvisoryPromotionDecisions === undefined) {
    return { ok: true };
  }
  try {
    return {
      ok: true,
      decisions: await input.loadContextPackAdvisoryPromotionDecisions(
        contextPackAdvisoryPromotionPolicyRequestForAgentCliPreview(
          contextPackBuildRequestForAgentCliPreview(snapshot, observed, contextRefresh),
          observed.context.pack,
        ),
      ),
    };
  } catch (error) {
    return { ok: false, message: extractErrorMessage(error) };
  }
}

function createContextPackInboxWorkflowActionCommand(input: {
  args: ParsedAgentCliArgs & { inboxAction: ContextPackInboxWorkflowActionKindType; inboxAnchorId: string };
  inboxWorkflow: ContextPackInboxWorkflowView | undefined;
}): { ok: true; value: unknown } | { ok: false; message: AgentCliInboxWorkflowActionErrorMessage } {
  if (input.inboxWorkflow === undefined) {
    return { ok: false, message: AgentCliInboxWorkflowActionErrorMessage.LoaderMissing };
  }
  const item = contextPackInboxWorkflowItemFor(input.inboxWorkflow, input.args.inboxAnchorId);
  if (item === undefined) {
    return { ok: false, message: AgentCliInboxWorkflowActionErrorMessage.WorkflowItemMissing };
  }
  const action = item.actions.find((candidate) => candidate.kind === input.args.inboxAction);
  if (action === undefined) {
    return { ok: false, message: AgentCliInboxWorkflowActionErrorMessage.ActionUnavailable };
  }
  if (action.requiresSnoozedUntil && input.args.inboxSnoozedUntil === undefined) {
    return { ok: false, message: AgentCliInboxWorkflowActionErrorMessage.SnoozedUntilRequired };
  }

  return {
    ok: true,
    value: {
      commandId: `cmd-inbox-${input.args.runId}-${item.inboxAnchorId}-${action.kind}`,
      type: CommandType.UpdateContextPackInboxAnchorStatus,
      idempotencyKey: `observe-inbox:${input.args.runId}:${input.args.hatAssignmentId}:${input.args.phase}:${item.inboxAnchorId}:${action.kind}`,
      requestHash: [
        CommandType.UpdateContextPackInboxAnchorStatus,
        input.args.runId,
        input.args.hatAssignmentId,
        input.args.phase,
        item.inboxAnchorId,
        action.kind,
        action.targetStatus,
      ].join(":"),
      correlationId: `observe-cli-${input.args.runId}`,
      causationId: `observe-cli-${input.args.runId}`,
      traceId: `observe-cli-${input.args.runId}`,
      organizationId: item.organizationId,
      projectId: item.projectId,
      ...createOptionalCommandString("teamId", item.teamId),
      ...createOptionalCommandString("workItemId", item.workItemId),
      actor: {
        agentId: input.args.agentId,
        hatAssignmentId: input.args.hatAssignmentId,
      },
      inboxAnchorId: item.inboxAnchorId,
      targetHatAssignmentId: item.targetHatAssignmentId,
      ...createOptionalCommandString("targetAgentId", item.targetAgentId),
      status: action.targetStatus,
      ...createOptionalCommandString(
        "snoozedUntil",
        action.targetStatus === ContextPackInboxAnchorStatus.Snoozed ? input.args.inboxSnoozedUntil : undefined,
      ),
    },
  };
}

function createContextPackAdvisoryPromotionDecisionCommand(input: {
  args: ParsedAgentCliArgs & { contextAdvisoryPromotionDecision: AgentCliContextPackAdvisoryPromotionDecisionArgs };
  observed: { context: ContextReadout };
}): { ok: true; value: unknown } | { ok: false; message: AgentCliContextPackAdvisoryPromotionErrorMessage } {
  const item = input.observed.context.pack.items.find((candidate) =>
    candidate.id === input.args.contextAdvisoryPromotionDecision.itemId
  );
  if (item === undefined) {
    return { ok: false, message: AgentCliContextPackAdvisoryPromotionErrorMessage.ItemMissing };
  }
  if (item.kind !== ContextPackItemKind.SynthesisGapHypothesis) {
    return { ok: false, message: AgentCliContextPackAdvisoryPromotionErrorMessage.ItemNotPromotable };
  }

  return {
    ok: true,
    value: {
      commandId: `cmd-advisory-promotion-${input.args.runId}-${item.id}-${input.args.contextAdvisoryPromotionDecision.status}`,
      type: CommandType.AuthorContextPackAdvisoryPromotionDecision,
      idempotencyKey: `observe-advisory-promotion:${input.args.runId}:${input.args.hatAssignmentId}:${input.args.phase}:${item.id}:${input.args.contextAdvisoryPromotionDecision.status}`,
      requestHash: [
        CommandType.AuthorContextPackAdvisoryPromotionDecision,
        input.args.runId,
        input.args.hatAssignmentId,
        input.args.phase,
        item.id,
        input.args.contextAdvisoryPromotionDecision.status,
        input.args.contextAdvisoryPromotionDecision.lifecycleBlocker,
      ].join(":"),
      correlationId: `observe-cli-${input.args.runId}`,
      causationId: `observe-cli-${input.args.runId}`,
      traceId: `observe-cli-${input.args.runId}`,
      organizationId: input.args.organizationId,
      projectId: input.args.projectId,
      ...createOptionalCommandString("teamId", input.args.teamId),
      ...createOptionalCommandString("workItemId", input.args.workItemId),
      actor: {
        agentId: input.args.agentId,
        hatAssignmentId: input.args.hatAssignmentId,
      },
      hatId: input.args.hatId,
      hatAssignmentId: input.args.hatAssignmentId,
      ...createOptionalCommandString("curationProfileId", input.observed.context.pack.curationPlan?.profileId),
      status: input.args.contextAdvisoryPromotionDecision.status,
      lifecycleBlocker: input.args.contextAdvisoryPromotionDecision.lifecycleBlocker,
      fingerprint: contextPackAdvisoryPromotionFingerprint(item),
      evidenceRefs: contextPackAdvisoryPromotionDecisionEvidenceRefs(item),
    },
  };
}

function contextPackBuildRequestForAgentCliPreview(
  snapshot: AgentObserveSnapshot,
  observed: {
    readout: ContextPackBuildRequest["readout"];
    metrics: ContextPackBuildRequest["metrics"];
    promptFlows: ContextPackBuildRequest["promptFlows"];
    hierarchy: ContextPackBuildRequest["hierarchy"];
  },
  contextRefresh: ContextPackRefreshDecision | undefined,
): ContextPackBuildRequest {
  return {
    snapshot,
    readout: observed.readout,
    metrics: observed.metrics,
    promptFlows: observed.promptFlows,
    hierarchy: observed.hierarchy,
    observedAt: observed.readout.observedAt,
    ...(contextRefresh === undefined ? {} : { wakeContext: contextRefresh }),
  };
}

function contextPackCompletenessPolicyRequestForAgentCliPreview(
  request: ContextPackBuildRequest,
  items: ContextPackCompletenessPolicyRequest["items"],
): ContextPackCompletenessPolicyRequest {
  return {
    query: AGENT_CLI_TENANT_CONTEXT_PACK_COMPLETENESS_PREVIEW_QUERY,
    observedAt: request.observedAt,
    request,
    documentUnits: [],
    items,
  };
}

function contextPackSynthesisRequirementPolicyRequestForAgentCliPreview(
  request: ContextPackBuildRequest,
  pack: ContextReadout["pack"],
): ContextPackSynthesisRequirementPolicyRequest {
  return {
    request,
    curationPlan: pack.curationPlan ?? AGENT_CLI_TENANT_CONTEXT_PACK_EMPTY_CURATION_PLAN,
    items: pack.items,
    omissions: pack.omittedItemsWithReason,
  };
}

function contextPackAdvisoryPromotionPolicyRequestForAgentCliPreview(
  request: ContextPackBuildRequest,
  pack: ContextReadout["pack"],
): ContextPackAdvisoryPromotionPolicyRequest {
  return {
    query: AGENT_CLI_CONTEXT_PACK_ADVISORY_PROMOTION_STATUS_QUERY,
    observedAt: request.observedAt,
    request,
    deterministicItems: pack.items.filter((item) => item.kind !== ContextPackItemKind.SynthesisGapHypothesis),
    advisoryItems: pack.items.filter((item) => item.kind === ContextPackItemKind.SynthesisGapHypothesis),
    omissions: pack.omittedItemsWithReason,
    curationPlan: pack.curationPlan ?? AGENT_CLI_TENANT_CONTEXT_PACK_EMPTY_CURATION_PLAN,
  };
}

function contextPackInboxWorkflowItemFor(
  workflow: ContextPackInboxWorkflowView,
  inboxAnchorId: string,
): ContextPackInboxWorkflowView["batches"][number]["items"][number] | undefined {
  return workflow.batches
    .flatMap((batch) => batch.items)
    .find((item) => item.inboxAnchorId === inboxAnchorId);
}

function createContextPackInboxWorkflowActionSlot(
  action: ContextPackInboxWorkflowActionKindType,
  command: unknown,
): Menu16Slot {
  return {
    index: AGENT_CLI_INBOX_ACTION_SLOT_INDEX,
    direction: AGENT_CLI_INBOX_ACTION_DIRECTION,
    label: action,
    availability: TriAvailability.True,
    impl: {
      kind: "command",
      commandType: CommandType.UpdateContextPackInboxAnchorStatus,
      command,
    },
  };
}

function createContextPackAdvisoryPromotionDecisionSlot(command: unknown): Menu16Slot {
  return {
    index: AGENT_CLI_ADVISORY_PROMOTION_DECISION_SLOT_INDEX,
    direction: AGENT_CLI_ADVISORY_PROMOTION_DECISION_DIRECTION,
    label: CommandType.AuthorContextPackAdvisoryPromotionDecision,
    availability: TriAvailability.True,
    impl: {
      kind: "command",
      commandType: CommandType.AuthorContextPackAdvisoryPromotionDecision,
      command,
    },
  };
}

function menuWithInboxWorkflowActionSlot(menu: Menu16, actionSlot: Menu16Slot): Menu16 {
  return menuWithContextPackActionSlot(menu, actionSlot);
}

function menuWithContextPackActionSlot(menu: Menu16, actionSlot: Menu16Slot): Menu16 {
  return {
    slots: [...menu.slots, actionSlot],
    ...createOptionalMenuPage(menu.page),
  };
}

function contextPackAdvisoryPromotionDecisionEvidenceRefs(item: ContextPackItem): readonly string[] {
  return uniqueSorted([
    item.id,
    item.sourceRef,
    ...(item.citationRefs ?? []),
  ]);
}

function createOptionalMenuPage(page: Menu16["page"] | undefined): { page?: Menu16["page"] } {
  return page === undefined ? {} : { page };
}

function createOptionalCommandString<K extends string>(
  key: K,
  value: string | undefined,
): { [P in K]?: string } {
  return value === undefined ? {} : { [key]: value } as { [P in K]?: string };
}

function createMenuSelectionSurface(
  observed: {
    context: ContextReadout;
    metrics: ScopedReadout;
    promptFlows: PromptFlowReadout;
    hierarchy: HierarchyReadout;
  },
  inboxWorkflow: ContextPackInboxWorkflowView | undefined,
): MenuSelectionSurface {
  return {
    context: observed.context,
    ...(inboxWorkflow === undefined ? {} : { inboxWorkflow }),
    metrics: observed.metrics,
    promptFlows: observed.promptFlows,
    hierarchy: observed.hierarchy,
  };
}

async function loadPromptFlowContextFromRequest(
  request: PromptFlowContextRequest,
): Promise<PromptFlowContext> {
  return {
    taskId: request.taskId,
    promptFlowId: request.promptFlowId,
    directions: request.directions,
    toolInjections: request.toolInjections,
    metrics: request.metrics,
    contextArtifacts: request.contextArtifactRefs.map((ref): PromptFlowContextArtifact => ({
      id: ref,
      label: ref,
      value: ref,
    })),
    ...copyPromptFlowRequestMetadata(request),
  };
}

function createOptionalScheduleBlocks(
  scheduleBlocks: readonly WorkScheduleBlock[] | undefined,
): { scheduleBlocks?: readonly WorkScheduleBlock[] } {
  return scheduleBlocks === undefined ? {} : { scheduleBlocks };
}

function createOptionalAvailableSecretScopes(
  availableSecretScopes: readonly string[] | undefined,
): { availableSecretScopes?: readonly string[] } {
  return availableSecretScopes === undefined ? {} : { availableSecretScopes };
}

function createOptionalSlotAuthorizer(
  authorizeSlot: AgentCliCycleInput["authorizeSlot"],
): Pick<ActDependencies, "authorizeSlot"> {
  return authorizeSlot === undefined ? {} : { authorizeSlot };
}

function materializeCommand(
  commandType: string,
  command: unknown,
  slot: Menu16Slot,
  args: ParsedAgentCliArgs,
): unknown {
  if (commandType !== ObserveCommandType.LifecycleTransition || !isLifecycleTransitionPayload(command)) {
    if (commandType === CommandType.SendSupervisorSignal && isSupervisorSignalPayload(command)) {
      return {
        commandId: `cmd-observe-${args.runId}-${slot.index}`,
        type: CommandType.SendSupervisorSignal,
        idempotencyKey: `observe:${args.runId}:${args.hatAssignmentId}:${args.phase}:${slot.index}`,
        requestHash: [
          CommandType.SendSupervisorSignal,
          args.runId,
          args.hatAssignmentId,
          args.phase,
          slot.index,
          command.targetHatAssignmentId,
        ].join(":"),
        correlationId: `observe-cli-${args.runId}`,
        causationId: `observe-cli-${args.runId}`,
        traceId: `observe-cli-${args.runId}`,
        organizationId: args.organizationId,
        projectId: args.projectId,
        workItemId: args.workItemId,
        actor: {
          agentId: args.agentId,
          hatAssignmentId: args.hatAssignmentId,
        },
        ...command,
      };
    }
    return command;
  }

  return {
    commandId: `cmd-observe-${args.runId}-${slot.index}`,
    type: ObserveCommandType.LifecycleTransition,
    idempotencyKey: `observe:${args.runId}:${args.hatAssignmentId}:${args.phase}:${slot.index}`,
    requestHash: [
      ObserveCommandType.LifecycleTransition,
      args.runId,
      args.hatAssignmentId,
      args.phase,
      command.actionType,
      command.toPhase,
      slot.index,
    ].join(":"),
    correlationId: `observe-cli-${args.runId}`,
    causationId: `observe-cli-${args.runId}`,
    traceId: `observe-cli-${args.runId}`,
    organizationId: args.organizationId,
    projectId: args.projectId,
    workItemId: args.workItemId,
    actor: {
      agentId: args.agentId,
      hatAssignmentId: args.hatAssignmentId,
    },
    ...createOptionalObserveLifecyclePolicyContext(command.actionType),
    ...command,
  };
}

function createOptionalObserveLifecyclePolicyContext(actionType: string): { policyContext?: { toolType: ActionClass } } {
  const toolType = ACTION_CLASS_FOR_OBSERVE_LIFECYCLE[actionType];
  return toolType === undefined ? {} : { policyContext: { toolType } };
}

const ACTION_CLASS_FOR_OBSERVE_LIFECYCLE: Readonly<Record<string, ActionClass>> = {
  execute: ActionClass.WriteCode,
  request_review: ActionClass.ReviewCode,
  complete: ActionClass.ApproveReview,
  rework: ActionClass.WriteCode,
  resume: ActionClass.WriteCode,
};

function createAgentCliCycleEvidence(
  menu: Menu16,
  selection: MenuSelectionResult,
  promptFlows: PromptFlowReadout,
  metrics: ScopedReadout,
  context: ContextReadout,
  contextRefresh?: ContextPackRefreshDecision | undefined,
  actionResult?: ActResult | undefined,
): AgentCliCycleEvidence {
  return {
    menuHash: hashMenu(menu),
    selectedIndex: selection.index,
    ...selectedImplKindEvidence(menu, selection.index),
    ...(actionResult === undefined ? {} : { actionOutcome: actionResult.outcome }),
    vetoCount: menu.slots.filter((slot) => slot.availability === TriAvailability.False).length,
    trueSlotCount: menu.slots.filter((slot) => slot.availability === TriAvailability.True).length,
    ...selectedStatusEvidence(actionResult),
    ...selectedCommandEvidence(menu, selection.index),
    ...createOptionalEvidenceNumber("promptFlowPage", menu.page?.promptFlows?.page),
    ...selectedPromptFlowEvidence(menu, selection.index),
    ...(actionResult?.outcome === "reobserve" ? createOptionalEvidenceNumber("reobservePromptFlowPage", actionResult.menuPage?.promptFlows) : {}),
    ...contextPackEvidence(context),
    ...contextPackRefreshEvidence(contextRefresh),
    promptFlowIds: uniqueSorted([
      ...promptFlows.tasks.map((task) => task.promptFlowId),
      ...promptFlows.vetoedTasks.map((vetoed) => vetoed.task.promptFlowId),
    ]),
    metricBlockIds: uniqueSorted(metrics.blocks.map((block) => block.id)),
    selectorRejections: selection.selectorRejection === undefined ? [] : [selection.selectorRejection],
    ...(actionResult?.outcome === "rejected" ? { actionRejectionReason: actionResult.reason } : {}),
  };
}

function contextPackRefreshEvidence(
  decision: ContextPackRefreshDecision | undefined,
): Pick<
  AgentCliCycleEvidence,
  "contextRefreshReason" | "contextRefreshRequiresBuild" | "previousContextPackId" | "previousContextPackStatus"
> {
  if (decision === undefined) return {};
  return {
    contextRefreshReason: decision.reason,
    contextRefreshRequiresBuild: decision.requiresBuild,
    ...(decision.previousContextPackId === undefined ? {} : { previousContextPackId: decision.previousContextPackId }),
    ...(decision.previousStatus === undefined ? {} : { previousContextPackStatus: decision.previousStatus }),
  };
}

function contextPackEvidence(context: ContextReadout): Pick<
  AgentCliCycleEvidence,
  | "contextPackId"
  | "contextPackStatus"
  | "contextRequiredItemCount"
  | "contextOptionalItemCount"
  | "contextOmissionCount"
  | "contextContradictionCount"
  | "contextStaleInputCount"
  | "contextLifecycleBlockerCount"
  | "contextRequiredItemIds"
  | "contextSourceGraphVersion"
  | "contextPolicyVersion"
  | "contextCurationStages"
  | "contextSourcePointerRefs"
  | "contextSnapshot"
> {
  return {
    contextPackId: context.pack.id,
    contextPackStatus: context.status,
    contextSnapshot: context,
    contextRequiredItemCount: context.summary.requiredItemCount,
    contextOptionalItemCount: context.summary.optionalItemCount,
    contextOmissionCount: context.summary.omissionCount,
    contextContradictionCount: context.summary.contradictionCount,
    contextStaleInputCount: context.summary.staleInputCount,
    contextLifecycleBlockerCount: context.summary.lifecycleBlockerCount,
    contextRequiredItemIds: uniqueSorted(context.requiredItems.map((item) => item.id)),
    contextSourceGraphVersion: context.pack.sourceGraphVersion,
    contextPolicyVersion: context.pack.policyVersion,
    contextCurationStages: uniqueSorted(context.pack.curationTrace.map((stage) => stage.stage)),
    contextSourcePointerRefs: uniqueSorted(context.pack.items.flatMap((item) =>
      (item.sourcePointers ?? []).map(contextSourcePointerEvidenceRef),
    )),
  };
}

function contextSourcePointerEvidenceRef(pointer: ContextPackSourcePointer): string {
  switch (pointer.kind) {
    case ContextPackSourcePointerKind.DocUnit:
      return `doc_unit:${pointer.docUnitId}:${pointer.version}`;
    case ContextPackSourcePointerKind.GitBlob:
      return `git_blob:${pointer.path}:${pointer.commitSha ?? "unknown"}:${pointer.blobSha ?? "unknown"}`;
    case ContextPackSourcePointerKind.GraphNode:
      return `graph_node:${pointer.nodeId}`;
    case ContextPackSourcePointerKind.GraphEdge:
      return `graph_edge:${pointer.edgeId}`;
    case ContextPackSourcePointerKind.HindsightMemory:
      return `hindsight_memory:${pointer.providerId}:${pointer.memoryId}`;
    case ContextPackSourcePointerKind.WorkItem:
      return `work_item:${pointer.workItemId}`;
    case ContextPackSourcePointerKind.Decision:
      return `decision:${pointer.decisionId}`;
    case ContextPackSourcePointerKind.Discussion:
      return `discussion:${pointer.discussionId}`;
    case ContextPackSourcePointerKind.InboxAnchor:
      return `inbox_anchor:${pointer.inboxAnchorId}:${pointer.targetHatAssignmentId ?? "unknown"}:${pointer.targetAgentId ?? "unknown"}`;
    case ContextPackSourcePointerKind.Meeting:
      return `meeting:${pointer.meetingId}`;
    case ContextPackSourcePointerKind.QualityGate:
      return `quality_gate:${pointer.qualityGateEvaluationId}`;
    case ContextPackSourcePointerKind.ScheduleBlock:
      return `schedule_block:${pointer.workScheduleBlockId}`;
    case ContextPackSourcePointerKind.SupervisorSignal:
      return `supervisor_signal:${pointer.supervisorSignalId}`;
    case ContextPackSourcePointerKind.Trace:
      return `trace:${pointer.traceId}`;
    case ContextPackSourcePointerKind.Metric:
      return `metric:${pointer.source}:${pointer.query}:${pointer.seriesId ?? "unknown"}`;
    case ContextPackSourcePointerKind.Log:
      return `log:${pointer.source}:${pointer.query}:${pointer.logRef}`;
    case ContextPackSourcePointerKind.Policy:
      return `policy:${pointer.policyId}:${pointer.version ?? "unknown"}`;
  }
}

function hashMenu(menu: Menu16): string {
  const stable = {
    page: menu.page ?? null,
    slots: menu.slots.map((slot) => ({
      index: slot.index,
      direction: slot.direction,
      label: slot.label,
      availability: slot.availability,
      reason: slot.reason ?? null,
      impl: stableSlotImpl(slot),
      actionType: slot.action?.actionType ?? null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function stableSlotImpl(slot: Menu16Slot): unknown {
  switch (slot.impl?.kind) {
    case undefined:
      return null;
    case "prompt_flow":
      return {
        kind: slot.impl.kind,
        taskId: slot.impl.request.taskId,
        promptFlowId: slot.impl.request.promptFlowId,
      };
    case "observe":
      return {
        kind: slot.impl.kind,
        toScope: slot.impl.toScope,
        menuPage: slot.impl.menuPage ?? null,
      };
    case "status":
      return {
        kind: slot.impl.kind,
        statusKind: slot.impl.status.kind,
        scope: slot.impl.status.scope,
        phase: slot.impl.status.phase,
        metricBlockIds: slot.impl.status.metricBlockIds,
        promptFlowIds: slot.impl.status.promptFlowIds,
        hierarchy: slot.impl.status.hierarchy ?? null,
      };
    case "rest":
      return {
        kind: slot.impl.kind,
        reason: slot.impl.reason,
      };
    case "history_retract":
      return {
        kind: slot.impl.kind,
        reason: slot.impl.reason,
      };
    case "history_redo":
      return {
        kind: slot.impl.kind,
        reason: slot.impl.reason,
      };
    case "grammar_branch":
      return {
        kind: slot.impl.kind,
        reason: slot.impl.reason,
      };
    case "command":
      return {
        kind: slot.impl.kind,
        commandType: slot.impl.commandType,
      };
    case "mcp":
      return {
        kind: slot.impl.kind,
        tool: slot.impl.tool,
      };
  }
}

function selectedStatusEvidence(
  actionResult: ActResult | undefined,
): Pick<AgentCliCycleEvidence, "statusSignalKind" | "statusScope" | "statusPhase" | "statusHierarchyPriorityScope"> {
  if (actionResult?.outcome !== "status_report") return {};
  return {
    statusSignalKind: actionResult.status.kind,
    statusScope: actionResult.status.scope,
    statusPhase: actionResult.status.phase,
    ...(actionResult.status.hierarchy === undefined ? {} : {
      statusHierarchyPriorityScope: actionResult.status.hierarchy.priorityScope,
    }),
  };
}

function selectedPromptFlowEvidence(
  menu: Menu16,
  selectedIndex: number,
): { selectedPromptFlowTaskId?: string; selectedPromptFlowId?: string } {
  const selected = menu.slots.find((slot) => slot.index === selectedIndex);
  if (selected?.impl?.kind !== "prompt_flow") return {};
  return {
    selectedPromptFlowTaskId: selected.impl.request.taskId,
    selectedPromptFlowId: selected.impl.request.promptFlowId,
  };
}

function selectedCommandEvidence(
  menu: Menu16,
  selectedIndex: number,
): { selectedCommandType?: string } {
  const selected = menu.slots.find((slot) => slot.index === selectedIndex);
  return selected?.impl?.kind === "command" ? { selectedCommandType: selected.impl.commandType } : {};
}

function selectedImplKindEvidence(
  menu: Menu16,
  selectedIndex: number,
): { selectedImplKind?: string } {
  const selected = menu.slots.find((slot) => slot.index === selectedIndex);
  return selected?.impl?.kind === undefined ? {} : { selectedImplKind: selected.impl.kind };
}

function createOptionalEvidenceNumber<K extends string>(
  key: K,
  value: number | undefined,
): { [P in K]?: number } {
  return value === undefined ? {} : { [key]: value } as { [P in K]?: number };
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildMenuSelectorPrompt(selectable: readonly Menu16Slot[], surface: MenuSelectionSurface | undefined): string {
  return [
    "Selectable slots:",
    ...selectable.map((slot) => `[${String(slot.index).padStart(2, "0")}] ${slot.direction} ${slot.label}`),
    ...formatMenuSelectionSurface(surface),
    "Return exactly this JSON shape: {\"slot\": <one listed integer>, \"reason\": \"short reason\"}.",
  ].join("\n");
}

function formatMenuSelectionSurface(surface: MenuSelectionSurface | undefined): readonly string[] {
  if (surface === undefined) return [];
  return [
    ...formatSelectorContext(surface.context),
    ...formatSelectorInboxWorkflow(surface.inboxWorkflow),
    ...formatSelectorMetrics(surface.metrics),
  ];
}

function formatSelectorContext(context: ContextReadout | undefined): readonly string[] {
  if (context === undefined) return [];
  return [
    `Context pack: ${context.status} ${context.pack.id}`,
    `Context summary: required=${context.summary.requiredItemCount} optional=${context.summary.optionalItemCount} omissions=${context.summary.omissionCount} contradictions=${context.summary.contradictionCount} stale=${context.summary.staleInputCount} blockers=${context.summary.lifecycleBlockerCount}`,
    ...formatSelectorContextItems("Required context:", context.requiredItems),
    ...formatSelectorAttentionLanes(context),
    `Context omissions: ${context.summary.omissionCount}`,
  ];
}

function formatSelectorContextItems(label: string, items: readonly ContextReadout["requiredItems"][number][]): readonly string[] {
  if (items.length === 0) return [];
  return [
    label,
    ...items.slice(0, 5).map((item) => `- ${item.kind} ${item.id}: ${item.title}`),
  ];
}

function formatSelectorAttentionLanes(context: ContextReadout): readonly string[] {
  const lanes = context.pack.curationPlan?.lanes ?? [];
  if (lanes.length === 0) return [];
  return [
    "Attention lanes:",
    ...lanes.map((lane) =>
      `- ${lane.kind} priority=${lane.priority} required=${String(lane.required)} refs=${formatAttentionLaneRefs(lane.refs)} objective=${lane.objective}`
    ),
    ...formatSelectorAttentionLaneDetails(context),
  ];
}

function formatSelectorAttentionLaneDetails(context: ContextReadout): readonly string[] {
  const lanes = context.pack.curationPlan?.lanes ?? [];
  if (lanes.length === 0) return [];
  const details = lanes
    .flatMap((lane) => lane.refs.slice(0, 3).map((ref) => formatSelectorAttentionLaneRefDetail(lane.kind, ref, context)));
  if (details.length === 0) return [];
  return [
    "Attention lane details:",
    ...details,
  ];
}

function formatSelectorAttentionLaneRefDetail(
  laneKind: ContextPackAttentionLaneKind,
  ref: ContextPackAttentionLaneRef,
  context: ContextReadout,
): string {
  switch (ref.kind) {
    case ContextPackAttentionLaneRefKind.Item: {
      const item = context.pack.items.find((candidate) => candidate.id === ref.itemId);
      return item === undefined
        ? `- lane=${laneKind} missing item ${ref.itemId}`
        : `- lane=${laneKind} item ${item.kind} ${item.id}: ${item.title}`;
    }
    case ContextPackAttentionLaneRefKind.Omission: {
      const omission = context.omittedItemsWithReason.find((candidate) =>
        candidate.nodeId === ref.omissionRef || `omission:${candidate.reason}` === ref.omissionRef
      );
      return omission === undefined
        ? `- lane=${laneKind} missing omission ${ref.omissionRef}`
        : `- lane=${laneKind} omission ${omission.reason}${omission.nodeId === undefined ? "" : ` ${omission.nodeId}`}: ${omission.message}`;
    }
    case ContextPackAttentionLaneRefKind.LegalAction:
      return `- lane=${laneKind} legal action ${ref.actionType}`;
    case ContextPackAttentionLaneRefKind.ScopeAnchor:
      return `- lane=${laneKind} scope anchor ${ref.anchorRef}`;
  }
}

function formatSelectorInboxWorkflow(inboxWorkflow: ContextPackInboxWorkflowView | undefined): readonly string[] {
  if (inboxWorkflow === undefined) return [];
  return [
    `Inbox workflow: total=${inboxWorkflow.summary.totalVisibleCount} urgent=${inboxWorkflow.summary.urgentUnreadCount} normal=${inboxWorkflow.summary.normalUnreadCount} due=${inboxWorkflow.summary.snoozedDueCount} future=${inboxWorkflow.summary.snoozedFutureCount} read=${inboxWorkflow.summary.readCount}`,
    ...inboxWorkflow.batches.flatMap((batch) =>
      batch.items.slice(0, 3).map((item) =>
        `- ${batch.kind} ${item.inboxAnchorId} ${item.priority}/${item.status}${formatInboxWorkflowSnooze(item)}: ${item.title} actions=${item.actions.map((action) => action.kind).join(",")}`
      )
    ).slice(0, 5),
  ];
}

function formatSelectorMetrics(metrics: ScopedReadout | undefined): readonly string[] {
  if (metrics === undefined || metrics.blocks.length === 0) return [];
  return [
    "Metrics:",
    ...metrics.blocks.slice(0, 5).map((block) => `- ${block.label}: ${block.value}${block.unit === undefined ? "" : ` ${block.unit}`}`),
  ];
}

function buildMenuSelectionSchema(selectable: readonly Menu16Slot[]): {
  type: "object";
  additionalProperties: false;
  required: readonly ["slot", "reason"];
  properties: {
    slot: { type: "integer"; enum: readonly number[] };
    reason: { type: "string"; minLength: 1 };
  };
} {
  return {
    type: "object",
    additionalProperties: false,
    required: ["slot", "reason"],
    properties: {
      slot: { type: "integer", enum: selectable.map((slot) => slot.index) },
      reason: { type: "string", minLength: 1 },
    },
  };
}

function completionContent(completion: ChatCompletionResult): string {
  return typeof completion === "string" ? completion : completion.content;
}

function parseModelSelectedIndex(
  raw: string,
  menu: Menu16,
): { ok: true; index: number } | { ok: false; reason: SelectorRejectionReason; rejectedIndex?: number | undefined } {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, reason: SelectorRejectionReason.ParseFailure };
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return { ok: false, reason: SelectorRejectionReason.ParseFailure };
  }
  const slot = (decoded as { slot?: unknown }).slot;
  const reason = (decoded as { reason?: unknown }).reason;
  if (!Number.isInteger(slot) || typeof reason !== "string" || reason.trim().length === 0) {
    return { ok: false, reason: SelectorRejectionReason.ParseFailure };
  }
  const index = slot as number;
  if (index < 0 || index >= 16) {
    return { ok: false, reason: SelectorRejectionReason.SlotOutOfRange, rejectedIndex: index };
  }
  const renderedSlot = menu.slots.find((candidate) => candidate.index === index);
  if (renderedSlot?.availability !== TriAvailability.True) {
    return { ok: false, reason: SelectorRejectionReason.NonSelectableSlot, rejectedIndex: index };
  }
  return { ok: true, index };
}

function normalizeMenuSelectionResult(
  output: MenuSelectorOutput,
  defaultReason: string,
): MenuSelectionResult {
  return typeof output === "number" ? { index: output, reason: defaultReason } : output;
}

function createOptionalRejectedIndex(
  rejectedIndex: number | undefined,
): { rejectedIndex?: number } {
  return rejectedIndex === undefined ? {} : { rejectedIndex };
}

function isLifecycleTransitionPayload(value: unknown): value is LifecycleTransitionCommandPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Record<keyof LifecycleTransitionCommandPayload, unknown>>;
  return (
    typeof candidate.runId === "string" &&
    typeof candidate.fromPhase === "string" &&
    typeof candidate.actionType === "string" &&
    typeof candidate.toPhase === "string" &&
    typeof candidate.toScope === "string"
  );
}

function isSupervisorSignalPayload(
  value: unknown,
): value is {
  targetHatAssignmentId: string;
  title: string;
  message: string;
  policyContext: unknown;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.targetHatAssignmentId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.policyContext === "object" &&
    candidate.policyContext !== null
  );
}

function parseTenantContextPackCurationPreview(
  values: { flags: Map<string, string>; booleans: Set<string> },
): { ok: true; value?: AgentCliTenantContextPackCurationPreviewArgs | undefined } | { ok: false; message: string } {
  const previewRequested = values.booleans.has(AgentCliTenantContextPackCurationFlag.Preview);
  const profileValue = values.flags.get(AgentCliTenantContextPackCurationFlag.Profile);
  const requiredLaneValue = values.flags.get(AgentCliTenantContextPackCurationFlag.RequiredLane);
  const lanePriorityValue = values.flags.get(AgentCliTenantContextPackCurationFlag.LanePriority);
  const deterministicInstructionValue = values.flags.get(AgentCliTenantContextPackCurationFlag.DeterministicInstruction);
  const blockInheritedInstructions = values.booleans.has(AgentCliTenantContextPackCurationFlag.BlockInheritedInstructions);
  if (
    !previewRequested &&
    profileValue === undefined &&
    requiredLaneValue === undefined &&
    lanePriorityValue === undefined &&
    deterministicInstructionValue === undefined &&
    !blockInheritedInstructions
  ) {
    return { ok: true };
  }
  if (!previewRequested) {
    return { ok: false, message: `--${AgentCliTenantContextPackCurationFlag.Preview} is required for context curation authoring flags` };
  }

  const policy: TenantContextPackCurationPolicy = {};
  if (profileValue !== undefined) {
    if (!isTenantContextPackCurationProfileId(profileValue)) {
      return { ok: false, message: `unknown --${AgentCliTenantContextPackCurationFlag.Profile} '${profileValue}'` };
    }
    policy.profileId = profileValue as TenantContextPackCurationProfileId;
  }
  if (requiredLaneValue !== undefined) {
    if (!isTenantContextPackCurationLaneKind(requiredLaneValue)) {
      return { ok: false, message: `unknown --${AgentCliTenantContextPackCurationFlag.RequiredLane} '${requiredLaneValue}'` };
    }
    policy.requiredLanes = [requiredLaneValue as TenantContextPackCurationLaneKind];
  }
  if (lanePriorityValue !== undefined) {
    const parsed = parseTenantContextPackCurationLanePriority(lanePriorityValue);
    if (!parsed.ok) return parsed;
    policy.lanePriorityOverrides = { [parsed.kind]: parsed.priority };
  }
  if (deterministicInstructionValue !== undefined) {
    if (!isTenantContextPackCurationInstruction(deterministicInstructionValue)) {
      return { ok: false, message: `unknown --${AgentCliTenantContextPackCurationFlag.DeterministicInstruction} '${deterministicInstructionValue}'` };
    }
    policy.deterministicInstructions = [deterministicInstructionValue as TenantContextPackCurationInstruction];
  }
  if (blockInheritedInstructions) {
    policy.blocksInheritedDeterministicInstructions = true;
  }
  return { ok: true, value: { policy } };
}

function parseTenantContextPackCurationLanePriority(
  value: string,
): { ok: true; kind: TenantContextPackCurationLaneKind; priority: number } | { ok: false; message: string } {
  const [kind, priorityValue, extra] = value.split(AGENT_CLI_TENANT_CONTEXT_PACK_LANE_PRIORITY_SEPARATOR);
  if (kind === undefined || priorityValue === undefined || extra !== undefined || !isTenantContextPackCurationLaneKind(kind)) {
    return { ok: false, message: `--${AgentCliTenantContextPackCurationFlag.LanePriority} must be <lane>=<non-negative-integer>` };
  }
  const priority = Number.parseInt(priorityValue, 10);
  if (!Number.isInteger(priority) || priority < 0 || String(priority) !== priorityValue) {
    return { ok: false, message: `--${AgentCliTenantContextPackCurationFlag.LanePriority} priority must be a non-negative integer` };
  }
  return { ok: true, kind: kind as TenantContextPackCurationLaneKind, priority };
}

function parseTenantContextPackCompletenessPreview(
  values: { flags: Map<string, string>; booleans: Set<string> },
): { ok: true; value?: AgentCliTenantContextPackCompletenessPreviewArgs | undefined } | { ok: false; message: string } {
  const previewRequested = values.booleans.has(AgentCliTenantContextPackCompletenessFlag.Preview);
  const requirementSetValue = values.flags.get(AgentCliTenantContextPackCompletenessFlag.RequirementSet);
  if (!previewRequested && requirementSetValue === undefined) {
    return { ok: true };
  }
  if (!previewRequested) {
    return { ok: false, message: `--${AgentCliTenantContextPackCompletenessFlag.Preview} is required for context completeness authoring flags` };
  }
  if (requirementSetValue === undefined) {
    return { ok: true, value: { policy: {} } };
  }
  if (!isTenantContextPackCompletenessRequirementSetId(requirementSetValue)) {
    return { ok: false, message: `unknown --${AgentCliTenantContextPackCompletenessFlag.RequirementSet} '${requirementSetValue}'` };
  }
  return {
    ok: true,
    value: {
      policy: {
        requirementSetIds: [requirementSetValue as TenantContextPackCompletenessRequirementSetIdType],
      },
    },
  };
}

function isTenantContextPackCompletenessRequirementSetId(
  value: string,
): value is TenantContextPackCompletenessRequirementSetIdType {
  return Object.values(TenantContextPackCompletenessRequirementSetId)
    .includes(value as TenantContextPackCompletenessRequirementSetIdType);
}

function parseTenantContextPackSynthesisRequirementPreview(
  values: { flags: Map<string, string>; booleans: Set<string> },
): { ok: true; value?: AgentCliTenantContextPackSynthesisRequirementPreviewArgs | undefined } | { ok: false; message: string } {
  const previewRequested = values.booleans.has(AgentCliTenantContextPackSynthesisRequirementFlag.Preview);
  const requirementSetValue = values.flags.get(AgentCliTenantContextPackSynthesisRequirementFlag.RequirementSet);
  if (!previewRequested && requirementSetValue === undefined) {
    return { ok: true };
  }
  if (!previewRequested) {
    return { ok: false, message: `--${AgentCliTenantContextPackSynthesisRequirementFlag.Preview} is required for context synthesis-requirement authoring flags` };
  }
  if (requirementSetValue === undefined) {
    return { ok: true, value: { policy: {} } };
  }
  if (!isTenantContextPackSynthesisRequirementSetId(requirementSetValue)) {
    return { ok: false, message: `unknown --${AgentCliTenantContextPackSynthesisRequirementFlag.RequirementSet} '${requirementSetValue}'` };
  }
  return {
    ok: true,
    value: {
      policy: {
        requirementSetIds: [requirementSetValue as TenantContextPackSynthesisRequirementSetIdType],
      },
    },
  };
}

function isTenantContextPackSynthesisRequirementSetId(
  value: string,
): value is TenantContextPackSynthesisRequirementSetIdType {
  return Object.values(TenantContextPackSynthesisRequirementSetId)
    .includes(value as TenantContextPackSynthesisRequirementSetIdType);
}

function parseContextPackAdvisoryPromotionDecision(
  values: { flags: Map<string, string>; booleans: Set<string> },
): { ok: true; value?: AgentCliContextPackAdvisoryPromotionDecisionArgs | undefined } | { ok: false; message: string } {
  const itemId = values.flags.get(AgentCliContextPackAdvisoryPromotionFlag.Item);
  const statusValue = values.flags.get(AgentCliContextPackAdvisoryPromotionFlag.Status);
  const lifecycleBlocker = values.flags.get(AgentCliContextPackAdvisoryPromotionFlag.Blocker);
  if (itemId === undefined && statusValue === undefined && lifecycleBlocker === undefined) {
    return { ok: true };
  }
  if (itemId === undefined || statusValue === undefined || lifecycleBlocker === undefined) {
    return { ok: false, message: AgentCliContextPackAdvisoryPromotionErrorMessage.FlagsIncomplete };
  }
  if (!isContextPackAdvisoryPromotionDecisionStatus(statusValue)) {
    return {
      ok: false,
      message: `${AgentCliContextPackAdvisoryPromotionErrorMessage.StatusUnknown} '${statusValue}'`,
    };
  }
  return {
    ok: true,
    value: {
      itemId,
      status: statusValue,
      lifecycleBlocker,
    },
  };
}

function isContextPackAdvisoryPromotionDecisionStatus(
  value: string,
): value is ContextPackAdvisoryPromotionDecisionStatusType {
  return Object.values(ContextPackAdvisoryPromotionDecisionStatus)
    .includes(value as ContextPackAdvisoryPromotionDecisionStatusType);
}

function parseFlags(args: readonly string[]): { ok: true; flags: Map<string, string>; booleans: Set<string> } | { ok: false; message: string } {
  const flags = new Map<string, string>();
  const booleans = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (
      token === "--gate-approved" ||
      token === "--evidence" ||
      token === `--${AgentCliTenantContextPackCurationFlag.Preview}` ||
      token === `--${AgentCliTenantContextPackCurationFlag.BlockInheritedInstructions}` ||
      token === `--${AgentCliTenantContextPackCompletenessFlag.Preview}` ||
      token === `--${AgentCliTenantContextPackSynthesisRequirementFlag.Preview}`
    ) {
      booleans.add(token.slice(2));
      continue;
    }
    if (token?.startsWith("--") !== true) {
      return { ok: false, message: `unexpected argument '${token}'` };
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return { ok: false, message: `missing value for ${token}` };
    }
    flags.set(token.slice(2), value);
    index += 1;
  }
  return { ok: true, flags, booleans };
}

function parseRunScope(value: string): RunScope | undefined {
  return Object.values(RunScope).includes(value as RunScope) ? (value as RunScope) : undefined;
}

function parseRunLifecyclePhase(value: string): RunLifecyclePhase | undefined {
  return Object.values(RunLifecyclePhase).includes(value as RunLifecyclePhase)
    ? (value as RunLifecyclePhase)
    : undefined;
}

function parseContextPackInboxWorkflowActionKind(
  value: string | undefined,
): ContextPackInboxWorkflowActionKindType | undefined {
  return value !== undefined && Object.values(ContextPackInboxWorkflowActionKind).includes(value as ContextPackInboxWorkflowActionKindType)
    ? value as ContextPackInboxWorkflowActionKindType
    : undefined;
}

function createOptionalSelectIndex(selectIndex: number | undefined): { selectIndex?: number } {
  return selectIndex === undefined ? {} : { selectIndex };
}

function createOptionalPromptFlowPage(promptFlowPage: number | undefined): { promptFlowPage?: number } {
  return promptFlowPage === undefined ? {} : { promptFlowPage };
}

function createOptionalInboxWorkflowAction(
  inboxAnchorId: string | undefined,
  inboxAction: ContextPackInboxWorkflowActionKindType | undefined,
  inboxSnoozedUntil: string | undefined,
): Pick<ParsedAgentCliArgs, "inboxAnchorId" | "inboxAction" | "inboxSnoozedUntil"> {
  return {
    ...(inboxAnchorId === undefined ? {} : { inboxAnchorId }),
    ...(inboxAction === undefined ? {} : { inboxAction }),
    ...(inboxSnoozedUntil === undefined ? {} : { inboxSnoozedUntil }),
  };
}

function createOptionalTenantContextPackCurationPreview(
  preview: AgentCliTenantContextPackCurationPreviewArgs | undefined,
): Pick<ParsedAgentCliArgs, "contextCurationPreview"> {
  return preview === undefined ? {} : { contextCurationPreview: preview };
}

function createOptionalTenantContextPackCompletenessPreview(
  preview: AgentCliTenantContextPackCompletenessPreviewArgs | undefined,
): Pick<ParsedAgentCliArgs, "contextCompletenessPreview"> {
  return preview === undefined ? {} : { contextCompletenessPreview: preview };
}

function createOptionalTenantContextPackSynthesisRequirementPreview(
  preview: AgentCliTenantContextPackSynthesisRequirementPreviewArgs | undefined,
): Pick<ParsedAgentCliArgs, "contextSynthesisRequirementPreview"> {
  return preview === undefined ? {} : { contextSynthesisRequirementPreview: preview };
}

function createOptionalContextPackAdvisoryPromotionDecision(
  decision: AgentCliContextPackAdvisoryPromotionDecisionArgs | undefined,
): Pick<ParsedAgentCliArgs, "contextAdvisoryPromotionDecision"> {
  return decision === undefined ? {} : { contextAdvisoryPromotionDecision: decision };
}

function createOptionalMetricAgents(
  metricAgents: readonly ScopedMetricAgent[] | undefined,
): { metricAgents?: readonly ScopedMetricAgent[] } {
  return metricAgents === undefined ? {} : { metricAgents };
}

function createOptionalPromptFlowTasks(
  promptFlowTasks: readonly PromptFlowTask[] | undefined,
): { promptFlowTasks?: readonly PromptFlowTask[] } {
  return promptFlowTasks === undefined ? {} : { promptFlowTasks };
}

function createOptionalContextPackBuilder(
  contextPackBuilder: ContextPackBuilderPort | undefined,
): { contextPackBuilder?: ContextPackBuilderPort } {
  return contextPackBuilder === undefined ? {} : { contextPackBuilder };
}

function createOptionalContextPackReadinessPolicy(
  contextPackReadinessPolicy: ContextPackReadinessPolicyPort | undefined,
): { contextPackReadinessPolicy?: ContextPackReadinessPolicyPort } {
  return contextPackReadinessPolicy === undefined ? {} : { contextPackReadinessPolicy };
}

function createOptionalContextPackWakeContext(
  contextRefresh: ContextPackRefreshDecision | undefined,
): { contextPackWakeContext?: ContextPackRefreshDecision } {
  return contextRefresh === undefined ? {} : { contextPackWakeContext: contextRefresh };
}

function createOptionalContextReadinessEnforcement(
  enforceContextReadiness: boolean | undefined,
): { enforceContextReadiness?: boolean } {
  return enforceContextReadiness === undefined ? {} : { enforceContextReadiness };
}

function createOptionalInboxWorkflow(
  inboxWorkflow: ContextPackInboxWorkflowView | undefined,
): { inboxWorkflow?: ContextPackInboxWorkflowView } {
  return inboxWorkflow === undefined ? {} : { inboxWorkflow };
}

function createOptionalContextPackAdvisoryPromotionDecisions(
  advisoryPromotionDecisions: readonly ContextPackAdvisoryPromotionDecision[] | undefined,
): { advisoryPromotionDecisions?: readonly ContextPackAdvisoryPromotionDecision[] } {
  return advisoryPromotionDecisions === undefined ? {} : { advisoryPromotionDecisions };
}

function createOptionalHierarchy(
  hierarchy: HierarchySnapshot | undefined,
): { hierarchy?: HierarchySnapshot } {
  return hierarchy === undefined ? {} : { hierarchy };
}

function createOptionalDeterministicRules(
  deterministicRules: readonly DeterministicRule[] | undefined,
): { deterministicRules?: readonly DeterministicRule[] } {
  return deterministicRules === undefined ? {} : { deterministicRules };
}

function createOptionalFetchImpl(fetchImpl: typeof fetch | undefined): { fetchImpl?: typeof fetch } {
  return fetchImpl === undefined ? {} : { fetchImpl };
}

function oneHourBefore(iso: string): string {
  return new Date(Date.parse(iso) - 60 * 60 * 1000).toISOString();
}

function formatMetricBlocks(blocks: readonly MetricBlock[]): readonly string[] {
  if (blocks.length === 0) {
    return ["- no scoped metrics"];
  }
  return blocks.map((block) => `- ${block.label}: ${block.value}${block.unit ?? ""}`);
}

function formatContextReadout(
  context: ContextReadout | undefined,
  advisoryPromotionDecisions: readonly ContextPackAdvisoryPromotionDecision[] | undefined,
): readonly string[] {
  if (context === undefined) {
    return ["context: unavailable", "- no context pack"];
  }
  return [
    `context: ${context.status} ${context.pack.id}`,
    `context summary: required=${context.summary.requiredItemCount} optional=${context.summary.optionalItemCount} omissions=${context.summary.omissionCount} contradictions=${context.summary.contradictionCount} stale=${context.summary.staleInputCount} blockers=${context.summary.lifecycleBlockerCount}`,
    ...formatContextItems("required", context.requiredItems),
    ...formatContextItems("optional", context.optionalItems),
    ...formatContextAdvisoryPromotionCandidates(context, advisoryPromotionDecisions),
    ...formatContextAttentionLanes(context),
    ...formatContextDrillTargetGroups(context),
    ...formatContextOmissions(context.omittedItemsWithReason),
    ...formatContextStringList("context contradiction", context.contradictions),
    ...formatContextStringList("context stale input", context.staleInputs),
    ...formatContextStringList("context blocker", context.lifecycleBlockers),
  ];
}

function formatContextPackInboxWorkflow(
  inboxWorkflow: ContextPackInboxWorkflowView | undefined,
): readonly string[] {
  if (inboxWorkflow === undefined) return ["inbox workflow: unavailable"];
  return [
    `inbox workflow: total=${inboxWorkflow.summary.totalVisibleCount} urgent=${inboxWorkflow.summary.urgentUnreadCount} normal=${inboxWorkflow.summary.normalUnreadCount} due=${inboxWorkflow.summary.snoozedDueCount} future=${inboxWorkflow.summary.snoozedFutureCount} read=${inboxWorkflow.summary.readCount}`,
    ...formatContextPackInboxWorkflowBatches(inboxWorkflow),
  ];
}

function formatContextPackInboxWorkflowBatches(
  inboxWorkflow: ContextPackInboxWorkflowView,
): readonly string[] {
  if (inboxWorkflow.batches.length === 0) return ["- no inbox workflow items"];
  return inboxWorkflow.batches.flatMap((batch) =>
    batch.items.map((item) =>
      `- inbox ${batch.kind} ${item.inboxAnchorId} ${item.priority}/${item.status}${formatInboxWorkflowSnooze(item)} ${item.title} actions=${item.actions.map((action) => action.kind).join(",")}`
    )
  );
}

function formatInboxWorkflowSnooze(
  item: ContextPackInboxWorkflowView["batches"][number]["items"][number],
): string {
  return item.snoozedUntil === undefined ? "" : ` until=${item.snoozedUntil}`;
}

function formatContextAttentionLanes(context: ContextReadout): readonly string[] {
  const lanes = context.pack.curationPlan?.lanes ?? [];
  if (lanes.length === 0) return ["- no context attention lanes"];
  return [
    "context attention lanes:",
    ...lanes.map((lane) =>
      `- attention lane ${lane.kind} priority=${lane.priority} required=${String(lane.required)}: ${lane.objective}; refs=${formatAttentionLaneRefs(lane.refs)}`
    ),
    ...formatContextAttentionInstructions(context.pack.curationPlan?.deterministicInstructions ?? []),
  ];
}

function formatContextAttentionInstructions(instructions: readonly string[]): readonly string[] {
  if (instructions.length === 0) return [];
  return instructions.map((instruction) => `- attention instruction: ${instruction}`);
}

function formatContextDrillTargetGroups(context: ContextReadout): readonly string[] {
  if (context.drillTargetGroups.length === 0) return ["- no context drill targets"];
  return [
    "context drill targets:",
    ...context.drillTargetGroups.flatMap((group) =>
      group.targets.map((target) =>
        `- context drill ${group.itemId} ${target.routeRef} ${target.label}${formatContextDrillGovernance(target)}`
      )
    ),
  ];
}

function formatContextDrillGovernance(
  target: ContextReadout["drillTargetGroups"][number]["targets"][number],
): string {
  if (target.governance === undefined) return "";
  return ` governance=${target.governance.tier}/${target.governance.phase} weight=${target.governance.weight} floor=${target.governance.readFloor}`;
}

function formatAttentionLaneRefs(refs: readonly ContextPackAttentionLaneRef[]): string {
  if (refs.length === 0) return "none";
  return refs.map(formatAttentionLaneRef).join(",");
}

function formatAttentionLaneRef(ref: ContextPackAttentionLaneRef): string {
  switch (ref.kind) {
    case ContextPackAttentionLaneRefKind.Item:
      return `item:${ref.itemId}`;
    case ContextPackAttentionLaneRefKind.Omission:
      return `omission:${ref.omissionRef}`;
    case ContextPackAttentionLaneRefKind.LegalAction:
      return `legal_action:${ref.actionType}`;
    case ContextPackAttentionLaneRefKind.ScopeAnchor:
      return `scope_anchor:${ref.anchorRef}`;
  }
}

function formatContextItems(
  label: string,
  items: ContextReadout["requiredItems"],
): readonly string[] {
  if (items.length === 0) return [`- no ${label} context items`];
  return items.map((item) => `- ${label} context ${item.kind} ${item.id}: ${item.title}`);
}

function formatContextAdvisoryPromotionCandidates(
  context: ContextReadout,
  advisoryPromotionDecisions: readonly ContextPackAdvisoryPromotionDecision[] | undefined,
): readonly string[] {
  const candidates = context.pack.items.filter((item) => item.kind === ContextPackItemKind.SynthesisGapHypothesis);
  if (candidates.length === 0) return [];
  return [
    "context advisory-promotion candidates:",
    ...candidates.map((item) => {
      const fingerprint = contextPackAdvisoryPromotionFingerprint(item);
      return [
        `- advisory promotion candidate ${item.id}`,
        `profile=${context.pack.curationPlan?.profileId ?? AGENT_CLI_ADVISORY_PROMOTION_UNKNOWN_CURATION_PROFILE}`,
        `fingerprint=${fingerprint.itemKind}:${fingerprint.summaryHash}`,
        ...formatContextAdvisoryPromotionCandidateStatus(item, advisoryPromotionDecisions),
        `title=${item.title}`,
        `citations=${formatContextAdvisoryPromotionCsv(fingerprint.citationRefs)}`,
        `sourcePointers=${formatContextAdvisoryPromotionCsv(fingerprint.sourcePointerKeys)}`,
        `evidence=${formatContextAdvisoryPromotionCsv(contextPackAdvisoryPromotionDecisionEvidenceRefs(item))}`,
        `command=${formatContextAdvisoryPromotionCommandHint(item)}`,
      ].join(" ");
    }),
  ];
}

function formatContextAdvisoryPromotionCandidateStatus(
  item: ContextPackItem,
  advisoryPromotionDecisions: readonly ContextPackAdvisoryPromotionDecision[] | undefined,
): readonly string[] {
  if (advisoryPromotionDecisions === undefined) {
    return [`status=${AgentCliContextPackAdvisoryPromotionCandidateStatus.Unknown}`];
  }
  const decision = contextPackAdvisoryPromotionApprovedDecisionFor(item, advisoryPromotionDecisions);
  if (decision === undefined) {
    return [`status=${AgentCliContextPackAdvisoryPromotionCandidateStatus.NotApproved}`];
  }
  return [
    `status=${AgentCliContextPackAdvisoryPromotionCandidateStatus.Approved}`,
    `decision=${decision.decisionId}`,
    `blocker=${decision.lifecycleBlocker}`,
  ];
}

function contextPackAdvisoryPromotionApprovedDecisionFor(
  item: ContextPackItem,
  advisoryPromotionDecisions: readonly ContextPackAdvisoryPromotionDecision[],
): ContextPackAdvisoryPromotionDecision | undefined {
  const fingerprint = contextPackAdvisoryPromotionFingerprint(item);
  return advisoryPromotionDecisions.find((decision) =>
    decision.status === ContextPackAdvisoryPromotionDecisionStatus.Approved &&
    contextPackAdvisoryPromotionFingerprintsMatch(decision.fingerprint, fingerprint)
  );
}

function contextPackAdvisoryPromotionFingerprintsMatch(
  expected: ContextPackAdvisoryPromotionFingerprint,
  actual: ContextPackAdvisoryPromotionFingerprint,
): boolean {
  return expected.itemKind === actual.itemKind &&
    expected.summaryHash === actual.summaryHash &&
    stringArraysMatch(expected.citationRefs, actual.citationRefs) &&
    stringArraysMatch(expected.sourcePointerKeys, actual.sourcePointerKeys);
}

function stringArraysMatch(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatContextAdvisoryPromotionCsv(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(",");
}

function formatContextAdvisoryPromotionCommandHint(item: ContextPackItem): string {
  return [
    `--${AgentCliContextPackAdvisoryPromotionFlag.Item}`,
    item.id,
    `--${AgentCliContextPackAdvisoryPromotionFlag.Status}`,
    ContextPackAdvisoryPromotionDecisionStatus.Approved,
    `--${AgentCliContextPackAdvisoryPromotionFlag.Blocker}`,
    "<text>",
  ].join(" ");
}

function formatContextOmissions(omissions: ContextReadout["omittedItemsWithReason"]): readonly string[] {
  if (omissions.length === 0) return ["- no context omissions"];
  return omissions.map((omission) =>
    `- context omission ${omission.reason}${omission.nodeId === undefined ? "" : ` ${omission.nodeId}`}: ${omission.message}`
  );
}

function formatContextStringList(label: string, values: readonly string[]): readonly string[] {
  if (values.length === 0) return [`- no ${label}s`];
  return values.map((value) => `- ${label}: ${value}`);
}

function formatPromptFlowTasks(promptFlows: PromptFlowReadout | undefined): readonly string[] {
  if (promptFlows === undefined || (promptFlows.tasks.length === 0 && promptFlows.vetoedTasks.length === 0)) {
    return ["- no prompt-flow tasks"];
  }
  return [
    ...promptFlows.tasks.map((task) => `- ${task.taskId} ${task.promptFlowId} ${task.label}`),
    ...promptFlows.vetoedTasks.map((vetoed) => `- ${vetoed.task.taskId} ${vetoed.task.promptFlowId} ${vetoed.task.label} (${vetoed.reason})`),
  ];
}

function formatMenuPage(page: Menu16["page"] | undefined): readonly string[] {
  if (page?.promptFlows === undefined) return [];
  return [`prompt-flow page: ${page.promptFlows.page + 1}/${page.promptFlows.pageCount}`];
}

function formatHierarchy(hierarchy: HierarchyReadout | undefined): readonly string[] {
  if (hierarchy === undefined) {
    return ["hierarchy: unavailable", "- no hierarchy items"];
  }
  return [
    `hierarchy: ${hierarchy.level}`,
    `priority scope: ${hierarchy.priorityScope}`,
    ...formatHierarchyMission(hierarchy.mission),
    ...formatHierarchyProjects(hierarchy.projects),
    ...formatHierarchyInitiatives(hierarchy.initiatives),
    ...formatHierarchyMetrics(hierarchy.metrics),
    ...formatHierarchyPriorityItems(hierarchy.priorityItems),
    ...formatHierarchyScopedMetrics(hierarchy.scopedMetrics),
    ...formatHierarchyActions(hierarchy.actions),
    ...formatHierarchyVetoedActions(hierarchy.vetoedActions),
    ...formatHierarchyPolicyViolations(hierarchy.policyViolations),
  ];
}

function formatHierarchyMission(mission: HierarchyReadout["mission"]): readonly string[] {
  if (mission === undefined) return ["- no hierarchy mission"];
  return [
    `mission: ${mission.mission.goal}`,
    `mission timeframe: ${mission.mission.timeframe.startsAt} -> ${mission.mission.timeframe.targetAt}`,
    `mission status: ${mission.status}`,
    `mission progress: ${mission.actualProgressPercent}% actual / ${mission.expectedProgressPercent}% expected`,
    `mission days remaining: ${mission.daysRemaining}`,
    ...mission.objectives.map((objective) => `- mission objective ${objective}`),
    ...mission.nextMilestones.map((milestone) => `- mission milestone ${milestone.milestoneId} ${milestone.title} (${milestone.status})`),
    ...mission.metrics.map((metric) => `- mission metric ${metric.label}: ${metric.value}${metric.unit ?? ""}`),
    ...mission.lagSignals.map((signal) => `- mission lag ${signal.label}: ${signal.value}${signal.unit ?? ""}`),
    ...mission.correctiveActions.map((action) => `- mission corrective action ${action.kind}: ${action.label}`),
    ...mission.vetoedCorrectiveActions.map((vetoed) => `- mission corrective action veto ${vetoed.action.kind}: ${vetoed.reason}`),
  ];
}

function formatHierarchyProjects(projects: readonly HierarchyProject[]): readonly string[] {
  if (projects.length === 0) return ["- no visible projects"];
  return projects.flatMap((project) => [
    `- project ${project.projectId} ${project.name}`,
    ...project.trajectory.map((metric) => `  trajectory ${metric.label}: ${metric.value}${metric.unit ?? ""}`),
  ]);
}

function formatHierarchyInitiatives(initiatives: readonly HierarchyInitiative[]): readonly string[] {
  if (initiatives.length === 0) return ["- no visible initiatives"];
  return initiatives.map((initiative) => `- initiative ${initiative.initiativeId} ${initiative.title}`);
}

function formatHierarchyMetrics(metrics: readonly MetricBlock[]): readonly string[] {
  if (metrics.length === 0) return ["- no hierarchy metrics"];
  return metrics.map((metric) => `- hierarchy metric ${metric.label}: ${metric.value}${metric.unit ?? ""}`);
}

function formatHierarchyPriorityItems(items: HierarchyReadout["priorityItems"]): readonly string[] {
  if (items.length === 0) return ["- no hierarchy priority items"];
  return items.map((item) => `- priority ${item.kind} ${item.itemId} ${item.label}`);
}

function formatHierarchyScopedMetrics(metrics: readonly MetricBlock[]): readonly string[] {
  if (metrics.length === 0) return ["- no hierarchy scoped metrics"];
  return metrics.map((metric) => `- hierarchy scoped metric ${metric.label}: ${metric.value}${metric.unit ?? ""}`);
}

function formatHierarchyActions(actions: HierarchyReadout["actions"]): readonly string[] {
  if (actions.length === 0) return ["- no hierarchy actions"];
  return actions.map((action) => `- hierarchy action ${action.kind}: ${action.label}`);
}

function formatHierarchyVetoedActions(actions: HierarchyReadout["vetoedActions"]): readonly string[] {
  if (actions.length === 0) return ["- no hierarchy action vetoes"];
  return actions.map((vetoed) => `- hierarchy action veto ${vetoed.action.kind}: ${vetoed.reason}`);
}

function formatHierarchyPolicyViolations(violations: HierarchyReadout["policyViolations"]): readonly string[] {
  if (violations.length === 0) return ["- no hierarchy policy violations"];
  return violations.map((violation) => `- policy violation ${violation.ruleName}: ${violation.reason}`);
}

function formatWorkMarket(workMarket: WorkMarketReadout | undefined): readonly string[] {
  if (workMarket === undefined) return ["work market: unavailable"];
  if (workMarket.queues.length === 0) return ["work market: none"];
  return [
    `work market: ${workMarket.queuePressure}`,
    `work market shards: ready=${workMarket.totalReadyShards} claimed=${workMarket.totalClaimedShards} stale=${workMarket.totalStaleClaims}`,
    ...workMarket.queues.flatMap((queue) => [
      `- queue ${queue.queueId} ${queue.scope.kind}:${queue.scope.id} ready=${queue.readyShardCount} claimed=${queue.claimedShardCount} stale=${queue.staleClaimCount}`,
      ...queue.activeClaims.map((claim) =>
        `- active claim ${claim.claimId} shard=${claim.shardId} owner=${claim.ownerAgentId} fence=${claim.fencingToken}`),
    ]),
  ];
}

function visibleWorkMarketHatIds(
  hat: ReturnType<typeof buildHatDefinitions>[number],
  hats: readonly ReturnType<typeof buildHatDefinitions>[number][],
  queues: readonly HatWorkQueue[],
): readonly string[] {
  const byId = new Map(hats.map((candidate) => [candidate.id, candidate]));
  const scope = authorityScopeOf(hat.level);
  if (scope === "organization") return queues.map((queue) => queue.hatId);
  const subtree = authoritySubtree(hat.id, byId);
  if (scope === "department") {
    return queues
      .filter((queue) => subtree.has(queue.hatId) || byId.get(queue.hatId)?.departmentId === hat.departmentId)
      .map((queue) => queue.hatId);
  }
  if (scope === "team") {
    return queues.filter((queue) => subtree.has(queue.hatId)).map((queue) => queue.hatId);
  }
  return queues.filter((queue) => queue.hatId === hat.id).map((queue) => queue.hatId);
}

function formatPromptFlowContext(context: PromptFlowContext): string {
  return [
    ...formatPromptFlowContextMetadata(context),
    "directions:",
    ...formatStringList(context.directions),
    "tools:",
    ...formatToolInjections(context.toolInjections),
    "context metrics:",
    ...formatMetricBlocks(context.metrics),
    "context artifacts:",
    ...formatContextArtifacts(context.contextArtifacts),
  ].join("\n");
}

function copyPromptFlowRequestMetadata(request: PromptFlowContextRequest): Partial<PromptFlowContext> {
  return {
    ...(request.definitionVersion !== undefined ? { definitionVersion: request.definitionVersion } : {}),
    ...(request.phaseId !== undefined ? { phaseId: request.phaseId } : {}),
    ...(request.runState !== undefined ? { runState: request.runState } : {}),
    ...(request.permittedUniversalActions !== undefined ? { permittedUniversalActions: request.permittedUniversalActions } : {}),
    ...(request.requiredEvidenceRefs !== undefined ? { requiredEvidenceRefs: request.requiredEvidenceRefs } : {}),
    ...(request.gate !== undefined ? { gate: request.gate } : {}),
    ...(request.reviewerHatIds !== undefined ? { reviewerHatIds: request.reviewerHatIds } : {}),
    ...(request.timeoutSeconds !== undefined ? { timeoutSeconds: request.timeoutSeconds } : {}),
    ...(request.retryLimit !== undefined ? { retryLimit: request.retryLimit } : {}),
    ...(request.rollbackPolicy !== undefined ? { rollbackPolicy: request.rollbackPolicy } : {}),
  };
}

function formatPromptFlowContextMetadata(context: PromptFlowContext): readonly string[] {
  const rows: string[] = [];
  if (context.phaseId !== undefined || context.runState !== undefined) {
    rows.push(`phase: ${context.phaseId ?? "unknown"} ${context.runState ?? "unknown"}`);
  }
  if (context.requiredEvidenceRefs !== undefined) {
    rows.push("required evidence:", ...formatStringList(context.requiredEvidenceRefs));
  }
  if (context.gate !== undefined) {
    rows.push(`gate: ${context.gate.kind}`);
  }
  if (context.reviewerHatIds !== undefined) {
    rows.push("reviewers:", ...formatStringList(context.reviewerHatIds));
  }
  if (context.timeoutSeconds !== undefined) {
    rows.push(`timeout seconds: ${context.timeoutSeconds}`);
  }
  if (context.rollbackPolicy !== undefined) {
    rows.push(`rollback: ${context.rollbackPolicy.kind} ${context.rollbackPolicy.description}`);
  }
  return rows;
}

function formatStringList(values: readonly string[]): readonly string[] {
  return values.length === 0 ? ["- none"] : values.map((value) => `- ${value}`);
}

function formatToolInjections(tools: readonly PromptFlowToolInjection[]): readonly string[] {
  return tools.length === 0
    ? ["- none"]
    : tools.map((tool) => `- ${tool.tool}${tool.args === undefined ? "" : ` ${JSON.stringify(tool.args)}`}`);
}

function formatContextArtifacts(artifacts: readonly PromptFlowContextArtifact[]): readonly string[] {
  return artifacts.length === 0
    ? ["- none"]
    : artifacts.map((artifact) => `- ${artifact.label}: ${artifact.value}`);
}

function formatSlot(slot: Pick<Menu16Slot, "index" | "direction" | "label" | "availability" | "reason">): string {
  const prefix = `[${String(slot.index).padStart(2, "0")}] ${slot.availability} ${slot.direction} ${slot.label}`;
  return slot.reason === undefined ? prefix : `${prefix} (${slot.reason})`;
}

function formatActResult(result: ActResult): string {
  switch (result.outcome) {
    case "dispatched":
      return `dispatched ${result.kind}`;
    case "loaded_context":
      return `loaded context ${result.context.taskId}`;
    case "status_report":
      return `status ${result.status.kind} ${result.status.scope} ${result.status.phase}`;
    case "history_retract_requested":
      return `history-retract requested ${result.reason}`;
    case "history_redo_requested":
      return `history-redo requested ${result.reason}`;
    case "grammar_branch_requested":
      return `grammar-branch requested ${result.reason}`;
    case "rested":
      return `rested ${result.reason}`;
    case "reobserve":
      return `reobserve ${result.scope}${result.menuPage?.promptFlows === undefined ? "" : ` prompt-flow-page ${result.menuPage.promptFlows + 1}`}`;
    case "rejected":
      return `rejected ${result.reason}: ${result.message}`;
  }
}

function compileAgentCliPromptFlowTasksFromEnv(
  input: CreateAgentCliPromptFlowTasksFromEnvInput,
): readonly PromptFlowTask[] {
  const definitionsRaw = input.env.AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON;
  const runsRaw = input.env.AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON;
  if ((definitionsRaw === undefined || definitionsRaw.trim().length === 0) && (runsRaw === undefined || runsRaw.trim().length === 0)) {
    return [];
  }
  if (definitionsRaw === undefined || definitionsRaw.trim().length === 0 || runsRaw === undefined || runsRaw.trim().length === 0) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON and AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON must be provided together");
  }
  const definitions = parsePromptFlowDefinitionsJson(definitionsRaw);
  const lintMessages = definitions.flatMap((definition) =>
    lintPromptFlowDefinition(definition).map((diagnostic) =>
      `${definition.promptFlowId}@${definition.version}${diagnostic.phaseId === undefined ? "" : `:${diagnostic.phaseId}`}:${diagnostic.code}`,
    ),
  );
  if (lintMessages.length > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON failed lint: ${lintMessages.join(", ")}`);
  }
  const runs = parsePromptFlowRunsJson(runsRaw);
  const tasks = compilePromptFlowTasks({
    definitions,
    runs,
  });
  assertPromptFlowRunCompileCoverage(runs, tasks);
  return tasks;
}

function parsePromptFlowDefinitionsJson(raw: string): readonly PromptFlowDefinition[] {
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON");
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON must be a JSON array");
  }
  const definitions = parsed.map(parsePromptFlowDefinition);
  const duplicateDefinitionKeys = repeatedValues(definitions.map(promptFlowDefinitionKey));
  if (duplicateDefinitionKeys.length > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_DEFINITIONS_JSON contains duplicate definition keys: ${duplicateDefinitionKeys.join(", ")}`);
  }
  return definitions;
}

function parsePromptFlowRunsJson(raw: string): readonly PromptFlowRun[] {
  const parsed = parseJsonEnv(raw, "AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON");
  if (!Array.isArray(parsed)) {
    throw new Error("AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON must be a JSON array");
  }
  const runs = parsed.map(parsePromptFlowRun);
  const duplicateRunIds = repeatedValues(runs.map((run) => run.runId));
  if (duplicateRunIds.length > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON contains duplicate run ids: ${duplicateRunIds.join(", ")}`);
  }
  return runs;
}

function parsePromptFlowTask(value: unknown): PromptFlowTask {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow task must be an object");
  }
  const candidate = value as Record<string, unknown>;
  return {
    taskId: parseRequiredString(candidate, "taskId"),
    workItemId: parseRequiredString(candidate, "workItemId"),
    title: parseRequiredString(candidate, "title"),
    promptFlowId: parseRequiredString(candidate, "promptFlowId"),
    label: parseRequiredString(candidate, "label"),
    scope: parsePromptFlowRunScope(candidate.scope),
    priority: parsePromptFlowPriority(candidate.priority),
    ...parseOptionalStringArray(candidate.allowedHatIds, "allowedHatIds"),
    ...parseOptionalActionClass(candidate.actionClass),
    ...parseOptionalRequiredToolBundles(candidate.requiredToolBundles),
    directions: parseStringArray(candidate.directions, "directions"),
    toolInjections: parseToolInjections(candidate.toolInjections),
    metrics: parseMetricBlocks(candidate.metrics),
    contextArtifactRefs: parseStringArray(candidate.contextArtifactRefs, "contextArtifactRefs"),
    ...parseOptionalPromptFlowMetadata(candidate),
  };
}

function parsePromptFlowDefinition(value: unknown): PromptFlowDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow definition must be an object");
  }
  const candidate = value as Record<string, unknown>;
  const definition = {
    promptFlowId: parsePromptFlowDefinitionString(candidate, "promptFlowId"),
    version: parsePromptFlowDefinitionString(candidate, "version"),
    name: parsePromptFlowDefinitionString(candidate, "name"),
    ownerDepartmentId: parsePromptFlowDefinitionString(candidate, "ownerDepartmentId"),
    allowedHatIds: parseStringArray(candidate.allowedHatIds, "allowedHatIds"),
    requiredScope: parsePromptFlowRunScope(candidate.requiredScope),
    phases: parsePromptFlowPhases(candidate.phases),
    reviewerHatIds: parseStringArray(candidate.reviewerHatIds, "reviewerHatIds"),
    rollbackPolicy: parsePromptFlowRollbackPolicy(candidate.rollbackPolicy),
  };
  const duplicatePhaseIds = repeatedValues(definition.phases.map((phase) => phase.phaseId));
  if (duplicatePhaseIds.length > 0) {
    throw new Error(`prompt-flow definition ${promptFlowDefinitionKey(definition)} contains duplicate phase ids: ${duplicatePhaseIds.join(", ")}`);
  }
  return definition;
}

function parsePromptFlowRun(value: unknown): PromptFlowRun {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow run must be an object");
  }
  const candidate = value as Record<string, unknown>;
  return {
    runId: parseRequiredString(candidate, "runId"),
    promptFlowId: parseRequiredString(candidate, "promptFlowId"),
    definitionVersion: parseRequiredString(candidate, "definitionVersion"),
    workItemId: parseRequiredString(candidate, "workItemId"),
    scope: parsePromptFlowRunScope(candidate.scope),
    currentPhaseId: parseRequiredString(candidate, "currentPhaseId"),
    state: parsePromptFlowRunState(candidate.state),
    priority: parsePromptFlowPriority(candidate.priority),
  };
}

function assertPromptFlowRunCompileCoverage(
  runs: readonly PromptFlowRun[],
  tasks: readonly PromptFlowTask[],
): void {
  const executableRunIds = new Set(
    runs
      .filter((run) => isExecutablePromptFlowRunState(run.state))
      .map((run) => run.runId),
  );
  for (const task of tasks) {
    executableRunIds.delete(task.taskId);
  }
  if (executableRunIds.size > 0) {
    throw new Error(`AGENTIC_ORG_PROMPT_FLOW_RUNS_JSON failed compile coverage: ${[...executableRunIds].sort().join(", ")}`);
  }
}

function isExecutablePromptFlowRunState(state: PromptFlowRunState): boolean {
  return (
    state === PromptFlowRunState.Created ||
    state === PromptFlowRunState.ContextLoaded ||
    state === PromptFlowRunState.RunningPhase ||
    state === PromptFlowRunState.AwaitingGate
  );
}

function parseWorkMarketQueue(value: unknown): HatWorkQueue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("work-market queue must be an object");
  }
  const queue = value as Record<string, unknown>;
  return {
    queueId: parseWorkMarketRequiredString(queue, "queueId"),
    organizationId: parseWorkMarketRequiredString(queue, "organizationId"),
    hatId: parseWorkMarketRequiredString(queue, "hatId"),
    ...parseOptionalWorkMarketNumberProperty(queue.revision, "revision"),
    scope: parseWorkMarketScope(queue.scope),
    ...parseOptionalWorkMarketStringProperty(queue.priorityClass, "priorityClass"),
    ...parseOptionalWorkMarketStringProperty(queue.slaDeadlineAt, "slaDeadlineAt"),
    shardability: parseWorkMarketShardability(queue.shardability),
    requiredSkills: parseWorkMarketStringArray(queue.requiredSkills, "requiredSkills"),
    reviewQuorum: parseWorkMarketReviewQuorum(queue.reviewQuorum),
    shards: parseWorkMarketShards(queue.shards),
    claims: parseWorkMarketClaims(queue.claims),
    ...parseOptionalWorkMarketRuntimeLeases(queue.runtimeLeases),
    ...parseOptionalWorkMarketReviews(queue.reviews),
  };
}

function parseWorkMarketScope(value: unknown): WorkMarketScope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("work-market queue scope must be an object");
  }
  const scope = value as Record<string, unknown>;
  const kind = scope.kind;
  if (
    kind !== "organization" &&
    kind !== "department" &&
    kind !== "project" &&
    kind !== "initiative" &&
    kind !== "work_batch" &&
    kind !== "work_item"
  ) {
    throw new Error("work-market queue scope kind is invalid");
  }
  return {
    kind,
    id: parseWorkMarketRequiredString(scope, "id"),
  };
}

function parseWorkMarketShardability(value: unknown): HatWorkQueue["shardability"] {
  if (value === "none" || value === "by_file" || value === "by_component" || value === "by_test_suite" || value === "manual") {
    return value;
  }
  throw new Error("work-market queue shardability is invalid");
}

function parseWorkMarketReviewQuorum(value: unknown): HatWorkQueue["reviewQuorum"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("work-market queue reviewQuorum must be an object");
  }
  const quorum = value as Record<string, unknown>;
  return {
    requiredApprovals: parseWorkMarketPositiveInteger(quorum.requiredApprovals, "reviewQuorum.requiredApprovals"),
    reviewerHatIds: parseWorkMarketStringArray(quorum.reviewerHatIds, "reviewQuorum.reviewerHatIds"),
    ...(quorum.allowProducerApproval === undefined ? {} : {
      allowProducerApproval: parseWorkMarketBoolean(quorum.allowProducerApproval, "reviewQuorum.allowProducerApproval"),
    }),
  };
}

function parseWorkMarketShards(value: unknown): HatWorkQueue["shards"] {
  if (!Array.isArray(value)) {
    throw new Error("work-market queue shards must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("work-market shard must be an object");
    }
    const shard = item as Record<string, unknown>;
    return {
      shardId: parseWorkMarketRequiredString(shard, "shardId"),
      workItemId: parseWorkMarketRequiredString(shard, "workItemId"),
      title: parseWorkMarketRequiredString(shard, "title"),
      priority: parseWorkMarketNumber(shard.priority, "priority"),
      state: parseWorkShardState(shard.state),
      dependencyShardIds: parseWorkMarketStringArray(shard.dependencyShardIds, "dependencyShardIds"),
      mergePolicy: parseWorkShardMergePolicy(shard.mergePolicy),
      ...(shard.claimedByClaimId === undefined ? {} : { claimedByClaimId: parseWorkMarketRequiredString(shard, "claimedByClaimId") }),
      ...(shard.completedAt === undefined ? {} : { completedAt: parseWorkMarketRequiredString(shard, "completedAt") }),
      ...(shard.mergedAt === undefined ? {} : { mergedAt: parseWorkMarketRequiredString(shard, "mergedAt") }),
      ...(shard.evidenceRefs === undefined ? {} : { evidenceRefs: parseWorkMarketStringArray(shard.evidenceRefs, "evidenceRefs") }),
    };
  });
}

function parseWorkMarketClaims(value: unknown): HatWorkQueue["claims"] {
  if (!Array.isArray(value)) {
    throw new Error("work-market queue claims must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("work-market claim must be an object");
    }
    const claim = item as Record<string, unknown>;
    return {
      claimId: parseWorkMarketRequiredString(claim, "claimId"),
      shardId: parseWorkMarketRequiredString(claim, "shardId"),
      ownerAgentId: parseWorkMarketRequiredString(claim, "ownerAgentId"),
      hatAssignmentId: parseWorkMarketRequiredString(claim, "hatAssignmentId"),
      fencingToken: parseWorkMarketRequiredString(claim, "fencingToken"),
      leaseExpiresAt: parseWorkMarketRequiredString(claim, "leaseExpiresAt"),
      heartbeatAt: parseWorkMarketRequiredString(claim, "heartbeatAt"),
      scheduleBlockId: parseWorkMarketRequiredString(claim, "scheduleBlockId"),
      runtimeSessionId: parseWorkMarketRequiredString(claim, "runtimeSessionId"),
      workspaceRef: parseWorkMarketRequiredString(claim, "workspaceRef"),
      credentialScope: parseWorkMarketRequiredString(claim, "credentialScope"),
      compensatingAction: parseWorkMarketRequiredString(claim, "compensatingAction"),
      state: parseWorkClaimState(claim.state),
      claimedAt: parseWorkMarketRequiredString(claim, "claimedAt"),
      ...(claim.completedAt === undefined ? {} : { completedAt: parseWorkMarketRequiredString(claim, "completedAt") }),
      ...(claim.releasedAt === undefined ? {} : { releasedAt: parseWorkMarketRequiredString(claim, "releasedAt") }),
      ...(claim.releaseReason === undefined ? {} : { releaseReason: parseWorkMarketRequiredString(claim, "releaseReason") }),
      ...(claim.evidenceRefs === undefined ? {} : { evidenceRefs: parseWorkMarketStringArray(claim.evidenceRefs, "evidenceRefs") }),
    };
  });
}

function parseOptionalWorkMarketRuntimeLeases(value: unknown): Partial<Pick<HatWorkQueue, "runtimeLeases">> {
  if (value === undefined) return {};
  if (!Array.isArray(value)) {
    throw new Error("work-market queue runtimeLeases must be an array");
  }
  const runtimeLeases = value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("work-market runtime lease must be an object");
    }
    const lease = item as Record<string, unknown>;
    return {
      leaseId: parseWorkMarketRequiredString(lease, "leaseId"),
      claimId: parseWorkMarketRequiredString(lease, "claimId"),
      organizationId: parseWorkMarketRequiredString(lease, "organizationId"),
      queueId: parseWorkMarketRequiredString(lease, "queueId"),
      hatId: parseWorkMarketRequiredString(lease, "hatId"),
      scope: parseWorkMarketScope(lease.scope),
      workItemId: parseWorkMarketRequiredString(lease, "workItemId"),
      shardId: parseWorkMarketRequiredString(lease, "shardId"),
      hatAssignmentId: parseWorkMarketRequiredString(lease, "hatAssignmentId"),
      agentId: parseWorkMarketRequiredString(lease, "agentId"),
      scheduleBlockId: parseWorkMarketRequiredString(lease, "scheduleBlockId"),
      runtimeSessionId: parseWorkMarketRequiredString(lease, "runtimeSessionId"),
      workspaceRef: parseWorkMarketRequiredString(lease, "workspaceRef"),
      credentialScopeRefs: parseWorkMarketStringArray(lease.credentialScopeRefs, "credentialScopeRefs"),
      fencingToken: parseWorkMarketRequiredString(lease, "fencingToken"),
      heartbeatAt: parseWorkMarketRequiredString(lease, "heartbeatAt"),
      heartbeatDeadlineAt: parseWorkMarketRequiredString(lease, "heartbeatDeadlineAt"),
      leaseExpiresAt: parseWorkMarketRequiredString(lease, "leaseExpiresAt"),
      compensatingActionRef: parseWorkMarketRequiredString(lease, "compensatingActionRef"),
      state: parseRuntimeLeaseState(lease.state),
      activatedAt: parseWorkMarketRequiredString(lease, "activatedAt"),
      ...(lease.completedAt === undefined ? {} : { completedAt: parseWorkMarketRequiredString(lease, "completedAt") }),
      ...(lease.expiredAt === undefined ? {} : { expiredAt: parseWorkMarketRequiredString(lease, "expiredAt") }),
      ...(lease.revokedAt === undefined ? {} : { revokedAt: parseWorkMarketRequiredString(lease, "revokedAt") }),
    };
  });
  return { runtimeLeases };
}

function parseOptionalWorkMarketReviews(value: unknown): Partial<Pick<HatWorkQueue, "reviews">> {
  if (value === undefined) return {};
  if (!Array.isArray(value)) {
    throw new Error("work-market queue reviews must be an array");
  }
  const reviews = value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error("work-market review must be an object");
    }
    const review = item as Record<string, unknown>;
    return {
      shardId: parseWorkMarketRequiredString(review, "shardId"),
      producerAgentId: parseWorkMarketRequiredString(review, "producerAgentId"),
      outcome: parseWorkMarketQuorumOutcome(review.outcome),
      approvalCount: parseWorkMarketNonNegativeInteger(review.approvalCount, "approvalCount"),
      acceptedEvidenceRefs: parseWorkMarketStringArray(review.acceptedEvidenceRefs, "acceptedEvidenceRefs"),
      reviewedAt: parseWorkMarketRequiredString(review, "reviewedAt"),
      ...(review.reason === undefined ? {} : { reason: parseWorkShardReviewRejectReason(review.reason) }),
    };
  });
  return { reviews };
}

function parseWorkShardState(value: unknown): WorkShardState {
  if (Object.values(WorkShardState).includes(value as WorkShardState)) return value as WorkShardState;
  throw new Error("work-market shard state is invalid");
}

function parseWorkClaimState(value: unknown): WorkClaimState {
  if (Object.values(WorkClaimState).includes(value as WorkClaimState)) return value as WorkClaimState;
  throw new Error("work-market claim state is invalid");
}

function parseRuntimeLeaseState(value: unknown): RuntimeLeaseState {
  if (Object.values(RuntimeLeaseState).includes(value as RuntimeLeaseState)) return value as RuntimeLeaseState;
  throw new Error("work-market runtime lease state is invalid");
}

function parseWorkMarketQuorumOutcome(value: unknown): WorkMarketQuorumOutcome {
  if (Object.values(WorkMarketQuorumOutcome).includes(value as WorkMarketQuorumOutcome)) {
    return value as WorkMarketQuorumOutcome;
  }
  throw new Error("work-market review outcome is invalid");
}

function parseWorkShardReviewRejectReason(value: unknown): NonNullable<NonNullable<HatWorkQueue["reviews"]>[number]["reason"]> {
  if (
    value === "self_only_review" ||
    value === "insufficient_quorum" ||
    value === "no_such_shard" ||
    value === "producer_claim_missing" ||
    value === "reviewer_hat_not_allowed"
  ) {
    return value;
  }
  throw new Error("work-market review reason is invalid");
}

function parseWorkShardMergePolicy(value: unknown): "independent" | "aggregate_before_merge" {
  if (value === "independent" || value === "aggregate_before_merge") return value;
  throw new Error("work-market shard mergePolicy is invalid");
}

function parseWorkMarketRequiredString(candidate: Record<string, unknown>, property: string): string {
  const value = candidate[property];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`work-market requires string ${property}`);
  }
  return value;
}

function parseOptionalWorkMarketStringProperty(value: unknown, property: "priorityClass" | "slaDeadlineAt"): Partial<Pick<HatWorkQueue, "priorityClass" | "slaDeadlineAt">> {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`work-market ${property} must be a non-empty string when present`);
  }
  return { [property]: value };
}

function parseWorkMarketStringArray(value: unknown, property: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`work-market ${property} must contain only non-empty strings`);
  }
  return value;
}

function parseWorkMarketNumber(value: unknown, property: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`work-market ${property} must be numeric`);
  }
  return value;
}

function parseOptionalWorkMarketNumberProperty(value: unknown, property: "revision"): Partial<Pick<HatWorkQueue, "revision">> {
  if (value === undefined) return {};
  return { [property]: parseWorkMarketNumber(value, property) };
}

function parseWorkMarketPositiveInteger(value: unknown, property: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`work-market ${property} must be a positive integer`);
  }
  return value as number;
}

function parseWorkMarketNonNegativeInteger(value: unknown, property: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`work-market ${property} must be a non-negative integer`);
  }
  return value as number;
}

function parseWorkMarketBoolean(value: unknown, property: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`work-market ${property} must be boolean`);
  }
  return value;
}

function parsePromptFlowPhases(value: unknown): readonly PromptFlowPhaseDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("prompt-flow definition phases must be an array");
  }
  return value.map(parsePromptFlowPhaseDefinition);
}

function parsePromptFlowPhaseDefinition(value: unknown): PromptFlowPhaseDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow definition phase must be an object");
  }
  const phase = value as Record<string, unknown>;
  return {
    phaseId: parsePromptFlowDefinitionString(phase, "phaseId"),
    label: parsePromptFlowDefinitionString(phase, "label"),
    ...parseOptionalActionClass(phase.actionClass),
    permittedUniversalActions: parseStringArray(phase.permittedUniversalActions, "permittedUniversalActions"),
    directions: parseStringArray(phase.directions, "directions"),
    ...parseOptionalRequiredToolBundles(phase.requiredToolBundles),
    toolInjections: parseToolInjections(phase.toolInjections),
    contextArtifactRefs: parseStringArray(phase.contextArtifactRefs, "contextArtifactRefs"),
    requiredEvidenceRefs: parseStringArray(phase.requiredEvidenceRefs, "requiredEvidenceRefs"),
    gate: parsePromptFlowGate(phase.gate),
    timeoutSeconds: parsePositiveInteger(phase.timeoutSeconds, "timeoutSeconds"),
    retryLimit: parseNonNegativeInteger(phase.retryLimit, "retryLimit"),
    ...(phase.metrics === undefined ? {} : { metrics: parseMetricBlocks(phase.metrics) }),
  };
}

function parseHierarchyProjects(value: unknown): readonly HierarchyProject[] {
  if (!Array.isArray(value)) {
    throw new Error("hierarchy projects must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy project must be an object");
    }
    const project = item as Record<string, unknown>;
    return {
      projectId: parseHierarchyRequiredString(project, "projectId"),
      organizationId: parseHierarchyRequiredString(project, "organizationId"),
      departmentId: parseHierarchyRequiredString(project, "departmentId"),
      name: parseHierarchyRequiredString(project, "name"),
      status: parseHierarchyProjectStatus(project.status),
      trajectory: parseHierarchyMetricBlocks(project.trajectory, "trajectory"),
      metrics: parseHierarchyMetricBlocks(project.metrics, "metrics"),
    };
  });
}

function parseHierarchyInitiatives(value: unknown): readonly HierarchyInitiative[] {
  if (!Array.isArray(value)) {
    throw new Error("hierarchy initiatives must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy initiative must be an object");
    }
    const initiative = item as Record<string, unknown>;
    return {
      initiativeId: parseHierarchyRequiredString(initiative, "initiativeId"),
      projectId: parseHierarchyRequiredString(initiative, "projectId"),
      organizationId: parseHierarchyRequiredString(initiative, "organizationId"),
      title: parseHierarchyRequiredString(initiative, "title"),
      status: parseHierarchyInitiativeStatus(initiative.status),
      ...parseOptionalHierarchyPriorityScore(initiative.priorityScore),
      metrics: parseHierarchyMetricBlocks(initiative.metrics, "metrics"),
    };
  });
}

function parseOptionalHierarchyWorkBatches(value: unknown): readonly HierarchyWorkBatch[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("hierarchy workBatches must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy work batch must be an object");
    }
    const batch = item as Record<string, unknown>;
    return {
      batchId: parseHierarchyRequiredString(batch, "batchId"),
      projectId: parseHierarchyRequiredString(batch, "projectId"),
      initiativeId: parseHierarchyRequiredString(batch, "initiativeId"),
      organizationId: parseHierarchyRequiredString(batch, "organizationId"),
      title: parseHierarchyRequiredString(batch, "title"),
      status: parseHierarchyWorkBatchStatus(batch.status),
      ...parseOptionalHierarchyPriorityScore(batch.priorityScore),
      metrics: parseHierarchyMetricBlocks(batch.metrics, "metrics"),
    };
  });
}

function parseOptionalHierarchyWorkItems(value: unknown): readonly HierarchyWorkItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("hierarchy workItems must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy work item must be an object");
    }
    const workItem = item as Record<string, unknown>;
    return {
      workItemId: parseHierarchyRequiredString(workItem, "workItemId"),
      projectId: parseHierarchyRequiredString(workItem, "projectId"),
      ...parseOptionalHierarchyInitiativeId(workItem.initiativeId),
      organizationId: parseHierarchyRequiredString(workItem, "organizationId"),
      title: parseHierarchyRequiredString(workItem, "title"),
      state: parseHierarchyRequiredString(workItem, "state"),
      ...parseOptionalHierarchyPriorityScore(workItem.priorityScore),
      metrics: parseHierarchyMetricBlocks(workItem.metrics, "metrics"),
    };
  });
}

function parseOptionalHierarchyMissions(value: unknown): readonly HierarchyMission[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("hierarchy missions must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy mission must be an object");
    }
    const mission = item as Record<string, unknown>;
    return {
      missionId: parseHierarchyRequiredString(mission, "missionId"),
      issuedByHatId: parseHierarchyRequiredString(mission, "issuedByHatId"),
      ...parseOptionalHierarchyString(mission.assignedHatId, "assignedHatId"),
      ...parseOptionalHierarchyString(mission.departmentId, "departmentId"),
      ...parseOptionalHierarchyString(mission.projectId, "projectId"),
      ...parseOptionalHierarchyString(mission.initiativeId, "initiativeId"),
      ...parseOptionalHierarchyMissionLevel(mission.level),
      goal: parseHierarchyRequiredString(mission, "goal"),
      strategy: parseStringArray(mission.strategy, "strategy"),
      successCriteria: parseStringArray(mission.successCriteria, "successCriteria"),
      timeframe: parseHierarchyMissionTimeframe(mission.timeframe),
      status: parseHierarchyMissionStatus(mission.status),
      progressPercent: parseHierarchyProgressPercent(mission.progressPercent),
      metrics: parseHierarchyMetricBlocks(mission.metrics, "metrics"),
      milestones: parseHierarchyMissionMilestones(mission.milestones),
    };
  });
}

function parseHierarchyMissionTimeframe(value: unknown): HierarchyMission["timeframe"] {
  if (typeof value !== "object" || value === null) {
    throw new Error("hierarchy mission timeframe must be an object");
  }
  const timeframe = value as Record<string, unknown>;
  return {
    startsAt: parseHierarchyRequiredString(timeframe, "startsAt"),
    targetAt: parseHierarchyRequiredString(timeframe, "targetAt"),
  };
}

function parseHierarchyMissionMilestones(value: unknown): readonly HierarchyMissionMilestone[] {
  if (!Array.isArray(value)) {
    throw new Error("hierarchy mission milestones must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("hierarchy mission milestone must be an object");
    }
    const milestone = item as Record<string, unknown>;
    return {
      milestoneId: parseHierarchyRequiredString(milestone, "milestoneId"),
      title: parseHierarchyRequiredString(milestone, "title"),
      targetAt: parseHierarchyRequiredString(milestone, "targetAt"),
      status: parseHierarchyMissionStatus(milestone.status),
      ...parseOptionalHierarchyProgressPercent(milestone.progressPercent),
      metrics: parseHierarchyMetricBlocks(milestone.metrics, "metrics"),
    };
  });
}

function parseHierarchyMissionStatus(value: unknown): HierarchyMission["status"] {
  if (value === "on_track" || value === "at_risk" || value === "behind" || value === "blocked" || value === "complete") {
    return value;
  }
  throw new Error("hierarchy mission requires valid status");
}

function parseOptionalHierarchyMissionLevel(value: unknown): { level?: HatLevel } {
  if (value === undefined) return {};
  if (typeof value !== "string" || !Object.values(HatLevel).includes(value as HatLevel)) {
    throw new Error("hierarchy mission level must be a valid hat level when present");
  }
  return { level: value as HatLevel };
}

function parseHierarchyProgressPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("hierarchy mission progressPercent must be numeric");
  }
  return value;
}

function parseOptionalHierarchyProgressPercent(value: unknown): { progressPercent?: number } {
  if (value === undefined) return {};
  return { progressPercent: parseHierarchyProgressPercent(value) };
}

function parseOptionalHierarchyString(value: unknown, property: string): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`hierarchy mission ${property} must be a string when present`);
  }
  return { [property]: value };
}

function parseHierarchyRequiredString(candidate: Record<string, unknown>, property: string): string {
  const value = candidate[property];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`hierarchy requires string ${property}`);
  }
  return value;
}

function parseHierarchyProjectStatus(value: unknown): HierarchyProject["status"] {
  if (value === "active" || value === "archived") return value;
  throw new Error("hierarchy project requires valid status");
}

function parseHierarchyInitiativeStatus(value: unknown): HierarchyInitiative["status"] {
  if (value === "proposed" || value === "active" || value === "completed" || value === "archived") return value;
  throw new Error("hierarchy initiative requires valid status");
}

function parseHierarchyWorkBatchStatus(value: unknown): HierarchyWorkBatch["status"] {
  if (value === "active" || value === "scheduled" || value === "blocked" || value === "completed" || value === "archived") return value;
  throw new Error("hierarchy work batch requires valid status");
}

function parseOptionalHierarchyInitiativeId(value: unknown): { initiativeId?: string } {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("hierarchy work item initiativeId must be a string when present");
  }
  return { initiativeId: value };
}

function parseOptionalHierarchyPriorityScore(value: unknown): { priorityScore?: number } {
  if (value === undefined) return {};
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("hierarchy priorityScore must be numeric when present");
  }
  return { priorityScore: value };
}

function parseHierarchyMetricBlocks(value: unknown, property: string): readonly MetricBlock[] {
  if (!Array.isArray(value)) {
    throw new Error(`hierarchy ${property} must be an array`);
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`hierarchy ${property} metric must be an object`);
    }
    const metric = item as Record<string, unknown>;
    return {
      id: parseHierarchyRequiredString(metric, "id"),
      label: parseHierarchyRequiredString(metric, "label"),
      value: parseMetricValue(metric.value),
      ...parseOptionalMetricUnit(metric.unit),
    };
  });
}

function parseRequiredString(candidate: Record<string, unknown>, property: string): string {
  const value = candidate[property];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`prompt-flow task requires string ${property}`);
  }
  return value;
}

function parsePromptFlowDefinitionString(candidate: Record<string, unknown>, property: string): string {
  const value = candidate[property];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`prompt-flow definition ${property} must be a non-empty string`);
  }
  return value;
}

function parsePromptFlowRunScope(value: unknown): RunScope {
  if (typeof value !== "string" || !Object.values(RunScope).includes(value as RunScope)) {
    throw new Error("prompt-flow task requires valid scope");
  }
  return value as RunScope;
}

function parsePromptFlowPriority(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("prompt-flow task requires numeric priority");
  }
  return value;
}

function parsePromptFlowRunState(value: unknown): PromptFlowRunState {
  if (typeof value !== "string" || !Object.values(PromptFlowRunState).includes(value as PromptFlowRunState)) {
    throw new Error("prompt-flow run state is invalid");
  }
  return value as PromptFlowRunState;
}

function parseOptionalActionClass(value: unknown): { actionClass?: ActionClass } {
  if (value === undefined) return {};
  if (typeof value !== "string" || !Object.values(ActionClass).includes(value as ActionClass)) {
    throw new Error("prompt-flow task actionClass is invalid");
  }
  return { actionClass: value as ActionClass };
}

function parseOptionalRequiredToolBundles(value: unknown): { requiredToolBundles?: readonly ToolBundleName[] } {
  if (value === undefined) return {};
  const bundles = parseStringArray(value, "requiredToolBundles");
  for (const bundle of bundles) {
    if (!Object.values(ToolBundle).includes(bundle as ToolBundleName)) {
      throw new Error(`prompt-flow task requiredToolBundles contains invalid bundle '${bundle}'`);
    }
  }
  return { requiredToolBundles: bundles as readonly ToolBundleName[] };
}

function parseOptionalStringArray(value: unknown, property: string): Record<string, readonly string[]> {
  if (value === undefined) return {};
  return { [property]: parseStringArray(value, property) };
}

function parseOptionalPromptFlowMetadata(candidate: Record<string, unknown>): Partial<PromptFlowTask> {
  return {
    ...parseOptionalString(candidate.definitionVersion, "definitionVersion"),
    ...parseOptionalString(candidate.phaseId, "phaseId"),
    ...parseOptionalPromptFlowRunState(candidate.runState),
    ...parseOptionalStringArray(candidate.permittedUniversalActions, "permittedUniversalActions"),
    ...parseOptionalStringArray(candidate.requiredEvidenceRefs, "requiredEvidenceRefs"),
    ...parseOptionalPromptFlowGate(candidate.gate),
    ...parseOptionalStringArray(candidate.reviewerHatIds, "reviewerHatIds"),
    ...parseOptionalPositiveInteger(candidate.timeoutSeconds, "timeoutSeconds"),
    ...parseOptionalPositiveInteger(candidate.retryLimit, "retryLimit"),
    ...parseOptionalRollbackPolicy(candidate.rollbackPolicy),
  };
}

function parseOptionalString(value: unknown, property: string): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`prompt-flow task ${property} must be a non-empty string when present`);
  }
  return { [property]: value };
}

function parseOptionalPromptFlowRunState(value: unknown): { runState?: PromptFlowRunState } {
  if (value === undefined) return {};
  if (typeof value !== "string" || !Object.values(PromptFlowRunState).includes(value as PromptFlowRunState)) {
    throw new Error("prompt-flow task runState is invalid");
  }
  return { runState: value as PromptFlowRunState };
}

function parseOptionalPromptFlowGate(value: unknown): Pick<PromptFlowTask, "gate"> {
  if (value === undefined) return {};
  return { gate: parsePromptFlowGate(value) };
}

function parsePromptFlowGate(value: unknown): PromptFlowPhaseGate {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow task gate must be an object when present");
  }
  const gate = value as Record<string, unknown>;
  if (typeof gate.kind !== "string" || !Object.values(PromptFlowGateKind).includes(gate.kind as PromptFlowGateKind)) {
    throw new Error("prompt-flow task gate kind is invalid");
  }
  return {
    kind: gate.kind as PromptFlowGateKind,
    requiredEvidenceRefs: parseStringArray(gate.requiredEvidenceRefs, "gate.requiredEvidenceRefs"),
    ...(gate.reviewerHatIds === undefined ? {} : { reviewerHatIds: parseStringArray(gate.reviewerHatIds, "gate.reviewerHatIds") }),
    ...(gate.approverHatIds === undefined ? {} : { approverHatIds: parseStringArray(gate.approverHatIds, "gate.approverHatIds") }),
    ...(gate.requiredHumanApprovalCount === undefined
      ? {}
      : { requiredHumanApprovalCount: parsePositiveInteger(gate.requiredHumanApprovalCount, "gate.requiredHumanApprovalCount") }),
  };
}

function parseOptionalPositiveInteger(value: unknown, property: "timeoutSeconds" | "retryLimit"): Partial<Pick<PromptFlowTask, "timeoutSeconds" | "retryLimit">> {
  if (value === undefined) return {};
  const parsed = property === "timeoutSeconds"
    ? parsePositiveInteger(value, property)
    : parseNonNegativeInteger(value, property);
  return { [property]: parsed } as Partial<Pick<PromptFlowTask, "timeoutSeconds" | "retryLimit">>;
}

function parsePositiveInteger(value: unknown, property: "timeoutSeconds" | "gate.requiredHumanApprovalCount"): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`prompt-flow task ${property} must be a positive integer when present`);
  }
  return value as number;
}

function parseNonNegativeInteger(value: unknown, property: "retryLimit"): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`prompt-flow task ${property} must be a positive integer when present`);
  }
  return value as number;
}

function parseOptionalRollbackPolicy(value: unknown): Pick<PromptFlowTask, "rollbackPolicy"> {
  if (value === undefined) return {};
  return { rollbackPolicy: parsePromptFlowRollbackPolicy(value) };
}

function parsePromptFlowRollbackPolicy(value: unknown): PromptFlowDefinition["rollbackPolicy"] {
  if (typeof value !== "object" || value === null) {
    throw new Error("prompt-flow task rollbackPolicy must be an object when present");
  }
  const rollback = value as Record<string, unknown>;
  if (rollback.kind !== "compensating_action" && rollback.kind !== "revert_artifact" && rollback.kind !== "cancel_only") {
    throw new Error("prompt-flow task rollbackPolicy kind is invalid");
  }
  if (typeof rollback.description !== "string" || rollback.description.length === 0) {
    throw new Error("prompt-flow task rollbackPolicy description is required");
  }
  return { kind: rollback.kind, description: rollback.description };
}

function parseStringArray(value: unknown, property: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`prompt-flow task ${property} must contain only non-empty strings`);
  }
  return value;
}

function repeatedValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated].sort();
}

function promptFlowDefinitionKey(definition: Pick<PromptFlowDefinition, "promptFlowId" | "version">): string {
  return `${definition.promptFlowId}@${definition.version}`;
}

function parseToolInjections(value: unknown): readonly PromptFlowToolInjection[] {
  if (!Array.isArray(value)) {
    throw new Error("prompt-flow task toolInjections must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null || typeof (item as { tool?: unknown }).tool !== "string") {
      throw new Error("prompt-flow task tool injection requires a tool");
    }
    const injection = item as { tool: string; args?: unknown; requiredSecretScopes?: unknown };
    return {
      tool: injection.tool,
      ...(injection.args === undefined ? {} : { args: injection.args }),
      ...parseOptionalToolInjectionSecretScopes(injection.requiredSecretScopes),
    };
  });
}

function parseOptionalToolInjectionSecretScopes(value: unknown): { requiredSecretScopes?: readonly string[] } {
  if (value === undefined) return {};
  return { requiredSecretScopes: parseStringArray(value, "toolInjection.requiredSecretScopes") };
}

function parseMetricBlocks(value: unknown): readonly MetricBlock[] {
  if (!Array.isArray(value)) {
    throw new Error("prompt-flow task metrics must be an array");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("prompt-flow task metric must be an object");
    }
    const metric = item as Record<string, unknown>;
    const parsed: MetricBlock = {
      id: parseRequiredString(metric, "id"),
      label: parseRequiredString(metric, "label"),
      value: parseMetricValue(metric.value),
      ...parseOptionalMetricUnit(metric.unit),
    };
    return parsed;
  });
}

function parseMetricValue(value: unknown): number | string | boolean {
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  throw new Error("prompt-flow task metric value must be number, string, or boolean");
}

function parseOptionalMetricUnit(value: unknown): { unit?: string } {
  if (value === undefined) return {};
  if (typeof value !== "string") {
    throw new Error("prompt-flow task metric unit must be a string");
  }
  return { unit: value };
}

function parseAgentCliZetaId(value: string, flagName: string): ParseAgentCliZetaIdResult {
  try {
    return { ok: true, value: asZetaIdDecimal(value) };
  } catch {
    return { ok: false, message: `${flagName} must be a base-10 ZetaId, got '${value}'` };
  }
}

function parseJsonEnv(raw: string, envName: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${envName} invalid JSON: ${extractErrorMessage(error)}`);
  }
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
