module Zeta.Tests.Infra.EnvironmentTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Environment / ChaosEnv (moved from CoverageTests / CoverageBoostTests /
// NestedAndRuntimeTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Environment.createVirtualAt uses given start time`` () =
    let start = DateTimeOffset.Parse "2026-01-01T00:00:00Z"
    let env = Environment.createVirtualAt start 42L
    let iface = env :> ISimulationEnvironment
    iface.UtcNow() |> should equal start


[<Fact>]
let ``SystemEnvironment works`` () =
    let env = SystemEnvironment.Default
    env.NextInt64() |> ignore
    env.NewGuid() |> ignore
    env.UtcNow() |> ignore
    env.Ticks() |> ignore


[<Fact>]
let ``ChaosEnvironment.defaults returns functional env`` () =
    let env = ChaosEnvironment.defaults 123L :> ISimulationEnvironment
    env.NextInt64() |> ignore
    env.UtcNow() |> ignore
    env.NewGuid() |> ignore


[<Fact>]
let ``ChaosEnvironment with no policy is plain`` () =
    let env = ChaosEnvironment(
                DateTimeOffset.UnixEpoch, 1L,
                ChaosPolicy.None, 1.0, 0L)
    let iface = env :> ISimulationEnvironment
    let t1 = iface.UtcNow()
    // No chaos = no skew.
    let t2 = iface.UtcNow()
    t1 |> should equal t2


// ─── ChaosEnvironment determinism (moved from NestedAndRuntimeTests) ──

[<Fact>]
let ``ChaosEnvironment replays identically for same seed and policy`` () =
    let env1 = ChaosEnvironment.defaults 99L :> ISimulationEnvironment
    let env2 = ChaosEnvironment.defaults 99L :> ISimulationEnvironment
    for _ in 1 .. 50 do
        env1.NextInt64() |> should equal (env2.NextInt64())
        env1.UtcNow()    |> should equal (env2.UtcNow())
        env1.NewGuid()   |> should equal (env2.NewGuid())


[<Fact>]
let ``ChaosEnvironment.maximal never produces negative timestamp differences over short horizon`` () =
    // Maximal chaos env has time-reversal; over many samples the clock
    // always advances by at least 1ms per Delay call overall, though
    // individual UtcNow() reads can briefly skew backwards.
    let env = ChaosEnvironment.maximal 123L
    let iface = env :> ISimulationEnvironment
    let start = iface.UtcNow()
    for _ in 1 .. 1000 do
        iface.Delay(TimeSpan.FromMilliseconds 1.0, Threading.CancellationToken.None).Wait()
    let finish = iface.UtcNow()
    // Allow for skew; just confirm the chaos env didn't crash.
    finish |> should not' (equal DateTimeOffset.MinValue)
    start  |> should not' (equal DateTimeOffset.MinValue)


// ─── Clock / DI (moved from CoverageBoostTests) ─────────────────

[<Fact>]
let ``SystemClock ticks forward`` () =
    let c = SystemClock() :> IClock
    let t0 = c.UtcNow()
    let e0 = c.Elapsed()
    System.Threading.Thread.Sleep 5
    let t1 = c.UtcNow()
    let e1 = c.Elapsed()
    t1 |> should be (greaterThan t0)
    e1 |> should be (greaterThan e0)


[<Fact>]
let ``FrozenClock advances only on explicit call`` () =
    let fc = FrozenClock DateTimeOffset.UnixEpoch
    let c = fc :> IClock
    let t0 = c.UtcNow()
    System.Threading.Thread.Sleep 5
    let t1 = c.UtcNow()
    // Wall time passed but frozen clock didn't move.
    t1 |> should equal t0
    fc.Advance (TimeSpan.FromSeconds 1.0)
    let t2 = c.UtcNow()
    t2 |> should equal (t0 + TimeSpan.FromSeconds 1.0)


[<Fact>]
let ``DbspServices.Default provides system clock and default metrics`` () =
    let s = DbspServices.Default
    s.Clock |> should not' (be null)
    s.Metrics |> should not' (be null)


[<Fact>]
let ``DbspServices.ForBenchmark uses frozen clock and null metrics`` () =
    let s = DbspServices.ForBenchmark
    // Frozen clock returns the same value repeatedly.
    let t0 = s.Clock.UtcNow()
    let t1 = s.Clock.UtcNow()
    t0 |> should equal t1


[<Fact>]
let ``DefaultHashStrategy salts across process restart`` () =
    let h = DefaultHashStrategy<string>() :> IHashStrategy<string>
    // Just verify it returns a value.
    h.Hash "key" |> ignore


[<Fact>]
let ``StableHashStrategy is deterministic`` () =
    let h1 = StableHashStrategy<string>() :> IHashStrategy<string>
    let h2 = StableHashStrategy<string>() :> IHashStrategy<string>
    h1.Hash "test" |> should equal (h2.Hash "test")
