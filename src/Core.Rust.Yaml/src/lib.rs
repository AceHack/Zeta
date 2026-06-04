//! YAML config-subset port -- the Rust parity oracle (#4 of TS/F#/C#/Rust).
//!
//! Per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`, no single
//! language is the source of truth -- multi-oracle byte-for-byte agreement on the
//! shared golden vectors (`tests/cross-verification/yaml/vectors.json`) **is** the
//! verification. The TS oracle (#1) is the reference this crate conforms to; see
//! `tests/cross_verify.rs`.
//!
//! Two layers, mirroring the `Utf8JsonReader`-vs-`JsonDocument` split:
//!
//! - **L1 [`reader`]** -- a forward-only one-pass `read_events` that scans the text
//!   ONCE with an indent/context stack and emits a flat [`reader::YamlEvent`] stream.
//!   It NEVER builds a tree. Out-of-subset constructs decline cleanly via the typed
//!   [`reader::YamlFeedback`] channel (Result over throw) so a caller can fall back to
//!   a vendor adapter.
//! - **L2 [`dom`]** -- a separate fold ([`dom::YamlValue`] + [`dom::parse`]) built ON
//!   TOP of the event stream. It does NOT re-scan text; it consumes `read_events`
//!   output.
//!
//! Subset only (config-friendly YAML). The LOCKED cross-language contracts live in
//! `docs/agendas/ace-package-manager/2026-06-01-yaml-port-implementation-plan.md`.

#![forbid(unsafe_code)]

pub mod dom;
pub mod reader;

pub mod encoder;
pub use dom::{parse, YamlValue};
pub use encoder::encode;
pub use reader::{read_events, ScalarKind, ScalarStyle, YamlEvent, YamlFeedback};
