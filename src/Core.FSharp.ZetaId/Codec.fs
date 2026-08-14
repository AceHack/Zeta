namespace Zeta.Core.FSharp.ZetaId

/// ZetaId codec — Pack/Unpack between ZetaObservation and UInt128.
/// Mirrors the C# implementation (`src/Core.CSharp.ZetaId/ZetaIdCodec.cs`) +
/// the TS implementation (`src/Core.TypeScript/zeta-id/zeta-id.ts`). The
/// canonical hex output across all three implementations must agree byte-for-byte
/// per the cross-verify harness at `tests/cross-verification/zeta-id/`.
module ZetaIdCodec =

    let private layout = BitLayout.Default

    /// Timestamp is packed into a 48-bit field; valid range [0, 2^48 - 1].
    /// Typed with the `ms` measure to compose with ZetaObservation.Timestamp
    /// (per Mika V9.3). `[<Literal>]` removed — measure-typed values can't be
    /// F# literals; this is a regular let-binding (computed once per module init).
    let private MaxTimestamp : int64<ms> = 281474976710655L<ms>  // (1L <<< 48) - 1L

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

        if obs.Timestamp < 0L<ms> || obs.Timestamp > MaxTimestamp then
            raise (System.ArgumentOutOfRangeException(
                "obs", obs.Timestamp :> obj,
                sprintf "ZetaObservation.Timestamp must be 0..%d ms (48-bit field). Values outside this range would silently truncate and collide." (int64 MaxTimestamp)))

        validateEnumField (byte obs.Version)    5 "Version"
        validateEnumField (byte obs.Chromosome) 5 "Chromosome"
        validateEnumField (byte obs.Category)   4 "Category"

        if byte obs.Category >= 9uy then
            raise (System.ArgumentOutOfRangeException(
                "obs", obs.Category :> obj,
                sprintf "ZetaObservation.Category must be < 9 (0..8) (got %A). Categories >= 9 are reserved for special layouts like ContentAddress." obs.Category))

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
        id <- setBits id layout.Timestamp  (uint64 (int64 obs.Timestamp))
        id <- setBits id layout.Chromosome (uint64 (byte obs.Chromosome))
        id <- setBits id layout.Category   (uint64 (byte obs.Category))
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
            Timestamp  = LanguagePrimitives.Int64WithMeasure<ms> (int64 (getBits id layout.Timestamp))
            Chromosome = LanguagePrimitives.EnumOfValue<byte, Chromosome>  (toByte layout.Chromosome)
            Category   = LanguagePrimitives.EnumOfValue<byte, Category>    (toByte layout.Category)
            Authority  = Authority.fromByte (toByte layout.Authority)
            Persona    = LanguagePrimitives.EnumOfValue<byte, Persona>     (toByte layout.Persona)
            Momentum   = Momentum.fromByte  (toByte layout.Momentum)
            Location   = LanguagePrimitives.EnumOfValue<byte, Location>    (toByte layout.Location)
        }

    /// The Generic layout gives the payload 119 bits (65 low + 54 high).
    /// Private, mirroring the C# `GenericPayloadBits` const: the bound is a
    /// property of the codec, not a new public API surface.
    let private genericPayloadBits = 119

    /// Pack a generic ZetaId payload (119 bits) with a version and category.
    ///
    /// A wider payload used to be MASKED here rather than rejected, which aliases
    /// ids instead of failing: at 2039-09-07T15:47:35.552Z a caller building
    /// (ms <<< 78) ||| random78 -- the shape inventory/new-item.ts uses -- reaches
    /// ms = 2^41, the top ms bit falls off, and the result is BYTE-IDENTICAL to the
    /// same call with ms = 0. That is a silent collision with 1970, forever.
    /// The bound lives in the primitive (not only in the packPayload wrapper)
    /// because packGeneric is public: the exposure is a future caller reaching past
    /// the wrapper, which is exactly the mistake new-item.ts made in TS.
    let packGeneric (version: IdVersion) (category: Category) (payload: System.UInt128) : System.UInt128 =
        let maxPayload = (System.UInt128.One <<< genericPayloadBits) - System.UInt128.One
        if payload > maxPayload then
            raise (System.ArgumentOutOfRangeException(
                    "payload", payload :> obj,
                    "Generic payload exceeds 119 bits. Masking it would silently alias this id onto a different payload rather than fail."))
        let mutable id = System.UInt128.Zero
        // version goes to bits 123-127
        id <- id ||| (System.UInt128(0UL, (uint64 version) &&& 31UL) <<< 123)
        // category goes to bits 65-68
        id <- id ||| (System.UInt128(0UL, (uint64 category) &&& 15UL) <<< 65)
        // lower 65 bits of payload to bits 0-64
        let lowMask = (System.UInt128.One <<< 65) - System.UInt128.One
        id <- id ||| (payload &&& lowMask)
        // upper 54 bits of payload (bits 65-118) to bits 69-122
        let highPart = (payload >>> 65) &&& ((System.UInt128.One <<< 54) - System.UInt128.One)
        id <- id ||| (highPart <<< 69)
        id

    /// Unpack a generic ZetaId into version, category, and its 119-bit payload.
    let unpackGeneric (id: System.UInt128) : IdVersion * Category * System.UInt128 =
        let version = LanguagePrimitives.EnumOfValue<byte, IdVersion>(byte (uint64 (id >>> 123) &&& 31UL))
        let category = LanguagePrimitives.EnumOfValue<byte, Category>(byte (uint64 (id >>> 65) &&& 15UL))
        let lowMask = (System.UInt128.One <<< 65) - System.UInt128.One
        let lowPart = id &&& lowMask
        let highPart = (id >>> 69) &&& ((System.UInt128.One <<< 54) - System.UInt128.One)
        let payload = lowPart ||| (highPart <<< 65)
        version, category, payload

    /// Pack a structured ZetaIdPayload into a System.UInt128.
    let packPayload (payload: ZetaIdPayload) (env: ISimulationEnvironment) : System.UInt128 =
        match payload with
        | ZetaIdPayload.Observation obs -> pack obs env
        | ZetaIdPayload.ContentAddress (ver, pay) ->
            let maxPayload = (System.UInt128.One <<< 119) - System.UInt128.One
            if pay > maxPayload then
                raise (System.ArgumentOutOfRangeException("payload", pay :> obj, "ContentAddress payload exceeds 119 bits."))
            packGeneric ver Category.ContentAddress pay
        | ZetaIdPayload.Generic (ver, cat, pay) ->
            if byte cat < 9uy || cat = Category.ContentAddress then
                raise (System.ArgumentException(sprintf "Generic payload category must be >= 10 (got %A). Categories 0..8 are reserved for observations, and 9 is reserved for ContentAddress." cat, "payload"))
            let maxPayload = (System.UInt128.One <<< 119) - System.UInt128.One
            if pay > maxPayload then
                raise (System.ArgumentOutOfRangeException("payload", pay :> obj, "Generic payload exceeds 119 bits."))
            packGeneric ver cat pay

    /// Unpack a System.UInt128 into a structured ZetaIdPayload.
    let unpackPayload (id: System.UInt128) : ZetaIdPayload =
        let ver, cat, pay = unpackGeneric id
        if byte cat < 9uy then
            ZetaIdPayload.Observation (unpack id)
        elif cat = Category.ContentAddress then
            ZetaIdPayload.ContentAddress (ver, pay)
        else
            ZetaIdPayload.Generic (ver, cat, pay)

    let private crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    let private base32Length = 26

    let private decodeMap =
        let arr = Array.create 128 -1y
        for i = 0 to crockfordAlphabet.Length - 1 do
            let c = crockfordAlphabet.[i]
            let v = sbyte i
            arr.[int c] <- v
            arr.[int (System.Char.ToLowerInvariant c)] <- v
        arr.[int 'I'] <- 1y
        arr.[int 'i'] <- 1y
        arr.[int 'L'] <- 1y
        arr.[int 'l'] <- 1y
        arr.[int 'O'] <- 0y
        arr.[int 'o'] <- 0y
        arr

    /// Encode a 128-bit ZetaId as the canonical 26-char Crockford base32 string.
    let format (id: System.UInt128) : string =
        let chars = Array.zeroCreate base32Length
        let mutable v = id
        for i = base32Length - 1 downto 0 do
            let idx = int (v &&& System.UInt128(0UL, 31UL))
            chars.[i] <- crockfordAlphabet.[idx]
            v <- v >>> 5
        System.String(chars)

    /// Parse a canonical (or Crockford-lenient) base32 string back to a ZetaId.
    let parse (s: string) : System.UInt128 =
        if isNull s then
            raise (System.ArgumentNullException("s"))
        if s.Length <> base32Length then
            raise (System.ArgumentException(sprintf "Expected exactly %d characters, got %d" base32Length s.Length, "s"))
        
        let firstChar = s.[0]
        if int firstChar >= 128 || decodeMap.[int firstChar] >= 8y then
            raise (System.ArgumentException("Value exceeds 128 bits (leading pad bits must be zero)", "s"))

        let mutable result = System.UInt128.Zero
        for i = 0 to s.Length - 1 do
            let c = s.[i]
            if int c >= 128 then
                raise (System.ArgumentException(sprintf "Invalid Crockford base32 character '%c' at index %d" c i, "s"))
            let valByte = decodeMap.[int c]
            if valByte < 0y then
                raise (System.ArgumentException(sprintf "Invalid Crockford base32 character '%c' at index %d" c i, "s"))
            result <- (result <<< 5) ||| System.UInt128(0UL, uint64 valByte)
        result

    /// True iff s is the strict canonical Crockford form (26 chars, uppercase, strict alphabet, no aliases, round-trips).
    let isCanonical (s: string) : bool =
        if isNull s || s.Length <> base32Length then
            false
        else
            let mutable ok = true
            for i = 0 to s.Length - 1 do
                if crockfordAlphabet.IndexOf(s.[i]) < 0 then
                    ok <- false
            if ok then
                let firstChar = s.[0]
                let firstVal = decodeMap.[int firstChar]
                if firstVal < 0y || firstVal >= 8y then
                    false
                else
                    try
                        format (parse s) = s
                    with _ ->
                        false
            else
                false


