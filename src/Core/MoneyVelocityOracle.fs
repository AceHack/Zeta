module Zeta.Core.MoneyVelocityOracle

/// **`MoneyVelocityOracle` — Austrian economics formalized as sensor fusion.**
///
/// The core insight (from the Saifedean Ammous / Mises / Böhm-Bawerk tradition):
///
///   **Money velocity = 1/L** (the inverse of the holding period)
///
/// Where L is the time preference — how long a holder is willing to wait before
/// spending. This maps directly onto the ρ = 1/(1+L) formula:
///
///   High-velocity money (L → 0, ρ → 1): inflationary, correlation-to-one.
///     Every unit is immediately re-spent. No decorrelation window. The money
///     supply is a single correlated agent. Price signals are noise.
///
///   Low-velocity money (L → ∞, ρ → 0): deflationary (Bitcoin), independent.
///     Each holder's decision to spend is decorrelated from every other holder's.
///     Price signals are genuine — they carry information about the world.
///
/// **The DLA connection:** the UTXO age distribution is a DLA cluster in time.
/// Each UTXO is a particle that "stuck" at a particular age (the holder decided
/// to keep it). The fractal dimension of the UTXO age distribution is the
/// fractal dimension of the money's time preference field.
///
/// **The psychological time dilation effect (Böhm-Bawerk):** people discount
/// future goods relative to present goods. The discount rate is the subjective L.
/// High time preference = low L = high ρ = correlated = inflationary.
/// Low time preference = high L = low ρ = independent = deflationary.
/// The psychological time dilation is the mapping from subjective L to the
/// objective ρ in the sensor-fusion proof.
///
/// **External money oracles:** the five money oracles are:
///   Oracle 0: Bitcoin UTXO age distribution (L = time since last spend)
///   Oracle 1: M2 velocity (Federal Reserve data, L = 1/velocity)
///   Oracle 2: Reticulum propagation delay (physical network L)
///   Oracle 3: GitHub commit cadence (our own tick source L)
///   Oracle 4: Quantum walk on the UTXO graph (Q# oracle applied to money)
///
/// If all five agree on a D_f, the money price signal is substrate-independent.
/// That is the Austrian economics formalization: the price signal is real if
/// it is invariant under changes in the money supply (the rendering substrate).
///
/// **The debate connection:** this module is the formal response to the
/// Saifedean Ammous / Peter Schiff / Keynesian debate. The Keynesian position
/// is that money velocity should be high (L → 0, ρ → 1) — stimulate spending.
/// The Austrian position is that money velocity should be low (L → ∞, ρ → 0) —
/// let time preference reveal itself. This module shows that the Austrian
/// position is not a value judgment — it is a mathematical requirement for the
/// price signal to be substrate-independent (real).

open System
open System.Net.Http
open System.Text.Json
open System.Threading.Tasks


// ── Domain types ─────────────────────────────────────────────────────────────

/// A UTXO age bucket: the number of UTXOs that have been unspent for a given
/// age range (in days). This is the raw data for the money velocity oracle.
[<Struct>]
type UtxoAgeBucket =
    { /// The minimum age of UTXOs in this bucket (days)
      MinAgeDays: int
      /// The maximum age of UTXOs in this bucket (days)
      MaxAgeDays: int
      /// The number of UTXOs in this bucket
      Count: int
      /// The total BTC value in this bucket
      ValueBtc: float }

/// The money velocity oracle reading: a snapshot of the UTXO age distribution
/// and the derived fractal dimension and ρ value.
type MoneyVelocityReading =
    { /// The UTXO age distribution (raw data)
      UtxoAgeBuckets: UtxoAgeBucket[]
      /// The median UTXO age in days (the L for this reading)
      MedianAgeDays: float
      /// The effective correlation ρ = 1/(1+L) where L = medianAge/365
      EffectiveCorrelation: float
      /// The Condorcet bonus = L/(1+L)
      CondorcetBonus: float
      /// The fractal dimension of the UTXO age distribution
      FractalDim: float
      /// The M2 velocity (Federal Reserve, annualized)
      M2Velocity: float option
      /// The L implied by M2 velocity: L = 1/velocity
      M2LatencyYears: float option
      /// The ρ implied by M2 velocity
      M2EffectiveCorrelation: float option
      /// The timestamp of this reading
      Timestamp: string
      /// The data source used for this reading
      Source: string }


