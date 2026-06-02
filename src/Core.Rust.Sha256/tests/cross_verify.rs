//! Cross-language-parity = the verification (m-acc multi-oracle): the Rust SHA-256
//! oracle (#4) hashes the SHARED standard-anchored golden vectors and must produce
//! the exact lowercase hex the TS reference (oracle #1) emitted -- and that the F#/C#
//! oracles will reproduce. "The compilers don't lie."
//!
//! Reads `tests/cross-verification/sha256/vectors.yaml` (the shared fixture) and
//! writes `rust-output.json` to the same directory, so
//! `tests/cross-verification/sha256/compare.ts` can deep-equal all four outputs.
//!
//! Slice-8 dogfooding: instead of a hand-rolled YAML reader, this consumes our own
//! zero-dep YAML port (`zeta_core_yaml::parse`) as a DEV-dependency -- "slice 8
//! consumes the YAML port." The production sha256 crate stays zero-dep; only this
//! cross-verify test pulls in the YAML port.

use std::path::PathBuf;

use zeta_core_sha256::sha256_hex;
use zeta_core_yaml::{parse, YamlValue};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the
/// convention in `src/Core.Rust.ZetaId/tests/cross_verify.rs`.
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
    entries.iter().find(|(k, _)| k == key).map(|(_, v)| match v {
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
    assert!(s.len() % 2 == 0, "input_hex {s:?} has odd length");
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap_or_else(|_| panic!("bad hex byte in {s:?}")))
        .collect()
}

/// Minimal JSON string escaping (ids + hex are plain ASCII, but be safe).
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
    let fixture_dir = repo_root().join("tests/cross-verification/sha256");
    let text = std::fs::read_to_string(fixture_dir.join("vectors.yaml")).expect("read vectors.yaml");

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

    // (id, hex, matches_expected) in fixture order.
    let mut results: Vec<(String, String, bool)> = Vec::with_capacity(records.len());
    let mut hex_mismatches = 0usize;

    for rec in records {
        let entries = match rec {
            YamlValue::Map(e) => e,
            other => panic!("vector record is not a Map, got {other:?}"),
        };
        let id = str_field(entries, "id").expect("vector missing 'id'").to_string();

        // Exactly one of input_utf8 / input_hex. A double-quoted empty `input_utf8: ""`
        // yields Str("") -> empty bytes (the `empty` vector), NOT Null.
        let input_bytes: Vec<u8> = match (str_field(entries, "input_utf8"), str_field(entries, "input_hex")) {
            (Some(utf8), None) => utf8.as_bytes().to_vec(),
            (None, Some(hex)) => hex_decode(hex),
            (Some(_), Some(_)) => panic!("vector {id} has BOTH input_utf8 and input_hex"),
            (None, None) => panic!("vector {id} has neither input_utf8 nor input_hex"),
        };

        let hex = sha256_hex(&input_bytes);
        let expected_hex = str_field(entries, "expected_hex").expect("vector missing 'expected_hex'");
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

    // Golden-file discipline: do NOT unconditionally rewrite the tracked fixture in
    // read-only / CI checkouts. Default: assert the checked-in rust-output.json matches
    // the freshly generated output. Regenerate on demand with `UPDATE_GOLDEN=1 cargo test`.
    let output_path = fixture_dir.join("rust-output.json");
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::write(&output_path, &out).expect("write rust-output.json");
    } else {
        let existing = std::fs::read_to_string(&output_path).unwrap_or_default();
        assert_eq!(
            existing, out,
            "rust-output.json is stale -- regenerate with `UPDATE_GOLDEN=1 cargo test`",
        );
    }

    let n = results.len();
    println!("Cross-verify: {n} vectors. Hex matches expected {}/{n}.", n - hex_mismatches);
    assert_eq!(hex_mismatches, 0, "{hex_mismatches} hex mismatch(es)");
}
