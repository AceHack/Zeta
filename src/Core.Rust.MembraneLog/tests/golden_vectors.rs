//! Replays the shared membrane-log treaty lines through the Rust oracle; F#/C#/TS replay the same file.

use std::fs;
use std::path::PathBuf;
use zeta_membrane_log::MembraneCrossing;

fn golden_lines() -> Vec<String> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/recorded-source/golden-vectors.lines");
    fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("golden not found: {}", path.display()))
        .lines()
        .filter(|l| !l.starts_with('#') && !l.is_empty())
        .map(|l| l.to_string())
        .collect()
}

#[test]
fn byte_lock_every_golden_line_parses_and_reserializes_identically() {
    let lines = golden_lines();
    assert_eq!(lines.len(), 10);
    for line in &lines {
        let parsed = MembraneCrossing::of_line(line).expect("golden line must parse");
        assert_eq!(&parsed.to_line(), line);
    }
}

#[test]
fn malformed_and_unknown_kinds_are_refused() {
    assert!(MembraneCrossing::of_line("garbage").is_none());
    assert!(MembraneCrossing::of_line("x\tTimerElapsed\t17").is_none());
    assert!(MembraneCrossing::of_line("0\tNotAKind\t1").is_none());
    assert!(MembraneCrossing::of_line("0\tTimerElapsed").is_none());
    assert!(MembraneCrossing::of_line("0\tSentinelMissing\tjunk").is_none());
}
