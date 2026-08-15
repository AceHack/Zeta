import { describe, expect, test } from "bun:test";
import { stringCompare, byNameOrDefault, catalog } from "./collation";

// ── The collation TREATY, TypeScript side ──────────────────────────────────────────────────────
//
// `.claude/rules/culture-invariant-by-default.md` picks "codepoint ≡ UTF-8 byte order" as the one
// canonical collation. These tests pin that TS's `stringCompare` is that relation — differentially,
// against an independently derived UTF-8 byte reference — rather than pinning a single point on it.
//
// Decision doc:
//   docs/research/2026-08-15-canonical-collation-is-utf8-byte-order-sql-servers-bin2-utf8-not-nvarchar-bin2.md
// Work-item: 081M02PEST7087G0R00253HRV0
//
// A `test.skip` here is a NAMED GAP carrying its reason, not a disabled test: un-skipping it must
// fail. That is what keeps it out of the vacuity class.

const HIGH_BMP = String.fromCodePoint(0xff3a); // U+FF3A, UTF-8 EF BC BA, one UTF-16 unit
const ASTRAL = String.fromCodePoint(0x10000); // U+10000, UTF-8 F0 90 80 80, surrogate pair D800 DC00

/**
 * TRUE lexicographic UTF-8 byte order — `memcmp` semantics, and the DEFINITION of the canonical
 * collation (Unicode Standard 2.5.3: "A binary sort of UTF-8 strings gives the same ordering as a
 * binary sort of Unicode code points").
 */
const enc = new TextEncoder();
function utf8ByteOrder(a: string, b: string): number {
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const n = Math.min(ba.length, bb.length);
  for (let i = 0; i < n; i++) {
    const x = ba[i] as number;
    const y = bb[i] as number;
    if (x !== y) return x < y ? -1 : 1;
  }
  return ba.length === bb.length ? 0 : ba.length < bb.length ? -1 : 1;
}

/** Alphabet straddling every UTF-8 length boundary AND the surrogate boundary — the only places
 *  the candidate orders can disagree. A probe set that never crosses a boundary pins nothing. */
const ALPHABET = [
  0x41, 0x7a, 0x80, 0x7ff, 0x800, 0xd7ff, 0xe000, 0xff3a, 0xffff, 0x10000, 0x1082c, 0x1f643,
  0x10ffff,
].map((cp) => String.fromCodePoint(cp));

const PROBES: string[] = [""];
for (const a of ALPHABET) {
  PROBES.push(a);
  for (const b of ALPHABET) {
    PROBES.push(a + b);
    for (const c of ALPHABET) PROBES.push(a + b + c);
  }
}

const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 0);

describe("collation treaty — canonical order is UTF-8 byte order", () => {
  test("stringCompare agrees with UTF-8 byte order on every boundary-straddling pair", () => {
    // The falsifier: if `stringCompare` used JS's native `<` (UTF-16 code-unit order) this fails
    // on every pair straddling the surrogate boundary.
    const mismatches: Array<[string, string]> = [];
    for (const x of PROBES) {
      for (const y of PROBES) {
        if (sign(stringCompare(x, y)) !== sign(utf8ByteOrder(x, y))) mismatches.push([x, y]);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("the divergence being governed is real: JS native `<` disagrees with the canonical order", () => {
    // U+FF3A vs U+10000:
    //   UTF-16 code units  FF3A vs D800 DC00  →  D800 < FF3A  →  astral FIRST
    //   UTF-8 bytes        EF.. vs F0..       →  EF   < F0    →  astral SECOND
    expect(HIGH_BMP < ASTRAL).toBe(false); // JS native: astral first
    expect(stringCompare(HIGH_BMP, ASTRAL)).toBeLessThan(0); // canonical: astral second
    expect(utf8ByteOrder(HIGH_BMP, ASTRAL)).toBeLessThan(0); // and this is Rust's native order
  });

  test("Latin1_General_100_BIN2_UTF8 is the exact SQL Server name for the canonical collation", () => {
    // _BIN2_UTF8 stores as UTF-8, which has no surrogates, so BIN2 over it is TRUE code-point
    // order. It is the only SQL Server collation name that denotes exactly our canonical order.
    expect(byNameOrDefault("Latin1_General_100_BIN2_UTF8")).toBe(stringCompare);
    expect(byNameOrDefault("latin1_general_100_bin2_utf8")).toBe(stringCompare);
  });
});

describe("collation treaty — named gaps", () => {
  // NAMED GAP 081M02PEST7087G0R00253HRV0 — the catalog name "invariant" denotes DIFFERENT relations
  // per oracle. .NET maps it to the linguistic StringComparer.InvariantCulture, which orders
  // "a" < "B"; this TS catalog aliases it to binary, which orders "B" < "a". Reachable on two ASCII
  // letters — strictly more reachable than the astral divergence that opened the work-item.
  //
  // The recommendation is to REMOVE culture-aware rows from the shared catalog: TypeScript cannot
  // faithfully implement InvariantCulture, because its only linguistic ordering is Intl.Collator,
  // which is ICU-version-dependent and therefore not stable across runtimes. That is a breaking
  // change for callers selecting those names, so it needs Aaron. Decision doc 5a and 7 item 4.
  //
  // Un-skipping this must FAIL. It asserts the .NET behaviour, which this oracle does not have.
  test.skip("shared catalog name 'invariant' means the same relation as in the .NET oracles", () => {
    // .NET: StringComparer.InvariantCulture.Compare("a", "B") < 0 (linguistic, a before B).
    const invariant = catalog["invariant"] as (a: string, b: string) => number;
    expect(sign(invariant("a", "B"))).toBe(-1);
  });
});
