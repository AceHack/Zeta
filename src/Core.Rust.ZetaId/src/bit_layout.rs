//! ZetaId V1 bit layout — mirrors `src/Core.FSharp.ZetaId/BitLayout.fs`,
//! `src/Core.CSharp.ZetaId/`, and `src/Core.TypeScript/zeta-id/`. 128 bits total,
//! with reserved bits at offset 69 (1 bit, between Chromosome and Category) and
//! offsets 32–34 (3 bits, between Location and Randomness):
//!
//! `5 + 48 + 5 + 1(rsv) + 4 + 1 + 5 + 8 + 8 + 8 + 3(rsv) + 32 = 128`.
//!
//! Offsets are LSB-0. Read a field with `(value >> offset) & ((1 << width) - 1)`.

/// A single bit field: LSB-0 `offset` of its least-significant bit + `width` in bits.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BitField {
    /// LSB-0 position of the field's least-significant bit.
    pub offset: u32,
    /// Number of bits the field occupies.
    pub width: u32,
}

/// The full 128-bit ZetaId field layout (offsets + widths for every field).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BitLayout {
    /// Version — 5 bits (MSB-most). V1 = 1.
    pub version: BitField,
    /// Timestamp — 48 bits, milliseconds since epoch.
    pub timestamp: BitField,
    /// Chromosome — 5 bits, observation lineage marker.
    pub chromosome: BitField,
    /// Category — 4 bits (Observation/Emission/.../Bus=6/...).
    pub category: BitField,
    /// Firefly — 1 bit.
    pub firefly: BitField,
    /// Authority — 5 bits.
    pub authority: BitField,
    /// Persona — 8 bits.
    pub persona: BitField,
    /// Momentum — 8 bits.
    pub momentum: BitField,
    /// Location — 8 bits.
    pub location: BitField,
    /// Randomness — 32 bits (LSB-most).
    pub randomness: BitField,
    /// Total bit count (always 128).
    pub total_bits: u32,
}

/// Layout authoring direction. Both produce byte-identical offsets — keeping both
/// is the V8-cycle empirical discipline: two independent computations of the same
/// layout that must agree, surfacing drift a single visual review missed twice.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutDirection {
    /// Allocate from the MSB (offset 128) downward — the canonical authoring order.
    TopDown,
    /// Allocate from the LSB (offset 0) upward — the cross-check.
    BottomUp,
}

impl BitLayout {
    /// Build the layout for the given direction.
    #[must_use]
    pub fn create(direction: LayoutDirection) -> Self {
        match direction {
            LayoutDirection::TopDown => Self::top_down(),
            LayoutDirection::BottomUp => Self::bottom_up(),
        }
    }

    /// Top-down construction: allocate fields from the MSB downward, with the
    /// reserved-bit gaps preserved per `docs/zeta-id-v1-layout.yaml`.
    fn top_down() -> Self {
        // Mutable cursor descending from 128; `o -= width` then record at `o`.
        let mut o: u32 = 128;
        o -= 5;
        let version = BitField { offset: o, width: 5 }; // 123..128
        o -= 48;
        let timestamp = BitField { offset: o, width: 48 }; // 75..123
        o -= 5;
        let chromosome = BitField { offset: o, width: 5 }; // 70..75
        o -= 1; // reserved bit 69
        o -= 4;
        let category = BitField { offset: o, width: 4 }; // 65..69
        o -= 1;
        let firefly = BitField { offset: o, width: 1 }; // 64
        o -= 5;
        let authority = BitField { offset: o, width: 5 }; // 59..64
        o -= 8;
        let persona = BitField { offset: o, width: 8 }; // 51..59
        o -= 8;
        let momentum = BitField { offset: o, width: 8 }; // 43..51
        o -= 8;
        let location = BitField { offset: o, width: 8 }; // 35..43
        // bits 32..35 reserved; randomness occupies 0..32
        BitLayout {
            version,
            timestamp,
            chromosome,
            category,
            firefly,
            authority,
            persona,
            momentum,
            location,
            randomness: BitField { offset: 0, width: 32 },
            total_bits: 128,
        }
    }

    /// Bottom-up construction: allocate fields from the LSB upward. Must produce
    /// the identical layout to [`Self::top_down`] (asserted in tests).
    fn bottom_up() -> Self {
        let mut o: u32 = 0;
        let randomness = BitField { offset: o, width: 32 }; // 0..32
        o += 32;
        o += 3; // reserved bits 32..35
        let location = BitField { offset: o, width: 8 }; // 35..43
        o += 8;
        let momentum = BitField { offset: o, width: 8 }; // 43..51
        o += 8;
        let persona = BitField { offset: o, width: 8 }; // 51..59
        o += 8;
        let authority = BitField { offset: o, width: 5 }; // 59..64
        o += 5;
        let firefly = BitField { offset: o, width: 1 }; // 64
        o += 1;
        let category = BitField { offset: o, width: 4 }; // 65..69
        o += 4;
        o += 1; // reserved bit 69
        let chromosome = BitField { offset: o, width: 5 }; // 70..75
        o += 5;
        let timestamp = BitField { offset: o, width: 48 }; // 75..123
        o += 48;
        let version = BitField { offset: o, width: 5 }; // 123..128
        BitLayout {
            version,
            timestamp,
            chromosome,
            category,
            firefly,
            authority,
            persona,
            momentum,
            location,
            randomness,
            total_bits: 128,
        }
    }
}

impl Default for BitLayout {
    /// The canonical layout is [`LayoutDirection::TopDown`].
    fn default() -> Self {
        Self::top_down()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn top_down_and_bottom_up_agree() {
        // The V8-cycle cross-check: independent computation paths must match.
        assert_eq!(BitLayout::top_down(), BitLayout::bottom_up());
    }

    #[test]
    fn widths_sum_to_128_including_reserved() {
        let l = BitLayout::default();
        let used = l.version.width
            + l.timestamp.width
            + l.chromosome.width
            + l.category.width
            + l.firefly.width
            + l.authority.width
            + l.persona.width
            + l.momentum.width
            + l.location.width
            + l.randomness.width;
        // 4 reserved bits (1 at offset 69 + 3 at offsets 32..34) are unallocated.
        assert_eq!(used + 4, 128);
        assert_eq!(l.total_bits, 128);
    }

    #[test]
    fn known_offsets() {
        let l = BitLayout::default();
        assert_eq!((l.version.offset, l.version.width), (123, 5));
        assert_eq!((l.timestamp.offset, l.timestamp.width), (75, 48));
        assert_eq!((l.chromosome.offset, l.chromosome.width), (70, 5));
        assert_eq!((l.category.offset, l.category.width), (65, 4));
        assert_eq!((l.firefly.offset, l.firefly.width), (64, 1));
        assert_eq!((l.authority.offset, l.authority.width), (59, 5));
        assert_eq!((l.persona.offset, l.persona.width), (51, 8));
        assert_eq!((l.momentum.offset, l.momentum.width), (43, 8));
        assert_eq!((l.location.offset, l.location.width), (35, 8));
        assert_eq!((l.randomness.offset, l.randomness.width), (0, 32));
    }
}
