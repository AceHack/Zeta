// Independent Rust hand-port oracle for the xoshiro256** OUTPUT SCRAMBLER.
// Re-implements result = rotl(x*5, 7) * 9 (width 64) FROM SCRATCH — a genuine
// N-way peer. wrapping_mul / rotate_left give native mod-2^64 wrap.
// Public-domain reference: https://prng.di.unimi.it/xoshiro256starstar.c
use std::fs;
use std::path::Path;

fn scramble(x: u64) -> u64 {
    x.wrapping_mul(5).rotate_left(7).wrapping_mul(9)
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
    s.push_str("  \"_source\": \"hand-port-rust\",\n");
    for (i, (id, x)) in inputs.iter().enumerate() {
        let comma = if i == inputs.len() - 1 { "" } else { "," };
        s.push_str(&format!("  \"{}\": \"{}\"{}\n", id, scramble(*x), comma));
    }
    s.push_str("}\n");

    // output dir is the primitive dir (parent of _gen); the runner sets CWD there or here.
    let target = Path::new("rust-output.json");
    fs::write(target, s).expect("write rust-output.json");
    println!("wrote rust-output.json (hand-port)");
}
