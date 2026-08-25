//! ZetaId V1 — the 128-bit canonical observation contract, Rust parity oracle.
//!
//! This is oracle **#4** of four (TS / F# / C# / Rust). Per
//! `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`, no single
//! language is the source of truth — multi-oracle byte-for-byte agreement on the
//! shared golden vectors (`tests/cross-verification/zeta-id/vectors.yaml`) **is**
//! the verification. See `tests/cross_verify.rs`.
//!
//! Faithful-port notes vs the F#/C#/TS oracles:
//!
//! - **Open-vocabulary fields** (version/chromosome/category/persona/location)
//!   are modeled as `u8` with named constants, not closed enums. The
//!   other oracles use `EnumOfValue`-style byte enums where the named cases are
//!   *contract vocabulary* but ANY in-range byte is a valid value. A closed Rust
//!   enum would reject unnamed in-range bytes the other oracles accept, breaking
//!   round-trip parity — so `u8` + constants is the faithful model. (B-0679
//!   sketched "enums"; the operative semantic is "byte field, named vocabulary,
//!   any in-range value valid".)
//! - **Authority/Momentum** ARE enums with a `Raw(u8)` escape, because they carry
//!   named-collision-rejection semantics (a `Raw` aliasing a named byte is
//!   round-trip-unstable) and the vectors reference them *by name*.
//! - **`pack` returns `Result`** (not panic) per the framework's
//!   Result-over-exception / monad-propagation doctrine; the F#/C# oracles throw,
//!   but the *observable contract* (reject out-of-range / aliasing) is identical.

pub mod bit_layout;
/// Generated bit layout constants.
#[path = "bit_layout.gen.rs"]
pub mod bit_layout_gen;
pub mod zeta_id;

pub use zeta_id::{
    PackError, ZETAID_BASE32_LEN, format_b32, is_canonical, pack, parse_b32, to_hex, unpack,
};

/// Version field value for V1 (5-bit field; the only version today).
pub const VERSION_V1: u8 = 1;

/// Named Chromosome vocabulary (5-bit field; any byte 0..=31 is valid).
pub mod chromosome {
    /// Meta-coherence lineage.
    pub const META_COHERENCE: u8 = 0;
    /// Financial-integrity lineage.
    pub const FINANCIAL_INTEGRITY: u8 = 7;
}

/// Named Category vocabulary (4-bit field; any byte 0..=15 is valid).
/// Mirrors `Category` across the oracles; `BUS = 6` is the git-native agent-bus
/// category (#6219) that everything bus-related keys by.
pub mod category {
    /// An observation.
    pub const OBSERVATION: u8 = 0;
    /// An emission.
    pub const EMISSION: u8 = 1;
    /// A workflow.
    pub const WORKFLOW: u8 = 2;
    /// A heartbeat (health).
    pub const HEARTBEAT: u8 = 3;
    /// Branch-mode batch-merge transport (corporate leash, B-0890; slot reserved).
    pub const BATCH: u8 = 4;
    /// Friction telemetry (ADR 2026-05-29; slot registered).
    pub const FRICTION_TELEMETRY: u8 = 5;
    /// Cross-machine agent comms (git-native bus, #6219).
    pub const BUS: u8 = 6;
    /// Agent spawning (backend-portable).
    pub const SPAWN: u8 = 7;
    /// Planning umbrella (tasks + bugs; B-xxxxx → ZetaId migration).
    pub const WORK_ITEM: u8 = 8;
    /// Internal content address (truncated BLAKE3 payload). Backfilled 2026-08-23 — this
    /// oracle had stopped at 8 while TS/C#/F# carried 9..11, so the "all four oracles carry
    /// the same category set" claim in `registry/categories.yaml` was false for Rust.
    pub const CONTENT_ADDRESS: u8 = 9;
    /// Physical asset register (git-as-database inventory, `inventory/items/`). Backfill 2026-08-23.
    pub const INVENTORY_ASSET: u8 = 10;
    /// Multiplexed four-corner duplex channel over one transport (Aaron 2026-07-04). Backfill 2026-08-23.
    pub const CHANNEL: u8 = 11;
    /// A declarer's voluntary agenda declaration (`agendas/<zetaid>-<slug>.md`) — one file per
    /// declaration, so no shared document has to be agreed on (081M0R3WHTH087G0R0015CH5PV; Aaron 2026-08-23).
    pub const AGENDA: u8 = 12;
    /// Reserved escape marker for wider extension categories. Slots 13 and 14 remain free;
    /// beyond 14 the escape is the path, not a renumbering.
    pub const EXTENDED: u8 = 15;
}

