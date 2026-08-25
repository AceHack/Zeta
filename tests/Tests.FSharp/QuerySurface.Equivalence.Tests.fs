module Zeta.Tests.QuerySurfaceEquivalenceTests

// ═══════════════════════════════════════════════════════════════════════
//  The falsifier for "two front ends, one plan" — and for
//  "one surface, two execution modes".
//
//  Three distinct claims are pinned here, and each would be vacuous
//  without the others:
//
//   1. PLAN EQUIVALENCE — the F# CE canonicalizes to the SAME text as the
//      shared golden vector that the C# LINQ tests also check
//      (tests/Core.CSharp.Tests/QuerySurfaceLinqTests.cs). Neither test
//      holds a private copy of the expected string; both read
//      tests/_golden/query-surface-plans.json. So a drift in either front
//      end fails against one shared artifact.
//
//   2. MODE EQUIVALENCE — batch(R) == Σ_t streaming(ΔR_t). This is DBSP's
//      `Q^Δ = D ∘ Q ∘ I` (Budiu et al., VLDB 2023) as a test, and it is
//      what earns the claim that the SQL surface and the subscription
//      surface are one surface rather than two.
//
//   3. THE NEGATIVE CONTROL — a stream-table join is NOT retroactive, so
//      claim 2 FAILS for it when the table arrives late. Without this
//      test, `AsTable`'s documented caveat would be decoration. With it,
//      the caveat is measured.
//
//  Claim 2 is the one that can silently break: feeding deltas to the
//  BATCH join operator returns a wrong answer rather than an error.
// ═══════════════════════════════════════════════════════════════════════

open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core
open Zeta.Core.QuerySurface

