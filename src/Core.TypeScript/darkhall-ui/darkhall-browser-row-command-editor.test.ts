import { describe, expect, test } from "bun:test";
import { SLOT } from "../observe/grammar-16";
import { DARK_HALL_BROWSER_DATABASE_ACTIONS } from "./darkhall-browser-database-controller";
import {
  DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_MOUNT_ID,
  DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA,
  renderDarkHallBrowserRowCommandEditorHtml,
  startDarkHallBrowserRowCommandEditor,
  type DarkHallBrowserRowCommandEditorReadout,
} from "./darkhall-browser-row-command-editor";

type NativeListener = (event: unknown) => void;

class NativeField {
  value: string;
  textContent = "";

  constructor(value: string) {
    this.value = value;
  }
}

class NativeEditorMount {
  readonly rowKey = new NativeField("");
  readonly payload = new NativeField("");
  readonly magnitude = new NativeField("1");
  readonly status = new NativeField("");
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<NativeListener>>();

  querySelector(selector: string): NativeField | null {
    if (selector === "[data-row-command-key]") return this.rowKey;
    if (selector === "[data-row-command-payload]") return this.payload;
    if (selector === "[data-row-command-magnitude]") return this.magnitude;
    if (selector === "[data-row-command-status]") return this.status;
    return null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: NativeListener): void {
    const entries = this.listeners.get(type) ?? new Set();
    entries.add(listener);
    this.listeners.set(type, entries);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ type });
  }
}

function action(kind: "emit" | "inspect" | "retract" | "refresh") {
  const selected = DARK_HALL_BROWSER_DATABASE_ACTIONS.find((candidate) => candidate.kind === kind);
  if (selected === undefined) throw new Error(`Missing ${kind} action.`);
  return selected;
}

