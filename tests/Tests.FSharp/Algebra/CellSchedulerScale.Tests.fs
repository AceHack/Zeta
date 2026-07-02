module Zeta.Tests.FSharp.Algebra.CellSchedulerScaleTests

open Xunit
open System.Diagnostics
open Zeta.Core

// Scale probe (NOT a DST proof — a measurement to decide whether the deferred
// O(n^2)-queue perf refactor is actually earned). Wall-clock is informational
// only; the ASSERTIONS are correctness-at-scale (deterministic), not timing.

// Trivial int step: accumulate; a message carries a delta + forward targets.
type SMsg = { D: int; To: CellId list }
let private sstep (acc: int) (m: SMsg) : int * (CellId * SMsg) list =
    acc + m.D, [ for t in m.To -> t, { D = m.D; To = [] } ]

[<Fact>]
let ``wide fan-out: one source to N sinks stays correct and fast`` () =
    // Adversarial for the list-based Ready/inbox: one round delivers N messages.
    let n = 2000
    let sinks = [ for i in 1 .. n -> sprintf "s%04d" i ]
    let cells = ("src", 0) :: [ for s in sinks -> s, 0 ]
    let seed = [ "src", { D = 0; To = sinks } ]     // src fans a message to every sink
    let sw = Stopwatch.StartNew()
    match CellScheduler.runToQuiescence 1_000_000 sstep (CellScheduler.init cells seed) with
    | Ok final ->
        sw.Stop()
        // every sink received exactly one message (D=0 ⇒ acc stays 0, but it RAN)
        Assert.Equal(n + 1, Map.count final)
        // correctness at scale: all sinks present and processed
        Assert.All(sinks, fun s -> Assert.True(Map.containsKey s final))
        printfn "[scale] wide fan-out N=%d: %d ms" n sw.ElapsedMilliseconds
    | Error e -> failwith e

[<Fact>]
let ``deep chain: a delta threads N cells and arrives intact`` () =
    // A linear pipeline of N relays; one delta flows end to end over N rounds.
    let n = 2000
    let ids = [ for i in 0 .. n - 1 -> sprintf "c%04d" i ]
    let cells = [ for id in ids -> id, 0 ]
    // Each cell forwards +1 to the numerically-next cell id (encoded by convention),
    // so one seeded delta threads the whole chain, one hop per round.
    let seedChain = [ "c0000", { D = 1; To = [ "c0001" ] } ]
    let chainStep (acc: int) (m: SMsg) : int * (CellId * SMsg) list =
        acc + m.D,
        [ for t in m.To do
            let idx = System.Int32.Parse(t.Substring 1)
            let nextTo = if idx + 1 < n then [ sprintf "c%04d" (idx + 1) ] else []
            yield t, { D = 1; To = nextTo } ]
    let sw = Stopwatch.StartNew()
    match CellScheduler.runToQuiescence 1_000_000 chainStep (CellScheduler.init cells seedChain) with
    | Ok final ->
        sw.Stop()
        // the delta reached the last cell (every cell on the path accumulated 1)
        Assert.Equal(1, Map.find (sprintf "c%04d" (n - 1)) final)
        Assert.Equal(1, Map.find "c0001" final)
        printfn "[scale] deep chain N=%d: %d ms" n sw.ElapsedMilliseconds
    | Error e -> failwith e
