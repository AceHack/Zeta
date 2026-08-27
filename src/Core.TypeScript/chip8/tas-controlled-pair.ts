import {
  channelLabelFor,
  channelMeterSnapshot,
  createChannelGrantHarness,
  type ChannelGrant,
  type ChannelGrantFeedback,
  type ChannelMeterSnapshot,
  type ChannelSet,
} from "./channel-grant";
import { CLEAN_RUN_CHANNEL_LABEL, type RunKey } from "../chip9/chip8-cross-run-store";

export interface TasPairBudget {
  readonly maxAgentActions: number;
  readonly maxEnvironmentSteps: number;
  readonly attribution: string;
}

export interface TasRunOutcome {
  readonly normalizedScore: number;
  readonly agentActions: number;
  readonly environmentSteps: number;
}

export interface TasExecutionFeedback {
  readonly code: string;
  readonly detail: string;
}

export type TasExecutionResult =
  | { readonly ok: true; readonly value: TasRunOutcome }
  | { readonly ok: false; readonly feedback: TasExecutionFeedback };

export type TasRunContext =
  | {
      readonly mode: "clean";
      readonly subjectId: string;
      readonly runKey: Readonly<RunKey>;
      readonly budget: Readonly<TasPairBudget>;
      readonly grant: null;
    }
  | {
      readonly mode: "assisted";
      readonly subjectId: string;
      readonly runKey: Readonly<RunKey>;
      readonly budget: Readonly<TasPairBudget>;
      readonly grant: ChannelGrant;
    };

export type TasPairFeedbackCode =
  | "invalid-subject-id"
  | "invalid-budget"
  | "clean-run-key-required"
  | "channel-grant-refused"
  | "run-refused"
  | "run-rejected"
  | "invalid-normalized-score"
  | "invalid-agent-action-count"
  | "agent-action-budget-exceeded"
  | "invalid-environment-step-count"
  | "environment-step-budget-exceeded"
  | "crossing-total-overflow";

export interface TasPairFeedback {
  readonly code: TasPairFeedbackCode;
  readonly detail: string;
}

export type TasPairResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: TasPairFeedback };

export interface TasCrossingTotals {
  readonly read: number;
  readonly write: number;
  readonly total: number;
}

export interface TasControlledPairReport {
  readonly subjectId: string;
  readonly budget: Readonly<TasPairBudget>;
  readonly cleanRunKey: Readonly<RunKey>;
  readonly assistedRunKey: Readonly<RunKey>;
  readonly clean: Readonly<TasRunOutcome>;
  readonly assisted: Readonly<TasRunOutcome>;
  readonly scoreDelta: number;
  readonly agentActionDelta: number;
  readonly environmentStepDelta: number;
  readonly crossings: Readonly<TasCrossingTotals>;
  readonly assistedMeter: ChannelMeterSnapshot;
}

export interface TasControlledPairRequest {
  readonly issuedBy: string;
  readonly subjectId: string;
  readonly cleanRunKey: RunKey;
  readonly channels: ChannelSet;
  readonly budget: TasPairBudget;
  readonly execute: (context: TasRunContext) => Promise<TasExecutionResult>;
}

const fail = <T>(code: TasPairFeedbackCode, detail: string): TasPairResult<T> => ({
  ok: false,
  feedback: { code, detail },
});

function grantFailure<T>(feedback: ChannelGrantFeedback): TasPairResult<T> {
  return fail("channel-grant-refused", `${feedback.code}:${feedback.detail}`);
}

function validateSubjectId(subjectId: string): TasPairResult<string> {
  return subjectId.length > 0 && subjectId.trim() === subjectId && !/\s/.test(subjectId)
    ? { ok: true, value: subjectId }
    : fail("invalid-subject-id", subjectId);
}

function validateBudget(budget: TasPairBudget): TasPairResult<Readonly<TasPairBudget>> {
  if (!Number.isSafeInteger(budget.maxAgentActions) || budget.maxAgentActions <= 0) {
    return fail("invalid-budget", `maxAgentActions=${String(budget.maxAgentActions)}`);
  }
  if (!Number.isSafeInteger(budget.maxEnvironmentSteps) || budget.maxEnvironmentSteps <= 0) {
    return fail("invalid-budget", `maxEnvironmentSteps=${String(budget.maxEnvironmentSteps)}`);
  }
  if (budget.attribution.length === 0 || budget.attribution.trim() !== budget.attribution) {
    return fail("invalid-budget", "attribution must be non-empty and trimmed");
  }
  return { ok: true, value: Object.freeze({ ...budget }) };
}