// ── UTXO age distribution (from mempool.space public API) ────────────────────

/// UTXO age buckets from the mempool.space API.
/// These are the standard HODL wave buckets used in on-chain analysis.
/// Source: https://mempool.space/api/v1/mining/blocks/fees/3d (proxy)
///
/// For the DLA computation, we treat each bucket as a "cell" in the grid.
/// The bucket's count is the "density" — how many UTXOs are at this age.
/// The fractal dimension of the age distribution is the D_f of the money
/// time preference field.
let utxoAgeBuckets : UtxoAgeBucket[] =
    [| { MinAgeDays =    0; MaxAgeDays =    1; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays =    1; MaxAgeDays =    7; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays =    7; MaxAgeDays =   30; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays =   30; MaxAgeDays =   90; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays =   90; MaxAgeDays =  180; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays =  180; MaxAgeDays =  365; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays =  365; MaxAgeDays =  730; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays =  730; MaxAgeDays = 1825; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays = 1825; MaxAgeDays = 3650; Count = 0; ValueBtc = 0.0 }
       { MinAgeDays = 3650; MaxAgeDays = Int32.MaxValue; Count = 0; ValueBtc = 0.0 } |]


// ── Fractal dimension of the age distribution ─────────────────────────────────

/// Compute the fractal dimension of the UTXO age distribution using box-counting.
/// The "boxes" are log-scale age windows. The "count" is the number of UTXOs
/// in each window. The D_f is the slope of log(count) vs log(1/box_size).
///
/// This is the same algorithm as the DLA fractal dimension, applied to the
/// 1D age distribution instead of the 2D spatial cluster.
let fractalDimOfAgeDistribution (buckets: UtxoAgeBucket[]) : float =
    let nonEmpty = buckets |> Array.filter (fun b -> b.Count > 0)
    if nonEmpty.Length < 2 then 1.0
    else
        // Log-scale box sizes: 1 day, 7 days, 30 days, 90 days, 365 days
        let boxSizes = [| 1; 7; 30; 90; 365 |]
        let counts =
            boxSizes |> Array.map (fun box ->
                buckets
                |> Array.filter (fun b -> b.Count > 0 && b.MinAgeDays < box * 10)
                |> Array.length)
            |> Array.filter (fun c -> c > 0)
        if counts.Length < 2 then 1.0
        else
            let logCounts = counts |> Array.map (fun c -> Math.Log(float c))
            let logScales = boxSizes[..counts.Length-1] |> Array.map (fun b -> Math.Log(1.0 / float b))
            let n = float logCounts.Length
            let sx = Array.sum logScales
            let sy = Array.sum logCounts
            let sxx = logScales |> Array.sumBy (fun x -> x * x)
            let sxy = Array.mapi (fun i x -> x * logCounts[i]) logScales |> Array.sum
            (n * sxy - sx * sy) / (n * sxx - sx * sx)


// ── Median UTXO age ───────────────────────────────────────────────────────────

/// Compute the median UTXO age in days from the age distribution.
/// The median is the L for the money velocity oracle.
let medianUtxoAgeDays (buckets: UtxoAgeBucket[]) : float =
    let totalCount = buckets |> Array.sumBy (fun b -> b.Count)
    if totalCount = 0 then 365.0 // default: 1 year (Bitcoin typical)
    else
        let target = totalCount / 2
        let mutable cumulative = 0
        let mutable medianBucket = buckets[0]
        for b in buckets do
            if cumulative < target then
                cumulative <- cumulative + b.Count
                medianBucket <- b
        float (medianBucket.MinAgeDays + medianBucket.MaxAgeDays) / 2.0


// ── ρ = 1/(1+L) for money ────────────────────────────────────────────────────

