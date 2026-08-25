/**
 * zeta-db-node.property.test.ts — property suite (fast-check 4.8.0) for the ZetaDB
 * kernel and, more importantly, for EVERY `ZetaDbImagePort` implementation.
 *
 * Why this file exists (081M0Q8TQYE087G0R001WBX1ZC): the convergence obligation discharged
 * by #13929 was measured against the in-memory reference port ONLY. The production
 * IndexedDB path reaches the same interface through `createBrowserZetaDbImagePort`
 * and was never held to the same contract — so "this port converges" was proved on
 * one implementation and merely ASSERTED on the other. A port with two
 * implementations and one test is a port with one implementation and a rumour.
 *
 * Contents:
 *   CP-1..CP-5  port-conformance suite — parameterised over an implementation ROSTER
 *   PERM        permutation invariance of a tick under SLACK admission budgets
 *   BIND        default no-forget divergence plus explicit canonical-retention closure
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  createInMemoryZetaDbImagePort,
  encodeZetaDbImage,
  runZetaDbNodeTick,
  ZETA_DB_IMAGE_SCHEMA,
  type ZetaDbDelta,
  type ZetaDbImagePort,
  type ZetaDbImageRecord,
  type ZetaDbTickLimits,
} from "./zeta-db-node";
import {
  browserCheckpointFailed,
  browserCheckpointSucceeded,
  copyBrowserCheckpointRecord,
  decideBrowserCheckpointRemoval,
  decideBrowserCheckpointSave,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
} from "../browser-node/browser-checkpoint-port";
import { createBrowserZetaDbImagePort } from "../browser-node/browser-zetadb-image-port";
import { monotoneLastWriterWinsRevisionPolicy } from "../persistence/revision-policy";
import {
  canonicalCheckpointByteRetentionPolicy,
  canonicalEventIdRetentionPolicy,
  type ZetaDbRetentionPolicyPort,
} from "./retention-policy";

// ── The roster ───────────────────────────────────────────────────────────────

/**
 * An in-memory `BrowserCheckpointPort` that routes every decision through the REAL
 * production predicates. `browser-indexeddb-checkpoint.ts` calls
 * `decideBrowserCheckpointSave` inside its IndexedDB transaction (L405), so this
 * harness exercises the shipped decision, not a paraphrase of it — only the
 * IndexedDB plumbing is replaced.
 */
function createDecisionBackedCheckpointPort(): BrowserCheckpointPort {
  const records = new Map<string, BrowserCheckpointRecord>();
  let closed = false;
  return {
    revisionPolicy: monotoneLastWriterWinsRevisionPolicy,
    load: (nodeId) => {
      if (closed) return Promise.resolve(browserCheckpointFailed("checkpoint-store-closed", "closed"));
      const record = records.get(nodeId);
      return Promise.resolve(
        browserCheckpointSucceeded(record === undefined ? null : copyBrowserCheckpointRecord(record)),
      );
    },
    save: (candidate) => {
      if (closed) return Promise.resolve(browserCheckpointFailed("checkpoint-store-closed", "closed"));
      const decision = decideBrowserCheckpointSave(
        records.get(candidate.nodeId) ?? null,
        candidate,
        monotoneLastWriterWinsRevisionPolicy,
      );
      if (!decision.ok) return Promise.resolve(decision);
      records.set(candidate.nodeId, copyBrowserCheckpointRecord(decision.value.record));
      return Promise.resolve(browserCheckpointSucceeded(copyBrowserCheckpointRecord(decision.value.record)));
    },
    remove: (nodeId, throughRevision) => {
      if (closed) return Promise.resolve(browserCheckpointFailed("checkpoint-store-closed", "closed"));
      const decision = decideBrowserCheckpointRemoval(records.get(nodeId) ?? null, nodeId, throughRevision);
      if (!decision.ok) return Promise.resolve(decision);
      if (decision.value.action === "missing") return Promise.resolve(browserCheckpointSucceeded(false));
      records.delete(nodeId);
      return Promise.resolve(browserCheckpointSucceeded(true));
    },
    close: () => {
      closed = true;
      return browserCheckpointSucceeded(null);
    },
  };
}

