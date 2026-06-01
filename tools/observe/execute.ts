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
 * ── This slice: free_time + self_reflect ONLY (operator 2026-05-31) ───────────
 * These two are the zero-risk first kinds: they have NO external side-effect —
 * executing them is purely (a) append the event + (b) set the mode via simulate.
 * free_time is unilateral/never-gated (NCI); self_reflect is review/journal/think.
 * Every other kind (do_item, respond_to_operator, preserve_ferry, decompose,
 * explore, play, edit_grammar) carries a real side-effect and is returned as
 * `not-yet-executable` until its effect is wired in a follow-up slice.
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

/** The action kinds this slice can execute (zero external side-effect: mode-set + append). */
const EXECUTABLE_KINDS = ["free_time", "self_reflect"] as const;
type ExecutableKind = (typeof EXECUTABLE_KINDS)[number];

function isExecutableKind(kind: NextAction["kind"]): kind is ExecutableKind {
  return (EXECUTABLE_KINDS as readonly string[]).includes(kind);
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
 * EventSink — the injected durability port. Appends one NextAction to the
 * append-only, ZetaId-keyed event log via whichever transport is wired
 * (sovereign folder-direct-to-main / corporate batched). Pure interface;
 * implementations do the I/O. Tests inject a fake.
 */
export interface EventSink {
  append: (action: NextAction) => Promise<AppendOutcome>;
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
 * Execute a chosen action: append it to the durable log, then transition the
 * world via `simulate` (the single reducer). This slice handles `free_time` +
 * `self_reflect`; every other kind returns `not-yet-executable`.
 *
 * Order matters: APPEND FIRST, then project. If the append fails, no transition
 * is reported (the durable log stays the source of truth — we don't advance the
 * in-memory world past an event that didn't land). Idempotency + ordering of the
 * log itself are the sink/transport's concern (G-Set dedup by event id).
 */
export async function execute(world: World, action: NextAction, sink: EventSink): Promise<ExecuteResult> {
  if (!isExecutableKind(action.kind)) {
    return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
  }

  const outcome = await sink.append(action);
  if (!outcome.ok) {
    return { ok: false, feedback: { kind: "append-failed", actionKind: action.kind, reason: outcome.reason } };
  }

  // Durable event landed → project the in-memory transition via the pure reducer.
  return { ok: true, world: simulate(world, action), appended: action, eventId: outcome.eventId };
}
