export type HeatSignal =
  | "forgotten"
  | "backpressure"
  | "denied"
  | "storage-error"
  | "invalid"
  | "expired"
  | "stale"
  | "other";

export const HEAT_READOUT_SCHEMA = "zeta.heat.readout.v1";
export const HEAT_SIGNAL_TREATY_PATH = "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json";
export const HEAT_SIGNAL_QSHARP_SOURCE = "src/Core.QSharp.ReferenceOracle/HeatSignals.qs";
export const HEAT_FSHARP_SURFACE = "src/Core/Heat.fs";

export interface HeatRow {
  readonly tick: number;
  readonly roomName: string;
  readonly heatRejected: number;
  readonly backpressured: number;
  readonly storageErrors: number;
  readonly heatKinds: readonly string[];
  readonly signals?: readonly string[];
  readonly reasons: readonly string[];
}

export interface HeatSummary {
  readonly rows: number;
  readonly heatRejected: number;
  readonly backpressured: number;
  readonly storageErrors: number;
  readonly heatKinds: readonly string[];
  readonly signals: readonly HeatSignal[];
}

export interface HeatReadout extends HeatSummary {
  readonly schema: typeof HEAT_READOUT_SCHEMA;
  readonly qsharpTreaty: typeof HEAT_SIGNAL_TREATY_PATH;
  readonly qsharpSource: typeof HEAT_SIGNAL_QSHARP_SOURCE;
  readonly reasons: readonly string[];
}

function distinct<T>(values: readonly T[]): readonly T[] {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

export function classifyHeatKind(kind: string): HeatSignal {
  const normalized = kind.toLowerCase();

  if (normalized.includes("forgotten") || normalized.includes("forget") || normalized.includes("prune")) {
    return "forgotten";
  }

  if (normalized.includes("backpressure")) {
    return "backpressure";
  }

  if (normalized.includes("denied") || normalized.includes("reject")) {
    return "denied";
  }

  if (normalized.includes("storage")) {
    return "storage-error";
  }

  if (normalized.includes("invalid") || normalized.includes("decode") || normalized.includes("parse")) {
    return "invalid";
  }

  if (normalized.includes("expired") || normalized.includes("expire") || normalized.includes("ttl")) {
    return "expired";
  }

  if (normalized.includes("stale")) {
    return "stale";
  }

  return "other";
}

export function heatSignalsFromKinds(kinds: readonly string[]): readonly HeatSignal[] {
  return distinct(kinds.map(classifyHeatKind));
}

function normalizeHeatSignal(signal: string): HeatSignal {
  switch (signal) {
    case "forgotten":
    case "backpressure":
    case "denied":
    case "storage-error":
    case "invalid":
    case "expired":
    case "stale":
    case "other":
      return signal;
    default:
      return "other";
  }
}

export function normalizeHeatSignals(signals: readonly string[] | undefined): readonly HeatSignal[] | undefined {
  return signals === undefined ? undefined : distinct(signals.map(normalizeHeatSignal));
}

export function heatSignals(row: HeatRow): readonly HeatSignal[] {
  const supplied = normalizeHeatSignals(row.signals);
  if (supplied !== undefined) {
    return supplied;
  }

  const inferred: HeatSignal[] = [...heatSignalsFromKinds(row.heatKinds)];

  if (row.backpressured > 0 && !inferred.includes("backpressure") && !inferred.includes("denied")) {
    inferred.push("backpressure");
  }

  if (row.storageErrors > 0 && !inferred.includes("storage-error")) {
    inferred.push("storage-error");
  }

  return distinct(inferred);
}

export function summarizeHeatRows(rows: readonly HeatRow[]): HeatSummary {
  return {
    rows: rows.length,
    heatRejected: rows.reduce((sum, row) => sum + row.heatRejected, 0),
    backpressured: rows.reduce((sum, row) => sum + row.backpressured, 0),
    storageErrors: rows.reduce((sum, row) => sum + row.storageErrors, 0),
    heatKinds: distinct(rows.flatMap((row) => row.heatKinds)),
    signals: distinct(rows.flatMap(heatSignals)),
  };
}
