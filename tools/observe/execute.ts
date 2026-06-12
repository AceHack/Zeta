/**
 * tools/observe/execute.ts — "execute the pick": the impure twin of `simulate`.
 *
 * The controller (`observe.ts`) is pure all the way down: `observe` picks,
 * `simulate` transitions in-memory, `fold`/`replay` project the log. None of it
 * touches the world. `execute` is the ONE effectful seam — observe.ts's own
 * roadmap: *"Next: wire the real World snapshot + execute the pick."*
 *
 * ── The command/effect split (why `simulate` stays the single reducer) ────────
 * `simulate` remains the sole source of truth for the STATE TRANSITION, so
 * `fold`/`replay`/DST keep working unchanged. `execute` adds only what `simulate`
 * deliberately omits:
 *   1. the real SIDE-EFFECT for the action kind, and
 *   2. APPENDING the chosen NextAction to the durable event log (via an injected
 *      `EventSink` — the transport: sovereign folder-direct-to-main, or corporate
 *      batched; see the DB-design + keystone ADRs),
 * then it DELEGATES the in-memory transition back to `simulate` so the executed
 * world can never drift from the pure path. `execute = effect + append + simulate`.
 *
 * ── Why mode-persistence needs no separate store ──────────────────────────────
 * Per observe.ts v5 (state is a PROJECTION of the event log): the persisted
 * `mode` is just `fold(initial, events).mode`. So "persist the chosen mode" IS
 * "append the mode-setting NextAction to the log." No mode table — the log is it.
 *
 * ── This slice: zero-effect kinds + do_item (operator 2026-05-31 / 2026-06-12) ─
 * Zero-effect kinds (free_time, self_reflect, explore, play) have NO external
 * side-effect — executing them is purely (a) append the event + (b) set the mode
 * via simulate. `do_item` is the first effectful kind: it delegates to
 * `executeDoItem` (command/observation event split, injected CommandExecutor).
 * Remaining kinds (preserve_ferry, respond_to_operator, decompose, edit_grammar)
 * are returned as `not-yet-executable` until their effects are wired.
 *
 * The `EventSink` is INJECTED (asymmetric-authorship: the sink AUTHORS its own
 * outcome channel) so this slice is testable with a fake sink and no git I/O;
 * the real folder-direct-to-main sink is a follow-up adapter.
 *
 * Composes with (exact paths):
 *   - tools/observe/observe.ts (simulate = the pure reducer; World / NextAction)
 *   - docs/DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md (the event log + materialized views)
 *   - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md (the observe→act loop this completes)
 *   - docs/backlog/P2/B-0951-git-native-eventually-consistent-text-indexes-sorted-inverted-graph-plus-git-native-hindsight-storage-interface-aaron-2026-05-31.md (eventually-consistent git-native indexes — the read side of the same log)
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md (the sink authors its outcome channel)
 *   - .claude/rules/non-coercion-invariant.md (free_time never gated)
 */

import { simulate, type NextAction, type World } from "./observe";
import { executeDoItem, type CommandExecutor, type DoItemOptions, type DoItemResult, type ActionObservation } from "./do-item";

export type { CommandExecutor, DoItemOptions, DoItemResult, ActionObservation };

/** The action kinds this slice can execute (zero external side-effect: mode-set + append). */
const ZERO_EFFECT_KINDS = ["free_time", "self_reflect", "explore", "play"] as const;
type ZeroEffectKind = (typeof ZERO_EFFECT_KINDS)[number];

function isZeroEffectKind(kind: NextAction["kind"]): kind is ZeroEffectKind {
  return (ZERO_EFFECT_KINDS as readonly string[]).includes(kind);
}

/**
 * The outcome an EventSink authors when asked to append (asymmetric-authorship:
 * the sink owns this channel — success carries the minted event id; failure
 * carries a reason the caller surfaces, never throws).
 */
export type AppendOutcome =
  | { readonly ok: true; readonly eventId: string }
  | { readonly ok: false; readonly reason: string };

