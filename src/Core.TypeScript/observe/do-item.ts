/**
 * src/Core.TypeScript/observe/do-item.ts — effectful `do_item`, Phase 1 (081KT07NV0008QG0R001CBQ2X2).
 *
 * `do_item` is the first action kind with a REAL side-effect (the agent actually
 * does work). The other kinds `execute` handles (`free_time`/`self_reflect`) have
 * no side-effect, so logging the action itself == logging the observation. `do_item` does
 * not: re-running the log must NOT re-run the work (re-build, re-push, re-charge).
 * So we apply the **command-vs-observation-event split** (standard event-sourcing):
 *
 *   `do_item` is a COMMAND (the chooser's pick) — NOT logged.
 *   Executing it emits OBSERVATION events — what actually happened — and THOSE are logged:
 *     ActionExecutionStarted{item, tier, gated} → ActionExecutionSucceeded{item}
 *                                                or ActionExecutionFailed{item, reason}
 *
 * `foldObservations` replays the OBSERVATIONS: a folded `succeeded` re-applies the transition
 * (item leaves backlog) by DELEGATING to `simulate(do_item)` — the single pure
 * reducer, so the replayed world can't drift from the executed one — and a folded
 * `failed` leaves the item in place. **`foldObservations` takes no executor: replay
 * structurally cannot re-run the command.** That is the correctness guarantee.
 *
 * The `CommandExecutor` is INJECTED (asymmetric-authorship: the port authors its
 * own outcome channel; `executeDoItem` stays testable with a fake; no shell in the
 * unit path). The `Started` observation records the executor `tier` + `gated` so the
 * §3 glass-halo audit can tell a sandbox run from a real-FS/OCI escalation.
 *
 * Phase 1 (this file): the envelope + port + transition, fake executor, no dep,
 * no shell. Phase 2 wires real impls behind `CommandExecutor` (local OCI runtime —
 * podman default, swappable — for real work; just-bash in-memory for text; per
 * 081KT07NV0008QG0R001CBQ2X2 §2 / §2.2 review-folded routing).
 * Integrating `executeDoItem` into the unified `execute`/log/sink is a follow-up
 * (Phase 1 keeps it a sibling so the existing `execute` + its tests stay green).
 *
 * At-least-once corner (PR review 2026-06-01): if the executor RUNS but the terminal
 * observation append fails, the side-effect happened yet only `Started` is durable. That
 * surfaces as `terminal-append-failed` (NOT `append-failed`) so the caller does not
 * blind-retry (which would duplicate the side-effect). A `Started`-only log is a
 * **reconcile-needed** state; safe re-execution requires idempotent item-work (the
 * always-active idempotency discipline). FOLLOW-UP: project a `Started` with no
 * matching terminal into an explicit in-flight state that BLOCKS auto-re-execution
 * until reconciled (needs a World in-flight field — beyond Phase-1's envelope scope).
 *
 * Composes with (exact paths):
 *   - src/Core.TypeScript/observe/observe.ts (simulate = the single reducer; World / BacklogItem)
 *   - src/Core.TypeScript/observe/execute.ts (EventSink<E> = the durability port reused here for observations; AppendOutcome)
 *   - docs/backlog/P1/081KT07NV0008QG0R001CBQ2X2-effectful-do-item-command-vs-fact-event-envelope-injected-executor-just-bash-sandbox-surface-2026-06-01.md
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md (Result<T, TFeedback>)
 */

import { simulate, type BacklogItem, type World } from "./observe";
import type { AppendOutcome, EventSink } from "./execute";

// ─── the executor port (the "bash surface") ──────────────────────────────────

/**
 * Which surface ran the command — recorded in the Started observation for the audit.
 * `oci` = the runtime-agnostic local OCI runtime (podman default, swappable to
 * docker/nerdctl/finch via `ZETA_CONTAINER_RUNTIME`; 081KT07NV0008QG0R001CBQ2X2 §2.2). The tier names the
 * boundary CLASS, not a specific vendor — so the audit doesn't lie about which engine ran.
 */
export type ExecutorTier = "fake" | "just-bash" | "oci" | "cloud-burst";

/** What to run. Phase 1: the caller supplies it (081KT07NV0008QG0R001CBQ2X2 §4: the sub-loop / recipe map decides later). */
export interface RunSpec {
  readonly script: string;
  readonly cwd?: string;
}

