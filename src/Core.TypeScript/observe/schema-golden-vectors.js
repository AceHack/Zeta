#!/usr/bin/env bun
/**
 * src/Core.TypeScript/observe/schema-golden-vectors.ts — the 10-oracle conformance spec.
 *
 * One language-neutral scenario (initial schema + a sequence of evolution deltas)
 * that EVERY implementation must reproduce: apply the deltas in order → the same
 * final schema state. This is the "make them all agree" contract for:
 *
 *   TypeScript, F#, C#, Rust, Go, Python, Q#, Lean 4, TLA+, Alloy
 *
 * The TS fold is the reference. This file defines the scenario, computes the
 * expected states, and emits `schema-golden-vectors.json`. Every other language
 * parses that JSON, runs its own fold, and asserts value-equality.
 *
 * Regenerate: `bun src/Core.TypeScript/observe/schema-golden-vectors.ts`
 * (deterministic — same scenario → same JSON, per DST).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { schemaZSet, applyDelta, currentSchema, consolidate, } from "./schema-zset";
// ─── The canonical scenario ──────────────────────────────────────────────────
/** The initial schema (filesystem metadata v1). */
const INITIAL_FIELDS = [
    { name: "contentHash", type: "string", required: true },
    { name: "paths", type: "string[]", required: true },
    { name: "executable", type: "boolean", required: true, default: true },
    { name: "binary", type: "boolean", required: true, default: false },
    { name: "created", type: "string", required: false },
    { name: "modified", type: "string", required: false },
];
/** The evolution sequence — exercises every operation type. */
const DELTAS = [
    // Delta 1: Add a field (owner)
    {
        retract: [],
        insert: [{ name: "owner", type: "zetaid", required: false }],
    },
    // Delta 2: Remove a field (modified)
    {
        retract: [{ name: "modified", type: "string", required: false }],
        insert: [],
    },
    // Delta 3: Change a field type (created: string → number)
    {
        retract: [{ name: "created", type: "string", required: false }],
        insert: [{ name: "created", type: "number", required: false }],
    },
    // Delta 4: Add another field (checksum)
    {
        retract: [],
        insert: [{ name: "checksum", type: "string", required: false }],
    },
    // Delta 5: Make a field required (owner: optional → required)
    {
        retract: [{ name: "owner", type: "zetaid", required: false }],
        insert: [{ name: "owner", type: "zetaid", required: true }],
    },
];
// ─── Compute expected states ─────────────────────────────────────────────────
function computeGoldenVectors() {
    let schema = schemaZSet(INITIAL_FIELDS);
    const replayStates = [];
    for (const delta of DELTAS) {
        schema = applyDelta(schema, delta);
        const active = currentSchema(schema);
        replayStates.push({ activeFields: active, entryCount: schema.length });
    }
    // Final consolidation
    const consolidated = consolidate(schema);
    const finalFields = currentSchema(consolidated);
    return {
        description: "schema-zset cross-language conformance (zero-downtime-schema-evolution). " +
            "Every impl applies DELTAS in order over INITIAL_FIELDS and must value-match " +
            "expectedReplayStates[i] after delta i AND expectedFinalState after consolidation. " +
            "10 oracles: TS (reference), F#, C#, Rust, Go, Python, Q#, Lean4, TLA+, Alloy.",
        oracles: ["TypeScript", "F#", "C#", "Rust", "Go", "Python", "Q#", "Lean4", "TLA+", "Alloy"],
        initialFields: INITIAL_FIELDS,
        deltas: DELTAS,
        expectedReplayStates: replayStates,
        expectedFinalState: {
            activeFields: finalFields,
            fieldNames: finalFields.map(f => f.name).sort(),
            fieldCount: finalFields.length,
        },
        // Commutativity assertions: these pairs of deltas commute (disjoint fields)
        commutativePairs: [
            { deltaA: 0, deltaB: 1, commutes: true, reason: "owner vs modified — disjoint" },
            { deltaA: 0, deltaB: 3, commutes: true, reason: "owner vs checksum — disjoint" },
            { deltaA: 1, deltaB: 3, commutes: true, reason: "modified vs checksum — disjoint" },
        ],
    };
}
// ─── Emit ────────────────────────────────────────────────────────────────────
export const GOLDEN_VECTORS_PATH = join(import.meta.dir, "schema-golden-vectors.json");
if (import.meta.main) {
    const vectors = computeGoldenVectors();
    writeFileSync(GOLDEN_VECTORS_PATH, `${JSON.stringify(vectors, null, 2)}\n`);
    console.log(`wrote ${GOLDEN_VECTORS_PATH}`);
    console.log(`  ${vectors.deltas.length} deltas; final: ${vectors.expectedFinalState.fieldCount} fields [${vectors.expectedFinalState.fieldNames.join(", ")}]`);
    console.log(`  ${vectors.commutativePairs.length} commutativity assertions`);
    console.log(`  ${vectors.oracles.length} oracles must agree`);
}
export { computeGoldenVectors };
