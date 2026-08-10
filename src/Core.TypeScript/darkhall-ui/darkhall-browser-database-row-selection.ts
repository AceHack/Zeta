import type { DarkHallBrowserControllerInputSource } from "./darkhall-browser-controller-input";
import type { DarkHallDatabaseRowSelectionToken } from "./darkhall-database-readout";

export const DARK_HALL_BROWSER_DATABASE_ROW_SELECTION_SCHEMA =
  "zeta.darkhall.browser-database-row-selection.v1" as const;

const rowSelectionSelector = "[data-database-row-select]";

export interface DarkHallBrowserDatabaseRowSelectionFeedback {
  readonly severity: "cold" | "backpressure" | "heat";
  readonly code:
    | "database-row-selection-configuration-invalid"
    | "database-row-selection-listener-failed"
    | "database-row-selection-key-invalid"
    | "database-row-selection-row-unavailable"
    | "database-row-selection-load-failed"
    | "database-row-selection-observer-failed"
    | "database-row-selection-stopped";
  readonly detail: string;
}

export type DarkHallBrowserDatabaseRowSelectionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserDatabaseRowSelectionFeedback };

type DarkHallBrowserDatabaseRowSelectionFailure = Extract<
  DarkHallBrowserDatabaseRowSelectionResult<never>,
  { readonly ok: false }
>;

export type DarkHallBrowserDatabaseRowSelectionEdgeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly feedback: {
        readonly severity: "cold" | "backpressure" | "heat";
        readonly code: string;
        readonly detail: string;
      };
    };

export interface DarkHallBrowserDatabaseRowSelectionInteraction {
  readonly source: DarkHallBrowserControllerInputSource;
  readonly rowKey: string;
  readonly outcome: "selected" | "refused" | "backpressured";
  readonly feedbackCode: string | null;
}

export interface DarkHallBrowserDatabaseRowSelectionReadout {
  readonly schema: typeof DARK_HALL_BROWSER_DATABASE_ROW_SELECTION_SCHEMA;
  readonly status: "live" | "stopped";
  readonly selected: number;
  readonly refused: number;
  readonly backpressured: number;
  readonly selectedRowKey: string | null;
  readonly last: DarkHallBrowserDatabaseRowSelectionInteraction | null;
}

export interface DarkHallBrowserDatabaseRowSelectionOptions {
  readonly pointerTarget: unknown;
  readonly resolveSelection: (rowKey: string) => DarkHallDatabaseRowSelectionToken | null;
  readonly loadSelection: (
    selection: DarkHallDatabaseRowSelectionToken,
  ) => DarkHallBrowserDatabaseRowSelectionEdgeResult;
  readonly observe: (
    readout: DarkHallBrowserDatabaseRowSelectionReadout,
  ) => DarkHallBrowserDatabaseRowSelectionEdgeResult;
}

export interface DarkHallBrowserDatabaseRowSelectionRuntime {
  read(): DarkHallBrowserDatabaseRowSelectionReadout;
  select(
    rowKey: string,
    source: DarkHallBrowserControllerInputSource,
  ): DarkHallBrowserDatabaseRowSelectionResult<DarkHallBrowserDatabaseRowSelectionReadout>;
  stop(): DarkHallBrowserDatabaseRowSelectionResult<DarkHallBrowserDatabaseRowSelectionReadout>;
}

type NativeListener = (event: unknown) => void;

interface NativeEventTarget {
  readonly value: unknown;
  readonly add: (...arguments_: readonly unknown[]) => unknown;
  readonly remove: (...arguments_: readonly unknown[]) => unknown;
}

function succeeded<T>(value: T): DarkHallBrowserDatabaseRowSelectionResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserDatabaseRowSelectionFeedback["code"],
  detail: string,
  severity: DarkHallBrowserDatabaseRowSelectionFeedback["severity"] = "heat",
): DarkHallBrowserDatabaseRowSelectionFailure {
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

function nativeEventTarget(value: unknown): NativeEventTarget | null {
  const add = method(value, "addEventListener");
  const remove = method(value, "removeEventListener");
  return add === null || remove === null ? null : { value, add, remove };
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) return true;
  }
  return false;
}

function validRowKey(value: string): boolean {
  return value.length > 0 && value.length <= 1024 && !hasControlCharacter(value);
}

