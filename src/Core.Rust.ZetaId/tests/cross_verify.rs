//! Cross-language-parity = the verification (B-0679, m-acc multi-oracle): the Rust
//! ZetaId codec (oracle #4) packs the SHARED golden vectors and must produce the
//! exact canonical hex the TS reference (oracle #1) emitted — and that the F#/C#
//! oracles already reproduced. "The compilers don't lie."
//!
//! Reads `tests/cross-verification/zeta-id/vectors.yaml` (the shared fixture) and
//! writes `rust-output.json` to the same directory, so
//! `tests/cross-verification/zeta-id/compare.ts` can deep-equal all four outputs.
//!
//! Zero-dep: the fixture is a flat list of scalar `key: value` records (no nesting,
//! no anchors), so a ~40-line hand reader suffices — keeping the oracle dependency
//! free (supply-chain doctrine; B-0679's `serde_yaml` suggestion predates that
//! house style and serde_yaml is now unmaintained).

use std::collections::HashMap;
use std::path::PathBuf;

use zeta_core_zeta_id::{pack, to_hex, unpack, Authority, DeterministicEnv, Momentum, ZetaObservation};

/// Walk up from the crate dir to the repo root (`Zeta.sln` sentinel), matching the
/// convention in `src/Core.Rust.Observe/tests/golden_vectors.rs`.
fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

/// Strip surrounding quotes; map the literal `null` to the empty option-sentinel.
fn parse_scalar(s: &str) -> String {
    if s == "null" {
        return "null".to_string();
    }
    if s.len() >= 2 && s.starts_with('"') && s.ends_with('"') {
        return s[1..s.len() - 1].to_string();
    }
    s.to_string()
}

/// Parse the flat-schema fixture into one map per `- id:` record.
fn parse_vectors(text: &str) -> Vec<HashMap<String, String>> {
    let mut records: Vec<HashMap<String, String>> = Vec::new();
    let mut current: Option<HashMap<String, String>> = None;
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        // A record begins at a `- ` list item; the remainder is its first field.
        let (is_new, field_line) = match line.strip_prefix("- ") {
            Some(rest) => (true, rest),
            None => (false, line),
        };
        if is_new {
            if let Some(rec) = current.take() {
                records.push(rec);
            }
            current = Some(HashMap::new());
        }
        if let Some((k, v)) = field_line.split_once(':') {
            // Pre-record lines (version/description/vectors:) have no current map → ignored.
            if let Some(rec) = current.as_mut() {
                rec.insert(k.trim().to_string(), parse_scalar(v.trim()));
            }
        }
    }
    if let Some(rec) = current.take() {
        records.push(rec);
    }
    records
}

/// Field accessor with a clear panic message naming the vector + field.
fn field<'a>(rec: &'a HashMap<String, String>, key: &str) -> &'a str {
    rec.get(key)
        .unwrap_or_else(|| {
            let id = rec.get("id").map_or("<no-id>", String::as_str);
            panic!("vector {id} missing field {key}")
        })
        .as_str()
}

/// Parse a `u8` field; panic with a clear message on failure.
fn u8_field(rec: &HashMap<String, String>, key: &str) -> u8 {
    field(rec, key)
        .parse()
        .unwrap_or_else(|_| panic!("vector {} field {key} not a u8", field(rec, "id")))
}

/// `null` → `None`; else parse the `u8`.
fn opt_u8_field(rec: &HashMap<String, String>, key: &str) -> Option<u8> {
    match field(rec, key) {
        "null" => None,
        v => Some(v.parse().unwrap_or_else(|_| panic!("field {key} not a u8: {v}"))),
    }
}

fn authority_from(ty: &str, raw: Option<u8>) -> Authority {
    match ty {
        "HumanVerified" => Authority::HumanVerified,
        "TrustedAgent" => Authority::TrustedAgent,
        "Standard" => Authority::Standard,
        "BestEffort" => Authority::BestEffort,
        "Simulated" => Authority::Simulated,
        "Raw" => Authority::Raw(raw.expect("authority_raw required for Raw")),
        other => panic!("unknown authority_type {other}"),
    }
}

