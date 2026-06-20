// Independent Rust oracle: compute MurmurHash3 fmix64 over the canonical inputs and
// emit rust-output.json. Recomputes the finaliser with wrapping u64 arithmetic (does
// not depend on the zeta crate) so it is a genuine independent oracle.
use std::fs;
use std::path::Path;
fn fmix64(x: u64) -> u64 {
    let mut h = x;
    h ^= h >> 33;
    h = h.wrapping_mul(0xff51afd7ed558ccd);
    h ^= h >> 33;
    h = h.wrapping_mul(0xc4ceb9fe1a85ec53);
    h ^= h >> 33;
    h
}
fn main() {
    let inputs: [(&str, u64); 10] = [
        ("x-0", 0),
        ("x-1", 1),
        ("x-2", 2),
        ("x-10", 10),
        ("x-255", 255),
        ("x-u64max", 18446744073709551615),
        ("x-golden", 11400714819323198485),
        ("x-2pow63", 9223372036854775808),
        ("x-12345678901234567890", 12345678901234567890),
        ("x-1e18", 1000000000000000000),
    ];
    let mut s = String::from("{\n");
    for (i, (id, x)) in inputs.iter().enumerate() {
        let comma = if i < inputs.len() - 1 { "," } else { "" };
        s.push_str(&format!("  \"{}\": \"{}\"{}\n", id, fmix64(*x), comma));
    }
    s.push_str("}\n");
    // gen.rs is compiled+run with cwd = the _gen dir; write to the parent.
    let target = Path::new("..").join("rust-output.json");
    fs::write(target, s).expect("write rust-output.json");
    println!("wrote rust-output.json");
}
