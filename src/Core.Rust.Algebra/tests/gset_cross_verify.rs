//! G-Set cross-language conformance (the Rust oracle joining "meet-in-the-middle"
//! per the fixture header). Replays the SHARED, self-describing golden vectors —
//! `src/Core.TypeScript/g-set/golden-vectors.json` — and must value-match every
//! `expectedReplayStates[i]` (after op i) AND `expectedFinalState`. The fixture
//! embeds the canonical expected states, so passing == agreeing with the TS/F#
//! oracles (sets serialized in canonical ascending order ⇒ equality is array
//! equality).
//!
//! Dev-only `serde_json` reads the nested-JSON fixture; the production crate
//! (`zeta_core_algebra`) has zero dependencies.

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_algebra::gset::GSet;

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

/// A JSON string array → `Vec<String>`.
fn str_vec(v: &Value) -> Vec<String> {
    v.as_array()
        .expect("expected a JSON array")
        .iter()
        .map(|x| x.as_str().expect("expected a JSON string").to_string())
        .collect()
}

#[test]
fn gset_cross_verify_matches_golden_vectors() {
    let path = repo_root().join("src/Core.TypeScript/g-set/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read g-set golden-vectors.json");
    let v: Value = serde_json::from_str(&text).expect("parse g-set golden-vectors.json");

    let mut state = GSet::of_iter(str_vec(&v["initialSet"]));

    let ops = v["ops"].as_array().expect("ops array");
    let expected_replay = v["expectedReplayStates"].as_array().expect("expectedReplayStates array");
    assert_eq!(
        ops.len(),
        expected_replay.len(),
        "ops / expectedReplayStates length mismatch",
    );

    for (i, op) in ops.iter().enumerate() {
        let kind = op["op"].as_str().expect("op.op string");
        state = match kind {
            "add" => state.add(op["arg"].as_str().expect("add arg string").to_string()),
            "union" => state.union(&GSet::of_iter(str_vec(&op["arg"]))),
            other => panic!("unknown op {other}"),
        };
        let expected = str_vec(&expected_replay[i]);
        assert_eq!(
            state.to_vec(),
            expected,
            "replay state mismatch after op {i} ({kind})",
        );
    }

    let final_expected = str_vec(&v["expectedFinalState"]);
    assert_eq!(state.to_vec(), final_expected, "final state mismatch");

    println!(
        "G-Set cross-verify: {} ops replayed; all {} replay states + final state match.",
        ops.len(),
        expected_replay.len(),
    );
}
