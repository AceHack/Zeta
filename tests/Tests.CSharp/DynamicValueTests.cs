using System.Collections.Immutable;
using System.Linq;
using Xunit;
using Zeta.Core.CSharp;
using static Zeta.Core.CSharp.DynamicValues;

namespace Zeta.Tests.CSharp;

// DynamicValue — the C# oracle (#3 of TS/F#/C#/Rust). Mirrors the F# canonical-shape tests so the
// C# impl conforms to the same shape, lazy-bind accessors, structural equality (incl. native
// Bytes), and PropertyPath semantics. Accessors are on the DynamicValues static companion.
public class DynamicValueTests
{
    private static DynamicValue.Bytes Bytes(params byte[] xs) => new(ImmutableArray.Create(xs));

    private static DynamicValue.Array Arr(params DynamicValue[] xs) => new(ImmutableArray.Create(xs));

    private static DynamicValue.Object Obj(params (string Key, DynamicValue Value)[] kvs) =>
        new(kvs.Select(kv => new KeyValuePair<string, DynamicValue>(kv.Key, kv.Value)).ToImmutableArray());

    // { "a": { "b": [10, 20, 30], "n": null }, "flag": true }
    private static readonly DynamicValue Sample =
        Obj(
            ("a", Obj(
                ("b", Arr(new DynamicValue.Int(10L), new DynamicValue.Int(20L), new DynamicValue.Int(30L))),
                ("n", new DynamicValue.Null()))),
            ("flag", new DynamicValue.Bool(true)));

    [Fact]
    public void TypeOfReportsEachShape()
    {
        Assert.Equal(DynamicValueType.Null, new DynamicValue.Null().Type);
        Assert.Equal(DynamicValueType.Bool, new DynamicValue.Bool(true).Type);
        Assert.Equal(DynamicValueType.Int, new DynamicValue.Int(1L).Type);
        Assert.Equal(DynamicValueType.Float, new DynamicValue.Float(1.0).Type);
        Assert.Equal(DynamicValueType.String, new DynamicValue.String("x").Type);
        Assert.Equal(DynamicValueType.Bytes, Bytes(1).Type);
        Assert.Equal(DynamicValueType.Array, Arr().Type);
        Assert.Equal(DynamicValueType.Object, Obj().Type);
    }

    [Fact]
    public void IsNullOnlyForNull()
    {
        Assert.True(IsNull(new DynamicValue.Null()));
        Assert.False(IsNull(new DynamicValue.Bool(false)));
    }

    [Fact]
    public void TryAccessorsBindMatchingShapeAndDeclineTheRest()
    {
        Assert.True(TryBool(new DynamicValue.Bool(true))!.Value);
        Assert.Null(TryBool(new DynamicValue.Int(1L)));

        Assert.Equal(7L, TryInt(new DynamicValue.Int(7L))!.Value);
        Assert.Null(TryInt(new DynamicValue.Float(7.0)));

        Assert.Equal(2.5, TryFloat(new DynamicValue.Float(2.5))!.Value);
        Assert.Null(TryFloat(new DynamicValue.Int(2L))); // strict: no widening

        Assert.Equal("hi", TryString(new DynamicValue.String("hi")));
        Assert.Null(TryString(new DynamicValue.Null()));

        Assert.True(TryBytes(Bytes(9)).HasValue);
        Assert.False(TryBytes(new DynamicValue.String("9")).HasValue);

        Assert.True(TryArray(Arr()).HasValue);
        Assert.False(TryArray(Obj()).HasValue);

        Assert.True(TryObject(Obj()).HasValue);
        Assert.False(TryObject(Arr()).HasValue);
    }

    [Fact]
    public void TryFieldAndTryItem()
    {
        Assert.Equal(new DynamicValue.Bool(true), TryField(Sample, "flag"));
        Assert.Null(TryField(Sample, "missing"));
        Assert.Null(TryField(new DynamicValue.Int(1L), "flag"));

        var arr = Arr(new DynamicValue.Int(10L), new DynamicValue.Int(20L));
        Assert.Equal(new DynamicValue.Int(20L), TryItem(arr, 1));
        Assert.Null(TryItem(arr, 5)); // out of range
        Assert.Null(TryItem(arr, -1)); // negative
        Assert.Null(TryItem(Obj(), 0)); // not an array
    }

    [Fact]
    public void StructuralEqualityRecurses()
    {
        var a = Obj(("k", Arr(new DynamicValue.Int(1L), new DynamicValue.String("x"))));
        var b = Obj(("k", Arr(new DynamicValue.Int(1L), new DynamicValue.String("x"))));
        Assert.Equal(a, b);
        Assert.Equal(a.GetHashCode(), b.GetHashCode());
    }

