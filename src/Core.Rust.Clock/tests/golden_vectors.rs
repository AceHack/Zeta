//! Clock byte-lock -- the Rust oracle replays the shared seed
//! (`src/Core.TypeScript/clock/golden-vectors.json`) and asserts `run` produces
//! the identical monotone stamp sequence as the F#/TS/C# oracles. DST replay
//! agreement across all four languages. "The compilers don't lie."

use std::path::PathBuf;

use serde_json::Value;
use zeta_core_clock::run;

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn seed() -> Value {
    let path = repo_root()
        .join("src")
        .join("Core.TypeScript")
        .join("clock")
        .join("golden-vectors.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("could not read seed {}: {e}", path.display()));
    serde_json::from_str(&text).expect("seed is valid JSON")
}

#[test]
fn run_matches_clock_golden_vectors() {
    let s = seed();
    assert_eq!(s["primitive"], "clock");
    assert_eq!(s["version"], "v1");

    let vectors = s["vectors"].as_array().expect("vectors is an array");
    assert!(!vectors.is_empty());

    for v in vectors {
        let name = v["name"].as_str().unwrap();
        let seed_val = v["seed"].as_i64().unwrap();
        let steps = v["steps"].as_u64().unwrap() as usize;
        let expected: Vec<i64> = v["stamps"].as_array().unwrap().iter().map(|x| x.as_i64().unwrap()).collect();
        let actual = run(seed_val, steps);
        assert_eq!(actual, expected, "clock vector '{name}'");
    }
}
