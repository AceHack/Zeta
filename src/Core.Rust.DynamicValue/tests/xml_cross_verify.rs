//! DynamicValue canonical XML cross-language byte-lock -- the Rust oracle grounded
//! against the shared seed (`src/Core.TypeScript/dynamic-value/golden-vectors-xml.json`).
//! Proves the Rust canonical XML codec AGREES with the TS oracle: `encode(value) == xml`
//! and `decode(xml) == value` for every locked vector, plus the never-collapse and
//! canonicality (fixed-point) invariants.
//!
//! Dev-only `serde_json` reads the fixture; the production crate has zero deps.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_dynamic_value::{DecodeError, DynamicValue};

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

/// Decode an even-length lowercase-hex string into bytes (mirrors the CBOR golden test).
fn decode_hex(s: &str) -> Vec<u8> {
    assert!(s.len() % 2 == 0, "byte hex must have even length: {s}");
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex byte"))
        .collect()
}

/// Build a `DynamicValue` from the seed's language-neutral tagged form `{ t, v }`.
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
        "str" => DynamicValue::String(v["v"].as_str().expect("str value").to_string()),
        // float v = 16-hex IEEE-754 f64 big-endian bits (mirrors the CBOR golden builder)
        "float" => DynamicValue::Float(f64::from_bits(
            u64::from_str_radix(v["v"].as_str().expect("float bits hex"), 16)
                .expect("u64 hex parse"),
        )),
        // bytes v = lowercase hex
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
                    (
                        p[0].as_str().expect("key string").to_string(),
                        build_value(&p[1]),
                    )
                })
                .collect(),
        ),
        other => panic!("unsupported tag in v1 seed: {other}"),
    }
}

fn load_vectors() -> Vec<(String, DynamicValue, String)> {
    let path = repo_root().join("src/Core.TypeScript/dynamic-value/golden-vectors-xml.json");
    let text = std::fs::read_to_string(&path).expect("read golden-vectors-xml.json");
    let v: Value = serde_json::from_str(&text).expect("parse golden-vectors-xml.json");
    let vectors = v["vectors"].as_array().expect("vectors array");
    assert!(!vectors.is_empty(), "seed must have vectors");
    vectors
        .iter()
        .map(|vec| {
            (
                vec["name"].as_str().expect("name string").to_string(),
                build_value(&vec["value"]),
                vec["xml"].as_str().expect("xml string").to_string(),
            )
        })
        .collect()
}

#[test]
fn xml_byte_lock_encode_matches_golden() {
    let mut failures: Vec<String> = Vec::new();
    for (name, value, expected) in load_vectors() {
        match value.to_canonical_xml() {
            Ok(actual) if actual == expected => {}
            Ok(actual) => failures.push(format!("{name}: expected {expected} but got {actual}")),
            Err(e) => failures.push(format!("{name}: expected {expected} but got Err {e:?}")),
        }
    }
    assert!(failures.is_empty(), "byte-lock mismatches:\n{}", failures.join("\n"));
}

#[test]
fn xml_round_trip_decode_matches_golden() {
    let mut failures: Vec<String> = Vec::new();
    for (name, value, xml) in load_vectors() {
        match DynamicValue::from_canonical_xml(&xml) {
            // NaN: Rust f64::NAN != f64::NAN under derived PartialEq, so the float-nan
            // vector is compared via the bit pattern (mirrors the CBOR golden test).
            Ok(DynamicValue::Float(a)) if matches!(value, DynamicValue::Float(_)) => {
                let DynamicValue::Float(b) = value else { unreachable!() };
                if a.to_bits() != b.to_bits() {
                    failures.push(format!("{name}: decode({xml}) bits {:x} != {:x}", a.to_bits(), b.to_bits()));
                }
            }
            Ok(actual) if actual == value => {}
            Ok(actual) => failures.push(format!("{name}: decode({xml}) = {actual:?} != {value:?}")),
            Err(e) => failures.push(format!("{name}: decode({xml}) = Err {e:?}")),
        }
    }
    assert!(failures.is_empty(), "round-trip mismatches:\n{}", failures.join("\n"));
}

#[test]
fn xml_never_collapses_empties() {
    let null = DynamicValue::Null.to_canonical_xml().unwrap();
    let arr = DynamicValue::Array(vec![]).to_canonical_xml().unwrap();
    let obj = DynamicValue::Object(vec![]).to_canonical_xml().unwrap();
    let str = DynamicValue::String(String::new()).to_canonical_xml().unwrap();
    let bytes = DynamicValue::Bytes(vec![]).to_canonical_xml().unwrap();
    assert_eq!(null, "<null/>");
    assert_eq!(arr, "<arr></arr>");
    assert_eq!(obj, "<obj></obj>");
    assert_eq!(str, "<str></str>");
    assert_eq!(bytes, "<bytes></bytes>");
    let all = [&null, &arr, &obj, &str, &bytes];
    for i in 0..all.len() {
        for j in (i + 1)..all.len() {
            assert_ne!(all[i], all[j], "empty shapes must be distinct");
        }
    }
}

#[test]
fn xml_decode_rejects_non_canonical() {
    // self-closing empties and leading-zero ints are well-formed-ish but not canonical
    assert_eq!(DynamicValue::from_canonical_xml("<arr/>"), Err(DecodeError::NonCanonical));
    assert_eq!(DynamicValue::from_canonical_xml("<str/>"), Err(DecodeError::NonCanonical));
    assert_eq!(DynamicValue::from_canonical_xml("<int>01</int>"), Err(DecodeError::NonCanonical));
}