/** The executor's outcome channel (asymmetric-authorship — never throws; failure is data). */
export type RunOutcome =
  | { readonly ok: true; readonly stdout: string; readonly exitCode: 0 }
  | { readonly ok: false; readonly reason: string; readonly exitCode: number; readonly stderr: string };

/** The injected bash surface. Fake in tests; oci / just-bash in prod (081KT07NV0008QG0R001CBQ2X2 §2). */
export interface CommandExecutor {
  readonly tier: ExecutorTier;
  run: (spec: RunSpec) => Promise<RunOutcome>;
}

/** A deterministic fake executor (no shell) — the always-green test surface. */
export function fakeExecutor(outcome: RunOutcome): CommandExecutor {
  return { tier: "fake", run: () => Promise.resolve(outcome) };
}

// ─── the observation events (what's logged; the command is not) ──────────────────────

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
 * Apply ONE observation to the world (the observation reducer). `Succeeded` DELEGATES to
 * `simulate(do_item)` so the transition can't drift from the pure path; `Started`
 * and `Failed` only move the mode (the item stays until it actually succeeds).
 * No executor — applying an observation never runs anything.
 */
export function applyObservation(world: World, observation: ActionObservation): World {
  switch (observation.kind) {
    case "ActionExecutionStarted":
      return { ...world, mode: "work" };
    case "ActionExecutionSucceeded":
      // the single reducer: item leaves the backlog, mode → work.
      return simulate(world, { kind: "do_item", item: observation.item });
    case "ActionExecutionFailed":
      // work attempted but failed → item stays; mode reflects the attempt.
      return { ...world, mode: "work" };
  }
}

/**
 * Replay the observation log. Pure fold — **no executor parameter**, so replay cannot
 * re-run the command (the 081KT07NV0008QG0R001CBQ2X2 §0 correctness guarantee, enforced by the type).
 */
export function foldObservations(initial: World, observations: readonly ActionObservation[]): World {
  return observations.reduce(applyObservation, initial);
}

// ─── execute do_item: append Started → run → append Succeeded|Failed ───────────

export interface DoItemOptions {
  readonly spec: RunSpec; // what to run (Phase 1: caller-supplied)
  readonly gated: boolean; // was this run gate-approved (real-FS/escalation)?
}

/**
 * Machinery feedback (durability failure) — distinct from work-failure. Two cases,
 * because they have OPPOSITE retry-safety (PR review 2026-06-01):
 *   - `append-failed`: the `Started` append failed → the executor NEVER ran (no
 *     side-effect). Safe to retry the whole do_item.
 *   - `terminal-append-failed`: the executor ALREADY RAN (side-effect happened) but
 *     the TERMINAL observation (Succeeded/Failed) didn't land — only `Started` is durable.
 *     A `Started`-only log is a **reconcile-needed** state: do NOT blind-retry (that
 *     would duplicate the side-effect under at-least-once). The caller must reconcile
 *     (re-append the known terminal observation, or check the world + decide). Re-execution
 *     is only safe if the item's work is idempotent (the always-active idempotency
 *     discipline — `dv2-data-split`). `durableObservations` carries what DID land; `reason`
 *     is the APPEND failure; `ranReason` preserves the executor's own failure reason
 *     when `ranOutcome === "failed"` (so reconciliation doesn't lose WHY the work
 *     failed, only that the terminal observation didn't land) (PR review 2026-06-01).
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
 * `ok` means the MACHINERY worked (observations landed); `completed` means the WORK
 * succeeded (item gone). A failed run is still `ok: true` (observations logged) with
 * `completed: false` (item stays). `ok: false` only on durability failure.
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
 * injected executor → append `Succeeded` or `Failed` → project via `applyObservation`.
 * Append-first: if the `Started` append fails, nothing runs (durability is the
 * source of truth). The executor never throws (RunOutcome is data); the Succeeded
 * transition leaves the item out of the backlog, the Failed transition keeps it.
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

  // The port contract is `Promise<RunOutcome>`, but a real impl (spawn / timeout
  // wrapper / container start) can REJECT instead of returning a failed outcome.
  // Convert a throw into a failed outcome so an effectful run ALWAYS produces a
  // terminal observation — never an unhandled rejection that leaves a dangling `Started`
  // (PR review 2026-06-01).
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
      // executor RAN; the terminal observation didn't land → reconcile-needed, NOT retry.
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
    // executor RAN (and failed); the terminal observation didn't land → reconcile-needed.
    // Preserve the executor's own failure reason (`outcome.reason`) so reconciliation
    // doesn't lose WHY the work failed — only that the Failed observation didn't land.
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
