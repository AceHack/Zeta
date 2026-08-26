module Zeta.Tests.ZetaSqlBuilderTests

// ═══════════════════════════════════════════════════════════════════════
//  `zeta { }` — the typed eager CE.
//
//  §BEHAVIOUR   the two tests that were already here, unchanged in intent.
//  §THE INVARIANT  the falsifiers for the defect the private evaluator had.
//                  Every test in this section FAILS against the previous
//                  implementation, which is what makes them falsifiers
//                  rather than descriptions.
//  §CROSS-SURFACE  `zeta { }` and `QuerySurface`'s `ToyEager` must return
//                  the same Z-set for the same query. That equality is the
//                  deliverable of the unification: two front ends, one
//                  operator algebra.
// ═══════════════════════════════════════════════════════════════════════

open Xunit
open Zeta.Core
open Zeta.Core.Sql
open Zeta.Core.QuerySurface

type User = { Id: int64; Name: string }
type Order = { Id: int64; UserId: int64; Amount: float }

// ═══ BEHAVIOUR ═══════════════════════════════════════════════════════

[<Fact>]
let ``ZetaQueryBuilder selection filters Z-set`` () =
    let users = Relation.ofKeys [ { Id = 1L; Name = "Alice" }; { Id = 2L; Name = "Bob" } ]

    let query =
        zeta {
            for u in users do
                where (u.Id = 1L)
                select u
        }

    Assert.Equal<ZSet<User>>(ZSet.ofKeys [ { Id = 1L; Name = "Alice" } ], query.Stream)

[<Fact>]
let ``ZetaQueryBuilder join aggregates keys and weights`` () =
    let users = Relation.ofKeys [ { Id = 1L; Name = "Alice" }; { Id = 2L; Name = "Bob" } ]

    let orders =
        Relation.ofSeq
            [ { Id = 100L; UserId = 1L; Amount = 50.0 }, 1L
              { Id = 101L; UserId = 1L; Amount = 150.0 }, 2L ]

    let query =
        zeta.Join(users, orders, (fun u -> u.Id), (fun o -> o.UserId), (fun u o -> (u.Name, o.Amount)))

    let expected = ZSet.ofSeq [ ("Alice", 50.0), 1L; ("Alice", 150.0), 2L ]
    Assert.Equal<ZSet<string * float>>(expected, query.Stream)

// ═══ THE INVARIANT ═══════════════════════════════════════════════════
//
//  `ZSet`'s array constructor is documented as: "Construct from an
//  already-sorted-by-key, nonzero-weighted run. Callers are responsible
//  for the invariant; use `ZSet.ofSeq` for arbitrary input."
//
//  The previous `zeta { }` built its results with `Seq.map` / `Seq.filter`
//  / `Seq.groupBy` + `Map.ofSeq` and handed the raw array straight to that
//  constructor. Every test below fails against that version.

type Row = { Group: string; Value: int64 }

[<Fact>]
let ``select CONSOLIDATES a non-injective projection - weights sum`` () =
    // Two distinct rows, one projected key. Z-set algebra says the weights
    // add. The old evaluator emitted two separate entries for the same key,
    // which is not a Z-set at all.
    let rows = Relation.ofKeys [ { Group = "a"; Value = 1L }; { Group = "a"; Value = 2L } ]

    let q = zeta { for r in rows do select r.Group }

    Assert.Equal(1, q.Stream.Count)
    Assert.Equal(2L, q.Stream.["a"])

[<Fact>]
let ``select DROPS entries whose weights cancel to zero`` () =
    // +1 and -1 onto the same projected key is the empty Z-set, not two
    // entries that happen to sum to nothing.
    let rows =
        Relation.ofSeq [ { Group = "a"; Value = 1L }, 1L; { Group = "a"; Value = 2L }, -1L ]

    let q = zeta { for r in rows do select r.Group }

    Assert.True(ZSet.isEmpty q.Stream)

[<Fact>]
let ``select leaves the result SORTED so binary-search lookup finds every key`` () =
    // The user-visible symptom of the dropped invariant. `ZSet.Item`
    // binary-searches; over an unsorted run it reports 0 for a key that is
    // present. Negating the key reverses the order, so input order and key
    // order disagree.
    let rows = Relation.ofKeys [ { Group = "a"; Value = 1L }; { Group = "b"; Value = 2L } ]

    let q = zeta { for r in rows do select -r.Value }

    Assert.Equal(1L, q.Stream.[-2L])
    Assert.Equal(1L, q.Stream.[-1L])

