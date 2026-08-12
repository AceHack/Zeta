import { describe, expect, test } from "bun:test";
import { createInMemoryBrowserExecutionAdmission } from "../browser-node/browser-execution-admission";
import { createInMemoryBrowserDatabaseIntentOutbox } from "../browser-node/browser-database-intent-outbox";
import {
  createInMemoryZetaDbImagePort,
  runZetaDbNodeTick,
  type ZetaDbDelta,
  type ZetaDbTickReadout,
} from "../zetadb/zeta-db-node";
import { SLOT } from "../observe/grammar-16";
import { startBrowserZetaDbTabRuntime } from "../browser-node/browser-zetadb-tab-runtime";
import {
  DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA,
  startDarkHallBrowserDatabaseController,
  type DarkHallBrowserDatabaseControllerReadout,
} from "./darkhall-browser-database-controller";
import {
  DARK_HALL_DATABASE_ROW_SELECTION_TOKEN_SCHEMA,
  selectDarkHallDatabaseRow,
  zetaDbTickToDarkHallDatabaseReadout,
} from "./darkhall-database-readout";

function tickReadout(deltas: readonly ZetaDbDelta[]): ZetaDbTickReadout {
  return {
    schema: "zeta.db.tick.v1",
    nodeId: "database-a",
    executorId: "tab-a",
    executorKind: "browser-tab",
    revision: deltas.length,
    admission: "complete",
    accepted: deltas.length,
    duplicates: 0,
    nextDeltaIndex: deltas.length,
    rows: deltas.map((delta) => ({ rowKey: delta.rowKey, payload: delta.payload, weight: delta.weight })),
    feedback: [],
  };
}

