/**
 * packages/application/src/observe-do-item.ts — Merge1 §02 (Observe Loop).
 *
 * Port of `src/Core.TypeScript/observe/do-item.ts` (the effectful `do_item`) and
 * the `execute()` router from `src/Core.TypeScript/observe/execute.ts`.
 *
 * ── The command-vs-observation split (the critical replay invariant) ──────────
 *   - `do_item` is a COMMAND (the chooser's pick) — NOT logged.
 *   - Executing it emits OBSERVATION events — what actually happened — and THOSE
 *     are logged: `ActionExecutionStarted` → `Succeeded` | `Failed`.
 *   - `foldObservations` replays the OBSERVATIONS, not the command: a folded
 *     `Succeeded` re-applies the transition by DELEGATING to `simulate(do_item)`
 *     (the single reducer, so the replayed world can't drift from the executed
 *     one); a folded `Failed` leaves the item in place.
 *   - **`foldObservations` takes no executor — replay structurally cannot re-run
 *     work** (re-build, re-push, re-charge). That is the correctness guarantee,
 *     enforced by the type.
 *
 * The `CommandExecutor` and `EventSink` are INJECTED (asymmetric authorship: each
 * port authors its own outcome channel) so `executeDoItem`/`execute` stay testable
 * with fakes — no shell in the unit path. Every outcome is `Result`-shaped data;
 * the executor never throws across the seam (a real impl's throw is converted to a
 * failed outcome so an effectful run ALWAYS produces a terminal observation).
 */

import { simulate, type BacklogItem, type NextAction, type World } from "./observe-simulate.ts";
import type { AppendOutcome, EventSink } from "./observe-event-sink.ts";

// ─── the executor port (the "bash surface") ──────────────────────────────────

/**
 * Which surface ran the command — recorded in the Started observation for the
 * audit. The tier names the boundary CLASS, not a specific vendor — so the audit
 * doesn't lie about which engine ran. `oci` = a runtime-agnostic local OCI runtime.
 */
export type ExecutorTier = "fake" | "just-bash" | "oci" | "cloud-burst";

/** What to run. The caller supplies it (the sub-loop / recipe map decides later). */
export interface RunSpec {
  readonly script: string;
  readonly cwd?: string;
}

/** The executor's outcome channel (asymmetric authorship — never throws; failure is data). */
export type RunOutcome =
  | { readonly ok: true; readonly stdout: string; readonly exitCode: 0 }
  | { readonly ok: false; readonly reason: string; readonly exitCode: number; readonly stderr: string };

/** The injected bash surface. Fake in tests; oci / just-bash in prod. */
export interface CommandExecutor {
  readonly tier: ExecutorTier;
  run: (spec: RunSpec) => Promise<RunOutcome>;
}

/** A deterministic fake executor (no shell) — the always-green test surface. */
export function fakeExecutor(outcome: RunOutcome): CommandExecutor {
  return { tier: "fake", run: () => Promise.resolve(outcome) };
}

// ─── the observation events (what's logged; the command is not) ───────────────

export type ActionObservation =
  | {
      readonly kind: "ActionExecutionStarted";
      readonly item: BacklogItem;
      readonly tier: ExecutorTier;
      readonly gated: boolean;
    }
  | { readonly kind: "ActionExecutionSucceeded"; readonly item: BacklogItem }
  | { readonly kind: "ActionExecutionFailed"; readonly item: BacklogItem; readonly reason: string };

/**
 * Apply ONE observation to the world (the observation reducer). `Succeeded`
 * DELEGATES to `simulate(do_item)` so the transition can't drift from the pure
 * path; `Started` and `Failed` only move the mode (the item stays until it
 * actually succeeds). No executor — applying an observation never runs anything.
 */
export function applyObservation(world: World, observation: ActionObservation): World {
  switch (observation.kind) {
    case "ActionExecutionStarted":
      return { ...world, mode: "work" };
    case "ActionExecutionSucceeded":
      return simulate(world, { kind: "do_item", item: observation.item });
    case "ActionExecutionFailed":
      return { ...world, mode: "work" };
  }
}

/**
 * Replay the observation log. Pure fold — **no executor parameter**, so replay
 * cannot re-run the command (the correctness guarantee, enforced by the type).
 */
export function foldObservations(initial: World, observations: readonly ActionObservation[]): World {
  return observations.reduce(applyObservation, initial);
}

// ─── execute do_item: append Started → run → append Succeeded|Failed ───────────

export interface DoItemOptions {
  /** what to run (caller-supplied). */
  readonly spec: RunSpec;
  /** was this run gate-approved (real-FS/escalation)? recorded in Started for the audit. */
  readonly gated: boolean;
}

