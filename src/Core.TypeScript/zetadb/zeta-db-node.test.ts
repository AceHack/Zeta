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
import { compareAndSwapRevisionPolicy } from "../persistence/revision-policy";
import {
  createReservedCapacityAdmissionPolicy,
  type ZetaDbAdmissionPolicyPort,
  type ZetaDbAdmissionProposal,
} from "./admission-policy";

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

  test("executes an injected admission policy over exact resource proposals", async () => {
    const proposals: ZetaDbAdmissionProposal[] = [];
    const reserveOneEntry: ZetaDbAdmissionPolicyPort = {
      id: "test-reserve-one-entry",
      decide: (proposal) => {
        proposals.push(proposal);
        return proposal.resource === "retained-events" && proposal.candidate > 1
          ? { action: "backpressure", detail: "The test policy reserved the final entry." }
          : { action: "admit" };
      },
    };
    const result = await runZetaDbNodeTick(
      createInMemoryZetaDbImagePort(),
      {
        nodeId: "global-browser-db",
        executorId: "tab/policy",
        executorKind: "browser-tab",
        deltas: deltas.slice(0, 2),
        limits,
      },
      reserveOneEntry,
    );

    expect(result.ok && result.value).toMatchObject({
      admission: "backpressured",
      accepted: 1,
      nextDeltaIndex: 1,
      feedback: [{ detail: "The test policy reserved the final entry." }],
    });
    expect(proposals).toHaveLength(3);
    expect(proposals.at(0)).toEqual({
      resource: "retained-events",
      current: 0,
      candidate: 1,
      limit: limits.maxEntries,
    });
    const checkpointProposal = proposals.at(1);
    expect(checkpointProposal?.resource).toBe("checkpoint-bytes");
    expect(typeof checkpointProposal?.current).toBe("number");
    expect(proposals.at(2)).toEqual({
      resource: "retained-events",
      current: 1,
      candidate: 2,
      limit: limits.maxEntries,
    });
  });

  test("carries reserved-capacity accounting through typed tick feedback", async () => {
    const created = createReservedCapacityAdmissionPolicy({ retainedEvents: 1, checkpointBytes: 0 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = await runZetaDbNodeTick(
      createInMemoryZetaDbImagePort(),
      {
        nodeId: "global-browser-db",
        executorId: "tab/reserved-capacity",
        executorKind: "browser-tab",
        deltas: deltas.slice(0, 2),
        limits: { ...limits, maxEntries: 2 },
      },
      created.value,
    );

    expect(result.ok && result.value).toMatchObject({
      admission: "backpressured",
      accepted: 1,
      nextDeltaIndex: 1,
      feedback: [
        {
          code: "database-capacity-exhausted",
          admissionReceipt: {
            policyId: "reserved-capacity",
            resource: "retained-events",
            current: 1,
            candidate: 2,
            hardLimit: 2,
            effectiveLimit: 1,
            reserved: 1,
          },
        },
      ],
    });

    const completeRequired = await runZetaDbNodeTick(
      createInMemoryZetaDbImagePort(),
      {
        nodeId: "global-browser-db",
        executorId: "tab/reserved-capacity-atomic",
        executorKind: "browser-tab",
        requireComplete: true,
        deltas: deltas.slice(0, 2),
        limits: { ...limits, maxEntries: 2 },
      },
      created.value,
    );
    expect(completeRequired).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "database-capacity-exhausted",
        admissionReceipt: {
          policyId: "reserved-capacity",
          resource: "retained-events",
          hardLimit: 2,
          effectiveLimit: 1,
          reserved: 1,
        },
      },
    });
  });

  test("keeps hard capacity limits authoritative over an always-admit policy", async () => {
    let decisions = 0;
    const alwaysAdmit: ZetaDbAdmissionPolicyPort = {
      id: "test-always-admit",
      decide: () => {
        decisions += 1;
        return { action: "admit" };
      },
    };
    const port = createInMemoryZetaDbImagePort();
    const result = await runZetaDbNodeTick(
      port,
      {
        nodeId: "global-browser-db",
        executorId: "tab/hard-limit",
        executorKind: "browser-tab",
        deltas: deltas.slice(0, 2),
        limits: { ...limits, maxEntries: 1 },
      },
      alwaysAdmit,
    );

    expect(result.ok && result.value).toMatchObject({
      admission: "backpressured",
      accepted: 1,
      nextDeltaIndex: 1,
      feedback: [{ code: "database-capacity-exhausted" }],
    });
    expect(decisions).toBe(2);
    const stored = await port.load("global-browser-db");
    expect(stored.ok && stored.value?.revision).toBe(1);

    const byteResult = await runZetaDbNodeTick(
      createInMemoryZetaDbImagePort(),
      {
        nodeId: "global-browser-db",
        executorId: "tab/hard-byte-limit",
        executorKind: "browser-tab",
        deltas: [firstDelta],
        limits: { ...limits, maxCheckpointBytes: 1 },
      },
      alwaysAdmit,
    );
    expect(byteResult.ok && byteResult.value).toMatchObject({
      admission: "backpressured",
      accepted: 0,
      nextDeltaIndex: 0,
      feedback: [{ code: "database-capacity-exhausted" }],
    });
    expect(decisions).toBe(3);
  });

  test("contains throwing and malformed policies as typed feedback", async () => {
    const throwing: ZetaDbAdmissionPolicyPort = {
      id: "test-throwing",
      decide: (proposal) => {
        if (proposal.resource === "retained-events") return { action: "admit" };
        throw new Error("deliberate failure");
      },
    };
    const malformed = {
      id: "test-malformed",
      decide: () => ({ action: "unknown" }),
    } as unknown as ZetaDbAdmissionPolicyPort;
    const lyingAccounting: ZetaDbAdmissionPolicyPort = {
      id: "test-lying-accounting",
      decide: (proposal) => ({
        action: "backpressure",
        detail: "This receipt does not describe the proposal.",
        accounting: {
          resource: proposal.resource,
          current: proposal.current,
          candidate: proposal.candidate,
          hardLimit: proposal.limit,
          effectiveLimit: proposal.limit,
          reserved: 1,
        },
      }),
    };
    const unnamed: ZetaDbAdmissionPolicyPort = { id: "", decide: () => ({ action: "admit" }) };
    const request = {
      nodeId: "global-browser-db",
      executorId: "tab/policy-failure",
      executorKind: "browser-tab" as const,
      deltas: [firstDelta],
      limits,
    };

    const throwingPort = createInMemoryZetaDbImagePort();
    const thrownResult = await runZetaDbNodeTick(throwingPort, request, throwing);
    expect(thrownResult).toMatchObject({
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-admission-policy-failed",
        detail: "Database admission policy test-throwing failed: Error: deliberate failure",
      },
    });
    const afterThrow = await throwingPort.load("global-browser-db");
    expect(afterThrow.ok && afterThrow.value).toBeNull();
    const malformedResult = await runZetaDbNodeTick(createInMemoryZetaDbImagePort(), request, malformed);
    expect(malformedResult).toMatchObject({
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-admission-policy-failed",
        detail: "Database admission policy test-malformed returned an invalid decision.",
      },
    });
    const lyingResult = await runZetaDbNodeTick(createInMemoryZetaDbImagePort(), request, lyingAccounting);
    expect(lyingResult).toMatchObject({
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-admission-policy-failed",
        detail: "Database admission policy test-lying-accounting returned an invalid decision.",
      },
    });
    const unnamedResult = await runZetaDbNodeTick(createInMemoryZetaDbImagePort(), request, unnamed);
    expect(unnamedResult).toMatchObject({
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-admission-policy-failed",
        detail: "The injected database admission policy does not implement a named decide function.",
      },
    });
  });

  test("copies getter-backed policy receipts inside the guarded boundary", async () => {
    let reservedReads = 0;
    const getterBacked: ZetaDbAdmissionPolicyPort = {
      id: "test-getter-backed",
      decide: (proposal) => ({
        action: "backpressure",
        detail: "The test policy reserved one unit.",
        accounting: {
          resource: proposal.resource,
          current: proposal.current,
          candidate: proposal.candidate,
          hardLimit: proposal.limit,
          effectiveLimit: proposal.limit - 1,
          get reserved() {
            reservedReads += 1;
            if (reservedReads > 1) throw new Error("receipt escaped the guard");
            return 1;
          },
        },
      }),
    };
    const result = await runZetaDbNodeTick(
      createInMemoryZetaDbImagePort(),
      {
        nodeId: "global-browser-db",
        executorId: "tab/getter-backed-policy",
        executorKind: "browser-tab",
        deltas: [firstDelta],
        limits,
      },
      getterBacked,
    );

    expect(result.ok && result.value).toMatchObject({
      admission: "backpressured",
      accepted: 0,
      feedback: [{ admissionReceipt: { policyId: "test-getter-backed", reserved: 1 } }],
    });
    expect(reservedReads).toBe(1);
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
          detail: "Revision 1 already names different bytes.",
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
      // Inherited, not asserted: this fake only instruments the durable port it wraps.
      revisionPolicy: durable.revisionPolicy,
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
      revisionPolicy: compareAndSwapRevisionPolicy,
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

  test("forwards an injected admission policy through the bounded-retry runner", async () => {
    let decisions = 0;
    const stopBeforeWrite: ZetaDbAdmissionPolicyPort = {
      id: "test-stop-before-write",
      decide: () => {
        decisions += 1;
        return { action: "backpressure", detail: "The test policy refused this proposal." };
      },
    };
    const result = await runConvergentZetaDbNodeTick(
      createInMemoryZetaDbImagePort(),
      {
        nodeId: "global-browser-db",
        executorId: "tab/policy",
        executorKind: "browser-tab",
        deltas: [firstDelta],
        limits,
      },
      { maxAttempts: 3 },
      stopBeforeWrite,
    );

    expect(result.ok && result.value).toMatchObject({
      admission: "backpressured",
      accepted: 0,
      nextDeltaIndex: 0,
      feedback: [{ detail: "The test policy refused this proposal." }],
    });
    expect(decisions).toBe(1);
  });

  test("retries a row-prefix conflict after a concurrent complementary batch lands", async () => {
    const durable = createInMemoryZetaDbImagePort();
    let releaseComplementarySave: (() => void) | undefined;
    const complementarySaveReady = new Promise<void>((resolve) => {
      releaseComplementarySave = resolve;
    });
    let loads = 0;
    const port: ZetaDbImagePort = {
      revisionPolicy: durable.revisionPolicy,
      load: async (nodeId) => {
        loads += 1;
        if (loads >= 3) await complementarySaveReady;
        return durable.load(nodeId);
      },
      save: async (record) => {
        const result = await durable.save(record);
        if (result.ok) releaseComplementarySave?.();
        return result;
      },
      close: () => durable.close(),
    };
    const emitThenRetract: readonly ZetaDbDelta[] = [
      { eventId: "event/a/emit", rowKey: "row/one", payload: "A", weight: 1 },
      { eventId: "event/b/retract", rowKey: "row/one", payload: "B", weight: -1 },
    ];
    const emitB: readonly ZetaDbDelta[] = [{ eventId: "event/b/emit", rowKey: "row/one", payload: "B", weight: 1 }];
    const request = (executorId: string, input: readonly ZetaDbDelta[]) =>
      runConvergentZetaDbNodeTick(
        port,
        {
          nodeId: "global-browser-db",
          executorId,
          executorKind: "browser-tab",
          deltas: input,
          limits,
        },
        { maxAttempts: 2 },
      );

    const [completedPrefix, complementary] = await Promise.all([
      request("tab/prefix", emitThenRetract),
      request("tab/complement", emitB),
    ]);

    expect(completedPrefix.ok && completedPrefix.value).toMatchObject({ revision: 2, accepted: 2 });
    expect(complementary.ok && complementary.value).toMatchObject({ revision: 1, accepted: 1 });
    expect(loads).toBe(3);

    const stored = await durable.load("global-browser-db");
    expect(stored.ok && stored.value).not.toBeNull();
    if (!stored.ok || stored.value === null) return;
    const image = decodeZetaDbImage(stored.value.payload);
    expect(image.ok && image.value).toMatchObject({
      revision: 2,
      rows: [{ rowKey: "row/one", payload: "A", weight: 1 }],
    });
  });

  test("bounds an unresolvable row conflict without mutating storage", async () => {
    const durable = createInMemoryZetaDbImagePort();
    let loads = 0;
    let saves = 0;
    const port: ZetaDbImagePort = {
      revisionPolicy: durable.revisionPolicy,
      load: (nodeId) => {
        loads += 1;
        return durable.load(nodeId);
      },
      save: (record) => {
        saves += 1;
        return durable.save(record);
      },
      close: () => durable.close(),
    };
    const conflicted: readonly ZetaDbDelta[] = [
      { eventId: "event/a", rowKey: "row/one", payload: "A", weight: 1 },
      { eventId: "event/b", rowKey: "row/one", payload: "B", weight: 1 },
    ];

    const result = await runConvergentZetaDbNodeTick(
      port,
      {
        nodeId: "global-browser-db",
        executorId: "tab/permanent-conflict",
        executorKind: "browser-tab",
        deltas: conflicted,
        limits,
      },
      { maxAttempts: 3 },
    );

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "database-row-conflict",
        detail:
          "Database tick spent its 3-attempt convergence budget. Last conflict: Row key row/one names more than one payload. Row keys must identify complete row values.",
      },
    });
    expect({ loads, saves }).toEqual({ loads: 3, saves: 0 });
    expect(await durable.load("global-browser-db")).toEqual({ ok: true, value: null });
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
          severity: "backpressure",
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
