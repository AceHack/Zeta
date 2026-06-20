// Independent Rust oracle: compute MurmurHash3 fmix32 over the canonical inputs
// and emit rust-output.json. Recomputes the finaliser with wrapping u32 arithmetic
// (does not depend on the zeta crate) so it is a genuine independent oracle.
use std::fs;
use std::path::Path;

fn fmix32(x: u32) -> u32 {
    let mut h = x;
    h ^= h >> 16;
    h = h.wrapping_mul(0x85ebca6b);
    h ^= h >> 13;
    h = h.wrapping_mul(0xc2b2ae35);
    h ^= h >> 16;
    h
}

fn main() {
    let inputs: [(&str, u32); 10] = [
        ("x-0", 0),
        ("x-1", 1),
        ("x-2", 2),
        ("x-10", 10),
        ("x-255", 255),
        ("x-u32max", 4294967295),
        ("x-0x9e3779b9", 2654435769),
        ("x-2pow31", 2147483648),
        ("x-3735928559", 3735928559),
        ("x-1e9", 1000000000),
    ];
    let mut s = String::from("{\n");
    for (i, (id, x)) in inputs.iter().enumerate() {
        let comma = if i < inputs.len() - 1 { "," } else { "" };
        s.push_str(&format!("  \"{}\": \"{}\"{}\n", id, fmix32(*x), comma));
    }
    s.push_str("}\n");
    // gen.rs is compiled+run with cwd = the _gen dir; write to the parent.
    let target = Path::new("..").join("rust-output.json");
    fs::write(target, s).expect("write rust-output.json");
    println!("wrote rust-output.json");
}
