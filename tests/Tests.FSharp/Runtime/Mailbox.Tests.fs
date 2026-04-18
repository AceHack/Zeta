module Zeta.Tests.Runtime.MailboxTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// MailboxRuntime (moved from Round6Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``MailboxRuntime processes batches across shards`` () =
    task {
        use rt =
            new MailboxRuntime<int>(
                shardCount = 4,
                build = Func<_, _, _>(fun c input ->
                    let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
                    c.Output doubled))
        for i in 0 .. 15 do
            rt.Post(i % 4, ZSet.ofKeys [ i ])
        do! rt.FlushAsync()
        let gathered = rt.Gather()
        gathered.Length |> should equal 4
    }


[<Fact>]
let ``MailboxRuntime PostRoundRobin distributes batches`` () =
    task {
        use rt =
            new MailboxRuntime<int>(
                shardCount = 2,
                build = Func<_, _, _>(fun c input -> c.Output input.Stream))
        rt.PostRoundRobin [
            ZSet.ofKeys [ 1 ]; ZSet.ofKeys [ 2 ]; ZSet.ofKeys [ 3 ]; ZSet.ofKeys [ 4 ]
        ]
        do! rt.FlushAsync()
        let lens = rt.CurrentQueueLengths
        lens.Length |> should equal 2
        // All drained.
        for l in lens do l |> should equal 0
    }
