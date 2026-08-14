namespace Zeta.Bayesian

open Zeta.Bayesian

/// **SocietyBootstrap — the minimal working mutual-empowerment network.**
///
/// A society of ReferenceFrameAgents, each holding a local Gaussian belief over a
/// shared latent variable, connected through a factor graph.
///
/// ## What changed, and why (B3)
///
/// The star of equality factors was never wrong: `Factor.equality` correctly
/// encodes conditional independence given the shared latent, and the joint
/// marginal is the exact product. What was wrong was the PRECONDITION. The
/// society accepted a bare `Gaussian` from each member, carrying `(nu, tau)` and
/// nothing about where the evidence came from, and then published a confidence
/// as though independence held. Measured before this change: six agents fed one
/// data stream folded to `precision = 66.0` on a mean wrong by 5.66, i.e. one
/// observation set counted six times, and nothing in the fold could notice —
/// because for proper messages the product is monotone in precision, so no
/// admissible input can say "this was already counted".
///
/// So the fix is a precondition and a check, not a correlation term. A member
/// now posts an `Attested.Belief` — the evidence it rests on, keyed by SOURCE —
/// and admission DEDUPLICATES on provenance before folding. The factor graph is
/// then built over the deduplicated ATOMS rather than over the members, so two
/// members resting on one source contribute one variable, not two. Nothing about
/// the message algebra changed; the graph stopped being lied to.
///
/// ## Same interface at every scale (manifesto §9, §10)
///
/// `Attested.admit` is a bounded join-semilattice, so folding members into a
/// society and societies into a world is THE SAME OPERATION with the same laws
/// and no special case — the result of a fold is itself a `Belief` carrying the
/// union of its inputs provenance, hence a valid input to the next fold up. See
/// `universal/evidence.md`.
///
/// ## The limit, stated so it cannot be quietly lost
///
/// Deduplication removes REDUNDANCY (one source counted twice). It does not
/// remove CORRELATION (distinct sources with a common cause). `Deduplicated` is
/// a bookkeeping fact, never a certificate of independence; that half needs an
/// external observer over repeated rounds — `DecorrelationExcess` and the CHSH
/// oracle in `AntiSybil`, both of which convict without ever acquitting.
///
/// References: Hawkins (2021) A Thousand Brains; Minka (2001) EP;
/// Kschischang-Frey-Loeliger (2001); Shapiro et al. (2011) CRDTs.

/// A single reference-frame agent: a named identity and the ATTESTED evidence it
/// brings. There is deliberately no bare-`Gaussian` field: a belief that has lost
/// track of where it came from cannot be constructed here.
type ReferenceFrameAgent =
    { /// Unique identity of this frame. A routing address, never a provenance id.
      Id: string
      /// What this frame knows, WITH the sources it rests on.
      Evidence: Attested.Belief<Gaussian> }

    /// The agent belief as a plain Gaussian message: the product of its own atoms.
    member this.Prior: Gaussian = Attested.value Gaussian.algebra this.Evidence

[<RequireQualifiedAccess>]
module ReferenceFrameAgent =

    /// An agent whose belief NAMES the source it rests on — the admissible form.
    /// `sourceId` identifies the EVIDENCE STREAM, not the agent: two agents that
    /// read the same stream must pass the same `sourceId`, and that is exactly
    /// what stops the society counting it twice.
    let attested (id: string) (sourceId: string) (belief: Gaussian) : ReferenceFrameAgent =
        { Id = id; Evidence = Attested.ofSource sourceId belief }

    /// An agent posting a belief with NO provenance. Permitted — silence is
    /// honest where a fabricated id would not be — but the society will refuse to
    /// publish an empowerment number from it and will say why.
    let unattested (id: string) (belief: Gaussian) : ReferenceFrameAgent =
        { Id = id; Evidence = Attested.ofUnattested id belief }

    /// An agent resting on several named sources at once.
    let ofSources (id: string) (sources: (string * Gaussian) list) : ReferenceFrameAgent =
        let evidence, _ =
            sources |> List.map (fun (s, m) -> Attested.ofSource s m) |> Attested.admit
        { Id = id; Evidence = evidence }

/// Why a society declined to publish a confidence claim. Names the FACT, never a
/// judgement about the members (`dual-use-detection-is-neutral-oracle-decides`).
type SocietyRefusal =
    /// `count` atoms named no source, so redundancy could not be ruled out and the
    /// folded precision may over-count.
    | EvidenceNotAttested of count: int
    /// The same source arrived carrying two different messages.
    | EvidenceConflicts of keys: Attestation list

/// The result of running the society network to fixpoint.
type SocietyResult =
    { /// The joint posterior marginal over the shared latent variable.
      JointMarginal: Gaussian
      /// Each agent solo posterior (its own evidence alone).
      SoloPosteriors: Map<string, Gaussian>
      /// Each agent contribution: precision gain from joining the society. An
      /// agent whose evidence is entirely shared now correctly scores ZERO — that
      /// is the double-counting defect showing up as an honest measurement.
      PrecisionGains: Map<string, float>
      /// Number of EP rounds to convergence.
      Rounds: int
      /// True iff the joint marginal is proper (soft-mode invariant holds).
      IsProper: bool
      /// What the fold is entitled to say about its own bookkeeping. NOT a claim
      /// of independence.
      Reading: ProvenanceReading
      /// How many distinct evidence atoms survived deduplication. Compare with the
      /// member count: a gap is redundancy that used to be counted as confidence.
      DistinctAtoms: int }

