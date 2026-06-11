//! Replays the shared game-state treaty session through the Rust oracle; F#/C#/TS replay the same file.
//! Four compilers, one match, one world.

use std::fs;
use std::path::PathBuf;
use zeta_mesh_pong::{parse_inputs, Game};

#[test]
fn byte_lock_replaying_the_golden_session_hits_every_checkpoint_exactly() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/mesh-pong/golden-vectors.lines");
    let text = fs::read_to_string(&path).unwrap_or_else(|_| panic!("golden not found: {}", path.display()));

    let mut g = Game::create();
    let mut inputs = 0;
    let mut checks = 0;
    for line in text.lines().filter(|l| !l.starts_with('#') && !l.is_empty()) {
        let i1 = line.find('\t').unwrap();
        let i2 = line[i1 + 1..].find('\t').unwrap() + i1 + 1;
        let kind = &line[..i1];
        let rest = &line[i2 + 1..];
        match kind {
            "i" => {
                let (a, b) = parse_inputs(rest).expect("bad input line");
                g = g.step(a, b);
                inputs += 1;
            }
            "c" => {
                assert_eq!(g.to_line(), rest);
                checks += 1;
            }
            other => panic!("unknown line kind: {other}"),
        }
    }
    assert_eq!(inputs, 300);
    assert_eq!(checks, 5);
}

#[test]
fn state_codec_round_trips_and_refuses_malformed() {
    let g = Game::create();
    assert_eq!(Game::of_line(&g.to_line()), Some(g));
    assert!(Game::of_line("garbage").is_none());
    assert!(Game::of_line("ponggame2\t1\t2\t3\t4\t5\t6\t7\t8").is_none());
    assert!(Game::of_line("ponggame1\t1\t2\t3\t4\t5\t6\t7").is_none());
}
