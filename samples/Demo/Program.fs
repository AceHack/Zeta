module Zeta.Demo.Program

open System
open Zeta.Core

/// Minimal end-to-end demo: running incremental `GROUP BY SUM`.
///
/// Each tick we feed deltas of `(customer, amount)` rows (positive weight =
/// insert, negative = delete). The circuit maintains a per-customer running
/// total — `SELECT customer, SUM(amount) FROM orders GROUP BY customer` —
/// by integrating the delta stream to get the current snapshot, then
/// grouping and summing inside each tick. Uses `Console.WriteLine` +
/// typed-interpolated strings so the demo binary is AOT-clean.
[<EntryPoint>]
let main _argv =
    let circuit = Circuit.create ()
    let orders = circuit.ZSetInput<string * int64> ()

    let snapshot = circuit.IntegrateZSet orders.Stream
    let totals =
        circuit.GroupBySum(
            snapshot,
            Func<string * int64, string>(fst),
            Func<string * int64, int64>(snd))
    let view = circuit.Output totals
    circuit.Build ()

    let feed (pairs: (string * int64) list) =
        task {
            orders.Send(ZSet.ofKeys pairs)
            do! circuit.StepAsync ()
        }

    let printView (label: string) =
        Console.WriteLine $"{label}  (tick %d{circuit.Tick}):"
        for entry in view.Current do
            let (customer, total) = entry.Key
            Console.WriteLine $"    %s{customer} -> %d{total}"

    (task {
        do! feed [ "alice", 100L ; "bob", 50L ; "alice", 25L ]
        printView "Initial deposit"

        do! feed [ "carol", 200L ; "alice", 75L ]
        printView "Another batch"

        do! feed [ "alice", -25L ]
        printView "After refund"
    }).GetAwaiter().GetResult()

    0
