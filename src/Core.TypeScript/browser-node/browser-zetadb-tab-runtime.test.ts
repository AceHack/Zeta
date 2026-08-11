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
  type BrowserDatabaseIntentOutboxPort,
} from "./browser-database-intent-outbox";
import { startBrowserZetaDbTabRuntime, type BrowserZetaDbTabExecutor } from "./browser-zetadb-tab-runtime";

const limits = { maxDeltas: 8, maxEntries: 16, maxCheckpointBytes: 16 * 1024 };
const outboxLimits = { maxIntents: 16, maxLedgerBytes: 64 * 1024 };

function createOutbox(): BrowserDatabaseIntentOutboxPort {
  const created = createInMemoryBrowserDatabaseIntentOutbox(outboxLimits);
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
) {
  const observed: ZetaDbTickReadout[] = [];
  const published: { readonly databaseNodeId: string; readonly revision: number }[] = [];
  const started = startBrowserZetaDbTabRuntime({
    databaseNodeId: "browser/global",
    executorId,
    limits,
    admission,
    outbox,
    execute,
    observe: (value) => {
      observed.push(value);
      return { ok: true };
    },
    observeOutbox: () => ({ ok: true }),
    publishInvalidation: (databaseNodeId, revision) => {
      published.push({ databaseNodeId, revision });
      return { ok: true };
    },
  });
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error(started.feedback.detail);
  return { runtime: started.value, observed, published };
}

describe("browser ZetaDB tab runtime", () => {
  test("rejects a missing execution admission port as typed configuration feedback", () => {
    const started = startBrowserZetaDbTabRuntime({
      databaseNodeId: "database-a",
      executorId: "tab-a",
      limits,
      admission: undefined as never,
      outbox: createOutbox(),
      execute: () =>
        Promise.resolve({
          ok: false,
          feedback: { severity: "heat", code: "database-read-failed", detail: "unused" },
        }),
      observe: () => ({ ok: true }),
      observeOutbox: () => ({ ok: true }),
      publishInvalidation: () => ({ ok: true }),
    });

    expect(started).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "database-tab-configuration-invalid",
        detail:
          "A browser database tab runtime requires identifiers, positive safe-integer tick budgets, admission, and an intent outbox.",
      },
    });
  });

  test("publishes accepted local writes and renders their finite tick", async () => {
    const requests: ZetaDbTickRequest[] = [];
    const { runtime, observed, published } = start((request) => {
      requests.push(request);
      return Promise.resolve({ ok: true, value: readout(request, 1) });
    });

    const result = await runtime.tick([{ eventId: "score-9000", rowKey: "game/score", payload: "9000", weight: 1 }]);

    expect(result).toMatchObject({ ok: true, value: { revision: 1, accepted: 1 } });
    expect(requests[0]).toMatchObject({ nodeId: "browser/global", executorId: "tab-a", executorKind: "browser-tab" });
    expect(observed).toHaveLength(1);
    expect(published).toEqual([{ databaseNodeId: "browser/global", revision: 1 }]);
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
        execute: () => Promise.resolve({ ok: true, value: {} as never }),
        observe: () => ({ ok: true }),
        observeOutbox: () => ({ ok: true }),
        publishInvalidation: () => ({ ok: true }),
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
    const started = startBrowserZetaDbTabRuntime({
      databaseNodeId: "browser/global",
      executorId: "tab-a",
      limits,
      admission: createInMemoryBrowserExecutionAdmission(),
      outbox: createOutbox(),
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
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(
      await started.value.tick([{ eventId: "event/3", rowKey: "row/3", payload: "three", weight: 1 }]),
    ).toMatchObject({ ok: false, feedback: { code: "database-tab-publish-failed" } });
    expect(requestTicks).toHaveLength(1);
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
    expect(await second.runtime.tick([delta])).toMatchObject({
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

  test("persists a mutation before admission and leaves it pending when the database is busy", async () => {
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
      value: { pending: 1, refused: 0, intents: [{ intentId: "event/pending", sequence: 0, status: "pending" }] },
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
    expect(await second.runtime.readOutbox()).toMatchObject({ ok: true, value: { pending: 0, refused: 0 } });
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
        pending: 0,
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
