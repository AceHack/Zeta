import { type BrowserZetaDbTabFeedback, type BrowserZetaDbTabResult } from "../browser-node/browser-zetadb-tab-runtime";
import { SLOT } from "../observe/grammar-16";
import type { ZetaDbDelta, ZetaDbFeedback, ZetaDbTickReadout } from "../zetadb/zeta-db-node";
import {
  DARK_HALL_DATABASE_ROW_SELECTION_TOKEN_SCHEMA,
  zetaDbTickToDarkHallDatabaseReadout,
  type DarkHallDatabaseReadout,
  type DarkHallDatabaseRowSelectionToken,
} from "./darkhall-database-readout";

export const DARK_HALL_BROWSER_DATABASE_CONTROLLER_SCHEMA = "zeta.darkhall.browser-database-controller.v2" as const;

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
    }
  | {
      readonly kind: "replace";
      readonly expected: DarkHallDatabaseRowSelectionToken;
      readonly retractEventId: string;
      readonly emitEventId: string;
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
    replace: {
      kind: "replace",
      cell: SLOT.EDIT_GRAMMAR,
      actionId: "darkhall.database.replace",
      label: "replace",
      actionClass: "branch",
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
  DATABASE_ACTION_BY_KIND.replace,
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
  readonly databaseNodeId: string;
  readonly maxCommandBytes: number;
  readonly tick: (deltas: readonly ZetaDbDelta[]) => Promise<BrowserZetaDbTabResult<ZetaDbTickReadout>>;
  readonly compareAndSwap: (
    expectedRevision: number,
    deltas: readonly ZetaDbDelta[],
  ) => Promise<BrowserZetaDbTabResult<ZetaDbTickReadout>>;
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

interface DarkHallBrowserDatabaseCommandPlan {
  readonly deltas: readonly ZetaDbDelta[];
  readonly expectedRevision: number | null;
}

function positiveMagnitude(value: unknown): number | null {
  const magnitude = value === undefined ? 1 : value;
  return typeof magnitude === "number" && Number.isSafeInteger(magnitude) && magnitude > 0 ? magnitude : null;
}

function encodedPlan(
  deltas: readonly ZetaDbDelta[],
  expectedRevision: number | null,
  maxCommandBytes: number,
): DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseCommandPlan> {
  let encodedBytes: number;
  try {
    encodedBytes = new TextEncoder().encode(JSON.stringify(deltas)).byteLength;
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
  return succeeded({ deltas, expectedRevision });
}

function commandPlan(
  command: unknown,
  databaseNodeId: string,
  maxCommandBytes: number,
): DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseCommandPlan> {
  if (!isRecord(command) || typeof command.kind !== "string") {
    return failed(
      "database-controller-command-invalid",
      "A database controller command must be an object with a kind.",
    );
  }
  if (command.kind === "inspect" || command.kind === "refresh")
    return succeeded({ deltas: [], expectedRevision: null });
  if (command.kind === "replace") {
    const expected = command.expected;
    const magnitude = positiveMagnitude(command.magnitude);
    if (
      !isRecord(expected) ||
      expected.schema !== DARK_HALL_DATABASE_ROW_SELECTION_TOKEN_SCHEMA ||
      expected.nodeId !== databaseNodeId ||
      typeof expected.revision !== "number" ||
      !Number.isSafeInteger(expected.revision) ||
      expected.revision < 0 ||
      !isRecord(expected.row) ||
      !isIdentifier(expected.row.rowKey) ||
      typeof expected.row.payload !== "string" ||
      typeof expected.row.weight !== "number" ||
      !Number.isSafeInteger(expected.row.weight) ||
      expected.row.weight === 0 ||
      !isIdentifier(command.retractEventId) ||
      !isIdentifier(command.emitEventId) ||
      command.retractEventId === command.emitEventId ||
      !isIdentifier(command.rowKey) ||
      typeof command.payload !== "string" ||
      magnitude === null
    ) {
      return failed(
        "database-controller-command-invalid",
        "A replace command requires versioned row evidence, two distinct event identifiers, and a valid replacement row.",
      );
    }
    const sign = expected.row.weight < 0 ? -1 : 1;
    return encodedPlan(
      [
        {
          eventId: command.retractEventId,
          rowKey: expected.row.rowKey,
          payload: expected.row.payload,
          weight: -expected.row.weight,
        },
        {
          eventId: command.emitEventId,
          rowKey: command.rowKey,
          payload: command.payload,
          weight: sign * magnitude,
        },
      ],
      expected.revision,
      maxCommandBytes,
    );
  }
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

  const magnitude = positiveMagnitude(command.magnitude);
  if (magnitude === null) {
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
  return encodedPlan([delta], null, maxCommandBytes);
}

/** Own the semantic-command to signed-delta boundary for one active browser page. */
export function startDarkHallBrowserDatabaseController(
  options: DarkHallBrowserDatabaseControllerOptions,
): DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseControllerRuntime> {
  if (
    !isIdentifier(options.databaseNodeId) ||
    !Number.isSafeInteger(options.maxCommandBytes) ||
    options.maxCommandBytes <= 0
  ) {
    return failed(
      "database-controller-configuration-invalid",
      "A browser database controller requires a positive safe-integer command byte budget.",
    );
  }

  let stopped = false;
  return succeeded({
    dispatch: async (command) => {
      if (stopped) return failed("database-controller-stopped", "The browser database controller has stopped.");
      const plan = commandPlan(command, options.databaseNodeId, options.maxCommandBytes);
      if (!plan.ok) return plan;

      let tick: BrowserZetaDbTabResult<ZetaDbTickReadout>;
      try {
        tick =
          plan.value.expectedRevision === null
            ? await options.tick(plan.value.deltas)
            : await options.compareAndSwap(plan.value.expectedRevision, plan.value.deltas);
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
        deltaCount: plan.value.deltas.length,
        signedWeight: plan.value.deltas.reduce((sum, delta) => sum + delta.weight, 0),
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
