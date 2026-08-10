import { type BrowserZetaDbTabFeedback, type BrowserZetaDbTabResult } from "../browser-node/browser-zetadb-tab-runtime";
import { SLOT } from "../observe/grammar-16";
import type { ZetaDbDelta, ZetaDbFeedback, ZetaDbTickReadout } from "../zetadb/zeta-db-node";
import { zetaDbTickToDarkHallDatabaseReadout, type DarkHallDatabaseReadout } from "./darkhall-database-readout";

export const DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA = "zeta.darkhall.browser-database-controller.v1" as const;

export type DarkHallBrowserDatabaseCommand =
  | { readonly kind: "inspect" }
  | { readonly kind: "refresh" }
  | {
      readonly kind: "emit";
      readonly eventId: string;
      readonly rowKey: string;
      readonly payload: string;
      readonly magnitude?: number;
    }
  | {
      readonly kind: "retract";
      readonly eventId: string;
      readonly rowKey: string;
      readonly payload: string;
      readonly magnitude?: number;
    };

export interface DarkHallBrowserDatabaseAction {
  readonly kind: DarkHallBrowserDatabaseCommand["kind"];
  readonly cell: number;
  readonly actionId: string;
  readonly label: string;
  readonly actionClass: string;
}

const DATABASE_ACTION_BY_KIND: Readonly<Record<DarkHallBrowserDatabaseCommand["kind"], DarkHallBrowserDatabaseAction>> =
  {
    emit: { kind: "emit", cell: SLOT.ACCEPT, actionId: "darkhall.database.emit", label: "emit", actionClass: "commit" },
    inspect: {
      kind: "inspect",
      cell: SLOT.INSPECT,
      actionId: "darkhall.database.inspect",
      label: "inspect",
      actionClass: "read",
    },
    retract: {
      kind: "retract",
      cell: SLOT.UNDO_RETRACT,
      actionId: "darkhall.database.retract",
      label: "retract",
      actionClass: "minus",
    },
    refresh: {
      kind: "refresh",
      cell: SLOT.REFRESH,
      actionId: "darkhall.database.refresh",
      label: "refresh",
      actionClass: "read",
    },
  };

export const DARK_HALL_BROWSER_DATABASE_ACTIONS: readonly DarkHallBrowserDatabaseAction[] = [
  DATABASE_ACTION_BY_KIND.emit,
  DATABASE_ACTION_BY_KIND.inspect,
  DATABASE_ACTION_BY_KIND.retract,
  DATABASE_ACTION_BY_KIND.refresh,
];

export interface DarkHallBrowserDatabaseControllerReadout {
  readonly schema: typeof DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA;
  readonly kind: DarkHallBrowserDatabaseCommand["kind"];
  readonly cell: number;
  readonly actionId: string;
  readonly deltaCount: number;
  readonly signedWeight: number;
  readonly database: DarkHallDatabaseReadout;
}

export interface DarkHallBrowserDatabaseControllerFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "database-controller-configuration-invalid"
    | "database-controller-command-invalid"
    | "database-controller-command-too-large"
    | "database-controller-executor-threw"
    | "database-controller-observer-failed"
    | "database-controller-stopped";
  readonly detail: string;
}

export type DarkHallBrowserDatabaseControllerResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly feedback: DarkHallBrowserDatabaseControllerFeedback | BrowserZetaDbTabFeedback | ZetaDbFeedback;
    };

export type DarkHallBrowserDatabaseControllerEdgeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly feedback: {
        readonly severity: "backpressure" | "heat";
        readonly code: string;
        readonly detail: string;
      };
    };

export interface DarkHallBrowserDatabaseControllerOptions {
  readonly maxCommandBytes: number;
  readonly tick: (deltas: readonly ZetaDbDelta[]) => Promise<BrowserZetaDbTabResult<ZetaDbTickReadout>>;
  readonly observe: (readout: DarkHallBrowserDatabaseControllerReadout) => DarkHallBrowserDatabaseControllerEdgeResult;
}

export interface DarkHallBrowserDatabaseControllerRuntime {
  dispatch(
    command: DarkHallBrowserDatabaseCommand,
  ): Promise<DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseControllerReadout>>;
  stop(): DarkHallBrowserDatabaseControllerResult<null>;
}