[<Fact>]
let ``join CONSOLIDATES rows that collapse onto one output key`` () =
    let users = Relation.ofKeys [ { Id = 1L; Name = "Alice" } ]

    let orders =
        Relation.ofKeys
            [ { Id = 100L; UserId = 1L; Amount = 50.0 }
              { Id = 101L; UserId = 1L; Amount = 50.0 } ]

    // The projector keeps only the name, so both joined pairs land on the
    // same output row.
    let q = zeta.Join(users, orders, (fun u -> u.Id), (fun o -> o.UserId), (fun u _ -> u.Name))

    Assert.Equal(1, q.Stream.Count)
    Assert.Equal(2L, q.Stream.["Alice"])

[<Fact>]
let ``for CONSOLIDATES and scales weights through the bind`` () =
    // `For` is `ZSet.flatMap`: each inner Z-set is scaled by the outer
    // entry's weight and summed. The old version multiplied into a flat
    // ResizeArray and never consolidated.
    let outer = Relation.ofSeq [ { Group = "a"; Value = 1L }, 3L; { Group = "b"; Value = 2L }, 5L ]

    let q = zeta { for r in outer do yield r.Group.Length }

    // Both groups have length 1, so one key at weight 3 + 5.
    Assert.Equal(1, q.Stream.Count)
    Assert.Equal(8L, q.Stream.[1])

// ═══ THE INHERITED LIMIT ═════════════════════════════════════════════
//
//  Delegating to `ZSet.join` is right — the deleted implementation
//  produced non-Z-sets — but it is not free. `ZSet.join` sizes its output
//  buffer at |left| × |right| rather than by actual matches, and REFUSES
//  outright when that product exceeds `Array.MaxLength`, however selective
//  the key is. The deleted `ResizeArray` version completed on such inputs.
//
//  This is a pre-existing defect in `ZSet.join` that `Circuit.Join` has
//  always had; `zeta { }` now inherits it. It is pinned here rather than
//  left latent, because a boundary nobody has walked up to is a boundary
//  that gets discovered in production.
//
//  AND THE REFUSAL IS NOT THE OPERATIVE BOUNDARY. Walking up to it found
//  that out. The first version of the non-vacuity test below asserted that
//  one row fewer on each side completes — 46_340² = 2_147_395_600, just
//  under `Array.MaxLength`. It does not complete. `Pool.Rent` is asked for
//  2 147 395 600 × `sizeof<ZEntry<int64>>` = **32 GiB** in one contiguous
//  block and throws `OutOfMemoryException` on both `ubuntu-24.04` and
//  `ubuntu-24.04-arm`, identically and deterministically — not a flake, and
//  not something a bigger runner fixes at any size that matters.
//
//  So the disclosed limit ("refuses above `Array.MaxLength`") UNDERSTATES
//  the real one. Memory binds first, and it binds ~32 GiB earlier. The
//  `invalidOp` guard is the boundary you are TOLD about; allocation is the
//  boundary you actually hit. Every product large enough to be interesting
//  is unusable well before the guard ever fires.
//
//  That gap is why the non-vacuity witness below no longer straddles the
//  threshold. Exact-boundary success is not merely expensive to test, it is
//  UNTESTABLE BY CONSTRUCTION while the implementation reserves the whole
//  product: any product just under `Array.MaxLength` is by definition a
//  ~32 GiB reservation. The witness proves the same claim — the refusal is
//  keyed on the product, not on input size — by holding the refused input
//  fixed and shrinking the other side instead.

[<Fact>]
let ``join REFUSES inputs whose CARTESIAN size exceeds Array.MaxLength - even when the result is tiny`` () =
    // 46_341² = 2_147_485_881 > Array.MaxLength = 2_147_483_591.
    let n = 46341L
    let left = Relation.ofKeys [ 1L .. n ]
    let right = Relation.ofKeys [ 1L .. n ]

    // Each key matches exactly ONE key on the other side, so the true
    // result is n rows — five orders of magnitude smaller than the buffer
    // `ZSet.join` reserves for it. It refuses anyway. That gap between
    // "what the answer is" and "what the implementation reserves" is the
    // whole finding.
    let ex =
        Assert.Throws<System.InvalidOperationException>(fun () ->
            zeta.Join(left, right, (fun (x: int64) -> x), (fun (x: int64) -> x), (fun a b -> a + b))
            |> ignore)

    Assert.Contains("Array.MaxLength", ex.Message, System.StringComparison.Ordinal)

[<Fact>]
let ``join SUCCEEDS on the very input that was refused - the refusal is about the PRODUCT, not about size`` () =
    // Non-vacuity for the test above. Without a witness, the refusal test
    // would pass just as well if `zeta.Join` threw on every large input for
    // some unrelated reason — a throw that cannot be made NOT to happen
    // proves nothing about what causes it.
    //
    // The witness holds the LEFT relation at exactly the 46_341 rows that
    // were refused above and shrinks only the RIGHT one. The refused input
    // is therefore unchanged, byte for byte, while the product collapses
    // from 2_147_488_281 to 92_682. It completes — so what the guard reads
    // is |left| × |right|, and neither side's size on its own.
    //
    // This discriminates strictly better than straddling the threshold did:
    // "46_340² succeeds" would leave "large inputs throw" and "large
    // PRODUCTS throw" still confounded, because both sides shrank together.
    // Here only one moves.
    let n = 46341L
    let left = Relation.ofKeys [ 1L .. n ]
    let right = Relation.ofKeys [ 1L; 2L ]

    let q = zeta.Join(left, right, (fun (x: int64) -> x), (fun (x: int64) -> x), (fun a b -> a + b))
    // Keys 1 and 2 match; the projector maps them to 1+1=2 and 2+2=4, two
    // distinct output keys. Every other left row finds no partner.
    Assert.Equal(2, q.Stream.Count)

