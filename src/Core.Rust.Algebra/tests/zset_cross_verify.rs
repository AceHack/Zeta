//! Z-set cross-language conformance (the Rust oracle for the TOP rung). Replays
//! the SHARED, self-describing golden vectors —
//! `src/Core.TypeScript/z-set/golden-vectors.json` — and must value-match every
//! `expectedReplayStates[i]` (after op i) AND `expectedFinalState`. Z-sets
//! serialize as ascending-key-sorted `{e, w}` entries (w != 0, no key twice), so
//! passing == agreeing with the TS/F#/C# oracles (entry-array equality).
//!
//! Dev-only `serde_json` reads the nested-JSON fixture; the production crate
//! (`zeta_core_algebra`) has zero dependencies.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_algebra::zset::{ZEntry, ZSet};

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

/// A JSON array of `{e, w}` objects → `Vec<ZEntry<String>>`.
fn entries(v: &Value) -> Vec<ZEntry<String>> {
    v.as_array()
        .expect("expected a JSON array")
        .iter()
        .map(|x| ZEntry {
            e: x["e"].as_str().expect("entry.e string").to_string(),
            w: x["w"].as_i64().expect("entry.w integer"),
        })
        .collect()
}

#[test]
fn zset_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/z-set/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read z-set golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse z-set golden-vectors.json");

    let mut state = ZSet::of_entries(entries(&v["initialZSet"]));

    let ops = v["ops"].as_array().expect("ops array");
    let expected_replay = v["expectedReplayStates"]
        .as_array()
        .expect("expectedReplayStates array");
    assert_eq!(
        ops.len(),
        expected_replay.len(),
        "ops / expectedReplayStates length mismatch",
    );

    for (i, op) in ops.iter().enumerate() {
        let kind = op["op"].as_str().expect("op.op string");
        state = match kind {
            "add" => state.add(op["arg"].as_str().expect("add arg string").to_string()),
            "addW" => state.add_w(
                op["arg"].as_str().expect("addW arg string").to_string(),
                op["w"].as_i64().expect("addW w integer"),
            ),
            "union" => state.union(&ZSet::of_entries(entries(&op["arg"]))),
            other => panic!("unknown op {other}"),
        };
        assert_eq!(
            state.to_entries(),
            entries(&expected_replay[i]),
            "replay state mismatch after op {i} ({kind})",
        );
    }

    assert_eq!(
        state.to_entries(),
        entries(&v["expectedFinalState"]),
        "final state mismatch",
    );

    println!(
        "Z-set cross-verify: {} ops replayed; all {} replay states + final state match.",
        ops.len(),
        expected_replay.len(),
    );
}