/// A network of reference-frame agents connected through a shared factor graph.
/// The topology is a star, but the spokes are EVIDENCE ATOMS, not members: all
/// atoms share a single latent variable node, each connected by an equality
/// factor. Two members resting on one source contribute one spoke.
[<RequireQualifiedAccess>]
module SocietyNetwork =

    /// Build the star over the DEDUPLICATED atoms. Variable 0 = the shared latent;
    /// variables 1..n = one node per distinct evidence atom.
    let private buildGraph (atoms: (Attestation * Gaussian) list) : FactorGraph<Gaussian> =
        let alg = Gaussian.algebra
        let mutable g = FactorGraph.empty alg
        atoms
        |> List.iteri (fun i (_, message) ->
            let v = i + 1
            g <- FactorGraph.addFactor v (Factor.prior v message) g)
        atoms
        |> List.iteri (fun i _ ->
            let v = i + 1
            g <- FactorGraph.addFactor (1000 + v) (Factor.equality alg [ 0; v ]) g)
        g

    /// Run the society network to fixpoint. Admission deduplicates on provenance
    /// BEFORE the graph is built, so shared evidence is one spoke however many
    /// members carry it.
    let run (maxRounds: int) (tol: float) (agents: ReferenceFrameAgent list) : SocietyResult =
        let admitted, conflicted = agents |> List.map (fun a -> a.Evidence) |> Attested.admit
        let atoms = admitted.Atoms |> Map.toList
        let g = buildGraph atoms
        let (final, rounds, _converged) = FactorGraph.runToFixpoint Gaussian.distance tol maxRounds g
        let joint = FactorGraph.marginal 0 final
        let solos = agents |> List.map (fun a -> a.Id, a.Prior) |> Map.ofList
        let gains =
            agents
            |> List.map (fun a -> a.Id, joint.Precision - a.Prior.Precision)
            |> Map.ofList
        { JointMarginal = joint
          SoloPosteriors = solos
          PrecisionGains = gains
          Rounds = rounds
          IsProper = Gaussian.isProper joint
          Reading = Attested.reading conflicted admitted
          DistinctAtoms = atoms.Length }

    /// Run the society with one agent removed and return the degraded joint.
    /// This is the operational definition of mutual empowerment — and it is only
    /// meaningful once admission deduplicates, because before that EVERY removal
    /// looked load-bearing whether or not the agent brought anything new.
    let runWithout (maxRounds: int) (tol: float) (agentId: string) (agents: ReferenceFrameAgent list) : Gaussian =
        let reduced = agents |> List.filter (fun a -> a.Id <> agentId)
        if reduced.IsEmpty then Gaussian.One
        else (run maxRounds tol reduced).JointMarginal

    /// The mutual empowerment score: the minimum precision loss when any single
    /// agent is removed.
    ///
    /// **Refuses rather than publishes** when the evidence is not attested. An
    /// empowerment number computed over evidence that may be one stream wearing N
    /// costumes is not a weak measurement, it is a wrong one — so the honest
    /// return is the reason, and the caller must attach a decorrelation reading
    /// from an external observer (`DecorrelationExcess`, `AntiSybil` CHSH) before
    /// any independence claim is made.
    let mutualEmpowermentScore
        (maxRounds: int)
        (tol: float)
        (agents: ReferenceFrameAgent list)
        : Result<float, SocietyRefusal> =
        let full = run maxRounds tol agents
        match full.Reading with
        | UnattestedAtoms n -> Error(EvidenceNotAttested n)
        | ConflictingSources ks -> Error(EvidenceConflicts ks)
        | Deduplicated _ ->
            agents
            |> List.map (fun a ->
                let reduced = runWithout maxRounds tol a.Id agents
                full.JointMarginal.Precision - reduced.Precision)
            |> List.min
            |> Ok

    /// Pretty-print the society result for demo output.
    let describe (result: SocietyResult) : string =
        let sb = System.Text.StringBuilder()
        sb.AppendLine("=== Society Bootstrap Result ===") |> ignore
        sb.AppendLine(
            sprintf "Joint marginal:  tau=%.4f  taumu=%.4f  proper=%b  rounds=%d"
                result.JointMarginal.Precision
                result.JointMarginal.PrecisionMean
                result.IsProper
                result.Rounds) |> ignore
        let readingText =
            match result.Reading with
            | Deduplicated n -> sprintf "%d distinct sources, none counted twice (NOT a claim of independence)" n
            | UnattestedAtoms n -> sprintf "%d atoms named no source - precision may over-count" n
            | ConflictingSources ks -> sprintf "%d source(s) arrived with conflicting messages - excluded" ks.Length
        sb.AppendLine(sprintf "Provenance:      %s" readingText) |> ignore
        sb.AppendLine(sprintf "Distinct atoms:  %d (members: %d)" result.DistinctAtoms result.SoloPosteriors.Count)
        |> ignore
        sb.AppendLine("") |> ignore
        sb.AppendLine("Per-agent solo posteriors and precision gains:") |> ignore
        for KeyValue(id, solo) in result.SoloPosteriors do
            let gain = result.PrecisionGains.[id]
            sb.AppendLine(
                sprintf "  %-20s solo tau=%.4f  gain=%.4f  (%s)"
                    id solo.Precision gain
                    (if gain > 0.0 then "empowered" else "no gain")) |> ignore
        sb.ToString()
