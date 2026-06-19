// Independent Rust oracle: compute SplitMix64 over the canonical inputs and emit
// rust-output.json. Recomputes the mixer with wrapping u64 arithmetic (does not
// depend on the zeta crate) so it is a genuine independent oracle.
use std::fs;
use std::path::Path;

fn mix(x: u64) -> u64 {
    let mut z = x.wrapping_mul(0x9E3779B97F4A7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
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
        s.push_str(&format!("  \"{}\": \"{}\"{}\n", id, mix(*x), comma));
    }
    s.push_str("}\n");
    // gen.rs is compiled+run with cwd = the _gen dir; write to the parent.
    let target = Path::new("..").join("rust-output.json");
    fs::write(target, s).expect("write rust-output.json");
    println!("wrote rust-output.json");
}
