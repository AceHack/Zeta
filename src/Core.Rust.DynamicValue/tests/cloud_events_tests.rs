#![allow(missing_docs)]

use zeta_core_dynamic_value::DynamicValue;
use zeta_core_dynamic_value::cloud_events::{self, CloudEvent};

#[test]
fn test_create_yields_valid_event_and_validate_catches_missing_attribute() {
    let e = cloud_events::create(
        "id-1".to_string(),
        "/zeta/source".to_string(),
        "com.zeta.change".to_string(),
        Some(DynamicValue::Int(7)),
    );
    assert_eq!(e.specversion, "1.0");
    assert!(cloud_events::validate(&e).is_ok());

    let mut missing_id = e;
    missing_id.id = String::new();
    let validation_result = cloud_events::validate(&missing_id);
    assert!(validation_result.is_err());
    let err = validation_result.unwrap_err();
    assert!(err.contains("id"));
}

#[test]
fn test_to_dynamic_of_dynamic_round_trips() {
    let e = CloudEvent {
        id: "id-2".to_string(),
        source: "/s".to_string(),
        specversion: "1.0".to_string(),
        r#type: "t".to_string(),
        time: Some("2026-06-07T00:00:00Z".to_string()),
        subject: None,
        datacontenttype: None,
        dataschema: Some("schema://v2".to_string()),
        extensions: vec![
            ("iodebeziumop".to_string(), "c".to_string()),
            ("traceparent".to_string(), "abc".to_string()),
        ],
        data: Some(DynamicValue::String("payload".to_string())),
    };

    let dynamic_val = cloud_events::to_dynamic(e.clone());
    let parsed_result = cloud_events::of_dynamic(dynamic_val);
    assert!(parsed_result.is_ok());
    assert_eq!(parsed_result.unwrap(), e);
}

#[test]
fn test_of_dynamic_rejects_non_object_and_missing_attributes() {
    assert!(cloud_events::of_dynamic(DynamicValue::Int(1)).is_err());

    let missing_attrs = DynamicValue::Object(vec![(
        "id".to_string(),
        DynamicValue::String("x".to_string()),
    )]);
    assert!(cloud_events::of_dynamic(missing_attrs).is_err());
}

#[test]
fn test_unknown_string_keys_become_extension_attributes() {
    let dv = DynamicValue::Object(vec![
        (
            "specversion".to_string(),
            DynamicValue::String("1.0".to_string()),
        ),
        ("id".to_string(), DynamicValue::String("i".to_string())),
        ("source".to_string(), DynamicValue::String("s".to_string())),
        ("type".to_string(), DynamicValue::String("t".to_string())),
        ("myext".to_string(), DynamicValue::String("v".to_string())),
        ("data".to_string(), DynamicValue::Int(5)),
    ]);

    let parsed_result = cloud_events::of_dynamic(dv);
    assert!(parsed_result.is_ok());
    let ok = parsed_result.unwrap();
    assert_eq!(ok.extensions, vec![("myext".to_string(), "v".to_string())]);
    assert_eq!(ok.data, Some(DynamicValue::Int(5)));
}