/**
 * Machinery feedback (durability failure) — distinct from work-failure. Two
 * cases, because they have OPPOSITE retry-safety:
 *   - `append-failed`: the `Started` append failed → the executor NEVER ran (no
 *     side-effect). Safe to retry the whole do_item.
 *   - `terminal-append-failed`: the executor ALREADY RAN (side-effect happened)
 *     but the TERMINAL observation didn't land — only `Started` is durable. A
 *     `Started`-only log is a **reconcile-needed** state: do NOT blind-retry
 *     (that would duplicate the side-effect under at-least-once). `ranReason`
 *     preserves the executor's own failure reason when `ranOutcome === "failed"`.
 */
export type DoItemFeedback =
  | { readonly kind: "append-failed"; readonly reason: string }
  | {
      readonly kind: "terminal-append-failed";
      readonly ranOutcome: "succeeded" | "failed";
      readonly reason: string;
      readonly ranReason?: string;
      readonly durableObservations: readonly ActionObservation[];
    };

/**
 * `ok` means the MACHINERY worked (observations landed); `completed` means the
 * WORK succeeded (item gone). A failed run is still `ok: true` (observations
 * logged) with `completed: false` (item stays). `ok: false` only on durability failure.
 */
export type DoItemResult =
  | {
      readonly ok: true;
      readonly completed: true;
      readonly world: World;
      readonly observations: readonly ActionObservation[];
    }
  | {
      readonly ok: true;
      readonly completed: false;
      readonly world: World;
      readonly observations: readonly ActionObservation[];
      readonly reason: string;
    }
  | { readonly ok: false; readonly feedback: DoItemFeedback };

/**
 * Execute a `do_item`: append `Started` (with tier+gated for the audit) → run the
 * injected executor → append `Succeeded` or `Failed` → project via
 * `applyObservation`. Append-first: if the `Started` append fails, nothing runs
 * (durability is the source of truth). The executor never throws across the seam
 * (a throw is converted to a failed outcome).
 */
