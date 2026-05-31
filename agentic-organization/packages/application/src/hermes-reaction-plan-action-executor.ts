/**
 * Hermes-backed reaction-plan action executor — where the autonomous DATA PLANE
 * actually runs in the deployed worker.
 *
 * The reaction-plan executor claims a planned action and hands it here. We run
 * the action through a Hermes run (runWorkItemThroughHermes): the agent acts on
 * the work item, heartbeats, and — crucially — that heartbeat is persisted to
 * durable state through the agent-heartbeat writer, so the deterministic
 * keep-alive engine can SEE the agent is alive and reassign it if it goes
 * silent. This closes the loop: a task event drives a reaction plan, which runs
 * an agent, whose liveness the control plane watches.
 *
 * Pure composition over injected ports; Result-as-DU. (The agent's decision is
 * the in-process Hermes runtime today; a real agent/LLM backend swaps in behind
 * the same HermesRuntime port without touching this wiring.)
 */

import type { ReactionPlanAction } from "../../domain/src/index.ts";
import type { HermesRuntime } from "../../hermes/src/index.ts";
import type { Memory } from "../../memory/src/index.ts";
import {
  TelemetrySpanStatusCode,
  type TelemetryPort,
  type TelemetrySpan,
} from "../../observability/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutionContext,
  type ReactionPlanActionExecutionResult,
  type ReactionPlanActionExecutorPort,
} from "../../runtime/src/index.ts";
import type { AsyncEphemeralComposerPort } from "./observe.ts";
import {
  createFirstLegalOptionComposer,
  decideReactionActionAsync,
  summarizeReactionDecision,
  type ReactionDecisionSummary,
} from "./reaction-decision.ts";
import { toAsyncComposer } from "./model-backed-composer.ts";
import {
  buildVerificationToolRequest,
  verificationEvidenceRef,
  type SandboxToolPort,
} from "./sandbox-tool.ts";
import { runWorkItemThroughHermes, type AgentHeartbeatWriter, type WorkItemRunRequest } from "./orchestrate-run.ts";

export type HermesReactionPlanActionExecutorDeps = {
  /** fresh per execution — the run lifecycle (launch -> heartbeat -> complete) is bounded to one action */
  createHermesRuntime: () => HermesRuntime;
  createMemory: () => Memory;
  /** persists agent liveness so the keep-alive engine sees the agent (Cockroach store in production) */
  agentHeartbeatWriter: AgentHeartbeatWriter;
  agentHeartbeatDeadlineMs: number;
  generateId: (prefix: string) => string;
  /**
   * The agent's decision intelligence (async — may make real model calls).
   * Defaults to the deterministic first-legal-option policy. A model-backed
   * composer swaps in here behind the same port; the decision kernel re-checks
   * every choice against the legal set, so the model cannot widen the rules.
   */
  composer?: AsyncEphemeralComposerPort;
  /** clock for the decision readout; defaults to wall-clock. */
  now?: () => string;
  /**
   * Optional sandboxed tool runner. When present, the agent executes a real
   * bounded subprocess to produce verifiable evidence for the run.
   */
  sandbox?: SandboxToolPort;
  /** node binary path for the sandbox verification tool; defaults to the running node. */
  nodeBinary?: string;
  telemetry?: TelemetryPort;
};

export function createHermesReactionPlanActionExecutor(
  deps: HermesReactionPlanActionExecutorDeps,
): ReactionPlanActionExecutorPort {
  return {
    executeReactionPlanAction: async (
      action: ReactionPlanAction,
      context: ReactionPlanActionExecutionContext,
    ): Promise<ReactionPlanActionExecutionResult> => {
      const span = startHermesRunSpan(deps.telemetry, action, context);
      try {
        const result = await executeHermesReactionPlanAction(action, context, deps);
        recordHermesRunSpanResult(span, result);
        return result;
      } catch (error) {
        span?.setStatus({ code: TelemetrySpanStatusCode.Error, message: getErrorMessage(error) });
        span?.end();
        throw error;
      }
    },
  };
}