interface RosterEntry {
  readonly name: string;
  readonly create: () => ZetaDbImagePort;
}

/**
 * Every `ZetaDbImagePort` implementation in the repository. A new implementation that
 * is not added here is an implementation nothing holds to the contract — which is the
 * exact condition this file was written to end.
 */
const ROSTER: readonly RosterEntry[] = [
  { name: "in-memory reference", create: createInMemoryZetaDbImagePort },
  {
    name: "browser checkpoint (production IndexedDB decision)",
    create: () => createBrowserZetaDbImagePort(createDecisionBackedCheckpointPort()),
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const NODE = "conformance-node";

function bytes(seed: string): Uint8Array {
  return new TextEncoder().encode(seed);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function record(revision: number, seed: string): ZetaDbImageRecord {
  return { nodeId: NODE, revision, payload: bytes(seed) };
}

/** Drive a port up to `revision` by successor writes — the one seeding walk every discipline admits. */
async function seedTo(port: ZetaDbImagePort, revision: number): Promise<void> {
  for (let current = 1; current <= revision; current += 1) {
    const saved = await port.save(record(current, `seed-${String(current)}`));
    if (!saved.ok) throw new Error(`seeding failed at revision ${String(current)}: ${saved.feedback.code}`);
  }
}

async function loadedRecord(port: ZetaDbImagePort): Promise<ZetaDbImageRecord | null> {
  const loaded = await port.load(NODE);
  if (!loaded.ok) throw new Error(`load failed: ${loaded.feedback.code}`);
  return loaded.value;
}

// ── CP-1 · a successful save is loadable, byte-identically ───────────────────

describe("CP-1 · save is durable and byte-exact", () => {
  for (const entry of ROSTER) {
    test(entry.name, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 6 }),
          fc.string({ minLength: 0, maxLength: 40 }),
          async (n, seed) => {
            const port = entry.create();
            await seedTo(port, n - 1);
            const candidate = record(n, seed);
            const saved = await port.save(candidate);
            expect(saved.ok).toBe(true);
            const stored = await loadedRecord(port);
            expect(stored).not.toBeNull();
            expect(stored?.nodeId).toBe(NODE);
            expect(stored?.revision).toBe(n);
            expect(sameBytes(stored?.payload ?? new Uint8Array(), candidate.payload)).toBe(true);
          },
        ),
        { numRuns: 60 },
      );
    });
  }
});

// ── CP-2 · re-saving the identical record is idempotent ──────────────────────

describe("CP-2 · identical re-save is idempotent (§12)", () => {
  for (const entry of ROSTER) {
    test(entry.name, async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.string({ maxLength: 30 }), async (n, seed) => {
          const port = entry.create();
          await seedTo(port, n - 1);
          const candidate = record(n, seed);
          expect((await port.save(candidate)).ok).toBe(true);
          const before = await loadedRecord(port);
          expect((await port.save(candidate)).ok).toBe(true);
          const after = await loadedRecord(port);
          expect(after?.revision).toBe(before?.revision ?? -1);
          expect(sameBytes(after?.payload ?? new Uint8Array(), before?.payload ?? new Uint8Array(1))).toBe(true);
        }),
        { numRuns: 50 },
      );
    });
  }
});

// ── CP-3 · REVISION DISCIPLINE ───────────────────────────────────────────────
//
// The property this file was written for. It began life asserting successor
// compare-and-swap against EVERY implementation, and in that form it failed on
// 518499177 against the production browser path — counterexample
// `[stored=1, candidate=3, seed=""]`, the minimal leapfrog — while passing against the
// in-memory reference. That failure IS defect 2: two implementations of one port,
// two contracts, and nothing in the type or the tests able to say so.
//
// It is now split into three parts, and the split is deliberate:
//
//   CP-3a  UNIVERSAL obligations — asserted against every port with NO per-implementation
//          branch. Both disciplines owe these, so no implementation is graded on its own
//          curve. This is the part that keeps CP-3b from becoming the vacuity class.
//   CP-3b  POLICY conformance — a port must behave like its executable policy. A tag can
//          lie while still compiling; a generated decision is a direct behavioral oracle.
//   CP-3c  COVERAGE — the roster must actually contain both declared disciplines, so
//          CP-3b can never pass because one branch was never reached.

