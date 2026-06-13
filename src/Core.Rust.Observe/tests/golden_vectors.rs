//! Cross-language-parity = non-Byzantine-BFT (B-0944): the Rust observe-algebra
//! (oracle #4) replays the SHARED golden-vector fixture and must produce the SAME
//! states the TS reference (oracle #1) emitted — and that the F#/C# oracles already
//! reproduced. "The compilers don't lie." Fixture: src/Core.TypeScript/observe/golden-vectors.json.
//!
//! The parity tests use the zero-dep `ZetaJsonParser`. The differential test
//! (feature `serde`) parses the fixture with BOTH our parser and the serde adapter
//! and asserts identical observe data — so we are not flying blind on our parser.

use std::path::PathBuf;

use zeta_core_observe::json::{JsonParser, ZetaJsonParser};
use zeta_core_observe::observe_json::{parse_event, parse_world};
use zeta_core_observe::{fold, replay, NextAction, World};

/// Walk up from the crate dir to the repo root (Zeta.sln sentinel).
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// Parse the fixture with the given parser → (initial, events, expectedFinal,
/// expectedReplay). Panics with a clear message on any shape mismatch.
fn load(parser: &dyn JsonParser) -> (World, Vec<NextAction>, World, Vec<World>) {
    let path = repo_root().join("src/Core.TypeScript/observe/golden-vectors.json");
    let text = std::fs::read_to_string(&path).expect("read golden-vectors.json");
    let root = parser.parse(&text).expect("parse golden-vectors.json");

    let initial = parse_world(root.get("initialWorld").expect("initialWorld")).expect("map initialWorld");
    let events = root
        .get("events")
        .and_then(|e| e.as_array())
        .expect("events array")
        .iter()
        .map(|e| parse_event(e).expect("map event"))
        .collect::<Vec<_>>();
    let expected_final = parse_world(root.get("expectedFinalState").expect("expectedFinalState"))
        .expect("map expectedFinalState");
    let expected_replay = root
        .get("expectedReplayStates")
        .and_then(|s| s.as_array())
        .expect("expectedReplayStates array")
        .iter()
        .map(|s| parse_world(s).expect("map replay state"))
        .collect::<Vec<_>>();

    (initial, events, expected_final, expected_replay)
}

#[test]
fn fold_reproduces_expected_final_state() {
    let (initial, events, expected_final, _) = load(&ZetaJsonParser);
    assert_eq!(expected_final, fold(&initial, &events));
}

#[test]
fn replay_reproduces_expected_replay_states() {
    let (initial, events, _, expected_replay) = load(&ZetaJsonParser);
    assert_eq!(expected_replay, replay(&initial, &events));
}

#[test]
fn golden_vectors_exercise_all_nine_kinds() {
    let (_, events, _, _) = load(&ZetaJsonParser);
    let kinds: std::collections::HashSet<_> =
        events.iter().map(std::mem::discriminant).collect();
    assert_eq!(9, kinds.len(), "all nine NextAction kinds must appear");
}

/// Differential: our zero-dep parser and the serde adapter must yield identical
/// observe data ("not flying blind"). Runs under `cargo test --features serde`.
#[cfg(feature = "serde")]
#[test]
fn zeta_parser_matches_serde() {
    use zeta_core_observe::json::SerdeJsonParser;
    let ours = load(&ZetaJsonParser);
    let serde = load(&SerdeJsonParser);
    assert_eq!(ours, serde, "ZetaJsonParser and SerdeJsonParser disagree on the fixture");
}