async function executeHermesReactionPlanAction(
  action: ReactionPlanAction,
  context: ReactionPlanActionExecutionContext,
  deps: HermesReactionPlanActionExecutorDeps,
): Promise<ReactionPlanActionExecutionResult> {
  // The agent makes a REAL decision: the deterministic kernel computes the
  // legal options; the (possibly model-backed) composer chooses among them.
  // A decision the kernel can't legalize fails the run honestly (retryable).
  const decision = await decideReactionActionAsync({
    action,
    composer: deps.composer ?? toAsyncComposer(createFirstLegalOptionComposer()),
    now: deps.now ?? (() => new Date().toISOString()),
    telemetry: {
      hat: action.requiredHat,
    },
  });
  const summary = summarizeReactionDecision(decision);
  if (summary.kind === "feedback") {
    return {
      status: ReactionPlanExecutionStatus.Failed,
      failure: {
        message: `agent could not decide a legal move: ${summary.feedback.reason} - ${summary.feedback.message}`,
        retryable: true,
      },
    };
  }

  // The agent actually runs a sandboxed tool (a real bounded subprocess) to
  // produce verifiable evidence. Tool failure is supplementary, never fatal.
  const toolEvidenceRef = await runSandboxVerification(action, deps);

  const request = mapActionToRunRequest(action, context, deps.generateId, summary, toolEvidenceRef);

  const result = await runWorkItemThroughHermes(request, {
    hermes: deps.createHermesRuntime(),
    memory: deps.createMemory(),
    agentHeartbeatWriter: deps.agentHeartbeatWriter,
    agentHeartbeatDeadlineMs: deps.agentHeartbeatDeadlineMs,
  });

  if (result.outcome === "ok") {
    return {
      status: ReactionPlanExecutionStatus.Succeeded,
      result: {
        message: `agent run ${result.run.runId} ${summary.actionSummary} for work item ${action.workItemId}`,
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: [],
      },
    };
  }

  // the agent run could not complete — retryable so the reaction-plan executor
  // re-claims it on the next cycle (the keep-alive lease guards against pile-up)
  return {
    status: ReactionPlanExecutionStatus.Failed,
    failure: {
      message: `hermes run feedback: ${result.feedback.reason} - ${result.feedback.message}`,
      retryable: true,
    },
  };
}

function startHermesRunSpan(
  telemetry: TelemetryPort | undefined,
  action: ReactionPlanAction,
  context: ReactionPlanActionExecutionContext,
): TelemetrySpan | undefined {
  return telemetry?.startSpan("org.hermes.run", {
    attributes: {
      "agentic.organization.id": action.organizationId,
      "org.work_item_id": action.workItemId,
      "agentic.reaction_plan.id": context.reactionPlanId,
      "agentic.required_hat": action.requiredHat,
    },
    ...createOptionalSpanParent(telemetry, context.traceparent),
  });
}

function createOptionalSpanParent(
  telemetry: TelemetryPort,
  traceparent: string | undefined,
): { parent?: ReturnType<TelemetryPort["extract"]> } {
  return traceparent === undefined ? {} : { parent: telemetry.extract({ traceparent }) };
}

function recordHermesRunSpanResult(
  span: TelemetrySpan | undefined,
  result: ReactionPlanActionExecutionResult,
): void {
  if (span === undefined) {
    return;
  }

  if (result.status === ReactionPlanExecutionStatus.Succeeded) {
    span.setStatus({ code: TelemetrySpanStatusCode.Ok });
    span.end();
    return;
  }

  span.setStatus({ code: TelemetrySpanStatusCode.Error, message: result.failure.message });
  span.end();
}

function mapActionToRunRequest(
  action: ReactionPlanAction,
  context: ReactionPlanActionExecutionContext,
  generateId: (prefix: string) => string,
  decision: Extract<ReactionDecisionSummary, { kind: "summary" }>,
  toolEvidenceRef: string | undefined,
): WorkItemRunRequest {
  // evidence = the trigger event + (when the sandbox produced one) the tool result
  const evidenceRefs = toolEvidenceRef === undefined
    ? [action.triggerEventId]
    : [action.triggerEventId, toolEvidenceRef];
  const learned = toolEvidenceRef === undefined
    ? decision.learned
    : `${decision.learned}; sandbox tool produced ${toolEvidenceRef}`;
  return {
    organizationId: action.organizationId,
    workItemId: action.workItemId,
    agentId: generateId(`agent-${action.requiredHat}`),
    sessionId: context.claimId,
    hatAssignmentId: generateId(`hat-${action.requiredHat}`),
    promptFlowRunId: context.reactionPlanId,
    projectId: action.projectId,
    priorContextNeeded: true,
    // the run records the agent's COMPUTED decision, not a fixed string
    actionSummary: decision.actionSummary,
    evidenceRefs,
    learned,
  };
}

/** Run the sandboxed verification tool if a sandbox is wired; returns an evidence ref or undefined. */
async function runSandboxVerification(
  action: ReactionPlanAction,
  deps: HermesReactionPlanActionExecutorDeps,
): Promise<string | undefined> {
  // both the sandbox runner AND the node binary path come from the composition
  // root; the application layer never reaches for the host process itself.
  if (deps.sandbox === undefined || deps.nodeBinary === undefined) {
    return undefined;
  }
  const result = await deps.sandbox.run(buildVerificationToolRequest(action, deps.nodeBinary));
  return verificationEvidenceRef(result);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