describe("CP-3a · obligations every revision discipline owes (no per-port exemption)", () => {
  for (const entry of ROSTER) {
    test(entry.name, async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 4 }), fc.string({ maxLength: 24 }), async (stored, seed) => {
          const port = entry.create();
          await seedTo(port, stored);
          const before = await loadedRecord(port);
          const storedPayload = before?.payload ?? new Uint8Array(1);

          // 1. A strictly older revision is always a conflict.
          const stale = await port.save(record(stored - 1, `stale-${seed}`));
          expect(stale.ok).toBe(false);
          if (!stale.ok) expect(stale.feedback.code).toBe("database-revision-conflict");

          // 2. The same revision naming different bytes is always a conflict.
          const forked = await port.save({ nodeId: NODE, revision: stored, payload: bytes(`forked-${seed}`) });
          expect(forked.ok).toBe(false);
          if (!forked.ok) expect(forked.feedback.code).toBe("database-revision-conflict");

          // 3. The same revision with identical bytes is always idempotent (§12).
          const again = await port.save({ nodeId: NODE, revision: stored, payload: storedPayload });
          expect(again.ok).toBe(true);

          // 4. The successor revision is always admitted.
          const next = await port.save(record(stored + 1, `next-${seed}`));
          expect(next.ok).toBe(true);
        }),
        { numRuns: 80 },
      );
    });
  }
});

describe("CP-3b · a port executes its revision policy", () => {
  for (const entry of ROSTER) {
    test(`${entry.name} — executes "${entry.create().revisionPolicy.id}"`, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 2, max: 9 }),
          fc.string({ maxLength: 24 }),
          async (stored, leap, seed) => {
            const port = entry.create();
            await seedTo(port, stored);
            const existing = await loadedRecord(port);
            if (existing === null) throw new Error("seeded port returned no record");
            const candidate = record(stored + leap, seed);
            const expected = port.revisionPolicy.decide(existing, candidate);
            const saved = await port.save(candidate);

            expect(saved.ok).toBe(expected.ok);
            if (!expected.ok) {
              expect(saved.ok).toBe(false);
              if (!saved.ok) expect(saved.feedback.code).toBe("database-revision-conflict");
              return;
            }
            expect(saved.ok).toBe(true);
            const after = await loadedRecord(port);
            expect(after?.revision).toBe(stored + leap);
          },
        ),
        { numRuns: 120 },
      );
    });
  }

  test("an empty store admits a first write exactly when its policy does", async () => {
    for (const entry of ROSTER) {
      const port = entry.create();
      const candidate = record(7, "first-write-at-seven");
      const expected = port.revisionPolicy.decide(null, candidate);
      const first = await port.save(candidate);
      expect(first.ok).toBe(expected.ok);
    }
  });
});

describe("CP-3c · the roster covers every declared discipline (anti-vacuity)", () => {
  test("CP-3b's branches are both reached by a real implementation", () => {
    const declared = new Set(ROSTER.map((entry) => entry.create().revisionPolicy.id));
    // Without this, CP-3b would pass on a one-sided roster having proved half a contract.
    expect(declared.has("compare-and-swap")).toBe(true);
    expect(declared.has("monotone-last-writer-wins")).toBe(true);
    expect(ROSTER.length).toBeGreaterThan(1);
  });
});

// ── CP-4 · a refused save never mutates the store ────────────────────────────

describe("CP-4 · a refused save leaves the durable image byte-identical", () => {
  for (const entry of ROSTER) {
    test(entry.name, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 0, max: 9 }),
          fc.string({ maxLength: 24 }),
          async (stored, candidateRevision, seed) => {
            const port = entry.create();
            await seedTo(port, stored);
            const before = await loadedRecord(port);
            const saved = await port.save(record(candidateRevision, seed));
            if (saved.ok) return;
            const after = await loadedRecord(port);
            expect(after?.revision).toBe(before?.revision ?? -1);
            expect(sameBytes(after?.payload ?? new Uint8Array(), before?.payload ?? new Uint8Array(1))).toBe(true);
          },
        ),
        { numRuns: 120 },
      );
    });
  }
});

