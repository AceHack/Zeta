import type { QuantumObservableRow } from "./types";

export interface Observable {
  readonly Room: string;
  readonly Source: string;
  readonly Name: string;
  readonly Value: number;
  readonly Norm: number;
  readonly Support: number;
  readonly Sequence: bigint;
}

export type PacketError =
  | { readonly type: "Malformed"; readonly reason: string };

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

const SCHEMA = "zeta-reticulum-observable/v1";

function escapeDataString(str: string): string {
  // Matches .NET's Uri.EscapeDataString which complies with RFC 3986,
  // escaping extra characters that encodeURIComponent leaves unescaped: ! ' ( ) *
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function unescapeDataString(str: string): string {
  return decodeURIComponent(str);
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
 * Maps a source-owned QuantumObservableRow into a Reticulum Observable packet.
 */
export function ofQuantumObservableRow(
  source: string,
  sequence: bigint,
  row: QuantumObservableRow
): Observable {
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
