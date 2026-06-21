/**
 * src/Core.TypeScript/observe/execute.ts — "execute the pick": the impure twin of `simulate`.
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
 * ── This slice: ALL 9 action kinds wired (2026-06-13) ─────────────────────────
 * Zero-effect kinds (free_time, self_reflect, explore, play, decompose,
 * edit_grammar) have no external side-effect — append + simulate.
 * `do_item` delegates to `executeDoItem` (command/observation split).
 * `preserve_ferry` and `respond_to_operator` are operator-channel effects:
 * effect-first (durability of ferry content / response emission) then append.
 *
 * The `EventSink` is INJECTED (asymmetric-authorship: the sink AUTHORS its own
 * outcome channel) so this slice is testable with a fake sink and no git I/O;
 * the real folder-direct-to-main sink is a follow-up adapter.
 *
 * Composes with (exact paths):
 *   - src/Core.TypeScript/observe/observe.ts (simulate = the pure reducer; World / NextAction)
 *   - docs/DECISIONS/2026-05-31-zeta-database-design-event-sourced-gset-bag-zset-rx-fold-materialized-views-two-backends.md (the event log + materialized views)
 *   - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md (the observe→act loop this completes)
 *   - docs/backlog/P2/081KSXN940008QG0R000R76H45-git-native-eventually-consistent-text-indexes-sorted-inverted-graph-plus-git-native-hindsight-storage-interface-aaron-2026-05-31.md (eventually-consistent git-native indexes — the read side of the same log)
 *   - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md (Result<T, TFeedback>)
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md (the sink authors its outcome channel)
 *   - .claude/rules/non-coercion-invariant.md (free_time never gated)
 */
import { simulate } from "./observe";
import { executeDoItem, } from "./do-item";
/** A fake operator port for tests — records calls without I/O. */
export function fakeOperatorPort() {
    const preserved = [];
    const responses = [];
    return {
        preserved,
        responses,
        preserveFerry: async (content) => {
            preserved.push(content);
            return { ok: true, path: `ferry/${preserved.length}.md` };
        },
        emitResponse: async (text) => {
            responses.push(text);
            return { ok: true };
        },
    };
}
/** The action kinds this slice can execute (zero external side-effect: mode-set + append). */
const ZERO_EFFECT_KINDS = ["free_time", "self_reflect", "explore", "play", "decompose", "edit_grammar"];
function isZeroEffectKind(kind) {
    return ZERO_EFFECT_KINDS.includes(kind);
}
/**
 * Execute a chosen action. Routes through four paths:
 *
 * 1. **Zero-effect kinds** (free_time, self_reflect, explore, play, decompose,
 *    edit_grammar): backlog/mode transform only. Append then simulate.
 *
 * 2. **do_item**: delegates to `executeDoItem` (command/observation event split).
 *
 * 3. **preserve_ferry / respond_to_operator**: operator-channel effects.
 *    Effect first, then append, then simulate.
 *
 * Order matters: for operator actions, EFFECT FIRST (the content might be lost to
 * compaction if we append-then-effect and the effect fails). For zero-effect kinds,
 * APPEND FIRST (no effect to lose). For do_item, APPEND-STARTED-FIRST (the executor
 * contract per 081KT07NV0008QG0R001CBQ2X2).
 */
export async function execute(world, action, sink, executor, doItemOpts, operatorPort) {
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
        const observationSink = {
            append: (obs) => sink.append(obs),
        };
        const result = await executeDoItem(world, action.item, observationSink, executor, doItemOpts);
        if (!result.ok) {
            return { ok: false, feedback: { kind: "append-failed", actionKind: "do_item", reason: result.feedback.reason } };
        }
        if (result.completed) {
            return { ok: true, world: result.world, appended: action, eventId: "do-item-completed" };
        }
        return { ok: true, world: result.world, appended: action, eventId: "do-item-failed" };
    }
    // Path 3: preserve_ferry — effect first (durability of the ferry content)
    if (action.kind === "preserve_ferry") {
        if (!operatorPort) {
            return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
        }
        // The ferry content is in action.reason (the verbatim text to preserve).
        const effectResult = await operatorPort.preserveFerry(action.reason);
        if (!effectResult.ok) {
            return { ok: false, feedback: { kind: "append-failed", actionKind: action.kind, reason: effectResult.reason } };
        }
        const outcome = await sink.append(action);
        if (!outcome.ok) {
            // Effect succeeded but append failed — the ferry IS preserved (the content
            // is durable at effectResult.path), but the log doesn't reflect it yet.
            // Return success anyway: the content is safe (durability-first).
            return { ok: true, world: simulate(world, action), appended: action, eventId: "ferry-preserved-append-lagged" };
        }
        return { ok: true, world: simulate(world, action), appended: action, eventId: outcome.eventId };
    }
    // Path 3b: respond_to_operator — effect first (emit the response)
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
            // Response emitted but append lagged — the operator got the reply (effect
            // succeeded), so report success; the log will catch up on next tick.
            return { ok: true, world: simulate(world, action), appended: action, eventId: "response-emitted-append-lagged" };
        }
        return { ok: true, world: simulate(world, action), appended: action, eventId: outcome.eventId };
    }
    // Exhaustiveness guard — all 9 kinds are wired above; this is unreachable
    // unless the NextAction union is extended without updating execute().
    return { ok: false, feedback: { kind: "not-yet-executable", actionKind: action.kind } };
}
