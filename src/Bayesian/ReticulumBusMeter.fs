namespace Zeta.Bayesian

/// **`ReticulumBusMeter` — real mesh telemetry feeds the light-cone regime (shadow*, 2026-07-04).**
///
/// Closes the loop Aaron greenlit: `AntiSybil.priceAgainstSocietyMetered` had verdicts but no
/// production meter source; `ReticulumTransport` had real per-link RTT telemetry but fed only the
/// Condorcet latency map. This bridge folds a `MeshSnapshot`'s RTTs into `BusRegime.Meter`s, so
/// the armed readout runs on the actual wire, end to end.
///
/// EPISTEMIC LIMIT, stated up front: a single node's snapshot sees only ITS OWN links. Any link
/// it observes beating the deadline soundly forces `InCone` (a signal path existed). But
/// `OutOfCone` from one node's view means "no crossing this node can SEE beats τ" — a direct
/// peer-to-peer link invisible to this node could still be fast. So local-view out-of-cone is a
/// necessary condition for evidence, not an absolute one; verdicts built here carry that scope,
/// and an empty snapshot stays honestly `Unmeasured` (never upgrades). Same conservative
/// direction as `BusRegime`/`bus-meter.ts`: minimum observed crossing rules.
[<RequireQualifiedAccess>]
module ReticulumBusMeter =

    /// Fold one link's telemetry into a meter (RTT seconds → integer ms, floor at 0).
    let foldLink (meter: BusRegime.Meter) (telemetry: ReticulumTransport.LinkTelemetry) : BusRegime.Meter =
        BusRegime.foldSample meter (int (max 0.0 telemetry.RttSeconds * 1000.0))

    /// Meter for one specific peer link, when per-pair judgment is wanted.
    let meterOfLink (telemetry: ReticulumTransport.LinkTelemetry) : BusRegime.Meter =
        foldLink BusRegime.empty telemetry

    /// Mesh-wide meter from this node's view: fold EVERY active link's RTT. The regime it yields
    /// is governed by the fastest crossing anywhere this node can see — the sound direction for
    /// society-level verdicts (one fast link anywhere falsifies out-of-cone).
    let meterOfSnapshot (snapshot: ReticulumTransport.MeshSnapshot) : BusRegime.Meter =
        snapshot.ActiveLinks
        |> Map.toList
        |> List.map snd
        |> List.fold foldLink BusRegime.empty

    /// The regime of this node's mesh view against a decision deadline (ms).
    let regimeOfSnapshot (snapshot: ReticulumTransport.MeshSnapshot) (decisionDeadlineMs: int) : BusRegime.Regime =
        BusRegime.regimeOf (meterOfSnapshot snapshot) decisionDeadlineMs

    /// End-to-end: society pricing armed by the real mesh. Same discounted IV as
    /// `AntiSybil.priceAgainstSociety`; the verdict's regime comes from live telemetry.
    /// (Verdict scope is this node's view — see the module's epistemic limit.)
    let priceAgainstSocietyOnMesh
        (prior: Gaussian)
        (newBelief: Gaussian)
        (senderHistory: Gaussian list)
        (societyHistories: AntiSybil.StreamHistory list)
        (snapshot: ReticulumTransport.MeshSnapshot)
        (decisionDeadlineMs: int) : float<InformationValue.iv> * BusRegime.Verdict =

        AntiSybil.priceAgainstSocietyMetered
            prior newBelief senderHistory societyHistories
            (meterOfSnapshot snapshot) decisionDeadlineMs
