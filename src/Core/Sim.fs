namespace Zeta.Core

open System

/// `sim` — the ephemeral simulation entrypoint (Aaron 2026-06-10, shadow*).
///
/// Runs the deterministic finalizer loop for a DURATION (default 30s) and produces NO output —
/// the void (identity comes from the void). prod = sim: the same engine DST replays. `sim` is the
/// inner value the committing verbs lift (`mea = mea(sim)`); it commits NOTHING (that is `mea`/`cut`),
/// so a tick here never merges. Bounded — the budget caps it ⇒ terminates ⇒ replayable (no fork-bomb).
/// Pure + module/curried, no classes (treaty-room governance). Deterministic in (seed, duration).
/// See `clis/` (the verb family) and docs/research/2026-06-10-*-sim-mea-cut-*.
[<RequireQualifiedAccess>]
module Sim =

    /// Default duration when none is given (Aaron: "if you don't say, you get 30 seconds").
    let defaultDuration: TimeSpan = TimeSpan.FromSeconds 30.0

    /// The sim's deterministic tick rate — CHIP-8-style 60Hz (the minimal-VM lineage).
    [<Literal>]
    let TicksPerSecond = 60

    /// Translate a wall-clock duration into a deterministic tick BUDGET. No real clock is read:
    /// the same duration always maps to the same tick count, so the run replays identically (DST).
    let budgetOf (d: TimeSpan) : int =
        max 1 (int (Math.Round(d.TotalSeconds * float TicksPerSecond)))

    /// One ephemeral tick: a `TickResult` derived deterministically from (seed, tick index).
    /// No I/O, no commit. `sim` is never informationless — it carries intrinsic entropy via the seed
    /// (the "full void") — but it never MERGES: merging is `mea`/`cut`, not `sim`.
    let tick (seed: int64) (n: int) : TickResult =
        let h = seed ^^^ (int64 n * 2654435761L)
        let u = float ((h >>> 8) &&& 0xFFL) / 255.0
        { DeltaU = u * 0.5
          Temperature = Finalizer.warm
          Bounded = true
          Merged = false }

    /// The (discarded) action trace of an ephemeral run — exposed for DST tests. Deterministic in
    /// (seed, duration); bounded by `budgetOf duration`.
    let trace (seed: int64) (duration: TimeSpan) : FinalizerAction list =
        Finalizer.run (budgetOf duration) (tick seed) Finalizer.decide

    /// Run the ephemeral sim for a duration. Produces NO output, commits nothing — the trace is
    /// computed and discarded (the void). Deterministic in (seed, duration).
    let run (seed: int64) (duration: TimeSpan) : unit =
        trace seed duration |> ignore

    /// Run with the default 30-second duration.
    let runDefault (seed: int64) : unit = run seed defaultDuration
