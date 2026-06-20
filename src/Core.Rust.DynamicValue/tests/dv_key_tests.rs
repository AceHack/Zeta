#![allow(missing_docs)]

use zeta_core_dynamic_value::DynamicValue;
use zeta_core_dynamic_value::dv_key::DvKey;

#[test]
fn test_equal_dynamic_value_rows_give_equal_keys() {
    let a = DvKey::of_value(DynamicValue::Object(vec![
        ("id".to_string(), DynamicValue::Int(1)),
        ("name".to_string(), DynamicValue::String("x".to_string())),
    ]))
    .unwrap();

    let a2 = DvKey::of_value(DynamicValue::Object(vec![
        ("id".to_string(), DynamicValue::Int(1)),
        ("name".to_string(), DynamicValue::String("x".to_string())),
    ]))
    .unwrap();

    let b = DvKey::of_value(DynamicValue::Object(vec![
        ("id".to_string(), DynamicValue::Int(2)),
        ("name".to_string(), DynamicValue::String("x".to_string())),
    ]))
    .unwrap();

    assert_eq!(a, a2);

    // Hash equality test:
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h1 = DefaultHasher::new();
    a.hash(&mut h1);
    let mut h2 = DefaultHasher::new();
    a2.hash(&mut h2);
    assert_eq!(h1.finish(), h2.finish());

    assert_ne!(a, b);
}

#[test]
fn test_lexicographical_comparison_compares_canonical_bytes() {
    let a = DvKey::of_value(DynamicValue::Object(vec![(
        "id".to_string(),
        DynamicValue::Int(1),
    )]))
    .unwrap();

    let b = DvKey::of_value(DynamicValue::Object(vec![(
        "id".to_string(),
        DynamicValue::Int(2),
    )]))
    .unwrap();

    assert!(a < b);
    assert!(b > a);
    assert_eq!(a.cmp(&a), std::cmp::Ordering::Equal);
}
