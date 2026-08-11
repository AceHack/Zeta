using Xunit;
using Zeta.Core.CSharp.ZetaId;

namespace Zeta.Tests.CSharp.ZetaId;

/// <summary>
/// The V8-cycle cross-check, ported from Rust — because C# and F# did not have it.
///
/// <para><see cref="BitLayout.Create"/> has TWO independent construction paths,
/// <c>CreateTopDown</c> (the canonical authoring order, matching the human-readable layout spec) and
/// <c>CreateBottomUp</c>. They must produce identical field offsets; that redundancy IS the check, in
/// the same way the multi-oracle byte-lock is — two independent computations of one answer.</para>
///
/// <para>WHY THIS FILE EXISTS (2026-08-11). A mapping pass over the ZetaId bit layout found that only
/// RUST asserts the two paths agree (<c>src/Core.Rust.ZetaId/src/bit_layout.rs:200-203</c>). In C# and
/// F#, <c>BottomUp</c> appears in no test and no production call path — <c>Default</c> is
/// <c>TopDown</c> in both — so it is unreachable dead code. The consequence is a silent trap: a layout
/// edit applied to <c>CreateTopDown</c> and not to <c>CreateBottomUp</c> produces <b>no compile error
/// and no test failure</b>. The bottom-up path quietly retains the old field allocation and waits for
/// whoever next calls <c>Create(LayoutDirection.BottomUp)</c>.</para>
///
/// <para>TypeScript, Python and Go are not exposed — they build their layout once, directly from the
/// generated constants, so there is nothing to keep in sync.</para>
///
/// <para>This is a general safety net, not a one-off: it protects every future layout change, and it
/// was written <i>before</i> one — a bit-reclamation is under consideration — so the trap is closed
/// before the change that would spring it.</para>
/// </summary>
public class BitLayoutAgreementTests
{
    // NOTE — why there is no whole-object `Assert.Equal(td, bu)` here, unlike the F# sibling.
    //
    // `BitLayout` is a `sealed class` (BitLayout.cs:3) with no value-equality override, so
    // `Assert.Equal` on two instances compares REFERENCES. A first draft of this file asserted
    // whole-object equality and failed with two instances whose printed field values were
    // character-for-character identical — a false alarm that briefly looked like a real layout
    // divergence in production code.
    //
    // The F# sibling CAN compare whole records, because F# records get structural equality by
    // default and C# classes do not. Same intent, necessarily expressed differently per language —
    // which is itself the kind of cross-oracle asymmetry a byte-locked format has to stay careful
    // about. Field-by-field is the correct C# form, and it is complete: every field is compared.

    [Fact]
    public void TheTwoPathsAgreeFieldByField()
    {
        // A half-applied edit fails here rather than lying dormant until someone calls BottomUp,
        // and the failure names the field that drifted.
        var td = BitLayout.Create(LayoutDirection.TopDown);
        var bu = BitLayout.Create(LayoutDirection.BottomUp);

        Assert.Equal(td.Randomness, bu.Randomness);
        Assert.Equal(td.Location, bu.Location);
        Assert.Equal(td.Momentum, bu.Momentum);
        Assert.Equal(td.Persona, bu.Persona);
        Assert.Equal(td.Authority, bu.Authority);
        Assert.Equal(td.Category, bu.Category);
        Assert.Equal(td.Chromosome, bu.Chromosome);
        Assert.Equal(td.Timestamp, bu.Timestamp);
        Assert.Equal(td.Version, bu.Version);
    }
}
