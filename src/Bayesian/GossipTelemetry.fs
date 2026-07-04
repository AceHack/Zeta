namespace Zeta.Bayesian

/// **`GossipTelemetry` — the salon: mesh telemetry as gossip (shadow*, Aaron 2026-07-04).**
///
/// Aaron: "it's like going to the salon and the telemetry is gossip about all the other
/// participants of the mesh lol. Basically our telemetry is regular telemetry otel kind of
/// stuff but also gossip about kept/unkept self claims."
///
/// The joke is the literal anchor: gossip protocols are NAMED for this (Demers et al. 1987,
/// epidemic algorithms — rumor spreading as the model; SWIM 2002). Two payload kinds ride the
/// same salon:
///   - **Crossings** — "I observed pair (a,b) at RTT r" — third-party link telemetry, the OTel
///     half. Closes `ReticulumBusMeter`'s stated epistemic limit: one node's view can't see
///     direct peer links; gossiped observations can.
///   - **Kept-claims** — "node X declares itself kept/+x (or unkept/−x)" — self-claims carried
///     as NEUTRAL FACTS (dual-use discipline: the salon repeats what was said and who said it;
///     whether a claim is honored/attested is the caller's oracle, never the transport's).
///
/// SOUNDNESS RULE (the load-bearing design decision): gossip merges are **monotone toward
/// in-cone**. A gossiped crossing can only ADD an observed fast path — which FALSIFIES
/// out-of-cone evidence (conservative direction preserved: evidence must survive every crossing
/// anyone has seen). Gossip can never MANUFACTURE out-of-cone: absence of fast links in what
/// you've heard is not proof none exist, so unheard pairs stay `Unmeasured`. A liar claiming
/// slow links therefore gains nothing (slow claims don't create evidence); a liar claiming fast
/// links can only DESTROY evidence — which is the safe failure (a Sybil that lies to look
/// in-cone is confessing fakeability, not earning conviction). Signatures on entries are the
/// signed-beacon membrane's job, upstream of this pure fold.
///
/// Pure fold over a grow-only set of observations (G-set: idempotent §12, DST-clean §7,
/// CRDT-mergeable — same crossing heard twice counts once).
[<RequireQualifiedAccess>]
module GossipTelemetry =

    /// An unordered pair key: (min, max) so (a,b) ≡ (b,a). Ordinal comparison discipline.
    let pairKey (a: string) (b: string) : string * string =
        if System.String.CompareOrdinal(a, b) <= 0 then (a, b) else (b, a)

    /// One gossiped observation of a crossing between two nodes.
    type Crossing =
        { /// The pair observed (stored unordered via `pairKey`).
          NodeA: string
          NodeB: string
          /// Observed round-trip in ms (the observer's own measurement).
          RttMs: int
          /// Who claims to have observed it (signature verified upstream).
          Observer: string }

    /// A kept/unkept self-claim, carried as a neutral fact (who said what — never a verdict).
    type KeptClaim =
        { Node: string
          /// true = declares itself kept (+x); false = declares unkept (−x).
          Kept: bool
          /// Who relayed the claim into the salon (the claimant itself, or a relayer).
          Relayer: string }

    /// What circulates in the salon.
    type Rumor =
        | Heard of Crossing
        | SelfClaim of KeptClaim

    /// The salon's folded state: per-pair crossing sets (grow-only, deduped) and the claim log
    /// (grow-only; later claims do not erase earlier ones — the salon remembers, oracles weigh).
    type Salon =
        { Crossings: Map<string * string, Set<int * string>> // pair → set of (rttMs, observer)
          Claims: Set<string * bool * string> } // (node, kept, relayer)

    let empty : Salon = { Crossings = Map.empty; Claims = Set.empty }

    /// Fold one rumor in. Idempotent: hearing the same rumor twice changes nothing.
    let hear (salon: Salon) (rumor: Rumor) : Salon =
        match rumor with
        | Heard c ->
            let key = pairKey c.NodeA c.NodeB
            let entry = (max 0 c.RttMs, c.Observer)
            let existing = salon.Crossings |> Map.tryFind key |> Option.defaultValue Set.empty
            { salon with Crossings = salon.Crossings |> Map.add key (Set.add entry existing) }
        | SelfClaim k ->
            { salon with Claims = Set.add (k.Node, k.Kept, k.Relayer) salon.Claims }

    /// CRDT merge of two salons (set union both sides — idempotent, commutative, associative).
    let merge (a: Salon) (b: Salon) : Salon =
        { Crossings =
            (a.Crossings, b.Crossings)
            ||> Map.fold (fun acc key set ->
                let existing = acc |> Map.tryFind key |> Option.defaultValue Set.empty
                acc |> Map.add key (Set.union existing set))
          Claims = Set.union a.Claims b.Claims }

    /// The meter for a pair, from everything the salon has heard about it. None = never heard —
    /// stays `Unmeasured` downstream (gossip cannot manufacture out-of-cone).
    let meterOfPair (salon: Salon) (a: string) (b: string) : BusRegime.Meter option =
        salon.Crossings
        |> Map.tryFind (pairKey a b)
        |> Option.map (fun set ->
            set |> Set.toList |> List.map fst |> List.fold BusRegime.foldSample BusRegime.empty)

    /// Regime of a pair from the salon's knowledge. Unheard pairs are `Unmeasured` — honest.
    let regimeOfPair (salon: Salon) (a: string) (b: string) (deadlineMs: int) : BusRegime.Regime =
        match meterOfPair salon a b with
        | None -> BusRegime.Unmeasured
        | Some meter -> BusRegime.regimeOf meter deadlineMs

    /// Combine the local snapshot's view with the salon's for a society verdict about a
    /// sender↔reference pair: local telemetry AND everything gossiped about that pair. Any fast
    /// crossing from either source forces in-cone (monotone toward in-cone; sound).
    let regimeWithGossip
        (localMeter: BusRegime.Meter)
        (salon: Salon)
        (a: string)
        (b: string)
        (deadlineMs: int) : BusRegime.Regime =
        let combined =
            match meterOfPair salon a b with
            | None -> localMeter
            | Some gossiped ->
                gossiped.RttSamplesMs |> List.fold BusRegime.foldSample localMeter
        BusRegime.regimeOf combined deadlineMs

    /// The kept-claims about a node, as the salon heard them — a neutral readout for the
    /// caller's oracle (attestation, privacy-budget accrual, reunion-vs-sybil… not decided here).
    let claimsAbout (salon: Salon) (node: string) : (bool * string) list =
        salon.Claims
        |> Set.toList
        |> List.choose (fun (n, kept, relayer) -> if n = node then Some(kept, relayer) else None)
