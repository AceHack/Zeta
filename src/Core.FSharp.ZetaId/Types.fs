namespace Zeta.Core.FSharp.ZetaId

/// Milliseconds units of measure. Duplicated locally (not imported from
/// `src/Core/Units.fs`) to preserve the zero-external-dependencies discipline
/// of the production library. Per Mika V9.3 substrate (2026-05-21).
[<Measure>]
type ms

/// Bit measurement unit of measure for layout offsets and widths.
[<Measure>]
type bit

/// Version field — 5 bits. Currently V1 only.
/// Mirrors `src/Core.CSharp.ZetaId/IdVersion.cs`.
type IdVersion =
    | V1 = 1uy

/// Chromosome field — 5 bits (0..31). Categorical observation lineage marker.
/// Mirrors `src/Core.CSharp.ZetaId/Chromosome.cs` — canonical named cases only.
/// LanguagePrimitives.EnumOfValue accepts any byte 0..31; named cases are
/// the contract-level vocabulary.
type Chromosome =
    | MetaCoherence = 0uy
    | FinancialIntegrity = 7uy

/// Category field — 4 bits (0..15). Mirrors `src/Core.CSharp.ZetaId/Category.cs`.
type Category =
    | Observation = 0uy
    | Emission = 1uy
    | Workflow = 2uy
    | Heartbeat = 3uy
    | Batch = 4uy      // branch-mode batch-merge transport (corporate leash, 081KSNY2Z0008QG0R0017JSTGD); slot reserved, impl deferred
    | FrictionTelemetry = 5uy  // friction telemetry per ADR 2026-05-29 (slot registered; impl pending)
    | Bus = 6uy        // cross-machine agent comms (git-native bus spec, #6219)
    | Spawn = 7uy      // agent-spawning (backend-portable: GH Actions / Argo / GitLab)
    | WorkItem = 8uy   // planning umbrella (tasks + bugs; B-xxxxx -> ZetaId migration)
    | ContentAddress = 9uy // internal content address (truncated BLAKE3 payload)
    | InventoryAsset = 10uy // physical asset register (git-as-database inventory, inventory/items/) — backfill 2026-07-04, was TS/registry-only
    | Channel = 11uy   // multiplexed four-corner duplex channel over one transport (ZetaId-keyed; Aaron 2026-07-04)
    | Agenda = 12uy    // a declarer's voluntary agenda declaration (agendas/<zetaid>-<slug>.md) — 081M0R3WHTH087G0R0015CH5PV, Aaron 2026-08-23
    | Extended = 15uy   // reserved escape marker for wider extension categories

/// Persona field — 8 bits. Mirrors `src/Core.CSharp.ZetaId/Persona.cs`.
type Persona =
    | HumanMaintainer = 1uy
    | FireflyCoherence = 2uy

/// Location field — 8 bits. Mirrors `src/Core.CSharp.ZetaId/Location.cs`.
/// Codes 1-11 cover major regions across AWS / GCP / Azure / DigitalOcean.
/// Backlog (human maintainer 2026-05-21): registry/locations.yaml + provider-specific
/// mapping layer ships in a separate follow-up PR.
type Location =
    | EastUsVa = 1uy          // AWS us-east-1, Azure East US, GCP us-east4
    | WestUsOr = 2uy          // AWS us-west-2, Azure West US 2, GCP us-west1
    | CentralUs = 3uy         // AWS us-east-2, GCP us-central1
    | CanadaToronto = 4uy     // AWS ca-central-1, Azure Canada Central
    | WestEurope = 5uy        // AWS eu-west-1, Azure West Europe, GCP europe-west4
    | NorthEurope = 6uy       // AWS eu-north-1, Azure North Europe
    | SoutheastAsiaSg = 7uy   // AWS ap-southeast-1, Azure Southeast Asia
    | NortheastAsiaTk = 8uy   // AWS ap-northeast-1, Azure Japan East
    | AustraliaSyd = 9uy      // AWS ap-southeast-2, Azure Australia East
    | SouthAmericaSp = 10uy   // AWS sa-east-1, Azure Brazil South
    | MultiRegion = 11uy      // global/anycast/multi-cloud

/// Underlying byte values for named Authority cases.
/// Authority field width is 5 bits (0..31). Spacing per V8 cycle Codex P2
/// catch: named-case bytes intentionally non-contiguous so that Raw(byte)
/// collision-check can reject round-trip-unstable values cleanly. Mirrors
/// `src/Core.CSharp.ZetaId/AuthorityValue.cs`.
type AuthorityValue =
    | HumanVerified = 31uy
    | TrustedAgent = 20uy
    | Standard = 15uy
    | BestEffort = 8uy
    | Simulated = 3uy

/// Underlying byte values for named Momentum cases. Momentum field is 8 bits.
/// Mirrors `src/Core.CSharp.ZetaId/MomentumValue.cs`.
type MomentumValue =
    | Background = 32uy
    | Normal = 96uy
    | Elevated = 160uy
    | High = 224uy
    | Critical = 248uy

/// Authority — 5-bit field. Named cases for common authority kinds; Raw escape
/// for values outside the named set. Raw(byte) rejects collision with named-case
/// bytes (would create round-trip-unstable values: Pack writes the byte, Unpack
/// canonicalizes to the named record).
[<RequireQualifiedAccess>]
type Authority =
    | HumanVerified
    | TrustedAgent
    | Standard
    | BestEffort
    | Simulated
    | Raw of byte