function succeeded<T>(value: T): DarkHallBrowserDatabaseControllerResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserDatabaseControllerFeedback["code"],
  detail: string,
  severity: DarkHallBrowserDatabaseControllerFeedback["severity"] = "heat",
): DarkHallBrowserDatabaseControllerResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) return true;
  }
  return false;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !hasControlCharacter(value);
}

function descriptor(kind: DarkHallBrowserDatabaseCommand["kind"]): DarkHallBrowserDatabaseAction {
  return DATABASE_ACTION_BY_KIND[kind];
}

function commandDelta(
  command: unknown,
  maxCommandBytes: number,
): DarkHallBrowserDatabaseControllerResult<readonly ZetaDbDelta[]> {
  if (!isRecord(command) || typeof command.kind !== "string") {
    return failed(
      "database-controller-command-invalid",
      "A database controller command must be an object with a kind.",
    );
  }
  if (command.kind === "inspect" || command.kind === "refresh") return succeeded([]);
  if (
    (command.kind !== "emit" && command.kind !== "retract") ||
    !isIdentifier(command.eventId) ||
    !isIdentifier(command.rowKey) ||
    typeof command.payload !== "string"
  ) {
    return failed(
      "database-controller-command-invalid",
      "Emit and retract commands require printable event and row identifiers plus a string payload.",
    );
  }

  const magnitudeValue = command.magnitude;
  const magnitude = magnitudeValue === undefined ? 1 : magnitudeValue;
  if (typeof magnitude !== "number" || !Number.isSafeInteger(magnitude) || magnitude <= 0) {
    return failed(
      "database-controller-command-invalid",
      "A database command magnitude must be a positive safe integer.",
    );
  }
  const delta: ZetaDbDelta = {
    eventId: command.eventId,
    rowKey: command.rowKey,
    payload: command.payload,
    weight: command.kind === "emit" ? magnitude : -magnitude,
  };
  let encodedBytes: number;
  try {
    encodedBytes = new TextEncoder().encode(JSON.stringify(delta)).byteLength;
  } catch {
    return failed("database-controller-command-invalid", "The database command could not be encoded.");
  }
  if (encodedBytes > maxCommandBytes) {
    return failed(
      "database-controller-command-too-large",
      `The database command requires ${encodedBytes.toString()} bytes; the controller budget is ${maxCommandBytes.toString()} bytes.`,
      "backpressure",
    );
  }
  return succeeded([delta]);
}

/** Own the semantic-command to signed-delta boundary for one active browser page. */
export function startDarkHallBrowserDatabaseController(
  options: DarkHallBrowserDatabaseControllerOptions,
): DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseControllerRuntime> {
  if (!Number.isSafeInteger(options.maxCommandBytes) || options.maxCommandBytes <= 0) {
    return failed(
      "database-controller-configuration-invalid",
      "A browser database controller requires a positive safe-integer command byte budget.",
    );
  }

  let stopped = false;
  return succeeded({
    dispatch: async (command) => {
      if (stopped) return failed("database-controller-stopped", "The browser database controller has stopped.");
      const deltas = commandDelta(command, options.maxCommandBytes);
      if (!deltas.ok) return deltas;

      let tick: BrowserZetaDbTabResult<ZetaDbTickReadout>;
      try {
        tick = await options.tick(deltas.value);
      } catch {
        return failed(
          "database-controller-executor-threw",
          "The injected browser database tick threw while executing a controller command.",
        );
      }
      if (!tick.ok) return tick;

      const action = descriptor(command.kind);
      const readout: DarkHallBrowserDatabaseControllerReadout = {
        schema: DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA,
        kind: command.kind,
        cell: action.cell,
        actionId: action.actionId,
        deltaCount: deltas.value.length,
        signedWeight: deltas.value.reduce((sum, delta) => sum + delta.weight, 0),
        database: zetaDbTickToDarkHallDatabaseReadout(tick.value),
      };
      try {
        const observed = options.observe(readout);
        if (!observed.ok) {
          return failed(
            "database-controller-observer-failed",
            `${observed.feedback.code}: ${observed.feedback.detail}`,
            observed.feedback.severity,
          );
        }
      } catch {
        return failed(
          "database-controller-observer-failed",
          "The injected browser database controller observer threw after command execution.",
        );
      }
      return succeeded(readout);
    },
    stop: () => {
      if (stopped) return succeeded(null);
      stopped = true;
      return succeeded(null);
    },
  });
}
