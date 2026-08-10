import type {
  DarkHallBrowserDatabaseAction,
  DarkHallBrowserDatabaseCommand,
} from "./darkhall-browser-database-controller";
import type { DarkHallBrowserControllerInputSource } from "./darkhall-browser-controller-input";

export const DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA = "zeta.darkhall.browser-row-command-editor.v1" as const;
export const DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_MOUNT_ID = "darkhall-row-command-editor" as const;

const rowKeySelector = "[data-row-command-key]";
const payloadSelector = "[data-row-command-payload]";
const magnitudeSelector = "[data-row-command-magnitude]";
const statusSelector = "[data-row-command-status]";

export type DarkHallBrowserRowCommandEditorValidity = "ready" | "incomplete" | "invalid" | "backpressured";

export interface DarkHallBrowserRowCommandEditorFeedback {
  readonly severity: "cold" | "backpressure" | "heat";
  readonly code:
    | "row-command-editor-configuration-invalid"
    | "row-command-editor-mount-invalid"
    | "row-command-editor-fields-unavailable"
    | "row-command-editor-listener-failed"
    | "row-command-editor-observer-failed"
    | "row-command-key-required"
    | "row-command-key-invalid"
    | "row-command-payload-too-large"
    | "row-command-magnitude-invalid"
    | "row-command-editor-stopped";
  readonly detail: string;
}

export type DarkHallBrowserRowCommandEditorResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserRowCommandEditorFeedback };

export interface DarkHallBrowserRowCommandEditorInteraction {
  readonly source: DarkHallBrowserControllerInputSource;
  readonly kind: "emit" | "retract";
  readonly eventId: string | null;
  readonly outcome: "resolved" | "refused" | "backpressured";
  readonly feedbackCode: DarkHallBrowserRowCommandEditorFeedback["code"] | null;
}

export interface DarkHallBrowserRowCommandEditorReadout {
  readonly schema: typeof DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA;
  readonly status: "live" | "stopped";
  readonly validity: DarkHallBrowserRowCommandEditorValidity;
  readonly rowKey: string;
  readonly payloadBytes: number;
  readonly magnitude: number | null;
  readonly resolved: number;
  readonly refused: number;
  readonly backpressured: number;
  readonly nextEventSequence: number;
  readonly feedbackCode: DarkHallBrowserRowCommandEditorFeedback["code"] | null;
  readonly last: DarkHallBrowserRowCommandEditorInteraction | null;
}

export type DarkHallBrowserRowCommandEditorEdgeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly feedback: {
        readonly severity: "cold" | "backpressure" | "heat";
        readonly code: string;
        readonly detail: string;
      };
    };

export interface DarkHallBrowserRowCommandEditorOptions {
  readonly mount: unknown;
  readonly eventIdPrefix: string;
  readonly maxPayloadBytes: number;
  readonly observe: (readout: DarkHallBrowserRowCommandEditorReadout) => DarkHallBrowserRowCommandEditorEdgeResult;
}

export interface DarkHallBrowserRowCommandEditorRuntime {
  read(): DarkHallBrowserRowCommandEditorReadout;
  resolve(
    action: DarkHallBrowserDatabaseAction,
    source: DarkHallBrowserControllerInputSource,
  ): DarkHallBrowserRowCommandEditorResult<DarkHallBrowserDatabaseCommand>;
  stop(): DarkHallBrowserRowCommandEditorResult<DarkHallBrowserRowCommandEditorReadout>;
}

type NativeListener = (event: unknown) => void;

interface NativeEditorMount {
  readonly value: unknown;
  readonly query: (...arguments_: readonly unknown[]) => unknown;
  readonly add: (...arguments_: readonly unknown[]) => unknown;
  readonly remove: (...arguments_: readonly unknown[]) => unknown;
  readonly setAttribute: (...arguments_: readonly unknown[]) => unknown;
}

interface NativeEditorFields {
  readonly rowKey: unknown;
  readonly payload: unknown;
  readonly magnitude: unknown;
  readonly status: unknown;
}

