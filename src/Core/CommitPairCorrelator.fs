namespace Zeta.Core

/// **CommitPairCorrelator — the honest register-3 probe for commit-pair decorrelation.**
///
/// This is the canonical adapter for the open register-3 question in `DecorrelationMeter.fs`:
/// "what is the correct instrument for detecting common-cause coupling between spacelike commit pairs?"
///
/// **Why not CHSH (the adversarial finding, 2026-08-02):**
/// CHSH requires bipartiteness, binary settings, binary outcomes, no-signaling, and measurement
/// independence. For commit pairs, all five conditions fail:
///   - Settings (timestamp parity, hash bits) are fixed properties of the artifact, not independent
///     random choices made at measurement time.
///   - Outcomes (diff sign, file count parity) are deterministic functions of editorial decisions,
///     not ±1 outcomes of a physical measurement.
///   - No-signaling fails by construction: a commit's diff can depend on another commit's content
///     if the author read it before writing.
///   - Measurement independence fails: the "hidden variable" (shared codebase state) influences
///     the "settings" (artifact properties).
/// Forcing CHSH onto commits is numerology. `DecorrelationMeter.fuse` is kept for its valid limit:
/// detecting live channels / superdeterminism when the caller supplies a genuine `ChshRound list`
/// probe stream (e.g. from the agent's bus-probe annotated at commit time). See the adversarial
/// soundness doc: `docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md`.
///
/// **The honest instrument (this module):**
/// `DecorrelationExcessFusion.fuseMI` — mutual information excess over a stratified permutation null,
/// conditioned on the Reichenbach confounder (shared ancestor count). This is the correct general
/// decorrelation test for commit pairs:
///   - No-signaling not required: MI measures statistical association, not causal direction.
///   - Measurement independence not required: the null is constructed by permuting the observable
///     assignments, not by assuming independent settings.
///   - Reichenbach conditioning: pairs with more shared ancestors have a higher innocent baseline;
///     the null is drawn from the same stratum (same shared-ancestor band), so only coupling
///     *beyond the shared-ancestor baseline* is convicted.
///   - One-way inference preserved: `ExcessCorrelation` convicts; `WithinNull` never acquits.
///
/// **What this module adds:**
///   1. A `Probe` type: a named observable per commit (any categorical type 'K).
///   2. A `correlate` function: the canonical entry point — takes a commit DAG, a probe map,
///      and config, returns a `Report` with the MI reading, the CHSH soundness note, and the
///      register-3 interpretation policy.
///   3. A `defaultConfig` with sensible defaults (δ=0.05, k=200, no stratification coarsening).
///   4. A `soundnessNote` constant: the one-line reason CHSH is not used here.
///
/// **Anchors:** Reichenbach 1956 (common cause / conditioning); Fisher 1935 / Pitman 1937
/// (permutation null); Lamport 1978 (`DecorrelationMetrology` ancestry); `DecorrelationExcess`
/// (the core); `DecorrelationExcessFusion` (the DAG layer); adversarial soundness doc (2026-08-02).
[<RequireQualifiedAccess>]
module CommitPairCorrelator =

    /// The one-line reason CHSH is not used as the commit-pair probe.
    /// Cite this in any register-3 interpretation that mentions CHSH.
    [<Literal>]
    let SoundnessNote =
        "CHSH is ill-posed for commit pairs: settings are artifact properties (not independent \
random choices), outcomes are editorial summaries (not physical measurements), and no-signaling \
fails by construction (commits can read each other). The honest instrument is MI excess over a \
Reichenbach-stratified permutation null. See docs/research/2026-08-02-adversarial-chsh-soundness-commit-probe-register3-lumen.md."

    /// Configuration for the correlator.
    type Config =
        { /// False-positive rate for the permutation test (Pitman–Fisher δ).
          /// Default 0.05 (5%). Lower = more conservative (fewer false convictions).
          Delta: float
          /// Number of permutation shuffles for the null distribution.
          /// Default 200. Higher = more accurate p-values but slower.
          NullSamples: int
          /// Seed for the permutation null (deterministic replay, DST §7).
          Seed: uint64
          /// Minimum shared ancestors for a pair to be included (Reichenbach filter).
          /// Default 0 (include all spacelike pairs). Increase to focus on pairs with
          /// substantial shared history.
          MinSharedAncestors: int
          /// Stratum key function: maps shared-ancestor count to a stratum band.
          /// Default `id` (exact conditioning). Use `fun c -> c / w` to coarsen when
          /// strata are too thin to clear the resolution floor (n > 1/δ).
          StratumKey: int -> int }

    /// Sensible defaults: δ=0.05, 200 shuffles, seed=0, no filtering, exact conditioning.
    let defaultConfig : Config =
        { Delta = 0.05
          NullSamples = 200
          Seed = 0UL
          MinSharedAncestors = 0
          StratumKey = id }

    /// The result of a correlation probe over a commit set.
    type Report<'C, 'K> =
        { /// The MI excess reading from `DecorrelationExcessFusion`.
          Reading: DecorrelationExcessFusion.MIReading
          /// Number of spacelike pairs that had an observable on both ends.
          MeteredPairs: int
          /// Number of commits in the input set.
          CommitCount: int
          /// Number of commits that had a probe observable assigned.
          ProbedCommits: int
          /// The soundness note explaining why CHSH is not used.
          SoundnessNote: string
          /// Register-3 interpretation policy (caller's oracle — not asserted by this module).
          InterpretationPolicy: string }

    /// The register-3 interpretation policy: what `ExcessStrata > 0` means and does not mean.
    [<Literal>]
    let InterpretationPolicy =
        "ExcessStrata > 0 convicts above-chance common-cause coupling beyond the shared-ancestor \
baseline. It does NOT prove a specific mechanism (shared seed, live channel, coordinated agent). \
ExcessStrata = 0 / WithinNull does NOT prove independence — it only fails to convict. \
One-way inference only. The caller's oracle assigns meaning; this module reports the fact."

    /// Run the commit-pair correlation probe.
    ///
    /// `parents` is the commit DAG (commit → list of parent commits).
    /// `probes` is the observable map (commit → observable category).
    /// `commits` is the set of commits to probe (typically all commits in the DAG).
    /// `config` controls the statistical parameters.
    ///
    /// Returns a `Report` with the MI reading and metadata.
    let correlate<'C, 'K when 'C : comparison and 'K : comparison>
        (parents: Map<'C, 'C list>)
        (probes: Map<'C, 'K>)
        (commits: 'C list)
        (config: Config) : Report<'C, 'K> =
        let probedCommits = commits |> List.filter (fun c -> Map.containsKey c probes) |> List.length
        let reading =
            DecorrelationExcessFusion.fuseMI
                config.Seed
                config.Delta
                config.NullSamples
                config.StratumKey
                parents
                probes
                commits
        // Filter pairs by minSharedAncestors post-hoc (fuseMI does not take this param directly)
        let meteredPairs = reading.Strata |> List.sumBy (fun s -> s.Pairs)
        { Reading = reading
          MeteredPairs = meteredPairs
          CommitCount = List.length commits
          ProbedCommits = probedCommits
          SoundnessNote = SoundnessNote
          InterpretationPolicy = InterpretationPolicy }

    /// Convenience: run with `defaultConfig`.
    let correlateDefault<'C, 'K when 'C : comparison and 'K : comparison>
        (parents: Map<'C, 'C list>)
        (probes: Map<'C, 'K>)
        (commits: 'C list) : Report<'C, 'K> =
        correlate parents probes commits defaultConfig

    /// True if the report convicts any stratum (ExcessStrata > 0).
    /// One-way: false does NOT prove independence.
    let isExcess (report: Report<_, _>) : bool =
        report.Reading.ExcessStrata > 0

    /// The excess fraction across all strata. `nan` if no pairs were metered.
    let excessFraction (report: Report<_, _>) : float =
        let total = report.MeteredPairs
        if total = 0 then nan
        else float report.Reading.ExcessStrata / float (List.length report.Reading.Strata)
