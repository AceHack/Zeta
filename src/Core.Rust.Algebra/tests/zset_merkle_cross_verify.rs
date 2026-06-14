//! Z-set Merkle cross-language conformance (the Rust oracle for computing Merkle root over a Z-set).
//! Replays the SHARED golden vectors from `tests/cross-verification/zset-merkle/vectors.yaml`
//! and asserts that the computed Merkle root matches the reference F#/TS/C# root.

use std::path::PathBuf;
use zeta_core_algebra::zset::{ZEntry, ZSet};
use zeta_core_algebra::zset_merkle;
use zeta_core_yaml::dom::{YamlValue, parse as parse_yaml};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the
/// convention in the other Rust oracles.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn map_entries(v: &YamlValue) -> &[(String, YamlValue)] {
    match v {
        YamlValue::Map(entries) => entries,
        _ => panic!("expected Map, got {:?}", v),
    }
}

fn field<'a>(entries: &'a [(String, YamlValue)], key: &str) -> &'a YamlValue {
    entries
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v)
        .unwrap_or_else(|| panic!("missing field {}", key))
}

fn as_str(v: &YamlValue) -> &str {
    match v {
        YamlValue::Str(s) => s,
        _ => panic!("expected Str, got {:?}", v),
    }
}

fn as_int(v: &YamlValue) -> i64 {
    match v {
        YamlValue::Int(i) => *i,
        _ => panic!("expected Int, got {:?}", v),
    }
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
fn zset_merkle_cross_verify_matches_golden_vectors() {
    let fixture_dir = repo_root().join("tests/cross-verification/zset-merkle");
    let text =
        std::fs::read_to_string(fixture_dir.join("vectors.yaml")).expect("read vectors.yaml");
    let parsed = parse_yaml(&text).expect("parse vectors.yaml");

    let top = map_entries(&parsed);
    let vectors_val = field(top, "vectors");
    let vectors = match vectors_val {
        YamlValue::Seq(items) => items,
        _ => panic!("expected Seq for vectors"),
    };

    let mut results = std::collections::BTreeMap::new();
    let mut mismatches = 0;

    for item in vectors {
        let m = map_entries(item);
        let id = as_str(field(m, "id")).to_string();
        let expected_hex = as_str(field(m, "expected_hex"));

        let entries_val = field(m, "entries");
        let entries_list = match entries_val {
            YamlValue::Seq(entry_items) => {
                let mut v = Vec::new();
                for entry_item in entry_items {
                    let em = map_entries(entry_item);
                    let key = as_str(field(em, "key")).to_string();
                    let weight = as_int(field(em, "weight"));
                    v.push(ZEntry { e: key, w: weight });
                }
                v
            }
            YamlValue::Null => Vec::new(),
            _ => panic!("expected Seq or Null for entries"),
        };

        let z = ZSet::of_entries(entries_list);
        let got_root = zset_merkle::root(|s: &String| s.as_bytes().to_vec(), &z);
        let hex = got_root.to_hex();

        if hex != expected_hex {
            mismatches += 1;
            eprintln!(
                "Hex MISMATCH for {}: got {}, expected {}",
                id, hex, expected_hex
            );
        }

        results.insert(id, hex);
    }

    let mut out = String::from("{\n");
    for (i, (id, hex)) in results.iter().enumerate() {
        out.push_str(&format!("  {}: {}", json_str(id), json_str(hex),));
        out.push_str(if i + 1 < results.len() { ",\n" } else { "\n" });
    }
    out.push_str("}\n");

    let output_path = fixture_dir.join("rust-output.json");
    if std::env::var_os("UPDATE_GOLDEN").is_some() || !output_path.exists() {
        std::fs::write(&output_path, &out).expect("write rust-output.json");
    } else {
        let existing = std::fs::read_to_string(&output_path).unwrap_or_default();
        assert_eq!(
            existing, out,
            "rust-output.json is stale — regenerate with `UPDATE_GOLDEN=1 cargo test`",
        );
    }

    assert_eq!(mismatches, 0, "{} hex mismatch(es)", mismatches);
}
