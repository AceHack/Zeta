//! Durability cross-language conformance tests (the Rust oracle). Replays the
//! shared golden-vectors-deltacodec.json treaty, verifying CBOR hex output
//! matches and round-trips correctly, and tests RecoverableSpine.

use std::collections::BTreeMap;
use std::path::PathBuf;

use serde_json::Value;
use zeta_core_algebra::zset::{ZEntry, ZSet};
use zeta_core_dynamic_value::DynamicValue;
use zeta_core_durability::{
    CborDeltaCodec, DeltaCodec, InMemoryDeltaLog, InMemorySnapshotStore, RecoverableSpine,
};

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn key_enc(i: &i32) -> DynamicValue {
    DynamicValue::Int(*i as i64)
}

fn key_dec(dv: &DynamicValue) -> Result<i32, String> {
    match dv {
        DynamicValue::Int(w) => Ok(*w as i32),
        other => Err(format!("Expected Int, got {:?}", other)),
    }
}

fn from_hex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("invalid hex"))
        .collect()
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[test]
fn deltacodec_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core/golden-vectors-deltacodec.json");
    let text = std::fs::read_to_string(&path).expect("read golden-vectors-deltacodec.json");
    let v: Value = serde_json::from_str(&text).expect("parse golden-vectors-deltacodec.json");

    let codec = CborDeltaCodec::new(key_enc, key_dec);

    let vectors = v["vectors"].as_array().expect("vectors array");
    for vector in vectors {
        let name = vector["name"].as_str().expect("name string");
        let pairs_val = vector["pairs"].as_array().expect("pairs array");
        let expected_hex = vector["cborHex"].as_str().expect("cborHex string");

        let mut entries = Vec::new();
        for p in pairs_val {
            let pair = p.as_array().expect("pair array");
            let key = pair[0].as_i64().expect("key i64") as i32;
            let weight = pair[1].as_i64().expect("weight i64");
            entries.push(ZEntry { e: key, w: weight });
        }
        let z = ZSet::of_entries(entries);

        // test encode
        let encoded = codec.encode(&z);
        let encoded_hex = to_hex(&encoded);
        assert_eq!(
            encoded_hex, expected_hex,
            "cborHex mismatch for vector '{}'",
            name
        );

        // test decode
        let decoded_bytes = from_hex(expected_hex);
        let decoded = codec.decode(&decoded_bytes).expect("decode success");
        assert_eq!(
            decoded, z,
            "decode round-trip mismatch for vector '{}'",
            name
        );
    }
}

#[test]
fn recoverable_spine_recovery_flow_works() {
    let log = InMemoryDeltaLog::new();
    let snap = InMemorySnapshotStore::new();

    let mut spine = RecoverableSpine::new(&log, &snap, ZSet::empty(), 0);
    spine.set_auto_snapshot_every(2);

    // Commit 1
    let d1 = ZSet::singleton("a".to_string(), 1);
    let s1 = spine.commit(d1.clone(), BTreeMap::new()).unwrap();
    assert_eq!(s1, 1);
    assert_eq!(spine.consolidate(), &d1);

    // Commit 2 -> triggers auto-snapshot (every 2) + log truncate(2)
    let d2 = ZSet::singleton("b".to_string(), 2);
    let s2 = spine.commit(d2.clone(), BTreeMap::new()).unwrap();
    assert_eq!(s2, 2);
    let expected_state1 = d1.union(&d2);
    assert_eq!(spine.consolidate(), &expected_state1);

    // Commit 3
    let mut d3_entries = Vec::new();
    d3_entries.push(ZEntry { e: "a".to_string(), w: -1 });
    d3_entries.push(ZEntry { e: "c".to_string(), w: 3 });
    let d3 = ZSet::of_entries(d3_entries);
    let s3 = spine.commit(d3, BTreeMap::new()).unwrap();
    assert_eq!(s3, 3);

    // Consolidated state at 3: b:2, c:3 (a:1 + a:-1 nets to 0 and drops)
    let mut expected_entries = Vec::new();
    expected_entries.push(ZEntry { e: "b".to_string(), w: 2 });
    expected_entries.push(ZEntry { e: "c".to_string(), w: 3 });
    let expected_state2 = ZSet::of_entries(expected_entries);
    assert_eq!(spine.consolidate(), &expected_state2);

    // Simulate recovery
    let recovered = RecoverableSpine::recover(&log, &snap, None).unwrap();
    assert_eq!(recovered.applied_seq(), 3);
    assert_eq!(recovered.consolidate(), &expected_state2);
}