// ── shared golden vector ─────────────────────────────────────────────

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(typeof<Zeta.Core.ZSet<int>>.Assembly.Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

/// Read one canonical plan from the SHARED golden file — the same file the
/// C# LINQ tests read. Joining the JSON string array with '\n' is how a
/// multi-line canonical form stays diffable in git.
let private goldenCanonical (name: string) : string =
    let path = Path.Join(repoRoot (), "tests", "_golden", "query-surface-plans.json")
    Assert.True(File.Exists path, $"golden vector not found: {path}")
    use doc = JsonDocument.Parse(File.ReadAllText path)
    let lines =
        doc.RootElement.GetProperty("vectors").GetProperty(name).GetProperty("canonical").EnumerateArray()
        |> Seq.map (fun e -> e.GetString())
    System.String.Join("\n", lines)

// ── the queries, written in the F# CE ────────────────────────────────

let private orders = ToyPlan.Source("orders", [ "Id"; "Cust"; "Amount" ])
let private customers = ToyPlan.Source("customers", [ "Id"; "Name" ])

/// SELECT c.Name, o.Amount
/// FROM orders o JOIN customers c ON o.Cust = c.Id
/// WHERE o.Amount > 100
let private filterProjectJoinPlan : ToyPlan =
    zquery orders {
        join customers (ToyScalar.col "orders" "Cust") (ToyScalar.col "customers" "Id")
        where (ToyScalar.col "orders" "Amount" .>. ToyScalar.int64Lit 100L)
        select [ "Name", ToyScalar.col "customers" "Name"
                 "Amount", ToyScalar.col "orders" "Amount" ]
    }

/// The same join, but the right side is a materialized TABLE.
let private streamTableJoinPlan : ToyPlan =
    zquery orders {
        join (ToyPlan.AsTable customers) (ToyScalar.col "orders" "Cust") (ToyScalar.col "customers" "Id")
        select [ "Name", ToyScalar.col "customers" "Name"
                 "Amount", ToyScalar.col "orders" "Amount" ]
    }

/// SELECT c.Name, o.Amount FROM orders o JOIN customers c ON o.Cust = c.Id
/// (no WHERE — the shape C# fuses into the join's own result selector)
let private joinProjectPlan : ToyPlan =
    zquery orders {
        join customers (ToyScalar.col "orders" "Cust") (ToyScalar.col "customers" "Id")
        select [ "Name", ToyScalar.col "customers" "Name"
                 "Amount", ToyScalar.col "orders" "Amount" ]
    }

// ── row helpers ──────────────────────────────────────────────────────

let private order (id: int64) (cust: int64) (amount: int64) : ToyRow =
    { Cells =
        Map.ofList
            [ "orders.Id", ToyValue.VInt id
              "orders.Cust", ToyValue.VInt cust
              "orders.Amount", ToyValue.VInt amount ] }

let private customer (id: int64) (name: string) : ToyRow =
    { Cells = Map.ofList [ "customers.Id", ToyValue.VInt id; "customers.Name", ToyValue.VStr name ] }

let private zset (rows: ToyRow list) : ZSet<ToyRow> = ZSet.ofKeys rows

// ── runners ──────────────────────────────────────────────────────────

/// Whole relation as ONE delta; the tick-1 output IS the answer.
let private runBatch (plan: ToyPlan) (feeds: (string * ZSet<ToyRow>) list) : ZSet<ToyRow> =
    let c = Circuit.create ()
    let lowered = ToyLowering.lower c ToyExecutionMode.Batch plan
    for alias, z in feeds do
        lowered.Send(alias, z)
    c.Step()
    lowered.Output.Current

/// Deltas over many ticks; each tick emits the CHANGE to the answer, so the
/// answer is the sum. That sum is what must equal the batch result.
let private runStreaming (plan: ToyPlan) (ticks: (string * ZSet<ToyRow>) list list) : ZSet<ToyRow> =
    let c = Circuit.create ()
    let lowered = ToyLowering.lower c ToyExecutionMode.Streaming plan
    let mutable acc = ZSet.empty
    for tick in ticks do
        for alias, z in tick do
            lowered.Send(alias, z)
        c.Step()
        acc <- ZSet.add acc lowered.Output.Current
    acc

// ── fixture data ─────────────────────────────────────────────────────

let private allOrders = [ order 1L 10L 150L; order 2L 10L 50L; order 3L 20L 900L ]
let private allCustomers = [ customer 10L "ada"; customer 20L "grace" ]

// ═══ 1. PLAN EQUIVALENCE ═════════════════════════════════════════════

[<Fact>]
let ``CE plan matches the shared golden vector (filter + project + join)`` () =
    Assert.Equal(goldenCanonical "filter-project-join", ToyPlan.canonical filterProjectJoinPlan)

[<Fact>]
let ``CE plan matches the shared golden vector (stream-table join)`` () =
    Assert.Equal(goldenCanonical "stream-table-join", ToyPlan.canonical streamTableJoinPlan)

[<Fact>]
let ``CE plan matches the shared golden vector (join + project, no where)`` () =
    // The C# side reaches this same text from a FUSED join result selector
    // (no `where` between the join and the select, so the compiler optimizes
    // the transparent identifier away). Both spellings, one plan.
    Assert.Equal(goldenCanonical "join-project", ToyPlan.canonical joinProjectPlan)

[<Fact>]
let ``the golden vector is not vacuous - a different predicate does not match`` () =
    // Guards the equivalence tests themselves: if `canonical` collapsed
    // distinct predicates to the same text, every plan-equality assertion
    // above would pass for the wrong reason.
    let drifted =
        zquery orders {
            join customers (ToyScalar.col "orders" "Cust") (ToyScalar.col "customers" "Id")
            where (ToyScalar.col "orders" "Amount" .>. ToyScalar.int64Lit 999L)
            select [ "Name", ToyScalar.col "customers" "Name"
                     "Amount", ToyScalar.col "orders" "Amount" ]
        }
    Assert.NotEqual<string>(goldenCanonical "filter-project-join", ToyPlan.canonical drifted)

// ═══ 2. MODE EQUIVALENCE — the DBSP law ══════════════════════════════

[<Fact>]
let ``batch equals the fold of streaming deltas - filter + project + join`` () =
    let batch =
        runBatch
            filterProjectJoinPlan
            [ "orders", zset allOrders; "customers", zset allCustomers ]

    // The SAME relations, shredded across three ticks, interleaved so that
    // both sides arrive late relative to each other. This is what forces
    // the three-term bilinear formula to be exercised: a single-tick feed
    // would pass even with the batch operator.
    let streamed =
        runStreaming
            filterProjectJoinPlan
            [ [ "orders", zset [ order 1L 10L 150L ] ]
              [ "customers", zset [ customer 10L "ada" ]
                "orders", zset [ order 2L 10L 50L ] ]
              [ "customers", zset [ customer 20L "grace" ]
                "orders", zset [ order 3L 20L 900L ] ] ]

    Assert.Equal<ZSet<ToyRow>>(batch, streamed)

[<Fact>]
let ``batch equals the fold of streaming deltas - retraction is handled`` () =
    // A retraction (weight -1) is the case that separates a real Z-set fold
    // from an append-only one. Order 3 is inserted then retracted, so the
    // batch relation never contains it.
    let batch = runBatch filterProjectJoinPlan [ "orders", zset [ order 1L 10L 150L ]; "customers", zset allCustomers ]

    let retraction = ZSet.ofSeq [ order 3L 20L 900L, -1L ]
    let streamed =
        runStreaming
            filterProjectJoinPlan
            [ [ "orders", zset [ order 1L 10L 150L; order 3L 20L 900L ]
                "customers", zset allCustomers ]
              [ "orders", retraction ] ]

    Assert.Equal<ZSet<ToyRow>>(batch, streamed)

[<Fact>]
let ``the mode-equivalence test is not vacuous - both sides are non-empty`` () =
    // A law of the form `a = b` passes trivially when both are empty. This
    // pins that the fixture actually produces rows, so the assertions above
    // are comparing something.
    let batch =
        runBatch filterProjectJoinPlan [ "orders", zset allOrders; "customers", zset allCustomers ]
    Assert.False(ZSet.isEmpty batch)
    // orders 1 (150 > 100) and 3 (900 > 100) survive the filter; order 2 does not.
    Assert.Equal(2, ZSet.count batch)

// ═══ 3. THE NEGATIVE CONTROL — stream⋈table is NOT retroactive ═══════

[<Fact>]
let ``stream-table join equals batch WHEN the table is loaded first`` () =
    let batch =
        runBatch streamTableJoinPlan [ "orders", zset allOrders; "customers", zset allCustomers ]

    let streamed =
        runStreaming
            streamTableJoinPlan
            [ [ "customers", zset allCustomers ]          // table first …
              [ "orders", zset [ order 1L 10L 150L ] ]    // … then the stream
              [ "orders", zset [ order 2L 10L 50L ] ]
              [ "orders", zset [ order 3L 20L 900L ] ] ]

    Assert.Equal<ZSet<ToyRow>>(batch, streamed)

[<Fact>]
let ``stream-table join DIVERGES from batch when the table arrives late`` () =
    // The documented caveat, measured. A left row that arrives BEFORE its
    // matching table row is never re-emitted when that row lands, so the
    // fold of deltas is strictly missing it. If this test ever starts
    // passing as an equality, `AsTable` has silently become retroactive and
    // the docstring is wrong.
    let batch =
        runBatch streamTableJoinPlan [ "orders", zset allOrders; "customers", zset allCustomers ]

    let streamed =
        runStreaming
            streamTableJoinPlan
            [ [ "orders", zset allOrders ]           // stream first …
              [ "customers", zset allCustomers ] ]   // … table too late

    Assert.NotEqual<ZSet<ToyRow>>(batch, streamed)
    Assert.True(ZSet.isEmpty streamed, "nothing can match a table that is still empty")
    Assert.False(ZSet.isEmpty batch)

[<Fact>]
let ``stream-stream join IS retroactive where stream-table is not`` () =
    // The same late arrival that breaks the stream-table join is absorbed by
    // the three-term formula. Running both plans over the identical feed and
    // getting different answers is what shows `AsTable` is a real semantic
    // choice rather than a performance hint.
    let feed =
        [ [ "orders", zset allOrders ]
          [ "customers", zset allCustomers ] ]

    let asStream = runStreaming filterProjectJoinPlan feed   // has a WHERE, so compare shapes only
    let asTable = runStreaming streamTableJoinPlan feed

    Assert.False(ZSet.isEmpty asStream, "stream-stream join catches up when the right side lands")
    Assert.True(ZSet.isEmpty asTable, "stream-table join does not look back")
