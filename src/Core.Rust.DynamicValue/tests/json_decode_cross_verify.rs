//! DynamicValue canonical-JSON DECODE byte-lock -- `DynamicValue::from_canonical_json` is the
//! inverse of `to_canonical_json` for the six locked shapes (Float + Bytes are DEFERRED in JSON --
//! they lock under CBOR). The decoder is strictly canonical (fixed-point check
//! `to_canonical_json() == input` -> `DecodeError::NonCanonical`), so a successful decode of the
//! seed is guaranteed to round-trip; this asserts the decoded value structurally equals the
//! expected value (JSON has no floats, so derived `PartialEq` is exact here), and that malformed /
//! deferred / oversized / non-canonical inputs are rejected with the right DecodeError. int64
//! precision is preserved by parsing the number token as text. "The compilers don't lie."

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_dynamic_value::{DecodeError, DynamicValue};

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// Build the expected `DynamicValue` from the seed's tagged form (the six locked JSON shapes).
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
        other => panic!("unsupported tag in JSON seed: {other}"),
    }
}

#[test]
fn json_decode_round_trips_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/dynamic-value/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read dynamic-value golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse golden-vectors.json");

    let vectors = v["vectors"].as_array().expect("vectors array");
    assert!(!vectors.is_empty(), "seed must have vectors");

    let mut failures: Vec<String> = Vec::new();
    for vec in vectors {
        let name = vec["name"].as_str().expect("name string");
        let json = vec["json"].as_str().expect("json string");
        match DynamicValue::from_canonical_json(json) {
            Ok(decoded) => {
                if decoded != build_value(&vec["value"]) {
                    failures.push(format!("{name}: decoded != expected"));
                }
            }
            Err(e) => failures.push(format!("{name}: decode failed {e:?}")),
        }
    }

    assert!(
        failures.is_empty(),
        "JSON decode mismatches:\n{}",
        failures.join("\n")
    );
}

fn err(s: &str) -> DecodeError {
    match DynamicValue::from_canonical_json(s) {
        Err(e) => e,
        Ok(_) => panic!("expected decode failure for {s:?}"),
    }
}

#[test]
fn json_decode_rejects_malformed() {
    assert_eq!(err(""), DecodeError::UnexpectedEnd); // empty
    assert_eq!(err("tru"), DecodeError::UnexpectedEnd); // truncated literal
    assert_eq!(err("[1,"), DecodeError::UnexpectedEnd); // unterminated array
    assert_eq!(err("{\"a\""), DecodeError::UnexpectedEnd); // object missing colon+value
    assert_eq!(err("\"unterminated"), DecodeError::UnexpectedEnd); // unterminated string
    assert_eq!(err("\"\\u00gg\""), DecodeError::UnexpectedEnd); // \uXXXX non-hex digits
    assert_eq!(err("\"\\u 001\""), DecodeError::UnexpectedEnd); // \uXXXX leading whitespace
    assert_eq!(err("\"\\q\""), DecodeError::UnexpectedEnd); // invalid escape
    assert_eq!(err("1."), DecodeError::UnexpectedEnd); // no digit after '.'
    assert_eq!(err("1e"), DecodeError::UnexpectedEnd); // no exponent digits
    assert_eq!(err("1e+"), DecodeError::UnexpectedEnd); // exponent sign without digits
    assert_eq!(err("-"), DecodeError::UnexpectedEnd); // sign without digits
}

#[test]
fn json_decode_rejects_trailing_deferred_oversized() {
    assert_eq!(err("null x"), DecodeError::TrailingData); // value + trailing token
    assert_eq!(err("nullnull"), DecodeError::TrailingData); // two values
    assert_eq!(err("1.5"), DecodeError::Unsupported); // Float deferred
    assert_eq!(err("1e10"), DecodeError::Unsupported); // Float (exponent) deferred
    assert_eq!(err("-0.0"), DecodeError::Unsupported); // Float deferred
    assert_eq!(err("9223372036854775808"), DecodeError::IntegerOverflow); // i64::MAX + 1
    assert_eq!(err("-9223372036854775809"), DecodeError::IntegerOverflow); // i64::MIN - 1
}

#[test]
fn json_decode_rejects_non_canonical() {
    assert_eq!(err(" null"), DecodeError::NonCanonical); // leading whitespace
    assert_eq!(err("[1, 2]"), DecodeError::NonCanonical); // space after comma
    assert_eq!(err("01"), DecodeError::NonCanonical); // leading zero (parses to 1 -> "1")
    assert_eq!(err("\"\\u0041\""), DecodeError::NonCanonical); // A; canonical emits raw "A"
    assert_eq!(err("{ \"a\":1}"), DecodeError::NonCanonical); // whitespace inside object
    // a valid 😀 surrogate PAIR decodes to U+1F600 (😀); canonical emits raw UTF-8, so the
    // escaped form is non-canonical — must match the TS/C#/F# oracles (not UnexpectedEnd)
    assert_eq!(err("\"\\uD83D\\uDE00\""), DecodeError::NonCanonical);
}

#[test]
fn json_decode_rejects_lone_surrogate() {
    // a high surrogate with no following \uXXXX low surrogate can't form a scalar (Rust char) — and,
    // unlike the UTF-16-string oracles, can't even be held; rejected at decode time
    assert_eq!(err("\"\\uD83D\""), DecodeError::UnexpectedEnd); // lone high surrogate
    assert_eq!(err("\"\\uDE00\""), DecodeError::UnexpectedEnd); // lone low surrogate
    assert_eq!(err("\"\\uD83Dx\""), DecodeError::UnexpectedEnd); // high surrogate not followed by \u
}