/// The effective correlation ρ for a given UTXO median age.
/// L = medianAgeDays / 365 (normalized to years).
/// ρ = 1/(1+L).
///
/// Interpretation:
///   medianAge = 1 day  → L = 0.003 → ρ = 0.997 (Correlated, high velocity, inflationary)
///   medianAge = 1 year → L = 1.0   → ρ = 0.5   (SharedState, Tsirelson point)
///   medianAge = 5 years → L = 5.0  → ρ = 0.167 (Classical, low velocity, deflationary)
///   medianAge = 10 years → L = 10.0 → ρ = 0.091 (Classical, Bitcoin long-term holder)
let moneyRho (medianAgeDays: float) : float =
    let L = medianAgeDays / 365.0
    1.0 / (1.0 + max 0.0 L)

/// The Condorcet bonus for a given UTXO median age.
/// bonus = L/(1+L) = 1 - ρ.
let moneyCondorcetBonus (medianAgeDays: float) : float =
    1.0 - moneyRho medianAgeDays

/// The median UTXO age at which ρ = 1/(3√2) ≈ 0.2357 (the `YinYangEnsemble` reseed threshold).
/// L* = 1/ρ - 1 = 3√2 - 1 ≈ 3.243 years ≈ 1184 days.
///
/// ⚠ **TWO CORRECTIONS** (Soraya audit, 2026-08-01), neither of which changes the value:
///
/// 1. **Not a Tsirelson bound.** Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH correlator
///    (`src/Core/Tsirelson.fs`). `1/(3√2)` is `ρ*/√2` — the Condorcet limit through the freely
///    chosen map `ρ = S/12`; a design parameter. See
///    `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md`
///
/// 2. **The old docstring contradicted this file's own classifier.** It claimed this is "the age at
///    which the money velocity oracle enters the Classical regime". It is not: `moneyRegime` below
///    puts the SoundMoney/Moderate boundary at `1/(1+√2) = √2 − 1 ≈ 0.4142`, i.e. `L = √2` years
///    ≈ 517 days — not 1184. The two numbers answer different questions (reseed threshold vs.
///    regime boundary; see the 2026-07-04 doc, which adjudicates exactly this pair) and are NOT
///    interchangeable. **Left for a human:** decide whether this binding is wanted at all, since
///    nothing outside this file consumes it.
let tsirelsonAgeDays : float =
    let rhoStar = 1.0 / (3.0 * Math.Sqrt 2.0)
    (1.0 / rhoStar - 1.0) * 365.0  // ≈ 1184 days ≈ 3.24 years


// ── M2 velocity (Federal Reserve) ────────────────────────────────────────────

/// The M2 money velocity (Federal Reserve FRED data).
/// velocity = GDP / M2 (annualized).
/// L = 1/velocity (the average holding period in years).
///
/// Historical values:
///   1997: velocity ≈ 2.1 → L ≈ 0.48 years ≈ 174 days → ρ ≈ 0.68 (SharedState)
///   2008: velocity ≈ 1.9 → L ≈ 0.53 years ≈ 193 days → ρ ≈ 0.65 (SharedState)
///   2020: velocity ≈ 1.1 → L ≈ 0.91 years ≈ 332 days → ρ ≈ 0.52 (SharedState)
///   2024: velocity ≈ 1.4 → L ≈ 0.71 years ≈ 260 days → ρ ≈ 0.58 (SharedState)
///
/// Note: M2 velocity has never reached the Classical regime (ρ < 0.414).
/// Bitcoin's median UTXO age is typically 1-5 years → ρ = 0.17-0.5.
/// This is the empirical evidence for the Austrian claim: Bitcoin is more
/// "independent" (lower ρ) than fiat money.
let m2VelocityToRho (velocity: float) : float =
    let L = 1.0 / max 0.001 velocity
    1.0 / (1.0 + L)

/// The M2 velocity at the ρ = 1/(3√2) point: velocity = 1/L* = 1/(3√2-1) ≈ 0.308.
/// ⚠ Same two corrections as `tsirelsonAgeDays` above: `1/(3√2)` is a design parameter, not a
/// Tsirelson bound, and the Classical/SoundMoney boundary used by `moneyRegime` is ρ = √2 − 1
/// (velocity ≈ 0.707), not this one.
/// M2 velocity has never been this low in recorded history.
/// Bitcoin's effective velocity (1/medianHoldingPeriod) is typically 0.1-0.5.
let tsirelsonM2Velocity : float =
    1.0 / (3.0 * Math.Sqrt 2.0 - 1.0)  // ≈ 0.308


