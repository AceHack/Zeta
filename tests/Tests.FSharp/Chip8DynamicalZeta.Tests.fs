module Zeta.Tests.Chip8DynamicalZetaTests

// FORMALIZING THE CHIP-8 SELF-PREDICTION (shadow*, Aaron's next-rung #1: "we already
// have the chip8 and IScheduler predicting itself but more ad-hoc, not this formal
// math based … the periodic orbits are cheat-engine ISR pattern matching of captured
// state to make the memory-space orbits visible/known — usually character loops").
//
// The REAL CHIP-8 VM step (Chip8.step, deterministic without RND) is a map on its
// state; on a fixed ROM the REACHABLE state set is FINITE, so a looping animation is
// literally a PERIODIC ORBIT, and the Artin–Mazur zeta of the reachable step-map
// ENUMERATES it — the formal, math-grounded version of the cheat-engine's ad-hoc
// orbit detection (the memory character-loop).
//
// Driven here on a tiny real ROM — a period-4 counter  V0 ← (V0 + 1) AND 3 — whose
// full-state loop-map has one transient state (V1 not yet set) feeding a 4-cycle (the
// character loop). The Artin–Mazur zeta ζ = exp(Σ Fix(f^k)u^k/k) = 1/(1 − u⁴) is
// self-verified (fixed-point counts of the iterated reachable-map vs. the single
// orbit — the same discipline as #9151/#9163), and its orbit length IS the character
// period. This is exactly the orbit the ad-hoc Chip8PredictionRoom look-ahead
// traverses; the zeta makes it visible/known.
//
// Anchors: Artin–Mazur 1965 (dynamical zeta); Chip8.step (src/Core/Chip8.fs);
// Chip8PredictionRoom / PredictionScheduler (the ad-hoc predictor this formalizes).
// Trajectory: docs/trajectories/zeta-name-audition/RESUME.md.

open global.Xunit
open Zeta.Core

// A minimal looping ROM (no RND ⇒ fully deterministic):
//   0x200: 7001  ADD V0, 1        ; V0 += 1
//   0x202: 6103  LD  V1, 3        ; V1 = 3   (the mask)
//   0x204: 8012  AND V0, V1       ; V0 = V0 AND V1     (wrap mod 4)
//   0x206: 1200  JP  0x200        ; loop
let private loopRom = [| 0x70uy; 0x01uy; 0x61uy; 0x03uy; 0x80uy; 0x12uy; 0x12uy; 0x00uy |]
let private stepsPerIteration = 4     // 4 instructions per loop

/// A canonical key of the machine's VARYING state (Mem/Display are constant here).
let private keyOf (c: Chip8.Chip8) : string =
    sprintf "%A|%d|%d|%d|%d|%d" (Array.toList c.V) c.PC c.I c.SP c.Delay c.Sound

/// Run one full loop iteration (the "character-frame" macro-step).
let private iterate (c: Chip8.Chip8) : unit =
    for _ in 1 .. stepsPerIteration do Chip8.step c

/// Trace the reachable functional graph of the loop-map from the start state:
/// returns (reachable-state count m, cycle-start index j) — transient = s0..s(j-1),
/// cycle = sj..s(m-1) of length m − j.
let private reachableGraph () : int * int =
    let c = Chip8.create 0UL
    Chip8.loadRom loopRom c
    let index = System.Collections.Generic.Dictionary<string, int>()
    let mutable i = 0
    let mutable cycleStart = -1
    let mutable go = true
    while go do
        let k = keyOf c
        match index.TryGetValue k with
        | true, j -> cycleStart <- j; go <- false          // first repeat ⇒ cycle found
        | _ ->
            index.[k] <- i
            iterate c
            i <- i + 1
    (i, cycleStart)   // m = i distinct states recorded, cycle starts at cycleStart

/// The reachable step-map f as an int array on 0..m−1 (f i = i+1, wrapping the last
/// recorded state back to the cycle start).
let private reachableMap () : int[] * int =
    let (m, j) = reachableGraph ()
    let f = Array.init m (fun i -> if i = m - 1 then j else i + 1)
    (f, m - j)   // (map, cycle length)

let private fixCount (f: int[]) (k: int) : int64 =
    let fk = Array.init f.Length (fun x -> let mutable y = x in (for _ in 1 .. k do y <- f.[y]); y)
    Array.init f.Length (fun x -> if fk.[x] = x then 1L else 0L) |> Array.sum

[<Fact>]
let ``the real CHIP-8 loop-map has a period-4 orbit (the memory character-loop) plus a transient`` () =
    let (f, cycleLen) = reachableMap ()
    Assert.Equal(4, cycleLen)                              // V0 = (V0+1) AND 3 ⇒ period 4
    Assert.True(f.Length > cycleLen, "there is a transient state (V1 unset before the first LD)")

[<Fact>]
let ``the CHIP-8 dynamical zeta self-verifies: exp(Σ Fix(f^k)u^k/k) = 1/(1 − u^period), and the orbit IS the character loop`` () =
    let (f, cycleLen) = reachableMap ()
    let maxDeg = 12
    // exp side (integer log-derivative recurrence over the REAL VM's reachable map)
    let byExp =
        let c = Array.zeroCreate (maxDeg + 1)
        c.[0] <- 1L
        for m in 1 .. maxDeg do
            let mutable s = 0L
            for k in 1 .. m do s <- s + fixCount f k * c.[m - k]
            Assert.True(s % int64 m = 0L, sprintf "recurrence: %d not divisible by %d" s m)
            c.[m] <- s / int64 m
        c
    // orbit-product side: a single orbit of length `cycleLen` ⇒ 1/(1 − u^cycleLen)
    // = the geometric series 1 + u^L + u^2L + … (1 exactly at multiples of L).
    let byOrbit = Array.init (maxDeg + 1) (fun d -> if d % cycleLen = 0 then 1L else 0L)
    for m in 0 .. maxDeg do
        Assert.True(byExp.[m] = byOrbit.[m], sprintf "degree %d: exp %d, orbit %d" m byExp.[m] byOrbit.[m])
    Assert.Equal(1L, byExp.[0])
    Assert.Equal(0L, byExp.[cycleLen - 1])                // nothing shorter than the character period
    Assert.Equal(1L, byExp.[cycleLen])                    // the character loop appears at its period
