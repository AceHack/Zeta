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

    /// **The recurrence prediction made LOAD-BEARING.** Return the state after
    /// `horizon` ticks — but FAST-FORWARD through detected recurrence: record the
    /// trajectory only until it enters a cycle (transient `t`, period `p`), then the
    /// state at tick `horizon` is index arithmetic `states.[t + (horizon − t) mod p]`,
    /// NOT `horizon` invocations of `step`. Work is O(reachable), independent of how
    /// large `horizon` is — the scheduler stops re-simulating a config it has proven
    /// periodic. Equal to the naive `stepⁿ start` for every `horizon` (the guarantee).
    ///
    /// **PRECONDITION on `key` — the guarantee above is CONDITIONAL, and silently so.**
    /// The cycle is detected in the PROJECTION, and the state is returned in FULL. So the
    /// equality with `stepⁿ start` holds only when `key` is injective on the reachable set
    /// (equivalently: nothing the key projects out carries state forward). Project out a
    /// component that the dynamics still advances — a coupled neighbour, a counter, a
    /// timer — and this returns a state that is stale in exactly that component, with no
    /// exception and no diagnostic. Measured, with an exact zero-coupling control, in
    /// `tests/Tests.FSharp/TimeDilation.Tests.fs`.
    ///
    /// The existing CHIP-8 caller satisfies the precondition (its ROM writes no memory and
    /// touches no display, so `chip8Key` drops only constants), but it satisfies it by
    /// ARGUMENT, not by a check — the test compares projections, so it would pass either
    /// way. Any new caller owes the same argument.
    let runToHorizon (key: 'S -> 'K) (step: 'S -> 'S) (start: 'S) (horizon: int) : 'S =
        let states = System.Collections.Generic.List<'S>()
        let index = System.Collections.Generic.Dictionary<'K, int>()
        let mutable s = start
        let mutable cyc = -1
        let mutable go = true
        while go do
            let i = states.Count
            if i > horizon then
                go <- false                         // states.[horizon] recorded — no cycle needed
            else
                let k = key s
                match index.TryGetValue k with
                | true, j -> cyc <- j; go <- false  // cycle detected at trajectory index j
                | _ ->
                    index.[k] <- i
                    states.Add s
                    s <- step s
        if cyc < 0 || horizon < states.Count then
            states.[horizon]                        // horizon lies within the recorded prefix
        else
            let p = states.Count - cyc              // period of the detected cycle
            states.[cyc + (horizon - cyc) % p]      // fast-forward by index arithmetic

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

    /// The **fixed points** of a run: the states ON the orbit it settles into (the
    /// recurrent set), in cycle order. These are what a scheduler would cache to
    /// recognise "I'm here again"; they are DERIVED (recomputable via the run-ahead),
    /// so safe to drop and regenerate.
    let orbitStates (key: 'S -> 'K) (step: 'S -> 'S) (start: 'S) : 'S list =
        let states = System.Collections.Generic.List<'S>()
        let index = System.Collections.Generic.Dictionary<'K, int>()
        let mutable s = start
        let mutable j = -1
        let mutable go = true
        while go do
            let k = key s
            match index.TryGetValue k with
            | true, jj -> j <- jj; go <- false
            | _ ->
                index.[k] <- states.Count
                states.Add s
                s <- step s
        [ for i in j .. states.Count - 1 -> states.[i] ]

    /// **Weak-referenced fixed-point table** — Aaron's "weak reference tables so the
    /// fixed points can be dynamically LOADED and UNLOADED" (Shiva/GC). The orbit is
    /// held WEAKLY: when the GC reclaims it, the next access regenerates it via the
    /// (cheap, O(reachable)) run-ahead. Because the fixed points are derived, drop-and-
    /// recompute is lossless — cogen-as-memory-management, the `SpecializationCache`
    /// philosophy applied to the scheduler's recurrence. `Unload` is the explicit
    /// Shiva sweep; the derived orbit is never *pinned*.
    [<Sealed>]
    type FixedPointCache<'S, 'K when 'K: equality and 'K: not null>
        (key: 'S -> 'K, step: 'S -> 'S, start: 'S) =
        let mutable cached: System.WeakReference<'S[]> option = None
        let mutable hits = 0
        let mutable misses = 0
        let regenerate () =
            let arr = orbitStates key step start |> List.toArray
            cached <- Some(System.WeakReference<'S[]>(arr))
            misses <- misses + 1
            arr
        /// Cache hits (the fixed points were still loaded).
        member _.Hits = hits
        /// Cache misses (first load, or a reload after the GC unloaded them).
        member _.Misses = misses
        /// Explicitly UNLOAD the fixed points (the Shiva sweep). They regenerate on
        /// next access — the derived orbit is safe to reclaim.
        member _.Unload() = cached <- None
        /// The run's fixed points — loaded from the weak table, or regenerated (O(reachable))
        /// if the GC reclaimed them. Dynamically loadable/unloadable, always exact.
        member _.Orbit() : 'S[] =
            match cached with
            | Some wr ->
                match wr.TryGetTarget() with
                | true, arr -> hits <- hits + 1; arr
                | _ -> regenerate ()
            | None -> regenerate ()

    /// **Soft GC by fingerprint selection** — Aaron: "soft GC via fingerprinting: things
    /// get GC'd whose fingerprints are not strongly currently selected … in soft mode
    /// loading a game is like having Shiva reload/calculate from zetaid the expected
    /// orbits of the games being played." Each game is registered by its FINGERPRINT
    /// (its ZetaId); its expected orbit (fixed points) is DERIVED from the game's
    /// dynamics and held while attended. `Select` is the soft-GC pass: given the current
    /// soft-selection weights (the prediction distribution over game fingerprints) and
    /// a threshold, it UNLOADS every game whose weight is below threshold (Shiva sweeps
    /// the unattended) and LOADS — regenerates from the fingerprint — every strongly-
    /// selected game. Soft, not binary: the prediction distribution is the reclaim
    /// pressure. Loading a game IS Shiva recomputing its orbits from its ZetaId.
    ///
    /// The fingerprint `'F` is the game's DATA SIGNATURE — a content hash of the ROM.
    /// **REUSE the existing signature databases; do NOT reinvent them** (Aaron): ROM
    /// identity is a hard distributed problem that humans already solved over decades —
    /// TOSEC, GoodTools (GoodNES/GoodSNES/…), and MAME's DAT files curate the CRC32 /
    /// MD5 / SHA1 signatures and the catalog metadata. A game's ZetaId keys off THAT
    /// signature (anchor-to-human-prior-art), and its expected orbits are what Shiva
    /// recomputes from the key. `'F` is deliberately generic — a TOSEC hash, a
    /// `ContentHash256`, any curated content signature serves as the fingerprint — so
    /// the table binds to the existing DBs rather than a home-grown scheme. (The next
    /// step, routed: actually READ and UNDERSTAND those catalogs' metadata.)
    [<Sealed>]
    type SoftFixedPointTable<'F, 'S, 'K when 'F: equality and 'F: comparison and 'F: not null and 'K: equality and 'K: not null>() =
        let games = System.Collections.Generic.Dictionary<'F, ('S -> 'K) * ('S -> 'S) * 'S>()
        let loaded = System.Collections.Generic.Dictionary<'F, 'S[]>()
        let mutable loads = 0

        /// Register a game (fingerprint = its ZetaId) with its dynamics (key/step/start).
        member _.Register(fingerprint: 'F, key: 'S -> 'K, step: 'S -> 'S, start: 'S) =
            games.[fingerprint] <- (key, step, start)
            loaded.Remove fingerprint |> ignore

        /// Regenerate a game's expected orbit FROM its fingerprint (Shiva calculate).
        member private _.Load(f: 'F) : 'S[] =
            let (key, step, start) = games.[f]
            let arr = orbitStates key step start |> List.toArray
            loaded.[f] <- arr
            loads <- loads + 1
            arr

        /// The expected orbit of a game — loaded from the attended table, or regenerated
        /// (O(reachable)) from its fingerprint if a soft sweep unloaded it.
        member this.Orbit(f: 'F) : 'S[] =
            match loaded.TryGetValue f with
            | true, orbit -> orbit
            | _ -> this.Load f

        /// Is a game's orbit currently LOADED (attended, not swept)?
        member _.IsLoaded(f: 'F) : bool =
            loaded.ContainsKey f

        /// Total (re)loads — Shiva calculate-from-fingerprint events.
        member _.Loads = loads

        /// **The soft-GC pass.** `weights` = the current soft-selection distribution over
        /// game fingerprints (from prediction mode). UNLOAD every registered game whose
        /// weight is below `threshold` (Shiva sweeps the unattended); LOAD (regenerate
        /// from the fingerprint) every strongly-selected game.
        member this.Select(weights: Map<'F, float>, threshold: float) =
            for KeyValue(f, _) in games do
                let w = match Map.tryFind f weights with | Some x -> x | None -> 0.0
                if w >= threshold then this.Orbit f |> ignore   // load / keep the attended
                else loaded.Remove f |> ignore                   // unload the unattended (soft GC)
