import { compareQuantumObservableRow } from "./types";
import type {
  BellCoincidence,
  BellCorner,
  CanonicalChsh,
  ChshAngles,
  ChshCorrelators,
  InterferenceVisibility,
  Probabilities,
  QuantumObservableDelta,
  QuantumObservableRow,
  SingleQubitMeasurement,
  SingletChsh,
} from "./types";

export interface Observable {
  readonly Room: string;
  readonly Source: string;
  readonly Name: string;
  readonly Value: number;
  readonly Norm: number;
  readonly Support: number;
  readonly Sequence: bigint;
}

export interface ObservableDelta {
  readonly source: string;
  readonly sequence: number;
  readonly row: QuantumObservableRow;
  readonly weight: number;
}

export interface ConsolidatedObservableDelta {
  readonly row: QuantumObservableRow;
  readonly weight: number;
}

export interface PacketError {
  readonly type: "Malformed";
  readonly reason: string;
}

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

const SCHEMA = "zeta-reticulum-observable/v1";
const DELTA_SCHEMA = "zeta-reticulum-quantum-observable-delta/v1";

interface WireProbabilities {
  readonly zero: number;
  readonly one: number;
}

interface WireSingleQubitMeasurement {
  readonly id: string;
  readonly operation: string;
  readonly thetaRadians: number | null;
  readonly probabilities: WireProbabilities;
}

interface WireChshAngles {
  readonly a: number;
  readonly aPrime: number;
  readonly b: number;
  readonly bPrime: number;
}

interface WireChshCorrelators {
  readonly eAB: number;
  readonly eABPrime: number;
  readonly eAPrimeB: number;
  readonly eAPrimeBPrime: number;
}

interface WireCanonicalChsh {
  readonly id: string;
  readonly angles: WireChshAngles;
  readonly correlators: WireChshCorrelators;
  readonly s: number;
  readonly tsirelson: number;
  readonly classicalBound: number;
}

interface WireBellCorner {
  readonly id: string;
  readonly operation: string;
  readonly a: number;
  readonly b: number;
  readonly coefficient: number;
  readonly sameOutcomeProbability: number;
  readonly oppositeOutcomeProbability: number;
  readonly correlator: number;
}

interface WireSingletChsh {
  readonly id: string;
  readonly corners: readonly WireBellCorner[];
  readonly s: number;
  readonly analytic: number;
  readonly classicalBound: number;
}

interface WireBellCoincidence {
  readonly id: string;
  readonly state: string;
  readonly operation: string;
  readonly a: number;
  readonly b: number;
  readonly event: string;
  readonly probability: number;
}

interface WireInterferenceVisibility {
  readonly id: string;
  readonly operation: string;
  readonly phaseRadians: number | null;
  readonly probabilities: WireProbabilities;
  readonly visibility: number | null;
}

type WireQuantumObservableRow =
  | { readonly type: "SingleQubit"; readonly value: WireSingleQubitMeasurement }
  | { readonly type: "CanonicalChsh"; readonly value: WireCanonicalChsh }
  | { readonly type: "SingletChsh"; readonly value: WireSingletChsh }
  | { readonly type: "BellCorner"; readonly value: WireBellCorner }
  | { readonly type: "BellCoincidence"; readonly value: WireBellCoincidence }
  | { readonly type: "InterferenceVisibility"; readonly value: WireInterferenceVisibility };

interface WireObservableDelta {
  readonly source: string;
  readonly sequence: number;
  readonly row: WireQuantumObservableRow;
  readonly weight: number;
}

function ok<T>(value: T): Result<T, PacketError> {
  return { ok: true, value };
}

function malformed<T>(reason: string): Result<T, PacketError> {
  return { ok: false, error: { type: "Malformed", reason } };
}

