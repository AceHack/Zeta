namespace Zeta.Core

/// **Numerics on `SoftValue` — distribution arithmetic that PROPAGATES uncertainty (Aaron 2026-06-07, the
/// real target).** A `SoftValue` is a normalized distribution over `DynamicValue` candidates; arithmetic is
/// **convolution**: pair every candidate of `a` with every candidate of `b`, apply the leaf op
/// (`DynamicValueNumeric`) to the *values*, **multiply** the probabilities, then merge duplicate result-
/// values and renormalize (`SoftValue.ofWeighted`). So `certain ⊕ certain` stays a point mass, but
/// `spread ⊕ spread` widens — uncertainty compounds. This is the probability monad over the leaf numerics.
///
/// Two variants mirror the leaf op:
/// - top-level (`add`/`mul`/`negate`/`subtract`/`mean`) — **Result-typed** (CPU/correctness): a single
///   non-numeric/overflow candidate declines the whole op (no silent coercion).
/// - `Sat` — **shader-lowerable**: total, candidates that go out-of-domain become `Float NaN` and propagate;
///   the distribution is always returned.
///
/// `SoftValue` **is** a `WeightedSet<CandidateKey, float>` over the local float ring (as of
/// 2026-08-23) — this line used to say "effectively", which was the gap: `SoftValue` was an
/// association list and `WeightedSet` needs `'K : comparison`, which `DynamicValue` (declared
/// `NoComparison`) does not have. `src/Core/CandidateKey.fs` supplies the missing order and
/// `src/Core/SoftValue.fs` is now the genuine instance. This module is its arithmetic.
///
/// The weight is `float` because a posterior here is LOCAL. It cannot reach shared state:
/// `WeightedSetWire` demands a `WireWeight<'W>` and there is no `WireWeight<float>`
/// (`src/Core/WireWeight.fs`); `SoftValue.toExact` / `SoftValue.toWire` are the named crossing.
///
/// Anchors: probability monad / distribution semiring (Giry monad), `DynamicValueNumeric` (the
/// per-candidate leaf op), `ProbabilitySemiring`.
[<RequireQualifiedAccess>]
module SoftValueNumeric =

    module N = DynamicValueNumeric

    /// Apply a Result-typed leaf op across the candidate cartesian product (probabilities multiply), short-
    /// circuiting on the first declined pair, then rebuild + renormalize the distribution.
    let private convolve
        (leaf: DynamicValue -> DynamicValue -> Result<DynamicValue, N.NumericError>)
        (a: SoftValue.SoftValue)
        (b: SoftValue.SoftValue)
        : Result<SoftValue.SoftValue, N.NumericError> =
        let pairs =
            [ for v1, p1 in SoftValue.candidates a do
                  for v2, p2 in SoftValue.candidates b do
                      yield v1, v2, p1 * p2 ]

        let rec trav acc =
            function
            | [] -> Ok(List.rev acc)
            | (v1, v2, p) :: rest ->
                match leaf v1 v2 with
                | Ok v -> trav ((v, p) :: acc) rest
                | Error e -> Error e

        match trav [] pairs with
        | Ok weighted ->
            match SoftValue.ofWeighted weighted with
            | Some s -> Ok s
            | None -> Error(N.NotNumeric("soft-op", "empty-distribution"))
        | Error e -> Error e

    /// `a + b` — convolution under leaf addition; uncertainty propagates.
    let add (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : Result<SoftValue.SoftValue, N.NumericError> =
        convolve N.add a b

    /// `a * b` — convolution under leaf multiplication.
    let mul (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : Result<SoftValue.SoftValue, N.NumericError> =
        convolve N.mul a b

    /// `a - b` — convolution under leaf subtraction.
    let subtract (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : Result<SoftValue.SoftValue, N.NumericError> =
        convolve N.subtract a b

    /// Negate every candidate value (probabilities unchanged).
    let negate (a: SoftValue.SoftValue) : Result<SoftValue.SoftValue, N.NumericError> =
        let rec trav acc =
            function
            | [] -> Ok(List.rev acc)
            | (v, p) :: rest ->
                match N.negate v with
                | Ok nv -> trav ((nv, p) :: acc) rest
                | Error e -> Error e

        match trav [] (SoftValue.candidates a) with
        | Ok weighted ->
            match SoftValue.ofWeighted weighted with
            | Some s -> Ok s
            | None -> Error(N.NotNumeric("soft-negate", "empty-distribution"))
        | Error e -> Error e

    /// Expectation `E[X] = Σ pᵢ·valueᵢ` over numeric candidates (`Int`/`Float`); declines if any candidate is
    /// non-numeric.
    let mean (sv: SoftValue.SoftValue) : Result<float, N.NumericError> =
        (Ok 0.0, SoftValue.candidates sv)
        ||> List.fold (fun acc (v, p) ->
            acc
            |> Result.bind (fun a ->
                match v with
                | DynamicValue.Int x -> Ok(a + p * float x)
                | DynamicValue.Float x -> Ok(a + p * x)
                | _ -> Error(N.NotNumeric("mean", "non-numeric-candidate"))))

    /// **Shader-lowerable sibling — total distribution arithmetic (candidates poison to NaN, never decline).**
    [<RequireQualifiedAccess>]
    module Sat =

        let private convolve (leaf: DynamicValue -> DynamicValue -> DynamicValue) a b : SoftValue.SoftValue =
            [ for v1, p1 in SoftValue.candidates a do
                  for v2, p2 in SoftValue.candidates b do
                      yield leaf v1 v2, p1 * p2 ]
            |> SoftValue.ofWeighted
            |> Option.defaultValue (SoftValue.certain (DynamicValue.Float nan))

        let add (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : SoftValue.SoftValue = convolve N.Sat.add a b
        let mul (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : SoftValue.SoftValue = convolve N.Sat.mul a b

        let negate (a: SoftValue.SoftValue) : SoftValue.SoftValue =
            [ for v, p in SoftValue.candidates a -> N.Sat.negate v, p ]
            |> SoftValue.ofWeighted
            |> Option.defaultValue (SoftValue.certain (DynamicValue.Float nan))
