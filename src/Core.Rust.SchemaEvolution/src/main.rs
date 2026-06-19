// Schema evolution golden vector conformance — Rust oracle (#4 of 10).
// Parses schema-golden-vectors.json, replays deltas, asserts value-equality.

use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::fs;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct SchemaField {
    name: String,
    #[serde(rename = "type")]
    field_type: String,
    required: bool,
}

#[derive(Debug, Clone)]
struct SchemaEntry {
    field: SchemaField,
    weight: i32,
}

#[derive(Debug, Deserialize)]
struct Delta {
    retract: Vec<SchemaField>,
    insert: Vec<SchemaField>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReplayState {
    // Deserialized to keep the struct faithful to the golden-vector schema;
    // this oracle asserts on entry_count, not the field list itself.
    #[allow(dead_code)]
    active_fields: Vec<SchemaField>,
    entry_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FinalState {
    field_names: Vec<String>,
    field_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommPair {
    delta_a: usize,
    delta_b: usize,
    // Present in the golden vector; this oracle re-derives commutativity
    // rather than trusting the recorded flag.
    #[allow(dead_code)]
    commutes: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenVectors {
    initial_fields: Vec<SchemaField>,
    deltas: Vec<Delta>,
    expected_replay_states: Vec<ReplayState>,
    expected_final_state: FinalState,
    commutative_pairs: Vec<CommPair>,
}

fn apply_delta(schema: &[SchemaEntry], delta: &Delta) -> Vec<SchemaEntry> {
    let mut map: HashMap<String, (SchemaField, i32)> = HashMap::new();

    for entry in schema {
        let e = map
            .entry(entry.field.name.clone())
            .or_insert_with(|| (entry.field.clone(), 0));
        e.1 += entry.weight;
    }

    for field in &delta.retract {
        let e = map
            .entry(field.name.clone())
            .or_insert_with(|| (field.clone(), 0));
        e.1 -= 1;
    }

    for field in &delta.insert {
        let e = map
            .entry(field.name.clone())
            .or_insert_with(|| (field.clone(), 0));
        e.1 += 1;
        e.0 = field.clone(); // new definition takes precedence
    }

    map.into_values()
        .filter(|(_, w)| *w != 0)
        .map(|(field, weight)| SchemaEntry { field, weight })
        .collect()
}

fn active_fields(schema: &[SchemaEntry]) -> Vec<&SchemaField> {
    schema
        .iter()
        .filter(|e| e.weight > 0)
        .map(|e| &e.field)
        .collect()
}

fn sorted_field_names(schema: &[SchemaEntry]) -> Vec<String> {
    let mut names: Vec<String> = active_fields(schema)
        .iter()
        .map(|f| f.name.clone())
        .collect();
    names.sort();
    names
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: schema-evolution <path-to-schema-golden-vectors.json>");
        std::process::exit(1);
    }

    let json_str = fs::read_to_string(&args[1]).expect("Failed to read golden vectors JSON");
    let vectors: GoldenVectors = serde_json::from_str(&json_str).expect("Failed to parse JSON");

    // Initialize schema
    let mut schema: Vec<SchemaEntry> = vectors
        .initial_fields
        .iter()
        .map(|f| SchemaEntry {
            field: f.clone(),
            weight: 1,
        })
        .collect();

    // Replay deltas
    println!("--- Replaying deltas ---");
    let mut replay_states = Vec::new();
    for (i, delta) in vectors.deltas.iter().enumerate() {
        schema = apply_delta(&schema, delta);
        replay_states.push(schema.clone());

        let active = active_fields(&schema);
        let expected = &vectors.expected_replay_states[i];

        assert_eq!(
            active.len(),
            expected.entry_count,
            "Delta {} field count mismatch: expected {}, got {}",
            i,
            expected.entry_count,
            active.len()
        );
        println!("  Delta {}: {} fields ✓", i, active.len());
    }

    // Assert final state
    println!("--- Final state ---");
    let final_names = sorted_field_names(&schema);
    assert_eq!(
        final_names, vectors.expected_final_state.field_names,
        "Final field names mismatch"
    );
    assert_eq!(
        active_fields(&schema).len(),
        vectors.expected_final_state.field_count,
        "Final field count mismatch"
    );
    println!(
        "  Final: {} fields [{}] ✓",
        final_names.len(),
        final_names.join(", ")
    );

    // Assert commutativity
    println!("--- Commutativity ---");
    let initial_schema: Vec<SchemaEntry> = vectors
        .initial_fields
        .iter()
        .map(|f| SchemaEntry {
            field: f.clone(),
            weight: 1,
        })
        .collect();

    for pair in &vectors.commutative_pairs {
        let state_ab = apply_delta(
            &apply_delta(&initial_schema, &vectors.deltas[pair.delta_a]),
            &vectors.deltas[pair.delta_b],
        );
        let state_ba = apply_delta(
            &apply_delta(&initial_schema, &vectors.deltas[pair.delta_b]),
            &vectors.deltas[pair.delta_a],
        );

        let names_ab = sorted_field_names(&state_ab);
        let names_ba = sorted_field_names(&state_ba);

        assert_eq!(
            names_ab, names_ba,
            "Deltas ({},{}) do not commute",
            pair.delta_a, pair.delta_b
        );
        println!("  Deltas ({},{}) commute ✓", pair.delta_a, pair.delta_b);
    }

    println!("\nAll golden vectors passed! (Rust oracle #4)");
}
