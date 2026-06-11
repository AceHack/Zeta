//! Replays the shared FourCorner treaty golden lines through the Rust oracle; the F#/C#/TS oracles
//! replay the same file. FOURTH oracle — closes the square (B-1022: "we are the consumer for our
//! treaties").

use std::fs;
use std::path::PathBuf;
use zeta_four_corner::FourCornerOwnership;

fn golden_lines() -> Vec<String> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/four-corner/golden-vectors.lines");
    fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("golden not found: {}", path.display()))
        .lines()
        .filter(|l| !l.starts_with('#') && !l.is_empty())
        .map(|l| l.to_string())
        .collect()
}

fn vectors() -> Vec<FourCornerOwnership> {
    vec![
        FourCornerOwnership {
            t_in: "operator-message".into(),
            t_out: Some("emitted".into()),
            t_out_feedback: Some("conv-feedback".into()),
            t_in_feedback: Some("co-owned-ack".into()),
        },
        FourCornerOwnership::of_in("only-input"),
        FourCornerOwnership {
            t_in: "tab\there\nand-newline".into(),
            t_out: Some("back\\slash".into()),
            t_out_feedback: None,
            t_in_feedback: Some("ends-with-tab\t".into()),
        },
        FourCornerOwnership {
            t_in: "".into(),
            t_out: Some("".into()),
            t_out_feedback: None,
            t_in_feedback: None,
        },
        FourCornerOwnership {
            t_in: "héllo-wörld-⊕-unicode".into(),
            t_out: None,
            t_out_feedback: Some("反馈".into()),
            t_in_feedback: None,
        },
    ]
}

#[test]
fn byte_lock_every_vector_serializes_to_its_golden_line_exactly() {
    let lines = golden_lines();
    let vs = vectors();
    assert_eq!(vs.len(), lines.len());
    for (v, expected) in vs.iter().zip(lines.iter()) {
        assert_eq!(&v.to_line(), expected);
    }
}

#[test]
fn round_trip_every_golden_line_parses_back_to_its_vector() {
    let lines = golden_lines();
    let vs = vectors();
    for (v, line) in vs.iter().zip(lines.iter()) {
        let parsed = FourCornerOwnership::of_line(line).expect("golden line must parse");
        assert_eq!(&parsed, v);
    }
}
