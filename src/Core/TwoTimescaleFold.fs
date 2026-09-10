namespace Zeta.Core

/// **`TwoTimescaleFold` — differentiation and convergence, on two layers instead of one.**
///
/// Aaron 2026-08-10: *"we can use our delay in transport layers and Reticulum to decouple over time
/// into differentiation."* Auditing that claim produced a no-go and an escape, and this module is the
/// escape built.
///
/// ## The no-go this module exists to route around
///
/// **Durable differentiation and order-independent convergence are mutually exclusive on ONE fold.**
/// A commutative, order-insensitive merge makes every partition heal path-independently — which is
/// exactly the statement that nothing non-trivial can be built, because a persistent difference *is*
/// a non-split extension. Semisimplicity buys reconcilability by forbidding structure. So on a single
/// commutative fold, delay is free precisely because it is **inert**: replicas fed disjoint evidence
/// reach *identical* states on merge. Transient difference, permanent identity. That is latency, not
/// speciation.
///
/// Two further results shape the construction, both from the same review:
///
/// - **Delay is permissive, not generative.** Two decoupled systems with identical inputs stay
///   identical forever. Differentiation needs a *per-replica entropy source*; delay only stops the
///   merge from erasing what that source produces. Here the source is injected (`IEntropySource`),
///   never ambient — §13 noninterference.
/// - **An idempotent group is trivial** (`a + a = a ⇒ a = e`). So "delay is free" (needs
///   **idempotence**) and "divergence stays auditable and retractable" (needs **inverses**) cannot
///   live in one operator. Two structures are *forced*, not chosen.
///
/// ## The shape
///
/// ```text
///   FAST / LOCAL   state-dependent, per-replica, entropy-driven  → differentiation lives here
///         │
///         │  project — THE ONLY DOOR. Declared, metered, drops local time and local order.
///         ▼
///   SLOW / SHARED  idempotent join-semilattice over an evidence SET  → convergence lives here
/// ```
///
/// The boundary is enforced by **types**, not by a comment: `LocalState` has no path into
/// `SharedBelief` except `project`, which yields `SharedEvidence` carrying a dedup key and nothing
/// local-time-derived. `.claude/rules/local-time-never-enters-the-shared-fold.md` states this
/// invariant; here it is structural.
///
/// ## Why the shared layer is a SEMILATTICE and not `BeliefConvergence.observe`
///
/// `observe` is pointwise multiplication: commutative and associative, so a commutative **monoid** —
/// but **not idempotent**, so redelivery double-counts (pinned in `BeliefConvergence.Tests.fs`). Over
/// a store-and-forward, retransmitting transport, redelivery is ordinary. This module supplies the
/// missing property the repo's own discipline #6 prescribes: **a natural dedup key**. Belief becomes
/// a function of the applied evidence *set*, so applying the same evidence twice is a no-op and the
/// merge is a genuine join — commutative, associative, **idempotent**. Delay is then free by
/// construction rather than by assumption.
///
/// Note what is given up, honestly: the shared layer can no longer *retract*. That is the
/// idempotent-group theorem biting, and it is why `Delta` exists as a separate, invertible structure.
///
/// Anchors: Fenichel (slow manifolds / normal hyperbolicity) · Tikhonov (singular perturbation) ·
/// Little 1961 (`L = r·τ`) · Wright 1931 (`Nm`, the same dimensionless group in population genetics) ·
/// Hellerstein / Ameloot et al. (CALM — monotonicity is the exact coordination-freeness condition) ·
/// Dobzhansky 1936 / Muller 1942 (epistasis: the *non-commutative* term is what differentiates) ·
/// Shapiro et al. 2011 (CRDT join-semilattice merge) · Goguen & Meseguer 1982 (noninterference).
[<RequireQualifiedAccess>]
module TwoTimescaleFold =

    open System

    // ────────────────────────────────────────────────────────────────────────────────────────────
    //  SLOW / SHARED LAYER — a join-semilattice. Convergence lives here.
    // ────────────────────────────────────────────────────────────────────────────────────────────

    /// Evidence admitted to the shared fold. `Id` is the **dedup key** that makes the merge
    /// idempotent — it is a content/provenance identifier and MUST NOT be derived from any local
    /// clock or receive-order, or two nodes will key the same evidence differently and diverge.
    type SharedEvidence =
        { Id: string
          Likelihood: int64[] }

    /// Shared state. `Applied` is the evidence set; `Belief` is a *function of that set*, which is
    /// what makes the structure path-independent: the same set always yields the same belief,
    /// regardless of arrival order or multiplicity.
    type SharedBelief =
        { Applied: Set<string>
          Belief: int64[] }

    /// The empty shared belief over `dim` candidates: no evidence, uniform weights.
    let emptyShared (dim: int) : SharedBelief =
        { Applied = Set.empty
          Belief = Array.create dim 1L }

    /// Apply one piece of evidence. **Idempotent**: re-applying an already-applied `Id` is a no-op,
    /// so redelivery over a retransmitting transport cannot double-count.
    let apply (e: SharedEvidence) (s: SharedBelief) : SharedBelief =
        if s.Applied.Contains e.Id then
            s
        else
            { Applied = s.Applied.Add e.Id
              Belief = Array.map2 (*) e.Likelihood s.Belief }

    /// Fold a batch. Order-independent AND multiplicity-independent, unlike
    /// `BeliefConvergence.observeAll`, because `apply` dedups by key.
    let applyAll (evidence: SharedEvidence seq) (s: SharedBelief) : SharedBelief =
        Seq.fold (fun acc e -> apply e acc) s evidence

    /// **The join.** Merge two shared states. Commutative, associative, idempotent — a genuine
    /// join-semilattice, so `merge a b` exists for any two states however far they drifted, with no
    /// dependence on the delivery path. This is what makes delay free.
    ///
    /// The belief is recomputed from the *union* rather than combined from the two beliefs, because
    /// only a function-of-the-set is path-independent. `catalog` resolves ids to likelihoods; both
    /// sides must agree on it (it is content-addressed by construction).
    let merge (catalog: Map<string, int64[]>) (a: SharedBelief) (b: SharedBelief) : SharedBelief =
        let union = Set.union a.Applied b.Applied
        let dim = a.Belief.Length
        let belief = Array.create dim 1L

        for id in union do
            match catalog.TryFind id with
            | Some l ->
                for i in 0 .. dim - 1 do
                    belief.[i] <- belief.[i] * l.[i]
            | None -> () // unknown id contributes nothing; it stays in Applied so the set still merges

        { Applied = union; Belief = belief }

    // ────────────────────────────────────────────────────────────────────────────────────────────
    //  FAST / LOCAL LAYER — state-dependent. Differentiation lives here.
    // ────────────────────────────────────────────────────────────────────────────────────────────

    /// The **declared, metered** entropy channel (§13 noninterference). Differentiation is impossible
    /// without a per-replica source, and this is the only door that source may use — never an ambient
    /// clock, RNG, or thread-pool read. Injected so DST can replay it exactly.
    type IEntropySource =
        /// Next value in `[0, bound)` for this replica.
        abstract Next: bound: int -> int

    /// Per-replica fast state. `Sharpenings` counts state-dependent steps taken — the *holonomy*,
    /// i.e. the path-dependence that makes this layer able to differentiate at all.
    type LocalState =
        { ReplicaId: string
          Local: int64[]
          Sharpenings: int }

    let emptyLocal (replicaId: string) (dim: int) : LocalState =
        { ReplicaId = replicaId
          Local = Array.create dim 1L
          Sharpenings = 0 }

    /// One fast step. **State-dependent by design** — it reads the belief it transforms, which is
    /// exactly what `BeliefConvergence`'s own docstring names as the boundary of order-independence.
    /// That non-commutativity is not a defect here; per Dobzhansky–Muller it is *the differentiating
    /// agent*. Delay does not create the divergence, this does — delay only keeps the shared merge
    /// from erasing it.
    ///
    /// The step reads **the whole state** (total mass), not merely the slot it writes. That is
    /// deliberate, and it is a correction: the first version squared the selected slot and failed its
    /// own anti-vacuity test, for two independent reasons worth keeping.
    ///
    ///   * **Squaring has `1` as a fixed point.** `emptyLocal` is uniform ones, so `1*1 = 1` moved
    ///     nothing — a differentiating agent that could not differentiate from the natural prior.
    ///   * **Any per-coordinate operation commutes anyway.** Steps writing disjoint slots never see
    ///     each other, so ordering them differently changes nothing. Non-commutativity *requires*
    ///     coupling between coordinates; a slot-local rule cannot have it however nonlinear it is.
    ///
    /// Adding total mass supplies both: it escapes the uniform fixed point, and it couples every
    /// coordinate, so two steps applied in opposite orders genuinely diverge. That coupling **is** the
    /// Dobzhansky–Muller epistasis term — the interaction is what differentiates, not the isolation.
    let localStep (entropy: IEntropySource) (st: LocalState) : LocalState =
        let dim = st.Local.Length
        let target = entropy.Next dim
        let totalMass = Array.sum st.Local
        let next = Array.copy st.Local
        next.[target] <- next.[target] + totalMass

        { st with
            Local = next
            Sharpenings = st.Sharpenings + 1 }

    // ────────────────────────────────────────────────────────────────────────────────────────────
    //  THE DOOR — the only crossing, and it is metered.
    // ────────────────────────────────────────────────────────────────────────────────────────────

    /// A metered record of one crossing, for the ledger. Every projection posts one; there is no
    /// unmetered path from local to shared.
    type Crossing =
        { ReplicaId: string
          EvidenceId: string
          SharpeningsAtCrossing: int }

    /// **`project` is the only route from the fast layer to the slow one.**
    ///
    /// It drops everything local: no wall-clock, no receive-order, no replica-local sequence enters
    /// the produced `SharedEvidence`. The dedup key is derived from the replica identity and the
    /// *logical* step count — reproducible by any node, never from a local clock — so two nodes
    /// receiving this evidence key it identically and the shared merge stays idempotent.
    ///
    /// **PRECONDITION — `ReplicaId` must be globally unique, and violating it FAILS SILENTLY.**
    /// Two replicas sharing an id project the same key at the same logical step, so the shared layer
    /// dedups genuinely-different evidence as one and discards the later piece with no error. That is
    /// the cost of buying idempotence with a natural key: the key must actually be natural. Pinned by
    /// ``PRECONDITION: a dedup-key COLLISION silently merges distinct evidence`` — found when a test
    /// helper reused one id across two replicas and the schedule-free property broke.
    ///
    /// **Where a correct `ReplicaId` comes from — corrected 2026-08-10, because the first version of
    /// this note pointed at the wrong thing.** It said to draw the id from `AntiSybil`'s distinct
    /// entropy sources. That is wrong in exactly the direction that causes the silent collision above:
    /// `AntiSybil.SourceOf` maps a claimed-identity index to a component id in `0 .. DistinctCount-1`,
    /// and those components are canonicalised **per invocation, over one batch of streams**. The same
    /// physical source can be numbered differently in a different batch, so it is neither stable nor
    /// globally unique — precisely the two properties this precondition needs.
    ///
    /// The right division of labour:
    ///
    ///   * **Supply** a globally unique replica id under the caller's identity-allocation contract.
    ///     Content-addressing a stream names those bytes (subject to the hash's collision model);
    ///     it does not prove a unique controller, fresh entropy, or non-forgeability.
    ///   * **Observe** with `AntiSybil` when record similarity is useful. Its graph components are
    ///     neither stable global identifiers nor counts of independently controlled sources.
    ///     Deterministic recodings of one shared stream can occupy different components.
    let project (st: LocalState) : SharedEvidence * Crossing =
        let id = String.Format(Globalization.CultureInfo.InvariantCulture, "{0}#{1}", st.ReplicaId, st.Sharpenings)

        { Id = id; Likelihood = Array.copy st.Local },
        { ReplicaId = st.ReplicaId
          EvidenceId = id
          SharpeningsAtCrossing = st.Sharpenings }

    // ────────────────────────────────────────────────────────────────────────────────────────────
    //  THE DELTA LOG — a GROUP. Auditable and retractable, which the semilattice cannot be.
    // ────────────────────────────────────────────────────────────────────────────────────────────

    /// A signed delta over candidate weights. This is the **group** half of the forced pair: it has
    /// inverses, so divergence is auditable and retractable — the path is preserved here precisely
    /// because the shared join destroys it. `apply`/`invert` are exact (additive, not multiplicative)
    /// so retraction is lossless.
    type Delta = { Of: string; Change: int64[] }

    /// The group inverse. `applyDelta d >> applyDelta (invert d)` is the identity.
    let invert (d: Delta) : Delta =
        { d with Change = Array.map (fun (x: int64) -> -x) d.Change }

    let applyDelta (d: Delta) (v: int64[]) : int64[] = Array.map2 (+) d.Change v

    /// The homomorphism from log to state: replay a delta log in order. Because `Delta` is a group
    /// this replay is invertible; because the shared layer is a semilattice its merge is not. Keeping
    /// them as two structures is forced by `a + a = a ⇒ a = e`, not a stylistic choice.
    let replay (log: Delta list) (v: int64[]) : int64[] = List.fold (fun acc d -> applyDelta d acc) v log

    // ────────────────────────────────────────────────────────────────────────────────────────────
    //  METERING — the dimensionless groups, so claims about delay carry a number.
    // ────────────────────────────────────────────────────────────────────────────────────────────

    /// `L = r·τ` — in-flight updates a peer applied that we have not seen. Little's law; identical in
    /// form to the Damköhler number and to Wright's `Nm`. **A bare delay `τ` has dimension [T] and is
    /// not a small parameter**; this product is the honest one. Note the design consequence: as
    /// `r → 0`, any `τ` is harmless.
    let inFlight (rate: float) (delaySeconds: float) : float = rate * delaySeconds

    /// Does differentiation *persist*, or does the merge wash it out?
    ///
    /// For two replicas gossiping at rate `g = 1/τ` with local generator eigenvalue `λ_F`, the
    /// difference mode evolves as `(λ_F − 2g)`, so differentiation survives iff **`λ_F·τ > 2`**.
    /// Turing-instability shaped: local growth must outrun diffusive mixing. The sum mode obeys
    /// `ṡ = F·s` and never sees `g` at all — which is the two-layer split appearing in the algebra.
    let differentiationPersists (localGrowthRate: float) (delaySeconds: float) : bool =
        localGrowthRate * delaySeconds > 2.0
