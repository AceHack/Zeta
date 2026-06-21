//! observe/simulate/fold event algebra (B-0867.27) — Rust parity oracle (#4 of
//! TS/F#/C#/Rust) for the cross-language compiler-BFT consensus (B-0944, "the
//! compilers don't lie"). The algebra replays the shared golden-vector fixture
//! (src/Core.TypeScript/observe/golden-vectors.json) and must value-match the TS reference.
//!
//! JSON ingestion is hexagonal (ports & adapters). The forward-only
//! [`json_reader::JsonReader`] is the streaming PRIMITIVE (Utf8JsonReader model:
//! single-pass, zero-copy, constant memory, depth-capped — safe for untrusted
//! input). It tokenizes without building a DOM, but reads from a COMPLETE in-memory
//! buffer (`&str`); truly-unbounded/socket streaming is deferred to a `BufRead`-refill
//! variant (B-0867.29). The DOM [`json::ZetaJsonParser`] is built on top of it
//! (trusted-input only — whole-tree materialization is a DoS vector). An optional
//! serde_json-backed
//! [`json::SerdeJsonParser`] (feature `serde`) is the ADAPTER: serde conforms to our
//! [`json::JsonParser`] trait, letting us differentially test ours against serde
//! ("not flying blind") and letting serde drop-in-replace ours.

pub mod algebra;
pub mod algebra_interfaces;
pub mod json;
pub mod json_reader;
pub mod observe_json;
pub mod sparse_quantum_sim;
pub mod specialization_cache;
pub mod star_ring;
pub mod types;

pub use algebra::{fold, replay, simulate};
pub use types::{BacklogItem, Mode, NextAction, OperatorChannel, World};