// ═══ CROSS-SURFACE ═══════════════════════════════════════════════════
//
//  The unification deliverable. `zeta { }` is a TYPED front end with F#
//  lambdas; `QuerySurface`'s `zquery`/`ToyPlan` is an ERASED, closure-free
//  one. The two IRs are deliberately not merged — closure-freedom is what
//  makes `QuerySurface`'s plan-equality falsifier real, and a typed lambda
//  cannot be lowered into a `ToyScalar` without quotation splitting.
//
//  What IS shared is everything below the IR: the same `ZSet.filter` /
//  `ZSet.map` / `ZSet.join` primitives, reached through
//  `ToyExecutionMode.Eager`. This test is what holds that claim to
//  account. The predicate and projection below are written by hand as F#
//  lambdas, INDEPENDENTLY of the `ToyScalar` combinators the plan uses —
//  if they were derived from `ToyOps`, the agreement would be trivial.

let private orderRow (id: int64) (cust: int64) (amount: int64) : ToyRow =
    { Cells =
        Map.ofList
            [ "orders.Id", ToyValue.VInt id
              "orders.Cust", ToyValue.VInt cust
              "orders.Amount", ToyValue.VInt amount ] }

let private fixtureRows =
    [ orderRow 1L 10L 150L; orderRow 2L 10L 50L; orderRow 3L 20L 900L; orderRow 4L 20L 150L ]

[<Fact>]
let ``zeta CE and QuerySurface Eager agree on the same query`` () =
    // WHERE orders.Amount > 100 SELECT orders.Cust
    // — a projection that drops the discriminating columns, so it is
    // non-injective and consolidation decides the answer.

    // Surface 1: the typed CE, hand-written lambdas.
    let viaZeta =
        let rel = Relation.ofKeys fixtureRows
        zeta {
            for r in rel do
                where (
                    match r.["orders", "Amount"] with
                    | ToyValue.VInt a -> a > 100L
                    | _ -> false)
                select { Cells = Map.ofList [ "Cust", r.["orders", "Cust"] ] }
        }

    // Surface 2: the erased, closure-free plan, evaluated eagerly.
    let plan =
        zquery (ToyPlan.Source("orders", [ "Id"; "Cust"; "Amount" ])) {
            where (ToyScalar.col "orders" "Amount" .>. ToyScalar.int64Lit 100L)
            select [ "Cust", ToyScalar.col "orders" "Cust" ]
        }
    let viaPlan = ToyEager.run (Map.ofList [ "orders", ZSet.ofKeys fixtureRows ]) plan

    Assert.Equal<ZSet<ToyRow>>(viaPlan, viaZeta.Stream)

    // Non-vacuity, and it pins the consolidation. Orders 1 (cust 10),
    // 3 (cust 20) and 4 (cust 20) survive `Amount > 100`; projecting away
    // Id and Amount collapses 3 and 4 onto ONE row. So the answer is TWO
    // entries carrying THREE units of weight — not three entries, which is
    // what an unconsolidated projection would have produced.
    Assert.False(ZSet.isEmpty viaPlan)
    Assert.Equal(2, viaPlan.Count)
    Assert.Equal(3L, ZSet.weightedCount viaPlan)

[<Fact>]
let ``the cross-surface agreement is not vacuous - a drifted predicate disagrees`` () =
    let viaZeta =
        let rel = Relation.ofKeys fixtureRows
        zeta {
            for r in rel do
                where (
                    match r.["orders", "Amount"] with
                    | ToyValue.VInt a -> a > 999L // drifted
                    | _ -> false)
                select { Cells = Map.ofList [ "Cust", r.["orders", "Cust"] ] }
        }

    let plan =
        zquery (ToyPlan.Source("orders", [ "Id"; "Cust"; "Amount" ])) {
            where (ToyScalar.col "orders" "Amount" .>. ToyScalar.int64Lit 100L)
            select [ "Cust", ToyScalar.col "orders" "Cust" ]
        }
    let viaPlan = ToyEager.run (Map.ofList [ "orders", ZSet.ofKeys fixtureRows ]) plan

    Assert.NotEqual<ZSet<ToyRow>>(viaPlan, viaZeta.Stream)
