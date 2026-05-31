/**
 * Org cadence lanes (A1–A3) — the proven cycles exposed as CadenceLanes so the
 * always-on worker DRIVES them on their own cadences, joining the keep-alive lane.
 * Each factory inverts its dependencies (stores, hats, event sink) so the lane is
 * unit-testable with fakes and composed with real Cockroach adapters in the worker.
 *
 *   createWorkOsCadenceLane          — the living work loop (runWorkOsCycle) per tick
 *   createMemoryMaintenanceCadenceLane — decay/archive/reinforce + hat-decided moves
 *   createChangeControlCadenceLane   — advance in_review ChangeSets; open at release
 *
 * Every lane catches its own errors into the CadenceLaneTickResult.failures — a
 * lane must never throw (the cadence driver isolates throws, but lanes report
 * cleanly so the trace is honest).
 */

import {
  ChangeSetPhase,
  OrgEventKind,
  StageOutcome,
  currentStage,
  type ChangeSet,
  type HatDefinition,
  type MemoryRecord,
  type MemoryState,
  type OrgEvent,
  type ReviewPipeline,
  type WorkScheduleBlock,
} from "../../../packages/domain/src/index.ts";
import {
  runWorkOsCycle,
  runMemoryMaintenanceCycle,
  runReviewStage,
  resumeHumanStage,
  resubmitChangeSet,
  applyChangeSet,
  ExternalDecision,
  replayLedger,
  planReleaseQueue,
  classifyDeadLetters,
  recoveryIncidentToOrgEvent,
  recoveryScanCompletedToOrgEvent,
  scanAbandonedRunBindings,
  scanStaleReactionPlans,
  scanStrandedScheduleBlocks,
  RunLifecyclePhase,
  RunScope,
  ActRejectionReason,
  type ChangeControlPort,
  type DeadLetterRecoveryCandidate,
  type Menu16Slot,
  type HierarchySnapshot,
  type PromptFlowContext,
  type PromptFlowContextRequest,
  type PromptFlowTask,
  ReleaseQueueActionKind,
  type ReleaseBatchEvaluation,
  type ReactionPlanRecoveryCandidate,
  type ReviewKernelDeps,
  type RunBindingRecoveryCandidate,
  type ScheduleBlockRecoveryCandidate,
  type ScopedMetricAgent,
  type SlotAuthorizationDecision,
} from "../../../packages/application/src/index.ts";
import { runAgentCliCycle, type MenuSelector } from "../../agent-cli/src/agent-cli.ts";
import type { TelemetryPort } from "../../../packages/observability/src/index.ts";
import type { CadenceLane, CadenceLaneTickResult } from "./cadence-lane.ts";

function degraded(message: string): CadenceLaneTickResult {
  return { status: "degraded", failures: [{ message }] };
}

// ── A1: Work OS living loop ──────────────────────────────────────────────────

/** A unit of pending work to drive through the living loop, or null if idle. */
export type WorkIntake = { projectId: string; initiativeId: string; initiativeBranch: string };
export type WorkIntakeSource = () => Promise<WorkIntake | null>;

export type WorkOsCadenceDeps = {
  organizationId: string;
  hats: readonly HatDefinition[];
  now: () => number;
  createId: (prefix: string) => string;
  /** real pending-work source; the worker stays IDLE when this returns null (no synthetic flood) */
  intake: WorkIntakeSource;
  appendEvent: (event: OrgEvent) => Promise<void>;
};