function pointerRowKey(event: unknown): string | null {
  const button = member(event, "button");
  if (typeof button === "number" && button !== 0) return null;
  const target = member(event, "target");
  const closest = method(target, "closest");
  if (closest === null) return null;

  let rowTarget: unknown;
  try {
    rowTarget = Reflect.apply(closest, target, [rowSelectionSelector]);
  } catch {
    return null;
  }
  const getAttribute = method(rowTarget, "getAttribute");
  if (getAttribute === null) return null;
  try {
    const value = Reflect.apply(getAttribute, rowTarget, ["data-row-key"]);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function preventDefault(event: unknown): void {
  const prevent = method(event, "preventDefault");
  if (prevent === null) return;
  try {
    Reflect.apply(prevent, event, []);
  } catch {
    // The typed selection remains observable when a host refuses preventDefault.
  }
}

function pointerSource(event: unknown): DarkHallBrowserControllerInputSource {
  return member(event, "detail") === 0 ? "keyboard" : "pointer";
}

/** Resolve a DOM row identity through typed database state before loading the editor. */
export function startDarkHallBrowserDatabaseRowSelection(
  options: DarkHallBrowserDatabaseRowSelectionOptions,
): DarkHallBrowserDatabaseRowSelectionResult<DarkHallBrowserDatabaseRowSelectionRuntime> {
  const pointerTarget = nativeEventTarget(options.pointerTarget);
  if (pointerTarget === null) {
    return failed(
      "database-row-selection-configuration-invalid",
      "A database row selection target must expose addEventListener and removeEventListener.",
    );
  }

  let stopped = false;
  let selected = 0;
  let refused = 0;
  let backpressured = 0;
  let selectedRowKey: string | null = null;
  let last: DarkHallBrowserDatabaseRowSelectionInteraction | null = null;

  const read = (): DarkHallBrowserDatabaseRowSelectionReadout => ({
    schema: DARK_HALL_BROWSER_DATABASE_ROW_SELECTION_SCHEMA,
    status: stopped ? "stopped" : "live",
    selected,
    refused,
    backpressured,
    selectedRowKey,
    last,
  });

  const publish = (): DarkHallBrowserDatabaseRowSelectionResult<DarkHallBrowserDatabaseRowSelectionReadout> => {
    const readout = read();
    try {
      const observed = options.observe(readout);
      return observed.ok
        ? succeeded(readout)
        : failed(
            "database-row-selection-observer-failed",
            `${observed.feedback.code}: ${observed.feedback.detail}`,
            observed.feedback.severity,
          );
    } catch {
      return failed(
        "database-row-selection-observer-failed",
        "The injected database row selection observer threw while publishing a readout.",
      );
    }
  };

  const recordFailure = (
    source: DarkHallBrowserControllerInputSource,
    rowKey: string,
    feedback: DarkHallBrowserDatabaseRowSelectionFeedback,
  ): DarkHallBrowserDatabaseRowSelectionResult<never> => {
    const outcome = feedback.severity === "backpressure" ? "backpressured" : "refused";
    if (outcome === "backpressured") backpressured += 1;
    else refused += 1;
    last = { source, rowKey, outcome, feedbackCode: feedback.code };
    const published = publish();
    return published.ok ? { ok: false, feedback } : published;
  };

  const select = (
    rowKey: string,
    source: DarkHallBrowserControllerInputSource,
  ): DarkHallBrowserDatabaseRowSelectionResult<DarkHallBrowserDatabaseRowSelectionReadout> => {
    if (stopped) return failed("database-row-selection-stopped", "Database row selection has stopped.", "cold");
    if (!validRowKey(rowKey)) {
      return recordFailure(
        source,
        rowKey,
        failed(
          "database-row-selection-key-invalid",
          "A selected row key must contain 1 to 1024 printable characters.",
          "cold",
        ).feedback,
      );
    }

    let selection: DarkHallDatabaseRowSelectionToken | null;
    try {
      selection = options.resolveSelection(rowKey);
    } catch {
      return recordFailure(
        source,
        rowKey,
        failed(
          "database-row-selection-row-unavailable",
          "The injected database row resolver threw while resolving the selected row.",
        ).feedback,
      );
    }
    if (selection === null || selection.row.rowKey !== rowKey) {
      return recordFailure(
        source,
        rowKey,
        failed(
          "database-row-selection-row-unavailable",
          `Row ${rowKey} is not present in the latest typed database readout.`,
          "cold",
        ).feedback,
      );
    }

    let loaded: DarkHallBrowserDatabaseRowSelectionEdgeResult;
    try {
      loaded = options.loadSelection({ ...selection, row: { ...selection.row } });
    } catch {
      return recordFailure(
        source,
        rowKey,
        failed("database-row-selection-load-failed", "The injected row editor threw while loading a selected row.")
          .feedback,
      );
    }
    if (!loaded.ok) {
      return recordFailure(
        source,
        rowKey,
        failed(
          "database-row-selection-load-failed",
          `${loaded.feedback.code}: ${loaded.feedback.detail}`,
          loaded.feedback.severity,
        ).feedback,
      );
    }

    selected += 1;
    selectedRowKey = rowKey;
    last = { source, rowKey, outcome: "selected", feedbackCode: null };
    return publish();
  };

  const clicked: NativeListener = (event) => {
    const rowKey = pointerRowKey(event);
    if (rowKey === null) return;
    preventDefault(event);
    select(rowKey, pointerSource(event));
  };

  try {
    Reflect.apply(pointerTarget.add, pointerTarget.value, ["click", clicked]);
  } catch {
    return failed(
      "database-row-selection-listener-failed",
      "The browser refused database row selection listener installation.",
    );
  }

  const runtime: DarkHallBrowserDatabaseRowSelectionRuntime = {
    read,
    select,
    stop: () => {
      if (stopped) return succeeded(read());
      try {
        Reflect.apply(pointerTarget.remove, pointerTarget.value, ["click", clicked]);
      } catch {
        return failed(
          "database-row-selection-listener-failed",
          "The browser refused database row selection listener cleanup.",
        );
      }
      stopped = true;
      return publish();
    },
  };

  const published = publish();
  if (!published.ok) {
    try {
      Reflect.apply(pointerTarget.remove, pointerTarget.value, ["click", clicked]);
    } catch {
      // The startup failure remains primary.
    }
    return published;
  }
  return succeeded(runtime);
}
