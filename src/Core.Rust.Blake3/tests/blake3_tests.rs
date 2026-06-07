//! Unit tests for BLAKE3 content hashing.

use zeta_core_blake3::{ContentHash256, Blake3Hasher, IContentHasher};

#[test]
fn empty_string_256_hash_matches_treaty() {
    let h = ContentHash256::of_bytes(b"");
    assert_eq!(
        h.to_hex(),
        "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"
    );
}

#[test]
fn empty_string_128_address_matches_treaty() {
    let h256 = ContentHash256::of_bytes(b"");
    let h128 = h256.to_content_address_128();
    assert_eq!(h128.to_hex(), "49c9dc36ea4d40a0a6a1f9f5b94913af");
}

#[test]
fn blake3_hasher_adapter_matches_empty_string_treaty() {
    let adapter_hash = Blake3Hasher.hash(b"");
    assert_eq!(adapter_hash.to_hex(), "49c9dc36ea4d40a0a6a1f9f5b94913af");
}
