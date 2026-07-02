#![allow(missing_docs)]
#![allow(unknown_lints)]
#![allow(clippy::manual_is_multiple_of)]

use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::path::PathBuf;
use zeta_core_dynamic_value::DynamicValue;
use zeta_core_dynamic_value::cloud_events::{self, CloudEvent};
use zeta_core_dynamic_value::dv_key::DvKey;

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
    assert!(s.len() % 2 == 0, "byte hex must have even length: {s}");
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex byte"))
        .collect()
}

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
        other => panic!("unsupported tag: {other}"),
    }
}

#[test]
fn cross_verify_dv_key_vectors() {
    let path = repo_root().join("tests/cross-verification/dv-key-cloud-events/vectors.json");
    let text = std::fs::read_to_string(&path).expect("read vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse vectors.json");

    let vectors = v["dv_key_vectors"]
        .as_array()
        .expect("dv_key_vectors array");
    for vec in vectors {
        let val = build_value(&vec["value"]);
        let expected_cbor_hex = vec["expected_cbor_hex"].as_str().expect("cbor hex");
        let expected_hash = vec["expected_hash"].as_str().expect("hash string");

        let key = DvKey::of_value(val).unwrap();
        let actual_cbor_hex = hex(key.canonical());

        // Hash call for coverage/correctness (ensures no panic)
        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);

        assert_eq!(actual_cbor_hex, expected_cbor_hex);

        // Verify FNV-1a hash code parity
        let mut h: u32 = 2166136261;
        for &b in key.canonical() {
            h = (h ^ (b as u32)).wrapping_mul(16777619);
        }
        let actual_hash = (h as i32).to_string();
        assert_eq!(actual_hash, expected_hash);
    }
}

#[test]
fn cross_verify_cloud_events_vectors() {
    let path = repo_root().join("tests/cross-verification/dv-key-cloud-events/vectors.json");
    let text = std::fs::read_to_string(&path).expect("read vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse vectors.json");

    let vectors = v["cloud_event_vectors"]
        .as_array()
        .expect("cloud_event_vectors array");
    for vec in vectors {
        let expected_json = vec["expected_json"].as_str().expect("expected json");
        let expected_cbor_hex = vec["expected_cbor_hex"]
            .as_str()
            .expect("expected cbor hex");

        let event = &vec["event"];
        let id = event["id"].as_str().expect("id").to_string();
        let source = event["source"].as_str().expect("source").to_string();
        let r#type = event["type"].as_str().expect("type").to_string();
        let specversion = event["specversion"]
            .as_str()
            .expect("specversion")
            .to_string();

        let data = if event.get("data").is_some() && !event["data"].is_null() {
            Some(build_value(&event["data"]))
        } else {
            None
        };

        let mut ce = CloudEvent {
            id,
            source,
            specversion,
            r#type,
            time: event
                .get("time")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string()),
            subject: event
                .get("subject")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string()),
            datacontenttype: event
                .get("datacontenttype")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string()),
            dataschema: event
                .get("dataschema")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string()),
            extensions: Vec::new(),
            data,
        };

        if let Some(exts) = event.get("extensions").and_then(|x| x.as_array()) {
            for pair in exts {
                let p = pair.as_array().unwrap();
                ce.extensions.push((
                    p[0].as_str().unwrap().to_string(),
                    p[1].as_str().unwrap().to_string(),
                ));
            }
        }

        let dynamic_val = cloud_events::to_dynamic(ce);

        let actual_json = dynamic_val.to_canonical_json().unwrap();
        assert_eq!(actual_json, expected_json);

        let actual_cbor_hex = hex(&dynamic_val.to_canonical_cbor().unwrap());
        assert_eq!(actual_cbor_hex, expected_cbor_hex);
    }
}