interface EditorSnapshot {
  readonly rowKey: string;
  readonly payload: string;
  readonly payloadBytes: number;
  readonly magnitude: number | null;
  readonly validation: DarkHallBrowserRowCommandEditorResult<null>;
}

function succeeded<T>(value: T): DarkHallBrowserRowCommandEditorResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserRowCommandEditorFeedback["code"],
  detail: string,
  severity: DarkHallBrowserRowCommandEditorFeedback["severity"] = "heat",
): DarkHallBrowserRowCommandEditorResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function member(value: unknown, name: string): unknown {
  if (!isRecord(value)) return undefined;
  try {
    return Reflect.get(value, name);
  } catch {
    return undefined;
  }
}

function method(value: unknown, name: string): ((...arguments_: readonly unknown[]) => unknown) | null {
  const candidate = member(value, name);
  return typeof candidate === "function" ? (candidate as (...arguments_: readonly unknown[]) => unknown) : null;
}

function nativeEditorMount(value: unknown): NativeEditorMount | null {
  const query = method(value, "querySelector");
  const add = method(value, "addEventListener");
  const remove = method(value, "removeEventListener");
  const setAttribute = method(value, "setAttribute");
  return query === null || add === null || remove === null || setAttribute === null
    ? null
    : { value, query, add, remove, setAttribute };
}

function query(mount: NativeEditorMount, selector: string): unknown {
  try {
    return Reflect.apply(mount.query, mount.value, [selector]);
  } catch {
    return null;
  }
}

function nativeEditorFields(mount: NativeEditorMount): NativeEditorFields | null {
  const rowKey = query(mount, rowKeySelector);
  const payload = query(mount, payloadSelector);
  const magnitude = query(mount, magnitudeSelector);
  const status = query(mount, statusSelector);
  return [rowKey, payload, magnitude].every((field) => typeof member(field, "value") === "string") && isRecord(status)
    ? { rowKey, payload, magnitude, status }
    : null;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) return true;
  }
  return false;
}

function validEventIdPrefix(value: string): boolean {
  return value.length > 0 && value.length <= 1024 && !hasControlCharacter(value);
}

function fieldValue(field: unknown): string | null {
  const value = member(field, "value");
  return typeof value === "string" ? value : null;
}

function parseMagnitude(value: string): number | null {
  if (!/^[1-9][0-9]*$/u.test(value)) return null;
  const magnitude = Number(value);
  return Number.isSafeInteger(magnitude) ? magnitude : null;
}

function validation(
  rowKey: string,
  payloadBytes: number,
  magnitude: number | null,
  maxPayloadBytes: number,
): DarkHallBrowserRowCommandEditorResult<null> {
  if (rowKey.length === 0) {
    return failed("row-command-key-required", "A row command requires a row key.", "cold");
  }
  if (rowKey.length > 1024 || hasControlCharacter(rowKey)) {
    return failed("row-command-key-invalid", "A row key must contain 1 to 1024 printable characters.", "cold");
  }
  if (payloadBytes > maxPayloadBytes) {
    return failed(
      "row-command-payload-too-large",
      `The row payload requires ${payloadBytes.toString()} bytes; the editor budget is ${maxPayloadBytes.toString()} bytes.`,
      "backpressure",
    );
  }
  if (magnitude === null || magnitude <= 0) {
    return failed("row-command-magnitude-invalid", "A row command magnitude must be a positive safe integer.", "cold");
  }
  return succeeded(null);
}

function validity(result: DarkHallBrowserRowCommandEditorResult<null>): DarkHallBrowserRowCommandEditorValidity {
  if (result.ok) return "ready";
  if (result.feedback.code === "row-command-key-required") return "incomplete";
  return result.feedback.severity === "backpressure" ? "backpressured" : "invalid";
}

function setText(value: unknown, text: string): boolean {
  if (!isRecord(value)) return false;
  try {
    return Reflect.set(value, "textContent", text);
  } catch {
    return false;
  }
}