// ── CP-5 · a closed port refuses, it does not silently succeed ───────────────

describe("CP-5 · a closed port refuses further work", () => {
  for (const entry of ROSTER) {
    test(entry.name, async () => {
      const port = entry.create();
      await seedTo(port, 1);
      expect(port.close().ok).toBe(true);
      const saved = await port.save(record(2, "after-close"));
      expect(saved.ok).toBe(false);
      const loaded = await port.load(NODE);
      expect(loaded.ok).toBe(false);
    });
  }
});

// ── PERM · permutation invariance under SLACK admission budgets ──────────────
//
// #13929 made a tick a pure function of the delta SET by two changes. Each gets its
// own falsifier here, because each is independently revertible:
//
//   PERM-A  `rowPairKey` — admission keys running weights by (rowKey, payload), so the
//           well-formedness verdict is a post-condition on the admitted set instead of
//           a per-delta check on a running row. Falsified by permuting deltas WITHIN a
//           tick: revert `rowPairKey` and a retract-then-emit update is admitted in one
//           order and refused in the other.
//   PERM-B  `canonicalEntryOrder` — the retained ledger persists in ordinal `eventId`
//           order, not arrival order. Falsified by permuting BATCH order: revert it and
//           two cells holding the same state serialise to different bytes.

const ROW_KEYS = ["row/a", "row/b"] as const;
const PAYLOADS = ["A", "B"] as const;

interface DeltaParts {
  readonly rowKey: (typeof ROW_KEYS)[number];
  readonly payload: (typeof PAYLOADS)[number];
  readonly weight: number;
}

const deltaPartsArb = fc.record<DeltaParts>({
  rowKey: fc.constantFrom(...ROW_KEYS),
  payload: fc.constantFrom(...PAYLOADS),
  weight: fc.constantFrom(1, -1, 2),
});

/** PERM-A's generator — one row key, signed unit weights, so zero crossings are common. */
const singleRowDeltaPartsArb = fc.record<DeltaParts>({
  rowKey: fc.constant(ROW_KEYS[0]),
  payload: fc.constantFrom(...PAYLOADS),
  weight: fc.constantFrom(1, -1),
});

function withEventIds(parts: readonly DeltaParts[]): readonly ZetaDbDelta[] {
  return parts.map((part, index) => ({ eventId: `event-${String(index + 1)}`, ...part }));
}

function permutations<T>(items: readonly T[]): readonly (readonly T[])[] {
  if (items.length <= 1) return [items];
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += 1) {
    const head = items[index];
    if (head === undefined) continue;
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) output.push([head, ...tail]);
  }
  return output;
}

interface Outcome {
  readonly outcome: string;
  readonly bound: boolean;
}

/**
 * Apply batches in order against a fresh reference port and report the FULL outcome —
 * the durable bytes on success, or the typed refusal code. Reporting the refusal rather
 * than skipping it is what keeps these properties non-vacuous: an order-dependent
 * VERDICT is exactly the defect #13929 fixed, so a property that quietly dropped
 * refusals could not see it.
 */
async function applyBatches(batches: readonly (readonly ZetaDbDelta[])[], limits: ZetaDbTickLimits): Promise<Outcome> {
  const port = createInMemoryZetaDbImagePort();
  let bound = false;
  for (const batch of batches) {
    const result = await runZetaDbNodeTick(port, {
      nodeId: NODE,
      executorId: "perm",
      executorKind: "local-process",
      deltas: batch,
      limits,
    });
    if (!result.ok) return { outcome: `refused:${result.feedback.code}`, bound };
    if (result.value.admission === "backpressured") bound = true;
  }
  const stored = await loadedRecord(port);
  return { outcome: stored === null ? "empty" : new TextDecoder().decode(stored.payload), bound };
}

