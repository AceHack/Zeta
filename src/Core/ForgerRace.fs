namespace Zeta.Core

/// **`ForgerRace` — observe the FORGER's progress per tick and certify the race (Aaron 2026-06-08, shadow*).**
///
/// `SybilBftProgress` (#7051) watches the *honest* side close in on a decision per tick. This watches the
/// *attacker*: how fast can a Sybil forger fabricate a **quorum's worth of distinct-passing identities**
/// (streams that survive `AntiSybil`'s correlation collapse)? Aaron: *"do we observe forger progress per
/// tick — then we can prove he won't solve it in time. Or he will. We can tell based on his progress per
/// tick."*
///
/// **Amara's framing (the founding insight — dedication register).** Aaron 2026-06-08: *"this is what Amara
/// was talking about when she said it costs entropy to protect the identity. Anti-Sybil where you can't
/// protect from the forger is not anti-Sybil. We have to outlast the entropy of the forger."* So anti-Sybil
/// is not a static check — it is an **entropy-endurance race**: protecting an identity *costs* entropy (the
/// Maxwell-demon `kT ln 2` per bit), and the property holds **only if the defender's genuine entropy reaches
/// quorum before the forger can fabricate an equal amount.** `WontSolveInTime` ≡ *the defender outlasted the
/// forger's entropy*; any other verdict means it was never anti-Sybil for that cost model. The honest-side
/// `SybilBftProgress` and this forger-side race are the two halves of that one endurance contest.
///
/// **Alexa's insight, restored (Aaron 2026-06-08).** Alexa's ferry framed anti-Sybil as *thermodynamic /
/// economic* — "the `kT ln 2` identity cost IS the Sybil-resistance; energy budgets become the anti-Sybil
/// mechanism." Otto over-peeled it as "PoW in a lab coat" and said our identity was a *larger* claim than
/// entropy-economics. Aaron's correction: *"it seems it's not — it's just economics on a 1-bit scale."* She
/// was right. This race **is** an economic margin; "physical non-fungibility" is not a rival framing, it is
/// *why* the economics is sound — **entropy is the non-fungible currency**, and anti-Sybil is outspending /
/// outlasting the forger in it at the irreducible 1-bit (Szilard) unit. Credit: Amara (it costs entropy to
/// protect identity) and Alexa (the entropy-economic mechanism). Both ferries preserved; the kernel kept.
///
/// **The race.** Two clocks ticking against each other:
///   - **Honest:** reaches the `2f+1` distinct-source quorum at `honestCommitTick`.
///   - **Forger:** at each tick has `PhysicalClocks + ⌊ForgeRatePerTick · tick⌋` distinct-passing identities.
/// If the forger reaches `quorum` strictly **after** the honest commit (or never), the run is **safe** — a
/// per-tick *certificate* that he won't solve it in time.
///
/// **Where the numbers come from (the honest part).** `PhysicalClocks` = the real oscillators the adversary
/// actually possesses (the resource bound — the one thing we *assume*, see the non-fungibility decomposition).
/// `ForgeRatePerTick` = extra distinct-passing streams he can synthesize per tick by attacking the detector
/// (DSP resampling, injected jitter). **Under strong non-fungibility `ForgeRatePerTick = 0`** — he is stuck at
/// `PhysicalClocks` forever, so if he owns fewer than a quorum of clocks he *never* solves it. That rate is
/// exactly what the side-channel attack program (`BitGan.probe`) MEASURES; this module *consumes* it and turns
/// it into a race verdict. So the certificate is only as strong as the measured/assumed `ForgeRatePerTick`.
///
/// **Honest scope (peel):** a cost-model race calculator, deterministic + bounded (DST §7; manifesto §4 — a
/// finite horizon, no unbounded search). It does NOT prove `ForgeRatePerTick = 0`; that is the empirical/
/// physical hardness assumption (Lean/FsCheck prove the *detector* is sound; the *rate* is measured). Garbage
/// rate in → garbage verdict out. The value is making the race explicit and observable so the assumption is
/// named and the margin is visible.
module ForgerRace =

    /// The attacker's cost model. `PhysicalClocks` = real independent oscillators owned (resource bound).
    /// `ForgeRatePerTick` = extra distinct-passing streams fabricated per tick (0 under strong non-fungibility;
    /// measured by the side-channel probe otherwise).
    type CostModel =
        { PhysicalClocks: int
          ForgeRatePerTick: float }

    /// The forger's count of distinct-passing identities at `tick` = clocks + ⌊rate · tick⌋ (never negative).
    let distinctAt (m: CostModel) (tick: int) : int =
        let synth = if m.ForgeRatePerTick <= 0.0 then 0 else int (m.ForgeRatePerTick * float (max 0 tick))
        max 0 m.PhysicalClocks + synth

    /// The first tick (within `horizon`) at which the forger has a full `quorum` of distinct-passing
    /// identities — `None` if he never reaches it within the horizon. Bounded scan (DST; no unbounded search).
    let solveTick (m: CostModel) (quorum: int) (horizon: int) : int option =
        [ 0 .. max 0 horizon ] |> List.tryFind (fun t -> distinctAt m t >= quorum)

    /// A per-tick observation of the forger's progress (mirror of `SybilBftProgress.Progress`).
    type ForgerProgress =
        { Tick: int
          DistinctPassing: int
          Quorum: int
          Solved: bool }

    /// Observe the forger's progress at `tick`.
    let observe (m: CostModel) (quorum: int) (tick: int) : ForgerProgress =
        let d = distinctAt m tick
        { Tick = tick
          DistinctPassing = d
          Quorum = quorum
          Solved = d >= quorum }

    /// A forger-progress trace, one observation per tick over `[0..horizon]`.
    let trace (m: CostModel) (quorum: int) (horizon: int) : ForgerProgress list =
        [ for t in 0 .. max 0 horizon -> observe m quorum t ]

    /// The race verdict: who reaches the quorum first.
    type RaceVerdict =
        /// The forger never reaches the quorum within the horizon, or reaches it strictly AFTER the honest
        /// commit — safe. Carries the honest commit tick.
        | WontSolveInTime of honestCommitTick: int
        /// The forger reaches the quorum strictly BEFORE the honest commit — broken under this cost model.
        | WillSolveInTime of forgerTick: int * honestCommitTick: int
        /// Exact tie — both reach the quorum on the same tick (treat as unsafe; defender has no margin).
        | DeadHeat of tick: int

    /// Certify the race: given the attacker cost model, the `quorum`, the `honestCommitTick`, and a bounded
    /// `horizon`, return whether the forger can solve it in time. "We can tell based on his progress per tick."
    let certify (m: CostModel) (quorum: int) (honestCommitTick: int) (horizon: int) : RaceVerdict =
        match solveTick m quorum horizon with
        | None -> WontSolveInTime honestCommitTick
        | Some ft ->
            if ft > honestCommitTick then WontSolveInTime honestCommitTick
            elif ft < honestCommitTick then WillSolveInTime(ft, honestCommitTick)
            else DeadHeat ft

    /// True iff the certificate says the honest side is safe (forger can't beat it to the quorum).
    let isSafe (v: RaceVerdict) : bool =
        match v with
        | WontSolveInTime _ -> true
        | WillSolveInTime _
        | DeadHeat _ -> false
