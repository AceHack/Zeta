module Zeta.Tests.StreamTableDualityTests

// ═══════════════════════════════════════════════════════════════════════
//  The stream/table duality is implemented TWICE in this repo, and the
//  deliverable of looking at both is a measurement, not a merge.
//
//    A. `ZSetStreamTable` — the value-level form of DBSP's
//       `Circuit.IntegrateZSet` / `DifferentiateZSet`.
//    B. `TableStream`     — the CLI's `stream`/`table` noun-classes, a
//       last-writer-wins fold over `Map<string, DynamicValue>`.
//
//  §THE SHARED LAW      both instances satisfy `ToTable (ToStream t) = t`.
//                       That law, and only that law, is what the shared
//                       `IStreamTableDuality` interface carries.
//  §THE DECLARED FLAGS  each instance DECLARES `FoldIsCommutative` and
//                       `TableDeterminesStream`. These tests measure the
//                       declarations against real behaviour, so a flag
//                       cannot drift into decoration. This is the section
//                       that proves the two are genuinely different rather
//                       than asserting it.
//  §WHAT ONLY A HAS     `integrate`/`differentiate` are mutually inverse.
//                       `TableStream` has no analogue, because its table
//                       is a snapshot with no previous value to subtract.
//
//  Anchors: Budiu et al., DBSP (VLDB 2023); Kreps, "The Log" (2013);
//  Shapiro et al., CRDTs (SSS 2011) — see `StreamTableDuality.fs`.
// ═══════════════════════════════════════════════════════════════════════

open Xunit
open Zeta.Core

// ── fixtures ─────────────────────────────────────────────────────────

let private zsetDuality = ZSetStreamTable.duality<int>
let private tableDuality = TableStream.duality

let private zDeltas: ZSet<int> list =
    [ ZSet.ofSeq [ 1, 1L; 2, 3L ]
      ZSet.ofSeq [ 2, -1L; 3, 5L ]
      ZSet.ofSeq [ 1, -1L ] ]

let private tDeltas: TableStream.Stream =
    [ TableStream.Upsert("a", DynamicValue.Int 1L)
      TableStream.Upsert("b", DynamicValue.Int 2L)
      TableStream.Upsert("a", DynamicValue.Int 9L) ]

// ═══ THE SHARED LAW ══════════════════════════════════════════════════

[<Fact>]
let ``A - ToTable (ToStream t) = t`` () =
    // HONEST LIMIT, stated so this is not read as stronger than it is:
    // instance A's `ToStream` returns a ONE-element list, so `ToTable` of
    // it hits `ZSet.sum`'s `| 1 -> arr.[0]` early return. The law holds
    // STRUCTURALLY for A rather than because a fold was exercised — this
    // test pins the law, it does not exercise the summation.
    //
    // The summation is exercised by `A declares FoldIsCommutative …`
    // (3 deltas through `ZSet.sum`) and by the tick-by-tick comparison
    // against `Circuit.IntegrateZSet` below. Those are where A's fold is
    // actually measured.
    let table = zsetDuality.ToTable zDeltas
    Assert.False(ZSet.isEmpty table, "non-vacuity: the fixture must fold to something")
    Assert.Equal<ZSet<int>>(table, zsetDuality.ToTable(zsetDuality.ToStream table))

[<Fact>]
let ``B - ToTable (ToStream t) = t`` () =
    let table = tableDuality.ToTable tDeltas
    Assert.NotEmpty table
    Assert.Equal<TableStream.Table>(table, tableDuality.ToTable(tableDuality.ToStream table))

// ═══ THE DECLARED FLAGS ══════════════════════════════════════════════
//
//  Each pair below measures one declared flag against the instance's
//  actual behaviour. Flipping a declaration in the source without
//  changing the implementation fails here.

