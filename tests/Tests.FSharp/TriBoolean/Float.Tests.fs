module Zeta.Tests.TriBooleanFloatTests

open global.Xunit
open Zeta.Core.FSharp.TriBoolean
open Zeta.Core.FSharp.TriBoolean.Float

// Tri-boolean float -- biased-exponent parity tests (081KSV2WD0008QG0R00051XS0N slice 5 pt2, F# oracle #2).
// Shape 4/3/4 throughout: decoderWidth = 3 -> bias = 2^(3-1) = 4; valueBits = 8 -> V in [0,256).
// decoded value = V * 2^(mode - 4). The TS distribution (decoders.ts, 'biased-exponent') uses the
// identical formula; these vectors decode to the same f64 the TS oracle produces (the BFT ballot).

/// Build the 4/3/4 reference float from high/decoder/low trit lists.
let private mk high decoder low : TriFloat = fromTrits high decoder low

[<Fact>]
let ``decode mode=bias (exp 0): value = V`` () =
    // decoder 100 = mode 4 = bias -> exp 0; low 0101 -> V = 5 -> 5.0
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.F ] [ Tri.T; Tri.F; Tri.F ] [ Tri.F; Tri.T; Tri.F; Tri.T ]
    Assert.Equal(Ok 5.0, decode f)

[<Fact>]
let ``decode mode>bias (exp +1): value = V * 2`` () =
    // decoder 101 = mode 5 -> exp 1; low 0011 -> V = 3 -> 6.0
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.F ] [ Tri.T; Tri.F; Tri.T ] [ Tri.F; Tri.F; Tri.T; Tri.T ]
    Assert.Equal(Ok 6.0, decode f)

[<Fact>]
let ``decode mode<bias (exp -1): value = V / 2`` () =
    // decoder 011 = mode 3 -> exp -1; low 1000 -> V = 8 -> 4.0
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.F ] [ Tri.F; Tri.T; Tri.T ] [ Tri.T; Tri.F; Tri.F; Tri.F ]
    Assert.Equal(Ok 4.0, decode f)

[<Fact>]
let ``decode mode<bias (exp -2): value = V / 4`` () =
    // decoder 010 = mode 2 -> exp -2; low 0100 -> V = 4 -> 1.0
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.F ] [ Tri.F; Tri.T; Tri.F ] [ Tri.F; Tri.T; Tri.F; Tri.F ]
    Assert.Equal(Ok 1.0, decode f)

[<Fact>]
let ``decode reads high ++ low MSB-first as one V`` () =
    // high 0001, low 0000 -> V = 0b00010000 = 16; decoder 100 = mode 4 -> exp 0 -> 16.0
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.T ] [ Tri.T; Tri.F; Tri.F ] [ Tri.F; Tri.F; Tri.F; Tri.F ]
    Assert.Equal(Ok 16.0, decode f)

[<Fact>]
let ``N in a decoder trit => InterpretationSuperposed`` () =
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.F ] [ Tri.T; Tri.N; Tri.F ] [ Tri.F; Tri.T; Tri.F; Tri.T ]
    Assert.Equal(Error FloatFeedback.InterpretationSuperposed, decode f)

[<Fact>]
let ``N in a value trit (decoder certain) => ValueSuperposed`` () =
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.N ] [ Tri.T; Tri.F; Tri.F ] [ Tri.F; Tri.F; Tri.F; Tri.F ]
    Assert.Equal(Error FloatFeedback.ValueSuperposed, decode f)

[<Fact>]
let ``decoder is read first: both held => InterpretationSuperposed`` () =
    // N in BOTH decoder and value -> InterpretationSuperposed dominates (decoder checked first).
    let f = mk [ Tri.N; Tri.F; Tri.F; Tri.F ] [ Tri.N; Tri.F; Tri.F ] [ Tri.F; Tri.F; Tri.F; Tri.F ]
    Assert.Equal(Error FloatFeedback.InterpretationSuperposed, decode f)

[<Fact>]
let ``measure equals decode`` () =
    let f = mk [ Tri.F; Tri.F; Tri.F; Tri.F ] [ Tri.T; Tri.F; Tri.F ] [ Tri.F; Tri.T; Tri.F; Tri.T ]
    Assert.Equal(decode f, measure f)

[<Fact>]
let ``cooperate is identity and preserves held trits`` () =
    let held = mk [ Tri.F; Tri.F; Tri.F; Tri.N ] [ Tri.N; Tri.F; Tri.F ] [ Tri.F; Tri.F; Tri.F; Tri.F ]
    Assert.Equal(held, cooperate held)

[<Fact>]
let ``isHeld is true iff any value or decoder trit is held`` () =
    let certain = mk [ Tri.F; Tri.F; Tri.F; Tri.F ] [ Tri.T; Tri.F; Tri.F ] [ Tri.F; Tri.T; Tri.F; Tri.T ]
    let held = mk [ Tri.F; Tri.F; Tri.F; Tri.N ] [ Tri.T; Tri.F; Tri.F ] [ Tri.F; Tri.F; Tri.F; Tri.F ]
    Assert.False(isHeld certain)
    Assert.True(isHeld held)

[<Fact>]
let ``fromValue round-trips through decode (biased-exponent)`` () =
    for v in [ 0.0; 1.0; 5.0; 6.0; 0.5; 8.0; 16.0 ] do
        match fromValue v defaultShape with
        | Ok f -> Assert.Equal(Ok v, decode f)
        | Error e -> Assert.True(false, sprintf "fromValue %g unexpectedly failed: %s" v e)

[<Fact>]
let ``fromValue surfaces feedback for negative + non-dyadic values`` () =
    Assert.True(fromValue -1.0 defaultShape |> Result.isError)
    Assert.True(fromValue 0.1 defaultShape |> Result.isError) // 0.1 is not a dyadic rational
