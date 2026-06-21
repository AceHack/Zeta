// encoding.ts — ZetaId canonical string encoding (081KS3X9Y0008QG0R000W00V73).
//
// Two canonical, big-endian (MSB-first) string forms for the 128-bit ZetaId:
//
//   • Crockford base32 — 26 chars, the CANONICAL filename form (`format`/`parse`).
//   • Hex — 32 chars, lowercase, zero-padded (`toHex`/`fromHex`), matching the
//     existing cross-verify convention (`packed.toString(16).padStart(32,"0")`).
//
// Why Crockford base32 is the filename form (081KS3X9Y0008QG0R000W00V73 §1, Aaron's deployment context
// "ZetaId is used in git filenames first"; the 081KSXN940008QG0R002FWR9B2 decision `workitems/<zetaid>-<desc>.md`):
//
//   1. FILENAME-SAFE — alphabet is [0-9 A-Z] minus the ambiguous I,L,O,U. No `/`,
//      no `+`, no case-fold collision (we always emit one canonical case →
//      safe on case-insensitive filesystems: default macOS APFS, Windows NTFS).
//   2. SORT-PRESERVING — fixed 26-char width + big-endian (MSB-first) + a
//      lexicographically-monotonic alphabet (Crockford's chars are in strict
//      ASCII-ascending order) ⇒ **string sort == numeric ZetaId sort**. Because
//      the ZetaId bit layout puts version (top) then timestamp in the high bits
//      (zeta-id.ts BIT_MASKS), string sort of filenames == chronological order.
//      `ls workitems/` is time-ordered for free; "items from a day" is a prefix scan.
//   3. COMPACT — 128 bits in 26 base32 chars (vs 32 hex).
//
// ULID uses Crockford base32 for exactly these reasons. Endianness: BIG-ENDIAN
// (network byte order) — most-significant 5 bits first. Bit-numbering: LSB-0
// internally (bit 0 = least significant), consistent with zeta-id.ts; the string
// is emitted MSB-first regardless. Cross-language implementations (Rust 081KS3X9Y0008QG0R001Z8SBZJ,
// Python 081KS3X9Y0008QG0R002WGH8PJ) must match these vectors exactly — see CANONICAL_VECTORS in the
// test + the cross-verify fixture.

import type { ZetaId } from "./types";

/** Crockford base32 alphabet — excludes I, L, O, U (ambiguity). ASCII-ascending
 *  ⇒ fixed-width string sort preserves numeric order. */
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 128 bits / 5 bits-per-char = 25.6 ⇒ 26 chars (top 2 bits are zero padding). */
export const ZETAID_BASE32_LEN = 26;
/** 128 bits / 4 bits-per-hex-char = 32 chars. */
export const ZETAID_HEX_LEN = 32;

const MASK_128 = (1n << 128n) - 1n;

/** Decode map: canonical chars + Crockford's lenient aliases (I,i,L,l→1; O,o→0)
 *  + lowercase. U/u is NOT a value symbol in Crockford (check-only) → rejected. */
const DECODE: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
    const c = CROCKFORD_ALPHABET[i]!;
    m.set(c, i);
    m.set(c.toLowerCase(), i);
  }
  // Crockford lenient aliases for visually-ambiguous input.
  m.set("I", 1); m.set("i", 1);
  m.set("L", 1); m.set("l", 1);
  m.set("O", 0); m.set("o", 0);
  return m;
})();

/** Encode a 128-bit ZetaId as the canonical 26-char Crockford base32 string
 *  (big-endian, fixed width, sort-preserving, filename-safe). */
export function format(id: ZetaId): string {
  let v = (id as bigint) & MASK_128;
  const out = new Array<string>(ZETAID_BASE32_LEN);
  // MSB-first: fill from the right (least-significant 5 bits) backwards.
  for (let i = ZETAID_BASE32_LEN - 1; i >= 0; i--) {
    out[i] = CROCKFORD_ALPHABET[Number(v & 31n)]!;
    v >>= 5n;
  }
  return out.join("");
}

/** Parse a canonical (or Crockford-lenient) base32 string back to a ZetaId.
 *  Accepts lowercase + the I/L→1, O→0 aliases; rejects wrong length, invalid
 *  symbols, and any value that overflows 128 bits (the two leading pad bits
 *  must be zero ⇒ first char ∈ 0..7). */
export function parse(s: string): ZetaId {
  if (s.length !== ZETAID_BASE32_LEN) {
    throw new Error(
      `ZetaId.parse: expected ${ZETAID_BASE32_LEN} Crockford-base32 chars, got ${s.length} (${JSON.stringify(s)})`,
    );
  }
  let v = 0n;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const d = DECODE.get(ch);
    if (d === undefined) {
      throw new Error(`ZetaId.parse: invalid Crockford-base32 char ${JSON.stringify(ch)} at index ${i}`);
    }
    v = (v << 5n) | BigInt(d);
  }
  if (v > MASK_128) {
    throw new Error("ZetaId.parse: value exceeds 128 bits (leading pad bits must be zero)");
  }
  return v as ZetaId;
}

/** Encode a ZetaId as canonical big-endian lowercase 32-char hex (matches the
 *  existing cross-verify convention). */
export function toHex(id: ZetaId): string {
  return ((id as bigint) & MASK_128).toString(16).padStart(ZETAID_HEX_LEN, "0");
}

/** Parse canonical big-endian hex (32 chars, case-insensitive) back to a ZetaId. */
export function fromHex(s: string): ZetaId {
  if (s.length !== ZETAID_HEX_LEN || !/^[0-9a-fA-F]+$/.test(s)) {
    throw new Error(`ZetaId.fromHex: expected ${ZETAID_HEX_LEN} hex chars, got ${JSON.stringify(s)}`);
  }
  return (BigInt("0x" + s) & MASK_128) as ZetaId;
}

/** True iff `s` is the strict canonical Crockford form (exactly what `format`
 *  emits) — 26 chars, uppercase, only the strict alphabet, no lenient aliases,
 *  and round-trips. Use to reject non-canonical filenames. */
export function isCanonical(s: string): boolean {
  if (s.length !== ZETAID_BASE32_LEN) return false;
  for (const ch of s) {
    if (!CROCKFORD_ALPHABET.includes(ch)) return false;
  }
  try {
    return format(parse(s)) === s;
  } catch {
    return false;
  }
}
