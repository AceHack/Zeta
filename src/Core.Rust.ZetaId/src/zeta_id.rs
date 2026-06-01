//! ZetaId codec — `pack`/`unpack` between [`ZetaObservation`] and a 128-bit id, plus
//! [`to_hex`] (canonical big-endian 32-char lowercase hex). Mirrors
//! `src/Core.FSharp.ZetaId/Codec.fs`, `src/Core.CSharp.ZetaId/`, and
//! `src/Core.TypeScript/zeta-id/zeta-id.ts`. The hex output must agree byte-for-byte
//! with the other three oracles on the shared golden vectors.

use core::fmt;

use crate::bit_layout::{BitField, BitLayout};
use crate::{
    is_named_authority_byte, is_named_momentum_byte, Authority, Momentum, SimulationEnvironment,
    ZetaObservation, MAX_AUTHORITY,
};

/// Maximum timestamp value for the 48-bit field: `2^48 - 1`.
pub const MAX_TIMESTAMP: u64 = (1u64 << 48) - 1;

/// Why a [`pack`] was rejected. Out-of-range / aliasing values are refused rather
/// than silently truncating (which would collide). Mirrors the F#/C# `throw`
/// contract as data (Result-over-exception doctrine).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackError {
    /// Timestamp exceeds the 48-bit field (`> 2^48 - 1`).
    TimestampOutOfRange(u64),
    /// An open-vocabulary enum field exceeds its bit width.
    EnumFieldOutOfRange {
        /// The field name (e.g. `"category"`).
        field: &'static str,
        /// The offending value.
        value: u8,
        /// The maximum valid value for the field width.
        max: u8,
    },
    /// `Authority::Raw(v)` with `v` exceeding the 5-bit field.
    AuthorityRawOutOfRange(u8),
    /// `Authority::Raw(v)` aliasing a named case (round-trip-unstable).
    AuthorityRawAliasesNamed(u8),
    /// `Momentum::Raw(v)` aliasing a named case (round-trip-unstable).
    MomentumRawAliasesNamed(u8),
}

impl fmt::Display for PackError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PackError::TimestampOutOfRange(v) => write!(
                f,
                "timestamp {v} exceeds the 48-bit field (0..={MAX_TIMESTAMP}); would truncate and collide"
            ),
            PackError::EnumFieldOutOfRange { field, value, max } => write!(
                f,
                "{field} = {value} exceeds its field (0..={max}); would truncate and collide"
            ),
            PackError::AuthorityRawOutOfRange(v) => write!(
                f,
                "Authority::Raw({v}) exceeds the 5-bit Authority field (0..={MAX_AUTHORITY})"
            ),
            PackError::AuthorityRawAliasesNamed(v) => write!(
                f,
                "Authority::Raw({v}) aliases a named case (round-trip-unstable); use the named case"
            ),
            PackError::MomentumRawAliasesNamed(v) => write!(
                f,
                "Momentum::Raw({v}) aliases a named case (round-trip-unstable); use the named case"
            ),
        }
    }
}

impl std::error::Error for PackError {}

/// Set `field`'s bits in `id` to the low `width` bits of `value`.
fn set_bits(id: u128, field: BitField, value: u64) -> u128 {
    let mask: u128 = (1u128 << field.width) - 1;
    id | (((value as u128) & mask) << field.offset)
}

/// Read `field`'s bits out of `id`.
fn get_bits(id: u128, field: BitField) -> u64 {
    let mask: u128 = (1u128 << field.width) - 1;
    ((id >> field.offset) & mask) as u64
}

/// Validate an open-vocabulary enum field fits its bit width.
fn validate_enum_field(value: u8, width_bits: u32, field: &'static str) -> Result<(), PackError> {
    let max = ((1u32 << width_bits) - 1) as u8;
    if value > max {
        return Err(PackError::EnumFieldOutOfRange { field, value, max });
    }
    Ok(())
}

