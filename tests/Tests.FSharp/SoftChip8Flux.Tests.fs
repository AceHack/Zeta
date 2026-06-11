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