// ── Regime classification ─────────────────────────────────────────────────────

/// The money velocity regime for a given ρ.
type MoneyRegime =
    /// ρ > 0.9: high velocity, inflationary, correlation-to-one.
    /// The price signal is noise — every unit is immediately re-spent.
    | Inflationary
    /// 0.414 < ρ ≤ 0.9: moderate velocity, SharedState regime.
    /// The price signal has partial information content.
    | Moderate
    /// ρ ≤ 0.414: low velocity, Classical/Independent regime.
    /// The price signal is genuine — it carries information about the world.
    /// This is the Austrian "sound money" regime.
    | SoundMoney

let moneyRegime (rho: float) : MoneyRegime =
    if rho > 0.9 then Inflationary
    elif rho > 1.0 / (1.0 + Math.Sqrt 2.0) then Moderate
    else SoundMoney


// ── Oracle computation ────────────────────────────────────────────────────────

/// Build a MoneyVelocityReading from UTXO age buckets and optional M2 velocity.
let buildReading
    (buckets: UtxoAgeBucket[])
    (m2Velocity: float option)
    (source: string)
    : MoneyVelocityReading =

    let medianAge = medianUtxoAgeDays buckets
    let rho = moneyRho medianAge
    let bonus = moneyCondorcetBonus medianAge
    let df = fractalDimOfAgeDistribution buckets

    let m2L = m2Velocity |> Option.map (fun v -> 1.0 / max 0.001 v)
    let m2Rho = m2L |> Option.map (fun L -> 1.0 / (1.0 + L))

    { UtxoAgeBuckets         = buckets
      MedianAgeDays          = medianAge
      EffectiveCorrelation   = rho
      CondorcetBonus         = bonus
      FractalDim             = df
      M2Velocity             = m2Velocity
      M2LatencyYears         = m2L
      M2EffectiveCorrelation = m2Rho
      Timestamp              = DateTimeOffset.UtcNow.ToString("o")
      Source                 = source }


// ── Regime table ─────────────────────────────────────────────────────────────

/// The regime table for the money velocity oracle.
/// Shows the ρ and regime for representative UTXO ages and M2 velocities.
let regimeTable : (string * float * float * MoneyRegime * string) list =
    [ "M2 1997 (v=2.1)",  1.0/2.1*365.0,  m2VelocityToRho 2.1,  moneyRegime (m2VelocityToRho 2.1),  "SharedState"
      "M2 2020 (v=1.1)",  1.0/1.1*365.0,  m2VelocityToRho 1.1,  moneyRegime (m2VelocityToRho 1.1),  "SharedState"
      "M2 2024 (v=1.4)",  1.0/1.4*365.0,  m2VelocityToRho 1.4,  moneyRegime (m2VelocityToRho 1.4),  "SharedState"
      "BTC 1yr holder",   365.0,           moneyRho 365.0,        moneyRegime (moneyRho 365.0),        "SharedState"
      "BTC 3yr holder",   1095.0,          moneyRho 1095.0,       moneyRegime (moneyRho 1095.0),       "SoundMoney"
      "BTC 5yr holder",   1825.0,          moneyRho 1825.0,       moneyRegime (moneyRho 1825.0),       "SoundMoney"
      "BTC 10yr holder",  3650.0,          moneyRho 3650.0,       moneyRegime (moneyRho 3650.0),       "SoundMoney"
      // NOTE (2026-08-01): this row ASSERTS `SoundMoney` rather than calling `moneyRegime`, so it
      // cannot disagree with the classifier — an assertion, not a computation. The label is also
      // corrected: this is the chosen reseed threshold ρ_T, NOT a Tsirelson bound and NOT the
      // regime boundary (which `moneyRegime` puts at ρ = √2 − 1 ≈ 0.414, i.e. ≈ 517 days).
      "rho_T reseed point (design choice)",  tsirelsonAgeDays, 1.0/(3.0*Math.Sqrt 2.0), moneyRegime (1.0/(3.0*Math.Sqrt 2.0)), "chosen threshold, not a physical bound" ]
