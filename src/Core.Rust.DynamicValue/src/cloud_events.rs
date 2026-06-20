use crate::DynamicValue;

/// A CloudEvents v1.0 event.
#[derive(Debug, Clone, PartialEq)]
pub struct CloudEvent {
    /// Unique event identifier.
    pub id: String,
    /// Event source URI.
    pub source: String,
    /// Spec version (always "1.0").
    pub specversion: String,
    /// Event type.
    pub r#type: String,
    /// Optional timestamp.
    pub time: Option<String>,
    /// Optional subject.
    pub subject: Option<String>,
    /// Optional data content type.
    pub datacontenttype: Option<String>,
    /// Optional data schema.
    pub dataschema: Option<String>,
    /// Extension attributes.
    pub extensions: Vec<(String, String)>,
    /// Optional data payload.
    pub data: Option<DynamicValue>,
}

fn is_core_key(key: &str) -> bool {
    matches!(
        key,
        "specversion"
            | "id"
            | "source"
            | "type"
            | "time"
            | "subject"
            | "datacontenttype"
            | "dataschema"
            | "data"
    )
}

/// Create a minimal valid event (specversion defaults to "1.0").
pub fn create(
    id: String,
    source: String,
    r#type: String,
    data: Option<DynamicValue>,
) -> CloudEvent {
    CloudEvent {
        id,
        source,
        specversion: "1.0".to_string(),
        r#type,
        time: None,
        subject: None,
        datacontenttype: None,
        dataschema: None,
        extensions: Vec::new(),
        data,
    }
}

/// Validate that required attributes are present and non-empty.
pub fn validate(e: &CloudEvent) -> Result<(), String> {
    let mut missing = Vec::new();
    if e.id.is_empty() {
        missing.push("id");
    }
    if e.source.is_empty() {
        missing.push("source");
    }
    if e.specversion.is_empty() {
        missing.push("specversion");
    }
    if e.r#type.is_empty() {
        missing.push("type");
    }

    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "CloudEvent missing required attribute(s): {}",
            missing.join(", ")
        ))
    }
}

/// Serialize a `CloudEvent` to `DynamicValue::Object`.
pub fn to_dynamic(e: CloudEvent) -> DynamicValue {
    let mut pairs = vec![
        (
            "specversion".to_string(),
            DynamicValue::String(e.specversion),
        ),
        ("id".to_string(), DynamicValue::String(e.id)),
        ("source".to_string(), DynamicValue::String(e.source)),
        ("type".to_string(), DynamicValue::String(e.r#type)),
    ];

    if let Some(time) = e.time {
        pairs.push(("time".to_string(), DynamicValue::String(time)));
    }
    if let Some(subject) = e.subject {
        pairs.push(("subject".to_string(), DynamicValue::String(subject)));
    }
    if let Some(datacontenttype) = e.datacontenttype {
        pairs.push((
            "datacontenttype".to_string(),
            DynamicValue::String(datacontenttype),
        ));
    }
    if let Some(dataschema) = e.dataschema {
        pairs.push(("dataschema".to_string(), DynamicValue::String(dataschema)));
    }

    for (k, v) in e.extensions {
        pairs.push((k, DynamicValue::String(v)));
    }

    if let Some(data) = e.data {
        pairs.push(("data".to_string(), data));
    }

    DynamicValue::Object(pairs)
}

/// Parse a `CloudEvent` from a `DynamicValue::Object`.
pub fn of_dynamic(dv: DynamicValue) -> Result<CloudEvent, String> {
    let pairs = match dv {
        DynamicValue::Object(p) => p,
        _ => return Err("CloudEvent must be a DynamicValue::Object".to_string()),
    };

    let get_str = |key: &str| -> Option<String> {
        pairs
            .iter()
            .find(|(k, _)| k == key)
            .and_then(|(_, v)| match v {
                DynamicValue::String(s) => Some(s.clone()),
                _ => None,
            })
    };

    let id = match get_str("id") {
        Some(id) => id,
        None => {
            return Err(
                "CloudEvent object missing required attribute(s): id / source / type".to_string(),
            );
        }
    };

    let source = match get_str("source") {
        Some(s) => s,
        None => {
            return Err(
                "CloudEvent object missing required attribute(s): id / source / type".to_string(),
            );
        }
    };

    let r#type = match get_str("type") {
        Some(t) => t,
        None => {
            return Err(
                "CloudEvent object missing required attribute(s): id / source / type".to_string(),
            );
        }
    };

    let specversion = get_str("specversion").unwrap_or_else(|| "1.0".to_string());
    let time = get_str("time");
    let subject = get_str("subject");
    let datacontenttype = get_str("datacontenttype");
    let dataschema = get_str("dataschema");

    let extensions = pairs
        .iter()
        .filter(|(k, _)| !is_core_key(k))
        .filter_map(|(k, v)| match v {
            DynamicValue::String(s) => Some((k.clone(), s.clone())),
            _ => None,
        })
        .collect::<Vec<_>>();

    let mut data = None;
    for (k, v) in pairs {
        if k == "data" {
            data = Some(v);
            break;
        }
    }

    Ok(CloudEvent {
        id,
        source,
        specversion,
        r#type,
        time,
        subject,
        datacontenttype,
        dataschema,
        extensions,
        data,
    })
}
