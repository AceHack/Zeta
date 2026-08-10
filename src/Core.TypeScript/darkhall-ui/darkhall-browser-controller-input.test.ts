import { describe, expect, test } from "bun:test";
import { SLOT } from "../observe/grammar-16";
import {
  DARK_HALL_BROWSER_DATABASE_ACTIONS,
  DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA,
  type DarkHallBrowserDatabaseCommand,
  type DarkHallBrowserDatabaseControllerReadout,
} from "./darkhall-browser-database-controller";
import {
  DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA,
  startDarkHallBrowserControllerInput,
  type DarkHallBrowserControllerInputReadout,
} from "./darkhall-browser-controller-input";

type NativeListener = (event: unknown) => void;

class NativeEventTarget {
  readonly listeners = new Map<string, Set<NativeListener>>();

  addEventListener(type: string, listener: NativeListener): void {
    const entries = this.listeners.get(type) ?? new Set();
    entries.add(listener);
    this.listeners.set(type, entries);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  count(): number {
    return [...this.listeners.values()].reduce((total, entries) => total + entries.size, 0);
  }
}

class NativeCell {
  readonly cell: number;

  constructor(cell: number) {
    this.cell = cell;
  }

  closest(selector: string): NativeCell | null {
    return selector === "[data-controller-cell]" ? this : null;
  }