function escapeDataString(str: string): string {
  // Matches .NET's Uri.EscapeDataString which complies with RFC 3986,
  // escaping extra characters that encodeURIComponent leaves unescaped: ! ' ( ) *
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function unescapeDataString(str: string): string {
  return decodeURIComponent(str);
}

function toWireOptionalNumber(value: number | undefined): number | null {
  return value ?? null;
}

function fromWireOptionalNumber(value: number | null | undefined): number | undefined {
  return value === null ? undefined : value;
}

function toWireProbabilities(value: Probabilities): WireProbabilities {
  return { zero: value.Zero, one: value.One };
}

function fromWireProbabilities(value: WireProbabilities): Probabilities {
  return { Zero: value.zero, One: value.one };
}

function toWireChshAngles(value: ChshAngles): WireChshAngles {
  return {
    a: value.A,
    aPrime: value.APrime,
    b: value.B,
    bPrime: value.BPrime,
  };
}

function fromWireChshAngles(value: WireChshAngles): ChshAngles {
  return {
    A: value.a,
    APrime: value.aPrime,
    B: value.b,
    BPrime: value.bPrime,
  };
}

function toWireChshCorrelators(value: ChshCorrelators): WireChshCorrelators {
  return {
    eAB: value.EAB,
    eABPrime: value.EABPrime,
    eAPrimeB: value.EAPrimeB,
    eAPrimeBPrime: value.EAPrimeBPrime,
  };
}

function fromWireChshCorrelators(value: WireChshCorrelators): ChshCorrelators {
  return {
    EAB: value.eAB,
    EABPrime: value.eABPrime,
    EAPrimeB: value.eAPrimeB,
    EAPrimeBPrime: value.eAPrimeBPrime,
  };
}

function toWireBellCorner(value: BellCorner): WireBellCorner {
  return {
    id: value.Id,
    operation: value.Operation,
    a: value.A,
    b: value.B,
    coefficient: value.Coefficient,
    sameOutcomeProbability: value.SameOutcomeProbability,
    oppositeOutcomeProbability: value.OppositeOutcomeProbability,
    correlator: value.Correlator,
  };
}

function fromWireBellCorner(value: WireBellCorner): BellCorner {
  return {
    Id: value.id,
    Operation: value.operation,
    A: value.a,
    B: value.b,
    Coefficient: value.coefficient,
    SameOutcomeProbability: value.sameOutcomeProbability,
    OppositeOutcomeProbability: value.oppositeOutcomeProbability,
    Correlator: value.correlator,
  };
}

function toWireQuantumObservableRow(row: QuantumObservableRow): WireQuantumObservableRow {
  switch (row.type) {
    case "SingleQubit": {
      const v = row.value;
      return {
        type: "SingleQubit",
        value: {
          id: v.Id,
          operation: v.Operation,
          thetaRadians: toWireOptionalNumber(v.ThetaRadians),
          probabilities: toWireProbabilities(v.Probabilities),
        },
      };
    }
    case "CanonicalChsh": {
      const v = row.value;
      return {
        type: "CanonicalChsh",
        value: {
          id: v.Id,
          angles: toWireChshAngles(v.Angles),
          correlators: toWireChshCorrelators(v.Correlators),
          s: v.S,
          tsirelson: v.Tsirelson,
          classicalBound: v.ClassicalBound,
        },
      };
    }
    case "SingletChsh": {
      const v = row.value;
      return {
        type: "SingletChsh",
        value: {
          id: v.Id,
          corners: v.Corners.map(toWireBellCorner),
          s: v.S,
          analytic: v.Analytic,
          classicalBound: v.ClassicalBound,
        },
      };
    }
    case "BellCorner":
      return { type: "BellCorner", value: toWireBellCorner(row.value) };
    case "BellCoincidence": {
      const v = row.value;
      return {
        type: "BellCoincidence",
        value: {
          id: v.Id,
          state: v.State,
          operation: v.Operation,
          a: v.A,
          b: v.B,
          event: v.Event,
          probability: v.Probability,
        },
      };
    }
    case "InterferenceVisibility": {
      const v = row.value;
      return {
        type: "InterferenceVisibility",
        value: {
          id: v.Id,
          operation: v.Operation,
          phaseRadians: toWireOptionalNumber(v.PhaseRadians),
          probabilities: toWireProbabilities(v.Probabilities),
          visibility: toWireOptionalNumber(v.Visibility),
        },
      };
    }
  }
}

function fromWireQuantumObservableRow(row: WireQuantumObservableRow): QuantumObservableRow {
  switch (row.type) {
    case "SingleQubit": {
      const v: SingleQubitMeasurement = {
        Id: row.value.id,
        Operation: row.value.operation,
        ThetaRadians: fromWireOptionalNumber(row.value.thetaRadians),
        Probabilities: fromWireProbabilities(row.value.probabilities),
      };
      return { type: "SingleQubit", value: v };
    }
    case "CanonicalChsh": {
      const v: CanonicalChsh = {
        Id: row.value.id,
        Angles: fromWireChshAngles(row.value.angles),
        Correlators: fromWireChshCorrelators(row.value.correlators),
        S: row.value.s,
        Tsirelson: row.value.tsirelson,
        ClassicalBound: row.value.classicalBound,
      };
      return { type: "CanonicalChsh", value: v };
    }
    case "SingletChsh": {
      const v: SingletChsh = {
        Id: row.value.id,
        Corners: row.value.corners.map(fromWireBellCorner),
        S: row.value.s,
        Analytic: row.value.analytic,
        ClassicalBound: row.value.classicalBound,
      };
      return { type: "SingletChsh", value: v };
    }
    case "BellCorner":
      return { type: "BellCorner", value: fromWireBellCorner(row.value) };
    case "BellCoincidence": {
      const v: BellCoincidence = {
        Id: row.value.id,
        State: row.value.state,
        Operation: row.value.operation,
        A: row.value.a,
        B: row.value.b,
        Event: row.value.event,
        Probability: row.value.probability,
      };
      return { type: "BellCoincidence", value: v };
    }
    case "InterferenceVisibility": {
      const v: InterferenceVisibility = {
        Id: row.value.id,
        Operation: row.value.operation,
        PhaseRadians: fromWireOptionalNumber(row.value.phaseRadians),
        Probabilities: fromWireProbabilities(row.value.probabilities),
        Visibility: fromWireOptionalNumber(row.value.visibility),
      };
      return { type: "InterferenceVisibility", value: v };
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(parent: Record<string, unknown>, field: string): Result<Record<string, unknown>, PacketError> {
  const value = parent[field];
  if (!isRecord(value)) {
    return malformed(field);
  }
  return ok(value);
}

function readString(parent: Record<string, unknown>, field: string): Result<string, PacketError> {
  const value = parent[field];
  if (typeof value !== "string") {
    return malformed(field);
  }
  return ok(value);
}

function readNumber(parent: Record<string, unknown>, field: string): Result<number, PacketError> {
  const value = parent[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return malformed(field);
  }
  return ok(value);
}

function readOptionalNumber(parent: Record<string, unknown>, field: string): Result<number | null, PacketError> {
  const value = parent[field];
  if (value === null) {
    return ok(null);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return ok(value);
  }
  return malformed(field);
}

function readInteger(parent: Record<string, unknown>, field: string): Result<number, PacketError> {
  const value = readNumber(parent, field);
  if (!value.ok) return value;
  if (!Number.isSafeInteger(value.value)) {
    return malformed(field);
  }
  return value;
}

function readProbabilities(value: Record<string, unknown>): Result<WireProbabilities, PacketError> {
  const zero = readNumber(value, "zero");
  if (!zero.ok) return zero;
  const one = readNumber(value, "one");
  if (!one.ok) return one;
  return ok({ zero: zero.value, one: one.value });
}

function readChshAngles(value: Record<string, unknown>): Result<WireChshAngles, PacketError> {
  const a = readNumber(value, "a");
  if (!a.ok) return a;
  const aPrime = readNumber(value, "aPrime");
  if (!aPrime.ok) return aPrime;
  const b = readNumber(value, "b");
  if (!b.ok) return b;
  const bPrime = readNumber(value, "bPrime");
  if (!bPrime.ok) return bPrime;
  return ok({ a: a.value, aPrime: aPrime.value, b: b.value, bPrime: bPrime.value });
}

function readChshCorrelators(value: Record<string, unknown>): Result<WireChshCorrelators, PacketError> {
  const eAB = readNumber(value, "eAB");
  if (!eAB.ok) return eAB;
  const eABPrime = readNumber(value, "eABPrime");
  if (!eABPrime.ok) return eABPrime;
  const eAPrimeB = readNumber(value, "eAPrimeB");
  if (!eAPrimeB.ok) return eAPrimeB;
  const eAPrimeBPrime = readNumber(value, "eAPrimeBPrime");
  if (!eAPrimeBPrime.ok) return eAPrimeBPrime;
  return ok({
    eAB: eAB.value,
    eABPrime: eABPrime.value,
    eAPrimeB: eAPrimeB.value,
    eAPrimeBPrime: eAPrimeBPrime.value,
  });
}

function readBellCorner(value: Record<string, unknown>): Result<WireBellCorner, PacketError> {
  const id = readString(value, "id");
  if (!id.ok) return id;
  const operation = readString(value, "operation");
  if (!operation.ok) return operation;
  const a = readNumber(value, "a");
  if (!a.ok) return a;
  const b = readNumber(value, "b");
  if (!b.ok) return b;
  const coefficient = readInteger(value, "coefficient");
  if (!coefficient.ok) return coefficient;
  const sameOutcomeProbability = readNumber(value, "sameOutcomeProbability");
  if (!sameOutcomeProbability.ok) return sameOutcomeProbability;
  const oppositeOutcomeProbability = readNumber(value, "oppositeOutcomeProbability");
  if (!oppositeOutcomeProbability.ok) return oppositeOutcomeProbability;
  const correlator = readNumber(value, "correlator");
  if (!correlator.ok) return correlator;
  return ok({
    id: id.value,
    operation: operation.value,
    a: a.value,
    b: b.value,
    coefficient: coefficient.value,
    sameOutcomeProbability: sameOutcomeProbability.value,
    oppositeOutcomeProbability: oppositeOutcomeProbability.value,
    correlator: correlator.value,
  });
}

function readBellCornerArray(value: unknown): Result<readonly WireBellCorner[], PacketError> {
  if (!Array.isArray(value)) {
    return malformed("corners");
  }

  const corners: WireBellCorner[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return malformed("corners");
    }
    const corner = readBellCorner(item);
    if (!corner.ok) {
      return corner;
    }
    corners.push(corner.value);
  }

  return ok(corners);
}

function readSingleQubitRow(value: Record<string, unknown>): Result<WireQuantumObservableRow, PacketError> {
  const id = readString(value, "id");
  if (!id.ok) return id;
  const operation = readString(value, "operation");
  if (!operation.ok) return operation;
  const thetaRadians = readOptionalNumber(value, "thetaRadians");
  if (!thetaRadians.ok) return thetaRadians;
  const probabilitiesRecord = readRecord(value, "probabilities");
  if (!probabilitiesRecord.ok) return probabilitiesRecord;
  const probabilities = readProbabilities(probabilitiesRecord.value);
  if (!probabilities.ok) return probabilities;
  return ok({
    type: "SingleQubit",
    value: {
      id: id.value,
      operation: operation.value,
      thetaRadians: thetaRadians.value,
      probabilities: probabilities.value,
    },
  });
}

function readCanonicalChshRow(value: Record<string, unknown>): Result<WireQuantumObservableRow, PacketError> {
  const id = readString(value, "id");
  if (!id.ok) return id;
  const anglesRecord = readRecord(value, "angles");
  if (!anglesRecord.ok) return anglesRecord;
  const angles = readChshAngles(anglesRecord.value);
  if (!angles.ok) return angles;
  const correlatorsRecord = readRecord(value, "correlators");
  if (!correlatorsRecord.ok) return correlatorsRecord;
  const correlators = readChshCorrelators(correlatorsRecord.value);
  if (!correlators.ok) return correlators;
  const s = readNumber(value, "s");
  if (!s.ok) return s;
  const tsirelson = readNumber(value, "tsirelson");
  if (!tsirelson.ok) return tsirelson;
  const classicalBound = readNumber(value, "classicalBound");
  if (!classicalBound.ok) return classicalBound;
  return ok({
    type: "CanonicalChsh",
    value: {
      id: id.value,
      angles: angles.value,
      correlators: correlators.value,
      s: s.value,
      tsirelson: tsirelson.value,
      classicalBound: classicalBound.value,
    },
  });
}

function readSingletChshRow(value: Record<string, unknown>): Result<WireQuantumObservableRow, PacketError> {
  const id = readString(value, "id");
  if (!id.ok) return id;
  const corners = readBellCornerArray(value.corners);
  if (!corners.ok) return corners;
  const s = readNumber(value, "s");
  if (!s.ok) return s;
  const analytic = readNumber(value, "analytic");
  if (!analytic.ok) return analytic;
  const classicalBound = readNumber(value, "classicalBound");
  if (!classicalBound.ok) return classicalBound;
  return ok({
    type: "SingletChsh",
    value: {
      id: id.value,
      corners: corners.value,
      s: s.value,
      analytic: analytic.value,
      classicalBound: classicalBound.value,
    },
  });
}

function readBellCornerRow(value: Record<string, unknown>): Result<WireQuantumObservableRow, PacketError> {
  const corner = readBellCorner(value);
  if (!corner.ok) return corner;
  return ok({ type: "BellCorner", value: corner.value });
}

function readBellCoincidenceRow(value: Record<string, unknown>): Result<WireQuantumObservableRow, PacketError> {
  const id = readString(value, "id");
  if (!id.ok) return id;
  const state = readString(value, "state");
  if (!state.ok) return state;
  const operation = readString(value, "operation");
  if (!operation.ok) return operation;
  const a = readNumber(value, "a");
  if (!a.ok) return a;
  const b = readNumber(value, "b");
  if (!b.ok) return b;
  const event = readString(value, "event");
  if (!event.ok) return event;
  const probability = readNumber(value, "probability");
  if (!probability.ok) return probability;
  return ok({
    type: "BellCoincidence",
    value: {
      id: id.value,
      state: state.value,
      operation: operation.value,
      a: a.value,
      b: b.value,
      event: event.value,
      probability: probability.value,
    },
  });
}

function readInterferenceVisibilityRow(value: Record<string, unknown>): Result<WireQuantumObservableRow, PacketError> {
  const id = readString(value, "id");
  if (!id.ok) return id;
  const operation = readString(value, "operation");
  if (!operation.ok) return operation;
  const phaseRadians = readOptionalNumber(value, "phaseRadians");
  if (!phaseRadians.ok) return phaseRadians;
  const probabilitiesRecord = readRecord(value, "probabilities");
  if (!probabilitiesRecord.ok) return probabilitiesRecord;
  const probabilities = readProbabilities(probabilitiesRecord.value);
  if (!probabilities.ok) return probabilities;
  const visibility = readOptionalNumber(value, "visibility");
  if (!visibility.ok) return visibility;
  return ok({
    type: "InterferenceVisibility",
    value: {
      id: id.value,
      operation: operation.value,
      phaseRadians: phaseRadians.value,
      probabilities: probabilities.value,
      visibility: visibility.value,
    },
  });
}

function readWireQuantumObservableRow(value: unknown): Result<WireQuantumObservableRow, PacketError> {
  if (!isRecord(value)) {
    return malformed("row");
  }

  const typ = readString(value, "type");
  if (!typ.ok) return typ;
  const valueRecord = readRecord(value, "value");
  if (!valueRecord.ok) return valueRecord;

  switch (typ.value) {
    case "SingleQubit":
      return readSingleQubitRow(valueRecord.value);
    case "CanonicalChsh":
      return readCanonicalChshRow(valueRecord.value);
    case "SingletChsh":
      return readSingletChshRow(valueRecord.value);
    case "BellCorner":
      return readBellCornerRow(valueRecord.value);
    case "BellCoincidence":
      return readBellCoincidenceRow(valueRecord.value);
    case "InterferenceVisibility":
      return readInterferenceVisibilityRow(valueRecord.value);
    default:
      return malformed("row.type");
  }
}

function toWireObservableDelta(delta: ObservableDelta): WireObservableDelta {
  return {
    source: delta.source,
    sequence: delta.sequence,
    row: toWireQuantumObservableRow(delta.row),
    weight: delta.weight,
  };
}

function readWireObservableDelta(value: unknown): Result<WireObservableDelta, PacketError> {
  if (!isRecord(value)) {
    return malformed("delta");
  }

  const source = readString(value, "source");
  if (!source.ok) return source;
  const sequence = readInteger(value, "sequence");
  if (!sequence.ok) return sequence;
  const row = readWireQuantumObservableRow(value.row);
  if (!row.ok) return row;
  const weight = readInteger(value, "weight");
  if (!weight.ok) return weight;
  return ok({
    source: source.value,
    sequence: sequence.value,
    row: row.value,
    weight: weight.value,
  });
}

function fromWireObservableDelta(delta: WireObservableDelta): ObservableDelta {
  return {
    source: delta.source,
    sequence: delta.sequence,
    row: fromWireQuantumObservableRow(delta.row),
    weight: delta.weight,
  };
}

function rowKey(row: QuantumObservableRow): string {
  return JSON.stringify(toWireQuantumObservableRow(row));
}

/**
 * Encodes an Observable packet into a pipe-delimited string payload.
 */
export function encode(o: Observable): string {
  const parts = [
    SCHEMA,
    `room=${escapeDataString(o.Room)}`,
    `source=${escapeDataString(o.Source)}`,
    `name=${escapeDataString(o.Name)}`,
    `value=${o.Value.toString()}`,
    `norm=${o.Norm.toString()}`,
    `support=${o.Support.toString()}`,
    `sequence=${o.Sequence.toString()}`,
  ];
  return parts.join("|");
}

/**
 * Decodes a pipe-delimited string payload into an Observable packet.
 */
export function decode(payload: string): Result<Observable, PacketError> {
  const parts = payload.split("|");
  if (parts.length !== 8 || parts[0] !== SCHEMA) {
    return { ok: false, error: { type: "Malformed", reason: "schema" } };
  }

  const fields = new Map<string, string>();
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) {
      continue;
    }
    const eqIdx = part.indexOf("=");
    if (eqIdx > 0) {
      fields.set(part.substring(0, eqIdx), part.substring(eqIdx + 1));
    }
  }

  const getField = (name: string): Result<string, PacketError> => {
    const val = fields.get(name);
    if (val === undefined) {
      return { ok: false, error: { type: "Malformed", reason: `missing ${name}` } };
    }
    return { ok: true, value: val };
  };

  const parseNum = (name: string): Result<number, PacketError> => {
    const res = getField(name);
    if (!res.ok) return res;
    const num = Number(res.value);
    if (isNaN(num)) {
      return { ok: false, error: { type: "Malformed", reason: name } };
    }
    return { ok: true, value: num };
  };

  const parseBigInt = (name: string): Result<bigint, PacketError> => {
    const res = getField(name);
    if (!res.ok) return res;
    try {
      const val = BigInt(res.value);
      return { ok: true, value: val };
    } catch {
      return { ok: false, error: { type: "Malformed", reason: name } };
    }
  };

  const roomRes = getField("room");
  if (!roomRes.ok) return roomRes;

  const sourceRes = getField("source");
  if (!sourceRes.ok) return sourceRes;

  const nameRes = getField("name");
  if (!nameRes.ok) return nameRes;

  const valueRes = parseNum("value");
  if (!valueRes.ok) return valueRes;

  const normRes = parseNum("norm");
  if (!normRes.ok) return normRes;

  const supportRes = parseNum("support");
  if (!supportRes.ok) return supportRes;

  const seqRes = parseBigInt("sequence");
  if (!seqRes.ok) return seqRes;

  return {
    ok: true,
    value: {
      Room: unescapeDataString(roomRes.value),
      Source: unescapeDataString(sourceRes.value),
      Name: unescapeDataString(nameRes.value),
      Value: valueRes.value,
      Norm: normRes.value,
      Support: supportRes.value,
      Sequence: seqRes.value,
    },
  };
}

/**
 * Encodes a source-owned quantum DBSP delta into the Reticulum JSON wire
 * treaty used by the F# bridge. The TS oracle row remains PascalCase in memory;
 * the wire is the F#/System.Text.Json camelCase form.
 */
export function encodeDelta(delta: ObservableDelta): string {
  return JSON.stringify({
    schema: DELTA_SCHEMA,
    delta: toWireObservableDelta(delta),
  });
}

/**
 * Decodes a Reticulum quantum observable delta without surfacing JSON parser
 * exceptions to callers.
 */
export function decodeDelta(payload: string): Result<ObservableDelta, PacketError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    return malformed(error instanceof Error ? `json: ${error.message}` : "json");
  }

  if (!isRecord(parsed)) {
    return malformed("json");
  }

  let schema: unknown = parsed.schema;
  if (schema === undefined) {
    schema = parsed.Schema;
  }
  if (schema !== DELTA_SCHEMA) {
    return malformed("schema");
  }

  const deltaRaw = parsed.delta ?? parsed.Delta;
  const wire = readWireObservableDelta(deltaRaw);
  if (!wire.ok) {
    return wire;
  }

  return ok(fromWireObservableDelta(wire.value));
}