fn momentum_from(ty: &str, raw: Option<u8>) -> Momentum {
    match ty {
        "Background" => Momentum::Background,
        "Normal" => Momentum::Normal,
        "Elevated" => Momentum::Elevated,
        "High" => Momentum::High,
        "Critical" => Momentum::Critical,
        "Raw" => Momentum::Raw(raw.expect("momentum_raw required for Raw")),
        other => panic!("unknown momentum_type {other}"),
    }
}

/// Minimal JSON string escaping (ids + hex are plain ASCII, but be safe).
fn json_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

#[test]
fn cross_verify_matches_shared_vectors() {
    let fixture_dir = repo_root().join("tests/cross-verification/zeta-id");
    let text = std::fs::read_to_string(fixture_dir.join("vectors.yaml")).expect("read vectors.yaml");
    let records = parse_vectors(&text);
    assert!(!records.is_empty(), "no vectors parsed");

    // (id, hex, roundtrip_ok, matches_expected) in fixture order.
    let mut results: Vec<(String, String, bool, bool)> = Vec::with_capacity(records.len());
    let mut roundtrip_mismatches = 0usize;
    let mut hex_mismatches = 0usize;

    for rec in &records {
        let id = field(rec, "id").to_string();
        let obs = ZetaObservation {
            version: u8_field(rec, "version"),
            timestamp: field(rec, "timestamp").parse().expect("timestamp u64"),
            chromosome: u8_field(rec, "chromosome"),
            category: u8_field(rec, "category"),
            firefly: u8_field(rec, "firefly"),
            authority: authority_from(field(rec, "authority_type"), opt_u8_field(rec, "authority_raw")),
            persona: u8_field(rec, "persona"),
            momentum: momentum_from(field(rec, "momentum_type"), opt_u8_field(rec, "momentum_raw")),
            location: u8_field(rec, "location"),
        };

        let id_value = pack(&obs, &DeterministicEnv).expect("pack");
        let hex = to_hex(id_value);
        let roundtrip_ok = unpack(id_value) == obs;
        let expected_hex = field(rec, "expected_hex");
        let matches_expected = hex == expected_hex;

        if !roundtrip_ok {
            roundtrip_mismatches += 1;
            eprintln!("Roundtrip MISMATCH for {id}");
        }
        if !matches_expected {
            hex_mismatches += 1;
            eprintln!("Hex MISMATCH for {id}: got {hex}, expected {expected_hex}");
        }
        results.push((id, hex, roundtrip_ok, matches_expected));
    }

    // Emit rust-output.json in the shared shape: { id: { hex, roundtripOk, matchesExpected } }.
    let mut out = String::from("{\n");
    for (i, (id, hex, rt, me)) in results.iter().enumerate() {
        out.push_str(&format!(
            "  {}: {{\n    \"hex\": {},\n    \"roundtripOk\": {},\n    \"matchesExpected\": {}\n  }}",
            json_str(id),
            json_str(hex),
            rt,
            me,
        ));
        out.push_str(if i + 1 < results.len() { ",\n" } else { "\n" });
    }
    out.push_str("}\n");

    // Golden-file discipline (PR review 2026-06-01): do NOT unconditionally rewrite the
    // tracked fixture — that dirties the working tree and fails in read-only checkouts.
    // Default: assert the checked-in rust-output.json matches the freshly generated output.
    // Regenerate on demand with `UPDATE_GOLDEN=1 cargo test`.
    let output_path = fixture_dir.join("rust-output.json");
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        std::fs::write(&output_path, &out).expect("write rust-output.json");
    } else {
        let existing = std::fs::read_to_string(&output_path).unwrap_or_default();
        assert_eq!(
            existing, out,
            "rust-output.json is stale — regenerate with `UPDATE_GOLDEN=1 cargo test`",
        );
    }

    let n = results.len();
    println!(
        "Cross-verify: {n} vectors. Roundtrip {}/{n} OK. Hex matches expected {}/{n}.",
        n - roundtrip_mismatches,
        n - hex_mismatches,
    );

    assert_eq!(roundtrip_mismatches, 0, "{roundtrip_mismatches} roundtrip mismatch(es)");
    assert_eq!(hex_mismatches, 0, "{hex_mismatches} hex mismatch(es)");
}
