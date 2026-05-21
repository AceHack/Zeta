namespace Zeta.Core

open System
open System.Runtime.CompilerServices


/// Automatic incrementalization helpers.
///
/// The core DBSP identity is `Q^Δ = D ∘ Q ∘ I`: to incrementalize a query `Q`
/// that consumes a stream of full relation snapshots, sandwich it between
/// integrate and differentiate to get a query consuming a stream of deltas.
///
/// Key algebraic shortcuts implemented here:
///   • Linear operators: `Q^Δ = Q` (trivial).
///   • Bilinear operators: the three-term formula
///       `(a ⋈ b)^Δ = Δa ⋈ Δb + z^-1(I(a)) ⋈ Δb + Δa ⋈ z^-1(I(b))`.
///   • `distinct^Δ`: the paper's `H` function, bounded by `|Δ|`.
[<Extension>]
type IncrementalExtensions =

    /// Wrap `Q` with `D ∘ Q ∘ I`, yielding a circuit that maps deltas to
    /// deltas. Correct but unoptimized — use only when you have no algebraic
    /// shortcut for the interior operator.
    [<Extension>]
    static member Incrementalize<'T>
        (this: Circuit,
         zero: 'T,
         add: Func<'T, 'T, 'T>,
         sub: Func<'T, 'T, 'T>,
         q: Func<Stream<'T>, Stream<'T>>,
         input: Stream<'T>) : Stream<'T> =
        let integrated = this.Integrate(input, zero, add)
        let processed = q.Invoke integrated
        this.Differentiate(processed, zero, sub)

    /// Specialized `D ∘ Q ∘ I` for Z-set streams.
    [<Extension>]
    static member IncrementalizeZSet<'K when 'K : comparison>
        (this: Circuit,
         q: Func<Stream<ZSet<'K>>, Stream<ZSet<'K>>>,
         input: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        let integrated = this.IntegrateZSet input
        let processed = q.Invoke integrated
        this.DifferentiateZSet processed

    /// Incremental join on Z-sets: given delta streams `Δa` and `Δb` for the
    /// two inputs, emits the delta stream of `a ⋈ b` without ever forming
    /// the full relations. Implements the three-term bilinear formula.
    [<Extension>]
    static member IncrementalJoin<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        (this: Circuit,
         dA: Stream<ZSet<'A>>,
         dB: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>,
         keyB: Func<'B, 'K>,
         combine: Func<'A, 'B, 'C>) : Stream<ZSet<'C>> =
        // z^-1(I(a)) and z^-1(I(b)) — snapshots of the integrated relations
        // delayed by one tick, so they reflect the state *before* this tick's
        // delta is applied.
        let iA = this.IntegrateZSet dA
        let iB = this.IntegrateZSet dB
        let prevA = this.DelayZSet iA
        let prevB = this.DelayZSet iB
        let t1 = this.Join(dA, dB, keyA, keyB, combine)              // Δa ⋈ Δb
        let t2 = this.Join(prevA, dB, keyA, keyB, combine)           // z^-1(I(a)) ⋈ Δb
        let t3 = this.Join(dA, prevB, keyA, keyB, combine)           // Δa ⋈ z^-1(I(b))
        this.Plus(this.Plus(t1, t2), t3)

    /// Incremental distinct: given a delta stream `Δa`, emits the delta of
    /// `distinct(a)` using the paper's `H` function (boundary-crossings only).
    /// Work per tick is O(|Δa|), independent of `|a|`.
    [<Extension>]
    static member IncrementalDistinct<'K when 'K : comparison>
        (this: Circuit, delta: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        let integrated = this.IntegrateZSet delta
        let prev = this.DelayZSet integrated   // z^-1(I(Δa)) = snapshot before this tick
        this.DistinctIncremental(prev, delta)

    /// **Capability-aware incremental dispatcher.** Picks the right
    /// incrementalization for `q` based on the algebra capability tag
    /// on the operator `q` produces:
    ///
    ///   - `IsLinear  = true`  →  `Q^Δ = Q` (trivial; deltas pass through)
    ///   - `IsSink    = true`  →  throws (sinks are terminal; can't be
    ///                            incrementalized — see PR 2's
    ///                            sink-terminality enforcement)
    ///   - otherwise           →  `D ∘ Q ∘ I` fallback (always correct
    ///                            but expensive — materializes the full
    ///                            integrated relation every tick)
    ///
    /// ## How the dispatch works (and important side-effects)
    ///
    /// `q` is a `Stream → Stream` factory. We **probe** it by invoking
    /// `q.Invoke input` *before* deciding the dispatch path; the
    /// resulting `Stream<'TOut>.Op` carries the capability tags from
    /// PR 1. The probe is then either:
    ///
    ///   - **Linear case**: probed output returned directly (correct
    ///     because linear ops commute with `D`/`I`); no orphan.
    ///   - **Sink case**: throws — but the sink operator has *already
    ///     been registered* in the circuit by the probe `q.Invoke`.
    ///   - **Fallback case**: probed op kept in circuit as **orphan**
    ///     (no consumers); fallback rebuilds via `IncrementalizeZSet`.
    ///
    /// ## ⚠️ Side-effect warning
    ///
    /// **The probe `q.Invoke input` ALWAYS runs once, regardless of
    /// dispatch path.** This has two implications callers must
    /// account for:
    ///
    ///   1. **Side-effecting builders execute**: if `q` is a factory
    ///      like `AdvancedExtensions.Inspect` that performs work at
    ///      construction time (logging, registering hooks, allocating
    ///      external resources), that work runs **even when the
    ///      dispatcher throws or falls back**. Use a non-side-effecting
    ///      `q` factory, or accept the probe-side-effect cost.
    ///   2. **Circuit is mutated even on the throw path**: when the
    ///      sink case fires, the sink operator is **already in the
    ///      circuit** when the exception is raised. The caller's
    ///      circuit has been modified; catching the exception and
    ///      continuing leaves an orphan sink that will still be
    ///      scheduled and ticked. Either don't catch + recover from
    ///      `IncrementalAuto` exceptions on a circuit you'll continue
    ///      to use, or accept that the sink op stays registered.
    ///
    /// A non-registering probe path would close both gaps but requires
    /// architectural changes to the `Op` / `Circuit` contract
    /// (registration rollback isn't currently supported). Tracked as
    /// future work; the dispatcher's correctness on the happy paths
    /// (linear + fallback) doesn't depend on it.
    ///
    /// ## Known cost: orphan operator in the non-linear fallback path
    ///
    /// When the fallback fires, the probed operator stays registered
    /// in the circuit with no consumers — the scheduler will still tick
    /// it every cycle (wasted work), but it produces no observable
    /// output. Pruning unreachable operators at `Circuit.Build()` time
    /// is a future improvement; the dispatcher's correctness doesn't
    /// depend on it.
    ///
    /// ## When NOT to use this
    ///
    /// For bilinear joins, use `IncrementalJoin` directly — it has a
    /// richer signature (key functions, combine function) that this
    /// unary dispatcher can't express. A `IncrementalAutoJoin`
    /// dispatcher for bilinear ops can be added in a later PR.
    ///
    /// ## Reads
    ///
    /// `Op.IsLinear` and `Op.IsSink` (PR 1). For internal operators
    /// these are overridden in the concrete subclasses; for plugin
    /// operators they're surfaced via the `PluginOperatorAdapter`
    /// marker detection.
    [<Extension>]
    static member IncrementalAuto<'K when 'K : comparison>
        (this: Circuit,
         q: Func<Stream<ZSet<'K>>, Stream<ZSet<'K>>>,
         input: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        // Probe: apply q to input directly to inspect the resulting
        // operator's capability tag. Registration is a side effect;
        // see "orphan operator" note above.
        let probedOutput = q.Invoke input
        let resultOp = probedOutput.Op
        // Check the WHOLE CHAIN from the probed terminal op back to
        // the original input, not just the terminal op's IsLinear
        // tag. A query like `q(s) = Map(Distinct(s))` has a terminal
        // Map (IsLinear=true) but a non-linear Distinct inside; the
        // composed query is NOT linear and the Q^Δ = Q rewrite would
        // produce wrong incremental results. Walk Inputs back to
        // `input.Op`: if every op in the chain is linear AND we reach
        // `input.Op` only through linear ops, the chain is linear.
        // Multi-input ops (Plus, Minus — currently default
        // IsLinear=false) correctly fall back via this check.
        let rec isLinearChainToInput (op: Op) (inputOp: Op) : bool =
            if System.Object.ReferenceEquals(op, inputOp) then true
            elif op.Inputs.Length = 0 then false   // source op that isn't the input
            elif not op.IsLinear then false
            else op.Inputs |> Array.forall (fun dep -> isLinearChainToInput dep inputOp)
        if resultOp.IsSink then
            invalidOp
                (sprintf
                    "IncrementalAuto: cannot incrementalize a sink operator. \
                     '%s' (id=%d) declared IsSink=true; sinks are terminal \
                     and excluded from relational composition. Note: the \
                     probe already registered '%s' in this circuit before \
                     this check; the orphan sink will be scheduled and \
                     ticked unless the circuit is discarded. Use a \
                     non-sink operator, or consume the sink's output \
                     directly without incrementalization."
                    resultOp.Name resultOp.Id resultOp.Name)
        elif isLinearChainToInput resultOp (input.Op :> Op) then
            // Q^Δ = Q. For *whole-chain* linear q, q(delta) IS the
            // delta of q(full). The probed output is correct as-is;
            // return directly. Distinction from `resultOp.IsLinear`
            // alone: this guards against terminal-linear-but-inner-
            // non-linear queries like `Map(Distinct(s))`.
            probedOutput
        else
            // Generic D ∘ Q ∘ I fallback. The probed op above is orphan
            // in the circuit — wasteful but functionally correct.
            this.IncrementalizeZSet(q, input)


/// F#-idiomatic piping. `stream |> Stream.map f |> Stream.filter p` is
/// equivalent to `circuit.Filter(circuit.Map(stream, f), p)` but reads in
/// data-flow order. Every combinator forwards to the owning circuit.
[<RequireQualifiedAccess>]
module Stream =

    // All pipe-friendly combinators need access to the owning circuit. We
    // reach it through the Op's circuit back-reference, which is set by
    // `Circuit.Register`. For zero allocation, we do not store a separate
    // circuit handle on `Stream<'T>`.

    // Since our current `Op` doesn't carry its owning circuit, the pipe
    // functions accept the circuit as an explicit first argument:
    //   input |> Stream.map circuit f
    // This is explicit but composes cleanly, and matches what an F# user
    // would reach for given that `circuit.Map(…)` is the underlying surface.

    let inline current (s: Stream<'T>) : 'T = s.Current

    let inline map (c: Circuit) (f: 'A -> 'B) (s: Stream<ZSet<'A>>) : Stream<ZSet<'B>> =
        c.Map(s, System.Func<'A, 'B>(f))

    let inline filter (c: Circuit) (p: 'K -> bool) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Filter(s, System.Func<'K, bool>(p))

    let inline flatMap (c: Circuit) (f: 'A -> ZSet<'B>) (s: Stream<ZSet<'A>>) : Stream<ZSet<'B>> =
        c.FlatMap(s, System.Func<'A, ZSet<'B>>(f))

    let inline plus (c: Circuit) (a: Stream<ZSet<'K>>) (b: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Plus(a, b)

    let inline minus (c: Circuit) (a: Stream<ZSet<'K>>) (b: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Minus(a, b)

    let inline neg (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Negate s

    let inline distinct (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Distinct s

    let inline delay (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.DelayZSet s

    let inline integrate (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.IntegrateZSet s

    let inline differentiate (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.DifferentiateZSet s

    let inline output (c: Circuit) (s: Stream<'T>) : OutputHandle<'T> =
        c.Output s
