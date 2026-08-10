import { describe, expect, test } from "bun:test";
import {
  DARK_HALL_BROWSER_DATABASE_ROW_SELECTION_SCHEMA,
  startDarkHallBrowserDatabaseRowSelection,
  type DarkHallBrowserDatabaseRowSelectionReadout,
} from "./darkhall-browser-database-row-selection";
import type { DarkHallDatabaseRow } from "./darkhall-database-readout";

type NativeListener = (event: unknown) => void;

class NativePointerTarget {
  readonly listeners = new Map<string, Set<NativeListener>>();

  addEventListener(type: string, listener: NativeListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(event: unknown): void {
    for (const listener of this.listeners.get("click") ?? []) listener(event);
  }
}

class NativeRowControl {
  private readonly rowKey: string;

  constructor(rowKey: string) {
    this.rowKey = rowKey;
  }

  closest(selector: string): NativeRowControl | null {
    return selector === "[data-database-row-select]" ? this : null;
  }

  getAttribute(name: string): string | null {
    return name === "data-row-key" ? this.rowKey : null;
  }
}

const scoreRow: DarkHallDatabaseRow = { rowKey: "game/score", payload: "9000", weight: 2 };

describe("Dark Hall browser database row selection", () => {
  test("resolves pointer and keyboard activation through typed row state", () => {
    const pointerTarget = new NativePointerTarget();
    const loaded: DarkHallDatabaseRow[] = [];
    const readouts: DarkHallBrowserDatabaseRowSelectionReadout[] = [];
    let prevented = 0;
    const started = startDarkHallBrowserDatabaseRowSelection({
      pointerTarget,
      resolveRow: (rowKey) => (rowKey === scoreRow.rowKey ? scoreRow : null),
      loadRow: (row) => {
        loaded.push(row);
        return { ok: true };
      },
      observe: (readout) => {
        readouts.push(readout);
        return { ok: true };
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.read()).toEqual({
      schema: DARK_HALL_BROWSER_DATABASE_ROW_SELECTION_SCHEMA,
      status: "live",
      selected: 0,
      refused: 0,
      backpressured: 0,
      selectedRowKey: null,
      last: null,
    });

    pointerTarget.emit({
      button: 0,
      detail: 1,
      target: new NativeRowControl("game/score"),
      preventDefault: () => {
        prevented += 1;
      },
    });
    expect(loaded).toEqual([scoreRow]);
    expect(loaded[0]).not.toBe(scoreRow);
    expect(prevented).toBe(1);
    expect(started.value.read()).toMatchObject({
      selected: 1,
      selectedRowKey: "game/score",
      last: { source: "pointer", rowKey: "game/score", outcome: "selected", feedbackCode: null },
    });

    pointerTarget.emit({ button: 0, detail: 0, target: new NativeRowControl("game/score") });
    expect(started.value.read()).toMatchObject({
      selected: 2,
      last: { source: "keyboard", outcome: "selected" },
    });
    expect(readouts.at(-1)).toEqual(started.value.read());

    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
    expect(pointerTarget.listeners.get("click")?.size ?? 0).toBe(0);
    expect(started.value.select("game/score", "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "database-row-selection-stopped" },
    });
  });

  test("types missing rows and editor backpressure without inventing row data", () => {
    const pointerTarget = new NativePointerTarget();
    const started = startDarkHallBrowserDatabaseRowSelection({
      pointerTarget,
      resolveRow: (rowKey) => (rowKey === scoreRow.rowKey ? scoreRow : null),
      loadRow: () => ({
        ok: false,
        feedback: {
          severity: "backpressure",
          code: "row-command-payload-too-large",
          detail: "payload exceeds the room budget",
        },
      }),
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.select("missing", "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "database-row-selection-row-unavailable" },
    });
    expect(started.value.select("game/score", "keyboard")).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "database-row-selection-load-failed" },
    });
    expect(started.value.select("game\nscore", "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "database-row-selection-key-invalid" },
    });
    expect(started.value.read()).toMatchObject({
      selected: 0,
      refused: 2,
      backpressured: 1,
      selectedRowKey: null,
      last: { rowKey: "game\nscore", outcome: "refused" },
    });
  });

  test("types invalid targets, resolver failure, and observer refusal", () => {
    expect(
      startDarkHallBrowserDatabaseRowSelection({
        pointerTarget: {},
        resolveRow: () => null,
        loadRow: () => ({ ok: true }),
        observe: () => ({ ok: true }),
      }),
    ).toMatchObject({
      ok: false,
      feedback: { code: "database-row-selection-configuration-invalid" },
    });

    const resolverFailure = startDarkHallBrowserDatabaseRowSelection({
      pointerTarget: new NativePointerTarget(),
      resolveRow: () => {
        throw new Error("resolver failure");
      },
      loadRow: () => ({ ok: true }),
      observe: () => ({ ok: true }),
    });
    expect(resolverFailure.ok).toBe(true);
    if (resolverFailure.ok) {
      expect(resolverFailure.value.select("game/score", "pointer")).toMatchObject({
        ok: false,
        feedback: { code: "database-row-selection-row-unavailable" },
      });
    }

    expect(
      startDarkHallBrowserDatabaseRowSelection({
        pointerTarget: new NativePointerTarget(),
        resolveRow: () => scoreRow,
        loadRow: () => ({ ok: true }),
        observe: () => ({
          ok: false,
          feedback: { severity: "heat", code: "test-observer-refused", detail: "refused" },
        }),
      }),
    ).toMatchObject({
      ok: false,
      feedback: { code: "database-row-selection-observer-failed" },
    });
  });
});
