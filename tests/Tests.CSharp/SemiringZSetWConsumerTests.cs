using System.Linq;
using Xunit;
using Zeta.Core;

namespace Zeta.Tests.CSharp;

/// <summary>
/// THE FIRST C# CONSUMER of the polymorphic Z-set / semiring surface
/// (081KWFXTHJY step 4 reframed — Aaron 2026-07-02: "sounds like a unit test
/// to me for now"). This test IS the consumer population the Roslyn-generator
/// decision was waiting for: it exercises the ring dispatch from C# and pins
/// the ergonomics as they exist today. Every friction found here is INPUT to
/// the end-user event-storming review, and the shape of the code below is
/// what a future generated facade would improve on.
///
/// Ergonomic findings (the honest data, 2026-07-02):
///  F1. F# modules surface as static classes with a leaked `Module` suffix —
///      C# calls <c>ZSetWModule.ofSeq(...)</c>. (Facade opportunity.)
///  F2. F# tuple-seq parameters need explicit <c>System.Tuple.Create</c> at
///      the call site — no collection-initializer ergonomics.
///  F3. The boxed <c>ISemiring&lt;long&gt;</c> (<c>IntegerRingModule.Instance</c>)
///      is the natural C# entry; the STRUCT-ring zero-overhead path is not
///      idiomatically reachable from C# — precisely the gap Roslyn-generated
///      specialisations would close (the pinned #9066 dispatch decision).
///  F4. Analyzer culture differs: the F#-side test idiom (backtick names)
///      maps to underscore names in C#, which CA1707 rejects — C# tests read
///      as PascalCase sentences instead.
/// </summary>
public class SemiringZSetWConsumerTests
{
    private static readonly string[] ExpectedRenamedFields = ["user_id"];

    [Fact]
    public void CSharpCanDriveTheIntegerRingThroughISemiring()
    {
        ISemiring<long> ring = IntegerRingModule.Instance;
        Assert.Equal(0L, ring.Zero);
        Assert.Equal(1L, ring.One);
        Assert.Equal(7L, ring.Add(3L, 4L));
        Assert.Equal(12L, ring.Mul(3L, 4L));
        Assert.Equal(-3L, ring.Negate(3L));
    }

    [Fact]
    public void CSharpBuildsSumsAndRetractsAPolymorphicZSet()
    {
        ISemiring<long> ring = IntegerRingModule.Instance;
        var a = ZSetWModule.ofSeq(ring, new[]
        {
            System.Tuple.Create("x", 2L),
            System.Tuple.Create("y", 1L),
        });
        var b = ZSetWModule.ofSeq(ring, new[]
        {
            System.Tuple.Create("y", -1L),
            System.Tuple.Create("z", 5L),
        });

        var s = ZSetWModule.sum(ring, a, b);
        Assert.Equal(2L, ZSetWModule.lookup(ring, "x", s));
        Assert.Equal(0L, ZSetWModule.lookup(ring, "y", s)); // 1 + (−1) consolidated away
        Assert.Equal(5L, ZSetWModule.lookup(ring, "z", s));

        // retraction: a − a = ∅ (the ring axiom, exercised from C#)
        var empty = ZSetWModule.difference(ring, a, a);
        Assert.True(ZSetWModule.isEmpty(empty));
    }

    [Fact]
    public void CSharpFoldsSchemaDeltasAndRollsBackWithNegate()
    {
        // schema plane from C#: add a field, rename it, roll the rename back
        var v1 = SchemaZModule.applyDelta(
            SchemaZModule.addFieldDelta("id", DynamicValueType.Int),
            SchemaZModule.empty);
        var rename = SchemaZModule.renameFieldDelta("id", "user_id", DynamicValueType.Int);
        var v2 = SchemaZModule.applyDelta(rename, v1);

        Assert.True(SchemaZModule.wellFormed(v2));
        Assert.Equal(ExpectedRenamedFields, SchemaZModule.fields(v2).Select(f => f.Name).ToArray());

        // rollback = the same delta, negated — ring algebra from C#
        var back = SchemaZModule.rollbackDelta(rename, v2);
        Assert.True(v1.Equals(back));
    }
}
