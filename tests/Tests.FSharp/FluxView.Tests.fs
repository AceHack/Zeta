module Zeta.Tests.FluxViewTests

// Seeing the flux capacitor and the interrupt handler: soft mode is a RAMP, hard mode is a CLIFF —
// the difference between the modes IS the picture. Plus the tank's heartbeat and driveK's switchboard.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``SOFT vs HARD is visible: the logistic ramps smoothly; the step is a cliff (one jump)`` () =
    let curveCol (lines: string list) cIx =
        lines |> List.findIndex (fun l -> l.[cIx] = '#') // the curve's row in this column
    let soft = FluxView.admissionCurve true 6.0 9 33
    let hard = FluxView.admissionCurve false 0.0 9 33
    // soft: adjacent columns never jump more than 2 rows (a ramp you can ride)
    let softJumps = [ for c in 0..31 -> abs (curveCol soft (c + 1) - curveCol soft c) ]
    Assert.True(List.max softJumps <= 2)
    // hard: exactly one place where the curve falls the full height (the cliff)
    let hardJumps = [ for c in 0..31 -> abs (curveCol hard (c + 1) - curveCol hard c) ]
    Assert.True(List.max hardJumps >= 7)
    Assert.Equal(1, hardJumps |> List.filter (fun j -> j >= 7) |> List.length)

[<Fact>]
let ``the tank gauge shows charge and heat at a glance, proportionally`` () =
    let full = SoftThrottle.tank 10.0 1.0
    let g = FluxView.tankGauge 10 full
    Assert.StartsWith("[██████████]", g)
    Assert.Contains("heat 0.0", g)
    let drained = match SoftThrottle.discharge 7.0 full with Some t -> t | None -> full
    let g2 = FluxView.tankGauge 10 drained
    Assert.StartsWith("[███░░░░░░░]", g2)
    Assert.Contains("heat 7.0", g2) // the thermometer reads the spent flux

[<Fact>]
let ``the flux timeline breathes: bursts drain the columns, idle ticks recover them`` () =
    let t0 = SoftThrottle.tank 8.0 1.0
    let load tick = if tick < 4 then 2.0 else 0.0 // burst then rest
    let line = FluxView.timeline 12 load t0
    Assert.Equal(12, line.Length)
    Assert.True(line.[3] < line.[11]) // drained low during the burst, recovered by the end (block chars order by height)
    // r3-final (test-gap #12): one pair passes non-recovering noise — the idle stretch must be
    // MONOTONE non-decreasing (the tank refills, never dips, with zero load)
    for i in 5 .. 10 do
        Assert.True(line.[i] <= line.[i + 1], sprintf "recovery dipped at tick %d" i)

[<Fact>]
let ``the interrupt grid shows the switchboard: who matched, who passed, when it was silent`` () =
    let handlers =
        [ "chip8-input", (function OperatorMessageArrived _ -> true | _ -> false)
          "chip8-60hz", (function TimerElapsed _ -> true | _ -> false) ]
    let source: SoftScheduler.Source =
        fun tick ->
            if tick = 0 then [ TimerElapsed 17 ]
            elif tick = 2 then [ OperatorMessageArrived "key:5:1"; TimerElapsed 17 ]
            else []
    let grid = FluxView.interruptGrid handlers source 4
    Assert.Equal(2, List.length grid)
    Assert.Contains("chip8-input", grid.[0])
    // r3-final: audited as "half-pinned" (test-gap #7) — now fully pinned to prevent silent migration
    Assert.Equal("chip8-input      · ■ ", grid.[0])
    Assert.Equal("chip8-60hz       ■ ■ ", grid.[1])

[<Fact>]
let ``the views are registered, cost-declared, and the budget lint still holds shelf-wide`` () =
    for v in [ "view.flux-curve"; "view.flux-gauge"; "view.flux-timeline"; "view.interrupt-grid" ] do
        Assert.True(GeneratorRegistry.byName v |> Option.isSome)
    Assert.Equal<string list>([], ComplexityRegistry.unstated ())
