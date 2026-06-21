// CRC32C (Castagnoli polynomial, reflected 0x82F63B78), TypeScript oracle.
// Conforms to the F# canonical shape (src/Core/HardwareCrc.fs, HardwareCrc.Crc32C) by agreeing on the
// shared seed (./golden-vectors.json) that the C#/F#/Rust oracles also verify. The hardware (SSE4.2 /
// ARMv8) and table forms compute the identical standard CRC32C value; this is the bitwise form.
// All ops are >>> 0 to stay in the unsigned 32-bit range JS bitwise operators define.
const POLY = 0x82f63b78;
/** Compute the standard CRC32C of payload (bytes 0..255). Returns a uint32. */
export function crc32c(payload) {
    let crc = 0xffffffff;
    for (const b of payload) {
        crc = (crc ^ b) >>> 0;
        for (let i = 0; i < 8; i++) {
            crc = (crc & 1) !== 0 ? ((crc >>> 1) ^ POLY) >>> 0 : crc >>> 1;
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}
