//! ByteCost -- the Rust oracle (#4 of TS/F#/C#/Rust) for the context-window
//! minimization meter (B-1016 slice 1). Conforms to the F# canonical shape
//! (`src/Core/ByteCost.fs`) by AGREEING on the shared seed
//! (`src/Core.TypeScript/byte-cost/golden-vectors.json`) -- seed-first: the seed
//! is the canonical DATA; this crate grows code that agrees on it.
//!
//! `measure_text(text)` = the UTF-8 byte length of the surface. Bytes, not model
//! tokens: bytes are deterministic and byte-lockable across oracles; tokenizers
//! vary by version and cannot enter the proof lineage. `(ByteCost, add, ZERO)` is
//! a commutative monoid, so a fileset's total cost is the order-independent sum of
//! per-file costs. The meter only measures (NCI-safe). The `tests/golden_vectors.rs`
//! oracle replays the shared seed and must match every vector's byte count.
//! "The compilers don't lie."

/// The byte-cost of a context-startup surface (UTF-8 byte count).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct ByteCost {
    /// The number of UTF-8 bytes.
    pub bytes: u64,
}

impl ByteCost {
    /// Additive identity -- the empty surface costs nothing.
    pub const ZERO: ByteCost = ByteCost { bytes: 0 };

    /// Construct from a raw byte count.
    #[must_use]
    pub const fn of_bytes(n: u64) -> ByteCost {
        ByteCost { bytes: n }
    }

    /// Monoid combine -- addition of byte counts.
    #[must_use]
    pub const fn add(self, other: ByteCost) -> ByteCost {
        ByteCost {
            bytes: self.bytes + other.bytes,
        }
    }
}

/// Measure a surface from its text: UTF-8 byte length (the canonical encoding).
#[must_use]
pub fn measure_text(text: &str) -> ByteCost {
    ByteCost {
        bytes: text.len() as u64,
    }
}

/// Order-independent total of a fileset's costs (monoid fold over [`ByteCost::add`]).
#[must_use]
pub fn sum(costs: &[ByteCost]) -> ByteCost {
    costs.iter().fold(ByteCost::ZERO, |acc, c| acc.add(*c))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_is_zero_and_identity() {
        assert_eq!(measure_text(""), ByteCost::ZERO);
        let a = ByteCost::of_bytes(7);
        assert_eq!(a.add(ByteCost::ZERO), a);
        assert_eq!(ByteCost::ZERO.add(a), a);
    }

    #[test]
    fn sum_is_order_independent() {
        let costs = [ByteCost::of_bytes(3), ByteCost::of_bytes(5), ByteCost::of_bytes(9)];
        let mut rev = costs;
        rev.reverse();
        assert_eq!(sum(&costs), sum(&rev));
    }
}
