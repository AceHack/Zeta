// Independent Rust hand-port oracle for Pelle Evensen's `nasam` mixer.
// Re-implements the public-domain reference FROM SCRATCH — a genuine N-way peer.
// wrapping_mul / rotate_right give native mod-2^64 wrap.
// Reference: https://mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html
use std::fs;
use std::path::Path;

fn nasam(mut x: u64) -> u64 {
    x ^= x.rotate_right(25) ^ x.rotate_right(47);
    x = x.wrapping_mul(0x9E6C63D0676A9A99);
    x ^= (x >> 23) ^ (x >> 51);
    x = x.wrapping_mul(0x9E6D62D06F6A9A9B);
    x ^= (x >> 23) ^ (x >> 51);
    x
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
        s.push_str(&format!("  \"{}\": \"{}\"{}\n", id, nasam(*x), comma));
    }
    s.push_str("}\n");

    let target = Path::new("rust-output.json");
    fs::write(target, s).expect("write rust-output.json");
    println!("wrote rust-output.json (hand-port)");
}
