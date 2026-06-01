//! Layer 2: the DOM fold ([`YamlValue`] + [`parse`]), built ON TOP of the L1 event
//! stream.
//!
//! This is the `JsonDocument` half of the `Utf8JsonReader`-vs-`JsonDocument` split:
//! [`crate::reader`] scans once and emits events; this module folds that flat event
//! stream into a value tree. It does NOT re-scan text -- it consumes [`crate::reader::read_events`]
//! output. Faithful port of the TS reference `src/Core.TypeScript/yaml/dom.ts`.

use crate::reader::{read_events, ScalarKind, YamlEvent, YamlFeedback};

/// The folded value tree. `Map` preserves insertion order (a list of pairs, not a hash
/// map), mirroring the cross-language contract.
#[derive(Debug, Clone, PartialEq)]
pub enum YamlValue {
    /// `null` / `~` / empty.
    Null,
    /// A boolean.
    Bool(bool),
    /// A 64-bit signed integer (parsed from `raw`).
    Int(i64),
    /// A 64-bit float (parsed from `raw`).
    Float(f64),
    /// A string (the decoded `raw`).
    Str(String),
    /// An ordered sequence.
    Seq(Vec<YamlValue>),
    /// An ordered mapping (insertion order preserved).
    Map(Vec<(String, YamlValue)>),
}

fn scalar_to_value(raw: &str, kind: ScalarKind) -> Result<YamlValue, YamlFeedback> {
    match kind {
        ScalarKind::Null => Ok(YamlValue::Null),
        ScalarKind::Bool => Ok(YamlValue::Bool(matches!(raw, "true" | "True" | "TRUE"))),
        ScalarKind::Int => raw
            .parse::<i64>()
            .map(YamlValue::Int)
            .map_err(|_| YamlFeedback::UnexpectedCharacter),
        ScalarKind::Float => raw
            .parse::<f64>()
            .map(YamlValue::Float)
            .map_err(|_| YamlFeedback::UnexpectedCharacter),
        ScalarKind::Str => Ok(YamlValue::Str(raw.to_string())),
    }
}

/// Cursor-based fold over the flat event slice.
struct Folder<'a> {
    events: &'a [YamlEvent],
    pos: usize,
}

impl<'a> Folder<'a> {
    fn new(events: &'a [YamlEvent]) -> Self {
        Folder { events, pos: 0 }
    }

    fn peek(&self) -> Result<&'a YamlEvent, YamlFeedback> {
        self.events
            .get(self.pos)
            .ok_or(YamlFeedback::UnsupportedConstruct)
    }

    fn next(&mut self) -> Result<&'a YamlEvent, YamlFeedback> {
        let ev = self.peek()?;
        self.pos += 1;
        Ok(ev)
    }

    fn expect(&mut self, want: &YamlEvent) -> Result<(), YamlFeedback> {
        let ev = self.next()?;
        if ev == want {
            Ok(())
        } else {
            Err(YamlFeedback::UnsupportedConstruct)
        }
    }

    // top-level: StreamStart <value> StreamEnd
    fn fold(&mut self) -> Result<YamlValue, YamlFeedback> {
        self.expect(&YamlEvent::StreamStart)?;
        let value = self.fold_value()?;
        self.expect(&YamlEvent::StreamEnd)?;
        Ok(value)
    }

    fn fold_value(&mut self) -> Result<YamlValue, YamlFeedback> {
        match self.peek()? {
            YamlEvent::Scalar { raw, kind, .. } => {
                let (raw, kind) = (raw.clone(), *kind);
                self.pos += 1;
                scalar_to_value(&raw, kind)
            }
            YamlEvent::MappingStart => self.fold_mapping(),
            YamlEvent::SequenceStart => self.fold_sequence(),
            _ => Err(YamlFeedback::UnsupportedConstruct),
        }
    }

    fn fold_mapping(&mut self) -> Result<YamlValue, YamlFeedback> {
        self.expect(&YamlEvent::MappingStart)?;
        let mut entries: Vec<(String, YamlValue)> = Vec::new();
        while *self.peek()? != YamlEvent::MappingEnd {
            let key = match self.next()? {
                YamlEvent::Scalar { raw, .. } => raw.clone(),
                _ => return Err(YamlFeedback::UnsupportedConstruct),
            };
            let value = self.fold_value()?;
            entries.push((key, value));
        }
        self.expect(&YamlEvent::MappingEnd)?;
        Ok(YamlValue::Map(entries))
    }

    fn fold_sequence(&mut self) -> Result<YamlValue, YamlFeedback> {
        self.expect(&YamlEvent::SequenceStart)?;
        let mut items: Vec<YamlValue> = Vec::new();
        while *self.peek()? != YamlEvent::SequenceEnd {
            items.push(self.fold_value()?);
        }
        self.expect(&YamlEvent::SequenceEnd)?;
        Ok(YamlValue::Seq(items))
    }
}

/// Parse `text` into a [`YamlValue`] tree, or decline via [`YamlFeedback`].
pub fn parse(text: &str) -> Result<YamlValue, YamlFeedback> {
    let events = read_events(text)?;
    Folder::new(&events).fold()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn map(entries: Vec<(&str, YamlValue)>) -> YamlValue {
        YamlValue::Map(entries.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
    }

    #[test]
    fn dom_flat_scalars() {
        let v = parse("name: zeta\ncount: 42\nratio: 3.14\nok: true\ngone: null\n").unwrap();
        assert_eq!(
            v,
            map(vec![
                ("name", YamlValue::Str("zeta".to_string())),
                ("count", YamlValue::Int(42)),
                ("ratio", YamlValue::Float(3.14)),
                ("ok", YamlValue::Bool(true)),
                ("gone", YamlValue::Null),
            ])
        );
    }

    #[test]
    fn dom_nested_map() {
        let v = parse("outer:\n  inner: 1\n").unwrap();
        assert_eq!(
            v,
            map(vec![("outer", map(vec![("inner", YamlValue::Int(1))]))])
        );
    }

    #[test]
    fn dom_sequence() {
        let v = parse("- a\n- b\n").unwrap();
        assert_eq!(
            v,
            YamlValue::Seq(vec![
                YamlValue::Str("a".to_string()),
                YamlValue::Str("b".to_string()),
            ])
        );
    }

    #[test]
    fn dom_sequence_of_maps() {
        let v = parse("items:\n  - id: x\n    n: 1\n  - id: y\n    n: 2\n").unwrap();
        assert_eq!(
            v,
            map(vec![(
                "items",
                YamlValue::Seq(vec![
                    map(vec![
                        ("id", YamlValue::Str("x".to_string())),
                        ("n", YamlValue::Int(1)),
                    ]),
                    map(vec![
                        ("id", YamlValue::Str("y".to_string())),
                        ("n", YamlValue::Int(2)),
                    ]),
                ])
            )])
        );
    }

    #[test]
    fn dom_map_order_preserved() {
        // Insertion order, not sorted: b before a.
        let v = parse("b: 1\na: 2\n").unwrap();
        match v {
            YamlValue::Map(entries) => {
                assert_eq!(entries[0].0, "b");
                assert_eq!(entries[1].0, "a");
            }
            other => panic!("expected Map, got {other:?}"),
        }
    }

    #[test]
    fn dom_propagates_decline() {
        assert_eq!(parse("\tx: 1\n"), Err(YamlFeedback::TabIndentation));
    }
}
