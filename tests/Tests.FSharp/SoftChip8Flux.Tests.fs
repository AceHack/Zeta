module Zeta.Tests.SoftChip8FluxTests

// Flux-metered speculation: the tank funds lookAhead depth (the time-travel budget made real);
// CHIP-8 input arrives as a membrane crossing and resolves the speculative forks.

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

// ROM: 6A0C (V[A]=0x0C); 1202 (jump loop) — pure deterministic line, never branches on input.
let private loopRom = [| 0x6Auy; 0x0Cuy; 0x12uy; 0x02uy |]
// ROM: EA9E (skip if key V[A] pressed) at 0x200 — branches on input IMMEDIATELY.
let private inputRom = [| 0xEAuy; 0x9Euy; 0x12uy; 0x00uy |]

let private frameWith (rom: byte[]) =
    Chip8Cow.create 1UL |> Chip8Cow.loadRom rom

[<Fact>]
let ``the tank meters the future: speculation depth = what the flux affords, not a constant`` () =
    let f = frameWith loopRom
    // 5 units of flux at 1.0/step => exactly 5 speculated steps, then "out of flux"
    let _, hitBranch, steps, tank' = SoftChip8Flux.lookAheadFunded 1.0 (SoftThrottle.tank 5.0 1.0) f
    Assert.False(hitBranch)
    Assert.Equal(5, steps)
    Assert.Equal(0.0, SoftThrottle.available tank', 12)

[<Fact>]
let ``idle recharge buys DEEPER speculation (banked time-travel discharging in a burst)`` () =
    let f = frameWith loopRom
    let drained = SoftThrottle.tank 3.0 1.5
    let _, _, steps1, t1 = SoftChip8Flux.lookAheadFunded 1.0 drained f
    Assert.Equal(3, steps1)
    // two idle ticks recharge 3.0 (capped at capacity) => the next burst goes deep again
    let recharged = t1 |> SoftThrottle.charge |> SoftThrottle.charge
    let _, _, steps2, _ = SoftChip8Flux.lookAheadFunded 1.0 recharged f
    Assert.Equal(3, steps2)

[<Fact>]
let ``speculation STOPS at an input branch regardless of remaining flux (the genuine fork)`` () =
    let f = frameWith inputRom
    let _, hitBranch, steps, tank' = SoftChip8Flux.lookAheadFunded 1.0 (SoftThrottle.tank 100.0 1.0) f
    Assert.True(hitBranch)
    Assert.Equal(0, steps) // branched on the very first opcode
    Assert.Equal(100.0, SoftThrottle.available tank', 12) // no flux spent on an unresolvable future

[<Fact>]
let ``input arrives as a crossing and RESOLVES the fork (the present-crossing leg)`` () =
    task {
        // a room: input handler + timer handler on one driveK loop; key A pressed at tick 1
        let source: SoftScheduler.Source =
            fun tick ->
                [ yield TimerElapsed 17
                  if tick = 1 then yield OperatorMessageArrived(SoftChip8Flux.encodeKey 0xC true) ]
        let ctx: IntrCtx =
            { Memetic = "flux"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }
        let handlers = [ SoftChip8Flux.inputHandler; SoftChip8Flux.timerHandler 2 ]
        let! r = (SoftScheduler.driveK handlers source).Run ctx 1L (frameWith loopRom) 5
        match r with
        | Ok f ->
            Assert.True(f.Keys.[0xC]) // the crossing landed in the frame
            Assert.Equal(0x0Cuy, f.V.[0xA]) // and the CPU still ran
        | Error e -> Assert.Fail(sprintf "room errored: %A" e)
    }

[<Fact>]
let ``the key codec round-trips and refuses non-key traffic honestly`` () =
    Assert.Equal(Some(0xC, true), SoftChip8Flux.parseKey (SoftChip8Flux.encodeKey 0xC true))
    Assert.Equal(Some(3, false), SoftChip8Flux.parseKey "key:3:0")
    Assert.True((SoftChip8Flux.parseKey "pong:1,1").IsNone)
    Assert.True((SoftChip8Flux.parseKey "key:16:1").IsNone) // out of range
    Assert.True((SoftChip8Flux.parseKey "key:3:2").IsNone) // bad state

[<Fact>]
let ``DST: funded speculation replays identically (same frame, same tank => same result)`` () =
    let f = frameWith loopRom
    let run () = SoftChip8Flux.lookAheadFunded 1.0 (SoftThrottle.tank 7.0 1.0) f
    let a = run ()
    let b = run ()
    Assert.Equal(a, b)

[<Fact>]
let ``SELF-AWARENESS: starved of flux, the system KNOWS its confidence shortfall and SIGNALS it`` () =
    let f = frameWith loopRom
    // goal 100 steps, but only 30 units of flux: the system must know it saw 30/100
    let _, report, _ = SoftChip8Flux.speculateToward 100 1.0 (SoftThrottle.tank 30.0 0.0) f
    Assert.True(report.Starved)
    Assert.False(report.HitBranch)
    Assert.Equal(30, report.Achieved)
    Assert.Equal(0.3, report.Confidence, 9) // self-known uncertainty: 70% of the knowable future unseen
    Assert.Equal(Some(RateLimitExhausted "speculation-flux"), SoftChip8Flux.signalIfStarved report)

[<Fact>]
let ``a fork-limited stop is NOT a power problem: confidence 1.0, no signal (the honest distinction)`` () =
    let f = frameWith inputRom
    let _, report, _ = SoftChip8Flux.speculateToward 100 1.0 (SoftThrottle.tank 1000.0 0.0) f
    Assert.True(report.HitBranch)
    Assert.False(report.Starved)
    Assert.Equal(1.0, report.Confidence, 9) // it saw everything KNOWABLE; the rest needs the present
    Assert.Equal(None, SoftChip8Flux.signalIfStarved report)

[<Fact>]
let ``fully funded goal: confidence 1.0, no signal, future reached`` () =
    let f = frameWith loopRom
    let _, report, _ = SoftChip8Flux.speculateToward 50 1.0 (SoftThrottle.tank 50.0 0.0) f
    Assert.Equal(50, report.Achieved)
    Assert.False(report.Starved)
    Assert.Equal(1.0, report.Confidence, 9)
    Assert.Equal(None, SoftChip8Flux.signalIfStarved report)

[<Fact>]
let ``CONFERENCE: a banana-split (input fork) convenes the projected future selves; reconcile picks the survivor`` () =
    // at the fork, the room conferences both key-worlds; the actual present picks one, the other retracts.
    let atFork, _ = SoftChip8.lookAhead 99 (frameWith inputRom)
    match SoftChip8Flux.conferenceOnFork atFork with
    | Some conf ->
        Assert.Equal(2, conf.Futures.Length) // two future selves at the table
        let down = Array.zeroCreate 16 in down.[0xC] <- true
        let survivor = SoftChip8Flux.reconcile down conf
        // the survivor is the realized future for the pressed-key world
        Assert.Equal(Chip8Cow.step (SoftChip8Flux.applyKey 0xC true atFork), survivor)
    | None -> Assert.Fail "an input fork must convene a conference"

// ── The tick-boundary freeze property (shadow*, 2026-08-17) ────────────────────────────────
//
// `Chip8Cow.Frame` is an immutable record with TWO mutable escape hatches — `V: byte[]` and
// `Keys: bool[]`. Both are held copy-on-write by convention, and until now only ONE of the two
// had a falsifier: mutating `Chip8Cow.setV` to alias instead of `Array.copy` reddens 12 tests
// (Chip8CowTests "COW purity", "rewind", StateSpaceGuarded, MemoryLens, HierarchicalPlanning,
// …), while mutating `SoftChip8Flux.applyKey` the same way was survived by the ENTIRE F# suite
// (5272 passed, 0 failed). Same record, same discipline, opposite metering status — so the
// `Keys` half was `unmetered`, not `metered` (toy-is-free-metered-must-be-earned).
//
// This matters at the tick boundary specifically: `applyKey` is the ONE place an input crossing
// enters the `driveK` loop (`SoftChip8Flux.inputHandler`), and `Chip8Cow.step`/`tick` carry the
// `Keys` reference forward unchanged from frame to frame. So an aliasing `applyKey` writes
// through into every frame retained from an EARLIER tick — the antecedent a continuation carries
// forward would silently acquire a key-state the original tick never saw, and a DST replay would
// diverge from the run it claims to reproduce.

[<Fact>]
let ``applyKey is COW: the input crossing never writes through into the parent frame`` () =
    let parent = frameWith loopRom
    let parentKeysBefore = Array.copy parent.Keys
    let child = SoftChip8Flux.applyKey 0x5 true parent

    Assert.True(child.Keys.[0x5]) // the crossing landed in the CHILD
    Assert.False(parent.Keys.[0x5]) // and NOT in the parent
    Assert.Equal<bool[]>(parentKeysBefore, parent.Keys)
    Assert.False(System.Object.ReferenceEquals(parent.Keys, child.Keys)) // no shared buffer

[<Fact>]
let ``a key crossing at a LATER tick cannot reach back into a frame retained from an EARLIER tick`` () =
    task {
        // the antecedent a continuation would carry forward: the tick-0 frame, retained.
        let retained = frameWith loopRom
        let asOfTick0 =
            { retained with
                V = Array.copy retained.V
                Keys = Array.copy retained.Keys }

        // key C goes down on every tick from 1 onward — crossings strictly AFTER the retained frame
        let source: SoftScheduler.Source =
            fun tick ->
                [ yield TimerElapsed 17
                  if tick >= 1 then
                      yield OperatorMessageArrived(SoftChip8Flux.encodeKey 0xC true) ]

        let ctx: IntrCtx =
            { Memetic = "freeze"
              Prompt = ""
              Trust = ""
              Log = ""
              Otel = System.Diagnostics.ActivityContext() }

        let handlers = [ SoftChip8Flux.inputHandler; SoftChip8Flux.timerHandler 2 ]
        let! r = (SoftScheduler.driveK handlers source).Run ctx 1L retained 5

        match r with
        | Error e -> Assert.Fail(sprintf "room errored: %A" e)
        | Ok final ->
            Assert.True(final.Keys.[0xC]) // the crossings DID land downstream (the check is not vacuous)
            Assert.False(retained.Keys.[0xC]) // …and did not reach back across the tick boundary
            Assert.Equal<Chip8Cow.Frame>(asOfTick0, retained) // byte-identical to its tick-0 self
    }

[<Fact>]
let ``no conference on a deterministic line (the room is alone on its worldline — no banana split)`` () =
    let f = frameWith loopRom
    Assert.True((SoftChip8Flux.conferenceOnFork f).IsNone)
