import { describe, expect, test } from "bun:test";
import { inMemoryZetaStore, executeToolCall } from "./zeta-store.ts";
import type { ToolCall } from "./tool-calls.ts";
import vectors from "./zeta-store-golden-vectors.json" with { type: "json" };

// GOLDEN-VECTOR IR TREATY — the TS oracle's conformance (shadow*, Aaron 2026-07-04 "start the golden-
// vector build"). The treaty: EVERY oracle (this TS zeta-store, the F# ZetaToolStore, the other 5) must
// reproduce these observable results identically — across space (7 langs) and time (DST replay). This
// file proves the TS oracle conforms; the F# replayer (next) proves F#, and its failures ARE the
// convergence work list (_convergence in the JSON: hash function, event encoding, editEverywhere-on-
// absent). v1 locks the hash-INDEPENDENT fs semantics (resolve content, COW vs shared) — the part that
// already agrees. Text-only vectors, no binary in the proof lineage.

interface Op { call: string; path?: string; content?: string }
interface Probe { call: string; path: string; expect: string | null }
interface Vector { name: string; ops: Op[]; probes: Probe[] }

const opToCall = (op: { call: string; path?: string; content?: string }, i: number): ToolCall => ({
  name: op.call,
  callId: `gv_${String(i)}`,
  arguments: { ...(op.path !== undefined ? { path: op.path } : {}), ...(op.content !== undefined ? { content: op.content } : {}) },
});

describe("golden vectors — TS oracle conformance (the IR treaty)", () => {
  const vs = (vectors as { vectors: Vector[] }).vectors;

  test("the treaty carries its convergence ledger (the divergences the F# replayer must drive to zero)", () => {
    const conv = (vectors as { _convergence: string[] })._convergence;
    expect(conv.length).toBeGreaterThanOrEqual(3); // hash function, event encoding, editEverywhere-on-absent (+ db event type)
    expect(conv.join(" ")).toContain("content-hash");
    expect(conv.join(" ")).toContain("editEverywhere");
  });

  for (const v of vs) {
    test(`vector: ${v.name}`, async () => {
      const store = inMemoryZetaStore();
      let i = 0;
      for (const op of v.ops) {
        const r = await executeToolCall(store, opToCall(op, i++));
        expect(r.ok).toBe(true); // every op in a golden vector must apply
      }
      for (const probe of v.probes) {
        const r = await executeToolCall(store, opToCall(probe, i++));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.output).toEqual(probe.expect); // the hash-independent observable must match the locked value
      }
    });
  }
});
