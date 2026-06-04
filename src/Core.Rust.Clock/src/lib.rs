//! Clock -- the Rust oracle (#4 of TS/F#/C#/Rust) of the logical-clock primitive
//! (B-1016 floor #1). Conforms to the F# canonical shape (`src/Core/Clock.fs`) by
//! AGREEING on the shared seed (`src/Core.TypeScript/clock/golden-vectors.json`):
//! a monotonic versionstamp (total order) + an injectable deterministic scheduler.
//! `tick = +1 = one scheduler step = z⁻¹ inverse` (same unit at three layers).
//! `Scheduler::run` is a pure fn of (seed, n) -> DST replay. "The compilers don't lie."

/// A versionstamp: a monotonic logical-clock value. `version` is the int64
/// single-sequencer commit version (total order).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Versionstamp {
    /// The logical-clock value.
    pub version: i64,
}

impl Versionstamp {
    /// The origin of the timeline.
    pub const ZERO: Versionstamp = Versionstamp { version: 0 };

    /// Construct from a raw version.
    #[must_use]
    pub const fn of_int(v: i64) -> Versionstamp {
        Versionstamp { version: v }
    }

    /// Advance one tick -- the forward unit step (inverse of `z⁻¹` delay).
    #[must_use]
    pub const fn tick(self) -> Versionstamp {
        Versionstamp { version: self.version + 1 }
    }

    /// The previous stamp (`z⁻¹` delay): inverse of `tick`. `delay(tick v) = v`.
    #[must_use]
    pub const fn delay(self) -> Versionstamp {
        Versionstamp { version: self.version - 1 }
    }

    /// Strict happens-before (total order, single-writer).
    #[must_use]
    pub const fn is_before(self, other: Versionstamp) -> bool {
        self.version < other.version
    }
}

/// An injectable deterministic scheduler (Rx `IScheduler` shape). Seeded -> replays
/// identically (DST).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Scheduler {
    /// The current logical time.
    pub now: Versionstamp,
}

impl Scheduler {
    /// Construct a scheduler at a seed version.
    #[must_use]
    pub const fn from_seed(seed: i64) -> Scheduler {
        Scheduler { now: Versionstamp::of_int(seed) }
    }

    /// Advance the scheduler by one tick.
    #[must_use]
    pub const fn step(self) -> Scheduler {
        Scheduler { now: self.now.tick() }
    }
}

/// The deterministic timeline: the stamps produced by `n` steps from the seed.
#[must_use]
pub fn run(seed: i64, n: usize) -> Vec<i64> {
    let mut out = Vec::with_capacity(n);
    let mut s = Scheduler::from_seed(seed);
    for _ in 0..n {
        s = s.step();
        out.push(s.now.version);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tick_is_unit_step_and_delay_inverts() {
        let a = Versionstamp::of_int(41);
        assert_eq!(a.tick(), Versionstamp::of_int(42));
        assert_eq!(a.tick().delay(), a);
        assert_eq!(Scheduler::from_seed(100).step().now.version, 101);
    }

    #[test]
    fn run_is_strictly_increasing() {
        let stamps = run(5, 8);
        for w in stamps.windows(2) {
            assert!(w[0] < w[1]);
        }
    }
}