function renderReadoutAttributes(
  mount: NativeEditorMount,
  fields: NativeEditorFields,
  readout: DarkHallBrowserRowCommandEditorReadout,
): boolean {
  const attributes: readonly (readonly [string, string])[] = [
    ["data-row-command-status", readout.status],
    ["data-row-command-validity", readout.validity],
    ["data-row-command-payload-bytes", readout.payloadBytes.toString()],
    ["data-row-command-magnitude-value", readout.magnitude?.toString() ?? "invalid"],
    ["data-row-command-resolved", readout.resolved.toString()],
    ["data-row-command-refused", readout.refused.toString()],
    ["data-row-command-backpressured", readout.backpressured.toString()],
    ["data-row-command-feedback", readout.feedbackCode ?? "none"],
  ];
  try {
    const set = attributes.every(([name, value]) => {
      Reflect.apply(mount.setAttribute, mount.value, [name, value]);
      return true;
    });
    return set && setText(fields.status, `${readout.validity} | ${readout.payloadBytes.toString()} bytes`);
  } catch {
    return false;
  }
}

export function renderDarkHallBrowserRowCommandEditorHtml(): string {
  return [
    `<section id="${DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_MOUNT_ID}" class="zeta-row-command-editor"`,
    ` data-row-command-editor="${DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA}"`,
    ' data-row-command-status="starting" data-row-command-validity="incomplete"',
    ' aria-labelledby="zeta-row-command-title">',
    '<header class="zeta-row-command-header">',
    '<h2 id="zeta-row-command-title">Row command</h2>',
    '<output class="zeta-row-command-status" data-row-command-status aria-live="polite">incomplete | 0 bytes</output>',
    "</header>",
    '<div class="zeta-row-command-fields">',
    '<label class="zeta-row-command-field zeta-row-command-field-key">',
    "<span>row key</span>",
    '<input type="text" name="row-key" data-row-command-key maxlength="1024" autocomplete="off" spellcheck="false">',
    "</label>",
    '<label class="zeta-row-command-field zeta-row-command-field-payload">',
    "<span>payload</span>",
    '<textarea name="payload" data-row-command-payload rows="2" spellcheck="false"></textarea>',
    "</label>",
    '<label class="zeta-row-command-field zeta-row-command-field-magnitude">',
    "<span>magnitude</span>",
    '<input type="number" name="magnitude" data-row-command-magnitude min="1" step="1" value="1" inputmode="numeric">',
    "</label>",
    "</div>",
    "</section>",
  ].join("");
}

