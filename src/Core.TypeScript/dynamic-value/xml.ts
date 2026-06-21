// DynamicValue canonical XML codec — the TS oracle, shared by the encode + decode
// byte-lock tests. Canonical XML is now the TOTAL form (8/8 shapes): like CBOR it
// locks Float (16-hex IEEE-754 f64 bits) and Bytes (lowercase hex) — both carried in
// the tagged form already (see cbor.ts), so XML inherits their byte-lock for free and
// is exact (all float corners NaN/Inf/-0.0/subnormals are distinct bit patterns). The
// typed-element form makes every shape UNAMBIGUOUS — and makes never-collapse natural:
// `<null/>`, empty `<arr></arr>`, empty `<obj></obj>`, empty `<str></str>`, empty
// `<bytes></bytes>` are distinct element shapes, so empties never collapse to null
// (the 081KT7YW00008QG0R002T1XNWT invariant, free here by construction).
//
// Canonical rules (minified, one rendering per value):
//   null  -> <null/>
//   bool  -> <bool>true</bool> | <bool>false</bool>
//   int   -> <int>DECIMAL</int>           (BigInt-exact; no leading zeros / '+')
//   str   -> <str>TEXT</str>              (empty: <str></str>)
//   arr   -> <arr>CHILD...</arr>          (empty: <arr></arr>)
//   obj   -> <obj><e k="KEY">VALUE</e>...</obj>   (empty: <obj></obj>; keys keep order)
// No insignificant whitespace anywhere. Element TEXT escapes: & < > and \t \n \r as
// CHARACTER REFERENCES (&#9; &#10; &#13;) — XML normalizes LITERAL whitespace in content
// and attributes, so whitespace must ride as char-refs to round-trip. Attribute (key)
// escapes additionally encode ". Culture-invariant throughout.
//
// REPRESENTABILITY BOUNDARY: XML 1.0 forbids NUL and the C0 control chars other than
// \t \n \r — even as character references. A string containing one is NOT XML-1.0
// representable; the encoder declines via XmlEncodeError (the XML analogue of the
// Bytes-not-in-YAML gap). Decode is the inverse of canonicalXml, with one fixed-point
// check (canonicalXml(parsed) === input) rejecting every non-canonical form as
// NonCanonical. "The compilers don't lie."

// 8-shape Tagged (the total form): float v = 16-hex IEEE-754 f64 big-endian bits,
// bytes v = lowercase hex — the SAME language-neutral canonical forms CBOR already
// locks (see cbor.ts). XML wraps them in typed elements; no bit conversion here, so
// the float/bytes byte-lock is inherited from the tagged form (exact; all float
// corners — NaN/Inf/-0.0/subnormals — are distinct bit patterns).
import { type Tagged, type EncodeError, type DecodeError, type EncodeResult, type DecodeResult, MAX_NESTING_DEPTH } from "./types";
export { type Tagged, type EncodeError, type DecodeError, type EncodeResult, type DecodeResult, MAX_NESTING_DEPTH };

const I64_MAX = 9223372036854775807n;
const I64_MIN = -9223372036854775808n;

// Maximum input nesting depth the recursive decoder walks before failing `NestingTooDeep` (imported from types).

// A char is XML-1.0 legal as content iff it is \t \n \r or >= 0x20 (and not a lone
// surrogate / 0xFFFE / 0xFFFF — left to the host string, which holds valid UTF-16).
function isForbiddenC0(code: number): boolean {
  return code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
}

/** Thrown by canonicalXml when a string is not XML-1.0 representable (forbidden C0). */
export class XmlEncodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlEncodeError";
  }
}

// --- canonical XML encode (the byte-lock target; shared with the decoder fixed-point) ---

// Escape element TEXT: & < > as entities; \t \n \r as char-refs (so whitespace survives
// XML content line-ending + normalization rules); forbidden C0 declines.
function escapeText(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    switch (ch) {
      case "&": out += "&amp;"; break;
      case "<": out += "&lt;"; break;
      case ">": out += "&gt;"; break;
      case "\t": out += "&#9;"; break;
      case "\n": out += "&#10;"; break;
      case "\r": out += "&#13;"; break;
      default:
        if (isForbiddenC0(code)) {
          throw new XmlEncodeError(`U+${code.toString(16).padStart(4, "0")} is not representable in XML 1.0`);
        }
        out += ch;
    }
  }
  return out;
}

// Escape an attribute value (object key): like text plus " as &quot;.
function escapeAttr(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    switch (ch) {
      case "&": out += "&amp;"; break;
      case "<": out += "&lt;"; break;
      case ">": out += "&gt;"; break;
      case '"': out += "&quot;"; break;
      case "\t": out += "&#9;"; break;
      case "\n": out += "&#10;"; break;
      case "\r": out += "&#13;"; break;
      default:
        if (isForbiddenC0(code)) {
          throw new XmlEncodeError(`U+${code.toString(16).padStart(4, "0")} is not representable in XML 1.0`);
        }
        out += ch;
    }
  }
  return out;
}

