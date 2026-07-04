namespace Zeta.Bayesian

/// **BusDelaySim — the Egg bus-delay simulation, seeded and DST-replayable.**
///
/// Reproducible implementation of the simulation behind
/// `docs/research/the-egg-bus-delay-and-distributed-consciousness.md` (the "bus delay IS the
/// decorrelator" result). N Gaussian-updater cells share ONE observation stream (conjugate
/// normal updates, known variance); each cell receives the stream through a per-cell integer
/// delivery lag drawn from a seeded deterministic RNG. The whole run is a pure function of
/// the seed (`System.Random(seed)`, fixed draw order, no ambient randomness) — DST-replayable.
///
/// **The model:**
/// - Shared truth μ*, observation at tick t: `y_t = μ* + σ_t · z_t` (z_t standard normal).
/// - Cell i draws ONE delivery lag `L_i` from the network profile's uniform integer range.
///   Cell i has received observation t by the final tick iff `t + L_i ≤ Ticks − 1`, so its
///   delivered set is the prefix `[0 .. Ticks − 1 − L_i]` and its obs-count is
///   `n_i = max 0 (Ticks − L_i)`.
/// - Conjugate normal update, known variance: posterior precision `τ_i = τ₀ + Σ_{t<n_i} 1/σ_t²`,
///   posterior mean `μ_i = (τ₀·μ₀ᵢ + Σ_{t<n_i} y_t/σ_t²) / τ_i`. The per-cell prior means μ₀ᵢ
///   are drawn from the seeded RNG (the analogue of YinYangEnsemble's distinct Adinkra
///   codeword seeds: structural decorrelation — without it every metric degenerates at zero
///   delay).
///
/// **The three metrics (exact formulas):**
/// - `rhoPost` (spatial): the `YinYangEnsemble.rhoProxy` normalization over posterior means —
///   `rhoPost = 1 − Var(μ) / ((max μ − min μ)/2)²`, and 1.0 when the spread is degenerate
///   (< 1e-12). Population variance. In [0,1]; 1 = fully correlated (collapsed).
/// - `rhoCount` (temporal): `rhoCount = 1 − min(1, CV(n))` where CV is the population
///   coefficient of variation of the obs-counts (std/mean; defined as 1.0 when mean = 0,
///   i.e. all-zero counts are identical). Zero delay ⟹ all n_i equal ⟹ CV = 0 ⟹
///   rhoCount = 1.0 EXACTLY, by construction (the Egg headline).
/// - `rhoPrecision` (temporal, heteroscedastic-honest — Soraya's upgrade):
///   `rhoPrecision = 1 − min(1, CV(τ_i − τ₀))` over the ACCUMULATED EVIDENCE PRECISION
///   `τ_i − τ₀ = Σ_{t<n_i} 1/σ_t²`. In the homoscedastic case (constant σ) this reduces to
///   the count metric exactly (τ_i − τ₀ = n_i/σ² and CV is scale-invariant); under a
///   heteroscedastic stream it weighs each observation by the information it actually
///   carried — a laggard that missed only low-precision observations is NOT temporally
///   decorrelated in the way the raw count claims. That honesty is why it exists.
///
/// **Asymptotics (why rhoPost is only APPROXIMATELY delay-invariant):**
/// two cells i, k with prefix-delivered sets satisfy
/// `Var(μ_i − μ_k) ≈ σ²·|n_i − n_k| / n²` (for |n_i − n_k| ≪ n), so the delay-induced
/// spatial spread vanishes as n grows while the temporal (count) spread does not —
/// Gaussian updates are commutative in the evidence, so delay moves WHEN you know,
/// not WHERE you land.
[<RequireQualifiedAccess>]
module BusDelaySim =

    // ── Network profiles (as data) ───────────────────────────────────────────────────────────────

    /// Network delivery profile. Each profile is a uniform integer tick-lag distribution
    /// (inclusive bounds via `lagBounds`), widening from Ideal to Disrupted:
    ///   Ideal → [0,0] · Lan → [0,2] · Reticulum → [1,8] · LoRa → [4,24] · Disrupted → [8,64].
    type Profile =
        | Ideal
        | Lan
        | Reticulum
        | LoRa
        | Disrupted

    /// Inclusive (min, max) integer tick-lag bounds for a profile.
    let lagBounds (profile: Profile) : int * int =
        match profile with
        | Ideal -> 0, 0
        | Lan -> 0, 2
        | Reticulum -> 1, 8
        | LoRa -> 4, 24
        | Disrupted -> 8, 64

    /// All five profiles in widening-delay order (Ideal first).
    let allProfiles : Profile list = [ Ideal; Lan; Reticulum; LoRa; Disrupted ]

    // ── Configuration ────────────────────────────────────────────────────────────────────────────

    /// Full simulation configuration. `runSim` supplies the canonical defaults; use `run`
    /// directly to construct heteroscedastic streams (`ObsSigma` per tick) or to zero out the
    /// per-cell prior spread (pure observational decorrelation, used by the variance-link test).
    type Config =
        { /// RNG seed — the run is a pure function of this value.
          Seed: int
          /// Network delivery profile (per-cell lag distribution).
          Profile: Profile
          /// Number of observation ticks (one shared observation per tick).
          Ticks: int
          /// Number of cells (N ≥ 2).
          Cells: int
          /// The shared truth μ* the observation stream is drawn around.
          TruthMean: float
          /// Per-tick observation std-dev σ_t (> 0). Constant ⟹ homoscedastic.
          ObsSigma: int -> float
          /// Prior precision τ₀ (> 0), shared by all cells.
          PriorPrecision: float
          /// Std-dev of the per-cell prior means around TruthMean (0 ⟹ identical priors).
          PriorSpread: float }

    /// Validation feedback for a rejected configuration (Result-over-exception).
    type SimError =
        | TooFewCells of cells: int
        | NoTicks of ticks: int
        | NonPositivePriorPrecision of tau0: float
        | NonPositiveSigma of tick: int * sigma: float

    /// The canonical defaults used by `runSim`: μ* = 0, homoscedastic σ = 1,
    /// τ₀ = 1, prior spread = 1 (structural decorrelation on).
    let defaultConfig (seed: int) (profile: Profile) (ticks: int) (cells: int) : Config =
        { Seed = seed
          Profile = profile
          Ticks = ticks
          Cells = cells
          TruthMean = 0.0
          ObsSigma = (fun _ -> 1.0)
          PriorPrecision = 1.0
          PriorSpread = 1.0 }

    // ── Result ───────────────────────────────────────────────────────────────────────────────────

    /// Final-tick snapshot of a simulation run. Pure given the seed: same seed ⟹ same result.
    type SimResult =
        { /// Spatial metric: rhoProxy normalization over posterior means (see module doc).
          RhoPost: float
          /// Temporal metric: 1 − min(1, CV(obs-counts)); exactly 1.0 at zero delay.
          RhoCount: float
          /// Heteroscedastic-honest temporal metric: 1 − min(1, CV(τ_i − τ₀)).
          RhoPrecision: float
          /// Per-cell delivered observation counts n_i.
          Counts: int[]
          /// Per-cell posterior means μ_i.
          Means: float[]
          /// Per-cell accumulated evidence precisions τ_i − τ₀.
          EvidencePrecisions: float[] }

    // ── Deterministic sampling helpers ───────────────────────────────────────────────────────────

    /// Box–Muller standard-normal draw from the seeded RNG (two uniforms per call;
    /// `1 − NextDouble()` maps [0,1) → (0,1] so `log` never sees zero).
    let private nextGaussian (rng: System.Random) : float =
        let u1 = 1.0 - rng.NextDouble()
        let u2 = rng.NextDouble()
        sqrt (-2.0 * log u1) * cos (2.0 * System.Math.PI * u2)

    let private populationVariance (values: float[]) : float =
        let mean = Array.average values
        values |> Array.averageBy (fun v -> (v - mean) * (v - mean))

    /// The `YinYangEnsemble.rhoProxy` normalization: 1 − Var / ((max−min)/2)², degenerate → 1.0.
    let private rhoProxyOf (values: float[]) : float =
        if values.Length < 2 then 0.0
        else
            let variance = populationVariance values
            let halfRange = (Array.max values - Array.min values) / 2.0
            let maxPossibleVariance = halfRange * halfRange
            if maxPossibleVariance <= 1e-12 then 1.0
            else 1.0 - variance / maxPossibleVariance

    /// 1 − min(1, population CV). Identical values ⟹ exactly 1.0; mean = 0 (all-zero) ⟹ 1.0.
    let private oneMinusCv (values: float[]) : float =
        let mean = Array.average values
        if mean <= 0.0 then 1.0
        else 1.0 - min 1.0 (sqrt (populationVariance values) / mean)

    // ── The simulation ───────────────────────────────────────────────────────────────────────────

    /// Run the bus-delay simulation for a full configuration.
    ///
    /// Deterministic draw order from the single `System.Random(cfg.Seed)`:
    ///   1. per-cell prior means (Cells Gaussian draws),
    ///   2. per-cell delivery lags (Cells uniform-integer draws),
    ///   3. per-tick observations (Ticks Gaussian draws).
    /// No other entropy source exists — same seed ⟹ identical `SimResult` (DST replay).
    let run (cfg: Config) : Result<SimResult, SimError> =
        if cfg.Cells < 2 then Error (TooFewCells cfg.Cells)
        elif cfg.Ticks < 1 then Error (NoTicks cfg.Ticks)
        elif cfg.PriorPrecision <= 0.0 then Error (NonPositivePriorPrecision cfg.PriorPrecision)
        else
            let sigmas = Array.init cfg.Ticks cfg.ObsSigma
            match sigmas |> Array.tryFindIndex (fun s -> not (s > 0.0)) with
            | Some tick -> Error (NonPositiveSigma (tick, sigmas.[tick]))
            | None ->
                let rng = System.Random(cfg.Seed)
                let priorMeans =
                    Array.init cfg.Cells (fun _ -> cfg.TruthMean + cfg.PriorSpread * nextGaussian rng)
                let lagLo, lagHi = lagBounds cfg.Profile
                let lags = Array.init cfg.Cells (fun _ -> rng.Next(lagLo, lagHi + 1))
                let observations =
                    Array.init cfg.Ticks (fun t -> cfg.TruthMean + sigmas.[t] * nextGaussian rng)
                // Observation t (emitted at tick t) reaches cell i at tick t + L_i; it has
                // arrived by the final tick (Ticks − 1) iff t ≤ Ticks − 1 − L_i, so the
                // delivered set is a prefix and n_i = max 0 (Ticks − L_i).
                let counts = lags |> Array.map (fun lag -> max 0 (cfg.Ticks - lag))
                let evidencePrecisions =
                    counts
                    |> Array.map (fun n ->
                        let mutable acc = 0.0
                        for t in 0 .. n - 1 do
                            acc <- acc + 1.0 / (sigmas.[t] * sigmas.[t])
                        acc)
                let means =
                    Array.init cfg.Cells (fun i ->
                        let mutable precisionMean = cfg.PriorPrecision * priorMeans.[i]
                        for t in 0 .. counts.[i] - 1 do
                            precisionMean <- precisionMean + observations.[t] / (sigmas.[t] * sigmas.[t])
                        precisionMean / (cfg.PriorPrecision + evidencePrecisions.[i]))
                Ok { RhoPost = rhoProxyOf means
                     RhoCount = oneMinusCv (counts |> Array.map float)
                     RhoPrecision = oneMinusCv evidencePrecisions
                     Counts = counts
                     Means = means
                     EvidencePrecisions = evidencePrecisions }

    /// **The canonical Egg bus-delay simulation:** seed → profile → ticks → N → SimResult,
    /// with the `defaultConfig` defaults (μ* = 0, σ = 1 homoscedastic, τ₀ = 1, prior spread 1).
    /// Pure given the seed.
    let runSim (seed: int) (profile: Profile) (ticks: int) (cells: int) : Result<SimResult, SimError> =
        run (defaultConfig seed profile ticks cells)