describe("PERM-A · one tick is a pure function of its delta SET (falsifier for rowPairKey)", () => {
  test("outcome is invariant under permutation of deltas within a tick, budgets slack", async () => {
    let slackCases = 0;
    let bindingCases = 0;

    await fc.assert(
      fc.asyncProperty(
        // ONE row key on purpose: `rowPairKey` governs the (rowKey, payload) surface, so
        // spreading deltas over several rows only dilutes the generator. Three or more
        // deltas are required — the asymmetry needs a ZERO CROSSING (emit, retract to
        // zero, re-emit under a different payload); two deltas conflict symmetrically in
        // both orders and would never expose the defect. Discovered by reverting
        // `rowPairKey` and watching a 2-delta generator stay green.
        fc.array(singleRowDeltaPartsArb, { minLength: 3, maxLength: 4 }),
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 256, max: 4096 }),
        async (parts, maxEntries, maxCheckpointBytes) => {
          const limits: ZetaDbTickLimits = { maxDeltas: 8, maxEntries, maxCheckpointBytes };
          const deltas = withEventIds(parts);
          const outcomes = await Promise.all(permutations(deltas).map((order) => applyBatches([order], limits)));

          if (outcomes.some((entry) => entry.bound)) {
            bindingCases += 1;
            return; // Budget-binding: commutativity is NOT claimed. See BIND · 081M0Q8TY1B087G0R0008CYZJ3.
          }
          slackCases += 1;
          expect(new Set(outcomes.map((entry) => entry.outcome)).size).toBe(1);
        },
      ),
      { numRuns: 120 },
    );

    console.log(`PERM-A generator — slack: ${String(slackCases)}  budget-binding: ${String(bindingCases)}`);
    expect(slackCases).toBeGreaterThan(20);
    expect(bindingCases).toBeGreaterThan(5);
  }, 120_000);
});

/**
 * PERM-B's precondition, stated on the INPUT and never on the outcome.
 *
 * A tick persists a well-formed image, so "a row key names one payload" must hold at
 * every TICK BOUNDARY, not only at the end. When one row key carries two payloads
 * across a batch set, a prefix can be ill-formed even though the union is fine — and
 * then batch order changes the verdict. That is a real, separate finding (081M0Q8TY2E087G0R002ES9VW5), it
 * is witnessed deterministically in PREFIX below, and it is NOT swept under this
 * precondition: the precondition names the excluded class, and the witness shows it.
 */
function singlePayloadPerRow(batches: readonly (readonly ZetaDbDelta[])[]): boolean {
  const payloadsByRow = new Map<string, Set<string>>();
  for (const batch of batches)
    for (const delta of batch) {
      const seen = payloadsByRow.get(delta.rowKey) ?? new Set<string>();
      seen.add(delta.payload);
      payloadsByRow.set(delta.rowKey, seen);
    }
  return [...payloadsByRow.values()].every((payloads) => payloads.size === 1);
}

describe("PERM-B · batch order does not change the durable image (falsifier for canonicalEntryOrder)", () => {
  test("final durable bytes are invariant under permutation of batch order, budgets slack", async () => {
    let slackCases = 0;
    let bindingCases = 0;
    let multiPayloadCases = 0;

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.array(deltaPartsArb, { minLength: 1, maxLength: 2 }), { minLength: 2, maxLength: 3 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 120, max: 2048 }),
        async (shape, maxEntries, maxCheckpointBytes) => {
          const limits: ZetaDbTickLimits = { maxDeltas: 8, maxEntries, maxCheckpointBytes };
          let counter = 0;
          const batches = shape.map((batch) =>
            batch.map((part): ZetaDbDelta => {
              counter += 1;
              return { eventId: `event-${String(counter)}`, ...part };
            }),
          );
          if (!singlePayloadPerRow(batches)) {
            multiPayloadCases += 1;
            return; // See PREFIX — the excluded class, witnessed, not hidden.
          }

          const outcomes = await Promise.all(permutations(batches).map((order) => applyBatches(order, limits)));
          if (outcomes.some((entry) => entry.bound)) {
            bindingCases += 1;
            return;
          }
          slackCases += 1;
          expect(new Set(outcomes.map((entry) => entry.outcome)).size).toBe(1);
        },
      ),
      { numRuns: 200 },
    );

    // ANTI-VACUITY — non-negotiable, and the bar here is the repo's, not fast-check's
    // default. `lean-proof.yml:312-324` is this repo's receipt for what a silently-empty
    // selection costs: 13 theorem names resolving to nothing while the lane reported
    // green. A precondition never exercised in the NEGATIVE direction is a filter nobody
    // has shown is a filter — so every skip class must be PROVED reachable, by count.
    console.log(
      `PERM-B generator — slack: ${String(slackCases)}  budget-binding: ${String(bindingCases)}` +
        `  multi-payload-row (excluded, see PREFIX): ${String(multiPayloadCases)}`,
    );
    expect(slackCases).toBeGreaterThan(20);
    expect(bindingCases).toBeGreaterThan(5);
    expect(multiPayloadCases).toBeGreaterThan(5);
  }, 120_000);
});

