#!/usr/bin/env bun
/**
 * src/Core.TypeScript/observe/golden-vectors.ts — the cross-language conformance spec.
 *
 * One language-neutral scenario (an initial world + an event log covering every
 * NextAction kind) that EVERY implementation of the observe/simulate/fold algebra
 * must reproduce: replay the event log over the initial world → the same projected
 * state. This is the "make them agree" contract for B-0867.27 (TS/F#/C#/Rust),
 * the runtime-DST half of the B-0944 cross-language-parity pattern (the
 * compiler-parity half is each language compiling the same closed sum-type +
 * exhaustive reducer).
 *
 * The TS fold is the reference: this file defines the scenario, computes the
 * expected states via `fold`/`replay`, and emits `golden-vectors.json`. The
 * F#/C#/Rust impls parse that JSON, run their own fold, and assert value-equality
 * with `expectedFinalState` / `expectedReplayStates`. (Value-equality, not
 * byte-identical JSON — canonical cross-language serialization is a separate
 * refinement; agreement is on the projected state, not the wire format.)
 *
 * Regenerate: `bun src/Core.TypeScript/observe/golden-vectors.ts` (deterministic — same
 * scenario → same JSON, per DST). The committed JSON is the spec; the test keeps
 * it in sync.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fold, replay } from "./observe";
const it = (id, ready, ambiguous, needsNewAction = false) => ({
    id,
    title: id,
    ready,
    ambiguous,
    needsNewAction,
});
/** The canonical initial world: a mixed backlog + an operator that ferried + spoke. */
export const GOLDEN_INITIAL = {
    backlog: [it("081KGOLDEN0READY", true, false), it("081KGOLDEN000AMB", false, true), it("081KGOLDEN0000EX", false, false, true)],
    operator: { pendingMessage: true, pendingFerry: true },
};
/**
 * The canonical event log — exercises ALL nine NextAction kinds + every
 * state-transition class (operator-signal clearing, backlog drain, decompose
 * children, edit_grammar readying, the four free-mode sets):
 *   ferry → respond → do(ready) → decompose(amb) → do(.1) → do(.2)
 *   → edit_grammar(x) → do(x) → explore → play → self_reflect → free_time
 */
export const GOLDEN_EVENTS = [
    { kind: "preserve_ferry", reason: "operator ferried verbatim content" },
    { kind: "respond_to_operator", reason: "operator spoke" },
    { kind: "do_item", item: it("081KGOLDEN0READY", true, false) },
    { kind: "decompose", item: it("081KGOLDEN000AMB", false, true) },
    { kind: "do_item", item: it("081KGOLDEN000AMB.1", true, false) },
    { kind: "do_item", item: it("081KGOLDEN000AMB.2", true, false) },
    { kind: "edit_grammar", item: it("081KGOLDEN0000EX", false, false, true), reason: "grammar extended" },
    { kind: "do_item", item: it("081KGOLDEN0000EX", true, false) },
    { kind: "explore", reason: "self-directed making" },
    { kind: "play", reason: "leisure / culture-forming" },
    { kind: "self_reflect", reason: "review own trajectories" },
    { kind: "free_time", reason: "rest" },
];
/** Compute the fixture from the canonical scenario via the reference fold/replay. */
export function generateGoldenVectors() {
    return {
        description: "observe/simulate/fold cross-language conformance (B-0867.27). Every impl replays `events` over " +
            "`initialWorld` and must value-match `expectedFinalState` + `expectedReplayStates`.",
        initialWorld: GOLDEN_INITIAL,
        events: GOLDEN_EVENTS,
        expectedFinalState: fold(GOLDEN_INITIAL, GOLDEN_EVENTS),
        expectedReplayStates: replay(GOLDEN_INITIAL, GOLDEN_EVENTS),
    };
}
/** Canonical on-disk path of the emitted fixture (the shared spec all langs read). */
export const GOLDEN_VECTORS_PATH = join(import.meta.dir, "golden-vectors.json");
// Emit the fixture (deterministic). Other-language parity tests read this JSON.
if (import.meta.main) {
    const vectors = generateGoldenVectors();
    writeFileSync(GOLDEN_VECTORS_PATH, `${JSON.stringify(vectors, null, 2)}\n`);
    console.log(`wrote ${GOLDEN_VECTORS_PATH}`);
    console.log(`  ${vectors.events.length} events; final backlog=${String(vectors.expectedFinalState.backlog.length)} mode=${vectors.expectedFinalState.mode ?? "-"}`);
}
