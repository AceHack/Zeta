//! Watermark — the event-time watermark of Akidau et al. (The Dataflow Model, VLDB 2015), Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/Watermark.fs`) by agreeing on the shared seed
//! (`src/Core.TypeScript/watermark/golden-vectors.json`) that the C#/F#/TS oracles also verify.
//! All `i64` arithmetic — no floats, byte-lockable in the safe-integer range.

/// The `WatermarkTracker` fold: the emitted watermark after each observed event time.
/// `max_seen` = running max; candidate = `max_seen` (monotonic) or `max_seen - lateness` (bounded;
/// the Periodic formula too); clamped monotone non-decreasing.
pub fn observe(strategy: &str, lateness: i64, events: &[i64]) -> Vec<i64> {
    let mut max_seen = i64::MIN;
    let mut last_emitted = i64::MIN;
    let mut out = Vec::with_capacity(events.len());
    for &e in events {
        if e > max_seen {
            max_seen = e;
        }
        let candidate = if strategy == "monotonic" {
            max_seen
        } else if max_seen == i64::MIN {
            i64::MIN
        } else {
            max_seen - lateness
        };
        if candidate > last_emitted {
            last_emitted = candidate;
        }
        out.push(last_emitted);
    }
    out
}

/// Is `event_time` late according to the current watermark?
pub fn is_late(wm: i64, event_time: i64) -> bool {
    event_time <= wm
}

/// Combine per-source watermarks downstream: min (can't progress past the slowest input).
pub fn combine(sources: &[i64]) -> i64 {
    let mut min = i64::MAX;
    let mut any = false;
    for &s in sources {
        any = true;
        if s < min {
            min = s;
        }
    }
    if any {
        min
    } else {
        i64::MIN
    }
}
