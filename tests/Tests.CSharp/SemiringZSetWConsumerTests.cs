using System.Linq;
using Xunit;
using Zeta.Core;

namespace Zeta.Tests.CSharp;

/// <summary>
/// THE FIRST C# CONSUMER of the polymorphic Z-set / semiring surface
/// (081KWFXTHJY step 4 reframed — Aaron 2026-07-02: "sounds like a unit test
/// to me for now"). This test IS the consumer population, and after the Iris
/// event-storm (2026-07-02) it exercises the IMPROVED surface:
///
///  ✓ F1 (half): module functions are PascalCase via [CompiledName]
///    (`ZSetWModule.OfSeq`, `SchemaZModule.ApplyDelta`). The leaked `Module`
///    suffix remains — facade/generator territory (#9066, gated on the first
///    non-test consumer or NuGet publish per Iris's verdict).
///  ✓ F2: `ZSetWModule.OfValuePairs(ring, new[] { ("x", 2L) })` — ValueTuple
///    construction, no `System.Tuple.Create` ceremony.
///  ✓ F6: `SchemaZModule.Conflicts` returns the offending (field, weight)
///    payload, not just `WellFormed = false`.
///  ○ F3 (open): the struct-ring zero-overhead path is still not idiomatic
///    from C# — the pinned Roslyn-generation gap.
///  ○ F5 (open): semiring-vs-ring is still a runtime throw — the
///    IRing/ISemiring interface split is queued as its own reviewed change.
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
    public void CSharpBuildsSumsAndRetractsAPolymorphicZSetWithValueTuples()
    {
        ISemiring<long> ring = IntegerRingModule.Instance;
        var a = ZSetWModule.OfValuePairs(ring, new[] { ("x", 2L), ("y", 1L) });
        var b = ZSetWModule.OfValuePairs(ring, new[] { ("y", -1L), ("z", 5L) });

        var s = ZSetWModule.Sum(ring, a, b);
        Assert.Equal(2L, ZSetWModule.Lookup(ring, "x", s));
        Assert.Equal(0L, ZSetWModule.Lookup(ring, "y", s)); // 1 + (−1) consolidated away
        Assert.Equal(5L, ZSetWModule.Lookup(ring, "z", s));

        // retraction: a − a = ∅ (the ring axiom, exercised from C#)
        Assert.True(ZSetWModule.IsEmpty(ZSetWModule.Difference(ring, a, a)));
    }

    [Fact]
    public void CSharpFoldsSchemaDeltasAndRollsBackWithNegate()
    {
        var v1 = SchemaZModule.ApplyDelta(
            SchemaZModule.AddFieldDelta("id", DynamicValueType.Int),
            SchemaZModule.Empty);
        var rename = SchemaZModule.RenameFieldDelta("id", "user_id", DynamicValueType.Int);
        var v2 = SchemaZModule.ApplyDelta(rename, v1);

        Assert.True(SchemaZModule.WellFormed(v2));
        Assert.Equal(ExpectedRenamedFields, SchemaZModule.Fields(v2).Select(f => f.Name).ToArray());

        // rollback = the same delta, negated — ring algebra from C#
        var back = SchemaZModule.RollbackDelta(rename, v2);
        Assert.True(v1.Equals(back));
    }

    [Fact]
    public void ConflictsCarryThePayloadNotJustABool()
    {
        // two writers add the same field — the merge DETECTS it and names it
        var d = SchemaZModule.AddFieldDelta("status", DynamicValueType.String);
        var merged = SchemaZModule.ApplyDelta(d, SchemaZModule.ApplyDelta(d, SchemaZModule.Empty));

        Assert.False(SchemaZModule.WellFormed(merged));
        var conflict = Assert.Single(SchemaZModule.Conflicts(merged));
        Assert.Equal("status", conflict.Item1.Name);
        Assert.Equal(2L, conflict.Item2); // duplicate add ⇒ weight 2
    }
}