export function createWorkOsCadenceLane(deps: WorkOsCadenceDeps): CadenceLane {
  return {
    name: "work-os",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const work = await deps.intake();
        if (work === null) return { status: "work-os:idle", failures: [] };
        const report = await runWorkOsCycle({
          organizationId: deps.organizationId,
          projectId: work.projectId,
          initiativeId: work.initiativeId,
          initiativeBranch: work.initiativeBranch,
          hats: deps.hats,
          baseTimeMs: deps.now(),
          createId: deps.createId,
          appendEvent: deps.appendEvent,
        });
        return { status: `work-os:${report.finalState}`, failures: [] };
      } catch (error) {
        return degraded(`work-os lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

// ── A1b: observe-act work-item loop ──────────────────────────────────────────

export type ObserveActWorkItem = {
  runId: string;
  projectId: string;
  teamId?: string | undefined;
  workItemId: string;
  scope: RunScope;
  phase: RunLifecyclePhase;
  hasGateApproval: boolean;
  hasEvidence: boolean;
  hatId: string;
  hatAssignmentId: string;
  supervisorHatAssignmentId?: string | undefined;
  agentId: string;
  scheduleBlocks?: readonly WorkScheduleBlock[];
  promptFlowTasks?: readonly PromptFlowTask[];
  promptFlowPage?: number | undefined;
  hierarchy?: HierarchySnapshot;
};

export type ObserveActWorkItemSource = () => Promise<ObserveActWorkItem | null>;
export type ObserveActMenuSelector = MenuSelector;
export type ObserveActCommandRunner = (
  commandType: string,
  command: unknown,
  slot: Menu16Slot,
) => Promise<unknown>;
export type ObserveActToolDispatcher = (
  tool: string,
  args: unknown,
  slot: Menu16Slot,
) => Promise<unknown>;
export type ObserveActPromptFlowContextLoader = (
  request: PromptFlowContextRequest,
  slot: Menu16Slot,
) => Promise<PromptFlowContext>;
export type ObserveActSlotAuthorizationInput = {
  organizationId: string;
  work: ObserveActWorkItem;
  slot: Menu16Slot;
  evaluatedAt: string;
};
export type ObserveActSlotAuthorizer = (
  input: ObserveActSlotAuthorizationInput,
) => Promise<SlotAuthorizationDecision>;
export type ObserveActOrgEventAppender = (event: OrgEvent) => Promise<void>;
export type ObserveActExecutionMode = "primary" | "shadow";
export type ObserveActExecutionModeSource = ObserveActExecutionMode | (() => Promise<ObserveActExecutionMode>);
export type ObserveActSupplementalEvidenceSource = readonly string[] | (() => Promise<readonly string[]>);

export type ObserveActWorkItemCadenceDeps = {
  organizationId: string;
  hats: readonly HatDefinition[];
  now: () => number;
  createId: (prefix: string) => string;
  source: ObserveActWorkItemSource;
  runCommand: ObserveActCommandRunner;
  dispatchTool: ObserveActToolDispatcher;
  appendEvent?: ObserveActOrgEventAppender;
  supplementalEvidenceRefs?: ObserveActSupplementalEvidenceSource | undefined;
  metricAgents?: readonly ScopedMetricAgent[] | undefined;
  loadPromptFlowContext?: ObserveActPromptFlowContextLoader;
  authorizeSlot?: ObserveActSlotAuthorizer;
  executionMode?: ObserveActExecutionModeSource | undefined;
  writeObserveStdout?: (text: string) => void;
  selectSlot?: ObserveActMenuSelector;
};

export function createObserveActWorkItemCadenceLane(deps: ObserveActWorkItemCadenceDeps): CadenceLane {
  const promptFlowPageByRunId = new Map<string, number>();
  return {
    name: "observe-act-work-item",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const work = await deps.source();
        if (work === null) return { status: "observe-act:idle", failures: [] };

        const hat = deps.hats.find((candidate) => candidate.id === work.hatId);
        if (hat === undefined) {
          return degraded(`observe-act lane: unknown hat '${work.hatId}'`);
        }

        const stderr: string[] = [];
        const executionMode = await resolveObserveActExecutionMode(deps.executionMode);
        const supplementalEvidenceRefs = await resolveObserveActSupplementalEvidenceRefs(deps.supplementalEvidenceRefs);
        const promptFlowPage = work.promptFlowPage ?? promptFlowPageByRunId.get(work.runId);
        const result = await runAgentCliCycle({
          argv: observeActArgv(deps.organizationId, work, promptFlowPage),
          now: () => new Date(deps.now()).toISOString(),
          writeStdout: deps.writeObserveStdout ?? (() => undefined),
          writeStderr: (text) => {
            stderr.push(text.trim());
          },
          runCommand: executionMode === "shadow" ? shadowRunCommand : deps.runCommand,
          dispatchTool: executionMode === "shadow" ? shadowDispatchTool : deps.dispatchTool,
          ...(deps.metricAgents === undefined ? {} : { metricAgents: deps.metricAgents }),
          ...createOptionalObserveActScheduleBlocks(work.scheduleBlocks),
          ...createOptionalObserveActPromptFlowTasks(work.promptFlowTasks),
          ...createOptionalObserveActHierarchy(work.hierarchy),
          ...createOptionalObserveActPromptFlowContextLoader(deps.loadPromptFlowContext),
          ...(executionMode === "shadow" ? {} : createOptionalObserveActSlotAuthorizer(deps, work)),
          ...(deps.selectSlot === undefined ? {} : { selectSlot: deps.selectSlot }),
        });
        recordObserveActPageCursor(promptFlowPageByRunId, work.runId, result.actionResult);
        if (result.evidence !== undefined && deps.appendEvent !== undefined) {
          await deps.appendEvent(createObserveActTickEvent(deps, work, result.evidence, supplementalEvidenceRefs));
        }

        return {
          status: formatObserveActStatus(result.actionResult, result.exitCode, executionMode),
          failures: observeActFailures(result.actionResult, result.exitCode, stderr),
        };
      } catch (error) {
        return degraded(`observe-act lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

async function resolveObserveActExecutionMode(
  source: ObserveActExecutionModeSource | undefined,
): Promise<ObserveActExecutionMode> {
  if (source === undefined) return "primary";
  return typeof source === "function" ? await source() : source;
}

async function resolveObserveActSupplementalEvidenceRefs(
  source: ObserveActSupplementalEvidenceSource | undefined,
): Promise<readonly string[]> {
  if (source === undefined) return [];
  return typeof source === "function" ? await source() : source;
}

const shadowRunCommand: ObserveActCommandRunner = async (commandType, _command, slot) => ({
  status: "shadow_selected",
  kind: "command",
  commandType,
  slotIndex: slot.index,
});

const shadowDispatchTool: ObserveActToolDispatcher = async (tool, _args, slot) => ({
  status: "shadow_selected",
  kind: "mcp",
  tool,
  slotIndex: slot.index,
});

function createObserveActTickEvent(
  deps: Pick<ObserveActWorkItemCadenceDeps, "organizationId" | "now" | "createId" | "hats">,
  work: ObserveActWorkItem,
  evidence: NonNullable<Awaited<ReturnType<typeof runAgentCliCycle>>["evidence"]>,
  supplementalEvidenceRefs: readonly string[],
): OrgEvent {
  const eventId = deps.createId("observeactevt");
  const traceId = `observe-act-${work.runId}`;
  return {
    id: eventId,
    kind: OrgEventKind.ObserveActTick,
    occurredAt: new Date(deps.now()).toISOString(),
    organizationId: deps.organizationId,
    actorHatId: work.hatId,
    actorAgentId: work.agentId,
    subjectId: work.workItemId,
    decision: `observe-act selected slot ${evidence.selectedIndex} for run ${work.runId}`,
    supervisorChain: supervisorChainFor(work.hatId, deps.hats),
    evidenceRefs: [
      ...observeActEvidenceRefs(evidence),
      ...supplementalEvidenceRefs,
    ],
    correlationId: traceId,
    causationId: eventId,
    traceId,
  };
}

function supervisorChainFor(hatId: string, hats: readonly HatDefinition[]): readonly string[] {
  const byId = new Map(hats.map((hat) => [hat.id, hat]));
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = hatId;
  while (current !== undefined && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = byId.get(current)?.reportsToHatIds[0];
  }
  return chain.reverse();
}

function observeActEvidenceRefs(
  evidence: NonNullable<Awaited<ReturnType<typeof runAgentCliCycle>>["evidence"]>,
): readonly string[] {
  return [
    `observe-act:menu_hash:${evidence.menuHash}`,
    `observe-act:selected_slot:${evidence.selectedIndex}`,
    `observe-act:veto_count:${evidence.vetoCount}`,
    `observe-act:true_slot_count:${evidence.trueSlotCount}`,
    ...selectedCommandEvidenceRefs(evidence),
    ...promptFlowPageEvidenceRefs(evidence),
    ...evidence.selectorRejections.flatMap(selectorRejectionEvidenceRefs),
    ...statusEvidenceRefs(evidence),
    ...actionRejectionEvidenceRefs(evidence),
    ...evidence.promptFlowIds.map((id) => `observe-act:prompt_flow:${id}`),
    ...evidence.metricBlockIds.map((id) => `observe-act:metric:${id}`),
  ];
}

function selectedCommandEvidenceRefs(
  evidence: NonNullable<Awaited<ReturnType<typeof runAgentCliCycle>>["evidence"]>,
): readonly string[] {
  return evidence.selectedCommandType === undefined
    ? []
    : [`observe-act:command_type:${evidence.selectedCommandType}`];
}

function statusEvidenceRefs(
  evidence: NonNullable<Awaited<ReturnType<typeof runAgentCliCycle>>["evidence"]>,
): readonly string[] {
  if (evidence.statusSignalKind === undefined) return [];
  return [
    `observe-act:status:${evidence.statusSignalKind}`,
    ...(evidence.statusScope === undefined ? [] : [`observe-act:status_scope:${evidence.statusScope}`]),
    ...(evidence.statusPhase === undefined ? [] : [`observe-act:status_phase:${evidence.statusPhase}`]),
    ...(evidence.statusHierarchyPriorityScope === undefined ? [] : [`observe-act:status_priority_scope:${evidence.statusHierarchyPriorityScope}`]),
  ];
}

function promptFlowPageEvidenceRefs(
  evidence: NonNullable<Awaited<ReturnType<typeof runAgentCliCycle>>["evidence"]>,
): readonly string[] {
  return [
    ...(evidence.promptFlowPage === undefined ? [] : [`observe-act:prompt_flow_page:${evidence.promptFlowPage}`]),
    ...(evidence.selectedPromptFlowTaskId === undefined ? [] : [`observe-act:selected_prompt_flow_task:${evidence.selectedPromptFlowTaskId}`]),
    ...(evidence.selectedPromptFlowId === undefined ? [] : [`observe-act:selected_prompt_flow:${evidence.selectedPromptFlowId}`]),
    ...(evidence.reobservePromptFlowPage === undefined ? [] : [`observe-act:reobserve_prompt_flow_page:${evidence.reobservePromptFlowPage}`]),
  ];
}

function actionRejectionEvidenceRefs(
  evidence: NonNullable<Awaited<ReturnType<typeof runAgentCliCycle>>["evidence"]>,
): readonly string[] {
  if (
    evidence.actionRejectionReason !== ActRejectionReason.ControlPlaneDenied &&
    evidence.actionRejectionReason !== ActRejectionReason.ScheduleAuthorityDenied
  ) {
    return [];
  }
  return [
    `observe-act:control_bypass_rejected:${evidence.actionRejectionReason}:${evidence.selectedIndex}`,
  ];
}

function selectorRejectionEvidenceRefs(
  rejection: NonNullable<Awaited<ReturnType<typeof runAgentCliCycle>>["evidence"]>["selectorRejections"][number],
): readonly string[] {
  const rejectedIndex = rejection.rejectedIndex === undefined ? "unknown" : String(rejection.rejectedIndex);
  return [
    `observe-act:selector_rejected:${rejection.reason}:${rejectedIndex}`,
    `observe-act:selector_rejected_fallback_slot:${rejection.fallbackIndex}`,
  ];
}

function observeActArgv(organizationId: string, work: ObserveActWorkItem, promptFlowPage: number | undefined): string[] {
  return [
    "observe",
    "--hat",
    work.hatId,
    "--scope",
    work.scope,
    "--phase",
    work.phase,
    "--run-id",
    work.runId,
    "--hat-assignment",
    work.hatAssignmentId,
    "--agent",
    work.agentId,
    "--organization",
    organizationId,
    "--project",
    work.projectId,
    "--work-item",
    work.workItemId,
    ...observeActOptionalArg("--team", work.teamId),
    ...observeActOptionalArg("--supervisor-hat-assignment", work.supervisorHatAssignmentId),
    ...observeActPromptFlowPageArgs(promptFlowPage),
    ...observeActBooleanArgs(work),
  ];
}

function observeActOptionalArg(flag: string, value: string | undefined): string[] {
  return value === undefined ? [] : [flag, value];
}

function observeActPromptFlowPageArgs(promptFlowPage: number | undefined): string[] {
  return promptFlowPage === undefined ? [] : ["--prompt-flow-page", String(promptFlowPage)];
}

function createOptionalObserveActPromptFlowTasks(
  promptFlowTasks: readonly PromptFlowTask[] | undefined,
): { promptFlowTasks?: readonly PromptFlowTask[] } {
  return promptFlowTasks === undefined ? {} : { promptFlowTasks };
}

function createOptionalObserveActScheduleBlocks(
  scheduleBlocks: readonly WorkScheduleBlock[] | undefined,
): { scheduleBlocks?: readonly WorkScheduleBlock[] } {
  return scheduleBlocks === undefined ? {} : { scheduleBlocks };
}

function createOptionalObserveActHierarchy(
  hierarchy: HierarchySnapshot | undefined,
): { hierarchy?: HierarchySnapshot } {
  return hierarchy === undefined ? {} : { hierarchy };
}

function createOptionalObserveActPromptFlowContextLoader(
  loadPromptFlowContext: ObserveActPromptFlowContextLoader | undefined,
): { loadPromptFlowContext?: ObserveActPromptFlowContextLoader } {
  return loadPromptFlowContext === undefined ? {} : { loadPromptFlowContext };
}

function createOptionalObserveActSlotAuthorizer(
  deps: ObserveActWorkItemCadenceDeps,
  work: ObserveActWorkItem,
): { authorizeSlot?: (slot: Menu16Slot) => Promise<SlotAuthorizationDecision> } {
  return deps.authorizeSlot === undefined
    ? {}
    : {
        authorizeSlot: async (slot) =>
          await deps.authorizeSlot!({
            organizationId: deps.organizationId,
            work,
            slot,
            evaluatedAt: new Date(deps.now()).toISOString(),
          }),
      };
}

function observeActBooleanArgs(work: ObserveActWorkItem): string[] {
  return [
    ...(work.hasGateApproval ? ["--gate-approved"] : []),
    ...(work.hasEvidence ? ["--evidence"] : []),
  ];
}

function formatObserveActStatus(
  result: Awaited<ReturnType<typeof runAgentCliCycle>>["actionResult"],
  exitCode: number,
  executionMode: ObserveActExecutionMode = "primary",
): string {
  const prefix = executionMode === "shadow" ? "observe-act-shadow" : "observe-act";
  if (result?.outcome === "dispatched") {
    return `${prefix}:${result.kind}:${observeActDispatchStatus(result.result)}`;
  }
  if (result?.outcome === "reobserve") {
    return `${prefix}:reobserve:${result.scope}${result.menuPage?.promptFlows === undefined ? "" : `:prompt_flow_page:${result.menuPage.promptFlows}`}`;
  }
  if (result?.outcome === "loaded_context") {
    return `${prefix}:context:${result.context.taskId}`;
  }
  if (result?.outcome === "status_report") {
    return `${prefix}:status:${result.status.kind}`;
  }
  if (result?.outcome === "rejected") {
    return `${prefix}:rejected:${result.reason}`;
  }
  return exitCode === 0 ? `${prefix}:no_action` : `${prefix}:rejected`;
}

function recordObserveActPageCursor(
  cursor: Map<string, number>,
  runId: string,
  result: Awaited<ReturnType<typeof runAgentCliCycle>>["actionResult"],
): void {
  if (result?.outcome !== "reobserve" || result.menuPage?.promptFlows === undefined) return;
  cursor.set(runId, result.menuPage.promptFlows);
}

function observeActDispatchStatus(result: unknown): string {
  if (typeof result === "object" && result !== null && "status" in result) {
    const status = (result as { status?: unknown }).status;
    if (typeof status === "string") return status;
  }
  return "dispatched";
}

function observeActFailures(
  result: Awaited<ReturnType<typeof runAgentCliCycle>>["actionResult"],
  exitCode: number,
  stderr: readonly string[],
): CadenceLaneTickResult["failures"] {
  if (result?.outcome === "rejected") {
    return [{ message: `observe-act lane: ${result.reason}: ${result.message}` }];
  }
  if (exitCode !== 0) {
    return [{ message: `observe-act lane: ${stderr.join("; ") || `CLI exited ${exitCode}`}` }];
  }
  return [];
}

// ── A2: memory maintenance ───────────────────────────────────────────────────

export type MemoryEnvelopeReader = {
  listAll: (organizationId: string) => Promise<readonly import("../../../packages/domain/src/index.ts").MemoryEnvelope[]>;
};
export type MemoryStateWriter = {
  upsert: (record: MemoryRecord, state: MemoryState) => Promise<void>;
};

export type MemoryMaintenanceCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  reader: MemoryEnvelopeReader;
  writer: MemoryStateWriter;
  appendEvent: (event: OrgEvent) => Promise<void>;
};

export function createMemoryMaintenanceCadenceLane(deps: MemoryMaintenanceCadenceDeps): CadenceLane {
  return {
    name: "memory-maintenance",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const envelopes = await deps.reader.listAll(deps.organizationId);
        const result = runMemoryMaintenanceCycle(envelopes, { organizationId: deps.organizationId, now: deps.now(), createId: deps.createId });
        const byId = new Map(envelopes.map((e) => [e.memoryId, e]));
        for (const upd of result.updates) {
          const env = byId.get(upd.memoryId);
          if (env === undefined) continue;
          const record: MemoryRecord = { memoryId: env.memoryId, organizationId: env.organizationId, tier: env.tier, scope: env.scope, key: env.key, value: "", protected: env.protected, writtenBy: env.writtenBy, writtenAt: env.writtenAt };
          const nextState: MemoryState = { ...env.state, phase: upd.nextPhase, weight: upd.nextWeight, confidence: upd.nextConfidence, ...(upd.archivedAt !== undefined ? { archivedAt: upd.archivedAt } : {}) };
          await deps.writer.upsert(record, nextState);
        }
        for (const e of result.events) await deps.appendEvent(e);
        return { status: `memory:${result.recomputed}recomputed/${result.archived.length}archived`, failures: [] };
      } catch (error) {
        return degraded(`memory lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

// ── A3: change control ───────────────────────────────────────────────────────

export type ChangeSetReader = {
  listByOrgPhase: (organizationId: string, phase: ChangeSetPhase) => Promise<readonly ChangeSet[]>;
};
export type ChangeSetWriter = {
  upsert: (cs: ChangeSet) => Promise<void>;
};

export type ChangeControlCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  reader: ChangeSetReader;
  writer: ChangeSetWriter;
  pipelineFor: (cs: ChangeSet) => ReviewPipeline;
  appendEvent: (event: OrgEvent) => Promise<void>;
  /**
   * live external review port (L0). When present, an `external` stage projects a real
   * PR/card (if not yet projected) and the external decision is PULLED from it instead
   * of auto-approved. Absent (the default deploy) → external stages auto-approve.
   */
  externalPort?: ChangeControlPort;
};

export function createChangeControlCadenceLane(deps: ChangeControlCadenceDeps): CadenceLane {
  return {
    name: "change-control",
    async runOnce(): Promise<CadenceLaneTickResult> {
      // kernel fields shared across ChangeSets this tick; `now` is the CURRENT time
      // (built fresh per tick, not factory-time). externalDecision is resolved per
      // ChangeSet below (live port pull when configured, else auto-approved).
      const baseKernel = {
        organizationId: deps.organizationId,
        now: deps.now(),
        createId: deps.createId,
        blockingFindings: () => 0,
        testsGreen: (cs: ChangeSet) => cs.revision >= 2,
        quorumApprovals: () => 3,
      };
      try {
        // advance every in_review ChangeSet one step; auto-resume human/external in this lane
        const inReview = await deps.reader.listByOrgPhase(deps.organizationId, ChangeSetPhase.InReview);
        let advanced = 0;
        for (const cs of inReview) {
          const pipeline = deps.pipelineFor(cs);
          let next = cs;

          // resolve the external decision for THIS ChangeSet's current stage: when a live
          // port is configured and the stage is external, project a real PR/card (once) and
          // PULL the decision; otherwise auto-approve (internal-only default).
          let externalDecision: ExternalDecision = ExternalDecision.Approved;
          const stage = currentStage(next, pipeline);
          if (deps.externalPort !== undefined && stage !== undefined && stage.authority.kind === "external") {
            const externalSystem = stage.authority.system; // capture before the closure (narrowing won't survive into it)
            let ref = next.projections.find((p) => p.system === externalSystem);
            if (ref === undefined) {
              ref = await deps.externalPort.project(next, stage);
              next = { ...next, projections: [...next.projections, ref], updatedAt: new Date(deps.now()).toISOString() };
              await deps.writer.upsert(next);
            }
            const externalState = await deps.externalPort.pull(ref);
            externalDecision = externalState.decision;
          }
          const kernel: ReviewKernelDeps = { ...baseKernel, externalDecision: () => externalDecision };

          const result = runReviewStage(next, pipeline, kernel);
          next = result.changeSet;
          await deps.writer.upsert(next);
          for (const e of result.events) await deps.appendEvent(e);
          if (result.paused && currentStage(next, pipeline)?.authority.kind === "human") {
            const resumed = resumeHumanStage(next, pipeline, StageOutcome.Approve, "qa_lead", kernel);
            next = resumed.changeSet;
            await deps.writer.upsert(next);
            for (const e of resumed.events) await deps.appendEvent(e);
          }
          if (next.phase === ChangeSetPhase.ChangesRequested) {
            const re = resubmitChangeSet(next, kernel);
            next = re.changeSet;
            await deps.writer.upsert(next);
            for (const e of re.events) await deps.appendEvent(e);
          }
          advanced += 1;
        }
        return { status: `change-control:${advanced}advanced`, failures: [] };
      } catch (error) {
        return degraded(`change-control lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

// ── G1: release queue ───────────────────────────────────────────────────────

export type ReleaseQueueCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  reader: ChangeSetReader;
  writer: ChangeSetWriter;
  appendEvent: (event: OrgEvent) => Promise<void>;
  maxBatchSize?: number;
  evaluateBatch?: (batch: readonly ChangeSet[]) => ReleaseBatchEvaluation;
  runAtomically?: (operation: (ports: ReleaseQueuePersistencePorts) => Promise<void>) => Promise<void>;
};

export type ReleaseQueuePersistencePorts = {
  writer: ChangeSetWriter;
  appendEvent: (event: OrgEvent) => Promise<void>;
};

const DEFAULT_RELEASE_QUEUE_BATCH_SIZE = 8;

export function createReleaseQueueCadenceLane(deps: ReleaseQueueCadenceDeps): CadenceLane {
  return {
    name: "release-queue",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const approved = await deps.reader.listByOrgPhase(deps.organizationId, ChangeSetPhase.Approved);
        if (approved.length === 0) {
          return {
            status: "release-queue:0applied/0changes_requested/0requeued",
            failures: [],
          };
        }
        if (deps.evaluateBatch === undefined) {
          return degraded("release-queue lane: release batch evaluator unavailable");
        }
        const plan = planReleaseQueue({
          approvedChangeSets: approved,
          maxBatchSize: deps.maxBatchSize ?? DEFAULT_RELEASE_QUEUE_BATCH_SIZE,
          evaluateBatch: deps.evaluateBatch,
        });
        const byId = new Map(approved.map((cs) => [cs.changeSetId, cs]));
        const counts = { applied: 0, changesRequested: 0, requeued: 0 };
        const persist = deps.runAtomically ?? (async (operation) => await operation({
          writer: deps.writer,
          appendEvent: deps.appendEvent,
        }));

        if (plan.actions.length > 0) {
          await persist(async (ports) => {
            for (const action of plan.actions) {
              const cs = byId.get(action.changeSetId);
              if (cs === undefined) continue;

              if (action.kind === ReleaseQueueActionKind.Apply) {
                const kernel = releaseQueueKernel(deps);
                const applied = applyChangeSet(cs, kernel);
                await ports.writer.upsert(applied.changeSet);
                for (const event of applied.events) {
                  await ports.appendEvent(withEvidence(event, action.evidenceRefs));
                }
                counts.applied += 1;
              } else if (action.kind === ReleaseQueueActionKind.RequestChanges) {
                const next = {
                  ...cs,
                  phase: ChangeSetPhase.ChangesRequested,
                  updatedAt: new Date(deps.now()).toISOString(),
                };
                await ports.writer.upsert(next);
                await ports.appendEvent(releaseQueueChangesRequestedEvent(deps, cs, action.evidenceRefs));
                counts.changesRequested += 1;
              } else {
                counts.requeued += 1;
              }
            }
          });
        }

        return {
          status: `release-queue:${counts.applied}applied/${counts.changesRequested}changes_requested/${counts.requeued}requeued`,
          failures: [],
        };
      } catch (error) {
        return degraded(`release-queue lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

function releaseQueueKernel(deps: ReleaseQueueCadenceDeps): ReviewKernelDeps {
  return {
    organizationId: deps.organizationId,
    now: deps.now(),
    createId: deps.createId,
  };
}

function withEvidence(event: OrgEvent, evidenceRefs: readonly string[]): OrgEvent {
  return {
    ...event,
    evidenceRefs: [...event.evidenceRefs, ...evidenceRefs],
  };
}

function releaseQueueChangesRequestedEvent(
  deps: ReleaseQueueCadenceDeps,
  cs: ChangeSet,
  evidenceRefs: readonly string[],
): OrgEvent {
  const correlationId = deps.createId("releaseq-corr");
  return {
    id: deps.createId("releaseq-evt"),
    kind: OrgEventKind.ChangesRequested,
    occurredAt: new Date(deps.now()).toISOString(),
    organizationId: deps.organizationId,
    subjectId: cs.changeSetId,
    fromState: ChangeSetPhase.Approved,
    toState: ChangeSetPhase.ChangesRequested,
    decision: `release queue isolated red ChangeSet ${cs.changeSetId}`,
    supervisorChain: ["executive_board", "coo"],
    evidenceRefs,
    correlationId,
    causationId: correlationId,
    traceId: correlationId,
  };
}

// ── D4: document maintenance ─────────────────────────────────────────────────

import {
  DocLifecycleState,
  type DocUnit,
} from "../../../packages/domain/src/index.ts";
import { runDocMaintenanceCycle } from "../../../packages/application/src/index.ts";

export type DocUnitMaintenanceReader = {
  listByOrgStatus: (organizationId: string, status: DocLifecycleState) => Promise<readonly DocUnit[]>;
};
export type DocUnitMaintenanceWriter = {
  upsert: (unit: DocUnit) => Promise<void>;
};

export type DocMaintenanceCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  reader: DocUnitMaintenanceReader;
  writer: DocUnitMaintenanceWriter;
  appendEvent: (event: OrgEvent) => Promise<void>;
  stalenessFloorMs?: number;
  archiveFloorMs?: number;
};

const DOC_DAY_MS = 86_400_000;

/**
 * D4 lane: the Documentation department's maintenance cycle on its own cadence — flags
 * stale, supersedes by recency, archives the long-dead, surfaces conflicts. Persists each
 * status update + emits the doc_* events. Never throws (failures → CadenceLaneTickResult).
 */
export function createDocMaintenanceCadenceLane(deps: DocMaintenanceCadenceDeps): CadenceLane {
  return {
    name: "doc-maintenance",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const active = await deps.reader.listByOrgStatus(deps.organizationId, DocLifecycleState.Active);
        const stale = await deps.reader.listByOrgStatus(deps.organizationId, DocLifecycleState.Stale);
        const superseded = await deps.reader.listByOrgStatus(deps.organizationId, DocLifecycleState.Superseded);
        const units = [...active, ...stale, ...superseded];
        const byId = new Map(units.map((d) => [d.docUnitId, d]));

        const result = runDocMaintenanceCycle(units, {
          organizationId: deps.organizationId, now: deps.now(), createId: deps.createId,
          stalenessFloorMs: deps.stalenessFloorMs ?? 30 * DOC_DAY_MS,
          archiveFloorMs: deps.archiveFloorMs ?? 180 * DOC_DAY_MS,
        });
        const nowIso = new Date(deps.now()).toISOString();
        for (const upd of result.updates) {
          const unit = byId.get(upd.docUnitId);
          if (unit === undefined) continue;
          await deps.writer.upsert({ ...unit, status: upd.nextStatus, updatedAt: nowIso, version: unit.version + 1 });
        }
        for (const e of result.events) await deps.appendEvent(e);
        return { status: `doc:${result.staleFlagged}stale/${result.superseded}superseded/${result.archived}archived/${result.conflicts.length}conflicts`, failures: [] };
      } catch (error) {
        return degraded(`doc-maintenance lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

// ── M1: ledger conformance ──────────────────────────────────────────────────

export type ConformanceEventReader = {
  listByOrganization: (organizationId: string, limit: number) => Promise<readonly OrgEvent[]>;
};

export type ConformanceCadenceDeps = {
  organizationId: string;
  reader: ConformanceEventReader;
  limit: number;
  telemetry?: TelemetryPort;
};

/**
 * M1 lane: continuously replays the org_event ledger tail through the pure legal
 * transition clamps. A violation is degraded evidence, not a thrown worker crash.
 */
export function createConformanceCadenceLane(deps: ConformanceCadenceDeps): CadenceLane {
  return {
    name: "conformance",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const events = await deps.reader.listByOrganization(deps.organizationId, deps.limit);
        const report = replayLedger(events, { maxSkippedAmbiguous: 0 });
        recordConformanceMetric(deps, report);
        if (report.ratchetViolated) {
          return degraded(
            `conformance lane: ambiguous transition skip ratchet exceeded; skipped=${report.skippedAmbiguous} max=${report.ratchetViolation!.maxSkippedAmbiguous}`,
          );
        }
        if (report.nonconformant > 0) {
          const first = report.violations[0]!;
          return degraded(`conformance lane: ${report.nonconformant} violation(s); first=${first.eventId} ${first.fromState}->${first.toState} legal=[${first.legalToStates.join(",")}]`);
        }
        return { status: `conformance:${report.checked}checked/${report.nonconformant}violations/${report.skipped}skipped`, failures: [] };
      } catch (error) {
        return degraded(`conformance lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

function recordConformanceMetric(deps: ConformanceCadenceDeps, report: ReturnType<typeof replayLedger>): void {
  deps.telemetry?.recordMetric({
    kind: "gauge",
    name: "org_conformance_pass_ratio",
    value: report.checked === 0 ? 1 : report.conformant / report.checked,
    attributes: {
      "agentic.organization.id": deps.organizationId,
      "agentic.conformance.checked": report.checked,
      "agentic.conformance.conformant": report.conformant,
      "agentic.conformance.nonconformant": report.nonconformant,
      "agentic.conformance.skipped": report.skipped,
      "agentic.conformance.skipped_ambiguous": report.skippedAmbiguous,
    },
  });
  deps.telemetry?.recordMetric({
    kind: "gauge",
    name: "org_conformance_coverage_ratio",
    value: report.coverageRatio,
    attributes: {
      "agentic.organization.id": deps.organizationId,
      "agentic.conformance.checked": report.checked,
      "agentic.conformance.skipped_ambiguous": report.skippedAmbiguous,
    },
  });
}

// ── G3: recovery scanners ───────────────────────────────────────────────────

const DEFAULT_RECOVERY_SCAN_LIMIT = 100;
const DEFAULT_STALE_REACTION_PLAN_MS = 10 * 60 * 1000;
const DEFAULT_STRANDED_SCHEDULE_GRACE_MS = 5 * 60 * 1000;
const DEFAULT_ABANDONED_RUN_HEARTBEAT_MS = 5 * 60 * 1000;

export type StaleReactionPlanScanReader = {
  listStaleReactionPlanCandidates: (input: {
    organizationId: string;
    nowIso: string;
    staleBeforeIso: string;
    limit: number;
  }) => Promise<readonly ReactionPlanRecoveryCandidate[]>;
};

export type StrandedScheduleScanReader = {
  listStrandedScheduleCandidates: (input: {
    organizationId: string;
    nowIso: string;
    endedBeforeIso: string;
    limit: number;
  }) => Promise<readonly ScheduleBlockRecoveryCandidate[]>;
};

export type AbandonedRunBindingScanReader = {
  listAbandonedRunBindingCandidates: (input: {
    organizationId: string;
    nowMs: number;
    heartbeatBeforeIso: string;
    limit: number;
  }) => Promise<readonly RunBindingRecoveryCandidate[]>;
};

export type DeadLetterClassifierReader = {
  listDeadLetterCandidates: (input: {
    organizationId: string;
    limit: number;
  }) => Promise<readonly DeadLetterRecoveryCandidate[]>;
};

export type RecoveryScanCadenceDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
  appendEvent: (event: OrgEvent) => Promise<void>;
  limit?: number;
};

export type StaleReactionPlanScanCadenceDeps = RecoveryScanCadenceDeps & {
  staleAfterMs?: number;
  reader: StaleReactionPlanScanReader;
};

export type StrandedScheduleScanCadenceDeps = RecoveryScanCadenceDeps & {
  graceMs?: number;
  reader: StrandedScheduleScanReader;
};

export type AbandonedRunBindingScanCadenceDeps = RecoveryScanCadenceDeps & {
  heartbeatDeadlineMs?: number;
  reader: AbandonedRunBindingScanReader;
};

export type DeadLetterClassifierCadenceDeps = RecoveryScanCadenceDeps & {
  reader: DeadLetterClassifierReader;
};

export function createStaleReactionPlanScanCadenceLane(deps: StaleReactionPlanScanCadenceDeps): CadenceLane {
  return {
    name: "stale-reaction-plan-scan",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const now = deps.now();
        const candidates = await deps.reader.listStaleReactionPlanCandidates({
          organizationId: deps.organizationId,
          nowIso: new Date(now).toISOString(),
          staleBeforeIso: new Date(now - (deps.staleAfterMs ?? DEFAULT_STALE_REACTION_PLAN_MS)).toISOString(),
          limit: deps.limit ?? DEFAULT_RECOVERY_SCAN_LIMIT,
        });
        const report = scanStaleReactionPlans({
          nowMs: now,
          staleAfterMs: deps.staleAfterMs ?? DEFAULT_STALE_REACTION_PLAN_MS,
          reactionPlans: candidates,
        });
        await appendRecoveryScanEvents(deps, report);
        return { status: `stale-reaction-plan-scan:${report.incidents.length}incidents`, failures: [] };
      } catch (error) {
        return degraded(`stale-reaction-plan-scan lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

export function createStrandedScheduleScanCadenceLane(deps: StrandedScheduleScanCadenceDeps): CadenceLane {
  return {
    name: "stranded-schedule-scan",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const now = deps.now();
        const candidates = await deps.reader.listStrandedScheduleCandidates({
          organizationId: deps.organizationId,
          nowIso: new Date(now).toISOString(),
          endedBeforeIso: new Date(now - (deps.graceMs ?? DEFAULT_STRANDED_SCHEDULE_GRACE_MS)).toISOString(),
          limit: deps.limit ?? DEFAULT_RECOVERY_SCAN_LIMIT,
        });
        const report = scanStrandedScheduleBlocks({
          nowMs: now,
          graceMs: deps.graceMs ?? DEFAULT_STRANDED_SCHEDULE_GRACE_MS,
          scheduleBlocks: candidates,
        });
        await appendRecoveryScanEvents(deps, report);
        return { status: `stranded-schedule-scan:${report.incidents.length}incidents`, failures: [] };
      } catch (error) {
        return degraded(`stranded-schedule-scan lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

export function createAbandonedRunBindingScanCadenceLane(deps: AbandonedRunBindingScanCadenceDeps): CadenceLane {
  return {
    name: "abandoned-run-binding-scan",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const now = deps.now();
        const candidates = await deps.reader.listAbandonedRunBindingCandidates({
          organizationId: deps.organizationId,
          nowMs: now,
          heartbeatBeforeIso: new Date(now - (deps.heartbeatDeadlineMs ?? DEFAULT_ABANDONED_RUN_HEARTBEAT_MS)).toISOString(),
          limit: deps.limit ?? DEFAULT_RECOVERY_SCAN_LIMIT,
        });
        const report = scanAbandonedRunBindings({
          nowMs: now,
          heartbeatDeadlineMs: deps.heartbeatDeadlineMs ?? DEFAULT_ABANDONED_RUN_HEARTBEAT_MS,
          runs: candidates,
        });
        await appendRecoveryScanEvents(deps, report);
        return { status: `abandoned-run-binding-scan:${report.incidents.length}incidents`, failures: [] };
      } catch (error) {
        return degraded(`abandoned-run-binding-scan lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

export function createDeadLetterClassifierCadenceLane(deps: DeadLetterClassifierCadenceDeps): CadenceLane {
  return {
    name: "dead-letter-classifier",
    async runOnce(): Promise<CadenceLaneTickResult> {
      try {
        const candidates = await deps.reader.listDeadLetterCandidates({
          organizationId: deps.organizationId,
          limit: deps.limit ?? DEFAULT_RECOVERY_SCAN_LIMIT,
        });
        const report = classifyDeadLetters({ deadLetters: candidates });
        await appendRecoveryScanEvents(deps, report);
        return { status: `dead-letter-classifier:${report.incidents.length}incidents`, failures: [] };
      } catch (error) {
        return degraded(`dead-letter-classifier lane: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

async function appendRecoveryScanEvents(
  deps: RecoveryScanCadenceDeps,
  report: Parameters<typeof recoveryScanCompletedToOrgEvent>[0]["report"],
): Promise<void> {
  const occurredAt = new Date(deps.now()).toISOString();
  const correlationId = `${deps.organizationId}:${report.scanner}:${occurredAt}`;
  const traceId = correlationId;

  for (const incident of report.incidents) {
    const id = deps.createId("recovery-incident");
    await deps.appendEvent(recoveryIncidentToOrgEvent({
      incident,
      id,
      occurredAt,
      organizationId: deps.organizationId,
      correlationId,
      traceId,
    }));
  }

  const id = deps.createId("recovery-scan");
  await deps.appendEvent(recoveryScanCompletedToOrgEvent({
    report,
    id,
    occurredAt,
    organizationId: deps.organizationId,
    correlationId,
    traceId,
  }));
}
