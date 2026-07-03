//! Gate T2 byte-lock — the Rust oracle for the Versionstamp canonical codec.
//! Reads `src/Core.TypeScript/clock/tick-codec-golden-vectors.json` and asserts
//! that `Versionstamp::encode` / `Versionstamp::decode` produce identical hex
//! strings and values as the F#/TS/C# oracles. "The compilers don't lie."
use serde_json::Value;
use std::path::PathBuf;
use zeta_core_clock::Versionstamp;

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn to_hex(buf: &[u8; 8]) -> String {
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

fn from_hex(hex: &str) -> [u8; 8] {
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect();
    bytes
        .try_into()
        .expect("hex must be exactly 16 chars (8 bytes)")
}

fn vectors() -> Value {
    let path = repo_root()
        .join("src")
        .join("Core.TypeScript")
        .join("clock")
        .join("tick-codec-golden-vectors.json");
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| {
        panic!(
            "could not read tick-codec golden vectors {}: {e}",
            path.display()
        )
    });
    serde_json::from_str(&text).expect("tick-codec golden vectors is valid JSON")
}

#[test]
fn encode_matches_golden_vectors() {
    let v = vectors();
    let vecs = v["vectors"].as_array().expect("vectors is an array");
    assert!(!vecs.is_empty());
    for entry in vecs {
        let name = entry["name"].as_str().unwrap();
        let version = entry["version"].as_str().unwrap().parse::<i64>().unwrap();
        let hex = entry["hex"].as_str().unwrap();
        let vstamp = Versionstamp::of_int(version);
        let encoded = vstamp.encode();
        let actual = to_hex(&encoded);
        assert_eq!(
            actual, hex,
            "Gate T2 encode vector '{name}' (version={version})"
        );
    }
}

#[test]
fn decode_matches_golden_vectors() {
    let v = vectors();
    let vecs = v["vectors"].as_array().expect("vectors is an array");
    for entry in vecs {
        let name = entry["name"].as_str().unwrap();
        let version = entry["version"].as_str().unwrap().parse::<i64>().unwrap();
        let hex = entry["hex"].as_str().unwrap();
        let buf = from_hex(hex);
        let decoded = Versionstamp::decode(buf);
        assert_eq!(
            decoded.version, version,
            "Gate T2 decode vector '{name}' (hex={hex})"
        );
    }
}

#[test]
fn round_trip_golden_vectors() {
    let v = vectors();
    let vecs = v["vectors"].as_array().expect("vectors is an array");
    for entry in vecs {
        let version = entry["version"].as_str().unwrap().parse::<i64>().unwrap();
        let vstamp = Versionstamp::of_int(version);
        let rt = Versionstamp::decode(vstamp.encode());
        assert_eq!(rt.version, version, "Gate T2 round-trip version={version}");
    }
}
