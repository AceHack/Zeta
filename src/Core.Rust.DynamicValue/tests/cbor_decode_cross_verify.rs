//! DynamicValue canonical-CBOR DECODE byte-lock -- `DynamicValue::from_canonical_cbor` is the
//! inverse of `to_canonical_cbor`, completing the byte<->value bijection. The decoder is strictly
//! canonical (fixed-point check `to_canonical_cbor() == input` -> `DecodeError::NonCanonical`), so a
//! successful decode of the seed is guaranteed to round-trip; this asserts decode succeeds + the
//! decoded value re-encodes to the seed bytes for every vector. (Structural equality is skipped for
//! the NaN vector because Rust's derived `PartialEq` on `f64` has `NaN != NaN`; the re-encode check
//! covers it.) Passing == agreeing with the C#/F# decode oracles. "The compilers don't lie."

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

fn decode_hex(s: &str) -> Vec<u8> {
    assert!(s.len().is_multiple_of(2), "hex must be even length: {s}");
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex byte"))
        .collect()
}

/// Build the expected `DynamicValue` from the seed's tagged form (float v = f64 bits hex).
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
                    assert_eq!(p.len(), 2, "obj pair must be [key, value]");
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
fn cbor_decode_round_trips_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/dynamic-value/golden-vectors-cbor.json");
    let text = std::fs::read_to_string(&path).expect("read dynamic-value golden-vectors-cbor.json");
    let v: Value = serde_json::from_str(&text).expect("parse golden-vectors-cbor.json");

    let vectors = v["vectors"].as_array().expect("vectors array");
    assert!(!vectors.is_empty(), "seed must have vectors");

    let mut failures: Vec<String> = Vec::new();
    for vec in vectors {
        let name = vec["name"].as_str().expect("name string");
        let cbor = decode_hex(vec["cbor"].as_str().expect("cbor string"));
        match DynamicValue::from_canonical_cbor(&cbor) {
            Ok(decoded) => {
                // byte-lock: decoded re-encodes to the canonical bytes (the decoder's fixed-point
                // check guarantees this, asserted explicitly here)
                if decoded.to_canonical_cbor().as_deref() != Ok(&cbor[..]) {
                    failures.push(format!("{name}: re-encode mismatch"));
                }
                // structural (skip NaN: Rust f64 NaN != NaN under derived PartialEq)
                if name != "float-nan" && decoded != build_value(&vec["value"]) {
                    failures.push(format!("{name}: decoded != expected"));
                }
            }
            Err(e) => failures.push(format!("{name}: decode failed {e:?}")),
        }
    }

    assert!(
        failures.is_empty(),
        "decode byte-lock mismatches:\n{}",
        failures.join("\n")
    );
}
