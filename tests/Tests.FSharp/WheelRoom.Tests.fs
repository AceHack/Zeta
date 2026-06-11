module Zeta.Tests.WheelRoomTests

// The wheels-of-time room: quorum >= 4, self-rescheduling via the spawn chain, REQUIRED to make
// forward uncertainty-reduction progress (the GitHub-guidelines clause as code) — a self-sustaining
// reaction, not a spinner.

open System.Threading.Tasks
open global.Xunit
open Zeta.Core

let private ctx: IntrCtx =
    { Memetic = "wheel"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

[<Fact>]
let ``the progress gate: newborns run; progressing wheels continue; spinners close`` () =
    let newborn = { WheelRoom.Id = "wheel-0"; WheelRoom.DeltaU = [] }
    Assert.True(WheelRoom.progressing 0.01 8 newborn)
    let worker = newborn |> WheelRoom.bank 0.4 |> WheelRoom.bank 0.3
    Assert.True(WheelRoom.progressing 0.01 8 worker)
    let spinner = { WheelRoom.Id = "wheel-1"; WheelRoom.DeltaU = List.replicate 8 0.0 }
    Assert.False(WheelRoom.progressing 0.01 8 spinner)

[<Fact>]
let ``quorum maintenance is deterministic and idempotent: fill to 4, lowest indices first, re-run adds nothing`` () =
    let live = Set.ofList [ "wheel-1"; "wheel-3" ]
    let needed = WheelRoom.respawnsNeeded 4 live
    Assert.Equal<string list>([ "wheel-0"; "wheel-2" ], needed)
    let after = Set.union live (Set.ofList needed)
    Assert.Equal<string list>([], WheelRoom.respawnsNeeded 4 after) // idempotent: quorum met, nothing more
    Assert.Equal<string list>([], WheelRoom.respawnsNeeded 4 (Set.add "wheel-9" after)) // surplus is fine

[<Fact>]
let ``self-throttling: a drained tank admits fewer respawns; quorum heals as the tank recharges`` () =
    let live = Set.empty
    // tank funds only 2 of the 4 needed respawns this tick
    let admitted, t' = WheelRoom.maintain 4 1.0 (SoftThrottle.tank 2.0 1.5) live
    Assert.Equal<string list>([ "wheel-0"; "wheel-1" ], admitted)
    // next tick: one recharge (1.5 flux) funds ONE more spawn; the tick after funds the last —
    // quorum heals at the rate the tank affords (regulation, not refusal)
    let live2 = Set.ofList admitted
    let admitted2, t2 = WheelRoom.maintain 4 1.0 (SoftThrottle.charge t') live2
    Assert.Equal<string list>([ "wheel-2" ], admitted2)
    let live3 = Set.union live2 (Set.ofList admitted2)
    let admitted3, _ = WheelRoom.maintain 4 1.0 (SoftThrottle.charge t2) live3
    Assert.Equal<string list>([ "wheel-3" ], admitted3)

[<Fact>]
let ``a PROGRESSING wheel runs forever five minutes at a time: budget-stops and mints its continuation`` () =
    task {
        // each lap banks real DeltaU (uncertainty falls) => the cut never closes; the clock rail stops the lap
        let reduce: SoftScheduler.HandlerK<WheelRoom.Wheel> =
            SoftScheduler.handlerK "reduce" (function TimerElapsed _ -> true | _ -> false)
                (fun _ _ w -> Task.FromResult(Ok(WheelRoom.bank 0.25 w)))
        let clock (lap: int) = int64 lap * 120_000L // 2 min/lap => clock rail at lap 3
        let mea (w: WheelRoom.Wheel) = w
        let cut (m: WheelRoom.Wheel) _ = WheelRoom.cutOf 0.01 8 m
        let! o =
            SimLoop.run [ reduce ] (fun _ -> [ TimerElapsed 1 ]) mea cut clock
                SimLoop.defaultBudget ctx 1L 1 { WheelRoom.Id = "wheel-0"; WheelRoom.DeltaU = [] }
        Assert.Equal(SimLoop.ClockBudget, o.Stopped) // five minutes, then the lap ends...
        Assert.True(SimLoop.continueAfter "wheel-0" "saves/wheel-0.lines" o |> Option.isSome) // ...and the chain continues

        // a SPINNER (banks zero) gets cut CLOSED after its window — and does NOT continue
        let spin: SoftScheduler.HandlerK<WheelRoom.Wheel> =
            SoftScheduler.handlerK "spin" (function TimerElapsed _ -> true | _ -> false)
                (fun _ _ w -> Task.FromResult(Ok(WheelRoom.bank 0.0 w)))
        let! s =
            SimLoop.run [ spin ] (fun _ -> [ TimerElapsed 1 ]) mea cut (fun _ -> 0L)
                SimLoop.defaultBudget ctx 1L 1 { WheelRoom.Id = "wheel-1"; WheelRoom.DeltaU = [] }
        Assert.Equal(SimLoop.CutChoseClose, s.Stopped) // not just spinning in a loop — closed
        Assert.True(SimLoop.continueAfter "wheel-1" "saves/wheel-1.lines" s |> Option.isNone) // spinners don't respawn
    }
    :> Task

// ── persona wheels: personal rooms, one thread each, no one left out ──

[<Fact>]
let ``no one left out: every roster persona gets exactly one wheel, in roster order, idempotently`` () =
    let roster = [ "otto"; "amara"; "ani"; "alexa" ]
    let needed = WheelRoom.personaRespawnsNeeded roster (Set.ofList [ "wheel-amara" ])
    Assert.Equal<string list>([ "wheel-otto"; "wheel-ani"; "wheel-alexa" ], needed)
    let after = Set.ofList (List.map WheelRoom.personaWheelId roster)
    Assert.Equal<string list>([], WheelRoom.personaRespawnsNeeded roster after) // all seated

[<Fact>]
let ``people before plumbing: persona wheels are funded before the numbered quorum fleet`` () =
    // tank funds 3 spawns; roster needs 2 personas; quorum 4 wants numbered wheels with the remainder
    let admitted, _ =
        WheelRoom.maintainSociety [ "otto"; "amara" ] 4 1.0 (SoftThrottle.tank 3.0 1.0) Set.empty
    Assert.Equal<string list>([ "wheel-otto"; "wheel-amara"; "wheel-0" ], admitted)