/** Bind stable row fields to semantic write commands; signed deltas remain owned by the database controller. */
export function startDarkHallBrowserRowCommandEditor(
  options: DarkHallBrowserRowCommandEditorOptions,
): DarkHallBrowserRowCommandEditorResult<DarkHallBrowserRowCommandEditorRuntime> {
  if (
    !validEventIdPrefix(options.eventIdPrefix) ||
    !Number.isSafeInteger(options.maxPayloadBytes) ||
    options.maxPayloadBytes <= 0
  ) {
    return failed(
      "row-command-editor-configuration-invalid",
      "A row command editor requires a printable event prefix and a positive safe-integer payload budget.",
    );
  }
  const mount = nativeEditorMount(options.mount);
  if (mount === null) {
    return failed(
      "row-command-editor-mount-invalid",
      "A row command editor mount must expose querySelector, event listeners, and setAttribute.",
    );
  }
  const fields = nativeEditorFields(mount);
  if (fields === null) {
    return failed(
      "row-command-editor-fields-unavailable",
      "The row command editor is missing its key, payload, magnitude, or status field.",
    );
  }

  let stopped = false;
  let resolved = 0;
  let refused = 0;
  let backpressured = 0;
  let nextEventSequence = 0;
  let last: DarkHallBrowserRowCommandEditorInteraction | null = null;

  const snapshot = (): EditorSnapshot => {
    const rowKey = fieldValue(fields.rowKey);
    const payload = fieldValue(fields.payload);
    const magnitudeText = fieldValue(fields.magnitude);
    if (rowKey === null || payload === null || magnitudeText === null) {
      return {
        rowKey: "",
        payload: "",
        payloadBytes: 0,
        magnitude: null,
        validation: failed(
          "row-command-editor-fields-unavailable",
          "The browser stopped exposing a row command editor field.",
        ),
      };
    }
    const payloadBytes = new TextEncoder().encode(payload).byteLength;
    const magnitude = parseMagnitude(magnitudeText);
    return {
      rowKey,
      payload,
      payloadBytes,
      magnitude,
      validation: validation(rowKey, payloadBytes, magnitude, options.maxPayloadBytes),
    };
  };

  const read = (): DarkHallBrowserRowCommandEditorReadout => {
    const current = snapshot();
    return {
      schema: DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA,
      status: stopped ? "stopped" : "live",
      validity: validity(current.validation),
      rowKey: current.rowKey,
      payloadBytes: current.payloadBytes,
      magnitude: current.magnitude,
      resolved,
      refused,
      backpressured,
      nextEventSequence,
      feedbackCode: current.validation.ok ? null : current.validation.feedback.code,
      last,
    };
  };

  const publish = (): DarkHallBrowserRowCommandEditorResult<DarkHallBrowserRowCommandEditorReadout> => {
    const readout = read();
    if (!renderReadoutAttributes(mount, fields, readout)) {
      return failed("row-command-editor-observer-failed", "The browser refused a row command editor readout update.");
    }
    try {
      const observed = options.observe(readout);
      return observed.ok
        ? succeeded(readout)
        : failed(
            "row-command-editor-observer-failed",
            `${observed.feedback.code}: ${observed.feedback.detail}`,
            observed.feedback.severity,
          );
    } catch {
      return failed(
        "row-command-editor-observer-failed",
        "The injected row command editor observer threw while publishing a readout.",
      );
    }
  };

  const resolve = (
    action: DarkHallBrowserDatabaseAction,
    source: DarkHallBrowserControllerInputSource,
  ): DarkHallBrowserRowCommandEditorResult<DarkHallBrowserDatabaseCommand> => {
    if (stopped) return failed("row-command-editor-stopped", "The row command editor has stopped.", "cold");
    if (action.kind === "inspect" || action.kind === "refresh") return succeeded({ kind: action.kind });

    const current = snapshot();
    if (!current.validation.ok) {
      const outcome = current.validation.feedback.severity === "backpressure" ? "backpressured" : "refused";
      if (outcome === "backpressured") backpressured += 1;
      else refused += 1;
      last = {
        source,
        kind: action.kind,
        eventId: null,
        outcome,
        feedbackCode: current.validation.feedback.code,
      };
      const published = publish();
      return published.ok ? current.validation : published;
    }
    const eventId = `${options.eventIdPrefix}/row-command/${nextEventSequence.toString()}`;
    const command: DarkHallBrowserDatabaseCommand = {
      kind: action.kind,
      eventId,
      rowKey: current.rowKey,
      payload: current.payload,
      magnitude: current.magnitude ?? 1,
    };
    nextEventSequence += 1;
    resolved += 1;
    last = { source, kind: action.kind, eventId, outcome: "resolved", feedbackCode: null };
    const published = publish();
    return published.ok ? succeeded(command) : published;
  };

  const changed: NativeListener = () => {
    void publish();
  };
  try {
    Reflect.apply(mount.add, mount.value, ["input", changed]);
  } catch {
    return failed(
      "row-command-editor-listener-failed",
      "The browser refused row command editor listener installation.",
    );
  }

  const runtime: DarkHallBrowserRowCommandEditorRuntime = {
    read,
    resolve,
    stop: () => {
      if (stopped) return succeeded(read());
      try {
        Reflect.apply(mount.remove, mount.value, ["input", changed]);
      } catch {
        return failed("row-command-editor-listener-failed", "The browser refused row command editor listener cleanup.");
      }
      stopped = true;
      return publish();
    },
  };

  const published = publish();
  if (!published.ok) {
    try {
      Reflect.apply(mount.remove, mount.value, ["input", changed]);
    } catch {
      // The original startup failure remains the typed signal.
    }
    return published;
  }
  return succeeded(runtime);
}