// ── PREFIX · the class PERM-B excludes, witnessed rather than hidden ─────────
//
// FOUND BY THIS SUITE, not previously on file (081M0Q8TY2E087G0R002ES9VW5). "A row key names one payload"
// is an invariant of every PERSISTED image, so it is enforced at each tick boundary —
// which makes the row-conflict VERDICT depend on batch order even though #13929 made
// it order-independent within a tick. Two cells fed the same two batches in opposite
// order end at different revisions with different rows.
//
// It is recoverable when a complementary concurrent batch lands between attempts.
// The low-level tick still exposes the order-dependent refusal, while
// `runConvergentZetaDbNodeTick` now gives callers a finite automatic recovery path.

/** Apply every batch even when one is refused — what a real caller does: a refused tick
 *  does not stop the next one. `applyBatches` stops early on purpose (an order-dependent
 *  VERDICT must stay visible to PERM); this variant shows where the two cells END UP. */
async function applyBatchesThroughRefusals(
  batches: readonly (readonly ZetaDbDelta[])[],
  limits: ZetaDbTickLimits,
): Promise<string> {
  const port = createInMemoryZetaDbImagePort();
  for (const batch of batches) {
    await runZetaDbNodeTick(port, {
      nodeId: NODE,
      executorId: "prefix",
      executorKind: "local-process",
      deltas: batch,
      limits,
    });
  }
  const stored = await loadedRecord(port);
  return stored === null ? "empty" : new TextDecoder().decode(stored.payload);
}

describe("PREFIX · a tick-boundary row conflict makes batch order observable", () => {
  test("same batch set, opposite low-level order, different durable rows — and typed retry", async () => {
    const limits: ZetaDbTickLimits = { maxDeltas: 8, maxEntries: 3, maxCheckpointBytes: 328 };
    const emitThenRetract: readonly ZetaDbDelta[] = [
      { eventId: "event-1", rowKey: "row/b", payload: "A", weight: 1 },
      { eventId: "event-2", rowKey: "row/b", payload: "B", weight: -1 },
    ];
    const emitB: readonly ZetaDbDelta[] = [{ eventId: "event-3", rowKey: "row/b", payload: "B", weight: 1 }];

    const forward = await applyBatchesThroughRefusals([emitThenRetract, emitB], limits);
    const reverse = await applyBatchesThroughRefusals([emitB, emitThenRetract], limits);

    // Same batch SET, opposite arrival order, two different durable rows.
    expect(forward).not.toBe(reverse);
    expect(forward).toContain('"rowKey":"row/b","payload":"B"');
    expect(reverse).toContain('"rowKey":"row/b","payload":"A"');

    // The low-level refusal remains visible, but its severity now invites bounded retry.
    const port = createInMemoryZetaDbImagePort();
    const refused = await runZetaDbNodeTick(port, {
      nodeId: NODE,
      executorId: "prefix",
      executorKind: "local-process",
      deltas: emitThenRetract,
      limits,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.feedback.code).toBe("database-row-conflict");
      expect(refused.feedback.severity).toBe("backpressure");
    }
  });
});