function validateOutcome(
  mode: TasRunContext["mode"],
  budget: TasPairBudget,
  outcome: TasRunOutcome,
): TasPairResult<Readonly<TasRunOutcome>> {
  if (!Number.isFinite(outcome.normalizedScore) || outcome.normalizedScore < 0 || outcome.normalizedScore > 1) {
    return fail("invalid-normalized-score", `${mode}:${String(outcome.normalizedScore)}`);
  }
  if (!Number.isSafeInteger(outcome.agentActions) || outcome.agentActions < 0) {
    return fail("invalid-agent-action-count", `${mode}:${String(outcome.agentActions)}`);
  }
  if (outcome.agentActions > budget.maxAgentActions) {
    return fail(
      "agent-action-budget-exceeded",
      `${mode}:${String(outcome.agentActions)}>${String(budget.maxAgentActions)}`,
    );
  }
  if (!Number.isSafeInteger(outcome.environmentSteps) || outcome.environmentSteps < 0) {
    return fail("invalid-environment-step-count", `${mode}:${String(outcome.environmentSteps)}`);
  }
  if (outcome.environmentSteps > budget.maxEnvironmentSteps) {
    return fail(
      "environment-step-budget-exceeded",
      `${mode}:${String(outcome.environmentSteps)}>${String(budget.maxEnvironmentSteps)}`,
    );
  }
  return { ok: true, value: Object.freeze({ ...outcome }) };
}

function crossingTotals(meter: ChannelMeterSnapshot): TasPairResult<Readonly<TasCrossingTotals>> {
  let read = 0;
  let write = 0;
  for (const row of meter.rows) {
    const current = row.direction === "read" ? read : write;
    if (current > Number.MAX_SAFE_INTEGER - row.crossings) {
      return fail("crossing-total-overflow", `${row.channel}:${row.direction}`);
    }
    if (row.direction === "read") read += row.crossings;
    else write += row.crossings;
  }
  if (read > Number.MAX_SAFE_INTEGER - write) {
    return fail("crossing-total-overflow", "read+write");
  }
  return { ok: true, value: Object.freeze({ read, write, total: read + write }) };
}

async function executeOne(
  execute: TasControlledPairRequest["execute"],
  context: TasRunContext,
): Promise<TasPairResult<TasRunOutcome>> {
  try {
    const result = await execute(context);
    return result.ok
      ? { ok: true, value: result.value }
      : fail("run-refused", `${context.mode}:${result.feedback.code}:${result.feedback.detail}`);
  } catch (error: unknown) {
    return fail("run-rejected", `${context.mode}:${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Run the same subject under the same immutable conditions twice. The harness changes only the
 * channel label and grant: clean has no grant; assisted receives the harness-issued capability.
 */
export async function runTasControlledPair(
  request: TasControlledPairRequest,
): Promise<TasPairResult<TasControlledPairReport>> {
  const subject = validateSubjectId(request.subjectId);
  if (!subject.ok) return subject;
  const budget = validateBudget(request.budget);
  if (!budget.ok) return budget;
  if (request.cleanRunKey.channelLabel !== CLEAN_RUN_CHANNEL_LABEL) {
    return fail("clean-run-key-required", request.cleanRunKey.channelLabel);
  }

  const channelLabel = channelLabelFor(request.channels);
  if (!channelLabel.ok) return grantFailure(channelLabel.feedback);
  const harness = createChannelGrantHarness(request.issuedBy);
  if (!harness.ok) return grantFailure(harness.feedback);

  const cleanRunKey = Object.freeze({ ...request.cleanRunKey });
  const assistedRunKey = Object.freeze({ ...cleanRunKey, channelLabel: channelLabel.value });
  const issued = harness.value.issue(assistedRunKey, request.channels);
  if (!issued.ok) return grantFailure(issued.feedback);

  const cleanContext: TasRunContext = Object.freeze({
    mode: "clean" as const,
    subjectId: subject.value,
    runKey: cleanRunKey,
    budget: budget.value,
    grant: null,
  });
  const assistedContext: TasRunContext = Object.freeze({
    mode: "assisted" as const,
    subjectId: subject.value,
    runKey: assistedRunKey,
    budget: budget.value,
    grant: issued.value,
  });

  const cleanExecution = await executeOne(request.execute, cleanContext);
  if (!cleanExecution.ok) return cleanExecution;
  const clean = validateOutcome("clean", budget.value, cleanExecution.value);
  if (!clean.ok) return clean;

  const assistedExecution = await executeOne(request.execute, assistedContext);
  if (!assistedExecution.ok) return assistedExecution;
  const assisted = validateOutcome("assisted", budget.value, assistedExecution.value);
  if (!assisted.ok) return assisted;

  const meter = channelMeterSnapshot(issued.value);
  if (!meter.ok) return grantFailure(meter.feedback);
  const crossings = crossingTotals(meter.value);
  if (!crossings.ok) return crossings;

  return {
    ok: true,
    value: Object.freeze({
      subjectId: subject.value,
      budget: budget.value,
      cleanRunKey,
      assistedRunKey,
      clean: clean.value,
      assisted: assisted.value,
      scoreDelta: assisted.value.normalizedScore - clean.value.normalizedScore,
      agentActionDelta: assisted.value.agentActions - clean.value.agentActions,
      environmentStepDelta: assisted.value.environmentSteps - clean.value.environmentSteps,
      crossings: crossings.value,
      assistedMeter: meter.value,
    }),
  };
}
