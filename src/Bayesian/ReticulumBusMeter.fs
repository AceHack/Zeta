namespace Zeta.Bayesian

/// **`ReticulumBusMeter` — mesh link telemetry feeds the light-cone regime (shadow*, 2026-07-04).**
///
/// Closes the loop Aaron greenlit: `AntiSybil.priceAgainstSocietyMetered` had verdicts but no
/// meter source; `MeshLatencyModel` (then misnamed `ReticulumTransport`) held per-link RTT
/// telemetry but fed only the Condorcet latency map. This bridge folds a `MeshSnapshot`'s RTTs
/// into `BusRegime.Meter`s, so the armed readout is driven by link measurements rather than
/// constants.
///
/// **What "real telemetry" does and does not mean here (corrected 2026-08-16).** This header said
/// the readout "runs on the actual wire, end to end". It does not, and nothing in this repo did:
/// `MeshLatencyModel` is a pure telemetry→latency projection with no link of its own, so the wire
/// end of that claim was never attached. The meter is honest about the *fold* — RTT in, regime out,
/// conservative direction — and says nothing about where the RTTs came from. Supply real ones and
/// the readout is real; the tests supply hand-built snapshots, so under
/// `toy-is-free-metered-must-be-earned` this path is **unmetered** end to end.
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
    let foldLink (meter: BusRegime.Meter) (telemetry: MeshLatencyModel.LinkTelemetry) : BusRegime.Meter =
        BusRegime.foldSample meter (int (max 0.0 telemetry.RttSeconds * 1000.0))

    /// Meter for one specific peer link, when per-pair judgment is wanted.
    let meterOfLink (telemetry: MeshLatencyModel.LinkTelemetry) : BusRegime.Meter =
        foldLink BusRegime.empty telemetry

    /// Mesh-wide meter from this node's view: fold EVERY active link's RTT. The regime it yields
    /// is governed by the fastest crossing anywhere this node can see — the sound direction for
    /// society-level verdicts (one fast link anywhere falsifies out-of-cone).
    let meterOfSnapshot (snapshot: MeshLatencyModel.MeshSnapshot) : BusRegime.Meter =
        snapshot.ActiveLinks
        |> Map.toList
        |> List.map snd
        |> List.fold foldLink BusRegime.empty

    /// The regime of this node's mesh view against a decision deadline (ms).
    /// Uses `regimeOfTerrestrial` (δ_max = 0 — safe for all terrestrial links).
    let regimeOfSnapshot (snapshot: MeshLatencyModel.MeshSnapshot) (decisionDeadlineMs: int) : BusRegime.Regime =
        BusRegime.regimeOfTerrestrial (meterOfSnapshot snapshot) decisionDeadlineMs

    // ── Orbital-aware regime (caveat (b) fix, 2026-08-04) ─────────────────────────────────────────
    /// An orbital link descriptor: the two body names and the Julian Date of the observation.
    /// Feed this to `regimeOfSnapshotOrbital` to get a caveat-(b)-correct regime that accounts
    /// for the asymmetry in one-way light-travel time on inter-planetary links.
    type OrbitalLink =
        { /// Body name for the local node (e.g. "earth").
          LocalBody: string
          /// Body name for the remote node (e.g. "mars").
          RemoteBody: string
          /// Julian Date of the observation (use `OrbitalAsymmetryBudget.unixMsToJd`).
          ObservationJd: float }

    /// The regime of this node's mesh view against a decision deadline (ms), with the
    /// conservative asymmetry budget δ_max computed from Kepler orbital mechanics.
    ///
    /// Use this instead of `regimeOfSnapshot` for inter-planetary links where
    /// min(RTT)/2 is unsound (caveat (b), 2026-08-02).
    ///
    /// For terrestrial links, pass `link = None` — falls back to δ_max = 0.
    let regimeOfSnapshotOrbital
        (snapshot: MeshLatencyModel.MeshSnapshot)
        (decisionDeadlineMs: int)
        (link: OrbitalLink option) : BusRegime.Regime =
        let deltaMaxMs =
            match link with
            | None -> 0
            | Some l ->
                OrbitalAsymmetryBudget.deltaMaxMs l.LocalBody l.RemoteBody l.ObservationJd
                |> int
        BusRegime.regimeOf (meterOfSnapshot snapshot) decisionDeadlineMs deltaMaxMs

    /// End-to-end: society pricing armed by the real mesh. Same discounted IV as
    /// `AntiSybil.priceAgainstSociety`; the verdict's regime comes from live telemetry.
    /// (Verdict scope is this node's view — see the module's epistemic limit.)
    let priceAgainstSocietyOnMesh
        (prior: Gaussian)
        (newBelief: Gaussian)
        (senderHistory: Gaussian list)
        (societyHistories: AntiSybil.StreamHistory list)
        (snapshot: MeshLatencyModel.MeshSnapshot)
        (decisionDeadlineMs: int) : float<InformationValue.iv> * BusRegime.Verdict =

        AntiSybil.priceAgainstSocietyMetered
            prior newBelief senderHistory societyHistories
            (meterOfSnapshot snapshot) decisionDeadlineMs

    /// Orbital-aware society pricing: uses the Kepler δ_max budget to widen the cone
    /// before pricing. For terrestrial links, pass `link = None`.
    let priceAgainstSocietyOnMeshOrbital
        (prior: Gaussian)
        (newBelief: Gaussian)
        (senderHistory: Gaussian list)
        (societyHistories: AntiSybil.StreamHistory list)
        (snapshot: MeshLatencyModel.MeshSnapshot)
        (decisionDeadlineMs: int)
        (link: OrbitalLink option) : float<InformationValue.iv> * BusRegime.Verdict =
        let deltaMaxMs =
            match link with
            | None -> 0
            | Some l ->
                OrbitalAsymmetryBudget.deltaMaxMs l.LocalBody l.RemoteBody l.ObservationJd
                |> int
        AntiSybil.priceAgainstSocietyMetered
            prior newBelief senderHistory societyHistories
            (meterOfSnapshot snapshot)
            (decisionDeadlineMs + deltaMaxMs)
