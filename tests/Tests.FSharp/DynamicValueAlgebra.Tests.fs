module Zeta.Tests.DynamicValueAlgebraTests

open global.Xunit
open Zeta.Core

module A = Zeta.Core.DynamicValueAlgebra

let private i (n: int64) = DynamicValue.Int n
let private s (x: string) = DynamicValue.String x
let private obj kvs = DynamicValue.Object kvs

let private samples =
    [ DynamicValue.Null
      i 1L
      s "a"
      obj [ "x", i 1L ]
      obj [ "x", i 2L; "y", s "q" ]
      obj [ "y", s "r"; "z", obj [ "k", i 9L ] ] ]

let private m = A.mergeSemilattice

[<Fact>]
let ``merge monoid: identity is two-sided (Null)`` () =
    for v in samples do
        Assert.Equal<DynamicValue>(v, m.Combine(m.Identity, v))
        Assert.Equal<DynamicValue>(v, m.Combine(v, m.Identity))

[<Fact>]
let ``merge monoid: idempotent (join-semilattice)`` () =
    for v in samples do
        Assert.Equal<DynamicValue>(v, m.Combine(v, v))

[<Fact>]
let ``merge monoid: commutative`` () =
    for a in samples do
        for b in samples do
            Assert.Equal<DynamicValue>(m.Combine(a, b), m.Combine(b, a))

[<Fact>]
let ``merge monoid: associative`` () =
    for a in samples do
        for b in samples do
            for c in samples do
                Assert.Equal<DynamicValue>(m.Combine(m.Combine(a, b), c), m.Combine(a, m.Combine(b, c)))

[<Fact>]
let ``LWW register picks one whole value deterministically (Null is bottom)`` () =
    let a = obj [ "x", i 1L ]
    let b = obj [ "y", i 2L ]
    // combine yields one of the two inputs (max over content-hash), never a deep union
    let r = m.Combine(a, b)
    Assert.True(r.Equals a || r.Equals b)
    // Null is the identity / bottom
    Assert.Equal<DynamicValue>(a, m.Combine(DynamicValue.Null, a))

[<Fact>]
let ``mergeAll is order-independent (confluence over a stream)`` () =
    let xs = [ obj [ "a", i 1L ]; obj [ "b", i 2L ]; obj [ "a", i 1L ]; obj [ "c", s "z" ] ]
    let forward = A.mergeAll xs
    let reversed = A.mergeAll (List.rev xs)
    Assert.Equal<DynamicValue>(forward, reversed)

[<Fact>]
let ``fold over a monoid reduces from identity`` () =
    Assert.Equal<DynamicValue>(m.Identity, A.fold m []) // empty fold = Identity (Null)
    Assert.Equal<DynamicValue>(i 7L, A.fold m [ i 7L ]) // singleton
    Assert.Equal<DynamicValue>(i 7L, A.fold m [ i 7L; i 7L ]) // idempotent: duplicates collapse
