import {
  DARK_HALL_BROWSER_DATABASE_ACTIONS,
  type DarkHallBrowserDatabaseAction,
  type DarkHallBrowserDatabaseCommand,
  type DarkHallBrowserDatabaseControllerReadout,
  type DarkHallBrowserDatabaseControllerResult,
} from "./darkhall-browser-database-controller";

export const DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA = "zeta.darkhall.browser-controller-input.v1" as const;

export type DarkHallBrowserControllerInputSource = "keyboard" | "pointer";
export type DarkHallBrowserControllerInputOutcome = "accepted" | "refused" | "backpressured";

export interface DarkHallBrowserControllerInputInteraction {
  readonly source: DarkHallBrowserControllerInputSource;
  readonly cell: number;
  readonly actionId: string | null;
  readonly outcome: DarkHallBrowserControllerInputOutcome;
  readonly feedbackCode: string | null;
}

export interface DarkHallBrowserControllerInputReadout {
  readonly schema: typeof DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA;
  readonly status: "live" | "stopped";
  readonly maxInFlight: number;
  readonly inFlight: number;
  readonly accepted: number;
  readonly refused: number;
  readonly backpressured: number;
  readonly last: DarkHallBrowserControllerInputInteraction | null;
}

export interface DarkHallBrowserControllerInputFeedback {
  readonly severity: "cold" | "backpressure" | "heat";
  readonly code:
    | "controller-input-configuration-invalid"
    | "controller-input-listener-failed"
    | "controller-input-cell-invalid"
    | "controller-input-source-invalid"
    | "controller-input-action-unavailable"
    | "controller-input-command-unavailable"
    | "controller-input-command-mismatch"
    | "controller-input-command-resolver-threw"
    | "controller-input-dispatch-failed"
    | "controller-input-observer-failed"
    | "controller-input-busy"
    | "controller-input-stopped";
  readonly detail: string;
}

export type DarkHallBrowserControllerInputResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserControllerInputFeedback };

export type DarkHallBrowserControllerCommandResolution = DarkHallBrowserControllerInputResult<DarkHallBrowserDatabaseCommand>;

export type DarkHallBrowserControllerCommandResolver = (
  action: DarkHallBrowserDatabaseAction,
  source: DarkHallBrowserControllerInputSource,
) => DarkHallBrowserControllerCommandResolution;

export type DarkHallBrowserControllerInputEdgeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly feedback: {
        readonly severity: "cold" | "backpressure" | "heat";
        readonly code: string;
        readonly detail: string;
      };
    };

export interface DarkHallBrowserControllerInputOptions {
  readonly pointerTarget: unknown;
  readonly keyboardTarget: unknown;
  readonly maxInFlight: number;
  readonly resolveCommand?: DarkHallBrowserControllerCommandResolver;
  readonly dispatch: (
    command: DarkHallBrowserDatabaseCommand,
  ) => Promise<DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseControllerReadout>>;
  readonly observe: (readout: DarkHallBrowserControllerInputReadout) => DarkHallBrowserControllerInputEdgeResult;
}

export interface DarkHallBrowserControllerInputRuntime {
  read(): DarkHallBrowserControllerInputReadout;
  dispatchCell(
    cell: number,
    source: DarkHallBrowserControllerInputSource,
  ): Promise<DarkHallBrowserControllerInputResult<DarkHallBrowserControllerInputReadout>>;
  stop(): DarkHallBrowserControllerInputResult<DarkHallBrowserControllerInputReadout>;
}

type NativeListener = (event: unknown) => void;

interface NativeEventTarget {
  readonly value: unknown;
  readonly add: (...arguments_: readonly unknown[]) => unknown;
  readonly remove: (...arguments_: readonly unknown[]) => unknown;
}

function succeeded<T>(value: T): DarkHallBrowserControllerInputResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserControllerInputFeedback["code"],
  detail: string,
  severity: DarkHallBrowserControllerInputFeedback["severity"] = "heat",
): DarkHallBrowserControllerInputResult<never> {
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

function actionForCell(cell: number): DarkHallBrowserDatabaseAction | null {
  return DARK_HALL_BROWSER_DATABASE_ACTIONS.find((action) => action.cell === cell) ?? null;
}

function parseCell(value: unknown): number | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const cell = Number(value);
  return Number.isSafeInteger(cell) && cell >= 0 && cell < 16 ? cell : null;
}

function pointerCell(event: unknown): number | null {
  const button = member(event, "button");
  if (typeof button === "number" && button !== 0) return null;
  const target = member(event, "target");
  const closest = method(target, "closest");
  if (closest === null) return null;

  let cellTarget: unknown;
  try {
    cellTarget = Reflect.apply(closest, target, ["[data-controller-cell]"]);
  } catch {
    return null;
  }
  const getAttribute = method(cellTarget, "getAttribute");
  if (getAttribute === null) return null;
  try {
    return parseCell(Reflect.apply(getAttribute, cellTarget, ["data-controller-cell"]));
  } catch {
    return null;
  }
}

