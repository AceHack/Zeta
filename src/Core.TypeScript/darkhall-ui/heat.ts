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
export const TEMPERATURE_READOUT_SCHEMA = "zeta.temperature.readout.v1";
export const BLACK_BODY_READOUT_SCHEMA = "zeta.blackbody.readout.v1";
export const HEAT_SIGNAL_TREATY_PATH = "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json";
export const HEAT_SIGNAL_QSHARP_SOURCE = "src/Core.QSharp.ReferenceOracle/HeatSignals.qs";
export const HEAT_FSHARP_SURFACE = "src/Core/Heat.fs";
export const TEMPERATURE_REFERENCE_ORACLE = "fsharp-blackbody-reference";
export const MAX_TEMPERATURE_PPM = 1_000_000;
export const WARM_TEMPERATURE_MAX_PPM = 333_333;
export const HOT_TEMPERATURE_MAX_PPM = 666_666;

export type TemperatureBand = "cold" | "warm" | "hot" | "critical";

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

export interface TemperatureReadout {
  readonly schema: typeof TEMPERATURE_READOUT_SCHEMA;
  readonly source: string;
  readonly temperaturePpm: number;
  readonly band: TemperatureBand;
  readonly heatPpm: number;
  readonly uncertaintyPpm: number;
  readonly pressurePpm: number;
  readonly attentionPpm: number;
}

export interface BlackBodyReadout {
  readonly schema: typeof BLACK_BODY_READOUT_SCHEMA;
  readonly source: string;
  readonly temperaturePpm: number;
  readonly radiancePpm: number;
  readonly peakFrequencyPpm: number;
}

export interface TemperatureTreatyBundle {
  readonly heatReadoutSchema: typeof HEAT_READOUT_SCHEMA;
  readonly temperatureReadoutSchema: typeof TEMPERATURE_READOUT_SCHEMA;
  readonly blackBodyReadoutSchema: typeof BLACK_BODY_READOUT_SCHEMA;
  readonly qsharpTreaty: typeof HEAT_SIGNAL_TREATY_PATH;
  readonly qsharpSource: typeof HEAT_SIGNAL_QSHARP_SOURCE;
  readonly fsharpSurface: typeof HEAT_FSHARP_SURFACE;
  readonly referenceOracle: string;
  readonly referenceFeedback: readonly string[];
  readonly temperature: TemperatureReadout;
  readonly blackBody: BlackBodyReadout;
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

export function clampTemperaturePpm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_TEMPERATURE_PPM, Math.trunc(value));
}

export function temperatureBand(temperaturePpm: number): TemperatureBand {
  const ppm = clampTemperaturePpm(temperaturePpm);
  if (ppm === 0) return "cold";
  if (ppm <= WARM_TEMPERATURE_MAX_PPM) return "warm";
  if (ppm <= HOT_TEMPERATURE_MAX_PPM) return "hot";
  return "critical";
}

export function thermalPpm(heatPpm: number, uncertaintyPpm: number, pressurePpm: number): number {
  return Math.max(clampTemperaturePpm(heatPpm), clampTemperaturePpm(uncertaintyPpm), clampTemperaturePpm(pressurePpm));
}

export function temperatureReadout(input: {
  readonly source: string;
  readonly heatPpm: number;
  readonly uncertaintyPpm: number;
  readonly pressurePpm: number;
  readonly attentionPpm: number;
}): TemperatureReadout {
  const heatPpm = clampTemperaturePpm(input.heatPpm);
  const uncertaintyPpm = clampTemperaturePpm(input.uncertaintyPpm);
  const pressurePpm = clampTemperaturePpm(input.pressurePpm);
  const attentionPpm = clampTemperaturePpm(input.attentionPpm);
  const temperaturePpm = thermalPpm(heatPpm, uncertaintyPpm, pressurePpm);

  return {
    schema: TEMPERATURE_READOUT_SCHEMA,
    source: input.source,
    temperaturePpm,
    band: temperatureBand(temperaturePpm),
    heatPpm,
    uncertaintyPpm,
    pressurePpm,
    attentionPpm,
  };
}

export function blackBodyRadiancePpm(temperaturePpm: number): number {
  const temperature = clampTemperaturePpm(temperaturePpm);
  const square = Math.floor((temperature * temperature) / MAX_TEMPERATURE_PPM);
  return Math.floor((square * square) / MAX_TEMPERATURE_PPM);
}

export function blackBodyPeakFrequencyPpm(temperaturePpm: number): number {
  return clampTemperaturePpm(temperaturePpm);
}

export function blackBodyReadout(input: { readonly source: string; readonly temperaturePpm: number }): BlackBodyReadout {
  const temperaturePpm = clampTemperaturePpm(input.temperaturePpm);

  return {
    schema: BLACK_BODY_READOUT_SCHEMA,
    source: input.source,
    temperaturePpm,
    radiancePpm: blackBodyRadiancePpm(temperaturePpm),
    peakFrequencyPpm: blackBodyPeakFrequencyPpm(temperaturePpm),
  };
}

export function temperatureTreatyBundle(input: {
  readonly temperature: TemperatureReadout;
  readonly blackBody?: BlackBodyReadout;
  readonly referenceOracle?: string;
  readonly referenceFeedback?: readonly string[];
}): TemperatureTreatyBundle {
  const blackBody =
    input.blackBody ?? blackBodyReadout({ source: input.temperature.source, temperaturePpm: input.temperature.temperaturePpm });

  return {
    heatReadoutSchema: HEAT_READOUT_SCHEMA,
    temperatureReadoutSchema: TEMPERATURE_READOUT_SCHEMA,
    blackBodyReadoutSchema: BLACK_BODY_READOUT_SCHEMA,
    qsharpTreaty: HEAT_SIGNAL_TREATY_PATH,
    qsharpSource: HEAT_SIGNAL_QSHARP_SOURCE,
    fsharpSurface: HEAT_FSHARP_SURFACE,
    referenceOracle: input.referenceOracle ?? TEMPERATURE_REFERENCE_ORACLE,
    referenceFeedback: input.referenceFeedback ?? [],
    temperature: input.temperature,
    blackBody,
  };
}
