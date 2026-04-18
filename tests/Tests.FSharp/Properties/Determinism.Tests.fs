module Zeta.Tests.Properties.DeterminismTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


[<Fact>]
let ``VirtualEnvironment replays identically for the same seed`` () =
    let env1 = Environment.createVirtual 42L :> ISimulationEnvironment
    let env2 = Environment.createVirtual 42L :> ISimulationEnvironment

    for _ in 1 .. 100 do
        env1.NextInt64() |> should equal (env2.NextInt64())
        env1.NewGuid() |> should equal (env2.NewGuid())


[<Fact>]
let ``VirtualEnvironment diverges for different seeds`` () =
    let env1 = Environment.createVirtual 1L :> ISimulationEnvironment
    let env2 = Environment.createVirtual 2L :> ISimulationEnvironment
    env1.NextInt64() |> should not' (equal (env2.NextInt64()))


[<Fact>]
let ``AdvanceTime moves the virtual clock without real waiting`` () =
    task {
        let env = Environment.createVirtual 0L
        let iface = env :> ISimulationEnvironment
        let start = iface.UtcNow()
        do! iface.Delay(TimeSpan.FromHours 1.0, Threading.CancellationToken.None)
        (iface.UtcNow() - start).TotalHours |> should equal 1.0
    }


[<Fact>]
let ``Circuit replays identically with the same input sequence`` () =
    task {
        // Two independent circuits, same logic, same deltas — outputs identical.
        let build () =
            let c = Circuit.create ()
            let input = c.ZSetInput<int>()
            let out = c.Output(c.IntegrateZSet(c.Map(input.Stream, Func<int, int>(fun x -> x * 2))))
            c.Build()
            c, input, out

        let c1, in1, out1 = build ()
        let c2, in2, out2 = build ()

        let deltas = [ ZSet.ofKeys [ 1; 2 ]; ZSet.singleton 3 1L; ZSet.singleton 1 -1L ]
        for d in deltas do
            in1.Send d
            in2.Send d
            do! c1.StepAsync()
            do! c2.StepAsync()
            out1.Current |> should equal out2.Current
    }


[<Fact>]
let ``SystemEnvironment is a non-null singleton`` () =
    let env = SystemEnvironment.Default
    env |> should not' (be null)
    env.UtcNow().Year |> should be (greaterThanOrEqualTo 2025)
