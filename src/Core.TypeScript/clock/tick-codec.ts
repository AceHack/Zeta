// tick-codec.ts — Gate T2 canonical Versionstamp big-endian codec (TypeScript oracle).
// Encodes/decodes a Versionstamp as an unsigned 64-bit integer in network byte order (8 bytes).
// Mirrors F# Versionstamp.encode/decode in src/Core/Clock.fs.
// Golden vectors: tick-codec-golden-vectors.json.

/**
 * Encode a versionstamp (bigint) to an 8-byte big-endian Uint8Array.
 * The int64 is treated as unsigned 64-bit in network byte order.
 */
export function encodeVersionstamp(version: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const u = BigInt.asUintN(64, version);
  buf[0] = Number((u >> 56n) & 0xffn);
  buf[1] = Number((u >> 48n) & 0xffn);
  buf[2] = Number((u >> 40n) & 0xffn);
  buf[3] = Number((u >> 32n) & 0xffn);
  buf[4] = Number((u >> 24n) & 0xffn);
  buf[5] = Number((u >> 16n) & 0xffn);
  buf[6] = Number((u >>  8n) & 0xffn);
  buf[7] = Number( u         & 0xffn);
  return buf;
}

/**
 * Decode an 8-byte big-endian buffer to a versionstamp (bigint).
 */
export function decodeVersionstamp(buf: Uint8Array): bigint {
  if (buf.length < 8) throw new Error("decodeVersionstamp: buffer too short");
  let u = 0n;
  for (let i = 0; i < 8; i++) {
    u = (u << 8n) | BigInt(buf[i]!);
  }
  // Reinterpret as int64 (two's complement)
  if (u >= 0x8000000000000000n) {
    return u - 0x10000000000000000n;
  }
  return u;
}

/** Hex-encode a Uint8Array (no prefix). */
export function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
}
