// FinalizerRuntime — the finalizer driven over git + Reticulum (Aaron: "wire the finalizer into src/Core
// runtime over git + Reticulum"). Effect-injected → DST-replayable. Run: dotnet fsi src/Core/FinalizerRuntime.test.fsx
#load "../Core.FSharp.ZetaId/Types.fs"
#load "../Core.FSharp.ZetaId/BitLayout.fs"
#load "../Core.FSharp.ZetaId/Codec.fs"
#load "Clock.fs"
#load "ReticulumLink.fs"
#load "Finalizer.fs"
#load "FinalizerRuntime.fs"
open Zeta.Core
open Zeta.Core.ReticulumLink
open Zeta.Core.FSharp.ZetaId

let mutable pass = 0
let mutable fail = 0
let ok name cond =
    if cond then pass <- pass + 1; printfn "  ok: %s" name
    else fail <- fail + 1; printfn "  FAIL: %s" name

// two Reticulum nodes (governed ZetaIds), the DST clock, an empty medium
let s0 = Scheduler.fromSeed 100L
let self = mint s0.Now 0x5E1FL Location.EastUsVa
let peer = mint s0.Now 0x9EE7L Location.WestEurope

// injected git/metrics effects: a scripted tick sequence + a merge-to-main outcome (deterministic = DST)
let effects (script: TickResult list) (merge: bool) =
    { new FinalizerRuntime.IRuntimeEffects with
        member _.ReadTick n =
            if n < List.length script then List.item n script
            else { DeltaU = 0.0; Temperature = Finalizer.cold; Bounded = true; Merged = false } // → Stop
        member _.MergeToMain _ = merge }

let warm = Finalizer.warm
// tick0 → ScaleUp ; tick1 → ReKick (merged) ; tick2 → Stop (cold)
let script =
    [ { DeltaU = 1.0; Temperature = warm; Bounded = true; Merged = false }   // ScaleUp
      { DeltaU = 1.0; Temperature = warm; Bounded = true; Merged = true }    // ReKick
      { DeltaU = 0.0; Temperature = Finalizer.cold; Bounded = true; Merged = false } ] // Stop

let runWith merge =
    FinalizerRuntime.run 50 self peer (effects script merge) Finalizer.decide s0 empty

printfn "FinalizerRuntime (finalizer over git + Reticulum, DST):"

// 1. drives the finalizer over the substrates: ScaleUp → ReKick → Stop
let trace = runWith true
let actions = trace |> List.map (fun st -> st.Action)
ok "drives finalizer: ScaleUp -> ReKick -> Stop"
    (actions = [ FinalizerAction.ScaleUp 1; FinalizerAction.ReKick; FinalizerAction.Stop ])

// 2. ReKick = the git merge-to-main recursion edge (Merged=true → next wave ran)
ok "ReKick triggered git merge-to-main (Merged=true)"
    (trace |> List.exists (fun st -> st.Action = FinalizerAction.ReKick && st.Merged))

// 3. ends on Stop (converged)
ok "runtime ends on Stop" (List.last actions = FinalizerAction.Stop)

// 4. each tick ran at self (the node), over the announced link
ok "ticks ran at self over the link" (trace |> List.forall (fun st -> st.AtNode = self))

// 5. DST replay: same (effects, seed, medium) → identical trace
let trace2 = runWith true
ok "DST replay: identical step trace" (trace = trace2)

// 6. ReKick with NO merge (git didn't merge) → the wave stops there (no next wave)
let noMerge = runWith false
ok "ReKick without merge stops the wave (no next wave)"
    (List.last (noMerge |> List.map (fun st -> st.Action)) = FinalizerAction.ReKick
     && (noMerge |> List.last).Merged = false)

// 7. bounded: an always-ReKick+merge script terminates at budget (no fork-bomb)
let alwaysReKick = List.replicate 5 { DeltaU = 1.0; Temperature = warm; Bounded = true; Merged = true }
let bounded = FinalizerRuntime.run 4 self peer (effects alwaysReKick true) Finalizer.decide s0 empty
ok "bounded: always-ReKick run terminates at budget (no fork-bomb)" (List.length bounded <= 4)

printfn "FinalizerRuntime: %d passed, %d failed" pass fail
if fail = 0 then printfn "FinalizerRuntime: ALL PASS (finalizer wired over git + Reticulum; DST-replayable; bounded)."
else exit 1
