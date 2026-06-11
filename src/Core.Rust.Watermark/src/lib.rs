//! Watermark — the event-time watermark of Akidau et al. (The Dataflow Model, VLDB 2015), Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/Watermark.fs`) by agreeing on the shared seed
//! (`src/Core.TypeScript/watermark/golden-vectors.json`) that the C#/F#/TS oracles also verify.
//! All `i64` arithmetic — no floats, byte-lockable in the safe-integer range.

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Watermark {
    pub event_time: i64,
    pub source: i32,
}

impl Watermark {
    pub const MIN_VALUE: Self = Self {
        event_time: i64::MIN,
        source: 0,
    };
    pub const MAX_VALUE: Self = Self {
        event_time: i64::MAX,
        source: 0,
    };
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Timestamped<T> {
    pub value: T,
    pub event_time: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WatermarkStrategy {
    Monotonic,
    BoundedLateness { max_lateness_ms: i64 },
    Periodic { interval_ms: i64, lateness_ms: i64 },
}

pub struct WatermarkTracker {
    strategy: WatermarkStrategy,
    max_seen: i64,
    last_emitted: i64,
}

impl WatermarkTracker {
    pub fn new(strategy: WatermarkStrategy) -> Self {
        Self {
            strategy,
            max_seen: i64::MIN,
            last_emitted: i64::MIN,
        }
    }

    fn candidate_for(&self, observed_max: i64) -> i64 {
        match self.strategy {
            WatermarkStrategy::Monotonic => observed_max,
            WatermarkStrategy::BoundedLateness { max_lateness_ms } => {
                if observed_max <= i64::MIN + max_lateness_ms {
                    i64::MIN
                } else {
                    observed_max - max_lateness_ms
                }
            }
            WatermarkStrategy::Periodic { lateness_ms, .. } => {
                if observed_max <= i64::MIN + lateness_ms {
                    i64::MIN
                } else {
                    observed_max - lateness_ms
                }
            }
        }
    }

    pub fn observe(&mut self, event_time: i64) -> i64 {
        if event_time > self.max_seen {
            self.max_seen = event_time;
        }
        let candidate = self.candidate_for(self.max_seen);
        if candidate > self.last_emitted {
            self.last_emitted = candidate;
        }
        self.last_emitted
    }

    pub fn current(&self) -> i64 {
        self.last_emitted
    }

    pub fn max_observed(&self) -> i64 {
        self.max_seen
    }
}

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
        } else if max_seen <= i64::MIN + lateness {
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

