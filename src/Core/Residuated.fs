namespace Zeta.Core

open System
open System.Collections.Generic
open System.Threading
open System.Threading.Tasks


/// **Residuated-lattice IVM** — O(log k) retraction for non-invertible
/// aggregates like `max` / `min` / bag-union.
///
/// ## The problem it solves
///
/// DBSP retraction (`-Δ` with negative weights) works beautifully for
/// group-structured aggregates (`sum`, `count`) where subtraction
/// exists. It breaks down for `max` because "subtract a value" from
/// a running max isn't a real operation — you either still have the
/// same max (if the retracted value wasn't the current max) or you
/// have to **recompute** from scratch (if it was). A naïve recompute
/// is O(|history|), not O(|Δ|), and wipes out the whole IVM speedup.
///
/// ## The residuated-lattice trick
///
/// In a commutative residuated lattice `(L, ∧, ∨, ·, \, /)`, every
/// `a ≤ b` has a *right residual* `a \ b` such that
/// `a · x ≤ b ⇔ x ≤ a \ b`. For `max` under the natural order on
/// a totally-ordered key set `K`:
///   - `·` = `max` (the monoid op)
///   - `a \ b = b if a ≤ b, else a` (the residual tells you "what's
///     the current max given `a` has been retracted?")
///
/// The algebraic principle translates into a concrete algorithm:
/// **maintain the active key-set in a balanced BST** keyed by `K`.
/// All three core ops are O(log k) where `k = |distinct keys|`:
///   - Insert positive weight → `SortedSet<'K>.Add`
///   - Retract to zero/negative → `SortedSet<'K>.Remove`
///   - Query current max → `SortedSet<'K>.Max`
///
/// ## Round-17 fix
///
/// The previous revision maintained only the **top-2** keys and
/// triggered a full O(n) scan of the integrated Z-set whenever the
/// top value was fully retracted. It advertised "O(1) amortised"
/// retraction, but adversarial retract-top workloads forced an O(n)
/// scan on every tick — the claim was false. Harsh-critic round-16
/// flagged this; this revision drops the top-2 cache entirely in
/// favour of a SortedSet-backed store so **every** operation is
/// genuinely logarithmic, with no hidden linear-scan fallback.
///
/// ## Wire it into a circuit
///
/// ```fsharp
/// let maxStream = circuit.ResidualMax(input.Stream, keyFn)
/// ```
///
/// The operator accepts `Stream<ZSet<'T>>` with positive and
/// negative weights; emits `Stream<'K voption>` where the option is
/// `ValueNone` when the aggregate is empty.
///
/// ## References
///
/// - Galatos, Jipsen, Kowalski, Ono. *Residuated Lattices: An
///   Algebraic Glimpse at Substructural Logics*. Studies in Logic
///   and the Foundations of Mathematics, 151 (2007).
/// - Bird, Gibbons. *Algebra of Programming*. 1997.
/// - Hellerstein. *Aggregation and Invertible Aggregates* CACM 2010.
[<Sealed>]
type internal ResidualMaxOp<'T, 'K
    when 'T : comparison
    and 'K : comparison
    and 'K : not null>
    (input: Op<ZSet<'T>>, keyFn: Func<'T, 'K>, compare: IComparer<'K>) =
    inherit Op<'K voption>()
    let inputs = [| input :> Op |]

    // Aggregate weight per projected key `K`. A key is "active" iff
    // its aggregate weight is strictly positive.
    let keyWeight = Dictionary<'K, int64>()

    // Sorted set of active keys — O(log k) Add/Remove/Max. The
    // supplied IComparer defines the order; `Max` walks the rightmost
    // spine of the underlying red-black tree.
    let active = SortedSet<'K>(compare)

    override _.Name = "residualMax"
    override _.Inputs = inputs
    override _.IsStrict = true
    override this.StepAsync(_: CancellationToken) =
        let delta = input.Value
        if not delta.IsEmpty then
            let span = delta.AsSpan()
            for i in 0 .. span.Length - 1 do
                let k = keyFn.Invoke span.[i].Key
                let w = span.[i].Weight
                let existing =
                    match keyWeight.TryGetValue k with
                    | true, v -> v
                    | false, _ -> 0L
                let updated = existing + w
                let wasActive = existing > 0L
                let isActive = updated > 0L
                // Active-set transition (O(log k)).
                if wasActive && not isActive then active.Remove k |> ignore
                elif not wasActive && isActive then active.Add k |> ignore
                // Weight-map update (O(1) amortised).
                if updated = 0L then keyWeight.Remove k |> ignore
                else keyWeight.[k] <- updated
        // Emit the current max in O(log k).
        this.Value <-
            if active.Count = 0 then ValueNone
            else ValueSome active.Max
        ValueTask.CompletedTask


/// Extensions exposing `ResidualMax` on `Circuit`.
[<System.Runtime.CompilerServices.Extension>]
type ResidualExtensions =
    /// Streaming max over a Z-set stream with positive + negative
    /// weights. Uses a residuated-lattice active-set representation
    /// (`SortedSet<'K>` + weight dictionary) so every op — insert,
    /// retract, max-query — is **O(log k)** where `k = |distinct
    /// active keys|`. No amortisation surprises, no hidden linear
    /// scans, no "fallback" paths that blow up under adversarial
    /// retract-top workloads.
    [<System.Runtime.CompilerServices.Extension>]
    static member ResidualMax<'T, 'K
        when 'T : comparison and 'K : comparison and 'K : not null>
        (circuit: Circuit, input: Stream<ZSet<'T>>, keyFn: Func<'T, 'K>) : Stream<'K voption> =
        circuit.RegisterStream (ResidualMaxOp(input.Op, keyFn, Comparer<'K>.Default))
