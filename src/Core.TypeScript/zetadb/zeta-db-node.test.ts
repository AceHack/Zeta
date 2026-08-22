import { describe, expect, test } from "bun:test";
import {
  createInMemoryZetaDbImagePort,
  decodeZetaDbImage,
  runConvergentZetaDbNodeTick,
  runZetaDbNodeTick,
  type ZetaDbDelta,
  type ZetaDbExecutorKind,
  type ZetaDbImagePort,
} from "./zeta-db-node";

const limits = { maxDeltas: 16, maxEntries: 32, maxCheckpointBytes: 32 * 1024 };

const firstDelta: ZetaDbDelta = { eventId: "event-1", rowKey: "row/a", payload: "A", weight: 1 };

const deltas: readonly ZetaDbDelta[] = [
  firstDelta,
  { eventId: "event-2", rowKey: "row/a", payload: "A", weight: 2 },
  { eventId: "event-3", rowKey: "row/b", payload: "B", weight: 1 },
  { eventId: "event-4", rowKey: "row/b", payload: "B", weight: -1 },
];

function run(port: ZetaDbImagePort, executorKind: ZetaDbExecutorKind, input = deltas) {
  return runZetaDbNodeTick(port, {
    nodeId: "global-browser-db",
    executorId: `executor/${executorKind}`,
    executorKind,
    deltas: input,
    limits,
  });
}

