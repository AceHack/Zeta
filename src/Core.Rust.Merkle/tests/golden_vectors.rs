//! Cross-language byte-lock: the Rust Merkle root must match the F# implementation
//! byte-for-byte over the same leaves. The fixture `golden-vectors-merkle.json` was
//! generated from `src/Core/Merkle.fs` and covers the XXH3 input-length classes
//! (0, 1-3, 4-8, 9-16, 17-128, 129-240, 241+) plus tree shapes (1/2/3/5 leaves,
//! odd fan-in). If this passes, Rust agrees with F#/C# on every root.

use zeta_core_merkle::MerkleTree;

fn hex_to_bytes(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("valid hex"))
        .collect()
}

#[test]
fn merkle_root_matches_fsharp_golden_vectors() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden-vectors-merkle.json");
    let text = std::fs::read_to_string(path).expect("read golden vectors");
    let cases: serde_json::Value = serde_json::from_str(&text).expect("parse golden vectors");

    let arr = cases.as_array().expect("top-level array");
    assert!(!arr.is_empty(), "golden vectors must be non-empty");

    for case in arr {
        let leaves: Vec<Vec<u8>> = case["leaves"]
            .as_array()
            .expect("leaves array")
            .iter()
            .map(|l| hex_to_bytes(l.as_str().expect("leaf hex string")))
            .collect();
        let expected = case["root"].as_str().expect("root hex string");
        let got = MerkleTree::new(&leaves).root().to_hex();
        assert_eq!(got, expected, "root mismatch for leaves={:?}", case["leaves"]);
    }
}
