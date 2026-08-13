import { describe, expect, test } from "bun:test";
import {
  createInMemoryZetaDbImagePort,
  runZetaDbNodeTick,
  type ZetaDbTickReadout,
  type ZetaDbTickRequest,
} from "../zetadb/zeta-db-node";
import {
  browserExecutionAdmitted,
  browserExecutionBusy,
  createInMemoryBrowserExecutionAdmission,
  type BrowserExecutionAdmissionPort,
} from "./browser-execution-admission";
import {
  createInMemoryBrowserDatabaseIntentOutbox,
  type BrowserDatabaseExecutionReceipt,
  type BrowserDatabaseIntentOutboxPort,
} from "./browser-database-intent-outbox";
import {
  createZetaDbBrowserDatabaseReceiptArchive,
  type BrowserDatabaseReceiptArchivePort,
} from "./browser-database-receipt-archive";
import type {
  BrowserDatabaseReceiptHandoffReadout,
  BrowserDatabaseReceiptHandoffRuntime,
} from "./browser-database-receipt-handoff";
import { startBrowserZetaDbTabRuntime, type BrowserZetaDbTabExecutor } from "./browser-zetadb-tab-runtime";

const limits = { maxDeltas: 8, maxEntries: 16, maxCheckpointBytes: 16 * 1024 };
const outboxLimits = { maxIntents: 16, maxReceipts: 64, maxLedgerBytes: 64 * 1024 };

function createOutbox(): BrowserDatabaseIntentOutboxPort {
  const created = createInMemoryBrowserDatabaseIntentOutbox(outboxLimits);
  if (!created.ok) throw new Error(created.feedback.detail);
  return created.value;
}

function createReceiptArchive(databaseNodeId = "browser/global"): BrowserDatabaseReceiptArchivePort {
  const image = createInMemoryZetaDbImagePort();
  const created = createZetaDbBrowserDatabaseReceiptArchive({
    sourceDatabaseNodeId: databaseNodeId,
    archiveNodeId: databaseNodeId === "receipt-archive" ? "receipt-archive-2" : "receipt-archive",
    executorId: "receipt-archive",
    limits: { maxDeltas: 1, maxEntries: 64, maxCheckpointBytes: 64 * 1024 },
    execute: (request) => runZetaDbNodeTick(image, request),
  });
  if (!created.ok) throw new Error(created.feedback.detail);
  return created.value;
}

function readout(request: ZetaDbTickRequest, revision: number): ZetaDbTickReadout {
  return {
    schema: "zeta.db.tick.v1",
    nodeId: request.nodeId,
    executorId: request.executorId,
    executorKind: request.executorKind,
    revision,
    admission: "complete",
    accepted: request.deltas.length,
    duplicates: 0,
    nextDeltaIndex: request.deltas.length,
    rows: [{ rowKey: "game/score", payload: "9000", weight: 1 }],
    feedback: [],
  };
}

function start(
  execute: BrowserZetaDbTabExecutor,
  admission: BrowserExecutionAdmissionPort = createInMemoryBrowserExecutionAdmission(),
  executorId = "tab-a",
  outbox: BrowserDatabaseIntentOutboxPort = createOutbox(),
  receiptArchive: BrowserDatabaseReceiptArchivePort = createReceiptArchive(),
  receiptHandoff?: BrowserDatabaseReceiptHandoffRuntime,
) {
  const observed: ZetaDbTickReadout[] = [];
  const published: { readonly databaseNodeId: string; readonly revision: number }[] = [];
  const receipts: BrowserDatabaseExecutionReceipt[] = [];
  const handoffs: BrowserDatabaseReceiptHandoffReadout[] = [];
  const started = startBrowserZetaDbTabRuntime({
    databaseNodeId: "browser/global",
    executorId,
    limits,
    admission,
    outbox,
    receiptArchive,
    ...(receiptHandoff === undefined ? {} : { receiptHandoff }),
    execute,
    observe: (value) => {
      observed.push(value);
      return { ok: true };
    },
    observeOutbox: () => ({ ok: true }),
    observeReceiptHandoff: (readout) => {
      handoffs.push(readout);
      return { ok: true };
    },
    publishInvalidation: (databaseNodeId, revision) => {
      published.push({ databaseNodeId, revision });
      return { ok: true };
    },
    publishExecutionReceipt: (receipt) => {
      receipts.push(receipt);
      return { ok: true };
    },
  });
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error(started.feedback.detail);
  return { runtime: started.value, observed, published, receipts, handoffs };
}

