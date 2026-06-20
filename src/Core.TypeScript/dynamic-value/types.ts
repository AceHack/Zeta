export type Tagged =
  | { t: "null" }
  | { t: "bool"; v: boolean }
  | { t: "int"; v: string }
  | { t: "float"; v: string }
  | { t: "str"; v: string }
  | { t: "bytes"; v: string }
  | { t: "arr"; v: Tagged[] }
  | { t: "obj"; v: [string, Tagged][] };

export type EncodeError =
  | "FloatDeferred"
  | "BytesDeferred"
  | "NonRepresentable"
  | "NestingTooDeep";

export type DecodeError =
  | "UnexpectedEnd"
  | "TrailingData"
  | "Unsupported"
  | "IntegerOverflow"
  | "NonTextKey"
  | "NonCanonical"
  | "MalformedXml"
  | "MalformedArrow"
  | "NestingTooDeep";

export type EncodeResult<T = string> = { ok: true; value: T } | { ok: false; error: EncodeError };
export type DecodeResult = { ok: true; value: Tagged } | { ok: false; error: DecodeError };

export const MAX_NESTING_DEPTH = 256;