describe("Dark Hall browser database controller", () => {
  test("maps inspect and refresh to canonical read-only controller slots", async () => {
    const ticks: ZetaDbDelta[][] = [];
    const observed: DarkHallBrowserDatabaseControllerReadout[] = [];
    const started = startDarkHallBrowserDatabaseController({
      databaseNodeId: "database-a",
      maxCommandBytes: 1024,
      tick: (deltas) => {
        ticks.push([...deltas]);
        return Promise.resolve({ ok: true, value: tickReadout(deltas) });
      },
      compareAndSwap: (_expectedRevision, deltas) => Promise.resolve({ ok: true, value: tickReadout(deltas) }),
      observe: (readout) => {
        observed.push(readout);
        return { ok: true };
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(await started.value.dispatch({ kind: "inspect" })).toMatchObject({
      ok: true,
      value: {
        schema: DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA,
        kind: "inspect",
        cell: SLOT.INSPECT,
        actionId: "darkhall.database.inspect",
        deltaCount: 0,
        signedWeight: 0,
      },
    });
    expect(await started.value.dispatch({ kind: "refresh" })).toMatchObject({
      ok: true,
      value: { kind: "refresh", cell: SLOT.REFRESH, actionId: "darkhall.database.refresh" },
    });
    expect(ticks).toEqual([[], []]);
    expect(observed).toHaveLength(2);
  });

  test("owns positive emit and negative retract signs", async () => {
    const ticks: ZetaDbDelta[][] = [];
    const started = startDarkHallBrowserDatabaseController({
      databaseNodeId: "database-a",
      maxCommandBytes: 1024,
      tick: (deltas) => {
        ticks.push([...deltas]);
        return Promise.resolve({ ok: true, value: tickReadout(deltas) });
      },
      compareAndSwap: (_expectedRevision, deltas) => Promise.resolve({ ok: true, value: tickReadout(deltas) }),
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(await started.value.dispatch({ kind: "unknown" } as never)).toMatchObject({
      ok: false,
      feedback: { code: "database-controller-command-invalid" },
    });
    expect(
      await started.value.dispatch({
        kind: "emit",
        eventId: "event-plus",
        rowKey: "game/score",
        payload: "9000",
        magnitude: 3,
      }),
    ).toMatchObject({ ok: true, value: { cell: SLOT.ACCEPT, deltaCount: 1, signedWeight: 3 } });
    expect(
      await started.value.dispatch({
        kind: "retract",
        eventId: "event-minus",
        rowKey: "game/score",
        payload: "9000",
        magnitude: 2,
      }),
    ).toMatchObject({ ok: true, value: { cell: SLOT.UNDO_RETRACT, deltaCount: 1, signedWeight: -2 } });
    expect(ticks).toEqual([
      [{ eventId: "event-plus", rowKey: "game/score", payload: "9000", weight: 3 }],
      [{ eventId: "event-minus", rowKey: "game/score", payload: "9000", weight: -2 }],
    ]);
  });

  test("atomically replaces the selected signed row through compare-and-swap", async () => {
    const swaps: { readonly revision: number; readonly deltas: readonly ZetaDbDelta[] }[] = [];
    const started = startDarkHallBrowserDatabaseController({
      databaseNodeId: "database-a",
      maxCommandBytes: 1024,
      tick: (deltas) => Promise.resolve({ ok: true, value: tickReadout(deltas) }),
      compareAndSwap: (revision, deltas) => {
        swaps.push({ revision, deltas: [...deltas] });
        return Promise.resolve({ ok: true, value: { ...tickReadout(deltas), revision: revision + 1 } });
      },
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(
      await started.value.dispatch({
        kind: "replace",
        expected: {
          schema: DARK_HALL_DATABASE_ROW_SELECTION_TOKEN_SCHEMA,
          nodeId: "database-a",
          revision: 7,
          row: { rowKey: "game/score", payload: "9000", weight: -3 },
        },
        retractEventId: "replace/retract",
        emitEventId: "replace/emit",
        rowKey: "game/score",
        payload: "9001",
        magnitude: 2,
      }),
    ).toMatchObject({
      ok: true,
      value: { kind: "replace", cell: SLOT.EDIT_GRAMMAR, deltaCount: 2, signedWeight: 1 },
    });
    expect(swaps).toEqual([
      {
        revision: 7,
        deltas: [
          { eventId: "replace/retract", rowKey: "game/score", payload: "9000", weight: 3 },
          { eventId: "replace/emit", rowKey: "game/score", payload: "9001", weight: -2 },
        ],
      },
    ]);
  });

  test("backpressures stale replacement without a partial retraction", async () => {
    const port = createInMemoryZetaDbImagePort();
    const outbox = createInMemoryBrowserDatabaseIntentOutbox({
      maxIntents: 16,
      maxReceipts: 64,
      maxLedgerBytes: 64 * 1024,
    });
    expect(outbox.ok).toBe(true);
    if (!outbox.ok) return;
    const runtimeStarted = startBrowserZetaDbTabRuntime({
      databaseNodeId: "database-a",
      executorId: "tab-a",
      limits: { maxDeltas: 8, maxEntries: 32, maxCheckpointBytes: 32 * 1024 },
      admission: createInMemoryBrowserExecutionAdmission(),
      outbox: outbox.value,
      execute: (request) => runZetaDbNodeTick(port, request),
      observe: () => ({ ok: true }),
      observeOutbox: () => ({ ok: true }),
      publishInvalidation: () => ({ ok: true }),
      publishExecutionReceipt: () => ({ ok: true }),
    });
    expect(runtimeStarted.ok).toBe(true);
    if (!runtimeStarted.ok) return;
    const runtime = runtimeStarted.value;
    const controllerStarted = startDarkHallBrowserDatabaseController({
      databaseNodeId: "database-a",
      maxCommandBytes: 1024,
      tick: (deltas) => runtime.tick(deltas),
      compareAndSwap: (revision, deltas) => runtime.compareAndSwap(revision, deltas),
      observe: () => ({ ok: true }),
    });
    expect(controllerStarted.ok).toBe(true);
    if (!controllerStarted.ok) return;
    const controller = controllerStarted.value;

    const inserted = await controller.dispatch({
      kind: "emit",
      eventId: "score/original",
      rowKey: "game/score",
      payload: "9000",
    });
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    const staleSelection = selectDarkHallDatabaseRow(inserted.value.database, "game/score");
    expect(staleSelection).not.toBeNull();
    if (staleSelection === null) return;

    await runtime.tick([{ eventId: "other/write", rowKey: "game/level", payload: "2", weight: 1 }]);
    const stale = await controller.dispatch({
      kind: "replace",
      expected: staleSelection,
      retractEventId: "score/stale/retract",
      emitEventId: "score/stale/emit",
      rowKey: "game/score",
      payload: "9001",
    });
    expect(stale).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-revision-conflict" },
    });

    const unchanged = await runtime.tick([]);
    expect(unchanged.ok && unchanged.value.rows).toContainEqual({ rowKey: "game/score", payload: "9000", weight: 1 });
    if (!unchanged.ok) return;
    const freshSelection = selectDarkHallDatabaseRow(
      zetaDbTickToDarkHallDatabaseReadout(unchanged.value),
      "game/score",
    );
    expect(freshSelection).not.toBeNull();
    if (freshSelection === null) return;
    const replaced = await controller.dispatch({
      kind: "replace",
      expected: freshSelection,
      retractEventId: "score/fresh/retract",
      emitEventId: "score/fresh/emit",
      rowKey: "game/score",
      payload: "9001",
    });
    expect(replaced.ok && replaced.value.database.rows).toContainEqual({
      rowKey: "game/score",
      payload: "9001",
      weight: 1,
    });
  });

  test("refuses invalid and over-budget commands before executing a tick", async () => {
    let tickCount = 0;
    const started = startDarkHallBrowserDatabaseController({
      databaseNodeId: "database-a",
      maxCommandBytes: 80,
      tick: (deltas) => {
        tickCount += 1;
        return Promise.resolve({ ok: true, value: tickReadout(deltas) });
      },
      compareAndSwap: (_expectedRevision, deltas) => Promise.resolve({ ok: true, value: tickReadout(deltas) }),
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(
      await started.value.dispatch({
        kind: "emit",
        eventId: "event-a",
        rowKey: "game/score",
        payload: "9000",
        magnitude: 0,
      }),
    ).toMatchObject({ ok: false, feedback: { code: "database-controller-command-invalid" } });
    expect(
      await started.value.dispatch({
        kind: "emit",
        eventId: "event-b",
        rowKey: "game/score",
        payload: "x".repeat(256),
      }),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-controller-command-too-large" },
    });
    expect(tickCount).toBe(0);
  });

  test("reports observer failure and refuses dispatch after stop", async () => {
    const started = startDarkHallBrowserDatabaseController({
      databaseNodeId: "database-a",
      maxCommandBytes: 1024,
      tick: (deltas) => Promise.resolve({ ok: true, value: tickReadout(deltas) }),
      compareAndSwap: (_expectedRevision, deltas) => Promise.resolve({ ok: true, value: tickReadout(deltas) }),
      observe: () => ({
        ok: false,
        feedback: { severity: "heat", code: "render-failed", detail: "mount rejected readout" },
      }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(await started.value.dispatch({ kind: "inspect" })).toMatchObject({
      ok: false,
      feedback: { code: "database-controller-observer-failed" },
    });
    expect(started.value.stop()).toEqual({ ok: true, value: null });
    expect(await started.value.dispatch({ kind: "refresh" })).toMatchObject({
      ok: false,
      feedback: { code: "database-controller-stopped" },
    });
  });
});