function isEditableTarget(value: unknown): boolean {
  if (member(value, "isContentEditable") === true) return true;
  const tagName = member(value, "tagName");
  if (typeof tagName !== "string") return false;
  const normalized = tagName.toUpperCase();
  return normalized === "INPUT" || normalized === "TEXTAREA" || normalized === "SELECT";
}

function keyboardCell(event: unknown): number | null {
  if (
    member(event, "repeat") === true ||
    member(event, "altKey") === true ||
    member(event, "ctrlKey") === true ||
    member(event, "metaKey") === true ||
    isEditableTarget(member(event, "target"))
  ) {
    return null;
  }

  const code = member(event, "code");
  if (typeof code !== "string") return null;
  if (code.length === 6 && code.startsWith("Digit")) return parseCell(code.slice(5));
  if (code.length === 7 && code.startsWith("Numpad")) return parseCell(code.slice(6));
  if (code.length === 4 && code.startsWith("Key")) {
    const codePoint = code.codePointAt(3);
    if (codePoint !== undefined && codePoint >= 65 && codePoint <= 70) return codePoint - 55;
  }
  return null;
}

function preventDefault(event: unknown): void {
  const prevent = method(event, "preventDefault");
  if (prevent === null) return;
  try {
    Reflect.apply(prevent, event, []);
  } catch {
    // Input dispatch remains observable even if a host refuses preventDefault.
  }
}

function pointerSource(event: unknown): DarkHallBrowserControllerInputSource {
  return member(event, "detail") === 0 ? "keyboard" : "pointer";
}

export function defaultDarkHallBrowserControllerCommand(
  action: DarkHallBrowserDatabaseAction,
  _source: DarkHallBrowserControllerInputSource,
): DarkHallBrowserControllerCommandResolution {
  if (action.kind === "inspect" || action.kind === "refresh") return succeeded({ kind: action.kind });
  return failed(
    "controller-input-command-unavailable",
    `${action.actionId} requires an injected semantic command resolver with explicit row data.`,
    "cold",
  );
}