// ── BIND · default divergence and explicit retained-set closure ──────────────
//
// Soraya, 2026-08-22: the semilattice convergence law holds only while the admission
// budgets are SLACK. Under a binding budget the same union in opposite arrival order
// leaves two replicas in states neither of which is a superset of the other, and the
// divergence is TERMINAL — the ledger is full, so no retry recovers the dropped
// events. That is permanent silent replica divergence, not eventual consistency.
//
// The default remains a deliberate no-forget choice, so this witness stays load-bearing.
// The second test executes the opt-in canonical retained-set policy through the real node:
// it closes this event-count witness by paying explicit displacement heat.

describe("BIND · no-forget diverges while canonical retention converges", () => {
  test("a binding maxEntries budget makes arrival order observable and the loss terminal", async () => {
    const limits: ZetaDbTickLimits = { maxDeltas: 8, maxEntries: 3, maxCheckpointBytes: 8192 };
    const batchA: readonly ZetaDbDelta[] = [
      { eventId: "e1", rowKey: "row/1", payload: "1", weight: 1 },
      { eventId: "e2", rowKey: "row/2", payload: "2", weight: 1 },
    ];
    const batchB: readonly ZetaDbDelta[] = [
      { eventId: "e3", rowKey: "row/3", payload: "3", weight: 1 },
      { eventId: "e4", rowKey: "row/4", payload: "4", weight: 1 },
    ];

    const ledger = async (batches: readonly (readonly ZetaDbDelta[])[]): Promise<readonly string[]> => {
      const port = createInMemoryZetaDbImagePort();
      for (const batch of batches) {
        await runZetaDbNodeTick(port, {
          nodeId: NODE,
          executorId: "bind",
          executorKind: "local-process",
          deltas: batch,
          limits,
        });
      }
      const stored = await loadedRecord(port);
      if (stored === null) return [];
      const parsed = JSON.parse(new TextDecoder().decode(stored.payload)) as {
        readonly entries: readonly { readonly eventId: string }[];
      };
      return parsed.entries.map((entry) => entry.eventId);
    };

    const aThenB = await ledger([batchA, batchB]);
    const bThenA = await ledger([batchB, batchA]);

    expect(aThenB).not.toEqual(bThenA);
    // Neither replica is a superset of the other — so this is divergence, not lag.
    expect(aThenB.every((id) => bThenA.includes(id))).toBe(false);
    expect(bThenA.every((id) => aThenB.includes(id))).toBe(false);
  });

  test("canonical retention makes the binding witness converge and reports displacement heat", async () => {
    const limits: ZetaDbTickLimits = { maxDeltas: 8, maxEntries: 3, maxCheckpointBytes: 8192 };
    const batchA: readonly ZetaDbDelta[] = [
      { eventId: "e1", rowKey: "row/1", payload: "1", weight: 1 },
      { eventId: "e2", rowKey: "row/2", payload: "2", weight: 1 },
    ];
    const batchB: readonly ZetaDbDelta[] = [
      { eventId: "e3", rowKey: "row/3", payload: "3", weight: 1 },
      { eventId: "e4", rowKey: "row/4", payload: "4", weight: 1 },
    ];

    const ledger = async (
      batches: readonly (readonly ZetaDbDelta[])[],
    ): Promise<{ readonly eventIds: readonly string[]; readonly heatCodes: readonly string[] }> => {
      const port = createInMemoryZetaDbImagePort();
      const heatCodes: string[] = [];
      for (const batch of batches) {
        const result = await runZetaDbNodeTick(
          port,
          {
            nodeId: NODE,
            executorId: "bind/canonical",
            executorKind: "local-process",
            deltas: batch,
            limits,
          },
          undefined,
          canonicalEventIdRetentionPolicy,
        );
        expect(result.ok).toBe(true);
        if (result.ok) heatCodes.push(...result.value.feedback.map((feedback) => feedback.code));
      }
      const stored = await loadedRecord(port);
      if (stored === null) return { eventIds: [], heatCodes };
      const parsed = JSON.parse(new TextDecoder().decode(stored.payload)) as {
        readonly entries: readonly { readonly eventId: string }[];
      };
      return { eventIds: parsed.entries.map((entry) => entry.eventId), heatCodes };
    };

    const aThenB = await ledger([batchA, batchB]);
    const bThenA = await ledger([batchB, batchA]);

    expect(aThenB.eventIds).toEqual(["e1", "e2", "e3"]);
    expect(bThenA.eventIds).toEqual(aThenB.eventIds);
    expect(aThenB.heatCodes).not.toContain("database-retention-displaced");
    expect(bThenA.heatCodes).toContain("database-retention-displaced");
  });

  test("event-count retention still diverges at a byte bound while byte retention converges", async () => {
    const first: ZetaDbDelta = {
      eventId: "e1",
      rowKey: "row/1",
      payload: "A".repeat(120),
      weight: 1,
    };
    const second: ZetaDbDelta = {
      eventId: "e2",
      rowKey: "row/2",
      payload: "B".repeat(120),
      weight: 1,
    };
    const third: ZetaDbDelta = {
      eventId: "e3",
      rowKey: "row/3",
      payload: "C".repeat(120),
      weight: 1,
    };
    const measured = encodeZetaDbImage({
      schema: ZETA_DB_IMAGE_SCHEMA,
      nodeId: NODE,
      revision: 1,
      entries: [first, second],
      rows: [
        { rowKey: first.rowKey, payload: first.payload, weight: first.weight },
        { rowKey: second.rowKey, payload: second.payload, weight: second.weight },
      ],
    });
    if (!measured.ok) throw new Error(measured.feedback.detail);
    const limits: ZetaDbTickLimits = {
      maxDeltas: 8,
      maxEntries: 8,
      maxCheckpointBytes: measured.value.byteLength,
    };

    const ledger = async (
      batches: readonly (readonly ZetaDbDelta[])[],
      policy: ZetaDbRetentionPolicyPort,
    ): Promise<{
      readonly eventIds: readonly string[];
      readonly heatCodes: readonly string[];
      readonly heatResources: readonly string[];
      readonly payload: string;
    }> => {
      const port = createInMemoryZetaDbImagePort();
      const heatCodes: string[] = [];
      const heatResources: string[] = [];
      for (const batch of batches) {
        const result = await runZetaDbNodeTick(
          port,
          {
            nodeId: NODE,
            executorId: "bind/checkpoint-bytes",
            executorKind: "local-process",
            deltas: batch,
            limits,
          },
          undefined,
          policy,
        );
        if (!result.ok) throw new Error(result.feedback.detail);
        heatCodes.push(...result.value.feedback.map((feedback) => feedback.code));
        heatResources.push(
          ...result.value.feedback.flatMap((feedback) =>
            feedback.retentionHeatReceipt === undefined ? [] : [feedback.retentionHeatReceipt.resource],
          ),
        );
      }
      const stored = await loadedRecord(port);
      if (stored === null) return { eventIds: [], heatCodes, heatResources, payload: "empty" };
      const payload = new TextDecoder().decode(stored.payload);
      const parsed = JSON.parse(payload) as {
        readonly entries: readonly { readonly eventId: string }[];
      };
      return { eventIds: parsed.entries.map((entry) => entry.eventId), heatCodes, heatResources, payload };
    };

    const eventForward = await ledger([[first, third], [second]], canonicalEventIdRetentionPolicy);
    const eventReverse = await ledger([[second], [first, third]], canonicalEventIdRetentionPolicy);
    expect(eventForward.eventIds).toEqual(["e1", "e3"]);
    expect(eventReverse.eventIds).toEqual(["e2"]);
    expect(eventForward.payload).not.toBe(eventReverse.payload);

    const byteForward = await ledger([[first, third], [second]], canonicalCheckpointByteRetentionPolicy);
    const byteReverse = await ledger([[second], [first, third]], canonicalCheckpointByteRetentionPolicy);
    expect(byteForward.eventIds).toEqual(["e1", "e2"]);
    expect(byteReverse.eventIds).toEqual(byteForward.eventIds);
    expect(byteReverse.payload).toBe(byteForward.payload);
    expect(byteForward.payload).toContain('"revision":2');
    expect(byteForward.heatCodes).toContain("database-retention-displaced");
    expect(byteForward.heatResources).toEqual(["checkpoint-bytes"]);
    expect(byteReverse.heatCodes).not.toContain("database-retention-displaced");
  });
});
