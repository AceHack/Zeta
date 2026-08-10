import { describe, expect, test } from "bun:test";
import type { ZetaDbTickReadout, ZetaDbTickRequest } from "../zetadb/zeta-db-node";
import { startBrowserZetaDbTabRuntime } from "./browser-zetadb-tab-runtime";

const limits = { maxDeltas: 8, maxEntries: 16, maxCheckpointBytes: 16 * 1024 };

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
  execute: (request: ZetaDbTickRequest) => Promise<{ readonly ok: true; readonly value: ZetaDbTickReadout }>,
) {
  const observed: ZetaDbTickReadout[] = [];
  const published: { readonly databaseNodeId: string; readonly revision: number }[] = [];
  const started = startBrowserZetaDbTabRuntime({
    databaseNodeId: "browser/global",
    executorId: "tab-a",
    limits,
    execute,
    observe: (value) => {
      observed.push(value);
      return { ok: true };
    },
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
        execute: () => Promise.resolve({ ok: true, value: {} as never }),
        observe: () => ({ ok: true }),
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
      execute: (request) => {
        const tick = readout(request, 3);
        requestTicks.push(tick);
        return Promise.resolve({ ok: true, value: tick });
      },
      observe: () => ({ ok: true }),
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
});
