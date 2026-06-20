//! Cross-language byte-lock (proof leg): the Rust Merkle inclusion proof + verification
//! must match the F# implementation byte-for-byte. The fixture
//! `golden-vectors-merkle-proofs.json` was generated from `src/Core/Merkle.fs`
//! (`MerkleTree.Proof` + `MerkleTree.verifyProof`) and covers single/odd/even fan-in
//! shapes across all indices. Schema per row:
//!   {"leaves":["<hex>"...],"index":N,
//!    "siblings":[{"hash":"<hex>","right":true|false}],"root":"<hex>"}
//! `right=true` ⇒ sibling is the RIGHT child (current node LEFT, parent=combine(self,sib));
//! the odd trailing node's sibling is itself with right=true.
//! If this passes, Rust agrees with F#/C#/TS on every proof and every verification.

use zeta_core_merkle::{MerkleTree, verify_proof};

fn hex_to_bytes(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("valid hex"))
        .collect()
}

#[test]
fn merkle_proofs_match_fsharp_golden_vectors() {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/golden-vectors-merkle-proofs.json"
    );
    let text = std::fs::read_to_string(path).expect("read proof golden vectors");
    let cases: serde_json::Value = serde_json::from_str(&text).expect("parse proof golden vectors");

    let arr = cases.as_array().expect("top-level array");
    assert_eq!(arr.len(), 22, "expected the frozen 22-vector treaty");

    for (row, case) in arr.iter().enumerate() {
        let leaves: Vec<Vec<u8>> = case["leaves"]
            .as_array()
            .expect("leaves array")
            .iter()
            .map(|l| hex_to_bytes(l.as_str().expect("leaf hex string")))
            .collect();
        let index = case["index"].as_u64().expect("index") as usize;
        let expected_root_hex = case["root"].as_str().expect("root hex string");
        let expected_siblings = case["siblings"].as_array().expect("siblings array");

        let tree = MerkleTree::new(&leaves);

        // (b) root matches the F# treaty.
        let root = tree.root();
        assert_eq!(
            root.to_hex(),
            expected_root_hex,
            "row {row}: root mismatch for index={index}, leaves={:?}",
            case["leaves"]
        );

        // (a) proof reproduces committed siblings byte-for-byte (hash hex + right flag).
        let proof = tree.proof(index);
        assert_eq!(
            proof.len(),
            expected_siblings.len(),
            "row {row}: proof length mismatch (got {}, expected {})",
            proof.len(),
            expected_siblings.len()
        );
        for (step_i, (got, want)) in proof.iter().zip(expected_siblings.iter()).enumerate() {
            let want_hash = want["hash"].as_str().expect("sibling hash hex");
            let want_right = want["right"].as_bool().expect("sibling right flag");
            assert_eq!(
                got.sibling.to_hex(),
                want_hash,
                "row {row} step {step_i}: sibling hash mismatch (got {}, expected {})",
                got.sibling.to_hex(),
                want_hash
            );
            assert_eq!(
                got.right, want_right,
                "row {row} step {step_i}: right flag mismatch (got {}, expected {})",
                got.right, want_right
            );
        }

        // (c) verify_proof(leaf, steps, root) is true.
        let leaf = &leaves[index];
        assert!(
            verify_proof(leaf, &proof, root),
            "row {row}: verify_proof should accept the genuine (leaf, proof, root)"
        );

        // (d) a tampered leaf fails (flip byte 0, or use [0] if the leaf is empty).
        let mut tampered = leaf.clone();
        if tampered.is_empty() {
            tampered.push(0);
        } else {
            tampered[0] ^= 0x01;
        }
        assert!(
            !verify_proof(&tampered, &proof, root),
            "row {row}: verify_proof must reject a tampered leaf"
        );
    }
}
