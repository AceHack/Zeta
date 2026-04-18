namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// A `FeedbackOp` is a strict operator that stands in as a source during graph
/// construction, and is wired to its true producer later via `Connect`. This
/// lets users build cycles (e.g. recursive queries) that would otherwise be
/// impossible to express in a single left-to-right pass.
///
/// The operator is treated as strict by the scheduler: it emits the *previous*
/// iteration's output at tick `t`, then commits the just-computed producer
/// value as state for tick `t+1`. This is exactly the semantics of `z^-1`.
[<Sealed>]
type FeedbackOp<'T>(initial: 'T) =
    inherit Op<'T>()

    // `source` is written via `Volatile.Write` and read via
    // `Volatile.Read` so readers observing `connected = 1` are
    // guaranteed (by release/acquire pairing with the CAS on
    // `connected`) to also observe the `source` store. F# does not
    // allow `[<VolatileField>]` on `val mutable` fields — it's a
    // `let`-binding-only attribute — so we use the explicit
    // `Volatile.Write` / `Volatile.Read` API surface, which has the
    // same semantics. The two-step write protocol is:
    //   1. Volatile-store `source` (release).
    //   2. CAS `connected` 0→1 (publishes both stores).
    // Any reader that loads `connected = 1` has an acquire on step 2
    // and therefore sees the step-1 store of `source`. Without the
    // volatile qualifier, an ARM/Apple-Silicon reader could see the
    // CAS-published `connected = 1` with a still-null `source` field,
    // and `this.source :> Op` would surface a null array element.
    [<DefaultValue(false)>]
    val mutable internal source: Op<'T>

    let mutable state = initial
    // `connected` is CAS'd via `Interlocked.CompareExchange` — two
    // threads calling `Connect` concurrently would otherwise both see
    // `connected = 0` and both write `this.source`, leaving a torn pair
    // where the second write races with the `Build` schedule read. CAS
    // makes the "first caller wins, second caller throws" contract
    // explicit and atomic, AND serves as the release barrier that
    // publishes the preceding `source` store.
    [<VolatileField>]
    let mutable connected = 0

    /// Wire this feedback cell to its true producer. Must be called exactly
    /// once before `Circuit.Build` runs. Thread-safe: concurrent callers
    /// see exactly one succeed; the rest throw `InvalidOperationException`.
    member this.Connect(source: Op<'T>) =
        // CAS `connected` 0→1 first — claim exclusive ownership
        // of the write slot. Losers throw without mutating `source`.
        let winner =
            Interlocked.CompareExchange(&connected, 1, 0) = 0
        if not winner then
            invalidOp "Feedback already connected"
        // Volatile-store pairs with `Volatile.Read` in the observers
        // below. This is the release barrier that publishes `source`
        // to any thread that subsequently loads `connected = 1`.
        Volatile.Write(&this.source, source)

    override _.Name = "feedback"
    override this.Inputs =
        // `connected` is volatile (acquire read). If we observe
        // `connected = 1`, a subsequent `Volatile.Read` of `source`
        // happens-after the writer's `Volatile.Write` of `source`,
        // so `s` is non-null. Null-guard kept as belt-and-braces for
        // readers that race between the CAS and the `source` store.
        if connected = 1 then
            let s = Volatile.Read(&this.source)
            if isNull (box s) then Array.empty else [| s :> Op |]
        else Array.empty
    override _.IsStrict = true
    override this.StepAsync(_: CancellationToken) =
        this.Value <- state
        ValueTask.CompletedTask
    override this.AfterStepAsync(_: CancellationToken) =
        if connected = 1 then
            let s = Volatile.Read(&this.source)
            if not (isNull (box s)) then state <- s.Value
        ValueTask.CompletedTask


/// A handle to a feedback cell. Call `Connect` exactly once, after building
/// the downstream circuit, to wire the cycle.
[<Sealed>]
type FeedbackConnector<'T> internal (op: FeedbackOp<'T>) =
    member _.Stream : Stream<'T> = Stream op
    member _.Connect(producer: Stream<'T>) = op.Connect producer.Op


[<Extension>]
type RecursiveExtensions =

    /// Allocate a feedback cell with the given initial value. Returns both a
    /// stream (usable immediately as any input) and a connector to wire the
    /// producer once it has been constructed.
    [<Extension>]
    static member Feedback<'T>(this: Circuit, initial: 'T) : FeedbackConnector<'T> =
        FeedbackConnector (this.Register (FeedbackOp<'T>(initial)))

    /// Feedback for Z-set streams with the empty Z-set as the starting value.
    [<Extension>]
    static member FeedbackZSet<'K when 'K : comparison>
        (this: Circuit) : FeedbackConnector<ZSet<'K>> =
        FeedbackConnector (this.Register (FeedbackOp<ZSet<'K>>(ZSet<'K>.Empty)))

    /// Least-fixed-point of a monotone `body` over Z-sets. Each outer tick
    /// advances the computation by one inner iteration; after enough ticks
    /// the output stabilises at the least fixed point `LFP(seed ∪ body(LFP))`.
    ///
    /// This is the classic Datalog pattern. For a fully-automatic one-shot
    /// fixed-point (computed within a single outer tick), see
    /// `IterateToFixedPoint` which re-steps the circuit until stable.
    [<Extension>]
    static member Recursive<'K when 'K : comparison>
        (this: Circuit,
         seed: Stream<ZSet<'K>>,
         body: Func<Stream<ZSet<'K>>, Stream<ZSet<'K>>>) : Stream<ZSet<'K>> =
        // Feedback cell carrying the full accumulated reachable set.
        let fb = this.FeedbackZSet<'K>()
        // current = seed ∪ feedback
        let union = this.Distinct(this.Plus(seed, fb.Stream))
        // next = current ∪ body(current)
        let next = this.Distinct(this.Plus(union, body.Invoke union))
        fb.Connect next
        next

    /// **Counting recursive** evaluation of a Z-linear Datalog-like rule.
    /// Mirrors the shape of `Recursive` but **deliberately omits `Distinct`
    /// inside the feedback loop** so Z-weights flow through the body and
    /// accumulate as derivation counts. The output's weight at a given key
    /// `k` equals the number of distinct derivation trees that produce `k`
    /// from `seed` through `body` — not the boolean set-membership
    /// indicator that `Recursive` exposes.
    ///
    /// This implements the Gupta-Mumick-Subrahmanian SIGMOD 1993 §4
    /// "counting algorithm" directly in DBSP: the Z-weight IS the
    /// derivation count. Retractions flow through as negative Z-weight
    /// contributions — when an edge is retracted, every derivation that
    /// used it cancels against its original positive contribution, exactly
    /// by Z-linearity of `body` (`body(a - b) = body(a) - body(b)`). A
    /// closure row's integrated weight drops to 0 once all its derivations
    /// are retracted, at which point Z-set consolidation drops the row.
    ///
    /// ## Preconditions on `body`
    ///
    /// 1. **Z-linear**: `body(a + b) = body(a) + body(b)` and
    ///    `body(-a) = -body(a)`. `Map`, `Filter`, `Plus`, `Minus`,
    ///    `Join`, `IndexedJoin`, `FlatMap`, `Cartesian`, and
    ///    `GroupBySum` are all Z-linear. `Distinct` and `DistinctIncremental`
    ///    are **NOT** Z-linear — they clamp weights to `{0, 1}` and break
    ///    the counting invariant. If `body` contains any `Distinct` the
    ///    output weights become meaningless (neither a derivation count
    ///    nor a boolean indicator) and retraction correctness is lost.
    /// 2. **Depth-bounded on the extensional input**: `body^k(seed)` must
    ///    eventually become empty for convergence. For transitive closure
    ///    over an acyclic edge set this holds — paths are finite. Over a
    ///    **cyclic** edge set the derivation count of a cycle-touching
    ///    tuple is unbounded (infinitely many walks traverse the cycle)
    ///    and this combinator does not terminate. Use `Recursive` there.
    ///
    /// ## Known limitation — one-shot seed
    ///
    /// The counting-recurrence this combinator computes is correct
    /// for a **one-shot seed** (the integrated seed stabilises
    /// after tick 0) driven to a fixed point via
    /// `IterateToFixedPoint`, and for monotone (insert-only) or
    /// strictly-paired (insert+retract of same edge) delta
    /// sequences on that seed. Multi-tick seed changes mid-LFP —
    /// inserting a new seed edge while the body is still
    /// iterating, then iterating again — is **not proven** to
    /// produce `Σ body^i(seed)`-style derivation counts and is
    /// the subject of the gap-monotone signed-delta research
    /// plan (`docs/research/retraction-safe-semi-naive.md`). Tests
    /// exercise the one-shot-seed path; the combinator's
    /// correctness beyond that is an open research question.
    ///
    /// ## Output semantics
    ///
    /// The emitted `ZSet<'K>` carries multiplicity weights: `w(k)` equals
    /// the number of derivation trees proving `k`. Callers that want
    /// classical set-of-tuples semantics should compose a `Distinct` on
    /// the output *after* the recursion stabilises — not inside the body.
    /// Callers that want the multiplicity (path-count, provenance-weight,
    /// explanation support) read the weights directly.
    ///
    /// ## Contrast with `Recursive`
    ///
    /// `Recursive` applies `Distinct` inside the loop so the integrated
    /// relation is clamped to `{0, 1}` weights per tuple; it is O(|integrated|)
    /// per iteration but gives you boolean LFP semantics. `RecursiveCounting`
    /// skips that clamp, which is cheaper per step (no `Distinct` scan) and
    /// additionally exposes multiplicity — at the cost of the preconditions
    /// above.
    [<Extension>]
    static member RecursiveCounting<'K when 'K : comparison>
        (this: Circuit,
         seed: Stream<ZSet<'K>>,
         body: Func<Stream<ZSet<'K>>, Stream<ZSet<'K>>>) : Stream<ZSet<'K>> =
        // Integrate the seed stream so that tick 0's seed delta is still
        // visible at tick k > 0 (inputs drain their queue on `Step`, so
        // `seed.Value` is empty from tick 1 onward otherwise). Any
        // retraction delta pushed in at a later tick subtracts from the
        // integrated seed and that subtraction flows through the
        // counting body naturally via Z-linearity.
        let seedInt = this.IntegrateZSet seed
        // Feedback cell carries the previous iteration's `next` — the
        // running derivation-count Z-set
        //   `T_{k-1} = Σ_{i=0..k-1} body^i(seed)`.
        // No `Distinct`: weights flow freely so body composes
        // multiplicities across iterations.
        let fb = this.FeedbackZSet<'K>()
        // `next = seedInt + body(fb)` — the LFP unfolding of
        //   `T = seed + body(T)`.
        //
        //   tick 0: fb = 0,       next = seed + body(0)        = seed       = T_0
        //   tick 1: fb = T_0,     next = seed + body(T_0)                   = T_1
        //   tick k: fb = T_{k-1}, next = seed + body(T_{k-1})               = T_k
        //
        // Note: the recurrence is *not* `seed + body(seed + fb)` — adding
        // `seed` both inside and outside `body` double-counts the
        // seed-derived contributions at every iteration (producing
        // binomial coefficients `C(k, i)·body^i(seed)` instead of the
        // clean series Σ body^i(seed)). Keeping `seed` outside-only is
        // the right LFP unfolding for counting semantics.
        //
        // Under retraction: the integrated seed at outer tick N reflects
        // all deltas so far including negatives. By Z-linearity of
        // `body`, `body(seedInt - e) = body(seedInt) - body(e)`; the
        // subtraction propagates through every `body^i` term so closure
        // rows whose only derivations went through `e` reach weight 0
        // and drop out of the consolidated Z-set — no tombstone pass.
        let next = this.Plus(seedInt, body.Invoke fb.Stream)
        fb.Connect next
        next

    /// **Semi-naive** recursive evaluation of a monotone Datalog-like
    /// rule. Instead of recomputing `body(current)` on the full integrated
    /// relation every iteration (O(n) per step × N iterations = O(n·N)),
    /// semi-naive exploits monotonicity: at iteration k we only need to
    /// evaluate `body(Δ_{k-1})` on the **new** facts from the previous
    /// iteration. Total work drops to O(total new facts across iterations)
    /// = O(|LFP|) — strictly better by a factor equal to fixed-point
    /// depth. This is the classic algorithm from Bancilhon/Ramakrishnan 1986.
    ///
    /// ## WARNING — monotonic inputs only
    ///
    /// Semi-naïve is correct **only when the input stream is monotonic**
    /// (weights never become negative via retraction). Under retraction-
    /// native inputs the internal `total` feedback cell only grows and
    /// leaks retracted facts into every subsequent iteration. If you
    /// feed a Z-set stream with retractions into `RecursiveSemiNaive`
    /// you will observe **stale rows that outlive their retracted
    /// edges**. `ClosureTable` uses `Recursive` to avoid this class.
    ///
    /// **If your inputs may be retracted, use `Recursive` above.** A
    /// retraction-safe "differential semi-naïve" combinator is an
    /// Assess-ring item in `docs/TECH-RADAR.md`.
    [<Extension>]
    static member RecursiveSemiNaive<'K when 'K : comparison>
        (this: Circuit,
         seed: Stream<ZSet<'K>>,
         body: Func<Stream<ZSet<'K>>, Stream<ZSet<'K>>>) : Stream<ZSet<'K>> =
        // Classic semi-naive: `total` grows monotonically; each iter only
        // applies `body` to the "not-yet-in-total" slice of working facts.
        //   tick 0:  delta = seed ∖ total  = seed   (total starts empty)
        //   tick n>0: delta = (seed ∪ previous_newDelta) ∖ total
        // Once `seed` is fully absorbed into `total`, tick n>0 reduces
        // to just the new facts from the previous iteration.
        let totalFb = this.FeedbackZSet<'K>()
        let deltaFb = this.FeedbackZSet<'K>()
        let seedOrDelta = this.Distinct(this.Plus(seed, deltaFb.Stream))
        let delta = this.Distinct(this.Minus(seedOrDelta, totalFb.Stream))
        let produced = body.Invoke delta
        // Newly-discovered facts = produced minus those already in total.
        let nextDelta = this.Distinct(this.Minus(produced, totalFb.Stream))
        // total += delta ∪ nextDelta  (delta absorbs seed on first iter).
        let newTotal =
            this.Distinct(this.Plus(totalFb.Stream, this.Plus(delta, nextDelta)))
        totalFb.Connect newTotal
        deltaFb.Connect nextDelta
        newTotal

    /// Run the circuit until its observable outputs stabilise (no changes
    /// between ticks). Bounded by `maxIterations` to prevent infinite loops
    /// on non-monotone queries. Returns the number of iterations run.
    [<Extension>]
    [<TailCall>]
    static member IterateToFixedPoint<'T>
        (this: Circuit,
         observe: Stream<'T>,
         maxIterations: int) : int =
        let handle = OutputHandle observe.Op
        this.Step()
        let mutable prev = handle.Current
        let mutable iterations = 1
        let mutable stable = false
        while not stable && iterations < maxIterations do
            this.Step()
            iterations <- iterations + 1
            let cur = handle.Current
            if EqualityComparer<'T>.Default.Equals(cur, prev) then
                stable <- true
            else
                prev <- cur
        iterations

    /// Same as `IterateToFixedPoint` but returns a `(iterations, converged)`
    /// pair so callers can distinguish "reached a fixed point" from "hit
    /// the iteration cap". Use this over the `int`-returning overload when
    /// your caller needs to enforce "must converge" as a hard invariant.
    [<Extension>]
    static member IterateToFixedPointWithConvergence<'T>
        (this: Circuit,
         observe: Stream<'T>,
         maxIterations: int) : struct (int * bool) =
        let handle = OutputHandle observe.Op
        this.Step()
        let mutable prev = handle.Current
        let mutable iterations = 1
        let mutable stable = false
        while not stable && iterations < maxIterations do
            this.Step()
            iterations <- iterations + 1
            let cur = handle.Current
            if EqualityComparer<'T>.Default.Equals(cur, prev) then
                stable <- true
            else
                prev <- cur
        struct (iterations, stable)