describe("browser ZetaDB tab runtime", () => {
  // The identifier length boundary. `isIdentifier` accepts 1..1024, and NOTHING exercised 1024 —
  // found 2026-08-11 by the mutation runner's first genuine execution (the step had been a no-op in
  // CI since it shipped). Flipping `<=` to `<` there rejected exactly-1024 and the whole suite
  // stayed green, so a stated numeric contract had zero boundary coverage: the classic off-by-one
  // surface. These two tests pin both sides, so the mutant now dies.
  const startWith = (id: string) =>
    startBrowserZetaDbTabRuntime({
      databaseNodeId: id,
      executorId: "tab-a",
      limits,
      admission: createInMemoryBrowserExecutionAdmission(),
      outbox: createOutbox(),
      receiptArchive: { archive: () => Promise.reject(new Error("unused")) },
      execute: () =>
        Promise.resolve({
          ok: false,
          feedback: { severity: "heat", code: "database-read-failed", detail: "unused" },
        }),
      observe: () => ({ ok: true }),
      observeOutbox: () => ({ ok: true }),
      publishInvalidation: () => ({ ok: true }),
      publishExecutionReceipt: () => ({ ok: true }),
    });

  test("an identifier of EXACTLY the 1024 limit is accepted — the bound is inclusive", () => {
    const started = startWith("x".repeat(1024));
    expect(started.ok).toBe(true);
  });

  test("an identifier one character OVER the limit is rejected", () => {
    const started = startWith("x".repeat(1025));
    expect(started.ok).toBe(false);
    if (started.ok) throw new Error("expected 1025 chars to be refused");
    expect(started.feedback.code).toBe("database-tab-configuration-invalid");
  });

  test("rejects a missing execution admission port as typed configuration feedback", () => {
    const started = startBrowserZetaDbTabRuntime({
      databaseNodeId: "database-a",
      executorId: "tab-a",
      limits,
      admission: undefined as never,
      outbox: createOutbox(),
      receiptArchive: createReceiptArchive("database-a"),
      execute: () =>
        Promise.resolve({
          ok: false,
          feedback: { severity: "heat", code: "database-read-failed", detail: "unused" },
        }),
      observe: () => ({ ok: true }),
      observeOutbox: () => ({ ok: true }),
      publishInvalidation: () => ({ ok: true }),
      publishExecutionReceipt: () => ({ ok: true }),
    });

    expect(started).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-tab-configuration-invalid",
        detail:
          "A browser database tab runtime requires identifiers, positive safe-integer tick budgets, admission, an intent outbox, and a receipt archive.",
      },
    });
  });

  test("publishes accepted local writes and renders their finite tick", async () => {
    const requests: ZetaDbTickRequest[] = [];
    const { runtime, observed, published, receipts } = start((request) => {
      requests.push(request);
      return Promise.resolve({ ok: true, value: readout(request, 1) });
    });

    const result = await runtime.tick([{ eventId: "score-9000", rowKey: "game/score", payload: "9000", weight: 1 }]);

    expect(result).toMatchObject({ ok: true, value: { revision: 1, accepted: 1 } });
    expect(requests[0]).toMatchObject({ nodeId: "browser/global", executorId: "tab-a", executorKind: "browser-tab" });
    expect(observed).toHaveLength(1);
    expect(published).toEqual([{ databaseNodeId: "browser/global", revision: 1 }]);
    expect(receipts).toEqual([
      {
        schema: "zeta.browser-database-execution-receipt.v1",
        databaseNodeId: "browser/global",
        intentId: "score-9000",
        sequence: 0,
        status: "settled",
        executorId: "tab-a",
        executorKind: "browser-tab",
        revision: 1,
        accepted: 1,
        duplicates: 0,
        deltaCount: 1,
      },
    ]);
  });

  test("runs bounded receipt maintenance around a mutation and exposes its latest readout", async () => {
    const idle: BrowserDatabaseReceiptHandoffReadout = {
      schema: "zeta.browser-database-receipt-handoff-readout.v1",
      status: "idle",
      databaseNodeId: "browser/global",
      archiveNodeId: "browser/global:receipts",
      targetNodeId: "browser/global:durable",
      archiveRevision: 0,
      retainedReceipts: 0,
      releasedReceipts: 0,
      receiptPayloadBytes: 0,
      highWaterSequence: null,
      contentHash: null,
      disposition: null,
      feedback: null,
    };
    let latest = idle;
    let calls = 0;
    const receiptHandoff: BrowserDatabaseReceiptHandoffRuntime = {
      handoff: () => {
        calls += 1;
        latest = calls < 2 ? idle : { ...idle, status: "complete", releasedReceipts: 1, highWaterSequence: 0 };
        return Promise.resolve({ ok: true, value: latest });
      },
      read: () => latest,
    };
    const { runtime, handoffs } = start(
      (request) => Promise.resolve({ ok: true, value: readout(request, 1) }),
      createInMemoryBrowserExecutionAdmission(),
      "tab-a",
      createOutbox(),
      createReceiptArchive(),
      receiptHandoff,
    );

    expect(
      await runtime.tick([{ eventId: "event/handoff", rowKey: "game/score", payload: "12", weight: 1 }]),
    ).toMatchObject({ ok: true, value: { revision: 1 } });
    expect(calls).toBe(2);
    expect(handoffs.map((readout) => readout.status)).toEqual(["idle", "complete"]);
    expect(runtime.readReceiptHandoff()).toMatchObject({ status: "complete", releasedReceipts: 1 });
    expect(await runtime.handoffReceipts()).toMatchObject({
      ok: true,
      value: { status: "complete", releasedReceipts: 1 },
    });
  });

  test("serializes peer rereads, coalesces stale revisions, and never republishes them", async () => {
    let active = 0;
    let maxActive = 0;
    const requests: ZetaDbTickRequest[] = [];
    const { runtime, observed, published } = start(async (request) => {
      requests.push(request);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { ok: true, value: readout(request, 2) };
    });

    expect(
      runtime.receiveInvalidation({ sourceTabId: "tab-b", databaseNodeId: "browser/global", revision: 1 }),
    ).toEqual({ ok: true, value: null });
    expect(
      runtime.receiveInvalidation({ sourceTabId: "tab-c", databaseNodeId: "browser/global", revision: 2 }),
    ).toEqual({ ok: true, value: null });
    expect(
      runtime.receiveInvalidation({ sourceTabId: "tab-d", databaseNodeId: "another/database", revision: 9 }),
    ).toEqual({ ok: true, value: null });

    expect(await runtime.recoverPending()).toEqual({ ok: true, value: null });
    expect(await runtime.drainInvalidations()).toMatchObject({ ok: true, value: { revision: 2, accepted: 0 } });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.deltas).toEqual([]);
    expect(maxActive).toBe(1);
    expect(observed).toHaveLength(1);
    expect(published).toEqual([]);
  });

  test("forwards an expected revision through the serialized compare-and-swap path", async () => {
    const requests: ZetaDbTickRequest[] = [];
    const { runtime } = start((request) => {
      requests.push(request);
      return Promise.resolve({ ok: true, value: readout(request, 5) });
    });
    const delta = { eventId: "replace/1", rowKey: "game/score", payload: "10000", weight: 1 } as const;

    expect(await runtime.compareAndSwap(4, [delta])).toMatchObject({ ok: true, value: { revision: 5 } });
    expect(requests[0]).toMatchObject({ expectedRevision: 4, requireComplete: true, deltas: [delta] });
    expect(await runtime.compareAndSwap(-1, [delta])).toMatchObject({
      ok: false,
      feedback: { code: "database-tab-configuration-invalid" },
    });
    expect(requests).toHaveLength(1);
  });

  test("returns typed heat for invalid configuration, thrown executors, and work after stop", async () => {
    expect(
      startBrowserZetaDbTabRuntime({
        databaseNodeId: "",
        executorId: "tab-a",
        limits,
        admission: createInMemoryBrowserExecutionAdmission(),
        outbox: createOutbox(),
        receiptArchive: createReceiptArchive(),
        execute: () => Promise.resolve({ ok: true, value: {} as never }),
        observe: () => ({ ok: true }),
        observeOutbox: () => ({ ok: true }),
        publishInvalidation: () => ({ ok: true }),
        publishExecutionReceipt: () => ({ ok: true }),
      }),
    ).toMatchObject({ ok: false, feedback: { code: "database-tab-configuration-invalid" } });

    const { runtime } = start(() => Promise.reject(new Error("edge failed")));
    expect(await runtime.tick([])).toMatchObject({ ok: false, feedback: { code: "database-tab-executor-threw" } });
    expect(runtime.stop()).toEqual({ ok: true, value: null });
    expect(
      runtime.receiveInvalidation({ sourceTabId: "tab-b", databaseNodeId: "browser/global", revision: 1 }),
    ).toMatchObject({ ok: false, feedback: { code: "database-tab-stopped" } });
  });

  test("reports a thrown publication edge after retaining the committed readout", async () => {
    const requestTicks: ZetaDbTickReadout[] = [];
    const outbox = createOutbox();
    const started = startBrowserZetaDbTabRuntime({
      databaseNodeId: "browser/global",
      executorId: "tab-a",
      limits,
      admission: createInMemoryBrowserExecutionAdmission(),
      outbox,
      receiptArchive: createReceiptArchive(),
      execute: (request) => {
        const tick = readout(request, 3);
        requestTicks.push(tick);
        return Promise.resolve({ ok: true, value: tick });
      },
      observe: () => ({ ok: true }),
      observeOutbox: () => ({ ok: true }),
      publishInvalidation: () => {
        throw new Error("channel rejected");
      },
      publishExecutionReceipt: () => ({ ok: true }),
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(
      await started.value.tick([{ eventId: "event/3", rowKey: "row/3", payload: "three", weight: 1 }]),
    ).toMatchObject({ ok: false, feedback: { code: "database-tab-publish-failed" } });
    expect(requestTicks).toHaveLength(1);
    expect(await outbox.read("browser/global")).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 0, settled: 0 },
    });
  });

  test("reports a receipt publication failure after archiving and releasing the local receipt", async () => {
    const outbox = createOutbox();
    const started = startBrowserZetaDbTabRuntime({
      databaseNodeId: "browser/global",
      executorId: "tab-a",
      limits,
      admission: createInMemoryBrowserExecutionAdmission(),
      outbox,
      receiptArchive: createReceiptArchive(),
      execute: (request) => Promise.resolve({ ok: true, value: readout(request, 4) }),
      observe: () => ({ ok: true }),
      observeOutbox: () => ({ ok: true }),
      publishInvalidation: () => ({ ok: true }),
      publishExecutionReceipt: () => {
        throw new Error("receipt channel rejected");
      },
    });
    if (!started.ok) throw new Error(started.feedback.detail);

    expect(
      await started.value.tick([{ eventId: "event/4", rowKey: "row/4", payload: "four", weight: 1 }]),
    ).toMatchObject({ ok: false, feedback: { code: "database-tab-receipt-publish-failed" } });
    expect(await outbox.read("browser/global")).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 0, settled: 0, receipts: [] },
    });
  });

  test("retains a committed receipt when the archive applies typed backpressure", async () => {
    const outbox = createOutbox();
    const archive: BrowserDatabaseReceiptArchivePort = {
      archive: () =>
        Promise.resolve({
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "database-capacity-exhausted",
            detail: "receipt archive is full",
          },
        }),
    };
    const { runtime, observed, receipts } = start(
      (request) => Promise.resolve({ ok: true, value: readout(request, 5) }),
      createInMemoryBrowserExecutionAdmission(),
      "tab-a",
      outbox,
      archive,
    );

    expect(
      await runtime.tick([{ eventId: "event/archive-full", rowKey: "row/5", payload: "five", weight: 1 }]),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-tab-receipt-archive-failed" },
    });
    expect(observed).toHaveLength(1);
    expect(receipts).toEqual([]);
    expect(await outbox.read("browser/global")).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 0, settled: 1, receipts: [{ intentId: "event/archive-full" }] },
    });
  });

  test("replays an archived receipt without re-executing its committed database mutation", async () => {
    const outbox = createOutbox();
    const applicationImage = createInMemoryZetaDbImagePort();
    const archiveImage = createInMemoryZetaDbImagePort();
    const archiveTicks: ZetaDbTickReadout[] = [];
    const createdArchive = createZetaDbBrowserDatabaseReceiptArchive({
      sourceDatabaseNodeId: "browser/global",
      archiveNodeId: "browser/global:receipts",
      executorId: "receipt-archive",
      limits: { maxDeltas: 1, maxEntries: 64, maxCheckpointBytes: 64 * 1024 },
      execute: async (request) => {
        const result = await runZetaDbNodeTick(archiveImage, request);
        if (result.ok) archiveTicks.push(result.value);
        return result;
      },
    });
    if (!createdArchive.ok) throw new Error(createdArchive.feedback.detail);
    let interruptAcknowledgement = true;
    const interruptedOutbox: BrowserDatabaseIntentOutboxPort = {
      ...outbox,
      acknowledgeArchive: (receipt) => {
        if (!interruptAcknowledgement) return outbox.acknowledgeArchive(receipt);
        interruptAcknowledgement = false;
        return Promise.resolve({
          ok: false,
          feedback: { severity: "heat", code: "intent-write-failed", detail: "tab closed before local release" },
        });
      },
    };
    let applicationExecutions = 0;
    const execute = (request: ZetaDbTickRequest) => {
      applicationExecutions += 1;
      return runZetaDbNodeTick(applicationImage, request);
    };
    const first = start(
      execute,
      createInMemoryBrowserExecutionAdmission(),
      "tab-a",
      interruptedOutbox,
      createdArchive.value,
    );

    expect(
      await first.runtime.tick([{ eventId: "event/interrupted", rowKey: "game/score", payload: "8", weight: 1 }]),
    ).toMatchObject({ ok: false, feedback: { code: "database-tab-intent-failed" } });
    expect(await outbox.read("browser/global")).toMatchObject({
      ok: true,
      value: { settled: 1, receipts: [{ intentId: "event/interrupted" }] },
    });

    const replacement = start(
      execute,
      createInMemoryBrowserExecutionAdmission(),
      "tab-b",
      outbox,
      createdArchive.value,
    );
    expect(await replacement.runtime.recoverPending()).toEqual({ ok: true, value: null });
    expect(applicationExecutions).toBe(1);
    expect(archiveTicks.map((tick) => ({ accepted: tick.accepted, duplicates: tick.duplicates }))).toEqual([
      { accepted: 1, duplicates: 0 },
      { accepted: 0, duplicates: 1 },
    ]);
    expect(await replacement.runtime.readOutbox()).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 0, settled: 0, receipts: [] },
    });
  });

  test("backpressures a competing tab and admits it after the finite owner releases", async () => {
    const admission = createInMemoryBrowserExecutionAdmission();
    const outbox = createOutbox();
    let release: (() => void) | undefined;
    const first = start(
      async (request) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { ok: true, value: readout(request, 1) };
      },
      admission,
      "tab-a",
      outbox,
    );
    const second = start(
      (request) => Promise.resolve({ ok: true, value: readout(request, 2) }),
      admission,
      "tab-b",
      outbox,
    );

    const delta = { eventId: "event/held", rowKey: "game/score", payload: "1", weight: 1 } as const;
    const held = first.runtime.tick([delta]);
    for (let attempt = 0; attempt < 100 && release === undefined; attempt += 1) await Promise.resolve();
    expect(release).toBeDefined();
    expect(await second.runtime.tick([delta])).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-tab-execution-backpressured" },
    });

    release?.();
    expect(await held).toMatchObject({ ok: true, value: { executorId: "tab-a", revision: 1 } });
    expect(await second.runtime.tick([{ ...delta, eventId: "event/after" }])).toMatchObject({
      ok: true,
      value: { executorId: "tab-b", revision: 2 },
    });
  });

  test("keeps revision CAS authoritative when an admission adapter admits both tabs", async () => {
    const permissiveAdmission: BrowserExecutionAdmissionPort = {
      tryRun: async (resourceId, operation) => browserExecutionAdmitted(resourceId, await operation()),
    };
    let revision = 0;
    const execute: BrowserZetaDbTabExecutor = async (request) => {
      await Promise.resolve();
      if (request.expectedRevision !== revision) {
        return {
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "database-revision-conflict",
            detail: `Expected revision ${String(request.expectedRevision)} but found ${String(revision)}.`,
          },
        };
      }
      revision += 1;
      return { ok: true, value: readout(request, revision) };
    };
    const first = start(execute, permissiveAdmission, "tab-a");
    const second = start(execute, permissiveAdmission, "tab-b");

    const results = await Promise.all([
      first.runtime.compareAndSwap(0, [{ eventId: "event/a", rowKey: "game/score", payload: "1", weight: 1 }]),
      second.runtime.compareAndSwap(0, [{ eventId: "event/b", rowKey: "game/score", payload: "2", weight: 1 }]),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({
      ok: false,
      feedback: { code: "database-revision-conflict" },
    });
    expect(revision).toBe(1);
  });

  test("persists a mutation before admission and leaves it queued when the database is busy", async () => {
    const outbox = createOutbox();
    const busyAdmission: BrowserExecutionAdmissionPort = {
      tryRun: (resourceId) => Promise.resolve(browserExecutionBusy(resourceId)),
    };
    const { runtime } = start(() => Promise.reject(new Error("must not execute")), busyAdmission, "tab-a", outbox);

    expect(
      await runtime.tick([{ eventId: "event/pending", rowKey: "game/score", payload: "7", weight: 1 }]),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-tab-execution-backpressured" },
    });
    expect(await runtime.readOutbox()).toMatchObject({
      ok: true,
      value: {
        queued: 1,
        executing: 0,
        refused: 0,
        intents: [{ intentId: "event/pending", sequence: 0, status: "queued" }],
      },
    });
  });

  test("lets a replacement runtime recover a thrown mutation exactly once", async () => {
    const outbox = createOutbox();
    const first = start(
      () => Promise.reject(new Error("tab disappeared")),
      createInMemoryBrowserExecutionAdmission(),
      "tab-a",
      outbox,
    );
    const delta = { eventId: "event/recover", rowKey: "game/score", payload: "11", weight: 1 } as const;
    expect(await first.runtime.tick([delta])).toMatchObject({
      ok: false,
      feedback: { code: "database-tab-executor-threw" },
    });

    const image = createInMemoryZetaDbImagePort();
    const second = start(
      (request) => runZetaDbNodeTick(image, request),
      createInMemoryBrowserExecutionAdmission(),
      "tab-b",
      outbox,
    );
    expect(await second.runtime.recoverPending()).toMatchObject({
      ok: true,
      value: { revision: 1, accepted: 1, duplicates: 0 },
    });
    expect(await second.runtime.recoverPending()).toEqual({ ok: true, value: null });
    expect(await second.runtime.tick([])).toMatchObject({
      ok: true,
      value: { revision: 1, rows: [{ rowKey: "game/score", payload: "11", weight: 1 }] },
    });
    expect(await second.runtime.readOutbox()).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 0, settled: 0, refused: 0 },
    });
  });

  test("retains deterministic compare-and-swap refusal without blocking later recovery", async () => {
    const outbox = createOutbox();
    const image = createInMemoryZetaDbImagePort();
    const { runtime } = start(
      (request) => runZetaDbNodeTick(image, request),
      createInMemoryBrowserExecutionAdmission(),
      "tab-a",
      outbox,
    );
    expect(
      await runtime.tick([{ eventId: "event/base", rowKey: "game/score", payload: "1", weight: 1 }]),
    ).toMatchObject({ ok: true, value: { revision: 1 } });

    expect(
      await runtime.compareAndSwap(0, [{ eventId: "event/stale", rowKey: "game/score", payload: "2", weight: 1 }]),
    ).toMatchObject({ ok: false, feedback: { code: "database-revision-conflict" } });
    expect(await runtime.readOutbox()).toMatchObject({
      ok: true,
      value: {
        queued: 0,
        executing: 0,
        settled: 0,
        refused: 1,
        intents: [
          {
            intentId: "event/stale",
            status: "refused",
            refusal: { severity: "backpressure", code: "database-revision-conflict" },
          },
        ],
      },
    });
    expect(await runtime.recoverPending()).toEqual({ ok: true, value: null });
  });
});