class XmlEncodeErrorCarrier extends Error {
  readonly error: EncodeError;
  constructor(error: EncodeError) {
    super(error);
    this.error = error;
  }
}

function writeXml(n: Tagged, depth: number): string {
  if (depth > MAX_NESTING_DEPTH) {
    throw new XmlEncodeErrorCarrier("NestingTooDeep");
  }
  switch (n.t) {
    case "null":
      return "<null/>";
    case "bool":
      return n.v ? "<bool>true</bool>" : "<bool>false</bool>";
    case "int":
      return "<int>" + BigInt(n.v).toString() + "</int>";
    case "str":
      return "<str>" + escapeText(n.v) + "</str>";
    case "float":
      return "<float>" + n.v + "</float>";
    case "bytes":
      return "<bytes>" + n.v + "</bytes>";
    case "arr":
      return "<arr>" + n.v.map(item => writeXml(item, depth + 1)).join("") + "</arr>";
    case "obj":
      return (
        "<obj>" +
        n.v.map(([k, val]) => '<e k="' + escapeAttr(k) + '">' + writeXml(val, depth + 1) + "</e>").join("") +
        "</obj>"
      );
  }
}

export function canonicalXml(n: Tagged): EncodeResult {
  try {
    const value = writeXml(n, 0);
    return { ok: true, value };
  } catch (e) {
    if (e instanceof XmlEncodeError) {
      return { ok: false, error: "NonRepresentable" };
    }
    if (e instanceof XmlEncodeErrorCarrier) {
      return { ok: false, error: e.error };
    }
    throw e;
  }
}

// --- canonical XML decode (inverse of canonicalXml) ---

class XmlDecodeError extends Error {
  readonly error: DecodeError;
  constructor(error: DecodeError) {
    super(error);
    this.error = error;
  }
}

// Unescape XML content/attribute: the inverse of escapeText/escapeAttr. Accepts the
// entities + numeric char-refs this codec emits (and the common named ones), decimal and
// hex. Lenient: the fixed-point check re-canonicalizes, so any non-canonical spelling
// (e.g. &#x9; vs &#9;, or a raw literal newline) re-encodes differently and is rejected.
function unescape(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch !== "&") {
      out += ch;
      i += 1;
      continue;
    }
    const semi = s.indexOf(";", i);
    if (semi < 0) throw new XmlDecodeError("MalformedXml");
    const ent = s.slice(i + 1, semi);
    if (ent === "amp") out += "&";
    else if (ent === "lt") out += "<";
    else if (ent === "gt") out += ">";
    else if (ent === "quot") out += '"';
    else if (ent === "apos") out += "'";
    else if (ent[0] === "#") {
      const isHex = ent[1] === "x" || ent[1] === "X";
      const digits = isHex ? ent.slice(2) : ent.slice(1);
      if (!(isHex ? /^[0-9a-fA-F]+$/ : /^[0-9]+$/).test(digits)) throw new XmlDecodeError("MalformedXml");
      out += String.fromCodePoint(parseInt(digits, isHex ? 16 : 10));
    } else {
      throw new XmlDecodeError("MalformedXml");
    }
    i = semi + 1;
  }
  return out;
}

