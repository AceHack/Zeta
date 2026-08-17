namespace Zeta.Core

/// **`Chip8ConsultCensus` — does the CONSULT path post-select? (Aaron 2026-08-17, register row R-1.)**
///
/// `Chip8CrossRunStore` retains endings as first-class verdicts: a halted orbit is recorded *as* halted,
/// and budget exhaustion is `OpenAtBound`, a distinct constructor that cannot be misread as closure. So
/// the **write** path cannot post-select — the artifact set is complete with respect to how orbits end.
///
/// **Store completeness does not imply an unbiased sample.** If only *continuing* orbits are ever READ —
/// because those are the ones a room asks for, or the ones that pay off — the effective sample is
/// post-selected even though the stored set is not. A criterion of the form *"useful = the run continues"*
/// evaluated against a read-set filtered for continuation is measuring its own filter, not the world.
/// That is the hidden-oracle failure in its purest form, and this module is the instrument for it.
///
/// **What this module does and does not decide.** It reports two empirical distributions over the SAME
/// four verdict buckets — one over the artifacts *stored*, one over the artifacts *read* — plus their
/// total-variation distance. It attaches **no threshold** and returns **no verdict**: "how different is
/// too different" is a policy question with no defensible constant, and inventing one here would be the
/// same defect one layer up. Matching distributions are consistent with the criterion measuring the
/// world; over-representation of non-terminating orbits among reads is the post-selection signature.
///
/// **Anchors (checked, not gestured at):**
///   - Total variation distance `d_TV(p,q) = (1/2) * sum_i |p_i - q_i|` — Levin, Peres & Wilmer,
///     *Markov Chains and Mixing Times*, 2nd ed. (AMS 2017) SS4.1. Parameter-free: it needs no tuned
///     constant, which is exactly why it is the statistic used here.
///   - Post-selection as manufactured conspiracy: conditioning on an outcome makes the conditioned
///     history look designed with no backward influence in the mechanism. Berkson, *"Limitations of the
///     application of fourfold table analysis to hospital data"*, Biometrics Bulletin 2, 47-53 (1946) —
///     collider/selection bias, the same shape.
///   - Carse, *Finite and Infinite Games* (1986) — the source of the *"useful = the game continues"*
///     criterion this measurement guards. Named because it is the claim at risk, not as a proof of it.
///
/// **Noninterference (SS13): this module performs ZERO file IO and holds ZERO mutable state.** The read
/// sink is an injected function, so instrumenting a `Reader` opens no ambient side door and a DST run
/// replays identically. `observing` is the whole instrument: it wraps a `Reader`, forwards every lookup
/// unchanged, and reports what came back.
[<RequireQualifiedAccess>]
module Chip8ConsultCensus =

    open System.Globalization

    /// The four buckets, taken directly off `Chip8CrossRunStore.Verdict` — no coarsening, because a
    /// census that merges buckets is blind to exactly the skew it exists to see.
    type Bucket =
        | Halt
        | AwaitingInput
        | Cycle
        | OpenAtBound

    /// Every bucket, in a fixed order. Distributions are always reported over ALL FOUR — a bucket with
    /// count zero is a measurement, not an absence, and dropping it would hide the skew.
    let allBuckets = [ Halt; AwaitingInput; Cycle; OpenAtBound ]

    let bucketName (b: Bucket) : string =
        match b with
        | Halt -> "halt"
        | AwaitingInput -> "awaiting-input"
        | Cycle -> "cycle"
        | OpenAtBound -> "open-at-bound"

    let bucketOf (v: Chip8CrossRunStore.Verdict) : Bucket =
        match v with
        | Chip8CrossRunStore.Closed(_, _, Chip8CrossRunStore.Halt) -> Halt
        | Chip8CrossRunStore.Closed(_, _, Chip8CrossRunStore.AwaitingInput) -> AwaitingInput
        | Chip8CrossRunStore.Closed(_, _, Chip8CrossRunStore.Cycle) -> Cycle
        | Chip8CrossRunStore.OpenAtBound _ -> OpenAtBound

    /// **The mechanical partition, named by the mechanism rather than by the value word.**
    ///
    /// `Halt` and `AwaitingInput` are both `lambda = 1` — literal fixed points of the pure step map. `Cycle`
    /// (`lambda > 1`) and `OpenAtBound` are not. Whether "fixed point" *means* "the game ended" is a
    /// caller's oracle call and this module refuses to make it: an `FX0A` stall is revivable by an input
    /// the store deliberately does not model, so calling it an ending would be a claim about a world
    /// outside the artifact. What is reported is the mechanical fact.
    let isFixedPoint (b: Bucket) : bool =
        match b with
        | Halt
        | AwaitingInput -> true
        | Cycle
        | OpenAtBound -> false

    /// Counts per bucket. Integer counts, never pre-divided shares: the ratios are formed at report time
    /// so the sample size stays visible next to every proportion.
    type Tally =
        { Halt: int
          AwaitingInput: int
          Cycle: int
          OpenAtBound: int }

    let emptyTally =
        { Halt = 0
          AwaitingInput = 0
          Cycle = 0
          OpenAtBound = 0 }

    let countOf (t: Tally) (b: Bucket) : int =
        match b with
        | Halt -> t.Halt
        | AwaitingInput -> t.AwaitingInput
        | Cycle -> t.Cycle
        | OpenAtBound -> t.OpenAtBound

    let total (t: Tally) : int = t.Halt + t.AwaitingInput + t.Cycle + t.OpenAtBound

    let addBucket (t: Tally) (b: Bucket) : Tally =
        match b with
        | Halt -> { t with Halt = t.Halt + 1 }
        | AwaitingInput -> { t with AwaitingInput = t.AwaitingInput + 1 }
        | Cycle -> { t with Cycle = t.Cycle + 1 }
        | OpenAtBound -> { t with OpenAtBound = t.OpenAtBound + 1 }

    let tallyOfBuckets (bs: Bucket seq) : Tally = bs |> Seq.fold addBucket emptyTally

    let tallyOfVerdicts (vs: Chip8CrossRunStore.Verdict seq) : Tally =
        vs |> Seq.map bucketOf |> tallyOfBuckets

    let tallyOfArtifacts (xs: Chip8CrossRunStore.Artifact seq) : Tally =
        xs |> Seq.map (fun a -> a.Verdict) |> tallyOfVerdicts

    /// Share of a bucket, `0.0` when the tally is empty (an empty read-set has no distribution; it is
    /// reported as such rather than as a uniform one).
    let share (t: Tally) (b: Bucket) : float =
        let n = total t
        if n = 0 then 0.0 else float (countOf t b) / float n

    // ── the instrument ─────────────────────────────────────────────────────────────────────────────

    /// **Wrap a `Reader` so every lookup is observed.** The wrapped reader returns exactly what the inner
    /// one returned — this changes no behaviour, only visibility.
    ///
    /// `record` receives `Some verdict` on a hit and `None` on a miss. Misses carry no verdict, so they
    /// contribute to no bucket; they are still reported, because a consult path that mostly misses is a
    /// different situation from one that mostly hits, and folding the two together would hide that.
    ///
    /// The sink is INJECTED (SS13): this module opens no channel of its own.
    let observing
        (record: Chip8CrossRunStore.Verdict option -> unit)
        (inner: Chip8CrossRunStore.Reader)
        : Chip8CrossRunStore.Reader =
        { TryGet =
            fun key ->
                let hit = inner.TryGet key
                record (hit |> Option.map (fun a -> a.Verdict))
                hit }

    // ── the comparison ─────────────────────────────────────────────────────────────────────────────

    /// A read-path event, as recorded by `observing`. Deliberately not a timestamp: `local-time-never-
    /// enters-the-shared-fold` — the census is a pure function of the event *set*, in the order the log
    /// happens to hold, and no wall clock may weight it.
    type ReadEvent =
        | Hit of Chip8CrossRunStore.Verdict
        | Miss

    type Census =
        { Stored: Tally
          Read: Tally
          /// Lookups that found nothing. Not a bucket — a miss has no verdict to be biased about.
          Misses: int }

    let censusOf (stored: Chip8CrossRunStore.Artifact seq) (events: ReadEvent seq) : Census =
        let evs = List.ofSeq events

        { Stored = tallyOfArtifacts stored
          Read =
            evs
            |> List.choose (function
                | Hit v -> Some v
                | Miss -> None)
            |> tallyOfVerdicts
          Misses = evs |> List.filter (fun e -> e = Miss) |> List.length }

    /// Total variation distance between the read and stored distributions: `(1/2) * sum |p_i - q_i|`,
    /// in `[0, 1]`. **Zero parameters, so nothing here is an unattributed gating constant.**
    ///
    /// `nan` when either side is empty — *no distribution exists*, and returning `0.0` there would report
    /// "no skew detected" for a measurement that never ran. That is precisely the check-that-did-not-run
    /// masquerading as a check that passed.
    let totalVariation (c: Census) : float =
        if total c.Stored = 0 || total c.Read = 0 then
            nan
        else
            0.5
            * (allBuckets
               |> List.sumBy (fun b -> abs (share c.Read b - share c.Stored b)))

    /// Exact equality of the two empirical distributions, by integer cross-multiplication — no float
    /// tolerance, therefore no invented epsilon. `false` when either side is empty: an absent read-set is
    /// not a match, it is an absence.
    ///
    /// This is deliberately strict. It answers *"are these the same distribution?"*, never *"are these
    /// close enough?"* — the second question has no answer this module is entitled to give.
    let sharesIdentical (c: Census) : bool =
        let ns = total c.Stored
        let nr = total c.Read

        if ns = 0 || nr = 0 then
            false
        else
            allBuckets
            |> List.forall (fun b -> int64 (countOf c.Read b) * int64 ns = int64 (countOf c.Stored b) * int64 nr)

    /// Signed per-bucket share deltas, `read - stored`. The whole result, not a summary: a positive delta
    /// on `Cycle`/`OpenAtBound` with negative deltas on `Halt`/`AwaitingInput` is the post-selection
    /// signature, and a reader should see the pattern rather than be handed a conclusion about it.
    let shareDeltas (c: Census) : (Bucket * float) list =
        allBuckets |> List.map (fun b -> b, share c.Read b - share c.Stored b)

    /// Share of NON-fixed-point (`Cycle` + `OpenAtBound`) orbits on each side. This is the pair that
    /// Aaron's criterion is stated over; it is derived from the four buckets above and never replaces
    /// them, because the two-bucket view is the coarsening that could hide a skew *within* a group.
    let nonFixedPointShares (c: Census) : {| Stored: float; Read: float |} =
        let f (t: Tally) =
            let n = total t
            if n = 0 then
                0.0
            else
                float (t.Cycle + t.OpenAtBound) / float n

        {| Stored = f c.Stored; Read = f c.Read |}

    /// A fixed-width, culture-invariant report line per bucket, plus the summary lines. Text, so it is
    /// diffable and can be pasted into a PR body without a rendering step.
    ///
    /// When the read side is EMPTY, the read share and the delta print as `n/a`, never as `0.000` /
    /// `-0.400`. `share` returns `0.0` on an empty tally because a proportion of nothing is not a number —
    /// and rendering that `0.0` as a share would make an *absence* look like a measured skew away from
    /// endings. Same refusal as `totalVariation` returning `nan`, applied to the column a human reads.
    let report (c: Census) : string list =
        let pct (x: float) = x.ToString("0.000", CultureInfo.InvariantCulture)
        let n (i: int) = i.ToString(CultureInfo.InvariantCulture)
        let noRead = total c.Read = 0
        let cell (x: float) = if noRead then "n/a" else pct x

        let rows =
            allBuckets
            |> List.map (fun b ->
                let sc = countOf c.Stored b
                let rc = countOf c.Read b

                bucketName b
                + " | stored "
                + n sc
                + " ("
                + pct (share c.Stored b)
                + ") | read "
                + n rc
                + " ("
                + cell (share c.Read b)
                + ") | delta "
                + cell (share c.Read b - share c.Stored b))

        let tv = totalVariation c

        rows
        @ [ "stored total = " + n (total c.Stored) + " | read total = " + n (total c.Read) + " | misses = " + n c.Misses
            "total variation = "
            + (if System.Double.IsNaN tv then "n/a (one side empty)" else pct tv)
            "shares identical = " + (if sharesIdentical c then "yes" else "no") ]
