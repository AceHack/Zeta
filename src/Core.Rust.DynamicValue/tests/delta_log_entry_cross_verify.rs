//! Log noun -- the Rust oracle for the DeltaLogEntry byte-lock (workitem 081KTGD5JMD). Replays the
//! shared seed (`src/Core.TypeScript/delta-log-entry/golden-vectors.json`) that the F# reference oracle
//! produced, and asserts Rust reproduces byte-identical canonical CBOR + round-trips it. A whole entry
//! `{ seq; delta; captured }` maps to a `DynamicValue::Object` (keys captured/delta/seq, ordinal order;
//! captured keys ordinal-sorted -- culture-invariant, B-0969) riding the already-4-language-locked
//! DynamicValue canonical CBOR -- so the Log entry inherits the byte-lock with no new canonical encoding
//! (an entry is just a DynamicValue). Mirror of F# `DeltaLogEntryDynamic::to_dynamic_value`
//! (src/Core/DeltaCodec.fs) + the C#/TS oracles. "The compilers don't lie."
//!
//! Dev-only `serde_json` reads the seed; the production crate has zero dependencies.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_dynamic_value::DynamicValue;

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn decode_hex(s: &str) -> Vec<u8> {
    assert!(
        s.len().is_multiple_of(2),
        "byte hex must have even length: {s}"
    );
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex byte"))
        .collect()
}

/// Build the entry `DynamicValue` from the seed's `{ seq, delta, captured }` form.
fn build_entry(entry: &Value) -> DynamicValue {
    let seq = entry["seq"].as_i64().expect("seq i64");

    // delta: [[key, weight], ...] -> Array[Array[String, Int]], canonicalized by key (ordinal).
    let mut dpairs: Vec<(String, i64)> = entry["delta"]
        .as_array()
        .expect("delta array")
        .iter()
        .map(|p| {
            let a = p.as_array().expect("delta pair");
            (
                a[0].as_str().expect("delta key").to_string(),
                a[1].as_i64().expect("delta weight"),
            )
        })
        .collect();
    dpairs.sort_by(|a, b| a.0.cmp(&b.0)); // Rust String Ord = UTF-8 byte order = ordinal for ASCII
    let delta = DynamicValue::Array(
        dpairs
            .into_iter()
            .map(|(k, w)| DynamicValue::Array(vec![DynamicValue::String(k), DynamicValue::Int(w)]))
            .collect(),
    );

    // captured: { key: val } -> Object, keys ordinal-sorted.
    let mut cpairs: Vec<(String, String)> = entry["captured"]
        .as_object()
        .expect("captured object")
        .iter()
        .map(|(k, v)| (k.clone(), v.as_str().expect("captured value").to_string()))
        .collect();
    cpairs.sort_by(|a, b| a.0.cmp(&b.0));
    let captured = DynamicValue::Object(
        cpairs
            .into_iter()
            .map(|(k, v)| (k, DynamicValue::String(v)))
            .collect(),
    );

    DynamicValue::Object(vec![
        ("captured".to_string(), captured),
        ("delta".to_string(), delta),
        ("seq".to_string(), DynamicValue::Int(seq)),
    ])
}

#[test]
fn delta_log_entry_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/delta-log-entry/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read delta-log-entry golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse golden-vectors.json");

    let vectors = v["vectors"].as_array().expect("vectors array");
    assert!(vectors.len() >= 5, "seed must have at least 5 vectors");

    let mut failures: Vec<String> = Vec::new();
    for vec in vectors {
        let name = vec["name"].as_str().expect("name string");
        let expected = vec["cbor"].as_str().expect("cbor string");
        let value = build_entry(&vec["entry"]);

        // encode -> must equal the seed hex (the cross-language byte-lock)
        let actual = hex(&value.to_canonical_cbor().expect("cbor encode failed"));
        if actual != expected {
            failures.push(format!(
                "{name}: encode expected {expected} but got {actual}"
            ));
            continue;
        }

        // decode(seed hex) -> re-encode -> must equal the seed hex (round-trip stability)
        match DynamicValue::from_canonical_cbor(&decode_hex(expected)) {
            Ok(decoded) => {
                let re = hex(&decoded.to_canonical_cbor().expect("cbor encode failed"));
                if re != expected {
                    failures.push(format!("{name}: round-trip mismatch (re-encoded {re})"));
                }
            }
            Err(e) => failures.push(format!("{name}: decode failed: {e:?}")),
        }
    }

    assert!(
        failures.is_empty(),
        "byte-lock mismatches:\n{}",
        failures.join("\n")
    );
}