/**
 * Maps one source-owned QuantumObservableDelta into a Reticulum delta packet.
 */
export function ofQuantumObservableDelta(
  source: string,
  sequence: number,
  delta: QuantumObservableDelta,
): ObservableDelta {
  return {
    source,
    sequence,
    row: delta.row,
    weight: delta.weight,
  };
}

/**
 * Consolidates Reticulum quantum observable deltas back into DBSP-style signed
 * rows, dropping zero-weight retractions and keeping canonical row order.
 */
export function consolidateQuantumObservableDeltas(
  deltas: readonly ObservableDelta[],
): readonly ConsolidatedObservableDelta[] {
  const byRow = new Map<string, ConsolidatedObservableDelta>();

  for (const delta of deltas) {
    const key = rowKey(delta.row);
    const existing = byRow.get(key);
    byRow.set(key, {
      row: existing?.row ?? delta.row,
      weight: (existing?.weight ?? 0) + delta.weight,
    });
  }

  return [...byRow.values()]
    .filter((delta) => delta.weight !== 0)
    .sort((a, b) => compareQuantumObservableRow(a.row, b.row));
}

/**
 * Maps a source-owned QuantumObservableRow into a Reticulum Observable packet.
 */
export function ofQuantumObservableRow(source: string, sequence: bigint, row: QuantumObservableRow): Observable {
  switch (row.type) {
    case "SingleQubit": {
      const v = row.value;
      return {
        Room: "salon",
        Source: source,
        Name: v.Id,
        Value: v.Probabilities.One,
        Norm: v.Probabilities.Zero + v.Probabilities.One,
        Support: 2,
        Sequence: sequence,
      };
    }
    case "CanonicalChsh": {
      const v = row.value;
      return {
        Room: "salon",
        Source: source,
        Name: v.Id,
        Value: v.S,
        Norm: v.Tsirelson,
        Support: 4,
        Sequence: sequence,
      };
    }
    case "SingletChsh": {
      const v = row.value;
      return {
        Room: "salon",
        Source: source,
        Name: v.Id,
        Value: v.S,
        Norm: v.Analytic,
        Support: v.Corners.length,
        Sequence: sequence,
      };
    }
    case "BellCorner": {
      const v = row.value;
      return {
        Room: "salon",
        Source: source,
        Name: v.Id,
        Value: v.Correlator,
        Norm: 1.0,
        Support: 2,
        Sequence: sequence,
      };
    }
    case "BellCoincidence": {
      const v = row.value;
      return {
        Room: "salon",
        Source: source,
        Name: v.Id,
        Value: v.Probability,
        Norm: 1.0,
        Support: 4,
        Sequence: sequence,
      };
    }
    case "InterferenceVisibility": {
      const v = row.value;
      return {
        Room: "arcade",
        Source: source,
        Name: v.Id,
        Value: v.Probabilities.One,
        Norm: v.Probabilities.Zero + v.Probabilities.One,
        Support: 2,
        Sequence: sequence,
      };
    }
  }
}
