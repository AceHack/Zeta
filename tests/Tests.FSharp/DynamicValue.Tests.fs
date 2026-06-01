module Zeta.Tests.DynamicValueTests

open System.Collections.Immutable
open global.Xunit
open Zeta.Core

// DynamicValue — the F# canonical reference shape for the format-agnostic
// dynamic / self-describing-payload primitive. These tests fix the shape's
// behaviour (tag, lazy-bind accessors, structural equality incl. native Bytes,
// PropertyPath navigation) before the C#/Rust/TS oracles conform to it.

let private bytes (xs: byte list) : DynamicValue =
    DynamicValue.Bytes(ImmutableArray.CreateRange xs)

// Sample tree: { "a": { "b": [10, 20, 30], "n": null }, "flag": true }
let private sample : DynamicValue =
    DynamicValue.Object
        [ "a",
          DynamicValue.Object
              [ "b", DynamicValue.Array [ DynamicValue.Int 10L; DynamicValue.Int 20L; DynamicValue.Int 30L ]
                "n", DynamicValue.Null ]
          "flag", DynamicValue.Bool true ]

// -- typeOf (the QueryInterface tag) --

[<Fact>]
let ``typeOf reports each shape`` () =
    Assert.Equal(DynamicValueType.Null, DynamicValue.typeOf DynamicValue.Null)
    Assert.Equal(DynamicValueType.Bool, DynamicValue.typeOf (DynamicValue.Bool true))
    Assert.Equal(DynamicValueType.Int, DynamicValue.typeOf (DynamicValue.Int 1L))
    Assert.Equal(DynamicValueType.Float, DynamicValue.typeOf (DynamicValue.Float 1.0))
    Assert.Equal(DynamicValueType.String, DynamicValue.typeOf (DynamicValue.String "x"))
    Assert.Equal(DynamicValueType.Bytes, DynamicValue.typeOf (bytes [ 1uy ]))
    Assert.Equal(DynamicValueType.Array, DynamicValue.typeOf (DynamicValue.Array []))
    Assert.Equal(DynamicValueType.Object, DynamicValue.typeOf (DynamicValue.Object []))

[<Fact>]
let ``isNull only for Null`` () =
    Assert.True(DynamicValue.isNull DynamicValue.Null)
    Assert.False(DynamicValue.isNull (DynamicValue.Bool false))

// -- lazy bind accessors (strict; no widening) --

[<Fact>]
let ``try accessors bind matching shape and decline the rest`` () =
    Assert.Equal(Some true, DynamicValue.tryBool (DynamicValue.Bool true))
    Assert.Equal(None, DynamicValue.tryBool (DynamicValue.Int 1L))

    Assert.Equal(Some 7L, DynamicValue.tryInt (DynamicValue.Int 7L))
    Assert.Equal(None, DynamicValue.tryInt (DynamicValue.Float 7.0))

    Assert.Equal(Some 2.5, DynamicValue.tryFloat (DynamicValue.Float 2.5))
    Assert.Equal(None, DynamicValue.tryFloat (DynamicValue.Int 2L)) // strict: no widening

    Assert.Equal(Some "hi", DynamicValue.tryString (DynamicValue.String "hi"))
    Assert.Equal(None, DynamicValue.tryString DynamicValue.Null)

    Assert.True((DynamicValue.tryBytes (bytes [ 9uy ])).IsSome)
    Assert.Equal(None, DynamicValue.tryBytes (DynamicValue.String "9"))

    Assert.True((DynamicValue.tryArray (DynamicValue.Array [])).IsSome)
    Assert.Equal(None, DynamicValue.tryArray (DynamicValue.Object []))

    Assert.True((DynamicValue.tryObject (DynamicValue.Object [])).IsSome)
    Assert.Equal(None, DynamicValue.tryObject (DynamicValue.Array []))

[<Fact>]
let ``tryField and tryItem`` () =
    Assert.Equal(Some(DynamicValue.Bool true), DynamicValue.tryField "flag" sample)
    Assert.Equal(None, DynamicValue.tryField "missing" sample)
    Assert.Equal(None, DynamicValue.tryField "flag" (DynamicValue.Int 1L))

    let arr = DynamicValue.Array [ DynamicValue.Int 10L; DynamicValue.Int 20L ]
    Assert.Equal(Some(DynamicValue.Int 20L), DynamicValue.tryItem 1 arr)
    Assert.Equal(None, DynamicValue.tryItem 5 arr) // out of range
    Assert.Equal(None, DynamicValue.tryItem -1 arr) // negative
    Assert.Equal(None, DynamicValue.tryItem 0 (DynamicValue.Object [])) // not an array

