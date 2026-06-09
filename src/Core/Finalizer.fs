namespace Zeta.Core

/// Finalizer framework — the prod=test engine (Aaron 2026-06-09, shadow*; Max agrees on temperature).
/// A bounded tick runs; its FINALIZER decides the end-of-tick action: scale up/down (by TEMPERATURE),
/// merge-to-main (advance / the recursion edge) or quarantine a failed branch, re-kick the next wave or
/// stop. Choosable (each test picks an IFinalizer); the default reads metrics (uncertainty-Δ) +
/// temperature and auto-scales toward the warm middle. Bounded (0-unbounded; the budget caps it;
/// converges via Stop — not a fork-bomb). Interfaces + currying, no classes (treaty-room governance).
/// Temperature poles tie vocab/temperatures/ (cold/warm/hot). DST (replayable). 
/// 

/// The result of a bounded tick — the metrics the finalizer reads (metrics = test history).
type TickResult =
    { DeltaU: float        // uncertainty-Δ (> 0 = uncertainty reduced; the one metric)
      Temperature: float   // [0,1]: cold→0 (rest), warm≈0.5 (alive), hot→1 (runaway)
      Bounded: bool        // stayed within its step budget? (the 0-unbounded invariant)
      Merged: bool }       // proven state merged to main (past GVT)?

/// What a finalizer decides at tick end.
[<RequireQualifiedAccess>]
type FinalizerAction =
    | ScaleUp of int       // spawn n more ticks (toward ⊤; ΔU high + worth it)
    | ScaleDown of int     // terminate n ticks (toward ⊥; rest / cool a runaway)
    | Hold                 // steady (ΔU ≈ 0)
    | Quarantine           // failed/unbounded tick → open branch for an investigation tick
    | ReKick               // merged to main → start the next wave (the recursion edge)
    | Stop                 // converged / budget exhausted

/// A finalizer: decide the end-of-tick action from the tick result. Choosable per test.
type IFinalizer =
    abstract member Decide: TickResult -> FinalizerAction

/// Default finalizer + the bounded self-scaling loop (a module, not a class).
[<RequireQualifiedAccess>]
module Finalizer =

    let cold = 0.0
    let warm = 0.5
    let hot = 1.0

    /// The DEFAULT finalizer (curried): read ΔU + temperature, auto-scale toward the warm middle.
    let decide (r: TickResult) : FinalizerAction =
        if not r.Bounded then FinalizerAction.Quarantine
        elif r.Temperature >= hot then FinalizerAction.ScaleDown 1
        elif r.Temperature <= cold then FinalizerAction.Stop
        elif r.DeltaU > 0.0 && r.Merged then FinalizerAction.ReKick
        elif r.DeltaU > 0.0 then FinalizerAction.ScaleUp 1
        else FinalizerAction.Hold

    /// The default finalizer as an IFinalizer (choosable; other finalizers swap this).
    let createDefault () : IFinalizer =
        { new IFinalizer with
            member _.Decide(r) = decide r }

    /// The bounded self-scaling loop (curried): run budget step finalize -> the action trace.
    /// Bounded (the budget caps it -> terminates -> replayable); converges on Stop.
    let run (budget: int) (step: int -> TickResult) (finalize: TickResult -> FinalizerAction) : FinalizerAction list =
        let rec loop n acc =
            if n >= budget then List.rev (FinalizerAction.Stop :: acc)
            else
                let action = finalize (step n)
                match action with
                | FinalizerAction.Stop -> List.rev (action :: acc)
                | _ -> loop (n + 1) (action :: acc)
        loop 0 []
