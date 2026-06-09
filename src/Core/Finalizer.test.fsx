// Finalizer framework test — proves the prod=test engine: decide (temperature scaling) + run
// (the bounded self-scaling loop converges + terminates; not a fork-bomb). Run: dotnet fsi Finalizer.test.fsx
#load "Finalizer.fs"
open Zeta.Core

let mutable failed = 0
let check name cond = if cond then printfn "  ok: %s" name else (failed <- failed + 1; eprintfn "  FAIL: %s" name)
let tick dU temp bounded merged = { DeltaU = dU; Temperature = temp; Bounded = bounded; Merged = merged }

printfn "decide (the default finalizer — temperature + uncertainty-Δ auto-scale):"
check "unbounded -> Quarantine"        (Finalizer.decide (tick 1.0 0.5 false true)  = FinalizerAction.Quarantine)
check "hot (>=1) -> ScaleDown (cool)"  (Finalizer.decide (tick 1.0 1.0 true true)   = FinalizerAction.ScaleDown 1)
check "cold (<=0) -> Stop (rest)"      (Finalizer.decide (tick 1.0 0.0 true true)   = FinalizerAction.Stop)
check "dU>0 + merged -> ReKick"        (Finalizer.decide (tick 1.0 0.5 true true)   = FinalizerAction.ReKick)
check "dU>0 not merged -> ScaleUp"     (Finalizer.decide (tick 1.0 0.5 true false)  = FinalizerAction.ScaleUp 1)
check "dU=0 -> Hold"                   (Finalizer.decide (tick 0.0 0.5 true false)  = FinalizerAction.Hold)

printfn "run (the bounded self-scaling loop — terminates + converges, no fork-bomb):"
// a step that always re-kicks: must still TERMINATE at the budget (bounded; not infinite)
let reKickForever _ = tick 1.0 0.5 true true
let trace1 = Finalizer.run 10 reKickForever Finalizer.decide
check "budget caps an always-ReKick loop (bounded)" (List.length trace1 = 11)            // 10 ReKick + final Stop
check "always-ReKick ends in Stop (terminates)"      (List.last trace1 = FinalizerAction.Stop)
check "no fork-bomb (finite trace)"                  (List.length trace1 <= 11)
// a step that goes cold at tick 3: must converge EARLY on Stop
let coolsAt3 n = tick 1.0 (if n >= 3 then 0.0 else 0.5) true true
let trace2 = Finalizer.run 100 coolsAt3 Finalizer.decide
check "cools at 3 -> converges early on Stop"        (List.last trace2 = FinalizerAction.Stop)
check "converges before the budget"                  (List.length trace2 < 100)
check "createDefault IFinalizer decides like decide" ((Finalizer.createDefault()).Decide (tick 1.0 0.5 true true) = FinalizerAction.ReKick)

if failed = 0 then printfn "Finalizer: ALL PASS (engine proven: temperature scaling + bounded convergence)."
else (eprintfn "Finalizer: %d FAILED" failed; exit 1)