/**
 * EventSink — the injected durability port. Appends one event to the
 * append-only, ZetaId-keyed event log via whichever transport is wired
 * (sovereign folder-direct-to-main / corporate batched). Pure interface;
 * implementations do the I/O. Tests inject a fake.
 *
 * Generic over the event type `E` (default `NextAction`, backward-compatible:
 * `EventSink` ≡ `EventSink<NextAction>`). Effectful actions log **observation** events
 * instead of the command (B-0964: replay folds observations, never re-runs commands) —
 * e.g. `EventSink<ActionObservation>` for the do_item envelope. One durability-port
 * shape, parameterized by what gets logged.
 */
export interface EventSink<E = NextAction> {
  append: (event: E) => Promise<AppendOutcome>;
}

/** The execute feedback channel (asymmetric-authorship). */
export type ExecuteFeedback =
  | { readonly kind: "not-yet-executable"; readonly actionKind: NextAction["kind"] }
  | { readonly kind: "append-failed"; readonly actionKind: NextAction["kind"]; readonly reason: string };

/** Result of executing a pick — `ok` carries the new world + the appended event id. */
export type ExecuteResult =
  | { readonly ok: true; readonly world: World; readonly appended: NextAction; readonly eventId: string }
  | { readonly ok: false; readonly feedback: ExecuteFeedback };

/**
 * Execute a chosen action. Routes through three paths:
 *
 * 1. **Zero-effect kinds** (free_time, self_reflect, explore, play): mode-set only.
 *    Append the action itself to the log, then transition via `simulate`.
 *
 * 2. **do_item**: delegates to `executeDoItem` (command/observation event split).
 *    Requires an injected `CommandExecutor` + `DoItemOptions`. If not provided,
 *    returns `not-yet-executable` (backward-compatible with callers that don't
 *    have an executor wired yet).
 *
 * 3. **Everything else** (preserve_ferry, respond_to_operator, decompose,
 *    edit_grammar): returns `not-yet-executable` until their effects are wired.
 *
 * Order matters: APPEND FIRST, then project. If the append fails, no transition
 * is reported (the durable log stays the source of truth).
 */
export async function execute(
  world: World,
  action: NextAction,
  sink: EventSink,
  executor?: CommandExecutor,
  doItemOpts?: DoItemOptions,
): Promise<ExecuteResult> {
  // Path 1: zero-effect kinds (mode-set + append)
  if (isZeroEffectKind(action.kind)) {
    const outcome = await sink.append(action);
    if (!outcome.ok) {
      return { ok: false, feedback: { kind: "append-failed", actionKind: action.kind, reason: outcome.reason } };
    }
    return { ok: true, world: simulate(world, action), appended: action, eventId: outcome.eventId };
  }

  // Path 2: do_item (command/observation event split via executeDoItem)
  if (action.kind === "do_item") {
    if (!executor || !doItemOpts) {
      return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
    }
    // executeDoItem uses its own observation sink (ActionObservation, not NextAction).
    // Adapt the sink: the observation events get their own event ids from the same
    // underlying transport; we wrap the NextAction sink as an ActionObservation sink.
    const observationSink: EventSink<ActionObservation> = {
      append: (obs) => sink.append(obs as unknown as NextAction),
    };
    const result: DoItemResult = await executeDoItem(world, action.item, observationSink, executor, doItemOpts);
    if (!result.ok) {
      // Map DoItemFeedback to ExecuteFeedback
      return { ok: false, feedback: { kind: "append-failed", actionKind: "do_item", reason: result.feedback.reason } };
    }
    if (result.completed) {
      return { ok: true, world: result.world, appended: action, eventId: "do-item-completed" };
    }
    // Work ran but failed — the item stays in the backlog. Still report the
    // transition (mode → work) so the caller sees the updated world.
    return { ok: true, world: result.world, appended: action, eventId: "do-item-failed" };
  }

  // Path 3: not yet wired
  return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
}
