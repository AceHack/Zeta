//! Replays the CHIP-9 treaty ROM through the Rust oracle against the F#-locked golden color grid.
//! Four compilers, one palette, one picture.

use std::fs;
use std::path::PathBuf;
use zeta_chip9::{Chip9, H, W};

#[test]
fn byte_lock_replaying_the_treaty_rom_reproduces_the_golden_color_grid_exactly() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/chip9/golden-vectors.lines");
    let text =
        fs::read_to_string(&path).unwrap_or_else(|_| panic!("golden not found: {}", path.display()));
    let lines: Vec<&str> = text
        .lines()
        .filter(|l| !l.starts_with('#') && !l.is_empty())
        .collect();

    let rom_hex = lines[0].split('\t').nth(1).unwrap();
    let rom: Vec<u8> = (0..rom_hex.len() / 2)
        .map(|i| u8::from_str_radix(&rom_hex[i * 2..i * 2 + 2], 16).unwrap())
        .collect();
    let golden_plane: u8 = lines[1].split('\t').nth(1).unwrap().parse().unwrap();
    let golden_rows = &lines[2..2 + H]; // the fault-treaty keys follow the grid
    assert_eq!(golden_rows.len(), H);

    let mut m = Chip9::create();
    m.load_rom(&rom);
    for k in 0..8 { m.mem.insert(0x300 + k, 0xff); } // solid 8x8 treaty sprite (B-1031)
    for _ in 0..30 {
        m.step();
    }

    assert_eq!(m.plane, golden_plane);
    for (y, golden_row) in golden_rows.iter().enumerate() {
        let row: String = (0..W).map(|x| format!("{:x}", m.color_at(x, y))).collect();
        assert_eq!(&row, golden_row, "row {y} diverged");
    }
}

fn keyed<'a>(lines: &'a [&'a str], key: &str) -> &'a str {
    lines
        .iter()
        .find(|l| l.starts_with(&format!("{key}\t")))
        .unwrap_or_else(|| panic!("golden key missing: {key}"))
        .split('\t')
        .nth(1)
        .unwrap()
}

#[test]
fn fault_treaty_recorded_never_fatal_refused_call_falls_through_text_pc_depth_byte_locked() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf();
    let path = root.join("src/Core.TypeScript/chip9/golden-vectors.lines");
    let text = fs::read_to_string(&path).unwrap();
    let lines: Vec<&str> = text
        .lines()
        .filter(|l| !l.starts_with('#') && !l.is_empty())
        .collect();

    for which in ["underflow", "overflow"] {
        let rom_hex = keyed(&lines, &format!("fault-rom-{which}"));
        let rom: Vec<u8> = (0..rom_hex.len() / 2)
            .map(|i| u8::from_str_radix(&rom_hex[i * 2..i * 2 + 2], 16).unwrap())
            .collect();
        let steps: usize = keyed(&lines, &format!("fault-steps-{which}")).parse().unwrap();

        let mut m = Chip9::create();
        m.load_rom(&rom);
        for _ in 0..steps {
            m.step();
        }

        assert_eq!(
            m.fault.as_deref(),
            Some(keyed(&lines, &format!("fault-text-{which}"))),
            "{which}: fault text"
        );
        assert_eq!(
            format!("{:04x}", m.pc),
            keyed(&lines, &format!("fault-pc-{which}")),
            "{which}: pc"
        );
        let depth: usize = keyed(&lines, &format!("fault-depth-{which}")).parse().unwrap();
        assert_eq!(m.stack.len(), depth, "{which}: depth");
    }
}
