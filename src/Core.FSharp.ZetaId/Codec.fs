namespace Zeta.Core.FSharp.ZetaId

/// ZetaId codec — Pack/Unpack between ZetaObservation and UInt128.
/// Mirrors the C# implementation (`src/Core.CSharp.ZetaId/ZetaIdCodec.cs`) +
/// the TS implementation (`src/Core.TypeScript/zeta-id/zeta-id.ts`). The
/// canonical hex output across all three implementations must agree byte-for-byte
/// per the cross-verify harness at `tests/cross-verification/zeta-id/`.
module ZetaIdCodec =

    let private layout = BitLayout.Default

    /// Timestamp is packed into a 48-bit field; valid range [0, 2^48 - 1].
    [<Literal>]
    let private MaxTimestamp = 281474976710655L  // (1L <<< 48) - 1L

    let private setBits (id: System.UInt128) (field: BitField) (fieldValue: uint64) : System.UInt128 =
        let mask = (System.UInt128.One <<< field.Width) - System.UInt128.One
        // System.UInt128(high, low) — fieldValue fits in low 64 bits
        let fieldAsU128 = System.UInt128(0UL, fieldValue)
        id ||| ((fieldAsU128 &&& mask) <<< field.Offset)

    let private getBits (id: System.UInt128) (field: BitField) : uint64 =
        let mask = (System.UInt128.One <<< field.Width) - System.UInt128.One
        uint64 ((id >>> field.Offset) &&& mask)

    let private validateEnumField (value: byte) (widthBits: int) (fieldName: string) =
        let maxValid = (1 <<< widthBits) - 1
        if int value > maxValid then
            raise (System.ArgumentOutOfRangeException(
                fieldName, value :> obj,
                sprintf "ZetaObservation.%s must be 0..%d (%d-bit field). Out-of-range enum values would silently truncate and collide." fieldName maxValid widthBits))

    /// Pack a ZetaObservation into a 128-bit ZetaId. Validates timestamp + enum
    /// bit-widths + environment non-null before bit-packing. Out-of-range values
    /// throw rather than silently truncating.
    let pack (obs: ZetaObservation) (env: ISimulationEnvironment) : System.UInt128 =
        if isNull (box env) then
            raise (System.ArgumentNullException("env"))

        if obs.Timestamp < 0L || obs.Timestamp > MaxTimestamp then
            raise (System.ArgumentOutOfRangeException(
                "obs", obs.Timestamp :> obj,
                sprintf "ZetaObservation.Timestamp must be 0..%d (48-bit field). Values outside this range would silently truncate and collide." MaxTimestamp))

        validateEnumField (byte obs.Version)    5 "Version"
        validateEnumField (byte obs.Chromosome) 5 "Chromosome"
        validateEnumField (byte obs.Category)   4 "Category"
        validateEnumField (byte obs.Firefly)    1 "Firefly"

        // Re-validate Authority.Raw / Momentum.Raw at Pack time. F# DU cases
        // are inherently public — callers can construct `Authority.Raw 31` directly,
        // bypassing `Authority.raw` smart-constructor validation. Pack re-checks
        // for named-case collision + Authority bounds. C# achieves the equivalent
        // via sealed-record private setter; F# achieves it via re-validation here.
        // Per Copilot + Codex post-merge thread on PR #4548.
        match obs.Authority with
        | Authority.Raw v ->
            if v > 31uy then
                raise (System.ArgumentOutOfRangeException(
                    "obs", v :> obj,
                    sprintf "ZetaObservation.Authority = Authority.Raw(%d) exceeds 5-bit Authority field (0..31). Use Authority.raw smart constructor (rejects this at construction) or named case." v))
            if v = byte AuthorityValue.HumanVerified
               || v = byte AuthorityValue.TrustedAgent
               || v = byte AuthorityValue.Standard
               || v = byte AuthorityValue.BestEffort
               || v = byte AuthorityValue.Simulated then
                raise (System.ArgumentOutOfRangeException(
                    "obs", v :> obj,
                    sprintf "ZetaObservation.Authority = Authority.Raw(%d) aliases a named case (round-trip unstable). Use the named Authority case directly, or Authority.raw smart constructor (rejects this at construction)." v))
        | _ -> ()
        match obs.Momentum with
        | Momentum.Raw v ->
            if v = byte MomentumValue.Background
               || v = byte MomentumValue.Normal
               || v = byte MomentumValue.Elevated
               || v = byte MomentumValue.High
               || v = byte MomentumValue.Critical then
                raise (System.ArgumentOutOfRangeException(
                    "obs", v :> obj,
                    sprintf "ZetaObservation.Momentum = Momentum.Raw(%d) aliases a named case (round-trip unstable). Use the named Momentum case directly, or Momentum.raw smart constructor (rejects this at construction)." v))
        | _ -> ()

        let mutable id = System.UInt128.Zero
        id <- setBits id layout.Version    (uint64 (byte obs.Version))
        id <- setBits id layout.Timestamp  (uint64 obs.Timestamp)
        id <- setBits id layout.Chromosome (uint64 (byte obs.Chromosome))
        id <- setBits id layout.Category   (uint64 (byte obs.Category))
        id <- setBits id layout.Firefly    (uint64 (byte obs.Firefly))
        id <- setBits id layout.Authority  (uint64 (Authority.toByte obs.Authority))
        id <- setBits id layout.Persona    (uint64 (byte obs.Persona))
        id <- setBits id layout.Momentum   (uint64 (Momentum.toByte obs.Momentum))
        id <- setBits id layout.Location   (uint64 (byte obs.Location))

        let rand32 = (uint64 (env.NextInt64())) &&& 0xFFFFFFFFUL
        id <- setBits id layout.Randomness rand32

        id

    /// Unpack a 128-bit ZetaId into a ZetaObservation. Inverse of Pack.
    /// All enums declared with byte-backed values, so LanguagePrimitives.EnumOfValue
    /// over byte produces the correct enum case.
    let unpack (id: System.UInt128) : ZetaObservation =
        let toByte field = byte (getBits id field)
        {
            Version    = LanguagePrimitives.EnumOfValue<byte, IdVersion>   (toByte layout.Version)
            Timestamp  = int64 (getBits id layout.Timestamp)
            Chromosome = LanguagePrimitives.EnumOfValue<byte, Chromosome>  (toByte layout.Chromosome)
            Category   = LanguagePrimitives.EnumOfValue<byte, Category>    (toByte layout.Category)
            Firefly    = LanguagePrimitives.EnumOfValue<byte, Firefly>     (toByte layout.Firefly)
            Authority  = Authority.fromByte (toByte layout.Authority)
            Persona    = LanguagePrimitives.EnumOfValue<byte, Persona>     (toByte layout.Persona)
            Momentum   = Momentum.fromByte  (toByte layout.Momentum)
            Location   = LanguagePrimitives.EnumOfValue<byte, Location>    (toByte layout.Location)
        }
