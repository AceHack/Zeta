using Xunit;
using Zeta.Core.CSharp.TriBoolean;
using static Zeta.Core.CSharp.TriBoolean.TriOps;

namespace Zeta.Tests.CSharp.TriBoolean;

// C# parity oracle (#3 of four) for the tri-boolean digital qubit (B-0944). These vectors
// mirror tests/Tests.FSharp/TriBoolean/TriBoolean.Tests.fs so that four-of-four parity across
// TS/F#/C#/Rust IS the summonable-BFT consensus. Roslyn is the non-Byzantine oracle here.

public class TriBooleanTests
{
    [Fact]
    public void CooperatePreservesNAndIsIdentityOnCertainCells()
    {
        Assert.Equal(Tri.N, Cooperate(Tri.N));
        Assert.Equal(Tri.T, Cooperate(Tri.T));
        Assert.Equal(Tri.F, Cooperate(Tri.F));
    }

    [Fact]
    public void MeasureResolvesCertainCellsLivingNSurfacesFeedback()
    {
        Assert.Equal(new MeasureResult.Resolved(true), Measure(Tri.T));
        Assert.Equal(new MeasureResult.Resolved(false), Measure(Tri.F));
        Assert.Equal(
            new MeasureResult.Collapsed(CollapseFeedback.CollapsedLivingUncertainty),
            Measure(Tri.N));
    }

    [Fact]
    public void NullMonadNPropagatesThroughMapAndBind()
    {
        Assert.Equal(Tri.N, MapTri(Tri.N, b => !b));
        Assert.Equal(Tri.F, MapTri(Tri.T, b => !b));
        Assert.Equal(Tri.N, BindTri(Tri.N, _ => Tri.T));
        Assert.Equal(Tri.F, BindTri(Tri.T, b => FromBool(!b)));
    }

    [Fact]
    public void KleeneNotKeepsUnknownUnknown()
    {
        Assert.Equal(Tri.F, NotTri(Tri.T));
        Assert.Equal(Tri.T, NotTri(Tri.F));
        Assert.Equal(Tri.N, NotTri(Tri.N));
    }

    [Fact]
    public void KleeneAndFDominatesNOnlyWhenNoF()
    {
        Assert.Equal(Tri.F, AndTri(Tri.F, Tri.N));
        Assert.Equal(Tri.N, AndTri(Tri.T, Tri.N));
        Assert.Equal(Tri.T, AndTri(Tri.T, Tri.T));
        Assert.Equal(Tri.F, AndTri(Tri.T, Tri.F));
    }

    [Fact]
    public void KleeneOrTDominatesNOnlyWhenNoT()
    {
        Assert.Equal(Tri.T, OrTri(Tri.T, Tri.N));
        Assert.Equal(Tri.N, OrTri(Tri.F, Tri.N));
        Assert.Equal(Tri.F, OrTri(Tri.F, Tri.F));
        Assert.Equal(Tri.T, OrTri(Tri.F, Tri.T));
    }

    [Fact]
    public void IsLivingAndIsCertainClassifyTheCell()
    {
        Assert.True(IsLiving(Tri.N));
        Assert.False(IsLiving(Tri.T));
        Assert.False(IsLiving(Tri.F));
        Assert.True(IsCertain(Tri.T));
        Assert.True(IsCertain(Tri.F));
        Assert.False(IsCertain(Tri.N));
    }

    [Fact]
    public void FromBoolAndEqRoundTrip()
    {
        Assert.Equal(Tri.T, FromBool(true));
        Assert.Equal(Tri.F, FromBool(false));
        Assert.True(Eq(Tri.T, FromBool(true)));
        Assert.True(Eq(Tri.N, Held()));
        Assert.False(Eq(Tri.T, Tri.N));
    }

    [Fact]
    public void NullCellsAreRejectedNotSilentlyClassified()
    {
        // C# null is NOT the held Tri.N state: a nullable-oblivious caller must not be able to
        // slip a missing cell through as a certain or dominant value (Codex P2 on #6168).
        Tri nul = null!;
        Assert.Throws<ArgumentNullException>(() => IsCertain(nul));
        Assert.Throws<ArgumentNullException>(() => IsLiving(nul));
        Assert.Throws<ArgumentNullException>(() => Cooperate(nul));
        Assert.Throws<ArgumentNullException>(() => Measure(nul));
        Assert.Throws<ArgumentNullException>(() => NotTri(nul));
        Assert.Throws<ArgumentNullException>(() => MapTri(nul, b => b));
        Assert.Throws<ArgumentNullException>(() => BindTri(nul, _ => Tri.T));
        Assert.Throws<ArgumentNullException>(() => AndTri(nul, Tri.T));
        Assert.Throws<ArgumentNullException>(() => OrTri(nul, Tri.F));
        Assert.Throws<ArgumentNullException>(() => Eq(nul, Tri.T));
    }

    [Fact]
    public void BindTriRejectsNullReturningContinuation()
    {
        // A nullable-oblivious continuation returning null must not manufacture an invalid cell
        // (Codex P2 on #6168, the fix-commit follow-up). Certain inputs reach the continuation;
        // a null result is surfaced loudly instead of returned.
        Func<bool, Tri> nullCont = _ => null!;
        Assert.Throws<InvalidOperationException>(() => BindTri(Tri.T, nullCont));
        Assert.Throws<InvalidOperationException>(() => BindTri(Tri.F, nullCont));
        // Tri.N short-circuits before the continuation runs -- no throw, stays held.
        Assert.Equal(Tri.N, BindTri(Tri.N, nullCont));
    }
}
