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
        use crate::bit_layout_gen::*;
        BitLayout {
            version: BitField {
                offset: VERSION_OFFSET,
                width: VERSION_WIDTH,
            },
            timestamp: BitField {
                offset: TIMESTAMP_OFFSET,
                width: TIMESTAMP_WIDTH,
            },
            chromosome: BitField {
                offset: CHROMOSOME_OFFSET,
                width: CHROMOSOME_WIDTH,
            },
            category: BitField {
                offset: CATEGORY_OFFSET,
                width: CATEGORY_WIDTH,
            },
            firefly: BitField {
                offset: FIREFLY_OFFSET,
                width: FIREFLY_WIDTH,
            },
            authority: BitField {
                offset: AUTHORITY_OFFSET,
                width: AUTHORITY_WIDTH,
            },
            persona: BitField {
                offset: PERSONA_OFFSET,
                width: PERSONA_WIDTH,
            },
            momentum: BitField {
                offset: MOMENTUM_OFFSET,
                width: MOMENTUM_WIDTH,
            },
            location: BitField {
                offset: LOCATION_OFFSET,
                width: LOCATION_WIDTH,
            },
            randomness: BitField {
                offset: RANDOMNESS_OFFSET,
                width: RANDOMNESS_WIDTH,
            },
            total_bits: 128,
        }
    }

    /// Bottom-up construction: allocate fields from the LSB upward. Must produce
    /// the identical layout to [`Self::top_down`] (asserted in tests).
    fn bottom_up() -> Self {
        use crate::bit_layout_gen::*;
        let mut o: u32 = 0;
        let randomness = BitField {
            offset: o,
            width: RANDOMNESS_WIDTH,
        }; // 0..32
        o += RANDOMNESS_WIDTH;
        o += 3; // reserved bits 32..35
        let location = BitField {
            offset: o,
            width: LOCATION_WIDTH,
        }; // 35..43
        o += LOCATION_WIDTH;
        let momentum = BitField {
            offset: o,
            width: MOMENTUM_WIDTH,
        }; // 43..51
        o += MOMENTUM_WIDTH;
        let persona = BitField {
            offset: o,
            width: PERSONA_WIDTH,
        }; // 51..59
        o += PERSONA_WIDTH;
        let authority = BitField {
            offset: o,
            width: AUTHORITY_WIDTH,
        }; // 59..64
        o += AUTHORITY_WIDTH;
        let firefly = BitField {
            offset: o,
            width: FIREFLY_WIDTH,
        }; // 64
        o += FIREFLY_WIDTH;
        let category = BitField {
            offset: o,
            width: CATEGORY_WIDTH,
        }; // 65..69
        o += CATEGORY_WIDTH;
        o += 1; // reserved bit 69
        let chromosome = BitField {
            offset: o,
            width: CHROMOSOME_WIDTH,
        }; // 70..75
        o += CHROMOSOME_WIDTH;
        let timestamp = BitField {
            offset: o,
            width: TIMESTAMP_WIDTH,
        }; // 75..123
        o += TIMESTAMP_WIDTH;
        let version = BitField {
            offset: o,
            width: VERSION_WIDTH,
        }; // 123..128
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
