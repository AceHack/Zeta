namespace Zeta.Core.FSharp.TriBoolean

/// Tri-boolean floating point -- biased-exponent decoder (081KSV2WD0008QG0R00051XS0N slice 5 pt2, F# parity oracle).
///
/// Mirrors the TS distribution surface (src/Core.TypeScript/tri-boolean-float) with the RATIFIED
/// biased-exponent decoder. The middle field decodes the ends (middle-out, self-describing):
///
///   decoded value = V * 2 ^ (mode - bias),   bias = 2 ^ (decoderWidth - 1)
///
/// where V    = MSB-first base-2 read of (high ++ low)   (Tri.T = 1, Tri.F = 0), and
///       mode = MSB-first base-2 read of the middle decoder field.
///
/// Every field is a `Tri list` -- the float is a composite of digital-qubit cells (Types.fs), so
/// any trit may be held (Tri.N):
///   * Tri.N in a value trit   => the value is superposed       (ValueSuperposed)
///   * Tri.N in a decoder trit => the decode instruction itself  (InterpretationSuperposed)
/// `measure` is the only collapsing op; it surfaces which superposition is held rather than
/// collapsing silently (the digital-qubit measure/cooperate discipline at the number scope).
///
/// Width: field reads accumulate into int64 (matching the Rust u64 oracle; TS uses f64). This keeps
/// all four oracles in agreement up to f64's 2^53 exact-integer range -- the shared limit, since the
/// decoded value is f64 in every oracle. (A naive 32-bit int would wrap at 2^31, diverging from the
/// other three oracles before the f64 limit; int64 defers that to widths no realistic shape reaches.)
///
/// F# is oracle #2 of four (TS/F#/C#/Rust) in the summonable-BFT cross-language consensus. The F#
/// compiler is a non-Byzantine oracle: it cannot lie about whether the TS design type-composes, so
/// four-of-four compiler-checked parity = BFT consensus with no human voters.
module Float =

    /// Field widths (trits per field), MSB-first within each field.
    type FloatShape =
        { HighWidth: int
          DecoderWidth: int
          LowWidth: int }

    /// Reference v0 shape: 4/3/4 -- 8 value trits, mode in [0,8), bias = 4.
    let defaultShape: FloatShape =
        { HighWidth = 4
          DecoderWidth = 3
          LowWidth = 4 }

    /// A tri-boolean float: a composite of digital-qubit cells. Each field is MSB-first; any trit
    /// may be held (Tri.N).
    type TriFloat =
        { Shape: FloatShape
          High: Tri list
          Decoder: Tri list
          Low: Tri list }

    /// Which superposition is held when `measure` cannot collapse to a single number. The two
    /// held-states are distinct (the decode instruction is held vs the value is held).
    [<RequireQualifiedAccess>]
    type FloatFeedback =
        /// Tri.N in the decoder field -- the decode instruction itself is superposed.
        | InterpretationSuperposed
        /// Tri.N in a value trit while the decoder is certain -- the value is superposed.
        | ValueSuperposed

    /// MSB-first base-2 read of a trit field (Tri.T = 1, Tri.F = 0). None if ANY trit is held (Tri.N).
    /// Accumulates into int64 (see module doc): no wrap until 63 bits, well past any realistic shape
    /// and past f64's 2^53 exact range that bounds the decoded value across all four oracles.
    let private intOf (trits: Tri list) : int64 option =
        let rec go acc ts =
            match ts with
            | [] -> Some acc
            | Tri.N :: _ -> None
            | Tri.T :: rest -> go (acc * 2L + 1L) rest
            | Tri.F :: rest -> go (acc * 2L) rest

        go 0L trits

    /// MSB-first encode of a non-negative integer into `width` certain trits (Tri.T = 1, Tri.F = 0).
    let private intToTrits (v: int64) (width: int) : Tri list =
        [ for i in (width - 1) .. -1 .. 0 -> if (v >>> i) &&& 1L = 1L then Tri.T else Tri.F ]

    /// decode (middle-out, biased-exponent): read the MIDDLE decoder first, then decode OUTWARD.
    ///   * Tri.N in the decoder  => InterpretationSuperposed (the decode instruction is held).
    ///   * Tri.N in a value trit => ValueSuperposed (the value is held; interpretation known).
    ///   * else                  => Ok (V * 2 ^ (mode - bias)),  bias = 2 ^ (decoderWidth - 1).
    /// The decoder is read first, so InterpretationSuperposed dominates when both are held.
    let decode (f: TriFloat) : Result<float, FloatFeedback> =
        match intOf f.Decoder with
        | None -> Error FloatFeedback.InterpretationSuperposed
        | Some mode ->
            match intOf (f.High @ f.Low) with
            | None -> Error FloatFeedback.ValueSuperposed
            | Some v ->
                let bias = pown 2L (f.Decoder.Length - 1)
                Ok(float v * (2.0 ** float (mode - bias)))

    /// measure: the ONLY collapsing operation (identical to decode; named for parity with the
    /// digital-qubit cell primitive's measure/cooperate pair).
    let measure (f: TriFloat) : Result<float, FloatFeedback> = decode f

    /// cooperate: engage WITHOUT collapsing -- identity, preserving every held (Tri.N) trit. The
    /// wonder-compression-safe operation at the number scope.
    let cooperate (f: TriFloat) : TriFloat = f

    /// True iff the float cannot be collapsed to a single number (any value or decoder trit is held).
    let isHeld (f: TriFloat) : bool =
        match decode f with
        | Ok _ -> false
        | Error _ -> true

    /// Construct a float directly from trit fields (tests / advanced use). The shape is inferred
    /// from the field lengths.
    let fromTrits (high: Tri list) (decoder: Tri list) (low: Tri list) : TriFloat =
        { Shape =
            { HighWidth = List.length high
              DecoderWidth = List.length decoder
              LowWidth = List.length low }
          High = high
          Decoder = decoder
          Low = low }

    /// fromValue (biased-exponent canonical encode): find a (mode, V) with
    /// `V * 2 ^ (mode - bias) = value`, V a non-negative integer that fits the value field and mode
    /// in the decoder field. Picks the SMALLEST mode that works (a canonical representation; the
    /// biased-exponent decoder has redundant representations, so a canonical choice is required).
    /// Surfaces a reason string when not representable. v0 is unsigned + finite. Round-trips with
    /// decode: `fromValue v shape |> Result.map decode` resolves back to Ok v. Bounds math uses
    /// int64 so wide shapes return feedback rather than overflowing to negative/incorrect bounds.
    let fromValue (value: float) (shape: FloatShape) : Result<TriFloat, string> =
        if System.Double.IsNaN value || System.Double.IsInfinity value || value < 0.0 then
            Error "v0 is unsigned + finite"
        else
            let valueBits = shape.HighWidth + shape.LowWidth
            let maxMode = if shape.DecoderWidth >= 62 then System.Int64.MaxValue else (1L <<< shape.DecoderWidth) - 1L
            let maxV = if valueBits >= 62 then System.Int64.MaxValue else pown 2L valueBits
            let bias = if shape.DecoderWidth >= 62 then System.Int64.MaxValue / 2L else pown 2L (shape.DecoderWidth - 1)

            if value = 0.0 then
                let bits = List.init valueBits (fun _ -> Tri.F)
                Ok { Shape = shape
                     High = bits |> List.take shape.HighWidth
                     Decoder = intToTrits 0L shape.DecoderWidth
                     Low = bits |> List.skip shape.HighWidth }
            else
                let log2v = System.Math.Log2 value
                let startMode = int64 (float bias - float valueBits + System.Math.Floor(log2v) - 2.0)
                let rec tryMode (mode: int64) =
                    if mode > maxMode then
                        Error(sprintf "no (mode,V) with mode<=%d and V<%d represents %g" maxMode maxV value)
                    else
                        let scaled = value / (2.0 ** float (mode - bias))
                        if scaled < 1.0 then
                            Error(sprintf "no (mode,V) with mode<=%d and V<%d represents %g" maxMode maxV value)
                        elif System.Double.IsInteger scaled && scaled >= 0.0 && scaled < float maxV then
                            let v = int64 scaled
                            let bits = intToTrits v valueBits
                            Ok { Shape = shape
                                 High = bits |> List.take shape.HighWidth
                                 Decoder = intToTrits mode shape.DecoderWidth
                                 Low = bits |> List.skip shape.HighWidth }
                        else
                            tryMode (mode + 1L)

                tryMode (max 0L startMode)
