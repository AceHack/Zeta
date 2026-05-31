using Xunit;
using Zeta.Core.CSharp.TriBoolean;
using static Zeta.Core.CSharp.TriBoolean.FloatOps;

namespace Zeta.Tests.CSharp.TriBoolean;

// C# parity oracle (#3 of four) for the biased-exponent tri-boolean float (B-0944 slice 5 pt2).
// Vectors mirror tests/Tests.FSharp/TriBoolean/Float.Tests.fs so four-of-four parity across
// TS/F#/C#/Rust IS the summonable-BFT ballot. Roslyn is the non-Byzantine oracle here.
// Shape 4/3/4 throughout: decoderWidth 3 -> bias 2^(3-1) = 4; valueBits 8 -> V in [0,256).
// decoded value = V * 2^(mode - 4).

public class FloatTests
{
    private static readonly Tri[] Zero4 = [Tri.F, Tri.F, Tri.F, Tri.F];

    private static TriFloat Mk(Tri[] high, Tri[] decoder, Tri[] low) => FromTrits(high, decoder, low);

    [Fact]
    public void DecodeModeEqualsBiasValueIsV()
    {
        // decoder 100 = mode 4 = bias -> exp 0; low 0101 -> V = 5 -> 5.0
        var f = Mk(Zero4, [Tri.T, Tri.F, Tri.F], [Tri.F, Tri.T, Tri.F, Tri.T]);
        Assert.Equal(new DecodeResult.Decoded(5.0), Decode(f));
    }

    [Fact]
    public void DecodeModeGreaterThanBiasTimesTwo()
    {
        // decoder 101 = mode 5 -> exp +1; low 0011 -> V = 3 -> 6.0
        var f = Mk(Zero4, [Tri.T, Tri.F, Tri.T], [Tri.F, Tri.F, Tri.T, Tri.T]);
        Assert.Equal(new DecodeResult.Decoded(6.0), Decode(f));
    }

    [Fact]
    public void DecodeModeLessThanBiasHalf()
    {
        // decoder 011 = mode 3 -> exp -1; low 1000 -> V = 8 -> 4.0
        var f = Mk(Zero4, [Tri.F, Tri.T, Tri.T], [Tri.T, Tri.F, Tri.F, Tri.F]);
        Assert.Equal(new DecodeResult.Decoded(4.0), Decode(f));
    }

    [Fact]
    public void DecodeModeLessThanBiasQuarter()
    {
        // decoder 010 = mode 2 -> exp -2; low 0100 -> V = 4 -> 1.0
        var f = Mk(Zero4, [Tri.F, Tri.T, Tri.F], [Tri.F, Tri.T, Tri.F, Tri.F]);
        Assert.Equal(new DecodeResult.Decoded(1.0), Decode(f));
    }

    [Fact]
    public void DecodeReadsHighThenLowAsOneV()
    {
        // high 0001, low 0000 -> V = 0b00010000 = 16; decoder 100 = mode 4 -> exp 0 -> 16.0
        var f = Mk([Tri.F, Tri.F, Tri.F, Tri.T], [Tri.T, Tri.F, Tri.F], Zero4);
        Assert.Equal(new DecodeResult.Decoded(16.0), Decode(f));
    }

    [Fact]
    public void NInDecoderIsInterpretationSuperposed()
    {
        var f = Mk(Zero4, [Tri.T, Tri.N, Tri.F], [Tri.F, Tri.T, Tri.F, Tri.T]);
        Assert.Equal(new DecodeResult.Held(FloatFeedback.InterpretationSuperposed), Decode(f));
    }

    [Fact]
    public void NInValueDecoderCertainIsValueSuperposed()
    {
        var f = Mk([Tri.F, Tri.F, Tri.F, Tri.N], [Tri.T, Tri.F, Tri.F], Zero4);
        Assert.Equal(new DecodeResult.Held(FloatFeedback.ValueSuperposed), Decode(f));
    }

    [Fact]
    public void DecoderReadFirstBothHeldIsInterpretationSuperposed()
    {
        // N in BOTH decoder and value -> InterpretationSuperposed dominates (decoder checked first).
        var f = Mk([Tri.N, Tri.F, Tri.F, Tri.F], [Tri.N, Tri.F, Tri.F], Zero4);
        Assert.Equal(new DecodeResult.Held(FloatFeedback.InterpretationSuperposed), Decode(f));
    }

    [Fact]
    public void MeasureEqualsDecode()
    {
        var f = Mk(Zero4, [Tri.T, Tri.F, Tri.F], [Tri.F, Tri.T, Tri.F, Tri.T]);
        Assert.Equal(Decode(f), Measure(f));
    }

    [Fact]
    public void CooperateIsIdentityAndPreservesHeldTrits()
    {
        var held = Mk([Tri.F, Tri.F, Tri.F, Tri.N], [Tri.N, Tri.F, Tri.F], Zero4);
        Assert.Equal(held, Cooperate(held));
    }

    [Fact]
    public void IsHeldTrueIffAnyValueOrDecoderTritIsHeld()
    {
        var certain = Mk(Zero4, [Tri.T, Tri.F, Tri.F], [Tri.F, Tri.T, Tri.F, Tri.T]);
        var held = Mk([Tri.F, Tri.F, Tri.F, Tri.N], [Tri.T, Tri.F, Tri.F], Zero4);
        Assert.False(IsHeld(certain));
        Assert.True(IsHeld(held));
    }

    [Fact]
    public void FromValueRoundTripsThroughDecode()
    {
        foreach (var v in new[] { 0.0, 1.0, 5.0, 6.0, 0.5, 8.0, 16.0 })
        {
            var encoded = Assert.IsType<EncodeResult.Encoded>(FromValue(v, FloatShape.Default));
            Assert.Equal(new DecodeResult.Decoded(v), Decode(encoded.Value));
        }
    }

    [Fact]
    public void FromValueNotRepresentableForNegativeAndNonDyadic()
    {
        Assert.IsType<EncodeResult.NotRepresentable>(FromValue(-1.0, FloatShape.Default));
        Assert.IsType<EncodeResult.NotRepresentable>(FromValue(0.1, FloatShape.Default)); // not dyadic
    }
}
