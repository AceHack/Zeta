namespace Zeta.Core

open System
open Zeta.Core.Abstractions

/// **The float / exact boundary, drawn as a TYPE.**
///
/// Aaron 2026-08-23: *"i'm not a huge fan of float weights … I'm fine with floats being
/// specialized code where needed too for performance reasons — just we never need to have
/// floating point errors be the cause of cross machine communication corruptions, just like we
/// try to be rigorous in UoM in F#."*
///
/// The rule that follows is **float is permitted LOCALLY and forbidden ON THE WIRE**, and this
/// file is the attempt to make that a compile error rather than a review note — the same move F#
/// units of measure make for dimensions.
///
/// A weight may cross into shared state only if it comes with a `WireWeight<'W>`: a capability
/// token asserting the weight ring is **exact**, so `Add` is genuinely associative and
/// commutative and the encoded bytes are the same on every machine. IEEE-754 `float` is not, and
/// there is no `WireWeight<float>`:
///
///   * `WireWeight<'W>`'s constructor is `internal`, so **no code outside `Zeta.Core` can create
///     one** — a downstream caller holding a `WeightedSet<'K, float>` simply cannot produce the
///     argument `WeightedSetWire.toDynamicValue` demands. That half is structural.
///   * Inside `Zeta.Core` the inhabitants are the two values exported below, and
///     `tests/Tests.FSharp/WireWeightBoundary.Tests.fs` enumerates them by reflection and fails
///     if a float-weighted one is ever added. That half is a falsifier, not a type — stated
///     plainly rather than dressed up. The strictly structural version needs an `.fsi` signature
///     file for `Zeta.Core`, which the project does not use today; that is the follow-on that
///     would make this airtight.
///
/// Why exactness is the property and not "precision": float addition is **not associative**
/// (`(1.0 + 1e-16) + 1e-16 <> 1.0 + (1e-16 + 1e-16)`), so two nodes that receive the same
/// evidence in different orders fold different numbers — a divergence with no bad actor and no
/// bug, which is precisely the failure class the four-oracle byte-lock exists to exclude. The
/// falsifier for that sentence is in `tests/Tests.FSharp/WireWeightBoundary.Tests.fs`: the exact
/// ring folds identically under 200 permutations, and the float ring is shown to differ.
[<Sealed>]
type WireWeight<'W>
    internal (label: string, ring: IRing<'W>, encode: 'W -> DynamicValue, decode: DynamicValue -> 'W option) =

    /// A short, stable name for the weight ring (appears in the encoded envelope).
    member _.Label = label

    /// The exact ring the weights live in.
    member _.Ring = ring

    /// Weight → canonical `DynamicValue`.
    member _.Encode(w: 'W) : DynamicValue = encode w

    /// Canonical `DynamicValue` → weight (`None` if the shape is not this ring's).
    member _.Decode(d: DynamicValue) : 'W option = decode d


/// **The LOCAL float ring — deliberately NOT a `WireWeight`.**
///
/// `SoftValue`'s posterior is a local belief and stays on floats, which is the "specialised code
/// where needed for performance" half of the standing signal. It is a lawful-enough ring for that
/// use and an unlawful one for a shared fold; the type system is what keeps those apart.
[<Struct>]
type LocalFloatRing =
    interface ISemiring<float> with
        member _.Zero = 0.0
        member _.One = 1.0
        member _.Add(a, b) = a + b
        member _.Mul(a, b) = a * b

    interface IRing<float> with
        member _.Negate(a) = -a

[<RequireQualifiedAccess>]
module LocalFloatRing =
    /// Boxed singleton for the instance-passing path. **Local only** — it has no `WireWeight`.
    let Instance: IRing<float> = LocalFloatRing()


[<RequireQualifiedAccess>]
module WireWeight =

    // ── exact ℚ ──────────────────────────────────────────────────────────────────────────────

    let private encodeRational (r: ProbabilitySemiring.Rational) : DynamicValue =
        DynamicValue.Array [ DynamicValue.Int r.Num; DynamicValue.Int r.Den ]

    let private decodeRational (d: DynamicValue) : ProbabilitySemiring.Rational option =
        match d with
        | DynamicValue.Array [ DynamicValue.Int n; DynamicValue.Int den ] when den <> 0L ->
            Some(ProbabilitySemiring.rat n den)
        | _ -> None

    /// **Exact ℚ** — `ProbabilitySemiring.RationalRing`, already an `IRing<Rational>` over
    /// lowest-terms `int64` pairs. Add/Mul are exactly associative and commutative, and the
    /// encoding is two integers, so it byte-locks. This is the default wire weight for a belief.
    ///
    /// Honest limit, measured rather than assumed: `Rational` is `int64 / int64` and
    /// `ProbabilitySemiring.rat` reduces but does **not** check for overflow, so a long chain of
    /// exact multiplications will wrap silently. That is why `SoftValue.toExact` takes an
    /// explicit bounded denominator instead of trying to carry a float's exact binary expansion
    /// (0.3 is `5404319552844595 / 18014398509481984`; two of those multiplied overflow `int64`
    /// immediately). The unbounded fix is a `bigint` rational — which is exactly what the
    /// TypeScript sibling `src/Core.TypeScript/algebra/exact-weight.ts` already uses.
    let rational: WireWeight<ProbabilitySemiring.Rational> =
        WireWeight<ProbabilitySemiring.Rational>(
            "rational",
            ProbabilitySemiring.RationalRing.Instance,
            encodeRational,
            decodeRational
        )

    // ── exact ℤ ──────────────────────────────────────────────────────────────────────────────

    let private encodeInteger (w: int64) : DynamicValue = DynamicValue.Int w

    let private decodeInteger (d: DynamicValue) : int64 option =
        match d with
        | DynamicValue.Int w -> Some w
        | _ -> None

    /// **Exact ℤ** — the `ZSet` multiplicity ring. Exact, associative, and already the weight the
    /// shared fold uses everywhere else.
    let integer: WireWeight<int64> =
        WireWeight<int64>("integer", IntegerRing.Instance, encodeInteger, decodeInteger)


/// Encoding a `WeightedSet` for shared state. Every entry point here demands a `WireWeight<'W>`,
/// which is what makes "float never crosses the boundary" a property of the signatures rather
/// than of anybody's diligence.
[<RequireQualifiedAccess>]
module WeightedSetWire =

    /// Canonical envelope: `[ label; [ [k; w]; … ] ]`, entries in the tensor's ordinal key order
    /// (a `WeightedSet` is a `Map`, so that order is a property of the value, not of how it was
    /// built). Deterministic for a given `(keyOf, cap)`.
    ///
    /// **`float` cannot reach this function**: it takes a `WireWeight<'W>` and no
    /// `WireWeight<float>` exists.
    let toDynamicValue (cap: WireWeight<'W>) (keyOf: 'K -> DynamicValue) (ws: WeightedSet.WeightedSet<'K, 'W>) : DynamicValue =
        DynamicValue.Array
            [ DynamicValue.String cap.Label
              DynamicValue.Array
                  [ for (k, w) in WeightedSet.toSeq ws -> DynamicValue.Array [ keyOf k; cap.Encode w ] ] ]

    /// The canonical CBOR bytes of `toDynamicValue` — the actual on-the-wire form.
    /// `Result`-typed per the repo's no-exceptions-on-hot-paths rule.
    let toCanonicalCbor
        (cap: WireWeight<'W>)
        (keyOf: 'K -> DynamicValue)
        (ws: WeightedSet.WeightedSet<'K, 'W>)
        : Result<byte[], EncodeError> =
        toDynamicValue cap keyOf ws |> DynamicValue.toCanonicalCbor
