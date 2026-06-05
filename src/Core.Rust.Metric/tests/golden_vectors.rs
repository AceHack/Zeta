//! Cross-language byte-lock: the Rust sketches must match the F# implementations byte-for-byte
//! over the same inputs. Fixtures generated from src/Core/{BloomFilter,CountMin}.fs.

use zeta_core_metric::{BlockedBloomFilter, CountMinSketch};

fn u64_from_hex(s: &str) -> u64 {
    u64::from_str_radix(s, 16).expect("valid hex u64")
}

#[test]
fn bloom_table_matches_fsharp_golden() {
    let text = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden-vectors-bloom.json"))
        .expect("read bloom golden");
    let v: serde_json::Value = serde_json::from_str(&text).expect("parse bloom golden");
    let bucket_count = v["bucketCount"].as_u64().unwrap() as usize;
    let probes = v["probesPerLookup"].as_u64().unwrap() as usize;

    let mut f = BlockedBloomFilter::new(bucket_count, probes);
    for k in v["keys"].as_array().unwrap() {
        let key: i64 = k.as_str().unwrap().parse().unwrap();
        f.add(key);
    }

    let expected: Vec<u64> = v["table"].as_array().unwrap().iter().map(|x| u64_from_hex(x.as_str().unwrap())).collect();
    assert_eq!(f.table(), expected.as_slice(), "Bloom table mismatch vs F#");
}

#[test]
fn countmin_table_matches_fsharp_golden() {
    let text = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden-vectors-countmin.json"))
        .expect("read countmin golden");
    let v: serde_json::Value = serde_json::from_str(&text).expect("parse countmin golden");
    let depth = v["depth"].as_u64().unwrap() as usize;
    let width = v["width"].as_u64().unwrap() as usize;
    let seed: i64 = v["seed"].as_str().unwrap().parse().unwrap();

    let mut c = CountMinSketch::new(depth, width, seed);
    for h in v["baseHashes"].as_array().unwrap() {
        c.add(u64_from_hex(h.as_str().unwrap()), 1);
    }

    let expected: Vec<i64> = v["table"].as_array().unwrap().iter().map(|x| x.as_str().unwrap().parse().unwrap()).collect();
    assert_eq!(c.snapshot(), expected, "CountMin table mismatch vs F#");
}
