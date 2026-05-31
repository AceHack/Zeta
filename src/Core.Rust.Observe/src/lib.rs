//! observe/simulate/fold event algebra (B-0867.27) — Rust parity oracle (#4 of
//! TS/F#/C#/Rust) for the cross-language compiler-BFT consensus (B-0944, "the
//! compilers don't lie"). The algebra replays the shared golden-vector fixture
//! (tools/observe/golden-vectors.json) and must value-match the TS reference.
//!
//! JSON ingestion is behind the [`json::JsonParser`] trait: the default
//! [`json::ZetaJsonParser`] is a small zero-dependency parser; an optional
//! serde_json-backed [`json::SerdeJsonParser`] (feature `serde`) lets us test ours
//! against serde (differential — "not flying blind") and lets serde drop-in-replace
//! ours in systems already on serde.

pub mod algebra;
pub mod json;
pub mod observe_json;
pub mod types;

pub use algebra::{fold, replay, simulate};
pub use types::{BacklogItem, Mode, NextAction, OperatorChannel, World};
