import { test, expect } from "bun:test";
import { canonicalXml, fromCanonicalXml } from "./xml";
import type { Tagged } from "./json";
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
    expect(canonicalXml(v.value)).toBe(v.xml);
  }
});

test("XML golden round-trip: decode(xml) === value for every vector", () => {
  for (const v of vectors) {
    expect(fromCanonicalXml(v.xml)).toEqual({ ok: true, value: v.value });
  }
});

test("XML never-collapse: null / empty arr / empty obj / empty str are four distinct forms", () => {
  const forms = [
    canonicalXml({ t: "null" }),
    canonicalXml({ t: "arr", v: [] }),
    canonicalXml({ t: "obj", v: [] }),
    canonicalXml({ t: "str", v: "" }),
  ];
  expect(forms).toEqual(["<null/>", "<arr></arr>", "<obj></obj>", "<str></str>"]);
  expect(new Set(forms).size).toBe(4);
});

test("XML round-trips whitespace + markup chars in text and keys", () => {
  const cases: Tagged[] = [
    { t: "str", v: 'a<b>&"\'\n\t\r x' },
    { t: "obj", v: [["key\nwith\tws", { t: "str", v: "v" }], ["<&\">", { t: "null" }]] },
    { t: "arr", v: [{ t: "arr", v: [] }, { t: "obj", v: [] }, { t: "null" }, { t: "str", v: "" }] },
  ];
  for (const t of cases) {
    expect(fromCanonicalXml(canonicalXml(t))).toEqual({ ok: true, value: t });
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
  // deferred shapes / unknown tags
  expect(fromCanonicalXml("<float>1.5</float>")).toEqual({ ok: false, error: "Unsupported" });
});

test("XML int64 boundaries round-trip; overflow rejected", () => {
  for (const v of ["9223372036854775807", "-9223372036854775808", "0"]) {
    const t: Tagged = { t: "int", v };
    expect(fromCanonicalXml(canonicalXml(t))).toEqual({ ok: true, value: t });
  }
  expect(fromCanonicalXml("<int>9223372036854775808</int>")).toEqual({ ok: false, error: "IntegerOverflow" });
});