export function fromCanonicalXml(xml: string): DecodeResult {
  let pos = 0;
  const fail = (e: DecodeError): never => {
    throw new XmlDecodeError(e);
  };

  // Read the next `<...>` tag (returns its inner text e.g. "obj", "arr/", "/obj",
  // 'e k="..."'). pos must be at '<'.
  const at = (): string => xml.charAt(pos);

  const expectChar = (c: string): void => {
    if (at() !== c) fail("MalformedXml");
    pos += 1;
  };

  // Read raw text up to the next '<' (no nested tags); returns the raw (still-escaped) run.
  const readTextRun = (): string => {
    const start = pos;
    while (pos < xml.length && xml.charAt(pos) !== "<") pos += 1;
    return xml.slice(start, pos);
  };

  // Read an opening/closing/self-closing tag; returns { name, selfClose, attrK }.
  const readTag = (): { name: string; close: boolean; selfClose: boolean; attrK: string | null } => {
    expectChar("<");
    let close = false;
    if (at() === "/") {
      close = true;
      pos += 1;
    }
    // tag name = letters
    const nameStart = pos;
    while (pos < xml.length && /[a-z]/.test(xml.charAt(pos))) pos += 1;
    const name = xml.slice(nameStart, pos);
    if (name.length === 0) fail("MalformedXml");
    let attrK: string | null = null;
    // optional single attribute: ` k="..."` (only on <e>)
    if (xml.charAt(pos) === " ") {
      pos += 1;
      if (xml.slice(pos, pos + 3) !== 'k="') fail("MalformedXml");
      pos += 3;
      const vStart = pos;
      while (pos < xml.length && xml.charAt(pos) !== '"') pos += 1;
      if (pos >= xml.length) fail("UnexpectedEnd");
      attrK = unescape(xml.slice(vStart, pos));
      pos += 1; // closing quote
    }
    let selfClose = false;
    if (at() === "/") {
      selfClose = true;
      pos += 1;
    }
    expectChar(">");
    return { name, close, selfClose, attrK };
  };

  const expectClose = (name: string): void => {
    const tag = readTag();
    if (!tag.close || tag.name !== name || tag.selfClose) fail("MalformedXml");
  };

  // `depth` guards the per-nesting-level recursion: past the fixed bound the input is rejected
  // as data (`NestingTooDeep`) rather than overflowing the stack.
  const parseValue = (depth: number): Tagged => {
    if (depth > MAX_NESTING_DEPTH) fail("NestingTooDeep");
    if (at() !== "<") fail("MalformedXml");
    const tag = readTag();
    if (tag.close) fail("MalformedXml");
    switch (tag.name) {
      case "null":
        if (!tag.selfClose) fail("MalformedXml");
        return { t: "null" };
      case "bool": {
        if (tag.selfClose) fail("MalformedXml");
        const text = readTextRun();
        expectClose("bool");
        if (text === "true") return { t: "bool", v: true };
        if (text === "false") return { t: "bool", v: false };
        return fail("MalformedXml");
      }
      case "int": {
        if (tag.selfClose) fail("MalformedXml");
        const text = readTextRun();
        expectClose("int");
        if (!/^-?[0-9]+$/.test(text)) fail("MalformedXml");
        const big = BigInt(text);
        if (big > I64_MAX || big < I64_MIN) return fail("IntegerOverflow");
        return { t: "int", v: big.toString() };
      }
      case "str": {
        if (tag.selfClose) return { t: "str", v: "" }; // tolerated; fixed-point rejects (canonical is <str></str>)
        const text = unescape(readTextRun());
        expectClose("str");
        return { t: "str", v: text };
      }
      case "float": {
        if (tag.selfClose) fail("MalformedXml");
        const text = readTextRun();
        expectClose("float");
        // canonical = exactly 16 LOWERCASE hex (IEEE-754 f64 bits); else non-canonical
        if (!/^[0-9a-f]{16}$/.test(text)) fail("MalformedXml");
        return { t: "float", v: text };
      }
      case "bytes": {
        if (tag.selfClose) return { t: "bytes", v: "" }; // tolerated; fixed-point rejects (canonical is <bytes></bytes>)
        const text = readTextRun();
        expectClose("bytes");
        // canonical = even-length LOWERCASE hex; else non-canonical
        if (!/^([0-9a-f]{2})*$/.test(text)) fail("MalformedXml");
        return { t: "bytes", v: text };
      }
      case "arr": {
        if (tag.selfClose) return { t: "arr", v: [] }; // tolerated; fixed-point rejects
        const items: Tagged[] = [];
        while (!(at() === "<" && xml.charAt(pos + 1) === "/")) {
          items.push(parseValue(depth + 1));
        }
        expectClose("arr");
        return { t: "arr", v: items };
      }
      case "obj": {
        if (tag.selfClose) return { t: "obj", v: [] }; // tolerated; fixed-point rejects
        const pairs: [string, Tagged][] = [];
        while (!(at() === "<" && xml.charAt(pos + 1) === "/")) {
          const eTag = readTag();
          if (eTag.close || eTag.name !== "e" || eTag.attrK === null || eTag.selfClose) fail("MalformedXml");
          const key = eTag.attrK!;
          const val = parseValue(depth + 1);
          expectClose("e");
          pairs.push([key, val]);
        }
        expectClose("obj");
        return { t: "obj", v: pairs };
      }
      default:
        return fail("Unsupported"); // unknown element tag
    }
  };

  try {
    const value = parseValue(0);
    if (pos !== xml.length) return { ok: false, error: "TrailingData" };
    // canonical fixed-point: a canonical string re-encodes to itself; anything else
    // (self-closing empties, &#x9; vs &#9;, raw whitespace, unknown entities) is
    // well-formed-ish but not canonical.
    const enc = canonicalXml(value);
    if (!enc.ok || enc.value !== xml) return { ok: false, error: "NonCanonical" };
    return { ok: true, value };
  } catch (e) {
    if (e instanceof XmlDecodeError) return { ok: false, error: e.error };
    if (e instanceof XmlEncodeError) return { ok: false, error: "NonCanonical" };
    if (e instanceof XmlEncodeErrorCarrier) return { ok: false, error: "NonCanonical" };
    throw e;
  }
}