/// Named Persona vocabulary (8-bit field; any byte 0..=255 is valid).
pub mod persona {
    /// Human maintainer.
    pub const HUMAN_MAINTAINER: u8 = 1;
    /// Firefly coherence.
    pub const FIREFLY_COHERENCE: u8 = 2;
}

/// Named Location vocabulary (8-bit field). Codes 1–11 cover major regions across
/// AWS / GCP / Azure / DigitalOcean (the provider mapping ships separately).
pub mod location {
    /// AWS us-east-1 / Azure East US / GCP us-east4.
    pub const EAST_US_VA: u8 = 1;
    /// AWS us-west-2 / Azure West US 2 / GCP us-west1.
    pub const WEST_US_OR: u8 = 2;
    /// AWS us-east-2 / GCP us-central1.
    pub const CENTRAL_US: u8 = 3;
    /// AWS ca-central-1 / Azure Canada Central.
    pub const CANADA_TORONTO: u8 = 4;
    /// AWS eu-west-1 / Azure West Europe / GCP europe-west4.
    pub const WEST_EUROPE: u8 = 5;
    /// AWS eu-north-1 / Azure North Europe.
    pub const NORTH_EUROPE: u8 = 6;
    /// AWS ap-southeast-1 / Azure Southeast Asia.
    pub const SOUTHEAST_ASIA_SG: u8 = 7;
    /// AWS ap-northeast-1 / Azure Japan East.
    pub const NORTHEAST_ASIA_TK: u8 = 8;
    /// AWS ap-southeast-2 / Azure Australia East.
    pub const AUSTRALIA_SYD: u8 = 9;
    /// AWS sa-east-1 / Azure Brazil South.
    pub const SOUTH_AMERICA_SP: u8 = 10;
    /// Global / anycast / multi-cloud.
    pub const MULTI_REGION: u8 = 11;
}

/// The byte values of the named [`Authority`] cases (5-bit field). Spaced
/// non-contiguously (V8-cycle Codex catch) so a `Raw` aliasing a named byte is a
/// clean, rejectable round-trip-unstable value.
pub mod authority_value {
    /// `HumanVerified`.
    pub const HUMAN_VERIFIED: u8 = 31;
    /// `TrustedAgent`.
    pub const TRUSTED_AGENT: u8 = 20;
    /// `Standard`.
    pub const STANDARD: u8 = 15;
    /// `BestEffort`.
    pub const BEST_EFFORT: u8 = 8;
    /// `Simulated`.
    pub const SIMULATED: u8 = 3;
}

/// The byte values of the named [`Momentum`] cases (8-bit field).
pub mod momentum_value {
    /// `Background`.
    pub const BACKGROUND: u8 = 32;
    /// `Normal`.
    pub const NORMAL: u8 = 96;
    /// `Elevated`.
    pub const ELEVATED: u8 = 160;
    /// `High`.
    pub const HIGH: u8 = 224;
    /// `Critical`.
    pub const CRITICAL: u8 = 248;
}

/// Maximum value for the 5-bit Authority field.
pub const MAX_AUTHORITY: u8 = 31;

/// Authority — a 5-bit field. Named cases for common authority kinds; a `Raw`
/// escape for in-range values outside the named set. A `Raw` that aliases a named
/// byte is round-trip-unstable (pack writes the byte, unpack canonicalizes to the
/// named case) and is rejected by [`Authority::raw`] + at pack time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Authority {
    /// Verified by a human.
    HumanVerified,
    /// A trusted agent.
    TrustedAgent,
    /// Standard authority.
    Standard,
    /// Best-effort authority.
    BestEffort,
    /// Simulated (lowest trust).
    Simulated,
    /// An explicit in-range value outside the named set.
    Raw(u8),
}

