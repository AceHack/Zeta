// FinalizerRuntimeLive — the live IRuntimeEffects (real git merge + RNS), wired SAFE + Core-pure (injected
// runner). Aaron: "wire the real git merge + RNS daemon behind IRuntimeEffects." Run: dotnet fsi src/Core/FinalizerRuntimeLive.test.fsx
#load "../Core.FSharp.ZetaId/Types.fs"
#load "../Core.FSharp.ZetaId/BitLayout.fs"
#load "../Core.FSharp.ZetaId/Codec.fs"
#load "Clock.fs"
#load "ReticulumLink.fs"
#load "Finalizer.fs"
#load "FinalizerRuntime.fs"
#load "FinalizerRuntimeLive.fs"
open Zeta.Core
open Zeta.Core.ReticulumLink
open Zeta.Core.FSharp.ZetaId

let mutable pass = 0
let mutable fail = 0
let ok name cond =
    if cond then pass <- pass + 1; printfn "  ok: %s" name
    else fail <- fail + 1; printfn "  FAIL: %s" name

printfn "FinalizerRuntimeLive (real git/RNS behind the seam, SAFE + Core-pure):"

// --- SAFE DEFAULT: dry-run runner does nothing ---
// ReadTick via dryRun ("") → a cold Stop tick (the runtime halts immediately under dry-run)
let dryEff = FinalizerRuntimeLive.create false FinalizerRuntimeLive.dryRun (fun _ -> 0)
let t0 = dryEff.ReadTick 0
ok "dry-run ReadTick → cold tick (Temperature 0 ⇒ Stop)" (t0.Temperature = 0.0 && Finalizer.decide t0 = FinalizerAction.Stop)
ok "dry-run MergeToMain → false (NEVER merges)" (dryEff.MergeToMain 0 = false)

// even with live=true, a dry-run runner reports no success ⇒ no merge
let liveDry = FinalizerRuntimeLive.create true FinalizerRuntimeLive.dryRun (fun _ -> 7)
ok "live=true but dry runner ⇒ MergeToMain false (no host = no merge)" (liveDry.MergeToMain 0 = false)

// --- parseTick is lenient + correct ---
ok "parseTick parses 'deltaU temp bounded merged'"
    (let t = FinalizerRuntimeLive.parseTick "1.0 0.5 true true" in
     t.DeltaU = 1.0 && t.Temperature = 0.5 && t.Bounded && t.Merged)
ok "parseTick empty → cold Stop tick" (FinalizerRuntimeLive.parseTick "" = { DeltaU=0.0; Temperature=0.0; Bounded=true; Merged=false })

// --- INJECTED FAKE HOST RUNNER: deterministic, proves the gate-respecting merge path without real I/O ---
// the fake host: returns scripted git-state for ReadTick, and "ok" for the gh-auto-merge command
let scripted =
    [ "tick-state 0", "1.0 0.5 true false"   // ScaleUp
      "tick-state 1", "1.0 0.5 true true"    // ReKick
      "tick-state 2", "0.0 0.0 true false" ] // Stop
let fakeHost (cmd: string) : string =
    if cmd.StartsWith("gh pr merge") then FinalizerRuntimeLive.MergeOk      // gate-respecting auto-merge ⇒ ok
    else match List.tryFind (fun (k, _) -> k = cmd) scripted with Some (_, v) -> v | None -> ""
let liveEff = FinalizerRuntimeLive.create true fakeHost (fun _ -> 7)

ok "live MergeToMain via fake gh-auto-merge ⇒ true (gate-respecting)" (liveEff.MergeToMain 1 = true)
ok "live ReadTick parses scripted git-state" ((liveEff.ReadTick 0).DeltaU = 1.0)

// --- end-to-end: drive the FinalizerRuntime with the LIVE effects ---
let s0 = Scheduler.fromSeed 100L
let self = mint s0.Now 0x1L Location.EastUsVa
let peer = mint s0.Now 0x2L Location.WestEurope
let trace = FinalizerRuntime.run 50 self peer liveEff Finalizer.decide s0 empty
let actions = trace |> List.map (fun st -> st.Action)
ok "end-to-end live: ScaleUp -> ReKick(merged) -> Stop"
    (actions = [ FinalizerAction.ScaleUp 1; FinalizerAction.ReKick; FinalizerAction.Stop ]
     && (trace |> List.exists (fun st -> st.Action = FinalizerAction.ReKick && st.Merged)))

printfn "FinalizerRuntimeLive: %d passed, %d failed" pass fail
if fail = 0 then printfn "FinalizerRuntimeLive: ALL PASS (safe dry-run default; gate-respecting auto-merge; Core-pure injected I/O)."
else exit 1