/** Bind browser gestures to the fixed 16-cell grammar without exposing database deltas to the DOM edge. */
export function startDarkHallBrowserControllerInput(
  options: DarkHallBrowserControllerInputOptions,
): DarkHallBrowserControllerInputResult<DarkHallBrowserControllerInputRuntime> {
  if (!Number.isSafeInteger(options.maxInFlight) || options.maxInFlight <= 0) {
    return failed(
      "controller-input-configuration-invalid",
      "A browser controller input requires a positive safe-integer in-flight budget.",
    );
  }
  const pointerTarget = nativeEventTarget(options.pointerTarget);
  const keyboardTarget = nativeEventTarget(options.keyboardTarget);
  if (pointerTarget === null || keyboardTarget === null) {
    return failed(
      "controller-input-configuration-invalid",
      "Browser controller input targets must expose addEventListener and removeEventListener.",
    );
  }

  const resolveCommand = options.resolveCommand ?? defaultDarkHallBrowserControllerCommand;
  let stopped = false;
  let inFlight = 0;
  let accepted = 0;
  let refused = 0;
  let backpressured = 0;
  let last: DarkHallBrowserControllerInputInteraction | null = null;

  const read = (): DarkHallBrowserControllerInputReadout => ({
    schema: DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA,
    status: stopped ? "stopped" : "live",
    maxInFlight: options.maxInFlight,
    inFlight,
    accepted,
    refused,
    backpressured,
    last,
  });

  const record = (
    source: DarkHallBrowserControllerInputSource,
    cell: number,
    actionId: string | null,
    outcome: DarkHallBrowserControllerInputOutcome,
    feedbackCode: string | null,
  ): DarkHallBrowserControllerInputResult<DarkHallBrowserControllerInputReadout> => {
    if (outcome === "accepted") accepted += 1;
    else if (outcome === "backpressured") backpressured += 1;
    else refused += 1;
    last = { source, cell, actionId, outcome, feedbackCode };
    const readout = read();
    try {
      const observed = options.observe(readout);
      return observed.ok
        ? succeeded(readout)
        : failed(
            "controller-input-observer-failed",
            `${observed.feedback.code}: ${observed.feedback.detail}`,
            observed.feedback.severity,
          );
    } catch {
      return failed(
        "controller-input-observer-failed",
        "The injected browser controller input observer threw while publishing a gesture readout.",
      );
    }
  };

  const dispatchCell = async (
    cell: number,
    source: DarkHallBrowserControllerInputSource,
  ): Promise<DarkHallBrowserControllerInputResult<DarkHallBrowserControllerInputReadout>> => {
    if (stopped) return failed("controller-input-stopped", "The browser controller input has stopped.", "cold");
    if (source !== "keyboard" && source !== "pointer") {
      return failed(
        "controller-input-source-invalid",
        "A browser controller input source must be keyboard or pointer.",
      );
    }
    if (!Number.isSafeInteger(cell) || cell < 0 || cell >= 16) {
      return failed("controller-input-cell-invalid", "A browser controller cell must be an integer from 0 to 15.");
    }
    const action = actionForCell(cell);
    if (action === null) {
      const recorded = record(source, cell, null, "refused", "controller-input-action-unavailable");
      return recorded.ok
        ? failed(
            "controller-input-action-unavailable",
            `Controller cell ${cell.toString()} has no action in the current room.`,
            "cold",
          )
        : recorded;
    }
    if (inFlight >= options.maxInFlight) {
      const recorded = record(source, cell, action.actionId, "backpressured", "controller-input-busy");
      return recorded.ok
        ? failed(
            "controller-input-busy",
            `Controller input has ${inFlight.toString()} command(s) in flight; its budget is ${options.maxInFlight.toString()}.`,
            "backpressure",
          )
        : recorded;
    }

    let command: DarkHallBrowserControllerCommandResolution;
    try {
      command = resolveCommand(action, source);
    } catch {
      const recorded = record(source, cell, action.actionId, "refused", "controller-input-command-resolver-threw");
      return recorded.ok
        ? failed(
            "controller-input-command-resolver-threw",
            "The injected semantic command resolver threw while handling a browser gesture.",
          )
        : recorded;
    }
    if (!command.ok) {
      const outcome = command.feedback.severity === "backpressure" ? "backpressured" : "refused";
      const recorded = record(source, cell, action.actionId, outcome, command.feedback.code);
      return recorded.ok ? command : recorded;
    }
    if (command.value.kind !== action.kind) {
      const recorded = record(source, cell, action.actionId, "refused", "controller-input-command-mismatch");
      return recorded.ok
        ? failed(
            "controller-input-command-mismatch",
            `Controller cell ${cell.toString()} resolves ${action.kind}, but the injected resolver returned ${command.value.kind}.`,
          )
        : recorded;
    }

    inFlight += 1;
    let dispatched: DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseControllerReadout>;
    try {
      dispatched = await options.dispatch(command.value);
    } catch {
      inFlight -= 1;
      const recorded = record(source, cell, action.actionId, "refused", "controller-input-dispatch-failed");
      return recorded.ok
        ? failed(
            "controller-input-dispatch-failed",
            "The injected semantic controller dispatch threw while handling a browser gesture.",
          )
        : recorded;
    }
    inFlight -= 1;
    if (!dispatched.ok) {
      const outcome = dispatched.feedback.severity === "backpressure" ? "backpressured" : "refused";
      const recorded = record(source, cell, action.actionId, outcome, dispatched.feedback.code);
      return recorded.ok
        ? failed(
            "controller-input-dispatch-failed",
            `${dispatched.feedback.code}: ${dispatched.feedback.detail}`,
            dispatched.feedback.severity,
          )
        : recorded;
    }
    return record(source, cell, action.actionId, "accepted", null);
  };

  const clicked: NativeListener = (event) => {
    const cell = pointerCell(event);
    if (cell === null) return;
    preventDefault(event);
    void dispatchCell(cell, pointerSource(event));
  };
  const keyed: NativeListener = (event) => {
    const cell = keyboardCell(event);
    if (cell === null) return;
    preventDefault(event);
    void dispatchCell(cell, "keyboard");
  };

  try {
    Reflect.apply(pointerTarget.add, pointerTarget.value, ["click", clicked]);
    Reflect.apply(keyboardTarget.add, keyboardTarget.value, ["keydown", keyed]);
  } catch {
    try {
      Reflect.apply(pointerTarget.remove, pointerTarget.value, ["click", clicked]);
      Reflect.apply(keyboardTarget.remove, keyboardTarget.value, ["keydown", keyed]);
    } catch {
      // The startup failure below remains the durable signal.
    }
    return failed("controller-input-listener-failed", "The browser refused controller input listener installation.");
  }

  const runtime: DarkHallBrowserControllerInputRuntime = {
    read,
    dispatchCell,
    stop: () => {
      if (stopped) return succeeded(read());
      if (inFlight > 0) {
        return failed(
          "controller-input-busy",
          "Browser controller input cannot stop while a semantic command remains in flight.",
          "backpressure",
        );
      }
      try {
        Reflect.apply(pointerTarget.remove, pointerTarget.value, ["click", clicked]);
        Reflect.apply(keyboardTarget.remove, keyboardTarget.value, ["keydown", keyed]);
      } catch {
        return failed("controller-input-listener-failed", "The browser refused controller input listener cleanup.");
      }
      stopped = true;
      const readout = read();
      try {
        const observed = options.observe(readout);
        return observed.ok
          ? succeeded(readout)
          : failed(
              "controller-input-observer-failed",
              `${observed.feedback.code}: ${observed.feedback.detail}`,
              observed.feedback.severity,
            );
      } catch {
        return failed(
          "controller-input-observer-failed",
          "The injected browser controller input observer threw while publishing its stopped readout.",
        );
      }
    },
  };

  try {
    const observed = options.observe(runtime.read());
    if (!observed.ok) {
      runtime.stop();
      return failed(
        "controller-input-observer-failed",
        `${observed.feedback.code}: ${observed.feedback.detail}`,
        observed.feedback.severity,
      );
    }
  } catch {
    runtime.stop();
    return failed(
      "controller-input-observer-failed",
      "The injected browser controller input observer threw during startup.",
    );
  }
  return succeeded(runtime);
}
