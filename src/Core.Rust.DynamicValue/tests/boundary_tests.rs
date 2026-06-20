//! Depth limit boundary tests for canonical DynamicValue codecs.

use zeta_core_dynamic_value::{DecodeError, DynamicValue, EncodeError};

fn make_nested_array(depth: usize) -> DynamicValue {
    let mut val = DynamicValue::Null;
    for _ in 0..depth {
        val = DynamicValue::Array(vec![val]);
    }
    val
}

fn make_nested_object(depth: usize) -> DynamicValue {
    let mut val = DynamicValue::Null;
    for _ in 0..depth {
        val = DynamicValue::Object(vec![("k".to_string(), val)]);
    }
    val
}

#[test]
fn depth_limit_boundary_array_nesting_depth_256_accepted() {
    let v = make_nested_array(256);

    // JSON
    let enc_json = v.to_canonical_json().expect("json encode failed");
    let dec_json = DynamicValue::from_canonical_json(&enc_json).expect("json decode failed");
    assert_eq!(dec_json, v);

    // CBOR
    let enc_cbor = v.to_canonical_cbor().expect("cbor encode failed");
    let dec_cbor = DynamicValue::from_canonical_cbor(&enc_cbor).expect("cbor decode failed");
    assert_eq!(dec_cbor, v);

    // XML
    let enc_xml = v.to_canonical_xml().expect("xml encode failed");
    let dec_xml = DynamicValue::from_canonical_xml(&enc_xml).expect("xml decode failed");
    assert_eq!(dec_xml, v);

    // YAML
    let enc_yaml = v.to_canonical_yaml().expect("yaml encode failed");
    let dec_yaml = DynamicValue::from_canonical_yaml(&enc_yaml).expect("yaml decode failed");
    assert_eq!(dec_yaml, v);
}

#[test]
fn depth_limit_boundary_array_nesting_depth_257_rejected() {
    let v = make_nested_array(257);

    // JSON
    assert_eq!(v.to_canonical_json(), Err(EncodeError::NestingTooDeep));

    // CBOR
    assert_eq!(v.to_canonical_cbor(), Err(EncodeError::NestingTooDeep));

    // XML
    assert_eq!(v.to_canonical_xml(), Err(EncodeError::NestingTooDeep));

    // YAML
    assert_eq!(v.to_canonical_yaml(), Err(EncodeError::NestingTooDeep));
}

#[test]
fn depth_limit_boundary_object_nesting_depth_256_accepted() {
    let v = make_nested_object(256);

    // JSON
    let enc_json = v.to_canonical_json().expect("json encode failed");
    let dec_json = DynamicValue::from_canonical_json(&enc_json).expect("json decode failed");
    assert_eq!(dec_json, v);

    // CBOR
    let enc_cbor = v.to_canonical_cbor().expect("cbor encode failed");
    let dec_cbor = DynamicValue::from_canonical_cbor(&enc_cbor).expect("cbor decode failed");
    assert_eq!(dec_cbor, v);

    // XML
    let enc_xml = v.to_canonical_xml().expect("xml encode failed");
    let dec_xml = DynamicValue::from_canonical_xml(&enc_xml).expect("xml decode failed");
    assert_eq!(dec_xml, v);

    // YAML
    let enc_yaml = v.to_canonical_yaml().expect("yaml encode failed");
    let dec_yaml = DynamicValue::from_canonical_yaml(&enc_yaml).expect("yaml decode failed");
    assert_eq!(dec_yaml, v);
}

#[test]
fn depth_limit_boundary_object_nesting_depth_257_rejected() {
    let v = make_nested_object(257);

    // JSON
    assert_eq!(v.to_canonical_json(), Err(EncodeError::NestingTooDeep));

    // CBOR
    assert_eq!(v.to_canonical_cbor(), Err(EncodeError::NestingTooDeep));

    // XML
    assert_eq!(v.to_canonical_xml(), Err(EncodeError::NestingTooDeep));

    // YAML
    assert_eq!(v.to_canonical_yaml(), Err(EncodeError::NestingTooDeep));
}

#[test]
fn depth_limit_boundary_decoder_rejects_nested_structures() {
    // JSON
    let json257 = "[".repeat(257) + "null" + &"]".repeat(257);
    assert_eq!(
        DynamicValue::from_canonical_json(&json257),
        Err(DecodeError::NestingTooDeep)
    );

    // XML
    let xml257 = "<arr>".repeat(257) + "<null/>" + &"</arr>".repeat(257);
    assert_eq!(
        DynamicValue::from_canonical_xml(&xml257),
        Err(DecodeError::NestingTooDeep)
    );
}
