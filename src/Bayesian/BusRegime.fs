namespace Zeta.Bayesian

/// **`BusRegime` — the light cone armed on the F# side (shadow*, 2026-07-03).**
///
/// The S(delay) law (TS: `chsh-delay.ts`; docs: the light-cone note): a correlation readout
/// above the honest ceiling (2√2) is only EVIDENCE of one-process-wearing-two-faces when it was
/// measured OUTSIDE the light cone — when no observed bus crossing could beat the decision
/// deadline τ. Inside the cone super-quantum correlation is trivially fakeable (Toner–Bacon
/// 2003: one bit suffices); an unmeasured bus never upgrades a readout to evidence.
///
/// This is the F# twin of `bus-meter.ts` (same semantics, same conservative direction: the
/// MINIMUM observed crossing rules — evidence must survive the fastest thing the wire ever
/// did), so `AntiSybil` society pricing can carry regime-aware verdicts, not just discounts.
/// Pure fold over integer-ms samples; DST-clean, no ambient clock (§13).
///
/// **Caveat (b) fix — asymmetric-path budget `δMaxMs` (Option 3, 2026-08-02).**
/// `min(RTT)/2` is unsound for asymmetric planetary orbits (Earth→Mars ≠ Mars→Earth by
/// orbital phase). The conservative fix widens the cone by a deployment-supplied asymmetry
/// budget `δMaxMs`: `OutOfCone` is only declared when `min(RTT)/2 > deadlineMs + δMaxMs`.
/// At `δMaxMs = 0` the behavior is identical to the old code (terrestrial-safe default).
/// For a planetary deployment, supply the worst-case one-way asymmetry for the link
/// (e.g., ~190 ms for Earth–Mars at opposition). Conservative direction: suppresses some
/// true `OutOfCone` evidence rather than manufacturing false convictions.
[<RequireQualifiedAccess>]
module BusRegime =

    /// Which side of the light cone a readout was measured on.
    /// `Unmeasured` is the honest default: it never upgrades to evidence.
    type Regime =
        | InCone
        | OutOfCone
        | Unmeasured

    /// Bounded window of round-trip samples (ms). Oldest falls out past the cap —
    /// mirrors `bus-meter.ts` SAMPLE_CAP so stale fast crossings age out.
    [<Literal>]
    let SampleCap = 16

    type Meter = { RttSamplesMs: int list }

    let empty : Meter = { RttSamplesMs = [] }

    /// Fold one RTT sample in (bounded window).
    let foldSample (meter: Meter) (rttMs: int) : Meter =
        let next = meter.RttSamplesMs @ [ max 0 rttMs ]
        let trimmed =
            if next.Length > SampleCap then next |> List.skip (next.Length - SampleCap)
            else next
        { RttSamplesMs = trimmed }

    /// Fastest observed one-way crossing (ms) — min(RTT)/2 under the stated symmetric-path
    /// assumption. None when unmeasured. Minimum, not mean: conservative direction.
    ///
    /// **Note:** This raw estimate is used internally. For regime decisions on asymmetric
    /// links, use `regimeOf` with a non-zero `deltaMaxMs` (the caveat (b) budget).
    let bestOneWayMs (meter: Meter) : int option =
        match meter.RttSamplesMs with
        | [] -> None
        | xs -> Some(List.min xs / 2)

    /// The regime verdict against the decision deadline τ (ms), with an asymmetry budget
    /// `deltaMaxMs` (default 0 — terrestrial-safe, backward-compatible).
    ///
    /// **Caveat (b) fix (Option 3 — widen-cone-by-δ_max):**
    /// `OutOfCone` is only declared when `bestOneWayMs > deadlineMs + deltaMaxMs`.
    /// This accounts for the possibility that the return path was faster than the outbound
    /// by up to `deltaMaxMs` ms (worst-case one-way asymmetry for the deployment context).
    /// Conservative direction: at `deltaMaxMs = 0` the behavior is identical to the old code.
    ///
    /// **Terrestrial default:** `deltaMaxMs = 0` — symmetric-path assumption holds, no change.
    /// **Earth–Mars (opposition):** `deltaMaxMs ≈ 190` (distance Mars travels in ~22-min RTT).
    let regimeOf (meter: Meter) (deadlineMs: int) (deltaMaxMs: int) : Regime =
        match bestOneWayMs meter with
        | None -> Unmeasured
        | Some best ->
            // Widen the cone by deltaMaxMs: require best > deadline + deltaMaxMs to convict OutOfCone.
            // At deltaMaxMs = 0 this is identical to the old `best <= deadlineMs → InCone`.
            if best <= deadlineMs + (max 0 deltaMaxMs) then InCone else OutOfCone

    /// Convenience overload: `regimeOf` with `deltaMaxMs = 0` (terrestrial default, backward-compat).
    /// Use this at all existing call sites — it preserves the old signature and semantics.
    let regimeOfTerrestrial (meter: Meter) (deadlineMs: int) : Regime =
        regimeOf meter deadlineMs 0

    /// The honest ceiling in correlation terms: |ρ| above which the correlation exceeds what
    /// two intact selves honestly sharing state can produce — the AntiSybil reading's threshold.
    /// Chosen as the Tsirelson fraction of the CHSH range: (2√2 − 2) / 2 ≈ 0.414, matching the
    /// normalized coordination bandwidth (|S|−2)/2 at S = 2√2 (`AntiSybil.chshS` lineage).
    [<Literal>]
    let HonestCeilingRho = 0.41421356237309515

    /// A regime-aware pricing verdict: the discount `AntiSybil` already applies, plus what the
    /// correlation MEANS given where it was measured. Dual-use discipline (detection ≠ verdict):
    /// `Evidential` names the FACT that the correlation exceeds the honest ceiling outside the
    /// cone — the caller's oracle attaches reunion vs sybil.
    type Verdict =
        { /// max |ρ| against the society, as AntiSybil computed it
          Correlation: float
          Regime: Regime
          /// true ⟺ correlation > honest ceiling AND regime = OutOfCone:
          /// more agreement than the wire can explain — one process wearing two faces.
          Evidential: bool
          /// true ⟺ correlation > honest ceiling AND regime = InCone:
          /// the same reading is fakeable in-cone (Toner–Bacon), so it carries no
          /// evidential weight — coordination, honestly bought with a fast bus.
          FakeableInCone: bool }

    /// Judge a correlation given the metered regime.
    let judge (correlation: float) (regime: Regime) : Verdict =
        let above = abs correlation > HonestCeilingRho
        { Correlation = correlation
          Regime = regime
          Evidential = above && regime = OutOfCone
          FakeableInCone = above && regime = InCone }