let private permuted (xs: 'a list) : 'a list = List.rev xs

[<Fact>]
let ``A declares FoldIsCommutative and the fold IS commutative`` () =
    Assert.True(zsetDuality.FoldIsCommutative)
    // `ZSet.add` is an abelian group operation, so the total does not read
    // the order the deltas arrived in.
    Assert.Equal<ZSet<int>>(zsetDuality.ToTable zDeltas, zsetDuality.ToTable(permuted zDeltas))

[<Fact>]
let ``B declares NOT FoldIsCommutative and the fold really is order-dependent`` () =
    Assert.False(tableDuality.FoldIsCommutative)

    // The worked counter-example from `TableStream.duality`'s docstring.
    // This is the discriminating measurement between the two instances: if
    // it ever starts passing as an equality, `TableStream`'s fold has
    // become commutative and its declaration is wrong.
    let forward = [ TableStream.Upsert("k", DynamicValue.Int 1L); TableStream.Retract "k" ]
    let backward = permuted forward

    Assert.Empty(tableDuality.ToTable forward)
    Assert.NotEmpty(tableDuality.ToTable backward)
    Assert.NotEqual<TableStream.Table>(tableDuality.ToTable forward, tableDuality.ToTable backward)

[<Fact>]
let ``A declares NOT TableDeterminesStream and a snapshot really does forget`` () =
    Assert.False(zsetDuality.TableDeterminesStream)
    // Three deltas collapse to one total, so re-emitting the total cannot
    // return the three. Saying so is the honest reading: the Z-set pair is
    // invertible in its RUNNING-INTEGRAL form, not at snapshot level.
    Assert.NotEqual<ZSet<int> list>(zDeltas, zsetDuality.ToStream(zsetDuality.ToTable zDeltas))

[<Fact>]
let ``B declares NOT TableDeterminesStream and the history really is gone`` () =
    Assert.False(tableDuality.TableDeterminesStream)
    // `a` was upserted twice; the snapshot keeps only the last value, so
    // the changelog it re-emits is shorter than the one that produced it.
    let roundTripped = tableDuality.ToStream(tableDuality.ToTable tDeltas)
    Assert.NotEqual<TableStream.Stream>(tDeltas, roundTripped)
    Assert.Equal(2, List.length roundTripped)

[<Fact>]
let ``the two instances are DIFFERENT - measured on behaviour, not on the declared flags`` () =
    // An earlier version of this test asserted
    //   Assert.NotEqual(zsetDuality.FoldIsCommutative, tableDuality.FoldIsCommutative)
    // which compares two LITERALS declared in source against each other.
    // It would have passed with both implementations swapped for stubs. A
    // test that reads only declarations measures nothing, and it sat under
    // a header claiming to prove the instances differ.
    //
    // Measured instead: run the SAME structural experiment — a
    // "put then remove" pair, and its reverse — through both folds, and
    // demand that one is order-insensitive and the other is not.
    let zForward = [ ZSet.ofSeq [ 1, 1L ]; ZSet.ofSeq [ 1, -1L ] ]
    let zBackward = List.rev zForward
    let tForward = [ TableStream.Upsert("k", DynamicValue.Int 1L); TableStream.Retract "k" ]
    let tBackward = List.rev tForward

    // A: same answer either way.
    Assert.Equal<ZSet<int>>(zsetDuality.ToTable zForward, zsetDuality.ToTable zBackward)
    // B: different answer.
    Assert.NotEqual<TableStream.Table>(tableDuality.ToTable tForward, tableDuality.ToTable tBackward)

    // Only now is comparing the declarations meaningful — the lines above
    // are what earn them.
    Assert.NotEqual(zsetDuality.FoldIsCommutative, tableDuality.FoldIsCommutative)
    Assert.NotEqual<string>(zsetDuality.DualityName, tableDuality.DualityName)

// ═══ WHAT ONLY A HAS ═════════════════════════════════════════════════

[<Fact>]
let ``A - differentiate and integrate are mutually inverse (DBSP's D and I)`` () =
    Assert.Equal<ZSet<int> list>(zDeltas, ZSetStreamTable.differentiate (ZSetStreamTable.integrate zDeltas))

    let integrals = ZSetStreamTable.integrate zDeltas
    Assert.Equal<ZSet<int> list>(integrals, ZSetStreamTable.integrate (ZSetStreamTable.differentiate integrals))

[<Fact>]
let ``A - the value-level integrate agrees with Circuit.IntegrateZSet tick by tick`` () =
    // The extracted pure function must be the same thing the circuit
    // operator computes, or `ZSetStreamTable` is a third implementation
    // rather than the value-level statement of an existing one.
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let integrated = c.IntegrateZSet input.Stream
    let out = c.Output integrated

    let observed =
        [ for d in zDeltas do
            input.Send d
            c.Step()
            yield out.Current ]

    Assert.Equal<ZSet<int> list>(ZSetStreamTable.integrate zDeltas, observed)

[<Fact>]
let ``A - the running-integral form retains what the snapshot form loses`` () =
    // Restates the header table as a measurement: invertible at the
    // running-integral level, not invertible at the snapshot level. That
    // difference is exactly why `TableDeterminesStream` is declared false
    // on the snapshot instance rather than borrowed from D∘I=id.
    Assert.Equal<ZSet<int> list>(zDeltas, ZSetStreamTable.differentiate (ZSetStreamTable.integrate zDeltas))
    Assert.NotEqual<ZSet<int> list>(zDeltas, ZSetStreamTable.toStream (ZSetStreamTable.toTable zDeltas))
