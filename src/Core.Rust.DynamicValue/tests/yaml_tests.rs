//! YAML and MarkdownTreaty tests.

use zeta_core_dynamic_value::markdown::{parse_markdown, serialize_markdown};
use zeta_core_dynamic_value::{DecodeError, DynamicValue};

#[test]
fn test_yaml_round_trip() {
    let sample = DynamicValue::Object(vec![
        ("a".to_string(), DynamicValue::Int(10)),
        ("b".to_string(), DynamicValue::String("hello".to_string())),
        ("n".to_string(), DynamicValue::Null),
        (
            "nested".to_string(),
            DynamicValue::Array(vec![DynamicValue::Int(1), DynamicValue::Bool(true)]),
        ),
    ]);

    let yaml = sample.to_canonical_yaml().unwrap();
    let decoded = DynamicValue::from_canonical_yaml(&yaml).unwrap();
    assert_eq!(sample, decoded);
}

#[test]
fn test_yaml_rejects_non_canonical() {
    let non_canonical = "a: 10\n";
    let res = DynamicValue::from_canonical_yaml(non_canonical);
    assert_eq!(res, Err(DecodeError::NonCanonical));
}

#[test]
fn test_markdown_treaty_round_trip() {
    let metadata = DynamicValue::Object(vec![
        ("title".to_string(), DynamicValue::String("Zeta Rust Treaty".to_string())),
        ("version".to_string(), DynamicValue::Int(1)),
    ]);
    let body = "This is the document body.\nLine 2.\n";

    let serialized = serialize_markdown(&metadata, body).unwrap();
    assert!(serialized.starts_with("---"));

    let (parsed_meta, parsed_body) = parse_markdown(&serialized).unwrap();
    assert_eq!(metadata, parsed_meta);
    assert_eq!(body, parsed_body);
}

#[test]
fn test_markdown_treaty_empty_metadata() {
    let metadata = DynamicValue::Object(vec![]);
    let body = "Pure markdown document with no frontmatter.\n";

    let serialized = serialize_markdown(&metadata, body).unwrap();
    assert_eq!(body, serialized);

    let (parsed_meta, parsed_body) = parse_markdown(&serialized).unwrap();
    assert_eq!(metadata, parsed_meta);
    assert_eq!(body, parsed_body);
}