describe("event-driven ZetaDB node", () => {
  test("consolidates signed rows and retains the complete event ledger", async () => {
    const port = createInMemoryZetaDbImagePort();
    const result = await run(port, "browser-tab");

    expect(result).toEqual({
      ok: true,
      value: {
        schema: "zeta.db.tick.v1",
        nodeId: "global-browser-db",
        executorId: "executor/browser-tab",
        executorKind: "browser-tab",
        revision: 1,
        admission: "complete",
        accepted: 4,
        duplicates: 0,
        nextDeltaIndex: 4,
        rows: [{ rowKey: "row/a", payload: "A", weight: 3 }],
        feedback: [],
      },
    });

    const stored = await port.load("global-browser-db");
    expect(stored.ok && stored.value?.payload.byteLength).toBeGreaterThan(0);
  });

  test("produces the same database state for every temporary executor kind", async () => {
    const kinds: readonly ZetaDbExecutorKind[] = [
      "browser-tab",
      "dedicated-worker",
      "shared-worker",
      "service-worker-event",
      "local-process",
      "cloud-process",
      "github-actions",
    ];
    const states = [];
    for (const kind of kinds) {
      const result = await run(createInMemoryZetaDbImagePort(), kind);
      expect(result.ok).toBe(true);
      if (result.ok) states.push({ revision: result.value.revision, rows: result.value.rows });
    }
    expect(new Set(states.map((state) => JSON.stringify(state))).size).toBe(1);
  });

  test("resumes after each bounded wake-up without requiring a resident process", async () => {
    const port = createInMemoryZetaDbImagePort();
    const first = await runZetaDbNodeTick(port, {
      nodeId: "global-browser-db",
      executorId: "tab/one",
      executorKind: "browser-tab",
      deltas,
      limits: { ...limits, maxDeltas: 2 },
    });

    expect(first.ok && first.value.admission).toBe("backpressured");
    expect(first.ok && first.value.nextDeltaIndex).toBe(2);
    const second = await runZetaDbNodeTick(port, {
      nodeId: "global-browser-db",
      executorId: "actions/run-2",
      executorKind: "github-actions",
      deltas: deltas.slice(2),
      limits,
    });
    expect(second.ok && second.value.rows).toEqual([{ rowKey: "row/a", payload: "A", weight: 3 }]);
    expect(second.ok && second.value.revision).toBe(2);
  });

  test("deduplicates retries by event identifier", async () => {
    const port = createInMemoryZetaDbImagePort();
    const first = await run(port, "browser-tab");
    const retry = await run(port, "shared-worker");

    expect(first.ok).toBe(true);
    expect(retry.ok && retry.value).toMatchObject({ revision: 1, accepted: 0, duplicates: 4 });
  });

  test("rejects a stale expected revision before mutating the durable image", async () => {
    const port = createInMemoryZetaDbImagePort();
    await run(port, "browser-tab", [firstDelta]);

    const stale = await runZetaDbNodeTick(port, {
      nodeId: "global-browser-db",
      executorId: "tab/stale",
      executorKind: "browser-tab",
      expectedRevision: 0,
      deltas: [{ eventId: "event-stale", rowKey: "row/c", payload: "C", weight: 1 }],
      limits,
    });

    expect(stale).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "database-revision-conflict",
        detail: "Database revision 1 does not match expected revision 0.",
      },
    });
    const unchanged = await run(port, "browser-tab", []);
    expect(unchanged.ok && unchanged.value).toMatchObject({
      revision: 1,
      rows: [{ rowKey: "row/a", payload: "A", weight: 1 }],
    });
  });

  test("does not partially commit a complete-required delta batch", async () => {
    const port = createInMemoryZetaDbImagePort();
    await run(port, "browser-tab", [firstDelta]);
    const atomic = await runZetaDbNodeTick(port, {
      nodeId: "global-browser-db",
      executorId: "tab/atomic",
      executorKind: "browser-tab",
      expectedRevision: 1,
      requireComplete: true,
      deltas: [
        { eventId: "replace/retract", rowKey: "row/a", payload: "A", weight: -1 },
        { eventId: "replace/emit", rowKey: "row/a", payload: "B", weight: 1 },
      ],
      limits: { ...limits, maxDeltas: 1 },
    });

    expect(atomic).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-capacity-exhausted" },
    });
    const unchanged = await run(port, "browser-tab", []);
    expect(unchanged.ok && unchanged.value).toMatchObject({
      revision: 1,
      rows: [{ rowKey: "row/a", payload: "A", weight: 1 }],
    });
  });

  test("backpressures at the no-forget boundary and returns the exact continuation", async () => {
    const port = createInMemoryZetaDbImagePort();
    const result = await runZetaDbNodeTick(port, {
      nodeId: "global-browser-db",
      executorId: "tab/bounded",
      executorKind: "browser-tab",
      deltas,
      limits: { ...limits, maxEntries: 2 },
    });

    expect(result.ok && result.value).toMatchObject({
      revision: 1,
      admission: "backpressured",
      accepted: 2,
      nextDeltaIndex: 2,
      feedback: [{ severity: "backpressure", code: "database-capacity-exhausted" }],
    });
  });

  test("rejects conflicting reuse of an event identifier", async () => {
    const port = createInMemoryZetaDbImagePort();
    await run(port, "browser-tab", [firstDelta]);
    const conflict = await run(port, "browser-tab", [{ ...firstDelta, weight: -1 }]);

    expect(conflict).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-event-conflict",
        detail: "Event identifier event-1 already names a different delta.",
      },
    });
  });

  test("admits exactly at the canonical byte boundary and backpressures one byte below it", async () => {
    const secondDelta: ZetaDbDelta = { eventId: "event-5", rowKey: "row/c", payload: "C", weight: 1 };
    const measuredPort = createInMemoryZetaDbImagePort();
    await run(measuredPort, "browser-tab", [firstDelta]);
    await run(measuredPort, "browser-tab", [secondDelta]);
    const measured = await measuredPort.load("global-browser-db");
    expect(measured.ok && measured.value).not.toBeNull();
    if (!measured.ok || measured.value === null) return;

    const exactPort = createInMemoryZetaDbImagePort();
    await run(exactPort, "browser-tab", [firstDelta]);
    const exact = await runZetaDbNodeTick(exactPort, {
      nodeId: "global-browser-db",
      executorId: "tab/exact",
      executorKind: "browser-tab",
      deltas: [secondDelta],
      limits: { ...limits, maxCheckpointBytes: measured.value.payload.byteLength },
    });
    expect(exact.ok && exact.value).toMatchObject({ admission: "complete", accepted: 1, revision: 2 });

    const boundedPort = createInMemoryZetaDbImagePort();
    await run(boundedPort, "browser-tab", [firstDelta]);
    const bounded = await runZetaDbNodeTick(boundedPort, {
      nodeId: "global-browser-db",
      executorId: "tab/bounded-bytes",
      executorKind: "browser-tab",
      deltas: [secondDelta],
      limits: { ...limits, maxCheckpointBytes: measured.value.payload.byteLength - 1 },
    });
    expect(bounded.ok && bounded.value).toMatchObject({
      admission: "backpressured",
      accepted: 0,
      nextDeltaIndex: 0,
      revision: 1,
    });
  });

  test("serializes simultaneous tab revisions without last-writer-wins data loss", async () => {
    const port = createInMemoryZetaDbImagePort();
    const request = (tab: string, delta: ZetaDbDelta) =>
      runZetaDbNodeTick(port, {
        nodeId: "global-browser-db",
        executorId: tab,
        executorKind: "browser-tab",
        deltas: [delta],
        limits,
      });
    const results = await Promise.all([
      request("tab/a", firstDelta),
      request("tab/b", { eventId: "event-b", rowKey: "row/b", payload: "B", weight: 1 }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      {
        ok: false,
        feedback: {
          severity: "backpressure",
          code: "database-revision-conflict",
          detail: "Database revision 1 cannot follow stored revision 1.",
        },
      },
    ]);
  });

  test("reloads concurrent disjoint batches until one shared journal contains both", async () => {
    const durable = createInMemoryZetaDbImagePort();
    let releaseInitialLoads: (() => void) | undefined;
    const initialLoadsReady = new Promise<void>((resolve) => {
      releaseInitialLoads = resolve;
    });
    let loads = 0;
    let revisionConflicts = 0;
    const port: ZetaDbImagePort = {
      load: async (nodeId) => {
        const snapshot = await durable.load(nodeId);
        loads += 1;
        if (loads === 1) await initialLoadsReady;
        else if (loads === 2) releaseInitialLoads?.();
        return snapshot;
      },
      save: async (record) => {
        const result = await durable.save(record);
        if (!result.ok && result.feedback.code === "database-revision-conflict") revisionConflicts += 1;
        return result;
      },
      close: () => durable.close(),
    };
    const request = (tab: string, delta: ZetaDbDelta) =>
      runConvergentZetaDbNodeTick(
        port,
        {
          nodeId: "global-browser-db",
          executorId: tab,
          executorKind: "browser-tab",
          deltas: [delta],
          limits,
        },
        { maxAttempts: 2 },
      );

    const results = await Promise.all([
      request("tab/a", firstDelta),
      request("tab/b", { eventId: "event-b", rowKey: "row/b", payload: "B", weight: 1 }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.map((result) => (result.ok ? result.value.revision : null)).sort()).toEqual([1, 2]);
    expect({ loads, revisionConflicts }).toEqual({ loads: 3, revisionConflicts: 1 });

    const stored = await durable.load("global-browser-db");
    expect(stored.ok && stored.value).not.toBeNull();
    if (!stored.ok || stored.value === null) return;
    const image = decodeZetaDbImage(stored.value.payload);
    expect(image.ok && image.value).toMatchObject({
      revision: 2,
      entries: [
        { eventId: "event-1", rowKey: "row/a", payload: "A", weight: 1 },
        { eventId: "event-b", rowKey: "row/b", payload: "B", weight: 1 },
      ],
      rows: [
        { rowKey: "row/a", payload: "A", weight: 1 },
        { rowKey: "row/b", payload: "B", weight: 1 },
      ],
    });
  });

  test("returns typed backpressure when the convergence attempt budget is spent", async () => {
    let loads = 0;
    let saves = 0;
    const alwaysConflicted: ZetaDbImagePort = {
      load: () => {
        loads += 1;
        return Promise.resolve({ ok: true, value: null });
      },
      save: () => {
        saves += 1;
        return Promise.resolve({
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "database-revision-conflict",
            detail: "A concurrent writer advanced the journal.",
          },
        });
      },
      close: () => ({ ok: true, value: null }),
    };

    const result = await runConvergentZetaDbNodeTick(
      alwaysConflicted,
      {
        nodeId: "global-browser-db",
        executorId: "tab/bounded-retry",
        executorKind: "browser-tab",
        deltas: [firstDelta],
        limits,
      },
      { maxAttempts: 3 },
    );

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "database-revision-conflict",
        detail:
          "Database tick spent its 3-attempt convergence budget. Last conflict: A concurrent writer advanced the journal.",
      },
    });
    expect({ loads, saves }).toEqual({ loads: 3, saves: 3 });
  });

  test("does not retry an explicit compare-and-swap revision conflict", async () => {
    const port = createInMemoryZetaDbImagePort();
    await run(port, "browser-tab", [firstDelta]);

    const result = await runConvergentZetaDbNodeTick(
      port,
      {
        nodeId: "global-browser-db",
        executorId: "tab/strict-cas",
        executorKind: "browser-tab",
        expectedRevision: 0,
        deltas: [{ eventId: "event-strict", rowKey: "row/b", payload: "B", weight: 1 }],
        limits,
      },
      { maxAttempts: 4 },
    );

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        code: "database-revision-conflict",
        detail: "Database revision 1 does not match expected revision 0.",
      },
    });
  });

  // 081KZM0FTJM moved the well-formedness check off the per-delta admission path (where
  // its verdict depended on arrival order) and onto the end-of-batch fold. These two
  // pin BOTH halves of that move: a genuine conflict must still be refused, and it must
  // be refused from either arrival order — otherwise the check has been relocated into
  // a place that cannot fire, which is worse than the ordering bug it replaced.
  test("refuses a row key that ends the batch naming two live payloads, in either order", async () => {
    const alpha: ZetaDbDelta = { eventId: "event/alpha", rowKey: "row/one", payload: "A", weight: 1 };
    const beta: ZetaDbDelta = { eventId: "event/beta", rowKey: "row/one", payload: "B", weight: 1 };

    for (const order of [
      [alpha, beta],
      [beta, alpha],
    ]) {
      const conflicted = await run(createInMemoryZetaDbImagePort(), "local-process", order);
      expect(conflicted).toEqual({
        ok: false,
        feedback: {
          severity: "heat",
          code: "database-row-conflict",
          detail: "Row key row/one names more than one payload. Row keys must identify complete row values.",
        },
      });
    }
  });

  test("admits an update whose retraction and emission arrive in either order", async () => {
    const seed: ZetaDbDelta = { eventId: "event/seed", rowKey: "row/one", payload: "A", weight: 1 };
    const retract: ZetaDbDelta = { eventId: "event/retract", rowKey: "row/one", payload: "A", weight: -1 };
    const emit: ZetaDbDelta = { eventId: "event/emit", rowKey: "row/one", payload: "B", weight: 1 };

    for (const order of [
      [seed, retract, emit],
      [seed, emit, retract],
    ]) {
      const updated = await run(createInMemoryZetaDbImagePort(), "local-process", order);
      expect(updated.ok && updated.value.rows).toEqual([{ rowKey: "row/one", payload: "B", weight: 1 }]);
    }
  });
});
