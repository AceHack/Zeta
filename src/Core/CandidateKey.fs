namespace Zeta.Core

open System
open System.Collections.Immutable

/// **A total order on `DynamicValue` — supplied from OUTSIDE the type, not baked into it.**
///
/// `DynamicValue` is declared `[<CustomEquality; NoComparison>]` (`src/Core/DynamicValue.fs`)
/// and that is correct: `Float nan`, `Float -0.0` and a default `ImmutableArray<byte>` all
/// break the structural order F# would derive, so no derived order could agree with the
/// hand-written `Equals`. The consequence is measured and load-bearing: **`WeightedSet<'K,'W>`
/// requires `'K : comparison`, so `WeightedSet<DynamicValue, _>` does not typecheck** — which is
/// why `SoftValue` was an association list rather than the `WeightedSet` its own comment claimed
/// it "effectively" was.
///
/// This module supplies the missing order without touching `DynamicValue`. The one obligation it
/// carries is **agreement with the existing equality**:
///
/// > `compareValues a b = 0`  ⟺  `a.Equals b`
///
/// which is why the two hazards are canonicalised here rather than ignored:
///   * **NaN** — `Double.Equals` says `nan = nan`, while `Double.CompareTo` orders NaN below
///     every number. All NaNs are folded into ONE class, sorted after every number.
///   * **signed zero** — `Double.Equals` says `0.0 = -0.0`, while `Double.CompareTo` orders
///     `-0.0 < 0.0`. `-0.0` is mapped to `+0.0` before comparing.
/// (`Bytes` additionally normalises a default/uninitialised `ImmutableArray`, exactly as
/// `DynamicValue.Equals` does.)
///
/// The order itself is **ordinal** end to end — `String.CompareOrdinal` for strings and object
/// keys, raw byte order for `Bytes` — per `.claude/rules/culture-invariant-by-default.md`. It is
/// deliberately NOT claimed to be the canonical CBOR byte order: canonical CBOR distinguishes
/// `0.0` from `-0.0`, so keying on encoded bytes would split two candidates that
/// `DynamicValue.Equals` calls equal, silently un-merging a distribution.
[<RequireQualifiedAccess>]
module DynamicValueOrder =

    /// Case rank — the primary sort key, so unlike cases never interleave.
    let private tag (dv: DynamicValue) : int =
        match dv with
        | DynamicValue.Null -> 0
        | DynamicValue.Bool _ -> 1
        | DynamicValue.Int _ -> 2
        | DynamicValue.Float _ -> 3
        | DynamicValue.String _ -> 4
        | DynamicValue.Bytes _ -> 5
        | DynamicValue.Array _ -> 6
        | DynamicValue.Object _ -> 7

    /// Float order that AGREES with `Double.Equals` (the relation `DynamicValue.Equals` uses):
    /// every NaN is one class sorted last, and `-0.0` is identified with `+0.0`.
    ///
    /// **MEASURED, and the measurement says this body is currently REDUNDANT in F#.** Two
    /// mutation runs (2026-08-23): deleting the signed-zero canonicalisation, and then replacing
    /// this whole function with a bare `Operators.compare a b`, both left
    /// `CandidateKey: compare = 0 exactly when DynamicValue.Equals` GREEN. F#'s generic
    /// comparison on `float` already identifies `-0.0` with `+0.0` and already treats NaN as
    /// equal to itself, so it happens to agree with `Double.Equals` unaided.
    ///
    /// It is kept anyway, and the reason is not caution — it is that **F# is the lucky one**.
    /// `Double.CompareTo` (the .NET primitive the C# oracle would reach for) orders `-0.0 < 0.0`
    /// and sorts NaN below every number, which DISAGREES with `Double.Equals` on exactly these
    /// two inputs; Rust's `f64` has no `Ord` at all. So this body is the cross-oracle
    /// specification of the order, written where a peer implementation will look for it, and the
    /// surviving mutants are reported rather than healed away.
    let private compareFloat (a: float) (b: float) : int =
        let na, nb = Double.IsNaN a, Double.IsNaN b

        if na && nb then 0
        elif na then 1
        elif nb then -1
        else
            let ca = if a = 0.0 then 0.0 else a
            let cb = if b = 0.0 then 0.0 else b
            Operators.compare ca cb

    /// Lexicographic raw-byte order, shorter-prefix-first; a default array reads as empty.
    let private compareBytes (a: ImmutableArray<byte>) (b: ImmutableArray<byte>) : int =
        let na = if a.IsDefault then ImmutableArray<byte>.Empty else a
        let nb = if b.IsDefault then ImmutableArray<byte>.Empty else b
        let n = min na.Length nb.Length
        let mutable i = 0
        let mutable r = 0

        while r = 0 && i < n do
            r <- Operators.compare na.[i] nb.[i]
            i <- i + 1

        if r <> 0 then r else Operators.compare na.Length nb.Length

    /// Total order on `DynamicValue`, consistent with `DynamicValue.Equals`.
    let rec compareValues (a: DynamicValue) (b: DynamicValue) : int =
        match a, b with
        | DynamicValue.Null, DynamicValue.Null -> 0
        | DynamicValue.Bool x, DynamicValue.Bool y -> Operators.compare x y
        | DynamicValue.Int x, DynamicValue.Int y -> Operators.compare x y
        | DynamicValue.Float x, DynamicValue.Float y -> compareFloat x y
        | DynamicValue.String x, DynamicValue.String y -> sign (String.CompareOrdinal(x, y))
        | DynamicValue.Bytes x, DynamicValue.Bytes y -> compareBytes x y
        | DynamicValue.Array x, DynamicValue.Array y -> compareList x y
        | DynamicValue.Object x, DynamicValue.Object y -> compareObject x y
        // Reached only when the two cases differ — then the case rank decides.
        | _ -> Operators.compare (tag a) (tag b)

    /// Element-wise then shorter-first (agrees with the `SequenceEqual` `Array` equality).
    and private compareList (xs: DynamicValue list) (ys: DynamicValue list) : int =
        match xs, ys with
        | [], [] -> 0
        | [], _ -> -1
        | _, [] -> 1
        | x :: xt, y :: yt ->
            let r = compareValues x y
            if r <> 0 then r else compareList xt yt

    /// Key (ordinal) then value, element-wise, then shorter-first. `Object` is an ordered
    /// association list in this primitive, so its order is positional — same as its equality.
    and private compareObject (xs: (string * DynamicValue) list) (ys: (string * DynamicValue) list) : int =
        match xs, ys with
        | [], [] -> 0
        | [], _ -> -1
        | _, [] -> 1
        | (k1, v1) :: xt, (k2, v2) :: yt ->
            let rk = sign (String.CompareOrdinal(k1, k2))

            if rk <> 0 then
                rk
            else
                let rv = compareValues v1 v2
                if rv <> 0 then rv else compareObject xt yt


