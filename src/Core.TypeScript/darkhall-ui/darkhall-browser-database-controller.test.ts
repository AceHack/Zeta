import { describe, expect, test } from "bun:test";
import type { ZetaDbDelta, ZetaDbTickReadout } from "../zetadb/zeta-db-node";
import { SLOT } from "../observe/grammar-16";
import {
  DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA,
  startDarkHallBrowserDatabaseController,
  type DarkHallBrowserDatabaseControllerReadout,
} from "./darkhall-browser-database-controller";

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
      maxCommandBytes: 1024,
      tick: (deltas) => {
        ticks.push([...deltas]);
        return Promise.resolve({ ok: true, value: tickReadout(deltas) });
      },
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
      maxCommandBytes: 1024,
      tick: (deltas) => {
        ticks.push([...deltas]);
        return Promise.resolve({ ok: true, value: tickReadout(deltas) });
      },
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

  test("refuses invalid and over-budget commands before executing a tick", async () => {
    let tickCount = 0;
    const started = startDarkHallBrowserDatabaseController({
      maxCommandBytes: 80,
      tick: (deltas) => {
        tickCount += 1;
        return Promise.resolve({ ok: true, value: tickReadout(deltas) });
      },
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
      maxCommandBytes: 1024,
      tick: (deltas) => Promise.resolve({ ok: true, value: tickReadout(deltas) }),
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