impl Authority {
    /// The byte value written into the Authority field.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        match self {
            Authority::HumanVerified => authority_value::HUMAN_VERIFIED,
            Authority::TrustedAgent => authority_value::TRUSTED_AGENT,
            Authority::Standard => authority_value::STANDARD,
            Authority::BestEffort => authority_value::BEST_EFFORT,
            Authority::Simulated => authority_value::SIMULATED,
            Authority::Raw(v) => v,
        }
    }

    /// Canonicalize a byte back into an `Authority` (named case if it matches one,
    /// else `Raw`). Inverse of [`Authority::to_byte`] for valid in-range values.
    #[must_use]
    pub const fn from_byte(v: u8) -> Authority {
        match v {
            authority_value::HUMAN_VERIFIED => Authority::HumanVerified,
            authority_value::TRUSTED_AGENT => Authority::TrustedAgent,
            authority_value::STANDARD => Authority::Standard,
            authority_value::BEST_EFFORT => Authority::BestEffort,
            authority_value::SIMULATED => Authority::Simulated,
            other => Authority::Raw(other),
        }
    }

    /// Smart constructor for [`Authority::Raw`]: rejects out-of-range (> 5-bit) and
    /// named-case-aliasing values so every `Raw` is round-trip-stable.
    ///
    /// # Errors
    /// Returns [`PackError::AuthorityRawOutOfRange`] if `value > 31`, or
    /// [`PackError::AuthorityRawAliasesNamed`] if it equals a named-case byte.
    pub fn raw(value: u8) -> Result<Authority, PackError> {
        if value > MAX_AUTHORITY {
            return Err(PackError::AuthorityRawOutOfRange(value));
        }
        if is_named_authority_byte(value) {
            return Err(PackError::AuthorityRawAliasesNamed(value));
        }
        Ok(Authority::Raw(value))
    }
}

/// Whether a byte equals one of the named [`Authority`] case values.
#[must_use]
pub const fn is_named_authority_byte(v: u8) -> bool {
    matches!(
        v,
        authority_value::HUMAN_VERIFIED
            | authority_value::TRUSTED_AGENT
            | authority_value::STANDARD
            | authority_value::BEST_EFFORT
            | authority_value::SIMULATED
    )
}

/// Momentum — an 8-bit field. Named cases for common momentum kinds; a `Raw`
/// escape for unnamed values. A `Raw` aliasing a named byte is rejected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Momentum {
    /// Background priority.
    Background,
    /// Normal priority.
    Normal,
    /// Elevated priority.
    Elevated,
    /// High priority.
    High,
    /// Critical priority.
    Critical,
    /// An explicit value outside the named set.
    Raw(u8),
}

impl Momentum {
    /// The byte value written into the Momentum field.
    #[must_use]
    pub const fn to_byte(self) -> u8 {
        match self {
            Momentum::Background => momentum_value::BACKGROUND,
            Momentum::Normal => momentum_value::NORMAL,
            Momentum::Elevated => momentum_value::ELEVATED,
            Momentum::High => momentum_value::HIGH,
            Momentum::Critical => momentum_value::CRITICAL,
            Momentum::Raw(v) => v,
        }
    }

    /// Canonicalize a byte back into a `Momentum`. Inverse of [`Momentum::to_byte`].
    #[must_use]
    pub const fn from_byte(v: u8) -> Momentum {
        match v {
            momentum_value::BACKGROUND => Momentum::Background,
            momentum_value::NORMAL => Momentum::Normal,
            momentum_value::ELEVATED => Momentum::Elevated,
            momentum_value::HIGH => Momentum::High,
            momentum_value::CRITICAL => Momentum::Critical,
            other => Momentum::Raw(other),
        }
    }

    /// Smart constructor for [`Momentum::Raw`]: rejects named-case-aliasing values.
    ///
    /// # Errors
    /// Returns [`PackError::MomentumRawAliasesNamed`] if `value` equals a named byte.
    pub fn raw(value: u8) -> Result<Momentum, PackError> {
        if is_named_momentum_byte(value) {
            return Err(PackError::MomentumRawAliasesNamed(value));
        }
        Ok(Momentum::Raw(value))
    }
}