/// **`CandidateKey` — `DynamicValue` wearing the `comparison` constraint.**
///
/// A one-case wrapper whose equality DELEGATES to `DynamicValue.Equals` (so nothing about
/// candidate identity changes) and whose comparison is `DynamicValueOrder.compareValues`. This is
/// the whole unlock: `WeightedSet<CandidateKey, 'W>` typechecks where `WeightedSet<DynamicValue, 'W>`
/// cannot, so `SoftValue` can BE a `WeightedSet` instead of being described as one.
///
/// Consequence worth stating out loud: a `WeightedSet` is a `Map`, so a distribution is now held in
/// **ordinal candidate order** rather than in first-seen (arrival) order. That is a behaviour change
/// and it is reported, not buried — see the PR body. It is the direction we want: arrival order is
/// exactly the coordinate `.claude/rules/local-time-never-enters-the-shared-fold.md` forbids the
/// shared fold from seeing, and the C#/TS/Rust `SoftValue` oracles already break `resolve` ties by
/// ascending key, which F#'s first-seen `List.maxBy` did not.
[<CustomEquality; CustomComparison>]
type CandidateKey =
    | CandidateKey of DynamicValue

    /// The wrapped candidate.
    member this.Value =
        let (CandidateKey v) = this
        v

    override this.Equals(other: obj) : bool =
        match other with
        | :? CandidateKey as o -> this.Value.Equals(o.Value)
        | _ -> false

    override this.GetHashCode() : int = this.Value.GetHashCode()

    interface IComparable<CandidateKey> with
        member this.CompareTo(o: CandidateKey) : int = DynamicValueOrder.compareValues this.Value o.Value

    interface IComparable with
        member this.CompareTo(o: obj) : int =
            match o with
            | :? CandidateKey as k -> DynamicValueOrder.compareValues this.Value k.Value
            | _ -> invalidArg (nameof o) "CandidateKey compares only with CandidateKey"
