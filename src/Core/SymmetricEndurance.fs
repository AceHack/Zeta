namespace Zeta.Core

/// **`SymmetricEndurance` — the weight-free, perspective-relative frame model of the anti-Sybil endurance
/// race (Aaron 2026-06-08, shadow*).**
///
/// The asymmetric defender-vs-forger race (`ForgerRace`) looks weight-full, but Aaron's sharpening is subtler:
/// *"defender/forger split is weight-full — not really; from either traveler's perspective it balances because
/// they are both."* The fix is **not** to delete the roles — it is that **every party holds *both* roles,
/// perspective-relative**: from A's frame A is the defender and B (and time) are forger-suspects; from B's
/// frame the reverse. Balance = perspective-symmetry: everyone both judges and is judged. There is no
/// god's-eye "the forger"; a forger is whoever collapses under the reconciled judgments of all frames.
///
/// **Time is a peer, not a substrate (Aaron 2026-06-08).** *"That's why your math is not working — time is not
/// special; time needs to attack and defend just like the other two. If time is asymmetric to the other two
/// you are unbalanced."* So the clock is a `Party` in the set, judging and judged like anyone. The
/// "2-v-1-on-the-clock" framing (agents attack a target-only clock) is the unbalanced version. `isBalanced`
/// rejects referencing time (or anyone) as an outsider — it must be *in* `Parties`.
///
/// **The mechanism.** Judgments are **perspective-relative**: `Judges` holds `(observer, observed)` pairs
/// where the observer, *from its own frame*, detects the observed forging (bad progress vs good) and casts a
/// `-1` (a Z-set retraction) on its identity. Each party accrues `+HeartbeatRate` from its own clock and loses
/// `1` per observer that judges it. Genuine party: judged by few/none → claim grows. Forger: judged by all →
/// reputation collapses (*"society kills the forger"*). Pre-society = a lone observer (one `-1`); society =
/// every peer judging.
///
/// **Why this keeps NCI (Non-Coercion Invariant).** A `-1` is cast on **observable forging evidence** (a
/// state-independent test), not by coercively overriding state — non-coercive side of the de Finetti boundary
/// (`BeliefConvergence.fs`); the per-frame judgments reconcile order-independently to one frame
/// (`Reconcile.fs`). Symmetric + evidence-based = weight-free + non-coercive.
///
/// **Honest scope (peel):** a rate/outcome model, deterministic (DST §7). Judgments are taken as given (the
/// observability the side-channel probe must establish — bad progress distinguishable from good); the module
/// does not *prove* detectability, it shows what the symmetric frame does given the judgments. Weight-freedom
/// is structural: one `netRate` rule for every party, and `isBalanced` forbids privileging anyone (incl. time).
module SymmetricEndurance =

    /// A participant — agent OR clock; no role baked in. `HeartbeatRate` = genuine self-claim growth per tick.
    type Party = { Id: int; HeartbeatRate: float }

    /// The frame. `Judges` = perspective-relative `(observer, observed)` pairs: observer casts a `-1` on
    /// observed (from observer's frame). Every party is both a potential observer and observed.
    type Frame =
        { Parties: Party list
          Judges: Set<int * int> }

    let private idSet (frame: Frame) : Set<int> =
        frame.Parties |> List.map (fun p -> p.Id) |> Set.ofList

    /// The clock as a peer `Party` (Aaron: time attacks and defends like the other two). Put it in `Parties`.
    /// `rate` is general; for an honest clock use `tickingClock` — time does NOT get identity for free.
    let clockParty (id: int) (rate: float) : Party = { Id = id; HeartbeatRate = rate }

    /// **Time does not get identity for free (Aaron 2026-06-08).** *"It has to prove its claims too — it does
    /// that by ticking; that's its heartbeat."* The clock's heartbeat **is** the tick: one tick = one unit of
    /// proof, so its genuine claim accrues at exactly `1` per tick — the same way an agent's accrues at its
    /// heartbeat rate. No free rate; the clock earns identity by ticking, just like everyone earns it by
    /// heartbeating. A clock that fakes/over-claims ticks is forging and takes the same `-1`.
    [<Literal>]
    let TickHeartbeat = 1.0

    /// An honest clock peer whose heartbeat is its ticking (proof-by-tick at `1`/tick) — no free identity.
    let tickingClock (id: int) : Party = { Id = id; HeartbeatRate = TickHeartbeat }

    /// A clock's honest claim is bounded by the ticks it actually produced — it cannot claim un-ticked time.
    /// Over-claiming (claim > genuine ticks) is the clock forging its own heartbeat.
    let clockClaimWithinTicks (genuineTicks: int) (claim: float) : bool =
        claim <= float (max 0 genuineTicks)

    /// **How many actors — 3 or 4? (Aaron 2026-06-08.)** *"There are really two tick sources; agent 1 and
    /// agent 2 don't necessarily share threads (but they could lol) — assume they don't at first."* No global
    /// clock (Lamport): each agent carries its OWN tick source, so for 2 agents the honest default is FOUR
    /// peers (agent1, agent2, clock1, clock2). One shared clock (3 peers) is the opt-in case where agents
    /// share a thread — the DoP=1 simulation. Default: `SeparateClocks`.
    type ClockSharing =
        | SeparateClocks // each agent has its own tick source — no global clock (DEFAULT, general case)
        | SharedClock // one global clock — agents share a thread. DEGENERATE case (Aaron: "LLMs can share a
        // thread in .NET green threads, but that's the degenerate case"): green threads / DoP=1 sim.

    /// Build a frame: each rate in `agentRates` is an agent peer (ids `0..n-1`), plus tick-source clock
    /// peer(s) (ids `n..`).
    ///
    /// **The clock's earned rate = how many agents it animates (Aaron 2026-06-08).** *"If it's one clock it
    /// likely gets double the ticks of the other two, because the other two are animated by the clock itself —
    /// they are what remains and the clock is what acts. If it's two clocks then it's even."* This is the
    /// remains/acts (CALM) split: the clock is **what acts** (the animator), agents are **what remains** (the
    /// animated state). So a `SharedClock` animating `n` agents earns rate `n` (double, for `n=2`); under
    /// `SeparateClocks` each clock animates its one agent ⇒ rate `1` (even). The clock's claim is still
    /// *earned* by ticking — it just does more acting, so it ticks more.
    let frameOf (sharing: ClockSharing) (agentRates: float list) : Frame =
        let agents = agentRates |> List.mapi (fun i r -> { Id = i; HeartbeatRate = r })
        let n = List.length agents
        let clocks =
            match sharing with
            | SharedClock -> [ { Id = n; HeartbeatRate = List.sum agentRates } ] // animates all agents → Σrates (double when n=2, equal rates)
            | SeparateClocks -> [ for i in 0 .. n - 1 -> tickingClock (n + i) ] // each animates 1 → even
        { Parties = agents @ clocks
          Judges = Set.empty }

    /// Total actor count (agents + clocks). 2 agents: `SeparateClocks` ⇒ 4, `SharedClock` ⇒ 3.
    let actorCount (frame: Frame) : int = List.length frame.Parties

    /// **Three tick regimes — model all and see what falls out (Aaron 2026-06-08).** *"If that one tick is
    /// constructive interference, the one-clock tick can advance both with genuinely one tick instead of two
    /// simultaneous. I'm not sure how to tell if that's the case here, but we could model all three: 1 clock
    /// 2 ticks, 1 clock 1 tick, 2 clocks 1 tick."* We cannot decide a priori which holds — so enumerate them:
    ///   - `OneClockTwoTicks` — shared clock animates each agent separately, no interference ⇒ earns rate `n`.
    ///   - `OneClockOneTick` — shared clock with **constructive interference**: one tick advances ALL agents
    ///     at once ⇒ earns rate `1` (the most efficient regime — total clock-work `1`).
    ///   - `TwoClocksOneTick` — one independent clock per agent, each earns rate `1` (the `SeparateClocks`
    ///     default; total clock-work `n`).
    /// (`ClockSharing.SharedClock` = `OneClockTwoTicks`; `SeparateClocks` = `TwoClocksOneTick`.)
    type TickRegime =
        | OneClockTwoTicks
        | OneClockOneTick
        | TwoClocksOneTick

    /// **We do NOT assume agents heartbeat at the same rate (Aaron 2026-06-08).** `agentRates` is per-agent —
    /// rates may differ. The clock's earned rate is then the **sum** of what it animates (not a count), and
    /// **constructive interference presupposes rate *alignment*** — one tick can advance all agents at once
    /// only if their heartbeats are matched (aligned waves). With unequal rates `OneClockOneTick` is not
    /// lossless: the shared clock must pace to the **fastest** agent (`max`), and slower agents are only
    /// partially carried — see `ratesAligned`.
    let ratesAligned (agentRates: float list) : bool =
        match agentRates with
        | []
        | [ _ ] -> true
        | r :: rest -> rest |> List.forall (fun x -> x = r)

    /// Build a frame under an explicit tick regime (the 3-way version of `frameOf`); honours per-agent rates.
    let frameOfRegime (regime: TickRegime) (agentRates: float list) : Frame =
        let agents = agentRates |> List.mapi (fun i r -> { Id = i; HeartbeatRate = r })
        let n = List.length agents
        let total = List.sum agentRates
        let fastest = if List.isEmpty agentRates then 0.0 else List.max agentRates
        let clocks =
            match regime with
            | OneClockTwoTicks -> [ { Id = n; HeartbeatRate = total } ] // acts for each agent at its rate → Σrates
            | OneClockOneTick -> [ { Id = n; HeartbeatRate = fastest } ] // constructive: paced to fastest; = shared rate when aligned
            | TwoClocksOneTick -> [ for i in 0 .. n - 1 -> { Id = n + i; HeartbeatRate = agentRates.[i] } ] // one clock per agent at its rate
        { Parties = agents @ clocks
          Judges = Set.empty }

    /// Total clock-work per tick (sum of clock rates) under a regime, given per-agent `agentRates` — the "what
    /// falls out" comparator. `OneClockTwoTicks` = `Σrates`; `OneClockOneTick` = `max rates` (constructive —
    /// the only sub-additive regime, and lossless ⇔ `ratesAligned`); `TwoClocksOneTick` = `Σrates`. So
    /// constructive interference is the only regime whose clock-work doesn't grow with the number of agents —
    /// but it buys that only when the agents' rates are aligned.
    let clockWork (regime: TickRegime) (agentRates: float list) : float =
        match regime with
        | OneClockTwoTicks -> List.sum agentRates
        | OneClockOneTick -> if List.isEmpty agentRates then 0.0 else List.max agentRates
        | TwoClocksOneTick -> List.sum agentRates

    // ── Phase: heartbeats are sine waves; interference depends on phase, not just frequency (Aaron 2026-06-08) ──
    //
    // "...if their heartbeats are matched (aligned waves) OR 90 degrees off ... halfway, whatever that is in
    // sin waves." Same-frequency heartbeats still interfere differently by PHASE: in-phase (0°) ticks coincide
    // (full constructive — one tick serves both); anti-phase (180°) ticks never coincide (destructive — no
    // sharing); 90° is halfway. Standard two-wave overlap is cos²(Δφ/2). So `OneClockOneTick`'s savings are
    // real only near alignment and vanish at anti-phase, where it degrades back to `OneClockTwoTicks`.

    [<Literal>]
    let InPhase = 0.0 // 0° — aligned waves, full constructive

    /// 90° in radians — the "halfway" case.
    let QuarterPhase = System.Math.PI / 2.0

    /// 180° in radians — anti-phase, destructive.
    let AntiPhase = System.Math.PI

    /// Normalized overlap of two equal-frequency heartbeats with phase difference `deltaPhi` (radians):
    /// `cos²(Δφ/2)` ∈ `[0,1]`. `1` at 0° (full constructive), `0` at 180° (destructive), `½` at 90°.
    let phaseOverlap (deltaPhi: float) : float =
        let c = cos (deltaPhi / 2.0)
        c * c

    /// Effective clock-work for two same-frequency agents under `OneClockOneTick`, as a function of phase
    /// difference: `2 - overlap`. In-phase ⇒ `1` (full constructive savings); 90° ⇒ `1.5`; anti-phase ⇒ `2`
    /// (degrades to `OneClockTwoTicks` — the tick can't be shared). This is "what falls out" of the constructive
    /// regime once you account for the sine-wave phase, not just rate alignment.
    let constructiveClockWork (deltaPhi: float) : float = 2.0 - phaseOverlap deltaPhi

    /// How many *other* parties judge `q` as forging (each casts `-1`). Self-judgment (`o = q`) never counts.
    let penaltyAgainst (frame: Frame) (q: int) : int =
        frame.Judges |> Set.filter (fun (o, p) -> p = q && o <> q) |> Set.count

    /// `p`'s net identity-claim rate per tick: `+HeartbeatRate` minus the `-1`s cast on it. The SAME rule for
    /// every party (incl. the clock) — that is the weight-free core.
    let netRate (frame: Frame) (p: Party) : float =
        p.HeartbeatRate - float (penaltyAgainst frame p.Id)

    /// `p`'s claim magnitude at `tick` (floors at 0 — a collapsed claim doesn't go negative).
    let claimAt (frame: Frame) (p: Party) (tick: int) : float =
        max 0.0 (netRate frame p * float (max 0 tick))

    /// Survives (claim grows unbounded) iff net rate is strictly positive; collapses iff `≤ 0`.
    let survives (frame: Frame) (p: Party) : bool = netRate frame p > 0.0
    let collapses (frame: Frame) (p: Party) : bool = netRate frame p <= 0.0

    /// The parties observer `o` judges as forging, from `o`'s frame (its `-1` targets). Each traveler is a
    /// defender in its own frame; these are its forger-suspects.
    let judgedBy (frame: Frame) (o: int) : Set<int> =
        frame.Judges |> Set.filter (fun (x, _) -> x = o) |> Set.map snd

    /// A and B each judge the other — "from either traveler's perspective it balances because they are both"
    /// (each is defender-in-own-frame and forger-suspect-in-the-other's). The atom of perspective-symmetry.
    let mutuallyJudge (frame: Frame) (a: int) (b: int) : bool =
        frame.Judges.Contains(a, b) && frame.Judges.Contains(b, a)

    /// **Balanced (weight-free) ⟺ every judgment is between listed peers** (`observer ≠ observed`, both in
    /// `Parties`). Referencing a party not in `Parties` — e.g. treating *time* as an external substrate the
    /// agents attack one-way — is the unbalance Aaron warns of: time (and everyone) must be a peer in the set.
    let isBalanced (frame: Frame) : bool =
        let s = idSet frame
        frame.Judges |> Set.forall (fun (o, p) -> o <> p && Set.contains o s && Set.contains p s)

    /// Weight-free under relabel: a party's fate depends only on `(HeartbeatRate, #judgments-against-it)`,
    /// never on which `Id` it wears. Verifies by swapping two parties' ids (and rewriting `Judges` to follow)
    /// and confirming each one's net rate is unchanged.
    let isWeightFreeUnderRelabel (frame: Frame) : bool =
        match frame.Parties with
        | a :: b :: _ ->
            let swapId i =
                if i = a.Id then b.Id
                elif i = b.Id then a.Id
                else i
            let swapped =
                { Parties =
                    frame.Parties
                    |> List.map (fun p -> { p with Id = swapId p.Id })
                  Judges = frame.Judges |> Set.map (fun (o, p) -> swapId o, swapId p) }
            netRate frame a = netRate swapped { a with Id = b.Id }
            && netRate frame b = netRate swapped { b with Id = a.Id }
        | _ -> true

    /// The reconciled forgers: parties whose claim collapses under the aggregate of all frames' judgments
    /// (`Reconcile.fs`-style — who *actually* falls, not who any single frame accuses). This is the only
    /// god's-eye-free notion of "forger" the model admits.
    let collapsedParties (frame: Frame) : int list =
        frame.Parties |> List.filter (collapses frame) |> List.map (fun p -> p.Id)

    // ── Behavioral layer: identity must CHANGE BEHAVIOR to mean something (Aaron 2026-06-08) ───────────────
    //
    // "Identity should change behavior for it to mean something — so identity-strength changes should affect
    // the split between attacker and defender." A party is not a fixed 50/50; its mix shifts with its identity
    // STRENGTH (its current claim). Strong identity → behaves as DEFENDER (a claim worth protecting; it
    // polices, casting -1 on observed forging). Weak/zero identity → behaves as ATTACKER (forges to establish
    // or survive). An identity that does not move this split is epiphenomenal — it means nothing. This closes
    // the loop: strength → split → judgments/forging → claims → strength.

    /// Defender fraction as a function of identity strength: `s / (s + 1)`, saturating in `[0,1)`. `strength=0`
    /// ⇒ `0` (pure attacker — nothing yet to defend); growing strength ⇒ → `1` (pure defender). Monotone
    /// increasing, so a change in identity strength always moves behavior (that is what makes identity *mean*
    /// something).
    let defenderFraction (strength: float) : float =
        let s = max 0.0 strength
        s / (s + 1.0)

    /// Attacker fraction = `1 - defenderFraction`. `strength=0` ⇒ `1` (pure attacker); high strength ⇒ → `0`.
    let attackerFraction (strength: float) : float = 1.0 - defenderFraction strength

    /// Effective defense a party exerts at `tick`: its `defenderFraction` (from its current claim strength)
    /// scaled by a base policing rate — how strongly an *established* identity casts `-1` on observed forging.
    let effectiveDefense (frame: Frame) (p: Party) (tick: int) (baseDefense: float) : float =
        baseDefense * defenderFraction (claimAt frame p tick)

    /// Effective attack a party exerts at `tick`: its `attackerFraction` scaled by a base forge rate — how
    /// hard a *weak* identity forges. Falls as the party's claim grows (it has more to protect, less to gain).
    let effectiveAttack (frame: Frame) (p: Party) (tick: int) (baseAttack: float) : float =
        baseAttack * attackerFraction (claimAt frame p tick)

    /// The "identity means something" property, made checkable: a strict increase in strength strictly
    /// increases the defender share (and decreases the attacker share) — behavior provably tracks identity.
    let identityChangesBehavior (loStrength: float) (hiStrength: float) : bool =
        hiStrength > loStrength && defenderFraction hiStrength > defenderFraction loStrength
