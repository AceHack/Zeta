namespace Zeta.Core

open System
open System.Collections.Immutable
open System.IO
open System.IO.Compression
open System.Text


/// ═══════════════════════════════════════════════════════════════════
/// SignalQuality — composable dimensions for assessing content quality
/// ═══════════════════════════════════════════════════════════════════
///
/// Layered quality measurement over arbitrary content, driven by the
/// observation that *truthful technical content* tends to compress
/// well, preserve invariants under transformation, make falsifiable
/// predictions, and reuse structure — while *low-quality* content
/// tends to the inverse. No single dimension is conclusive; the
/// composite score combines dimensions under caller-chosen weights.
///
/// The module is deliberately minimal: each dimension is a small,
/// independently-testable function. Callers compose dimensions by
/// running them individually and feeding the findings into
/// `composite`. This keeps every dimension swappable (the Entropy
/// dimension, for instance, is a stub here pending a language-model
/// integration decision) without requiring the harness to track a
/// shifting multi-component surface.
///
/// **Integration with the Z-set algebra.** Claims are represented as
/// `ZSet<string>` — key = claim identifier, weight = evidentiary
/// confidence (positive = asserted, negative = retracted). This
/// aligns the module with the retraction-native model: a claim that
/// arrives and is then contradicted resolves to zero weight (no
/// residual), matching the "zero-sum rule" named as the first-line
/// algebraic invariant. See
/// `docs/research/oss-deep-research-zeta-aurora-2026-04-22.md` for
/// the seven-layer oracle-gate framing this module operates inside.


/// Which quality dimension a finding reports on. Dimensions are
/// orthogonal axes — high quality on one dimension does not
/// guarantee high quality on another, which is why the composite
/// score is a weighted mean, not an AND.
type QualityDimension =
    /// Compression ratio — proxy for Kolmogorov complexity relative
    /// to length. Content with low ratio (compresses well) tends to
    /// have repeated structure that signals coherence; content with
    /// high ratio is structurally shallow.
    | Compression

    /// Cross-entropy / perplexity under a model. Placeholder — a
    /// concrete implementation requires a reference distribution
    /// (language model or character-frequency table). This dimension
    /// is declared here so the taxonomy is complete; the stub
    /// measurement returns a neutral score.
    | Entropy

    /// Consistency across transformations — paraphrase invariance,
    /// constraint-graph acyclicity. Currently measured via the
    /// claim-store: consistent if no claim has both positive and
    /// negative weight accumulated to a non-zero residual.
    | Consistency

    /// Proportion of claims grounded to data / definitions / testable
    /// mechanisms. Measured against the claim-store via a caller-
    /// provided predicate (since "grounded" is domain-specific).
    | Grounding

    /// Proportion of claims that could be proven wrong. Measured via
    /// a caller-provided predicate (falsifiability is domain-specific).
    | Falsifiability

    /// Drift over time — how far the current state has moved from a
    /// prior snapshot. Measured via set-distance on the claim-store.
    | Drift


/// Severity follows the oracle-gate taxonomy from the Zeta/Aurora
/// deep-research absorption: *semantic failure* (algebra-law
/// violation) triggers `Fail`; *possibly-already-visible-side-effect*
/// failure triggers `Quarantine`; *freshness/coverage* gaps trigger
/// `Warn`; clean measurement is `Pass`.
type QualitySeverity =
    | Pass
    | Warn
    | Fail
    | Quarantine


/// A single measurement outcome. `Score` is normalised to `[0.0, 1.0]`
/// where `0.0` means the dimension looks clean and `1.0` means the
/// dimension is maximally suspect. Callers compose findings through
/// `composite`.
[<Struct>]
type QualityFinding = {
    Dimension: QualityDimension
    Severity: QualitySeverity
    /// Suspicion score in `[0.0, 1.0]`; higher = lower quality.
    Score: float
    Evidence: string
}


/// A composite assessment across multiple dimensions. `Composite` is
/// the weighted mean of per-dimension scores (sum of weighted scores
/// divided by sum of weights); callers supply the weights via
/// `composite`.
type QualityScore = {
    Composite: float
    Findings: QualityFinding list
}


