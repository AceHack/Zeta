//! Schema evolution cross-language conformance test replaying the shared seed.

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use zeta_core_dynamic_value::DynamicValue;
use zeta_core_dynamic_value::schema_evolution::{
    Migration, add_field_migration, remove_field_migration, remove_field_with_dump_migration,
    rename_field_migration,
};

fn repo_root() -> PathBuf {
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    loop {
        if dir.join("Zeta.sln").exists() {
            return dir;
        }
        assert!(dir.pop(), "could not locate repo root (Zeta.sln)");
    }
}

fn build_value(v: &Value) -> DynamicValue {
    match v["t"].as_str().expect("tag string") {
        "null" => DynamicValue::Null,
        "bool" => DynamicValue::Bool(v["v"].as_bool().expect("bool value")),
        "int" => DynamicValue::Int(
            v["v"]
                .as_str()
                .expect("int decimal string")
                .parse::<i64>()
                .expect("i64 parse"),
        ),
        "float" => DynamicValue::Float(
            v["v"]
                .as_str()
                .expect("float decimal string")
                .parse::<f64>()
                .expect("f64 parse"),
        ),
        "str" => DynamicValue::String(v["v"].as_str().expect("str value").to_string()),
        "arr" => DynamicValue::Array(
            v["v"]
                .as_array()
                .expect("arr value")
                .iter()
                .map(build_value)
                .collect(),
        ),
        "obj" => DynamicValue::Object(
            v["v"]
                .as_array()
                .expect("obj value")
                .iter()
                .map(|pair| {
                    let p = pair.as_array().expect("pair array");
                    (
                        p[0].as_str().expect("key string").to_string(),
                        build_value(&p[1]),
                    )
                })
                .collect(),
        ),
        other => panic!("unknown tag {}", other),
    }
}

fn build_op(v: &Value) -> Migration {
    let op = v["op"].as_str().expect("op name");
    match op {
        "add" => {
            let key = v["key"].as_str().expect("key").to_string();
            let def = build_value(&v["default"]);
            add_field_migration(0, key, def)
        }
        "rename" => {
            let from = v["from"].as_str().expect("from").to_string();
            let to = v["to"].as_str().expect("to").to_string();
            rename_field_migration(0, from, to)
        }
        "remove" => {
            let key = v["key"].as_str().expect("key").to_string();
            let def = build_value(&v["default"]);
            remove_field_migration(0, key, def)
        }
        "remove_with_dump" => {
            let key = v["key"].as_str().expect("key").to_string();
            remove_field_with_dump_migration(0, key)
        }
        _ => panic!("unknown op {}", op),
    }
}

#[test]
fn replay_golden_vectors_schema_evolution() {
    let path =
        repo_root().join("src/Core.TypeScript/dynamic-value/golden-vectors-schema-evolution.json");
    let content = fs::read_to_string(path).expect("read golden vectors file");
    let root: Value = serde_json::from_str(&content).expect("parse json");
    let vectors = root["vectors"].as_array().expect("vectors array");

    for vec in vectors {
        let name = vec["name"].as_str().unwrap();
        let input = build_value(&vec["input"]);
        let expected_up = build_value(&vec["expected_up"]);
        let expected_down = build_value(&vec["expected_down"]);
        let ops: Vec<Migration> = vec["ops"]
            .as_array()
            .unwrap()
            .iter()
            .map(build_op)
            .collect();

        // Run Up migrations
        let mut val = input;
        for op in &ops {
            val = (op.up)(val);
        }
        assert_eq!(
            val, expected_up,
            "Vector {}: Up migration output mismatch",
            name
        );

        // Run Down migrations
        let mut back_val = val;
        for op in ops.iter().rev() {
            assert!(
                op.down.is_some(),
                "Vector {}: down migration function missing",
                name
            );
            if let Some(down) = &op.down {
                back_val = down(back_val);
            }
        }
        assert_eq!(
            back_val, expected_down,
            "Vector {}: Down migration output mismatch",
            name
        );
    }
}
