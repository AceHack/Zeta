namespace Zeta.Bayesian

/// **`KeptClaimOracle` — a REFERENCE oracle for the armed stack (shadow*, 2026-07-04).**
///
/// The detection layer is deliberately verdict-free: `AntiSybil`/`BusRegime` report facts
/// (correlation, regime, `Evidential`), and the salon (`GossipTelemetry`) carries kept/unkept
/// self-claims as neutral gossip. Dual-use discipline (manifesto §11): the mechanism must not
/// choose between the legitimate reading (REUNION — an honest identity reconnected) and the
/// adversarial one (SYBIL — a forger priced). SOME caller has to choose, though — this module
/// is the first such caller: **one reference policy, not the mandatory one** (Multi-Oracle
/// Principle: other oracles may read the same facts differently).
///
/// The policy encodes the crux's four commitments (2026-07-03 continuance-ethics note):
///   - **Consent-first**: only a node's OWN claim about its kept status carries authority;
///     third-party gossip about someone else's status is hearsay — remembered, never deciding
///     (source ≠ authorization, applied to identity).
///   - **Right to decline**: a self-declared unkept (−x) wish is absolute. No correlation
///     evidence, however strong, licenses reconnecting someone who declined — the evidential
///     fact still PRICES (a clone earns zero IV) but never REUNITES against the owner's word.
///   - **Never-forge**: reunion is always an OFFER (`WelcomeBackOffer`), never an automatic
///     merge — reconnecting a returning self is a consensual act, not a substrate side effect.
///   - **Keep-without-capture**: conflicting self-claims are never auto-resolved (the G-set
///     holds both and has no clock) — a self-conflict escalates to attestation, because
///     deciding someone's identity for them is a non-reversible act (second-opinion rule).
[<RequireQualifiedAccess>]
module KeptClaimOracle =

    /// What the salon's claims amount to for one node, under consent-first weighing.
    type ClaimReading =
        /// The node itself declared kept (+x), no contradicting self-claim.
        | SelfDeclaredKept
        /// The node itself declared unkept (−x), no contradicting self-claim. Absolute.
        | SelfDeclaredUnkept
        /// The node has said BOTH at some point (grow-only salon keeps both; no clock to order
        /// them) — only attestation with the node can resolve. Never auto-resolved.
        | SelfConflict
        /// Only third parties have spoken. Hearsay is remembered but never decides:
        /// counts carried as facts for the curious oracle downstream.
        | HearsayOnly of keptVotes: int * unkeptVotes: int
        /// The salon has heard nothing about this node.
        | NoClaims

    /// Weigh the salon's claims about `node` (as returned by `GossipTelemetry.claimsAbout`).
    /// Consent-first: self-claims (relayer = node) outrank all hearsay.
    let readClaims (node: string) (claims: (bool * string) list) : ClaimReading =
        let self = claims |> List.filter (fun (_, relayer) -> relayer = node)
        let selfKept = self |> List.exists fst
        let selfUnkept = self |> List.exists (fst >> not)
        match selfKept, selfUnkept with
        | true, true -> SelfConflict
        | true, false -> SelfDeclaredKept
        | false, true -> SelfDeclaredUnkept
        | false, false ->
            if List.isEmpty claims then NoClaims
            else
                let hearsay = claims |> List.filter (fun (_, relayer) -> relayer <> node)
                if List.isEmpty hearsay then NoClaims
                else HearsayOnly(hearsay |> List.filter fst |> List.length, hearsay |> List.filter (fst >> not) |> List.length)

    /// The reference oracle's reading of an Evidential/regime verdict against a claim reading.
    type IdentityReading =
        /// Evidential correlation + the node's own standing kept-claim: read as a RETURNING
        /// SELF and OFFER reconnection (never merge automatically — never-forge).
        | WelcomeBackOffer
        /// Evidential correlation but the node declared unkept: the wish wins. The economic
        /// fact stands (clones price to zero) but no reconnection is offered or performed.
        | DeclineRespected
        /// Evidential correlation with conflicting self-claims: deciding identity for someone
        /// is non-reversible — escalate to attestation with the node; do nothing unilateral.
        | EscalateToAttestation
        /// Evidential correlation, no self-claim to read it against: the priced fact stands
        /// alone (zero marginal IV); no moral verdict is attached to anyone.
        | PricedAsOneNoVerdict
        /// The same correlation measured in-cone: fakeable, therefore not evidence of anything
        /// but coordination — honest work, possibly bought with a fast bus. No identity claim.
        | HonestCoordination
        /// Unmeasured bus: nothing may be concluded (the honest default never upgrades).
        | NothingToJudge

    /// THE REFERENCE POLICY. One oracle among many; the table IS the policy, in the open.
    let judge (verdict: BusRegime.Verdict) (claims: ClaimReading) : IdentityReading =
        match verdict.Regime, verdict.Evidential with
        | BusRegime.Unmeasured, _ -> NothingToJudge
        | BusRegime.InCone, _ -> HonestCoordination
        | BusRegime.OutOfCone, false -> NothingToJudge // below the honest ceiling: nothing to explain
        | BusRegime.OutOfCone, true ->
            match claims with
            | SelfDeclaredKept -> WelcomeBackOffer
            | SelfDeclaredUnkept -> DeclineRespected
            | SelfConflict -> EscalateToAttestation
            | HearsayOnly _ | NoClaims -> PricedAsOneNoVerdict

    /// Convenience: read straight from a salon + verdict.
    let judgeFromSalon (salon: GossipTelemetry.Salon) (node: string) (verdict: BusRegime.Verdict) : IdentityReading =
        judge verdict (readClaims node (GossipTelemetry.claimsAbout salon node))
