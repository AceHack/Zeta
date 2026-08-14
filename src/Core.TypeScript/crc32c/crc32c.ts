// CRC32C (Castagnoli polynomial, reflected 0x82F63B78), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/HardwareCrc.fs, HardwareCrc.Crc32C) by agreeing on the
// shared seed (./golden-vectors.json) that the C#/F#/Rust oracles also verify. The hardware (SSE4.2 /
// ARMv8), table and bitwise forms all compute the identical standard CRC32C value.
// All ops are >>> 0 to stay in the unsigned 32-bit range JS bitwise operators define.
//
// TWO FORMS, and the split is deliberate (2026-08-14, 081KZYP1X3B087G0R001EZ37PQ):
//
//   `crc32cBitwise` is the DEFINITION — the polynomial division written out, one bit at a time. It
//     is the shape the F#/C#/Rust oracles are read against and the thing a reviewer can check by
//     eye against the polynomial. It is not fast and does not need to be.
//   `crc32c` is the same function, table-driven (Sarwate, "Computation of cyclic redundancy checks
//     via table look-up", CACM 31(8), 1988 — CITED, not page-checked): one lookup per byte instead
//     of eight shift-and-conditional-xor steps. This is what callers get.
//
// Why both rather than just the fast one: a table is 256 precomputed constants, and a wrong entry
// is a silent wrong checksum that no amount of reading the loop would reveal. Keeping the bitwise
// definition beside it makes the table CHECKABLE rather than trusted — `golden-vectors.test.ts`
// pins both against the shared 4-oracle seed AND against each other over random inputs, so the
// table cannot drift from the definition without a test going red.
//
// The reason it is worth having at all: `udp-lossy-transport.ts` runs this per PACKET, and its
// chaos/BDP sweeps run it over hundreds of thousands of frames per test. The bitwise form put the
// slowest sweep at 2.6s against a hard 5s per-test cap; the table form is what keeps that headroom.

const POLY = 0x82f63b78;

/** The 256-entry Sarwate table, derived from `POLY` at module load — never a literal.
 *
 *  Written out as constants it would be 256 numbers free to drift from the polynomial on any edit,
 *  which is the same "a derivation cannot drift, a copy can" argument that makes `ADINKRA_H` a
 *  computation rather than a second matrix. */
const TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n >>> 0;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? ((c >>> 1) ^ POLY) >>> 0 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** Compute the standard CRC32C of payload (bytes 0..255). Returns a uint32.
 *
 *  Table-driven. Byte-for-byte identical to `crc32cBitwise` — that identity is a test, not a claim. */
export function crc32c(payload: number[] | Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of payload) {
    crc = (TABLE[(crc ^ b) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** The bitwise DEFINITION of CRC32C — the polynomial division, one bit at a time.
 *
 *  Kept as the reference `crc32c` is checked against. Prefer `crc32c` in callers; use this when the
 *  question is "what does the polynomial say", not "what is the checksum". */
export function crc32cBitwise(payload: number[] | Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of payload) {
    crc = (crc ^ b) >>> 0;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 1) !== 0 ? ((crc >>> 1) ^ POLY) >>> 0 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
