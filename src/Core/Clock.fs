namespace Zeta.Core

open System.Runtime.CompilerServices

/// The clock primitive — a monotonic logical clock giving TOTAL order over the
/// event log, plus an injectable deterministic scheduler (Rx `IScheduler` shape)
/// so the same timeline replays identically from a seed (DST). The foundation
/// the cost curve + curvature (∂/∂²) are defined over: without a proven temporal
/// index, "the curve over time" is not well-defined.
///
/// Three sources, one idea — time is an INJECTED, deterministic, monotonic
/// parameter, never ambient wall-clock:
///   - FoundationDB **versionstamp**  → single-sequencer monotonic commit version
///     = TOTAL order over the log (Zhou et al.; FDB sequencer).
///   - Rx **IScheduler**              → time as an injectable parameter; a virtual
///     scheduler ticks deterministically (Meijer/Rx `HistoricalScheduler`).
///   - **DST** (manifesto §7)         → seed → same tick sequence → same curve.
/// Lamport (1978, "Time, Clocks, and the Ordering of Events") is the logical-clock
/// anchor; `z⁻¹` (DBSP delay) shifts by exactly one tick = one versionstamp
/// increment = one scheduler step — the SAME unit at three layers.
///
/// Proven in tests/Tests.FSharp/Formal/Clock.Laws.Tests.fs (Z3 order axioms +
/// FsCheck laws + DST replay against the shared seed). Single-writer = total
/// order (here); distributed = causal order + CRDT join (Crdt.fs) — total order
/// is the degenerate single-sequencer case.

/// A versionstamp: a monotonic logical-clock value. Its `Version` is the
/// single-sequencer commit version (FDB shape, distilled to the int64 essence for
/// the total-order proof). Strictly increasing; totally ordered.
[<Struct; IsReadOnly>]
type Versionstamp =
    { Version: int64 }

[<RequireQualifiedAccess>]
module Versionstamp =

    /// The origin of the timeline.
    let zero: Versionstamp = { Version = 0L }

    let inline ofInt64 (v: int64) : Versionstamp = { Version = v }

    /// Advance by one tick — the forward unit step (inverse of `z⁻¹` delay).
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let tick (v: Versionstamp) : Versionstamp = { Version = Checked.(+) v.Version 1L }

    /// The previous stamp (`z⁻¹` delay): the inverse of `tick`. `delay (tick v) = v`.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    let delay (v: Versionstamp) : Versionstamp = { Version = Checked.(-) v.Version 1L }

    /// Total-order comparison (-1 / 0 / +1).
    let compare (a: Versionstamp) (b: Versionstamp) : int = compare a.Version b.Version

    /// Strict happens-before (total order, single-writer): a precedes b.
    let isBefore (a: Versionstamp) (b: Versionstamp) : bool = a.Version < b.Version


/// An injectable deterministic scheduler (Rx `IScheduler` shape). `Now` is the
/// current logical time; `step` advances it one tick. Seeded → replays identically.
[<Struct; IsReadOnly>]
type Scheduler =
    { Now: Versionstamp }

[<RequireQualifiedAccess>]
module Scheduler =

    /// Construct a scheduler at a seed version — the injectable starting point.
    let fromSeed (seed: int64) : Scheduler = { Now = Versionstamp.ofInt64 seed }

    /// Advance the scheduler by one tick (one versionstamp increment).
    let step (s: Scheduler) : Scheduler = { Now = Versionstamp.tick s.Now }

    /// The deterministic timeline: the stamps produced by `n` steps from the seed.
    /// DST core — pure function of (seed, n), so every replay is identical.
    let run (seed: int64) (n: int) : Versionstamp list =
        let rec loop (s: Scheduler) (k: int) (acc: Versionstamp list) =
            if k <= 0 then List.rev acc
            else
                let s' = step s
                loop s' (k - 1) (s'.Now :: acc)
        loop (fromSeed seed) n []
