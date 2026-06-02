//! SHA-256 (FIPS 180-4) -- the Rust parity oracle (#4 of TS/F#/C#/Rust).
//!
//! Per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`, no single
//! language is the source of truth -- multi-oracle byte-for-byte agreement on the
//! shared standard-anchored golden vectors
//! (`tests/cross-verification/sha256/vectors.yaml`) **is** the verification. The TS
//! oracle (#1) is the reference this crate conforms to; see `tests/cross_verify.rs`.
//!
//! The compression function is hand-rolled per FIPS 180-4 (zero-dep production core;
//! supply-chain doctrine, matching Core.Rust.ZetaId + Core.Rust.Yaml). The published
//! NIST vectors are the gate: a message-padding or endianness bug cannot reproduce
//! `e3b0c4...` (empty) or `ba7816...` (`abc`), so they anchor correctness externally.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

/// The eight initial hash values H(0): the first 32 bits of the fractional parts of
/// the square roots of the first eight primes (FIPS 180-4 section 5.3.3).
const H0: [u32; 8] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

/// The 64 round constants K: the first 32 bits of the fractional parts of the cube
/// roots of the first 64 primes (FIPS 180-4 section 4.2.2).
const K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/// Compute the SHA-256 digest of `bytes`, returning the 32-byte hash (FIPS 180-4).
pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    let mut h = H0;

    // --- Message padding (FIPS 180-4 section 5.1.1) ---
    // Append the 0x80 byte, then 0x00 padding so the total length is congruent to
    // 56 mod 64, then the 64-bit big-endian bit-length of the original message.
    let mut msg = bytes.to_vec();
    let bit_len = (bytes.len() as u64).wrapping_mul(8);
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0x00);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    // --- Process each 512-bit (64-byte) block ---
    for block in msg.chunks_exact(64) {
        // Prepare the 64-entry message schedule W.
        let mut w = [0u32; 64];
        for (t, word) in w.iter_mut().take(16).enumerate() {
            let i = t * 4;
            *word = u32::from_be_bytes([block[i], block[i + 1], block[i + 2], block[i + 3]]);
        }
        for t in 16..64 {
            let s0 = w[t - 15].rotate_right(7) ^ w[t - 15].rotate_right(18) ^ (w[t - 15] >> 3);
            let s1 = w[t - 2].rotate_right(17) ^ w[t - 2].rotate_right(19) ^ (w[t - 2] >> 10);
            w[t] = w[t - 16]
                .wrapping_add(s0)
                .wrapping_add(w[t - 7])
                .wrapping_add(s1);
        }

        // Initialise the eight working variables with the current hash value.
        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut hh = h[7];

        // The 64-round compression.
        for t in 0..64 {
            let big_s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let t1 = hh
                .wrapping_add(big_s1)
                .wrapping_add(ch)
                .wrapping_add(K[t])
                .wrapping_add(w[t]);
            let big_s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = big_s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }

        // Add the compressed chunk to the current hash value.
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    // Serialise the eight hash words big-endian into the 32-byte digest.
    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

/// Compute the SHA-256 digest of `bytes` as a lowercase hex string (64 chars).
pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = sha256(bytes);
    let mut out = String::with_capacity(64);
    for b in digest {
        out.push(char::from_digit((b >> 4) as u32, 16).expect("nibble < 16"));
        out.push(char::from_digit((b & 0x0f) as u32, 16).expect("nibble < 16"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    // The published NIST/FIPS standard vectors (lowercase hex). Externally anchored:
    // a padding or endianness bug cannot reproduce these.

    #[test]
    fn standard_vector_empty() {
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        );
    }

    #[test]
    fn standard_vector_abc() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
    }

    #[test]
    fn standard_vector_nist_two_block() {
        // The 56-byte NIST two-block vector (exercises multi-block + length encoding).
        assert_eq!(
            sha256_hex(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
        );
    }

    #[test]
    fn digest_is_thirty_two_bytes() {
        assert_eq!(sha256(b"abc").len(), 32);
    }

    #[test]
    fn hex_matches_raw_digest() {
        let raw = sha256(b"deadbeef");
        let hex = sha256_hex(b"deadbeef");
        let mut from_raw = String::new();
        for b in raw {
            from_raw.push_str(&format!("{b:02x}"));
        }
        assert_eq!(hex, from_raw);
    }
}
