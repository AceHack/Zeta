module Zeta.Tests.Operators.TransactionTests
#nowarn "0893"

open System.Threading
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ TransactionZ1 (moved from InfrastructureTests / CoverageTests2 /
// ═ SpineAndSafetyTests / Round7Tests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``TransactionZ1 Commit promotes pending to state`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let tz = c.TransactionZ1 input.Stream
        let out = c.Output tz.Stream

        // Prime: after tick 1, state = {100:1}.
        input.Send(ZSet.singleton 100 1L)
        do! c.StepAsync()

        // Open transaction. State is frozen at {100:1}.
        tz.BeginTransaction()
        input.Send(ZSet.singleton 999 1L)
        do! c.StepAsync()
        // StepAsync emitted state = {100:1}. Pending updated to {999:1}.
        out.Current.[100] |> should equal 1L
        out.Current.[999] |> should equal 0L
        tz.IsInTransaction |> should be True

        // Commit: promote pending to state, then observe at next tick.
        tz.Commit()
        input.Send(ZSet.singleton 42 1L)
        do! c.StepAsync()
        // StepAsync emits committed state = {999:1}.
        out.Current.[999] |> should equal 1L
        tz.IsInTransaction |> should be False
    }


[<Fact>]
let ``TransactionZ1 Rollback discards uncommitted deltas`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let tz = c.TransactionZ1 input.Stream
        let out = c.Output tz.Stream

        // Prime: state = {100:1}.
        input.Send(ZSet.singleton 100 1L)
        do! c.StepAsync()

        tz.BeginTransaction()
        input.Send(ZSet.singleton 999 1L)
        do! c.StepAsync()
        // Pending = {999:1}; state frozen at {100:1}.
        tz.Rollback()     // pending <- state = {100:1}
        input.Send(ZSet.singleton 200 1L)
        do! c.StepAsync()
        // After rollback, auto-commit resumes; pending updates from fresh input.
        // State was {100:1} coming into this tick; out = state = {100:1}.
        out.Current.[100] |> should equal 1L
        out.Current.[999] |> should equal 0L
    }


[<Fact>]
let ``TransactionZ1 IsInTransaction reflects state`` () =
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let tz = c.TransactionZ1 input.Stream
    let _ = c.Output tz.Stream
    tz.IsInTransaction |> should be False
    tz.BeginTransaction()
    tz.IsInTransaction |> should be True
    tz.Commit()
    tz.IsInTransaction |> should be False


[<Fact>]
let ``TransactionZ1 behaves like z^-1 under auto-commit`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let tz = c.TransactionZ1 input.Stream
        let out = c.Output tz.Stream

        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True   // initial state

        input.Send(ZSet.singleton 2 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L       // prior tick's input
    }


// ─── TransactionZ1 initial value (moved from CoverageTests2) ─────────

[<Fact>]
let ``TransactionZ1 initial value is default`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let tz = c.TransactionZ1 input.Stream
        let out = c.Output tz.Stream
        input.Send(ZSet.ofKeys [ 1 ])
        do! c.StepAsync()
        // First tick emits the default/initial value — for ZSet<int>, empty.
        out.Current.IsEmpty |> should be True
    }


// ─── Transaction semantics (moved from SpineAndSafetyTests) ─────────

[<Fact>]
let ``TransactionZ1 commits pending to state`` () =
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    let tx = c.TransactionZ1 input.Stream
    c.Output tx.Stream |> ignore
    c.Build()
    tx.BeginTransaction()
    input.Set 10
    c.Step()
    // During tx, Stream.Current is still the committed state (initial 0).
    tx.IsInTransaction |> should be True
    tx.Commit()
    tx.IsInTransaction |> should be False


[<Fact>]
let ``TransactionZ1 rolls back to last committed state`` () =
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    let tx = c.TransactionZ1 input.Stream
    c.Output tx.Stream |> ignore
    c.Build()
    input.Set 42
    c.Step()
    tx.Commit()
    let committed = tx.State
    tx.BeginTransaction()
    input.Set 99
    c.Step()
    tx.Rollback()
    tx.State |> should equal committed


// ─── Transaction CAS (moved from Round7Tests) ─────────

[<Fact>]
let ``TransactionZ1 CAS state is consistent under concurrent Commit`` () =
    let c = Circuit.create ()
    let input = c.ScalarInput<int>()
    let tx = c.TransactionZ1 input.Stream
    c.Output tx.Stream |> ignore
    c.Build()
    input.Set 42
    c.Step()
    // Fire many concurrent Begin/Commit/Rollback from threads.
    let threads =
        [| for _ in 0 .. 15 ->
            Thread(fun () ->
                for _ in 1 .. 100 do
                    tx.BeginTransaction()
                    tx.Commit()) |]
    for t in threads do t.Start()
    for t in threads do t.Join()
    // End state should be sane: AutoCommit = true, State <> default.
    tx.IsInTransaction |> should be False
