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

/** The readout: current state + available options + the rules that shaped it. */
export type RunStateReadout = {
  runId: ZetaIdDecimal;
  scope: RunScope;
  phase: RunLifecyclePhase;
  trace: RunTrace;
  observedAt: string;
  options: readonly AvailableOption[];
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
};

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

/**
 * The keystone read. Pure over the snapshot; holds no memory. Returns the
 * current state and the options that survive every deterministic rule, or a
 * feedback variant when there is nothing legal to surface.
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
  for (const option of rawOptions) {
    const vetoed = rules.some((rule) => rule.veto(option, snapshot) !== undefined);
    if (!vetoed) {
      surviving.push(option);
    }
  }

  if (TERMINAL_PHASES.has(snapshot.phase)) {
    return {
      outcome: ObserveOutcome.Feedback,
      feedback: { reason: ObserveFeedbackReason.TerminalPhase, message: `run ${snapshot.runId} is terminal at '${snapshot.phase}'` },
    };
  }

  if (surviving.length === 0) {
    return {
      outcome: ObserveOutcome.Feedback,
      feedback: {
        reason: ObserveFeedbackReason.DeterministicRuleViolation,
        message: `no option survives deterministic rules at phase '${snapshot.phase}'`,
      },
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
      deterministicRulesApplied: rules.map((rule) => rule.name),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Ephemeral, memoryless composer (operator idea 5: the intelligence) */
/* ------------------------------------------------------------------ */

export type ComposerSelectionRequest = {
  /** The whole readout — everything the composer needs is in the argument. */
  readout: RunStateReadout;
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
): Promise<DecideResult> {
  const observed = observe(snapshot, deps);
  if (observed.outcome === ObserveOutcome.Feedback) {
    return { outcome: DecideOutcome.Feedback, feedback: observed.feedback };
  }
  return resolveSelection(observed.readout, await composer.compose({ readout: observed.readout }));
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
