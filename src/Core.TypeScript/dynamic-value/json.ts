// DynamicValue canonical JSON codec — the TS oracle, shared by the encode + decode
// byte-lock tests. Canonical JSON is the PARTIAL form (6/8 shapes): Float + Bytes are
// DEFERRED per the seed's `deferred` block (a JSON number is ambiguous Int-vs-Float on
// decode, and JSON has no native byte type) and lock under CBOR instead (see cbor.ts).
// Canonical rules (seed's `canonicalJson`): minified; object keys in INSERTION order
// (NOT sorted — Object is order-significant); int = bare exact decimal; string = RFC 8259
// minimal escaping ('/' NOT escaped; control U+0000..001F short-form or lowercase \u00XX;
// all else raw UTF-8).
//
// `Tagged` is the language-neutral seed value form: int v = exact decimal string (so
// int64 precision is never lost through a JS number). The decoder is the inverse of
// `canonicalJson`: a lenient recursive-descent parse, then one fixed-point check
// (`canonicalJson(parsed) === input`) rejects every non-canonical form (insignificant
// whitespace, non-minimal escapes, leading zeros / '+' signs) as `NonCanonical`.
// "The compilers don't lie."

import { type Tagged, type EncodeError, type DecodeError, type EncodeResult, type DecodeResult, MAX_NESTING_DEPTH } from "./types.ts";
export { type Tagged, type EncodeError, type DecodeError, type EncodeResult, type DecodeResult, MAX_NESTING_DEPTH };

const I64_MAX = 9223372036854775807n;
const I64_MIN = -9223372036854775808n;

// --- canonical JSON encode (the byte-lock target; shared with the decoder's fixed-point check) ---

// Canonical string per the seed's rules: minimal RFC 8259 escaping, '/' not escaped,
// control chars as short-form or lowercase \u00XX, all else raw UTF-8.
function encodeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    // iterate by code point (string iterator combines surrogate pairs)
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default: {
        const code = ch.codePointAt(0) ?? 0;
        if (code <= 0x1f) {
          out += "\\u" + code.toString(16).padStart(4, "0");
        } else {
          out += ch; // raw UTF-8 (incl. non-ASCII / astral)
        }
      }
    }
  }
  return out + '"';
}

class JsonEncodeError extends Error {
  readonly error: EncodeError;
  constructor(error: EncodeError) {
    super(error);
    this.error = error;
  }
}

function writeJson(n: Tagged, depth: number): string {
  if (depth > MAX_NESTING_DEPTH) {
    throw new JsonEncodeError("NestingTooDeep");
  }
  switch (n.t) {
    case "null":
      return "null";
    case "bool":
      return n.v ? "true" : "false";
    case "int":
      return BigInt(n.v).toString();
    case "float":
      throw new JsonEncodeError("FloatDeferred");
    case "str":
      return encodeString(n.v);
    case "bytes":
      throw new JsonEncodeError("BytesDeferred");
    case "arr":
      return "[" + n.v.map(item => writeJson(item, depth + 1)).join(",") + "]";
    case "obj":
      return "{" + n.v.map(([k, val]) => encodeString(k) + ":" + writeJson(val, depth + 1)).join(",") + "}";
  }
}

export function canonicalJson(n: Tagged): EncodeResult {
  try {
    const value = writeJson(n, 0);
    return { ok: true, value };
  } catch (e) {
    if (e instanceof JsonEncodeError) {
      return { ok: false, error: e.error };
    }
    throw e;
  }
}

// --- canonical JSON decode (inverse of canonicalJson) ---

// Internal control-flow carrier: a decode failure throws this and is caught at the
// fromCanonicalJson boundary, so the public API returns a DecodeResult, never throws.
class JsonDecodeError extends Error {
  readonly error: DecodeError;
  constructor(error: DecodeError) {
    super(error);
    this.error = error;
  }
}

const isDigit = (c: string): boolean => c >= "0" && c <= "9";

// JSON simple (non-\u) escapes → their decoded character.
const JSON_ESCAPES: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
};

/**
 * Decode canonical JSON text into a {@link Tagged} value — the inverse of {@link canonicalJson}.
 * Strictly canonical: a lenient recursive-descent parse, then one fixed-point check
 * (`canonicalJson(parsed)` must equal the input) rejects every non-canonical form
 * (insignificant whitespace, non-minimal escapes, leading zeros / '+' signs) as
 * `NonCanonical`. int64 precision is preserved by reading the number token as text
 * (`BigInt`), never via a JS number. A JSON number with a decimal point or exponent is a
 * Float, which is DEFERRED in v1 → `Unsupported`. Never throws for malformed input.
 */
