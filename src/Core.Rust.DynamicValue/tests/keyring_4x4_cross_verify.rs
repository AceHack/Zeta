//! Keyring 4x4 treaty cross-verification -- the Rust oracle replays the shared golden vectors
//! (`tools/setup/persona-keys/golden-vectors-keyring-4x4.json`).
//! Verifies canonical JSON, canonical CBOR (hex), and canonical XML output against the seed.

use serde_json::Value;
use std::path::PathBuf;
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

#[test]
fn rust_oracle_agrees_with_keyring_4x4_golden_vector() {
    let path = repo_root().join("tools/setup/persona-keys/golden-vectors-keyring-4x4.json");
    let text = std::fs::read_to_string(&path).expect("read golden-vectors-keyring-4x4.json");
    let v: Value = serde_json::from_str(&text).expect("parse json");

    let expected = &v["expected"];
    let json_expected = expected["canonical_json"]
        .as_str()
        .expect("canonical_json string");
    let cbor_hex_expected = expected["canonical_cbor_hex"]
        .as_str()
        .expect("canonical_cbor_hex string");
    let xml_expected = expected["canonical_xml"]
        .as_str()
        .expect("canonical_xml string");

    // 1. Decode canonical_json into a DynamicValue
    let dv = DynamicValue::from_canonical_json(json_expected)
        .expect("Failed to decode canonical_json in Rust oracle");

    // 2. Verify JSON re-encoding matches canonical_json
    let re_json = dv.to_canonical_json().expect("to_canonical_json");
    assert_eq!(re_json, json_expected, "JSON re-encoding mismatch");

    // 3. Verify CBOR re-encoding matches canonical_cbor_hex
    let cbor_bytes = dv.to_canonical_cbor().expect("to_canonical_cbor");
    assert_eq!(
        hex(&cbor_bytes),
        cbor_hex_expected,
        "CBOR re-encoding mismatch"
    );

    // 4. Verify XML re-encoding matches canonical_xml
    let re_xml = dv.to_canonical_xml().expect("to_canonical_xml");
    assert_eq!(re_xml, xml_expected, "XML re-encoding mismatch");
}
