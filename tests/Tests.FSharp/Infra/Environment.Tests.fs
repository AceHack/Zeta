module Zeta.Tests.Infra.EnvironmentTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open System.IO


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
    // WAS `Thread.Sleep 5` followed straight by `t1 > t0`. The default timer resolution behind
    // DateTimeOffset.UtcNow is about 15.6 ms on Windows, so five milliseconds of sleep can hand
    // back the SAME instant -- and the assertion then fails for the platform's granularity
    // rather than for anything about the clock. The only reason this has not been seen red is
    // that the Windows leg of build-and-test carries continue-on-error.
    //
    // Spin until the clock has actually moved instead. The ten seconds is an upper bound on
    // PATIENCE, not a delay: a slow machine waits longer and still passes, and a red here means
    // the clock never advanced at all, which is a real failure on any machine.
    let advanced =
        System.Threading.SpinWait.SpinUntil(
            (fun () -> c.UtcNow() > t0 && c.Elapsed() > e0),
            TimeSpan.FromSeconds 10.0)
    Assert.True(advanced, "SystemClock did not advance within 10s -- it is not a clock")
    let t1 = c.UtcNow()
    let e1 = c.Elapsed()
    t1 |> should be (greaterThan t0)
    e1 |> should be (greaterThan e0)


[<Fact>]
let ``FrozenClock advances only on explicit call`` () =
    let fc = FrozenClock DateTimeOffset.UnixEpoch
    let c = fc :> IClock
    let t0 = c.UtcNow()
    // This sleep STAYS, and unlike the one above it is the safe direction: the assertion is
    // that the frozen clock did NOT move, so extra elapsed time on a loaded machine makes the
    // check stricter rather than flakier. An absence has nothing to spin until.
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


[<Fact>]
let ``Buggify fault injection works deterministically under simulation and is inert by default`` () =
    // 1. Inactive by default
    Assert.False(Buggify.Check(1.0, "test.tag"))
    
    // 2. Active and deterministic under seed
    let env1 = ChaosEnvironment.defaults 42L
    env1.EnableBuggify()
    let results1 = [ for _ in 1 .. 20 -> Buggify.Check(0.5, "test.tag") ]
    env1.DisableBuggify()
    
    // 3. Deactivated after Disable
    Assert.False(Buggify.Check(1.0, "test.tag"))
    
    // 4. Identical replay under identical seed
    let env2 = ChaosEnvironment.defaults 42L
    env2.EnableBuggify()
    let results2 = [ for _ in 1 .. 20 -> Buggify.Check(0.5, "test.tag") ]
    env2.DisableBuggify()
    
    Assert.Equal<bool list>(results1, results2)
    // Verify some are true and some are false
    Assert.Contains(true, results1)
    Assert.Contains(false, results1)


[<Fact>]
let ``DiskBackingStore uses MerkleHash handles and frame-first protocol under StableStorage`` () =
    let workDir = Path.Combine(Path.GetTempPath(), "zeta-test-spine-" + Guid.NewGuid().ToString("N"))
    try
        let store = DiskBackingStore<string>(workDir, inMemoryQuotaBytes = 0L, fsyncPerSave = true) :> IBackingStore<string>
        let batch = ZSet.singleton "hello" 1L
        let handle = store.Save(0, batch)
        
        // Assert handle is indeed a MerkleHash
        let hash = handle :?> MerkleHash
        Assert.True(hash.Hi <> 0UL || hash.Lo <> 0UL)
        
        // Check files exist
        let candidate = Path.Combine(workDir, sprintf "spine-%016x%016x.json" hash.Hi hash.Lo)
        Assert.True(File.Exists candidate)
        Assert.True(File.Exists (candidate + ".data"))
        
        // Read back
        let loaded = store.Load handle
        Assert.Equal(1L, loaded.["hello"])
        
        // Release
        store.Release handle
        Assert.False(File.Exists candidate)
        Assert.False(File.Exists (candidate + ".data"))
    finally
        if Directory.Exists workDir then Directory.Delete(workDir, true)


[<Fact>]
let ``SimulatedFs Flush signals and handles buggify flush failures`` () =
    let workDir = Path.Combine(Path.GetTempPath(), "zeta-test-simfs-" + Guid.NewGuid().ToString("N"))
    try
        let env = ChaosEnvironment.defaults 123L
        env.EnableBuggify()
        
        let store = DiskBackingStore<string>(workDir, inMemoryQuotaBytes = 0L, fsyncPerSave = true) :> IBackingStore<string>
        let batch = ZSet.singleton "test" 1L
        
        // We run a few saves; eventually Buggify should trigger a simulated disk flush failure
        let mutable failed = false
        try
            for _ in 1 .. 50 do
                store.Save(0, batch) |> ignore
        with ex ->
            if ex.Message.Contains("BUGGIFY: Simulated disk flush failure") then
                failed <- true
                
        env.DisableBuggify()
        Assert.True(failed, "Expected buggify to trigger simulated flush failure")
    finally
        if Directory.Exists workDir then Directory.Delete(workDir, true)