export function fromCanonicalJson(json: string): DecodeResult {
  let pos = 0;
  const fail = (e: DecodeError): never => {
    throw new JsonDecodeError(e);
  };

  const skipWs = (): void => {
    while (pos < json.length) {
      const c = json.charAt(pos);
      if (c === " " || c === "\t" || c === "\n" || c === "\r") pos += 1;
      else break;
    }
  };

  const expectLiteral = (lit: string): void => {
    if (json.slice(pos, pos + lit.length) !== lit) fail("UnexpectedEnd");
    pos += lit.length;
  };

  // reads one escape sequence (pos is at the backslash), advances pos past it, returns
  // the decoded character. \uXXXX → the code unit; simple escapes via JSON_ESCAPES.
  const readEscape = (): string => {
    pos += 1; // past backslash
    const e = json.charAt(pos);
    if (e === "u") {
      const hex = json.slice(pos + 1, pos + 5);
      // require exactly 4 hex digits — parseInt would PARTIALLY parse (e.g. "00gg" → 0),
      // silently accepting malformed \uXXXX; reject as UnexpectedEnd instead.
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("UnexpectedEnd");
      pos += 5; // 'u' + 4 hex digits
      return String.fromCharCode(parseInt(hex, 16));
    }
    const rep = JSON_ESCAPES[e];
    if (rep === undefined) fail("UnexpectedEnd"); // invalid escape / EOF after backslash
    pos += 1;
    return rep ?? ""; // rep is defined here (fail threw); ?? satisfies the type narrowing
  };

  const parseString = (): string => {
    pos += 1; // opening quote
    let out = "";
    while (pos < json.length) {
      const c = json.charAt(pos);
      if (c === '"') {
        pos += 1;
        return out;
      }
      if (c === "\\") {
        out += readEscape();
      } else {
        out += c;
        pos += 1;
      }
    }
    return fail("UnexpectedEnd"); // unterminated string
  };

  // consumes one or more digits at pos; fails UnexpectedEnd if none (enforces the JSON
  // grammar's "at least one digit" for the integer part, fraction, and exponent).
  const consumeDigits = (): void => {
    const d0 = pos;
    while (isDigit(json.charAt(pos))) pos += 1;
    if (pos === d0) fail("UnexpectedEnd");
  };

  const parseNumber = (): Tagged => {
    const start = pos;
    if (json.charAt(pos) === "-") pos += 1;
    consumeDigits(); // integer part — required (rejects "-", "-.5")
    let isFloat = false;
    if (json.charAt(pos) === ".") {
      isFloat = true;
      pos += 1;
      consumeDigits(); // fraction — required after '.' (rejects "1.")
    }
    const ec = json.charAt(pos);
    if (ec === "e" || ec === "E") {
      isFloat = true;
      pos += 1;
      const sign = json.charAt(pos);
      if (sign === "+" || sign === "-") pos += 1;
      consumeDigits(); // exponent — required (rejects "1e", "1e+")
    }
    if (isFloat) return fail("Unsupported"); // Float deferred in v1 JSON
    const big = BigInt(json.slice(start, pos));
    if (big > I64_MAX || big < I64_MIN) return fail("IntegerOverflow");
    return { t: "int", v: big.toString() };
  };

  const parseArray = (depth: number): Tagged => {
    pos += 1; // past the opening bracket
    const items: Tagged[] = [];
    skipWs();
    if (json.charAt(pos) === "]") {
      pos += 1;
      return { t: "arr", v: items };
    }
    while (pos < json.length) {
      items.push(parseValue(depth + 1));
      skipWs();
      const c = json.charAt(pos);
      if (c === ",") {
        pos += 1;
        continue;
      }
      if (c === "]") {
        pos += 1;
        return { t: "arr", v: items };
      }
      fail("UnexpectedEnd");
    }
    return fail("UnexpectedEnd");
  };

  const parseObject = (depth: number): Tagged => {
    pos += 1; // past the opening brace
    const pairs: [string, Tagged][] = [];
    skipWs();
    if (json.charAt(pos) === "}") {
      pos += 1;
      return { t: "obj", v: pairs };
    }
    while (pos < json.length) {
      skipWs();
      if (json.charAt(pos) !== '"') return fail("UnexpectedEnd"); // key must be a string
      const key = parseString();
      skipWs();
      if (json.charAt(pos) !== ":") return fail("UnexpectedEnd");
      pos += 1;
      pairs.push([key, parseValue(depth + 1)]);
      skipWs();
      const c = json.charAt(pos);
      if (c === ",") {
        pos += 1;
        continue;
      }
      if (c === "}") {
        pos += 1;
        return { t: "obj", v: pairs };
      }
      fail("UnexpectedEnd");
    }
    return fail("UnexpectedEnd");
  };

  // `depth` guards the per-nesting-level recursion: past the fixed bound the input is rejected
  // as data (`NestingTooDeep`) rather than overflowing the stack.
  function parseValue(depth: number): Tagged {
    if (depth > MAX_NESTING_DEPTH) fail("NestingTooDeep");
    skipWs();
    const c = json.charAt(pos);
    if (c === "") fail("UnexpectedEnd");
    switch (c) {
      case "n":
        expectLiteral("null");
        return { t: "null" };
      case "t":
        expectLiteral("true");
        return { t: "bool", v: true };
      case "f":
        expectLiteral("false");
        return { t: "bool", v: false };
      case '"':
        return { t: "str", v: parseString() };
      case "[":
        return parseArray(depth);
      case "{":
        return parseObject(depth);
      default:
        if (c === "-" || isDigit(c)) return parseNumber();
        return fail("UnexpectedEnd");
    }
  }

  try {
    const value = parseValue(0);
    skipWs();
    if (pos !== json.length) return { ok: false, error: "TrailingData" };
    // canonical fixed-point: a canonical string re-encodes to itself; anything else (extra
    // whitespace, non-minimal escapes, leading zeros) is well-formed but not canonical
    const enc = canonicalJson(value);
    if (!enc.ok || enc.value !== json) return { ok: false, error: "NonCanonical" };
    return { ok: true, value };
  } catch (e) {
    if (e instanceof JsonDecodeError) return { ok: false, error: e.error };
    throw e;
  }
}