module Authority =
    /// Maximum valid value for the 5-bit Authority field.
    [<Literal>]
    let private MaxAuthority = 31uy

    /// Construct an Authority.Raw with full bounds + named-collision validation.
    /// Throws ArgumentOutOfRangeException on collision or out-of-range.
    let raw (value: byte) =
        if value > MaxAuthority then
            raise (System.ArgumentOutOfRangeException(
                "value", value :> obj,
                sprintf "Authority.Raw(%d) exceeds the 5-bit Authority field (0..%d). Out-of-range values would silently truncate and collide." value MaxAuthority))
        if value = byte AuthorityValue.HumanVerified
           || value = byte AuthorityValue.TrustedAgent
           || value = byte AuthorityValue.Standard
           || value = byte AuthorityValue.BestEffort
           || value = byte AuthorityValue.Simulated then
            raise (System.ArgumentOutOfRangeException(
                "value", value :> obj,
                sprintf "Authority.Raw(%d) aliases a named case. Round-trip is not stable: Pack writes %d, Unpack canonicalizes to the named record. Use the named case (HumanVerified/TrustedAgent/Standard/BestEffort/Simulated) instead of Raw." value value))
        Authority.Raw value

    let toByte (a: Authority) : byte =
        match a with
        | Authority.HumanVerified -> byte AuthorityValue.HumanVerified
        | Authority.TrustedAgent -> byte AuthorityValue.TrustedAgent
        | Authority.Standard -> byte AuthorityValue.Standard
        | Authority.BestEffort -> byte AuthorityValue.BestEffort
        | Authority.Simulated -> byte AuthorityValue.Simulated
        | Authority.Raw v -> v

    let fromByte (value: byte) : Authority =
        match value with
        | v when v = byte AuthorityValue.HumanVerified -> Authority.HumanVerified
        | v when v = byte AuthorityValue.TrustedAgent -> Authority.TrustedAgent
        | v when v = byte AuthorityValue.Standard -> Authority.Standard
        | v when v = byte AuthorityValue.BestEffort -> Authority.BestEffort
        | v when v = byte AuthorityValue.Simulated -> Authority.Simulated
        | v -> Authority.Raw v

/// Momentum — 8-bit field. Named cases for common momentum kinds; Raw escape
/// for unnamed values. Raw(byte) rejects collision with named-case bytes.
[<RequireQualifiedAccess>]
type Momentum =
    | Background
    | Normal
    | Elevated
    | High
    | Critical
    | Raw of byte

module Momentum =
    /// Construct a Momentum.Raw with named-collision validation.
    /// Throws ArgumentOutOfRangeException on collision with a named case byte.
    let raw (value: byte) =
        if value = byte MomentumValue.Background
           || value = byte MomentumValue.Normal
           || value = byte MomentumValue.Elevated
           || value = byte MomentumValue.High
           || value = byte MomentumValue.Critical then
            raise (System.ArgumentOutOfRangeException(
                "value", value :> obj,
                sprintf "Momentum.Raw(%d) aliases a named case. Round-trip is not stable: Pack writes %d, Unpack canonicalizes to the named record. Use the named case (Background/Normal/Elevated/High/Critical) instead of Raw." value value))
        Momentum.Raw value

    let toByte (m: Momentum) : byte =
        match m with
        | Momentum.Background -> byte MomentumValue.Background
        | Momentum.Normal -> byte MomentumValue.Normal
        | Momentum.Elevated -> byte MomentumValue.Elevated
        | Momentum.High -> byte MomentumValue.High
        | Momentum.Critical -> byte MomentumValue.Critical
        | Momentum.Raw v -> v

    let fromByte (value: byte) : Momentum =
        match value with
        | v when v = byte MomentumValue.Background -> Momentum.Background
        | v when v = byte MomentumValue.Normal -> Momentum.Normal
        | v when v = byte MomentumValue.Elevated -> Momentum.Elevated
        | v when v = byte MomentumValue.High -> Momentum.High
        | v when v = byte MomentumValue.Critical -> Momentum.Critical
        | v -> Momentum.Raw v

/// Observation record. All fields explicit; no default-init shortcuts.
type ZetaObservation = {
    Version: IdVersion
    Timestamp: int64<ms>
    Chromosome: Chromosome
    Category: Category
    Authority: Authority
    Persona: Persona
    Momentum: Momentum
    Location: Location
}

/// Structured representation of parsed ZetaId categories.
[<RequireQualifiedAccess>]
type ZetaIdPayload =
    | Observation of ZetaObservation
    | ContentAddress of version: IdVersion * payload: System.UInt128
    | Generic of version: IdVersion * category: Category * payload: System.UInt128

/// Simulation environment interface. Provides controlled int64 generation for
/// the 32-bit randomness field. DeterministicEnv mirrors the C# implementation;
/// production-grade environment would draw from a CSPRNG.
type ISimulationEnvironment =
    abstract NextInt64: unit -> int64

/// Deterministic environment — fixed seed for cross-verify test reproducibility.
/// Seed matches `tests/cross-verification/zeta-id/vectors.yaml` expected_hex values.
type DeterministicEnv private () =
    static let instance = DeterministicEnv() :> ISimulationEnvironment
    static member Instance = instance
    interface ISimulationEnvironment with
        // Returns 0; vectors.yaml expected_hex values were computed with rand=0
        // (verified empirically by inspecting cs-output.json + ts-output.json).
        member _.NextInt64() = 0L
