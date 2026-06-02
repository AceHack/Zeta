//! DynamicValue cross-language byte-lock -- the Rust oracle RE-GROUNDED against
//! the shared seed (`src/Core.TypeScript/dynamic-value/golden-vectors.json`).
//! Seed-first (Aaron 2026-06-01: "we are growing code from the seeds"): the seed
//! is the canonical DATA; this proves the Rust canonical encoder AGREES on it
//! (`encode(value) == json`) for every locked vector. Passing == agreeing with
//! the TS/F#/C# oracles. v1 locks null/bool/int/string/array/object.
//!
//! Dev-only `serde_json` reads the nested-JSON fixture; the production crate
//! (`zeta_core_dynamic_value`) has zero dependencies. "The compilers don't lie."

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_dynamic_value::DynamicValue;

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching
/// the convention in the other Rust oracles.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// Build a `DynamicValue` from the seed's language-neutral tagged form `{ t, v }`.
/// v1 locks null/bool/int/str/arr/obj; float/bytes are not in the locked vectors.
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

#[test]
fn dynamic_value_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/dynamic-value/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read dynamic-value golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse golden-vectors.json");

    let vectors = v["vectors"].as_array().expect("vectors array");
    assert!(!vectors.is_empty(), "seed must have vectors");

    let mut failures: Vec<String> = Vec::new();
    for vec in vectors {
        let name = vec["name"].as_str().expect("name string");
        let value = build_value(&vec["value"]);
        let expected = vec["json"].as_str().expect("json string");
        match value.to_canonical_json() {
            Ok(actual) if actual == expected => {}
            Ok(actual) => failures.push(format!("{name}: expected {expected} but got {actual}")),
            Err(e) => failures.push(format!("{name}: expected {expected} but got Err {e:?}")),
        }
    }

    assert!(
        failures.is_empty(),
        "byte-lock mismatches:\n{}",
        failures.join("\n")
    );
}