describe("Dark Hall browser row command editor", () => {
  test("renders stable accessible fields outside the replaceable room transcript", () => {
    const html = renderDarkHallBrowserRowCommandEditorHtml();

    expect(html).toContain(`id="${DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_MOUNT_ID}"`);
    expect(html).toContain(`data-row-command-editor="${DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA}"`);
    expect(html).toContain('data-row-command-key maxlength="1024"');
    expect(html).toContain("data-row-command-payload");
    expect(html).toContain('data-row-command-magnitude min="1" step="1" value="1"');
    expect(html).toContain('data-row-command-status aria-live="polite"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<form");
  });

  test("resolves explicit editor state into unique semantic emit and retract commands", () => {
    const mount = new NativeEditorMount();
    const readouts: DarkHallBrowserRowCommandEditorReadout[] = [];
    const started = startDarkHallBrowserRowCommandEditor({
      mount,
      eventIdPrefix: "tab-a",
      maxPayloadBytes: 1024,
      observe: (readout) => {
        readouts.push(readout);
        return { ok: true };
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.read()).toMatchObject({
      schema: DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA,
      status: "live",
      validity: "incomplete",
      feedbackCode: "row-command-key-required",
    });

    mount.rowKey.value = "game/score";
    mount.payload.value = "9000";
    mount.magnitude.value = "3";
    mount.emit("input");
    expect(started.value.read()).toMatchObject({
      validity: "ready",
      rowKey: "game/score",
      payloadBytes: 4,
      magnitude: 3,
    });

    expect(started.value.resolve(action("emit"), "pointer")).toEqual({
      ok: true,
      value: {
        kind: "emit",
        eventId: "tab-a/row-command/0",
        rowKey: "game/score",
        payload: "9000",
        magnitude: 3,
      },
    });
    expect(started.value.resolve(action("retract"), "keyboard")).toEqual({
      ok: true,
      value: {
        kind: "retract",
        eventId: "tab-a/row-command/1",
        rowKey: "game/score",
        payload: "9000",
        magnitude: 3,
      },
    });
    expect(started.value.resolve(action("inspect"), "pointer")).toEqual({ ok: true, value: { kind: "inspect" } });
    expect(started.value.read()).toMatchObject({
      resolved: 2,
      refused: 0,
      backpressured: 0,
      nextEventSequence: 2,
      last: {
        source: "keyboard",
        kind: "retract",
        eventId: "tab-a/row-command/1",
        outcome: "resolved",
      },
    });
    expect(mount.attributes.get("data-row-command-validity")).toBe("ready");
    expect(mount.attributes.get("data-row-command-resolved")).toBe("2");
    expect(mount.status.textContent).toBe("ready | 4 bytes");
    expect(readouts.at(-1)).toEqual(started.value.read());

    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
    expect(mount.listeners.get("input")?.size ?? 0).toBe(0);
    expect(mount.attributes.get("data-row-command-status")).toBe("stopped");
    expect(started.value.resolve(action("emit"), "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "row-command-editor-stopped" },
    });
  });

  test("reports missing, malformed, and over-budget fields without constructing a command", () => {
    const mount = new NativeEditorMount();
    const started = startDarkHallBrowserRowCommandEditor({
      mount,
      eventIdPrefix: "tab-a",
      maxPayloadBytes: 4,
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.resolve(action("emit"), "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "row-command-key-required" },
    });

    mount.rowKey.value = "game\nscore";
    expect(started.value.resolve(action("emit"), "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "row-command-key-invalid" },
    });

    mount.rowKey.value = "game/score";
    mount.magnitude.value = "0";
    expect(started.value.resolve(action("emit"), "pointer")).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "row-command-magnitude-invalid" },
    });

    mount.magnitude.value = "1";
    mount.payload.value = "12345";
    expect(started.value.resolve(action("retract"), "keyboard")).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "row-command-payload-too-large" },
    });
    expect(started.value.read()).toMatchObject({
      validity: "backpressured",
      resolved: 0,
      refused: 3,
      backpressured: 1,
      nextEventSequence: 0,
      last: {
        kind: "retract",
        eventId: null,
        outcome: "backpressured",
        feedbackCode: "row-command-payload-too-large",
      },
    });
  });

  test("loads a materialized row without advancing the command sequence", () => {
    const mount = new NativeEditorMount();
    const started = startDarkHallBrowserRowCommandEditor({
      mount,
      eventIdPrefix: "tab-a",
      maxPayloadBytes: 4,
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.load({ rowKey: "game/score", payload: "9000", weight: -3 })).toMatchObject({
      ok: true,
      value: {
        validity: "ready",
        rowKey: "game/score",
        magnitude: 3,
        loaded: 1,
        loadedRowKey: "game/score",
        nextEventSequence: 0,
        resolved: 0,
      },
    });
    expect(mount.rowKey.value).toBe("game/score");
    expect(mount.payload.value).toBe("9000");
    expect(mount.magnitude.value).toBe("3");
    expect(mount.attributes.get("data-row-command-loaded")).toBe("1");
    expect(mount.attributes.get("data-row-command-loaded-key")).toBe("game/score");

    expect(started.value.load({ rowKey: "game/score", payload: "12345", weight: 1 })).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "row-command-payload-too-large" },
    });
    expect(started.value.load({ rowKey: "game/score", payload: "9000", weight: 0 })).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "row-command-magnitude-invalid" },
    });
    expect(started.value.read()).toMatchObject({ loaded: 1, nextEventSequence: 0 });

    expect(started.value.stop().ok).toBe(true);
    expect(started.value.load({ rowKey: "game/score", payload: "9000", weight: 1 })).toMatchObject({
      ok: false,
      feedback: { severity: "cold", code: "row-command-editor-stopped" },
    });
  });

  test("rolls back a partial field load when the browser refuses a write", () => {
    const mount = new NativeEditorMount();
    const started = startDarkHallBrowserRowCommandEditor({
      mount,
      eventIdPrefix: "tab-a",
      maxPayloadBytes: 1024,
      observe: () => ({ ok: true }),
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    Object.defineProperty(mount.payload, "value", { configurable: true, value: "original", writable: false });
    expect(started.value.load({ rowKey: "game/score", payload: "9000", weight: 1 })).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "row-command-editor-field-write-failed" },
    });
    expect(mount.rowKey.value).toBe("");
    expect(mount.payload.value).toBe("original");
    expect(mount.magnitude.value).toBe("1");
    expect(started.value.read()).toMatchObject({ loaded: 0, loadedRowKey: null, nextEventSequence: 0 });
  });

  test("types invalid configuration, mounts, fields, and observer refusal", () => {
    expect(
      startDarkHallBrowserRowCommandEditor({
        mount: {},
        eventIdPrefix: "",
        maxPayloadBytes: 0,
        observe: () => ({ ok: true }),
      }),
    ).toMatchObject({ ok: false, feedback: { code: "row-command-editor-configuration-invalid" } });

    expect(
      startDarkHallBrowserRowCommandEditor({
        mount: {},
        eventIdPrefix: "tab-a",
        maxPayloadBytes: 1,
        observe: () => ({ ok: true }),
      }),
    ).toMatchObject({ ok: false, feedback: { code: "row-command-editor-mount-invalid" } });

    const missingFields = new NativeEditorMount();
    missingFields.querySelector = () => null;
    expect(
      startDarkHallBrowserRowCommandEditor({
        mount: missingFields,
        eventIdPrefix: "tab-a",
        maxPayloadBytes: 1,
        observe: () => ({ ok: true }),
      }),
    ).toMatchObject({ ok: false, feedback: { code: "row-command-editor-fields-unavailable" } });

    expect(
      startDarkHallBrowserRowCommandEditor({
        mount: new NativeEditorMount(),
        eventIdPrefix: "tab-a",
        maxPayloadBytes: 1,
        observe: () => ({
          ok: false,
          feedback: { severity: "heat", code: "test-observer-refused", detail: "refused" },
        }),
      }),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "row-command-editor-observer-failed" },
    });
  });

  test("keeps canonical controller slot identities outside the editor", () => {
    expect(action("emit").cell).toBe(SLOT.ACCEPT);
    expect(action("retract").cell).toBe(SLOT.UNDO_RETRACT);
    expect(action("inspect").cell).toBe(SLOT.INSPECT);
    expect(action("refresh").cell).toBe(SLOT.REFRESH);
  });
});
