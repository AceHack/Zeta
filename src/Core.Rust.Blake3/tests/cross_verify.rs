//! Cross-language-parity cross-verification test for BLAKE3.
//!
//! Reads `tests/cross-verification/blake3-256/vectors.yaml` and writes
//! `rust-output.json` to the same directory.

use std::path::PathBuf;

use zeta_core_blake3::ContentHash256;
use zeta_core_yaml::{YamlValue, parse};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel).
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// Pull a required string field from a vector's `Map`, panicking with a clear message
/// (naming the vector id when possible) on absence or wrong type.
fn str_field<'a>(entries: &'a [(String, YamlValue)], key: &str) -> Option<&'a str> {
    entries
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| match v {
            YamlValue::Str(s) => s.as_str(),
            other => {
                let id = entries
                    .iter()
                    .find(|(k, _)| k == "id")
                    .map(|(_, v)| format!("{v:?}"))
                    .unwrap_or_else(|| "<no-id>".to_string());
                panic!("vector {id} field {key} is not a Str: {other:?}")
            }
        })
}

/// Decode a hex string (even length, lowercase or uppercase) into bytes.
fn hex_decode(s: &str) -> Vec<u8> {
    assert!(s.len().is_multiple_of(2), "input_hex {s:?} has odd length");
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16).unwrap_or_else(|_| panic!("bad hex byte in {s:?}"))
        })
        .collect()
}

/// Minimal JSON string escaping.
fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

#[test]
fn cross_verify_matches_shared_vectors() {
    let fixture_dir = repo_root().join("tests/cross-verification/blake3-256");
    let text =
        std::fs::read_to_string(fixture_dir.join("vectors.yaml")).expect("read vectors.yaml");

    // Parse via our own zero-dep YAML port (dogfooding): top Map -> "vectors" -> Seq of Map.
    let doc = parse(&text).expect("parse vectors.yaml via YAML port");
    let top = match doc {
        YamlValue::Map(entries) => entries,
        other => panic!("expected top-level Map, got {other:?}"),
    };
    let vectors = top
        .iter()
        .find(|(k, _)| k == "vectors")
        .map(|(_, v)| v)
        .expect("top-level key 'vectors'");
    let records = match vectors {
        YamlValue::Seq(items) => items,
        other => panic!("'vectors' is not a Seq, got {other:?}"),
    };
    assert!(!records.is_empty(), "no vectors parsed");

    let mut results: Vec<(String, String, bool)> = Vec::with_capacity(records.len());
    let mut hex_mismatches = 0usize;

    for rec in records {
        let entries = match rec {
            YamlValue::Map(e) => e,
            other => panic!("vector record is not a Map, got {other:?}"),
        };
        let id = str_field(entries, "id")
            .expect("vector missing 'id'")
            .to_string();

        let input_bytes: Vec<u8> = match (
            str_field(entries, "input_utf8"),
            str_field(entries, "input_hex"),
        ) {
            (Some(utf8), None) => utf8.as_bytes().to_vec(),
            (None, Some(hex)) => hex_decode(hex),
            (Some(_), Some(_)) => panic!("vector {id} has BOTH input_utf8 and input_hex"),
            (None, None) => panic!("vector {id} has neither input_utf8 nor input_hex"),
        };

        let hash = ContentHash256::of_bytes(&input_bytes);
        let hex = hash.to_hex();
        let expected_hex =
            str_field(entries, "expected_hex").expect("vector missing 'expected_hex'");
        let matches_expected = hex == expected_hex;
        if !matches_expected {
            hex_mismatches += 1;
            eprintln!("Hex MISMATCH for {id}: got {hex}, expected {expected_hex}");
        }
        results.push((id, hex, matches_expected));
    }

    // Emit rust-output.json in the shared shape: { id: hex } (matching ts-output.json).
    let mut out = String::from("{\n");
    for (i, (id, hex, _)) in results.iter().enumerate() {
        out.push_str(&format!("  {}: {}", json_str(id), json_str(hex)));
        out.push_str(if i + 1 < results.len() { ",\n" } else { "\n" });
    }
    out.push_str("}\n");

    let output_path = fixture_dir.join("rust-output.json");
    std::fs::write(&output_path, &out).expect("write rust-output.json");

    let n = results.len();
    println!(
        "Cross-verify: {n} vectors. Hex matches expected {}/{n}.",
        n - hex_mismatches
    );
    assert_eq!(hex_mismatches, 0, "{hex_mismatches} hex mismatch(es)");
}