/// Whether a byte equals one of the named [`Momentum`] case values.
#[must_use]
pub const fn is_named_momentum_byte(v: u8) -> bool {
    matches!(
        v,
        momentum_value::BACKGROUND
            | momentum_value::NORMAL
            | momentum_value::ELEVATED
            | momentum_value::HIGH
            | momentum_value::CRITICAL
    )
}

/// A ZetaId observation — the decoded, structured form of a 128-bit ZetaId.
/// Open-vocabulary fields are `u8` (any in-range byte valid); Authority/Momentum
/// carry named-case semantics. `pack`/`unpack` ([`zeta_id`]) move between this and
/// the 128-bit id.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ZetaObservation {
    /// Version (5-bit). [`VERSION_V1`].
    pub version: u8,
    /// Timestamp in milliseconds since epoch (48-bit; 0..=2^48-1).
    pub timestamp: u64,
    /// Chromosome (5-bit). See [`chromosome`].
    pub chromosome: u8,
    /// Category (4-bit). See [`category`].
    pub category: u8,
    /// Authority (5-bit).
    pub authority: Authority,
    /// Persona (8-bit). See [`persona`].
    pub persona: u8,
    /// Momentum (8-bit).
    pub momentum: Momentum,
    /// Location (8-bit). See [`location`].
    pub location: u8,
}

/// Source of the 32-bit randomness field. `pack` REQUIRES one (no silent-zero
/// fallback — the contract is that randomness is always explicitly sourced).
///
/// Returns an `i64` to mirror the F#/C# `NextInt64` contract; `pack` masks the low
/// 32 bits. The cross-verify uses [`DeterministicEnv`] (always 0). A cryptographic
/// production env is a deliberate dependency decision deferred behind a future
/// `rand` feature (matching how `Core.Rust.Observe` gates serde behind `serde`).
pub trait SimulationEnvironment {
    /// Produce the next 64-bit value; `pack` keeps the low 32 bits as randomness.
    fn next_i64(&self) -> i64;
}

/// Deterministic environment — always returns 0, so packed ids are reproducible.
/// The shared golden vectors were computed with randomness = 0; this is the env
/// the cross-verify oracle uses.
#[derive(Debug, Clone, Copy, Default)]
pub struct DeterministicEnv;

impl SimulationEnvironment for DeterministicEnv {
    fn next_i64(&self) -> i64 {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authority_byte_roundtrip_named() {
        for a in [
            Authority::HumanVerified,
            Authority::TrustedAgent,
            Authority::Standard,
            Authority::BestEffort,
            Authority::Simulated,
        ] {
            assert_eq!(Authority::from_byte(a.to_byte()), a);
        }
    }

    #[test]
    fn authority_named_byte_values_match_contract() {
        assert_eq!(Authority::HumanVerified.to_byte(), 31);
        assert_eq!(Authority::TrustedAgent.to_byte(), 20);
        assert_eq!(Authority::Standard.to_byte(), 15);
        assert_eq!(Authority::BestEffort.to_byte(), 8);
        assert_eq!(Authority::Simulated.to_byte(), 3);
    }

    #[test]
    fn momentum_named_byte_values_match_contract() {
        assert_eq!(Momentum::Background.to_byte(), 32);
        assert_eq!(Momentum::Normal.to_byte(), 96);
        assert_eq!(Momentum::Elevated.to_byte(), 160);
        assert_eq!(Momentum::High.to_byte(), 224);
        assert_eq!(Momentum::Critical.to_byte(), 248);
    }

    #[test]
    fn authority_raw_rejects_alias_and_out_of_range() {
        assert!(matches!(
            Authority::raw(31),
            Err(PackError::AuthorityRawAliasesNamed(31))
        ));
        assert!(matches!(
            Authority::raw(40),
            Err(PackError::AuthorityRawOutOfRange(40))
        ));
        assert_eq!(Authority::raw(0), Ok(Authority::Raw(0)));
    }

    #[test]
    fn momentum_raw_rejects_alias() {
        assert!(matches!(
            Momentum::raw(96),
            Err(PackError::MomentumRawAliasesNamed(96))
        ));
        assert_eq!(Momentum::raw(255), Ok(Momentum::Raw(255)));
    }
}
