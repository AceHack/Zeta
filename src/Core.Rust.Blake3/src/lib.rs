//! BLAKE3 adapter for the IContentHasher port -- Rust parity oracle (#4 of TS/F#/C#/Rust).

#![forbid(unsafe_code)]
#![warn(missing_docs)]

use zeta_core_merkle::MerkleHash;

/// **ContentHash256** -- the full 256-bit raw BLAKE3 digest (the proof tier; treaty `081KTH59TVZ`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub struct ContentHash256 {
    /// The raw 32-byte digest array.
    pub raw: [u8; 32],
}

impl ContentHash256 {
    /// Create a new ContentHash256 wrapper.
    pub fn new(raw: [u8; 32]) -> Self {
        Self { raw }
    }

    /// Lowercase hex of the raw 32 bytes (no reversal) -- the canonical proof rendering.
    pub fn to_hex(&self) -> String {
        let mut out = String::with_capacity(64);
        for &b in &self.raw {
            out.push(char::from_digit((b >> 4) as u32, 16).unwrap());
            out.push(char::from_digit((b & 0x0f) as u32, 16).unwrap());
        }
        out
    }

    /// The full raw BLAKE3-256 digest of bytes (32 bytes, raw order).
    pub fn of_bytes(bytes: &[u8]) -> Self {
        let hash = blake3::hash(bytes);
        Self { raw: hash.into() }
    }

    /// Parse a 32-byte BLAKE3-256 digest from its hex string representation (allows optional 'blake3:' prefix).
    pub fn of_hex(hex: &str) -> Self {
        let clean = hex.strip_prefix("blake3:").unwrap_or(hex);
        assert_eq!(
            clean.len(),
            64,
            "BLAKE3-256 hex string must be exactly 64 characters."
        );
        let mut raw = [0u8; 32];
        for i in 0..32 {
            let s = &clean[i * 2..i * 2 + 2];
            raw[i] = u8::from_str_radix(s, 16).expect("invalid hex byte");
        }
        Self { raw }
    }

    /// Derive the compact ContentAddress128 (MerkleHash) from the full digest.
    pub fn to_content_address_128(&self) -> MerkleHash {
        let lo = u64::from_le_bytes(self.raw[0..8].try_into().unwrap());
        let hi = u64::from_le_bytes(self.raw[8..16].try_into().unwrap());
        MerkleHash { hi, lo }
    }
}

/// **IContentHasher** trait -- the content-hashing port.
pub trait IContentHasher {
    /// A stable name for the algorithm.
    fn name(&self) -> &'static str;
    /// Hash raw bytes into a 128-bit [`MerkleHash`].
    fn hash(&self, bytes: &[u8]) -> MerkleHash;
}

/// **Blake3Hasher** -- the adapter for BLAKE3 content hashing.
pub struct Blake3Hasher;

impl IContentHasher for Blake3Hasher {
    fn name(&self) -> &'static str {
        "blake3"
    }

    fn hash(&self, bytes: &[u8]) -> MerkleHash {
        let hash = blake3::hash(bytes);
        let raw: [u8; 32] = hash.into();
        let lo = u64::from_le_bytes(raw[0..8].try_into().unwrap());
        let hi = u64::from_le_bytes(raw[8..16].try_into().unwrap());
        MerkleHash { hi, lo }
    }
}
