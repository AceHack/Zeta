//! CRC32C (Castagnoli polynomial, reflected 0x82F63B78), Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/HardwareCrc.fs`, `HardwareCrc.Crc32C`) by agreeing on
//! the shared seed (`src/Core.TypeScript/crc32c/golden-vectors.json`) that the C#/F#/TS oracles also
//! verify. The hardware (SSE4.2 / ARMv8) and table-based forms compute the identical standard CRC32C
//! value (init 0xFFFFFFFF, reflected, final xor 0xFFFFFFFF); this is the table form. Pure integer.

/// Reflected Castagnoli polynomial.
const POLY: u32 = 0x82F63B78;

/// Compute the standard CRC32C of `payload` (bytewise table-free reference; matches the hardware path).
pub fn crc32c(payload: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &b in payload {
        crc ^= b as u32;
        for _ in 0..8 {
            crc = if crc & 1 != 0 { (crc >> 1) ^ POLY } else { crc >> 1 };
        }
    }
    crc ^ 0xFFFF_FFFF
}