export async function executeDoItem(
  world: World,
  item: BacklogItem,
  sink: EventSink<ActionObservation>,
  executor: CommandExecutor,
  opts: DoItemOptions,
): Promise<DoItemResult> {
  const started: ActionObservation = {
    kind: "ActionExecutionStarted",
    item,
    tier: executor.tier,
    gated: opts.gated,
  };
  const startedAppend: AppendOutcome = await sink.append(started);
  if (!startedAppend.ok) {
    return { ok: false, feedback: { kind: "append-failed", reason: startedAppend.reason } };
  }

  let outcome: RunOutcome;
  try {
    outcome = await executor.run(opts.spec);
  } catch (err) {
    outcome = {
      ok: false,
      reason: `executor threw: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: -1,
      stderr: "",
    };
  }

  if (outcome.ok) {
    const succeeded: ActionObservation = { kind: "ActionExecutionSucceeded", item };
    const append: AppendOutcome = await sink.append(succeeded);
    if (!append.ok) {
      return {
        ok: false,
        feedback: {
          kind: "terminal-append-failed",
          ranOutcome: "succeeded",
          reason: append.reason,
          durableObservations: [started],
        },
      };
    }
    return {
      ok: true,
      completed: true,
      world: foldObservations(world, [started, succeeded]),
      observations: [started, succeeded],
    };
  }

  const failed: ActionObservation = { kind: "ActionExecutionFailed", item, reason: outcome.reason };
  const append: AppendOutcome = await sink.append(failed);
  if (!append.ok) {
    return {
      ok: false,
      feedback: {
        kind: "terminal-append-failed",
        ranOutcome: "failed",
        reason: append.reason,
        ranReason: outcome.reason,
        durableObservations: [started],
      },
    };
  }
  return {
    ok: true,
    completed: false,
    world: foldObservations(world, [started, failed]),
    observations: [started, failed],
    reason: outcome.reason,
  };
}

// ─── the operator port (preserve_ferry + respond_to_operator) ─────────────────

/**
 * The effectful seam for operator-channel actions. `preserveFerry` durably writes
 * the ferried content to substrate; `emitResponse` emits the agent's response.
 * Injected so tests use a fake (no I/O).
 */
export interface OperatorPort {
  preserveFerry: (content: string) => Promise<{ ok: true; path: string } | { ok: false; reason: string }>;
  emitResponse: (text: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}

/** A fake operator port for tests — records calls without I/O. */
export function fakeOperatorPort(): OperatorPort & { readonly preserved: string[]; readonly responses: string[] } {
  const preserved: string[] = [];
  const responses: string[] = [];
  return {
    preserved,
    responses,
    preserveFerry: (content) => {
      preserved.push(content);
      return Promise.resolve({ ok: true, path: `ferry/${preserved.length}.md` });
    },
    emitResponse: (text) => {
      responses.push(text);
      return Promise.resolve({ ok: true });
    },
  };
}

// ─── execute: the impure twin of simulate (effect + append + simulate) ─────────

const ZERO_EFFECT_KINDS = ["free_time", "self_reflect", "explore", "play", "decompose", "edit_grammar"] as const;
type ZeroEffectKind = (typeof ZERO_EFFECT_KINDS)[number];

function isZeroEffectKind(kind: NextAction["kind"]): kind is ZeroEffectKind {
  return (ZERO_EFFECT_KINDS as readonly string[]).includes(kind);
}

/** The execute feedback channel (asymmetric authorship). */
export type ExecuteFeedback =
  | { readonly kind: "not-yet-executable"; readonly actionKind: NextAction["kind"] }
  | { readonly kind: "append-failed"; readonly actionKind: NextAction["kind"]; readonly reason: string };

/** Result of executing a pick — `ok` carries the new world + the appended event id. */
export type ExecuteResult =
  | { readonly ok: true; readonly world: World; readonly appended: NextAction; readonly eventId: string }
  | { readonly ok: false; readonly feedback: ExecuteFeedback };

/**
 * Execute a chosen action — the ONE effectful seam. `simulate` stays the sole
 * source of truth for the STATE TRANSITION (so fold/replay/DST keep working);
 * `execute` adds the SIDE-EFFECT + APPEND, then delegates the transition back to
 * `simulate` (executed world can never drift from the pure path).
 *
 * Order matters: operator actions are EFFECT-FIRST (content might be lost to
 * compaction if append-then-effect fails); zero-effect kinds are APPEND-FIRST (no
 * effect to lose); `do_item` is APPEND-STARTED-FIRST (the executor contract).
 */
export async function execute(
  world: World,
  action: NextAction,
  sink: EventSink,
  executor?: CommandExecutor,
  doItemOpts?: DoItemOptions,
  operatorPort?: OperatorPort,
): Promise<ExecuteResult> {
  // Path 1: zero-effect kinds (mode-set + append).
  if (isZeroEffectKind(action.kind)) {
    const outcome = await sink.append(action);
    if (!outcome.ok) {
      return { ok: false, feedback: { kind: "append-failed", actionKind: action.kind, reason: outcome.reason } };
    }
    return { ok: true, world: simulate(world, action), appended: action, eventId: outcome.eventId };
  }

  // Path 2: do_item (command/observation event split via executeDoItem).
  if (action.kind === "do_item") {
    if (!executor || !doItemOpts) {
      return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
    }
    const observationSink: EventSink<ActionObservation> = {
      append: (obs) => sink.append(obs as unknown as NextAction),
    };
    const result: DoItemResult = await executeDoItem(world, action.item, observationSink, executor, doItemOpts);
    if (!result.ok) {
      return { ok: false, feedback: { kind: "append-failed", actionKind: "do_item", reason: result.feedback.reason } };
    }
    return {
      ok: true,
      world: result.world,
      appended: action,
      eventId: result.completed ? "do-item-completed" : "do-item-failed",
    };
  }

  // Path 3: preserve_ferry — effect first (durability of the ferry content).
  if (action.kind === "preserve_ferry") {
    if (!operatorPort) {
      return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
    }
    const effectResult = await operatorPort.preserveFerry(action.reason);
    if (!effectResult.ok) {
      return { ok: false, feedback: { kind: "append-failed", actionKind: action.kind, reason: effectResult.reason } };
    }
    const outcome = await sink.append(action);
    if (!outcome.ok) {
      // Effect succeeded but append lagged — the ferry IS preserved (durability-first).
      return { ok: true, world: simulate(world, action), appended: action, eventId: "ferry-preserved-append-lagged" };
    }
    return { ok: true, world: simulate(world, action), appended: action, eventId: outcome.eventId };
  }

  // Path 3b: respond_to_operator — effect first (emit the response).
  if (action.kind === "respond_to_operator") {
    if (!operatorPort) {
      return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
    }
    const effectResult = await operatorPort.emitResponse(action.reason);
    if (!effectResult.ok) {
      return { ok: false, feedback: { kind: "append-failed", actionKind: action.kind, reason: effectResult.reason } };
    }
    const outcome = await sink.append(action);
    if (!outcome.ok) {
      return { ok: true, world: simulate(world, action), appended: action, eventId: "response-emitted-append-lagged" };
    }
    return { ok: true, world: simulate(world, action), appended: action, eventId: outcome.eventId };
  }

  // Exhaustiveness guard — all kinds are wired above.
  return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
}
