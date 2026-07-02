module Zeta.Tests.SchedulerZetaTests

// SCHEDULER SELF-PREDICTION via the dynamical zeta (shadow*, Aaron: "wire the zeta into
// the soft IScheduler"). RESUME step 4 — the capstone. A DoP=1 deterministic tick is a
// map on state; SchedulerZeta predicts the ORBIT (the character loop) a run will settle
// into, and its period, by RUN-AHEAD — iterating only until a projected state repeats,
// never the caller's full budget. The loop modelling its own recurrence before it runs.
//
// Demonstrated on the REAL CHIP-8 VM (the ad-hoc predictor's own machine, #9165) and
// self-verified on an enumerable config space (Fix(f^k) = orbit-product, the #9151/#9163
// discipline). Anchors: Artin–Mazur 1965; SoftScheduler / CellScheduler (the DoP=1
// deterministic tick); Chip8.step. Trajectory: docs/trajectories/zeta-name-audition/.

open global.Xunit
open Zeta.Core

// ── run-ahead prediction on the real CHIP-8 loop (the period-4 counter of #9165) ──
let private loopRom = [| 0x70uy; 0x01uy; 0x61uy; 0x03uy; 0x80uy; 0x12uy; 0x12uy; 0x00uy |]

/// One full loop iteration as a PURE map (clone, then step 4 instructions).
let private chip8Step (c: Chip8.Chip8) : Chip8.Chip8 =
    let c2 = Chip8.clone c
    for _ in 1 .. 4 do Chip8.step c2
    c2

/// Finite projection of the VM state (Mem/Display are constant for this ROM).
let private chip8Key (c: Chip8.Chip8) : string =
    sprintf "%A|%d|%d" (Array.toList c.V) c.PC c.I

[<Fact>]
let ``the soft scheduler predicts its own CHIP-8 recurrence by run-ahead — period 4, without the full budget`` () =
    let start =
        let c = Chip8.create 0UL
        Chip8.loadRom loopRom c
        c
    let r = SchedulerZeta.predict chip8Key chip8Step start
    Assert.Equal(4, r.Period)                       // predicts the character-loop period
    Assert.True(r.Transient >= 1, "a transient precedes the cycle (V1 unset)")
    Assert.True(r.Reachable < 1000, "run-ahead: predicted the orbit without running a large budget")
    // the predicted zeta of this run is 1/(1 − u⁴)
    Assert.Equal<int64[]>(SchedulerZeta.zetaOfRun r 12, SchedulerZeta.zetaOfOrbits [ r.Period ] 12)

// ── full spectrum, self-verified on an enumerable config space ──
[<Fact>]
let ``the recurrence spectrum self-verifies: exp(Σ Fix(f^k)u^k/k) = Π orbit 1/(1 − u^len)`` () =
    // a scheduler config-map on {0..6} with known cycles (0 1 2)(3 4)(5)(6) — orbit
    // lengths {3,2,1,1}. Its zeta must self-verify against the Fix counts.
    let perm = [| 1; 2; 0; 4; 3; 5; 6 |]
    let step (x: int) = perm.[x]
    let key (x: int) = x
    let states = [ 0 .. 6 ]
    let spec = SchedulerZeta.spectrum key step states
    Assert.Equal(7, List.sum spec)                  // every config classified once
    Assert.Equal<int list>([ 1; 1; 2; 3 ], List.sort spec)
    let maxDeg = 12
    let byOrbit = SchedulerZeta.zetaOfOrbits spec maxDeg
    let byExp =
        let c = Array.zeroCreate (maxDeg + 1)
        c.[0] <- 1L
        for m in 1 .. maxDeg do
            let mutable s = 0L
            for k in 1 .. m do s <- s + SchedulerZeta.fixCount key step states k * c.[m - k]
            Assert.True(s % int64 m = 0L, sprintf "recurrence: %d not divisible by %d" s m)
            c.[m] <- s / int64 m
        c
    for m in 0 .. maxDeg do
        Assert.True(byExp.[m] = byOrbit.[m], sprintf "degree %d: exp %d, orbit %d" m byExp.[m] byOrbit.[m])

