//! Durability cross-oracle fuzzer binary.
//! Simple JSON-like parser to parse ZSet pairs from command line without external dependencies,
//! and outputs CBOR hex or ZSet pairs.

use std::env;
use std::process;
use zeta_core_algebra::zset::{ZEntry, ZSet};
use zeta_core_dynamic_value::DynamicValue;
use zeta_core_durability::{CborDeltaCodec, DeltaCodec};

fn key_enc(i: &i32) -> DynamicValue {
    DynamicValue::Int(*i as i64)
}

fn key_dec(dv: &DynamicValue) -> Result<i32, String> {
    match dv {
        DynamicValue::Int(w) => Ok(*w as i32),
        other => Err(format!("Expected Int key, got {:?}", other)),
    }
}

fn from_hex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("invalid hex"))
        .collect()
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Parses a string of pairs like `[[1,2],[3,-4]]` or `[]` into a list of tuples.
fn parse_pairs(s: &str) -> Vec<(i32, i64)> {
    let s = s.trim().trim_start_matches('[').trim_end_matches(']');
    if s.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    // split by "],["
    let parts = s.split("],[");
    for part in parts {
        let p = part.trim_start_matches('[').trim_end_matches(']');
        let mut kv = p.split(',');
        let k_str = kv.next().expect("key missing").trim();
        let v_str = kv.next().expect("weight missing").trim();
        let k = k_str.parse::<i32>().expect("invalid key integer");
        let v = v_str.parse::<i64>().expect("invalid weight integer");
        out.push((k, v));
    }
    out
}

/// Formats a list of pairs into a string like `[[1,2],[3,-4]]`.
fn format_pairs(pairs: &[(i32, i64)]) -> String {
    let mut out = String::new();
    out.push('[');
    for (i, &(k, v)) in pairs.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(&format!("[{},{}]", k, v));
    }
    out.push(']');
    out
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: durability_fuzz encode \"[[1,2],[3,-4]]\"");
        eprintln!("       durability_fuzz decode <hex>");
        process::exit(1);
    }

    let codec = CborDeltaCodec::new(key_enc, key_dec);

    let action = &args[1];
    let payload = &args[2];

    if action == "encode" {
        let pairs = parse_pairs(payload);
        let entries = pairs
            .into_iter()
            .map(|(e, w)| ZEntry { e, w })
            .collect::<Vec<_>>();
        let z = ZSet::of_entries(entries);
        let bytes = codec.encode(&z);
        println!("{}", to_hex(&bytes));
    } else if action == "decode" {
        let bytes = from_hex(payload);
        match codec.decode(&bytes) {
            Ok(z) => {
                let pairs = z
                    .to_entries()
                    .into_iter()
                    .map(|entry| (entry.e, entry.w))
                    .collect::<Vec<_>>();
                println!("{}", format_pairs(&pairs));
            }
            Err(e) => {
                eprintln!("Decode error: {}", e);
                process::exit(1);
            }
        }
    } else {
        eprintln!("Unknown action: {}", action);
        process::exit(1);
    }
}
