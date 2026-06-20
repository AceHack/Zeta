import { test, expect } from "bun:test";
import { canonicalXml, fromCanonicalXml } from "./xml";
import type { Tagged } from "./cbor";
import goldens from "./golden-vectors-xml.json";

// TS oracle for the canonical XML codec. Golden byte-lock (encode(value)===xml,
// decode(xml)===value for every shared vector) + round-trip + never-collapse +
// canonicality (fixed-point rejects non-canonical). Mirrors golden-vectors.test.ts.

interface XmlVector {
  name: string;
  value: Tagged;
  xml: string;
}
const vectors = (goldens as { vectors: XmlVector[] }).vectors;

test("XML golden byte-lock: encode(value) === xml for every vector", () => {
  for (const v of vectors) {
    const enc = canonicalXml(v.value);
    expect(enc.ok).toBe(true);
    expect(enc.ok ? enc.value : "").toBe(v.xml);
  }
});

test("XML golden round-trip: decode(xml) === value for every vector", () => {
  for (const v of vectors) {
    expect(fromCanonicalXml(v.xml)).toEqual({ ok: true, value: v.value });
  }
});

test("XML never-collapse: null / empty arr / empty obj / empty str / empty bytes are five distinct forms", () => {
  const forms = [
    canonicalXml({ t: "null" }),
    canonicalXml({ t: "arr", v: [] }),
    canonicalXml({ t: "obj", v: [] }),
    canonicalXml({ t: "str", v: "" }),
    canonicalXml({ t: "bytes", v: "" }),
  ].map(r => {
    expect(r.ok).toBe(true);
    return r.ok ? r.value : "";
  });
  expect(forms).toEqual(["<null/>", "<arr></arr>", "<obj></obj>", "<str></str>", "<bytes></bytes>"]);
  expect(new Set(forms).size).toBe(5);
});

test("XML float corners are distinct + round-trip exactly (bit-pattern form)", () => {
  // -0.0 (8000…) vs +0.0 (0000…) vs NaN (7ff8…) vs +Inf (7ff0…) — distinct bits, never collapse
  const posZero: Tagged = { t: "float", v: "0000000000000000" };
  const negZero: Tagged = { t: "float", v: "8000000000000000" };
  const nan: Tagged = { t: "float", v: "7ff8000000000000" };
  const posInf: Tagged = { t: "float", v: "7ff0000000000000" };
  const corners = [posZero, negZero, nan, posInf];
  const encs = corners.map(c => {
    const r = canonicalXml(c);
    expect(r.ok).toBe(true);
    return r.ok ? r.value : "";
  });
  expect(new Set(encs).size).toBe(4); // all distinct
  for (const t of corners) {
    const enc = canonicalXml(t);
    expect(enc.ok).toBe(true);
    if (enc.ok) expect(fromCanonicalXml(enc.value)).toEqual({ ok: true, value: t });
  }
  // uppercase / wrong-length float hex is non-canonical
  expect(fromCanonicalXml("<float>3FF0000000000000</float>").ok).toBe(false);
  expect(fromCanonicalXml("<float>3ff0</float>").ok).toBe(false);
  // odd-length / uppercase bytes hex non-canonical
  expect(fromCanonicalXml("<bytes>0</bytes>").ok).toBe(false);
  expect(fromCanonicalXml("<bytes>AABB</bytes>").ok).toBe(false);
});

test("XML round-trips whitespace + markup chars in text and keys", () => {
  const cases: Tagged[] = [
    { t: "str", v: 'a<b>&"\'\n\t\r x' },
    { t: "obj", v: [["key\nwith\tws", { t: "str", v: "v" }], ["<&\">", { t: "null" }]] },
    { t: "arr", v: [{ t: "arr", v: [] }, { t: "obj", v: [] }, { t: "null" }, { t: "str", v: "" }] },
  ];
  for (const t of cases) {
    const enc = canonicalXml(t);
    expect(enc.ok).toBe(true);
    if (enc.ok) expect(fromCanonicalXml(enc.value)).toEqual({ ok: true, value: t });
  }
});

test("XML canonicality: non-canonical forms rejected via fixed-point", () => {
  // self-closing empties are non-canonical (canonical is the explicit open/close pair)
  expect(fromCanonicalXml("<arr/>").ok).toBe(false);
  expect(fromCanonicalXml("<obj/>").ok).toBe(false);
  expect(fromCanonicalXml("<str/>").ok).toBe(false);
  // non-minimal char-ref spelling (hex vs the canonical decimal) rejected
  expect(fromCanonicalXml("<str>&#x9;</str>").ok).toBe(false);
  // insignificant whitespace rejected
  expect(fromCanonicalXml("<arr> <null/></arr>").ok).toBe(false);
  // leading zero int rejected
  expect(fromCanonicalXml("<int>01</int>").ok).toBe(false);
  // trailing data rejected
  expect(fromCanonicalXml("<null/><null/>")).toEqual({ ok: false, error: "TrailingData" });
  // float is now the 16-hex IEEE-754 bit form: a decimal float token is malformed
  expect(fromCanonicalXml("<float>1.5</float>").ok).toBe(false);
  // unknown element tag is unsupported
  expect(fromCanonicalXml("<date>2026</date>")).toEqual({ ok: false, error: "Unsupported" });
});

test("XML int64 boundaries round-trip; overflow rejected", () => {
  for (const v of ["9223372036854775807", "-9223372036854775808", "0"]) {
    const t: Tagged = { t: "int", v };
    const enc = canonicalXml(t);
    expect(enc.ok).toBe(true);
    if (enc.ok) expect(fromCanonicalXml(enc.value)).toEqual({ ok: true, value: t });
  }
  expect(fromCanonicalXml("<int>9223372036854775808</int>")).toEqual({ ok: false, error: "IntegerOverflow" });
});