[<Fact>]
let ``predict is DoP-invariant-friendly: a deterministic cell-round map's period is recovered exactly`` () =
    // A soft-scheduler-shaped deterministic tick: a ring of 3 counters, each cell
    // adds its left neighbour's value mod 5 (a synchronous round). Its full-state map
    // is deterministic (the DoP=1 loop), so its recurrence period is well-defined and
    // predictable ahead of the run.
    let round (v: int[]) : int[] =
        Array.init v.Length (fun i -> (v.[i] + v.[(i + 2) % v.Length]) % 5)
    let key (v: int[]) : string = sprintf "%A" (Array.toList v)
    let start = [| 1; 0; 0 |]
    let r = SchedulerZeta.predict key round start
    Assert.True(r.Period > 0, "the deterministic round settles into an orbit")
    // running the map `Period` times from a cycle point returns to it (verifies Period)
    let mutable s = start
    for _ in 1 .. r.Transient do s <- round s          // advance onto the cycle
    let onCycle = s
    let mutable t = onCycle
    for _ in 1 .. r.Period do t <- round t
    Assert.Equal<int list>(Array.toList onCycle, Array.toList t)   // period is exact

// ── LOAD-BEARING: fast-forward through recurrence (the capstone made USED) ──

[<Fact>]
let ``runToHorizon equals the naive step^n for every horizon (the correctness guarantee)`` () =
    let step (x: int) = (x + 1) % 7
    let key (x: int) = x
    let naive (h: int) = let mutable s = 3 in (for _ in 1 .. h do s <- step s); s
    for h in [ 0; 1; 5; 7; 20; 100; 1000 ] do
        Assert.Equal(naive h, SchedulerZeta.runToHorizon key step 3 h)

[<Fact>]
let ``LOAD-BEARING: a BILLION CHIP-8 frames in bounded work — the scheduler skips re-simulating a periodic config`` () =
    let start =
        let c = Chip8.create 0UL
        Chip8.loadRom loopRom c
        c
    // small, naive-verifiable horizon (test-1 logic applies): fast-forward = real run.
    let naive4 = let mutable s = start in (for _ in 1 .. 4 do s <- chip8Step s); s
    Assert.Equal(chip8Key naive4, chip8Key (SchedulerZeta.runToHorizon chip8Key chip8Step start 4))
    // ONE BILLION frames. Naive would be 4e9 Chip8.step calls; runToHorizon does
    // O(reachable ≈ 5) work by fast-forwarding through the period-4 orbit. 1e9 ≡ 4 in
    // the (transient 1, period 4) orbit, so the far state = the near state — computed
    // in microseconds, not a billion steps.
    let far = SchedulerZeta.runToHorizon chip8Key chip8Step start 1_000_000_000
    let near = SchedulerZeta.runToHorizon chip8Key chip8Step start 4
    Assert.Equal(chip8Key near, chip8Key far)     // the character loop, fast-forwarded a billion frames

// ── weak-referenced fixed-point table: dynamically load / unload (Shiva/GC) ──

[<Fact>]
let ``FixedPointCache: fixed points load, cache-hit, UNLOAD (Shiva), and regenerate exactly`` () =
    let start =
        let c = Chip8.create 0UL
        Chip8.loadRom loopRom c
        c
    let cache = SchedulerZeta.FixedPointCache(chip8Key, chip8Step, start)
    let orbit1 = cache.Orbit()                     // first load (miss)
    let orbit2 = cache.Orbit()                     // still loaded (hit)
    Assert.Equal(1, cache.Misses)
    Assert.Equal(1, cache.Hits)
    Assert.Same(orbit1, orbit2)                    // same instance while loaded
    Assert.Equal(4, orbit1.Length)                 // the period-4 character loop = 4 fixed points
    // Shiva sweeps: unload the derived fixed points; next access regenerates them.
    cache.Unload()
    let orbit3 = cache.Orbit()                     // reload (miss)
    Assert.Equal(2, cache.Misses)
    // regeneration is LOSSLESS — the derived fixed points are exactly the same.
    Assert.Equal<string[]>(Array.map chip8Key orbit1, Array.map chip8Key orbit3)

[<Fact>]
let ``orbitStates returns exactly the recurrent set (the fixed points), transient excluded`` () =
    // a rho: 3 transient states into a 4-cycle. orbitStates returns only the 4-cycle.
    let step (x: int) = if x < 3 then x + 1 else 3 + ((x - 3 + 1) % 4)  // 0→1→2→3→[3..6 cycle]
    let key (x: int) = x
    let orbit = SchedulerZeta.orbitStates key step 0 |> List.sort
    Assert.Equal<int list>([ 3; 4; 5; 6 ], orbit)   // the 4-cycle, no transient (0,1,2)