/// Pack a [`ZetaObservation`] into a 128-bit ZetaId. Validates the timestamp,
/// enum bit-widths, and `Authority`/`Momentum` `Raw` bounds + named-collision
/// before bit-packing; out-of-range / aliasing values are rejected, never
/// silently truncated. The 32-bit randomness field is drawn from `env` (no
/// silent-zero fallback — `env` is required).
///
/// # Errors
/// See [`PackError`].
pub fn pack(obs: &ZetaObservation, env: &dyn SimulationEnvironment) -> Result<u128, PackError> {
    if obs.timestamp > MAX_TIMESTAMP {
        return Err(PackError::TimestampOutOfRange(obs.timestamp));
    }
    validate_enum_field(obs.version, 5, "version")?;
    validate_enum_field(obs.chromosome, 5, "chromosome")?;
    validate_enum_field(obs.category, 4, "category")?;
    validate_enum_field(obs.firefly, 1, "firefly")?;
    // persona + location are full 8-bit fields — every u8 is valid; no check needed.

    // Re-validate Raw cases at pack time (the enum variants are public; a caller can
    // build `Authority::Raw(31)` directly, bypassing the smart constructor).
    if let Authority::Raw(v) = obs.authority {
        if v > MAX_AUTHORITY {
            return Err(PackError::AuthorityRawOutOfRange(v));
        }
        if is_named_authority_byte(v) {
            return Err(PackError::AuthorityRawAliasesNamed(v));
        }
    }
    if let Momentum::Raw(v) = obs.momentum {
        if is_named_momentum_byte(v) {
            return Err(PackError::MomentumRawAliasesNamed(v));
        }
    }

    let layout = BitLayout::default();
    let mut id: u128 = 0;
    id = set_bits(id, layout.version, u64::from(obs.version));
    id = set_bits(id, layout.timestamp, obs.timestamp);
    id = set_bits(id, layout.chromosome, u64::from(obs.chromosome));
    id = set_bits(id, layout.category, u64::from(obs.category));
    id = set_bits(id, layout.firefly, u64::from(obs.firefly));
    id = set_bits(id, layout.authority, u64::from(obs.authority.to_byte()));
    id = set_bits(id, layout.persona, u64::from(obs.persona));
    id = set_bits(id, layout.momentum, u64::from(obs.momentum.to_byte()));
    id = set_bits(id, layout.location, u64::from(obs.location));

    // Mirror F#: `(uint64 (env.NextInt64())) &&& 0xFFFFFFFF`.
    let rand32 = (env.next_i64() as u64) & 0xFFFF_FFFF;
    id = set_bits(id, layout.randomness, rand32);

    Ok(id)
}

/// Unpack a 128-bit ZetaId into a [`ZetaObservation`]. Inverse of [`pack`] (the
/// randomness field is dropped — it is not part of the structured observation).
#[must_use]
pub fn unpack(id: u128) -> ZetaObservation {
    let l = BitLayout::default();
    ZetaObservation {
        version: get_bits(id, l.version) as u8,
        timestamp: get_bits(id, l.timestamp),
        chromosome: get_bits(id, l.chromosome) as u8,
        category: get_bits(id, l.category) as u8,
        firefly: get_bits(id, l.firefly) as u8,
        authority: Authority::from_byte(get_bits(id, l.authority) as u8),
        persona: get_bits(id, l.persona) as u8,
        momentum: Momentum::from_byte(get_bits(id, l.momentum) as u8),
        location: get_bits(id, l.location) as u8,
    }
}

/// Canonical hex: big-endian 128-bit, 32 lowercase hex chars, zero-padded.
/// Matches `packed.toString(16).padStart(32, '0')` (TS) and the F#/C# encoders.
#[must_use]
pub fn to_hex(id: u128) -> String {
    format!("{id:032x}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{category, chromosome, firefly, location, persona, DeterministicEnv, VERSION_V1};

    fn human_verified_obs() -> ZetaObservation {
        ZetaObservation {
            version: VERSION_V1,
            timestamp: 1_747_780_809_123,
            chromosome: chromosome::FINANCIAL_INTEGRITY,
            category: category::OBSERVATION,
            firefly: firefly::ON,
            authority: Authority::HumanVerified,
            persona: persona::HUMAN_MAINTAINER,
            momentum: Momentum::Normal,
            location: location::EAST_US_VA,
        }
    }

    #[test]
    fn pack_matches_known_vector_hex() {
        let id = pack(&human_verified_obs(), &DeterministicEnv).expect("pack");
        assert_eq!(to_hex(id), "080cb77ed58d19c1f80b000800000000");
    }

    #[test]
    fn roundtrip_named() {
        let obs = human_verified_obs();
        let id = pack(&obs, &DeterministicEnv).expect("pack");
        assert_eq!(unpack(id), obs);
    }

    #[test]
    fn roundtrip_raw_authority_and_momentum() {
        let obs = ZetaObservation {
            version: VERSION_V1,
            timestamp: 0,
            chromosome: chromosome::META_COHERENCE,
            category: category::OBSERVATION,
            firefly: firefly::ON,
            authority: Authority::Raw(0),
            persona: persona::HUMAN_MAINTAINER,
            momentum: Momentum::Raw(255),
            location: location::EAST_US_VA,
        };
        let id = pack(&obs, &DeterministicEnv).expect("pack");
        assert_eq!(unpack(id), obs);
    }

    #[test]
    fn pack_rejects_timestamp_overflow() {
        let mut obs = human_verified_obs();
        obs.timestamp = MAX_TIMESTAMP + 1;
        assert!(matches!(
            pack(&obs, &DeterministicEnv),
            Err(PackError::TimestampOutOfRange(_))
        ));
    }

    #[test]
    fn pack_rejects_category_overflow() {
        let mut obs = human_verified_obs();
        obs.category = 16; // 4-bit field max is 15
        assert!(matches!(
            pack(&obs, &DeterministicEnv),
            Err(PackError::EnumFieldOutOfRange { field: "category", .. })
        ));
    }

    #[test]
    fn pack_rejects_authority_raw_alias() {
        let mut obs = human_verified_obs();
        obs.authority = Authority::Raw(31); // aliases HumanVerified
        assert!(matches!(
            pack(&obs, &DeterministicEnv),
            Err(PackError::AuthorityRawAliasesNamed(31))
        ));
    }
}