    [Fact]
    public void BytesCompareByContentNotReference()
    {
        var a = new DynamicValue.Bytes(ImmutableArray.Create<byte>(1, 2, 3));
        var b = new DynamicValue.Bytes(ImmutableArray.Create<byte>(1, 2, 3));
        Assert.Equal(a, b);
        Assert.Equal(a.GetHashCode(), b.GetHashCode());

        var c = new DynamicValue.Bytes(ImmutableArray.Create<byte>(1, 2, 4));
        Assert.NotEqual(a, c);
    }

    [Fact]
    public void ObjectEqualityIsOrderSensitive()
    {
        var ab = Obj(("a", new DynamicValue.Int(1L)), ("b", new DynamicValue.Int(2L)));
        var ba = Obj(("b", new DynamicValue.Int(2L)), ("a", new DynamicValue.Int(1L)));
        Assert.NotEqual(ab, ba);
    }

    [Fact]
    public void DifferentShapesAreNotEqual()
    {
        Assert.NotEqual(new DynamicValue.Int(1L), (DynamicValue)new DynamicValue.Float(1.0));
        Assert.NotEqual(new DynamicValue.String("1"), (DynamicValue)new DynamicValue.Int(1L));
        Assert.NotEqual(new DynamicValue.Null(), (DynamicValue)new DynamicValue.Bool(false));
    }

    [Fact]
    public void GetNavigatesDottedAndIndexedPaths()
    {
        Assert.Equal(new DynamicValue.Int(20L), Get(Sample, "a.b[1]"));
        Assert.Equal(new DynamicValue.Bool(true), Get(Sample, "flag"));
        Assert.Equal(new DynamicValue.Null(), Get(Sample, "a.n"));
    }

    [Fact]
    public void GetReturnsTheValueItselfForAnEmptyPath()
    {
        Assert.Equal(Sample, Get(Sample, ""));
    }

    [Fact]
    public void GetDeclinesMissOutOfRangeAndTypeMismatch()
    {
        Assert.Null(Get(Sample, "a.missing")); // key absent
        Assert.Null(Get(Sample, "a.b[9]")); // index out of range
        Assert.Null(Get(Sample, "flag.x")); // descend into a non-object
    }

    [Fact]
    public void GetSupportsABareLeadingIndex()
    {
        var arr = Arr(new DynamicValue.String("zero"), new DynamicValue.String("one"));
        Assert.Equal(new DynamicValue.String("one"), Get(arr, "[1]"));
    }

    [Fact]
    public void GetDeclinesMalformedPaths()
    {
        Assert.Null(Get(Sample, "a.b[")); // unterminated bracket
        Assert.Null(Get(Sample, "a.b[x]")); // non-digit index
        Assert.Null(Get(Sample, "a]b")); // stray close bracket
        Assert.Null(Get(Sample, "a.b[99999999999999999999]")); // index overflows Int32 -> null, not an exception
    }

    [Fact]
    public void GetDeclinesEmptySegments()
    {
        Assert.Null(Get(Sample, ".flag")); // leading dot
        Assert.Null(Get(Sample, "a..b")); // doubled dot
        Assert.Null(Get(Sample, "a.")); // trailing dot
        Assert.Null(Get(Sample, ".")); // lone dot
    }

    [Fact]
    public void GetDeclinesNullPath()
    {
        Assert.Null(Get(Sample, null!)); // null path -> null, not a NullReferenceException
    }

    [Fact]
    public void DefaultImmutableArraysAreNormalizedToEmpty()
    {
        // A caller passing default(ImmutableArray<T>) must not poison equality/hashing/indexing —
        // the ctors normalize default -> empty, so these behave as the empty payloads.
        var bytes = new DynamicValue.Bytes(default);
        var arr = new DynamicValue.Array(default);
        var obj = new DynamicValue.Object(default);

        Assert.Equal(bytes, new DynamicValue.Bytes(ImmutableArray<byte>.Empty));
        Assert.Equal(bytes.GetHashCode(), new DynamicValue.Bytes(ImmutableArray<byte>.Empty).GetHashCode());
        Assert.Equal(arr, new DynamicValue.Array(ImmutableArray<DynamicValue>.Empty));
        Assert.Equal(obj, new DynamicValue.Object(ImmutableArray<KeyValuePair<string, DynamicValue>>.Empty));

        // and navigation/accessors over them don't throw
        Assert.Null(TryItem(arr, 0));
        Assert.Null(TryField(obj, "x"));
        Assert.True(TryBytes(bytes)!.Value.IsEmpty);
    }
}