  getAttribute(name: string): string | null {
    return name === "data-controller-cell" ? this.cell.toString() : null;
  }
}

function controllerReadout(command: DarkHallBrowserDatabaseCommand): DarkHallBrowserDatabaseControllerReadout {
  const action = DARK_HALL_BROWSER_DATABASE_ACTIONS.find((candidate) => candidate.kind === command.kind);
  if (action === undefined) throw new Error(`Missing action for ${command.kind}.`);
  const magnitude = "magnitude" in command ? (command.magnitude ?? 1) : 0;
  return {
    schema: DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA,
    kind: command.kind,
    cell: action.cell,
    actionId: action.actionId,
    deltaCount: command.kind === "emit" || command.kind === "retract" ? 1 : 0,
    signedWeight: command.kind === "emit" ? magnitude : command.kind === "retract" ? -magnitude : 0,
    database: {
      schema: "zeta.darkhall.database-readout.v1",
      sourceSchema: "zeta.db.tick.v1",
      nodeId: "room-db",
      executorId: "tab-a",
      executorKind: "browser-tab",
      revision: 1,
      admission: "complete",
      accepted: 1,
      duplicates: 0,
      nextDeltaIndex: 1,
      rows: [],
      feedback: [],
    },
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for browser controller input.");
}

describe("Dark Hall browser controller input", () => {
  test("routes pointer activation and hexadecimal keyboard cells through semantic commands", async () => {
    const pointer = new NativeEventTarget();
    const keyboard = new NativeEventTarget();
    const commands: DarkHallBrowserDatabaseCommand[] = [];
    const readouts: DarkHallBrowserControllerInputReadout[] = [];
    let pointerPrevented = false;
    let keyboardPrevented = false;
    const started = startDarkHallBrowserControllerInput({
      pointerTarget: pointer,
      keyboardTarget: keyboard,
      maxInFlight: 1,
      resolveCommand: (action) =>
        action.kind === "emit" || action.kind === "retract"
          ? {
              ok: true,
              value: {
                kind: action.kind,
                eventId: `${action.kind}-event`,
                rowKey: "game/score",
                payload: "9000",
              },
            }
          : action.kind === "replace"
            ? {
                ok: true,
                value: {
                  kind: "replace",
                  expected: {
                    schema: "zeta.darkhall.database-row-selection-token.v1",
                    nodeId: "room-db",
                    revision: 1,
                    row: { rowKey: "game/score", payload: "9000", weight: 1 },
                  },
                  retractEventId: "replace-retract",
                  emitEventId: "replace-emit",
                  rowKey: "game/score",
                  payload: "9001",
                },
              }
            : { ok: true, value: { kind: action.kind } },
      dispatch: (command) => {
        commands.push(command);
        return Promise.resolve({ ok: true, value: controllerReadout(command) });
      },
      observe: (readout) => {
        readouts.push(readout);
        return { ok: true };
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    pointer.emit("click", {
      button: 0,
      detail: 1,
      target: new NativeCell(SLOT.ACCEPT),
      preventDefault: () => {
        pointerPrevented = true;
      },
    });
    await waitFor(() => started.value.read().accepted === 1);
    keyboard.emit("keydown", {
      code: "KeyC",
      target: { tagName: "DIV" },
      preventDefault: () => {
        keyboardPrevented = true;
      },
    });
    await waitFor(() => started.value.read().accepted === 2);

    expect(commands).toEqual([
      { kind: "emit", eventId: "emit-event", rowKey: "game/score", payload: "9000" },
      { kind: "refresh" },
    ]);
    expect(started.value.read()).toMatchObject({
      schema: DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA,
      accepted: 2,
      refused: 0,
      backpressured: 0,
      last: { source: "keyboard", cell: SLOT.REFRESH, actionId: "darkhall.database.refresh", outcome: "accepted" },
    });
    expect(pointerPrevented).toBe(true);
    expect(keyboardPrevented).toBe(true);
    expect(readouts.at(-1)).toEqual(started.value.read());
  });

  test("keeps row-changing actions cold until an explicit command resolver supplies data", async () => {
    const target = new NativeEventTarget();
    const commands: DarkHallBrowserDatabaseCommand[] = [];
    const started = startDarkHallBrowserControllerInput({
      pointerTarget: target,
      keyboardTarget: target,
      maxInFlight: 1,
      dispatch: (command) => {
        commands.push(command);
        return Promise.resolve({ ok: true, value: controllerReadout(command) });
      },
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(await started.value.dispatchCell(SLOT.ACCEPT, "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "controller-input-command-unavailable" },
    });
    expect(await started.value.dispatchCell(SLOT.INSPECT, "keyboard")).toMatchObject({
      ok: true,
      value: { accepted: 1, refused: 1 },
    });
    expect(commands).toEqual([{ kind: "inspect" }]);
  });

  test("backpressures a second gesture while the finite dispatch budget is occupied", async () => {
    const target = new NativeEventTarget();
    let release: (() => void) | undefined;
    const started = startDarkHallBrowserControllerInput({
      pointerTarget: target,
      keyboardTarget: target,
      maxInFlight: 1,
      dispatch: (command) =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, value: controllerReadout(command) });
        }),
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const first = started.value.dispatchCell(SLOT.INSPECT, "pointer");
    await waitFor(() => release !== undefined);
    expect(await started.value.dispatchCell(SLOT.REFRESH, "keyboard")).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "controller-input-busy" },
    });
    expect(started.value.stop()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "controller-input-busy" },
    });
    release?.();
    expect(await first).toMatchObject({ ok: true, value: { accepted: 1, backpressured: 1, inFlight: 0 } });
    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
  });

  test("refuses a resolver that changes the fixed cell's semantic command", async () => {
    const target = new NativeEventTarget();
    let dispatched = 0;
    const started = startDarkHallBrowserControllerInput({
      pointerTarget: target,
      keyboardTarget: target,
      maxInFlight: 1,
      resolveCommand: () => ({ ok: true, value: { kind: "refresh" } }),
      dispatch: (command) => {
        dispatched += 1;
        return Promise.resolve({ ok: true, value: controllerReadout(command) });
      },
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(await started.value.dispatchCell(SLOT.INSPECT, "keyboard")).toMatchObject({
      ok: false,
      feedback: { code: "controller-input-command-mismatch" },
    });
    expect(await started.value.dispatchCell(SLOT.INSPECT, "gamepad" as "keyboard")).toMatchObject({
      ok: false,
      feedback: { code: "controller-input-source-invalid" },
    });
    expect(dispatched).toBe(0);
  });

  test("does not intercept editing, modifiers, repeats, or events after cleanup", async () => {
    const pointer = new NativeEventTarget();
    const keyboard = new NativeEventTarget();
    let dispatched = 0;
    const started = startDarkHallBrowserControllerInput({
      pointerTarget: pointer,
      keyboardTarget: keyboard,
      maxInFlight: 1,
      dispatch: (command) => {
        dispatched += 1;
        return Promise.resolve({ ok: true, value: controllerReadout(command) });
      },
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    keyboard.emit("keydown", { code: "Digit6", target: { tagName: "INPUT" } });
    keyboard.emit("keydown", { code: "Digit6", target: { tagName: "DIV" }, metaKey: true });
    keyboard.emit("keydown", { code: "Digit6", target: { tagName: "DIV" }, repeat: true });
    keyboard.emit("keydown", { code: "Enter", target: { tagName: "DIV" } });
    pointer.emit("click", { button: 1, detail: 1, target: new NativeCell(SLOT.INSPECT) });
    await Promise.resolve();
    expect(dispatched).toBe(0);
    expect(pointer.count()).toBe(1);
    expect(keyboard.count()).toBe(1);

    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
    expect(pointer.count()).toBe(0);
    expect(keyboard.count()).toBe(0);
    keyboard.emit("keydown", { code: "Digit6", target: { tagName: "DIV" } });
    await Promise.resolve();
    expect(dispatched).toBe(0);
  });
});
