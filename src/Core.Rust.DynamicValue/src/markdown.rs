use crate::{DynamicValue, EncodeError};

/// Parse a Markdown string into metadata (DynamicValue::Object) and the remaining body string.
/// Asserts strict canonical check on the frontmatter YAML.
pub fn parse_markdown(text: &str) -> Result<(DynamicValue, String), String> {
    if text.starts_with("---") && (text.len() == 3 || text.as_bytes()[3] == b'\n' || (text.as_bytes()[3] == b'\r' && text.len() > 4 && text.as_bytes()[4] == b'\n')) {
        let header_len = if text.as_bytes()[3] == b'\r' { 5 } else { 4 };

        let mut index = header_len;
        let mut close_start = None;
        let mut newline_len = 0;
        let mut close_end = 0;

        let bytes = text.as_bytes();
        while index < bytes.len() {
            let mut is_newline = false;
            let mut cur_newline_len = 0;
            let mut next_idx = index;

            if bytes[index] == b'\n' {
                is_newline = true;
                cur_newline_len = 1;
                next_idx = index + 1;
            } else if bytes[index] == b'\r' && index + 1 < bytes.len() && bytes[index + 1] == b'\n' {
                is_newline = true;
                cur_newline_len = 2;
                next_idx = index + 2;
            }

            if is_newline {
                if next_idx + 3 <= bytes.len() && &bytes[next_idx..next_idx + 3] == b"---" {
                    let tail_idx = next_idx + 3;
                    if tail_idx == bytes.len() {
                        close_start = Some(index);
                        newline_len = cur_newline_len;
                        close_end = tail_idx;
                        break;
                    } else if bytes[tail_idx] == b'\n' {
                        close_start = Some(index);
                        newline_len = cur_newline_len;
                        close_end = tail_idx + 1;
                        break;
                    } else if bytes[tail_idx] == b'\r' && tail_idx + 1 < bytes.len() && bytes[tail_idx + 1] == b'\n' {
                        close_start = Some(index);
                        newline_len = cur_newline_len;
                        close_end = tail_idx + 2;
                        break;
                    }
                }
                index = next_idx;
            } else {
                index += 1;
            }
        }

        let close_start = match close_start {
            Some(idx) => idx,
            None => return Err("Unclosed frontmatter delimiter".to_string()),
        };

        let yaml_part = &text[header_len..close_start + newline_len];
        let body_part = &text[close_end..];

        let decoded = DynamicValue::from_canonical_yaml(yaml_part)
            .map_err(|e| format!("Failed to parse frontmatter YAML: {e:?}"))?;

        match decoded {
            DynamicValue::Object(pairs) => Ok((DynamicValue::Object(pairs), body_part.to_string())),
            _ => Err("Frontmatter must be a YAML map (Object)".to_string()),
        }
    } else {
        Ok((DynamicValue::Object(Vec::new()), text.to_string()))
    }
}

/// Serialize metadata (DynamicValue::Object) and a body string into a Markdown string with frontmatter.
/// If metadata is empty (Object(vec![])), frontmatter section is omitted entirely.
pub fn serialize_markdown(metadata: &DynamicValue, body: &str) -> Result<String, EncodeError> {
    match metadata {
        DynamicValue::Object(pairs) => {
            if pairs.is_empty() {
                Ok(body.to_string())
            } else {
                let yaml = metadata.to_canonical_yaml()?;
                Ok(format!("---\n{yaml}---\n{body}"))
            }
        }
        _ => Err(EncodeError::NotXmlRepresentable),
    }
}
