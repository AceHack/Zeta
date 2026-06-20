//! DynamicValue canonical-CBOR byte-lock -- the Rust oracle replays the shared
//! seed (`src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json`). CBOR is the
//! TOTAL form (all 8 shapes), so this is where Float (RFC 8949 §4.2.2
//! shortest-float) and Bytes (major-type-2) lock -- the two cases canonical JSON
//! deferred. Passing == agreeing with the C#/F#/seed oracles on the bytes. The seed
//! was generated + RFC-8949-Appendix-A-anchored independently; the in-crate unit
//! tests (`cbor_float_matches_rfc_8949_appendix_a`) re-anchor the float logic
//! against the RFC directly, so this lock is not circular. "The compilers don't lie."
//!
//! Dev-only `serde_json` reads the seed; the production crate has zero dependencies.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_dynamic_value::DynamicValue;

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

/// Build a `DynamicValue` from the seed's language-neutral tagged form `{ t, v }`.
/// Float v is the IEEE-754 f64 bit pattern (16 hex, big-endian) for exactness;
/// bytes v is a hex string; int v is a decimal string.
fn build_value(v: &Value) -> DynamicValue {
    match v["t"].as_str().expect("tag string") {
        "null" => DynamicValue::Null,
        "bool" => DynamicValue::Bool(v["v"].as_bool().expect("bool value")),
        "int" => DynamicValue::Int(
            v["v"]
                .as_str()
                .expect("int decimal string")
                .parse::<i64>()
                .expect("i64 parse"),
        ),
        "float" => DynamicValue::Float(f64::from_bits(
            u64::from_str_radix(v["v"].as_str().expect("float bits hex"), 16)
                .expect("u64 hex parse"),
        )),
        "str" => DynamicValue::String(v["v"].as_str().expect("str value").to_string()),
        "bytes" => DynamicValue::Bytes(decode_hex(v["v"].as_str().expect("bytes hex"))),
        "arr" => DynamicValue::Array(
            v["v"]
                .as_array()
                .expect("arr value")
                .iter()
                .map(build_value)
                .collect(),
        ),
        "obj" => DynamicValue::Object(
            v["v"]
                .as_array()
                .expect("obj value")
                .iter()
                .map(|pair| {
                    let p = pair.as_array().expect("pair array");
                    assert_eq!(p.len(), 2, "object pair must be [key, value]");
                    (
                        p[0].as_str().expect("key string").to_string(),
                        build_value(&p[1]),
                    )
                })
                .collect(),
        ),
        other => panic!("unsupported tag in CBOR seed: {other}"),
    }
}

#[test]
fn cbor_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json");
    let text = std::fs::read_to_string(&path).expect("read dynamic-value golden-vectors-cbor.json");
    let v: Value = serde_json::from_str(&text).expect("parse golden-vectors-cbor.json");

    let vectors = v["vectors"].as_array().expect("vectors array");
    assert!(!vectors.is_empty(), "seed must have vectors");

    let mut failures: Vec<String> = Vec::new();
    for vec in vectors {
        let name = vec["name"].as_str().expect("name string");
        let value = build_value(&vec["value"]);
        let expected = vec["cbor"].as_str().expect("cbor string");
        let actual = hex(&value.to_canonical_cbor().expect("cbor encode failed"));
        if actual != expected {
            failures.push(format!("{name}: expected {expected} but got {actual}"));
        }
    }

    assert!(
        failures.is_empty(),
        "byte-lock mismatches:\n{}",
        failures.join("\n")
    );
}