// -- structural equality (hand-written; Bytes compares contents) --

[<Fact>]
let ``structural equality recurses`` () =
    let a =
        DynamicValue.Object [ "k", DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.String "x" ] ]

    let b =
        DynamicValue.Object [ "k", DynamicValue.Array [ DynamicValue.Int 1L; DynamicValue.String "x" ] ]

    Assert.Equal(a, b)
    Assert.Equal(a.GetHashCode(), b.GetHashCode())

[<Fact>]
let ``Bytes compare by content not reference`` () =
    // Two distinct ImmutableArray instances with identical bytes must be equal.
    let a = DynamicValue.Bytes(ImmutableArray.Create<byte>(1uy, 2uy, 3uy))
    let b = DynamicValue.Bytes(ImmutableArray.Create<byte>(1uy, 2uy, 3uy))
    Assert.Equal(a, b)
    Assert.Equal(a.GetHashCode(), b.GetHashCode())

    let c = DynamicValue.Bytes(ImmutableArray.Create<byte>(1uy, 2uy, 4uy))
    Assert.NotEqual(a, c)

[<Fact>]
let ``Object equality is order-sensitive`` () =
    let ab =
        DynamicValue.Object [ "a", DynamicValue.Int 1L; "b", DynamicValue.Int 2L ]

    let ba =
        DynamicValue.Object [ "b", DynamicValue.Int 2L; "a", DynamicValue.Int 1L ]

    // The value tree preserves insertion order; canonical encoders sort on the wire.
    Assert.NotEqual(ab, ba)

[<Fact>]
let ``different shapes are not equal`` () =
    Assert.NotEqual(DynamicValue.Int 1L, DynamicValue.Float 1.0)
    Assert.NotEqual(DynamicValue.String "1", DynamicValue.Int 1L)
    Assert.NotEqual(DynamicValue.Null, DynamicValue.Bool false)

// -- PropertyPath navigation --

[<Fact>]
let ``get navigates dotted and indexed paths`` () =
    Assert.Equal(Some(DynamicValue.Int 20L), DynamicValue.get "a.b[1]" sample)
    Assert.Equal(Some(DynamicValue.Bool true), DynamicValue.get "flag" sample)
    Assert.Equal(Some DynamicValue.Null, DynamicValue.get "a.n" sample)

[<Fact>]
let ``get returns the value itself for an empty path`` () =
    Assert.Equal(Some sample, DynamicValue.get "" sample)

[<Fact>]
let ``get declines miss, out-of-range, and type-mismatch`` () =
    Assert.Equal(None, DynamicValue.get "a.missing" sample) // key absent
    Assert.Equal(None, DynamicValue.get "a.b[9]" sample) // index out of range
    Assert.Equal(None, DynamicValue.get "flag.x" sample) // descend into a non-object

[<Fact>]
let ``get supports a bare leading index`` () =
    let arr = DynamicValue.Array [ DynamicValue.String "zero"; DynamicValue.String "one" ]
    Assert.Equal(Some(DynamicValue.String "one"), DynamicValue.get "[1]" arr)

[<Fact>]
let ``get declines malformed paths`` () =
    Assert.Equal(None, DynamicValue.get "a.b[" sample) // unterminated bracket
    Assert.Equal(None, DynamicValue.get "a.b[x]" sample) // non-digit index
    Assert.Equal(None, DynamicValue.get "a]b" sample) // stray close bracket
    Assert.Equal(None, DynamicValue.get "a.b[99999999999999999999]" sample) // index overflows Int32 -> None, not an exception

[<Fact>]
let ``get declines empty path segments`` () =
    Assert.Equal(None, DynamicValue.get ".flag" sample) // leading dot
    Assert.Equal(None, DynamicValue.get "a..b" sample) // doubled dot
    Assert.Equal(None, DynamicValue.get "a." sample) // trailing dot
    Assert.Equal(None, DynamicValue.get "." sample) // lone dot

[<Fact>]
let ``default ImmutableArray bytes behave as empty`` () =
    // A default (uninitialized) ImmutableArray must not poison equality/hashing/accessors —
    // it normalizes to the empty payload rather than throwing on enumeration.
    let d = DynamicValue.Bytes Unchecked.defaultof<ImmutableArray<byte>>
    let e = DynamicValue.Bytes ImmutableArray<byte>.Empty
    Assert.Equal(d, e)
    Assert.Equal(d.GetHashCode(), e.GetHashCode())
    Assert.True((DynamicValue.tryBytes d).Value.IsEmpty)
