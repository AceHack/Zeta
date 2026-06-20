//! Provisional experience layer cross-verification oracle.

use serde::Serialize;
use std::path::{Path, PathBuf};
use zeta_core_sha256::sha256_hex;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProvisionalUli {
    language_code: String,
    lexicon_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProvisionalUii {
    agent_id: String,
    capabilities: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProvisionalUti {
    temperature: f64,
    decay_rate: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProvisionalUtri {
    root_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProvisionalExperienceState {
    uli: ProvisionalUli,
    uii: ProvisionalUii,
    uti: ProvisionalUti,
    utri: ProvisionalUtri,
    root_hash: String,
}

fn repo_root() -> PathBuf {
    let mut path = std::env::current_dir().expect("current_dir");
    while !path.join("Zeta.sln").exists() {
        path = path.parent().expect("locate repo root").to_path_buf();
    }
    path
}

fn hash_symlink(path: &Path) -> String {
    let target = std::fs::read_link(path).expect("read_link");
    let target_str = target.to_str().expect("to_str");
    let normalized = target_str.replace('\\', "/");
    let bytes = format!("symlink\n{}", normalized);
    sha256_hex(bytes.as_bytes())
}

fn hash_file(path: &Path) -> String {
    let content = std::fs::read(path).expect("read file");
    let mut buffer = b"file\n".to_vec();
    buffer.extend_from_slice(&content);
    sha256_hex(&buffer)
}

struct ChildEntry {
    entry_type: String,
    hash: String,
    name: String,
}

fn hash_directory(path: &Path) -> String {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path).expect("read_dir") {
        let entry = entry.expect("entry");
        let entry_path = entry.path();
        let metadata = std::fs::symlink_metadata(&entry_path).expect("symlink_metadata");
        let name = entry.file_name().into_string().expect("file_name");

        if metadata.file_type().is_symlink() {
            entries.push(ChildEntry {
                entry_type: "symlink".to_string(),
                hash: hash_symlink(&entry_path),
                name,
            });
        } else if metadata.file_type().is_dir() {
            entries.push(ChildEntry {
                entry_type: "dir".to_string(),
                hash: hash_directory(&entry_path),
                name,
            });
        } else {
            entries.push(ChildEntry {
                entry_type: "file".to_string(),
                hash: hash_file(&entry_path),
                name,
            });
        }
    }

    entries.sort_by(|a, b| a.name.cmp(&b.name));

    let mut lines = "directory\n".to_string();
    for entry in entries {
        lines.push_str(&format!(
            "{} {} {}\n",
            entry.entry_type, entry.hash, entry.name
        ));
    }

    sha256_hex(lines.as_bytes())
}

#[test]
fn provisional_experience_replay_matches_golden_vectors() {
    let root = repo_root();
    let fixture_dir = root
        .join("tests")
        .join("cross-verification")
        .join("experience")
        .join("fixtures")
        .join("tree1");
    let root_hash = hash_directory(&fixture_dir);

    let mut caps = vec!["speak".to_string(), "traverse".to_string()];
    caps.sort();

    let state = ProvisionalExperienceState {
        uli: ProvisionalUli {
            language_code: "en-US".to_string(),
            lexicon_hash: "a8f5c2b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1"
                .to_string(),
        },
        uii: ProvisionalUii {
            agent_id: "agent-007".to_string(),
            capabilities: caps,
        },
        uti: ProvisionalUti {
            temperature: 0.7,
            decay_rate: 0.1,
        },
        utri: ProvisionalUtri {
            root_hash: root_hash.clone(),
        },
        root_hash: root_hash.clone(),
    };

    let mut results = std::collections::BTreeMap::new();
    results.insert("provisional-experience-v1".to_string(), state);

    let json = serde_json::to_string_pretty(&results).expect("json serialize");
    let output_path = root
        .join("tests")
        .join("cross-verification")
        .join("experience")
        .join("rust-output.json");
    std::fs::write(&output_path, format!("{}\n", json)).expect("write rust-output.json");

    assert_eq!(
        root_hash,
        "081478c5744a061d3eb3e9800a78517b8f6dc060759a2ce2a0a32b516c80fdc9"
    );
}
