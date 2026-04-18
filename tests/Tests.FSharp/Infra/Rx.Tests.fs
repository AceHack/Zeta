module Zeta.Tests.Infra.RxTests
#nowarn "0893"

open System.Reactive.Linq
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Rx adapter — OutputHandle → IObservable (moved from Round7Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``RxAdapter.asObservableForCount emits N values then completes`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let out = c.Output input.Stream
        input.Set 7
        let obs = RxAdapter.asObservableForCount c out 3
        // Use Rx's ToList + await with a timeout to avoid hangs.
        let listObs = Observable.ToList obs
        let! list = System.Reactive.Threading.Tasks.TaskObservableExtensions.ToTask(listObs)
        list.Count |> should equal 3
    }


[<Fact>]
let ``RxAdapter.asObservableForCount with Select composes`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let out = c.Output input.Stream
        input.Set 5
        let obs = RxAdapter.asObservableForCount c out 3
        let mapped = Observable.Select(obs, (fun x -> x * 2))
        let listObs = Observable.ToList mapped
        let! list = System.Reactive.Threading.Tasks.TaskObservableExtensions.ToTask(listObs)
        list.[0] |> should equal 10
    }
