#!/usr/bin/env bun
/**
 * src/Core.TypeScript/observe/golden-vectors.ts — the cross-language conformance spec.
 *
 * One language-neutral scenario (an initial world + an event log covering every
 * NextAction kind) that EVERY implementation of the observe/simulate/fold algebra
 * must reproduce: replay the event log over the initial world → the same projected
 * state. This is the "make them agree" contract for 081KSXN940008QG0R0033T2BQT (TS/F#/C#/Rust),
 * the runtime-DST half of the 081KSV2WD0008QG0R00051XS0N cross-language-parity pattern (the
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
import { fold, replay, type BacklogItem, type Mode, type NextAction, type OperatorChannel, type World } from "./observe";

// ─── the treaty surface — what the four oracles actually agree ON ──────────────
//
// `World` (observe.ts) is the TS runtime's state type and it GROWS: time-travel
// added `history`, cartography added `cartography`, the cred adventure added
// `nodeSession`. The CONFORMANCE surface must not grow with it by accident — a
// field that silently enters the lock is a treaty change wearing a bug fix's
// clothes, and the three other oracles would stay green while going out of
// conformance (their parsers read three keys and ignore the rest). So the treaty
// is stated EXPLICITLY here, as a projection, and the boundary guards in
// golden-vectors.test.ts go red if it drifts in either direction.
//
// WHY `history` IS OUT (081KZT1X8G2087G0R000FYEWSE records what putting it IN takes):
//   1. Its only reader is `retract_time`, which exists in NO other oracle — F#,
//      C#, and Rust each implement exactly the NINE core kinds. Locking a field
//      no other oracle can exercise is cargo-cult conformance.
//   2. It is a strictly LOSSY copy (2 of 14 action kinds) of the `events` array
//      that is already in the fixture as the fold's INPUT. Locking a lossy
//      duplicate of the input as expected output adds no discriminating power —
//      it cannot fail in any way `events` does not already fail.
// The ledger is local bookkeeping (the undo stack), not a shared contract. When
// `retract_time`/`replay_time` land in the other oracles the ledger acquires a
// reader, and promoting it becomes a versioned treaty change with teeth.

/**
 * The exact `World` fields the TS/F#/C#/Rust conformance covers. Kept in sync with
 * what the other oracles parse: `parseWorld` in tests/Tests.FSharp/Observe/GoldenVectors.Tests.fs,
 * `parse_world` in src/Core.Rust.Observe/src/observe_json.rs, and the C# reader in
 * tests/Tests.CSharp/Observe/GoldenVectorsTests.cs — all three read backlog +
 * operator + mode, and nothing else.
 */
export interface TreatyWorld {
  readonly backlog: readonly BacklogItem[];
  readonly operator?: OperatorChannel;
  readonly mode?: Mode;
}

/** The treaty's field set, as DATA — the boundary guards assert the emitted JSON matches it. */
export const TREATY_WORLD_FIELDS = ["backlog", "operator", "mode"] as const;

/**
 * Project a runtime `World` onto the treaty surface. Absent optionals stay ABSENT
 * (not present-and-undefined), so the emitted JSON is exactly the shape the other
 * oracles' parsers expect. Adding a field to `World` can no longer change the
 * fixture; promoting one INTO the treaty is a deliberate edit to this function.
 */
export function toTreatyWorld(world: World): TreatyWorld {
  return {
    backlog: world.backlog,
    ...(world.operator === undefined ? {} : { operator: world.operator }),
    ...(world.mode === undefined ? {} : { mode: world.mode }),
  };
}

const it = (id: string, ready: boolean, ambiguous: boolean, needsNewAction = false): BacklogItem => ({
  id,
  title: id,
  ready,
  ambiguous,
  needsNewAction,
});

/** The canonical initial world: a mixed backlog + an operator that ferried + spoke. */
export const GOLDEN_INITIAL: World = {
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
export const GOLDEN_EVENTS: readonly NextAction[] = [
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

/** The full conformance fixture: scenario + the states the reference fold/replay produce. */
export interface GoldenVectors {
  readonly description: string;
  readonly initialWorld: TreatyWorld;
  readonly events: readonly NextAction[];
  readonly expectedFinalState: TreatyWorld;
  readonly expectedReplayStates: readonly TreatyWorld[];
}

/** Compute the fixture from the canonical scenario via the reference fold/replay. */
export function generateGoldenVectors(): GoldenVectors {
  return {
    description:
      "observe/simulate/fold cross-language conformance (081KSXN940008QG0R0033T2BQT). Every impl replays `events` over " +
      "`initialWorld` and must value-match `expectedFinalState` + `expectedReplayStates`.",
    initialWorld: toTreatyWorld(GOLDEN_INITIAL),
    events: GOLDEN_EVENTS,
    expectedFinalState: toTreatyWorld(fold(GOLDEN_INITIAL, GOLDEN_EVENTS)),
    expectedReplayStates: replay(GOLDEN_INITIAL, GOLDEN_EVENTS).map(toTreatyWorld),
  };
}

/** Canonical on-disk path of the emitted fixture (the shared spec all langs read). */
export const GOLDEN_VECTORS_PATH = join(import.meta.dir, "golden-vectors.json");

// Emit the fixture (deterministic). Other-language parity tests read this JSON.
if (import.meta.main) {
  const vectors = generateGoldenVectors();
  writeFileSync(GOLDEN_VECTORS_PATH, `${JSON.stringify(vectors, null, 2)}\n`);
  console.log(`wrote ${GOLDEN_VECTORS_PATH}`);
  console.log(
    `  ${vectors.events.length} events; final backlog=${String(vectors.expectedFinalState.backlog.length)} mode=${vectors.expectedFinalState.mode ?? "-"}`,
  );
}