/// A measure of one dimension over input of type `'T`. Implementations
/// are expected to be deterministic — given the same input twice, the
/// same finding comes back — so composite scores are themselves
/// reproducible.
type IQualityMeasure<'T> =
    abstract member Dimension: QualityDimension
    abstract member Measure: 'T -> QualityFinding


[<RequireQualifiedAccess>]
module SignalQuality =

    // ───────────────────────────────────────────────────────────────
    // Severity bands — translate a raw `Score` in `[0.0, 1.0]` into
    // a `QualitySeverity` so callers get a coarse pass/warn/fail
    // read without re-deriving band cutoffs themselves.
    // ───────────────────────────────────────────────────────────────

    /// Translate a `[0.0, 1.0]` suspicion score into a severity band.
    /// Cutoffs chosen to match the teaching-direction bands used in
    /// the operator-input quality log (1.0-2.4 / 2.5-3.9 / 4.0-5.0),
    /// rescaled to the `[0.0, 1.0]` range used here: `< 0.30` = Pass,
    /// `< 0.60` = Warn, `< 0.85` = Fail, `≥ 0.85` = Quarantine.
    let severityOfScore (score: float) : QualitySeverity =
        if Double.IsNaN score then Quarantine
        elif score < 0.30 then Pass
        elif score < 0.60 then Warn
        elif score < 0.85 then Fail
        else Quarantine


    // ───────────────────────────────────────────────────────────────
    // Compression dimension — section 2.2 of the bullshit-detector
    // design spec. Kolmogorov
    // complexity is uncomputable, so we approximate via the ratio of
    // gzip-compressed length to raw length: low ratio = structured,
    // high ratio = noisy.
    // ───────────────────────────────────────────────────────────────

    /// Minimum input length at which the gzip compression ratio
    /// carries meaningful signal. Below this threshold the gzip
    /// header + trailer overhead (~20 bytes) dominates the output
    /// size and the ratio is deterministically close to `1.0` — so
    /// the dimension would report maximum suspicion for any short
    /// legitimate string, producing spurious Quarantine verdicts
    /// unrelated to content quality. `compressionRatio` short-
    /// circuits to `0.0` (neutral) below this bound.
    ///
    /// Chosen conservatively: gzip header = 10 B, trailer = 8 B,
    /// minimum deflate block overhead adds a few more. 64 bytes
    /// leaves enough payload that even incompressible random data
    /// lands near 1.0 honestly, while structured text clearly
    /// beats the header. Callers measuring intentionally short
    /// signals should not rely on the Compression dimension.
    ///
    /// Marked `private` because it is an internal tuning constant
    /// for the Compression dimension, not part of the supported
    /// `SignalQuality` API surface. If a future caller needs the
    /// threshold as a public hook (e.g. to assert parity with a
    /// sibling measure), the right move is a dedicated accessor
    /// with a stable contract rather than leaking the raw binding.
    let private compressionMinInputBytes = 64

    /// Compression ratio `|compress(x)| / |x|` using gzip as a
    /// Kolmogorov-complexity proxy. Returns `0.0` (neutral) for
    /// empty and below-threshold inputs (under `compressionMinInputBytes`
    /// UTF-8 bytes) — see the threshold docstring for rationale on
    /// the short-input short-circuit. Clamped to `[0.0, 1.0]` — a
    /// well-behaved compressor cannot exceed the input length for
    /// realistic inputs, but tiny strings can expand under the gzip
    /// header overhead; the clamp keeps the return value in the
    /// interval the composite math assumes.
    let compressionRatio (text: string) : float =
        if String.IsNullOrEmpty text then 0.0
        else
            let raw = Encoding.UTF8.GetBytes text
            if raw.Length < compressionMinInputBytes then 0.0
            else
                use out = new MemoryStream()
                // Inner scope forces the GZipStream to flush / dispose
                // before we read `out.Length`, so we can measure the
                // compressed payload without materialising it via
                // `ToArray()` (per review feedback: avoid the byte-copy
                // just to read the length).
                (use gz = new GZipStream(out, CompressionLevel.Optimal, leaveOpen = true)
                 gz.Write(raw, 0, raw.Length))
                let ratio = float out.Length / float raw.Length
                if ratio < 0.0 then 0.0
                elif ratio > 1.0 then 1.0
                else ratio

    /// Compression-dimension measure. Suspicion score is the
    /// compression ratio directly — high ratio means low structural
    /// regularity, which is a bullshit signal in the spec's framing.
    /// Evidence reports the UTF-8 byte length (the quantity the
    /// `compressionMinInputBytes` threshold actually gates on), not
    /// `text.Length` (chars), so the short-circuit path and the
    /// evidence units agree for non-ASCII inputs.
    let compressionMeasure : IQualityMeasure<string> =
        { new IQualityMeasure<string> with
            member _.Dimension = Compression
            member _.Measure(text: string) =
                let ratio = compressionRatio text
                let bytes =
                    if isNull text then 0
                    else Encoding.UTF8.GetByteCount text
                { Dimension = Compression
                  Severity = severityOfScore ratio
                  Score = ratio
                  Evidence = sprintf "gzip-ratio=%.3f (bytes=%d)" ratio bytes } }


    // ───────────────────────────────────────────────────────────────
    // Entropy dimension — placeholder. A real implementation needs a
    // reference distribution (language model or Markov chain). For
    // now the measure returns a neutral score and a Warn severity,
    // so the composite math still runs while the dimension's
    // limitations are visible in the finding.
    // ───────────────────────────────────────────────────────────────

    /// Entropy-dimension measure (stub). Returns a neutral `0.5`
    /// score with `Warn` severity and evidence noting the stub.
    /// Callers wanting real entropy measurement should swap in an
    /// implementation backed by a chosen reference distribution.
    let entropyMeasure : IQualityMeasure<string> =
        { new IQualityMeasure<string> with
            member _.Dimension = Entropy
            member _.Measure(text: string) =
                let len = if isNull text then 0 else text.Length
                { Dimension = Entropy
                  Severity = Warn
                  Score = 0.5
                  Evidence = sprintf "stub-no-reference-distribution (len=%d)" len } }


    // ───────────────────────────────────────────────────────────────
    // Claim-store — claims represented as `ZSet<string>`. Weight =
    // evidentiary confidence (positive = asserted, negative =
    // retracted). Retraction-native from the ground up.
    // ───────────────────────────────────────────────────────────────

    /// Construct a claim store from `(claim, weight)` pairs. Duplicates
    /// are summed in the Z-set algebra so a claim asserted twice and
    /// retracted once lands at weight +1.
    let claimsOf (entries: seq<string * Weight>) : ZSet<string> =
        ZSet.ofSeq entries

    /// Proportion of claims with strictly positive residual weight.
    /// "Grounded" in this coarse measure = "still asserted after all
    /// retractions" — callers with a richer grounding predicate
    /// should use `groundingWith`.
    let groundedProportion (claims: ZSet<string>) : float =
        let span = claims.AsSpan()
        if span.IsEmpty then 1.0
        else
            let mutable grounded = 0
            let mutable total = 0
            for i = 0 to span.Length - 1 do
                total <- total + 1
                if span.[i].Weight > 0L then grounded <- grounded + 1
            if total = 0 then 1.0
            else float grounded / float total

    /// Proportion of claims that satisfy a caller-provided grounding
    /// predicate. Only **currently-asserted** claims (`Weight > 0L`)
    /// count. Weight-zero entries (clean cancellation) and
    /// over-retracted entries (`Weight < 0L`) are ignored — the
    /// former are "no claim"; the latter are contradictions already
    /// captured by `consistencyMeasure`, so counting them here would
    /// double-penalise the stream and inflate suspicion.
    let groundingWith (predicate: string -> bool) (claims: ZSet<string>) : float =
        let span = claims.AsSpan()
        if span.IsEmpty then 1.0
        else
            let mutable grounded = 0
            let mutable total = 0
            for i = 0 to span.Length - 1 do
                if span.[i].Weight > 0L then
                    total <- total + 1
                    if predicate span.[i].Key then grounded <- grounded + 1
            if total = 0 then 1.0
            else float grounded / float total

    /// Grounding-dimension measure. Suspicion score = `1 - grounded`
    /// so that high grounding produces low suspicion, matching the
    /// composite-math convention.
    let groundingMeasure (predicate: string -> bool) : IQualityMeasure<ZSet<string>> =
        { new IQualityMeasure<ZSet<string>> with
            member _.Dimension = Grounding
            member _.Measure(claims: ZSet<string>) =
                let grounded = groundingWith predicate claims
                let suspicion = 1.0 - grounded
                { Dimension = Grounding
                  Severity = severityOfScore suspicion
                  Score = suspicion
                  Evidence = sprintf "grounded=%.3f claims=%d" grounded claims.Count } }


    // ───────────────────────────────────────────────────────────────
    // Falsifiability dimension — proportion of claims that could be
    // proven wrong. Same shape as grounding: caller supplies the
    // domain-specific predicate.
    // ───────────────────────────────────────────────────────────────

    /// Proportion of claims that satisfy a caller-provided
    /// falsifiability predicate. Only **currently-asserted** claims
    /// (`Weight > 0L`) count. Weight-zero entries (clean cancellation)
    /// and over-retracted entries (`Weight < 0L`) are ignored —
    /// over-retractions are the algebraic consistency signal already
    /// handled by `consistencyMeasure` and must not double-penalise
    /// falsifiability.
    let falsifiabilityWith (predicate: string -> bool) (claims: ZSet<string>) : float =
        let span = claims.AsSpan()
        if span.IsEmpty then 1.0
        else
            let mutable falsifiable = 0
            let mutable total = 0
            for i = 0 to span.Length - 1 do
                if span.[i].Weight > 0L then
                    total <- total + 1
                    if predicate span.[i].Key then falsifiable <- falsifiable + 1
            if total = 0 then 1.0
            else float falsifiable / float total

    /// Falsifiability-dimension measure. Suspicion score =
    /// `1 - falsifiable` (higher falsifiability = lower suspicion).
    let falsifiabilityMeasure (predicate: string -> bool) : IQualityMeasure<ZSet<string>> =
        { new IQualityMeasure<ZSet<string>> with
            member _.Dimension = Falsifiability
            member _.Measure(claims: ZSet<string>) =
                let falsifiable = falsifiabilityWith predicate claims
                let suspicion = 1.0 - falsifiable
                { Dimension = Falsifiability
                  Severity = severityOfScore suspicion
                  Score = suspicion
                  Evidence = sprintf "falsifiable=%.3f claims=%d" falsifiable claims.Count } }


    // ───────────────────────────────────────────────────────────────
    // Consistency dimension — retraction-algebra naturally encodes
    // consistency as "every claim has non-negative residual weight".
    // A claim asserted and then retracted resolves to zero (gone,
    // cleanly). A claim asserted multiple times and retracted fewer
    // times stays positive. An over-retraction — residual weight
    // below zero — is the algebraic signal of a contradiction that
    // the caller never reconciled.
    // ───────────────────────────────────────────────────────────────

    /// Consistency score in `[0.0, 1.0]` where `1.0` = every claim
    /// has non-negative residual weight and `0.0` = every claim is
    /// over-retracted. Z-set's zero-residual-on-contradiction is the
    /// "clean cancellation" case; we only flag *over-retraction*
    /// as inconsistency.
    let consistencyScore (claims: ZSet<string>) : float =
        let span = claims.AsSpan()
        if span.IsEmpty then 1.0
        else
            let mutable consistent = 0
            for i = 0 to span.Length - 1 do
                if span.[i].Weight >= 0L then consistent <- consistent + 1
            float consistent / float span.Length

    /// Consistency-dimension measure. Suspicion = `1 - consistency`.
    let consistencyMeasure : IQualityMeasure<ZSet<string>> =
        { new IQualityMeasure<ZSet<string>> with
            member _.Dimension = Consistency
            member _.Measure(claims: ZSet<string>) =
                let consistency = consistencyScore claims
                let suspicion = 1.0 - consistency
                { Dimension = Consistency
                  Severity = severityOfScore suspicion
                  Score = suspicion
                  Evidence = sprintf "consistent=%.3f claims=%d" consistency claims.Count } }


    // ───────────────────────────────────────────────────────────────
    // Drift dimension — how far the current claim set has moved from
    // a prior snapshot. Computed as symmetric-difference cardinality
    // divided by union cardinality (Jaccard complement); low drift
    // under new-evidence = suspicion low; high drift without new
    // evidence = goalpost-shifting.
    // ───────────────────────────────────────────────────────────────

    /// Drift score between two claim-stores as the Jaccard complement
    /// `1 - |intersect| / |union|` over the supports (keys with
    /// positive residual weight).
    let driftScore (prev: ZSet<string>) (curr: ZSet<string>) : float =
        let asSet (z: ZSet<string>) : ImmutableHashSet<string> =
            let builder = ImmutableHashSet.CreateBuilder<string>()
            let span = z.AsSpan()
            for i = 0 to span.Length - 1 do
                if span.[i].Weight > 0L then
                    builder.Add span.[i].Key |> ignore
            builder.ToImmutable()
        let a = asSet prev
        let b = asSet curr
        if a.Count = 0 && b.Count = 0 then 0.0
        else
            let inter = a.Intersect b
            let union = a.Union b
            let interCount = inter.Count
            let unionCount = union.Count
            if unionCount = 0 then 0.0
            else 1.0 - (float interCount / float unionCount)

    /// Drift-dimension measure comparing `curr` against a
    /// caller-supplied `prev` snapshot.
    let driftMeasure (prev: ZSet<string>) : IQualityMeasure<ZSet<string>> =
        { new IQualityMeasure<ZSet<string>> with
            member _.Dimension = Drift
            member _.Measure(curr: ZSet<string>) =
                let drift = driftScore prev curr
                { Dimension = Drift
                  Severity = severityOfScore drift
                  Score = drift
                  Evidence = sprintf "jaccard-complement=%.3f" drift } }


    // ───────────────────────────────────────────────────────────────
    // Composite — weighted mean across dimensions (sum of weighted
    // scores divided by sum of weights). Weights do not need to sum
    // to 1; the mean normalisation handles that. Missing dimensions
    // (no finding supplied) contribute 0 to the numerator and nothing
    // to the denominator.
    // ───────────────────────────────────────────────────────────────

    /// Default uniform weights — every dimension weighted 1.0.
    let uniformWeights : Map<QualityDimension, float> =
        [ Compression, 1.0
          Entropy, 1.0
          Consistency, 1.0
          Grounding, 1.0
          Falsifiability, 1.0
          Drift, 1.0 ]
        |> Map.ofList

    /// Combine findings into a composite score. If the sum of weights
    /// for findings present is positive, the composite is the
    /// weighted mean; otherwise zero. NaN in any score under a
    /// *positive* weight poisons the composite to NaN (deliberate:
    /// NaN is an honest read when a weighted-in measure failed).
    ///
    /// **Weight semantics.** Only dimensions with `w > 0.0`
    /// participate in the weighted mean. Weights of `0.0` (explicit
    /// opt-out) and *negative* weights (treated as misconfiguration)
    /// are silently ignored — their scores do not enter `sumWeighted`
    /// and their NaN scores do not flip `sawNaN`. This matches the
    /// documented "missing/ignored dimensions contribute 0" behavior
    /// and avoids silent corruption when a caller misconfigures a
    /// weight (e.g. `-1.0` from config drift).
    let composite (weights: Map<QualityDimension, float>) (findings: QualityFinding list) : QualityScore =
        if List.isEmpty findings then
            { Composite = 0.0; Findings = [] }
        else
            let mutable sumWeighted = 0.0
            let mutable sumWeights = 0.0
            let mutable sawNaN = false
            for f in findings do
                let w =
                    match Map.tryFind f.Dimension weights with
                    | Some w -> w
                    | None -> 0.0
                if w > 0.0 then
                    if Double.IsNaN f.Score then
                        sawNaN <- true
                    else
                        sumWeighted <- sumWeighted + w * f.Score
                        sumWeights <- sumWeights + w
            let composite =
                if sawNaN then nan
                elif sumWeights > 0.0 then sumWeighted / sumWeights
                else 0.0
            { Composite = composite; Findings = findings }
