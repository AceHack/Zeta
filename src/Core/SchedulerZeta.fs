namespace Zeta.Core

// ═══════════════════════════════════════════════════════════════════
//  SchedulerZeta — the Artin–Mazur dynamical zeta wired at the scheduler
//  layer, so a (soft) scheduler can PREDICT ITS OWN RECURRENCE SPECTRUM
//  before running the full budget: which states are transient, which orbit
//  it settles into, and its period (the "character loop"). The formal,
//  math-grounded basis for the ad-hoc CHIP-8 / IScheduler self-prediction
//  (RESUME step 4; #9151 Artin–Mazur scheduler zeta, #9165 CHIP-8).
//
//  A DoP=1, seed-fixed soft-scheduler tick IS a deterministic map on state
//  (run(1)==run(N) — CellScheduler's law). Give SchedulerZeta that per-tick
//  `step : 'S -> 'S` plus a `key : 'S -> 'K` projecting to a finite
//  observable (so the reachable set is finite), and it computes the
//  Artin–Mazur zeta of the reachable dynamics. `predict` is run-ahead: it
//  iterates only until a state repeats — never the caller's whole budget —
//  and reports the orbit the run will settle into. That is the loop
//  modelling its own recurrence before it happens.
// ═══════════════════════════════════════════════════════════════════

[<RequireQualifiedAccess>]
module SchedulerZeta =

    /// The recurrence of a run from a start state: how many transient ticks
    /// precede the cycle, the orbit length (period), and the reachable-state count.
    type Recurrence =
        { Transient: int
          Period: int
          Reachable: int }

    /// **Run-ahead self-prediction.** Iterate `step` (observed through `key`) from
    /// `start` until a projected state repeats, and report the recurrence — WITHOUT
    /// running the caller's full budget. Terminates within `|key-space|` ticks (a
    /// finite projection ⇒ a repeat is forced). This is the scheduler predicting the
    /// orbit (the character loop) it will settle into, and its period.
    let predict (key: 'S -> 'K) (step: 'S -> 'S) (start: 'S) : Recurrence =
        let seen = System.Collections.Generic.Dictionary<'K, int>()
        let mutable s = start
        let mutable i = 0
        let mutable result = { Transient = 0; Period = 0; Reachable = 0 }
        let mutable go = true
        while go do
            let k = key s
            match seen.TryGetValue k with
            | true, j -> result <- { Transient = j; Period = i - j; Reachable = i }; go <- false
            | _ ->
                seen.[k] <- i
                s <- step s
                i <- i + 1
        result

    /// The Artin–Mazur zeta of one run's orbit: ζ = 1/(1 − u^Period) as an integer
    /// series (1 exactly at multiples of the period).
    let zetaOfRun (r: Recurrence) (maxDeg: int) : int64[] =
        Array.init (maxDeg + 1) (fun d -> if r.Period > 0 && d % r.Period = 0 then 1L else 0L)

    /// The Artin–Mazur zeta of a set of orbits: Π 1/(1 − u^Lᵢ), integer series.
    let zetaOfOrbits (orbitLengths: int list) (maxDeg: int) : int64[] =
        let mutable series = Array.zeroCreate (maxDeg + 1)
        series.[0] <- 1L
        for L in orbitLengths do
            let geom = Array.init (maxDeg + 1) (fun d -> if L > 0 && d % L = 0 then 1L else 0L)
            let prod = Array.zeroCreate (maxDeg + 1)
            for i in 0 .. maxDeg do
                for j in 0 .. maxDeg - i do
                    prod.[i + j] <- prod.[i + j] + series.[i] * geom.[j]
            series <- prod
        series

    /// The FULL recurrence spectrum over an explicitly-enumerable finite config space:
    /// the orbit lengths of the reachable map (all cycles the scheduler can settle
    /// into). Use when the scheduler can enumerate its config space (small societies,
    /// bounded projections). Its `zetaOfOrbits` self-verifies against `exp(Σ Fix f^k)`.
    let spectrum (key: 'S -> 'K) (step: 'S -> 'S) (states: 'S list) : int list =
        // key -> its image key (the projected functional graph over the given states)
        let next = System.Collections.Generic.Dictionary<'K, 'K>()
        for s in states do
            if not (next.ContainsKey(key s)) then next.[key s] <- key (step s)
        // a projected state is periodic iff iterating `next` |next| times lands on it
        let n = next.Count
        let onCycle = System.Collections.Generic.HashSet<'K>()
        for KeyValue(k0, _) in next do
            let mutable y = k0
            for _ in 1 .. n do
                match next.TryGetValue y with
                | true, z -> y <- z
                | _ -> ()
            onCycle.Add y |> ignore
        // decompose the recurrent set into cycles
        let seen = System.Collections.Generic.HashSet<'K>()
        [ for KeyValue(k0, _) in next do
            if onCycle.Contains k0 && not (seen.Contains k0) then
                let mutable len = 0
                let mutable y = k0
                let mutable go = true
                while go do
                    seen.Add y |> ignore
                    y <- next.[y]
                    len <- len + 1
                    if y = k0 then go <- false
                yield len ]

    /// `Fix(f^k)` over an enumerable state space (for self-verification: the number of
    /// projected states fixed by the k-th iterate of the reachable map).
    let fixCount (key: 'S -> 'K) (step: 'S -> 'S) (states: 'S list) (k: int) : int64 =
        let next = System.Collections.Generic.Dictionary<'K, 'K>()
        for s in states do
            if not (next.ContainsKey(key s)) then next.[key s] <- key (step s)
        let iterate k0 =
            let mutable y = k0
            for _ in 1 .. k do y <- (match next.TryGetValue y with | true, z -> z | _ -> y)
            y
        next.Keys |> Seq.filter (fun k0 -> iterate k0 = k0) |> Seq.length |> int64
