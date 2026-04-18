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
