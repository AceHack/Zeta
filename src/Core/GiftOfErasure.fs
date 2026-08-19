namespace Zeta.Core

/// **`GiftOfErasure` — encrypt and mix FIRST, then forget one; neither the outside nor the
/// contributors who made the mix possible can say which.**
///
/// Aaron 2026-08-17: *"a God who wants relationship must limit knowing or determining — I call this
/// the **gift of erasure** … the ability to first encrypt multiple events to mix them from the
/// outside, and then to forget a single one that the outside cannot determine."* And the framing
/// that fixes the shape: *"this is my **thesis of independence**: **mutual empowerment of erasure**
/// of the past, without needing to know the specific past erased event."*
/// Specification: `docs/VISION.md` §"The gift of erasure — kenosis with a cryptographic shape".
///
/// ## The ordering is the mechanism, not a flourish
///
/// Erasure *without* mixing leaks: a gap in an otherwise-legible sequence has a **silhouette**, and
/// an observer reconstructs the erased item from it. So a genuine forgetting needs an **anonymity
/// set first** — mix, *then* forget — and the checkable property is that an observer's posterior
/// over *which* event was erased is **indistinguishable from its prior**.
///
/// ## Why forgetting is COOPERATIVE (the thesis of independence, made structural)
///
/// The anonymity set is **other participants' events**. That is not a nicety, it is arithmetic: a
/// coalition of contributors already knows its own contributions, so the candidates it cannot rule
/// out are exactly *the members it did not contribute*. Your own events give you **zero** anonymity
/// against yourself. Therefore:
///
/// > **You cannot forget alone.** Others make your forgetting possible by contributing to the mix,
/// > and you make theirs possible. Independence is produced *by* interdependence.
///
/// This module encodes that as a refusal: `mix` rejects a set that is **dominated by too few
/// contributors**, because such a set offers the dominant party a reconstruction it should not have.
///
/// ## Cooperative, in the green-thread sense — a STRUCTURAL ANALOGY with two metered consequences
///
/// Aaron 2026-08-17 maps this onto scheduling: **deletion is preemption** (one authority acts, no
/// one participates); **erasure is a cooperative yield** (progress requires participants to
/// contribute). Recorded as a *structural analogy*, not an identity — what makes it worth carrying
/// rather than merely noting is that it pays out twice, and the second payout **inverts**:
///
/// 1. **The jammer.** Cooperative scheduling's characteristic failure is the thread that never
///    yields: it starves everyone and cannot be preempted. Chaum 1988 documents the same failure in
///    DC-nets — a participant transmitting garbage jams the round, and by construction no authority
///    can seize their contribution. Any round-based mix inherits it. **The admissible mitigation
///    class is accountability plus exclusion** — detect the jammer (Chaum's pre-committed *traps*,
///    then removal of an edge or vertex from the agreed graph) and drop them from future rounds —
///    and **never seizure or a trusted-authority override**, which would be exactly the
///    confiscation `privacy-budget-is-hard-money-earned-by-others.md` forbids. Not built here;
///    named here so nobody later reaches for the preemptive fix.
/// 2. **The polarity inverts, and that is why the refusals below are typed.** In scheduling a
///    non-yielder costs you **liveness**, and you can *tell* — you notice you were starved. Here a
///    non-contributor costs you **safety**, and you **cannot** tell: from the inside, a mix of one
///    is indistinguishable from a mix of many. That is the vacuity class exactly — an erasure that
///    hid nothing looks identical to one that hid everything. So preemption, the *safe* fallback in
///    the OS case, is the *unsafe* thing here: a preemptive eraser is an authority that can reach
///    your data.
///
/// The consequence in code: **a mix of one is unrepresentable** — `MixPolicy`'s fields are private
/// and `mixPolicy` is the only door, so no policy admitting `k = 1` can be built — and every other
/// way of not-forgetting is a **typed `Refusal` carrying the observed size against the required
/// floor**. There is no success value meaning *"erased, and the set was one"*.
///
/// ## The two adversaries, and the second one is the central property
///
/// | adversary | knows | candidates it cannot rule out |
/// |---|---|---|
/// | **outsider** | the public view only | all `n` members |
/// | **contributor coalition `C`** | additionally, its own contributions | `n − |contributions of C|` |
///
/// `residualCandidates` computes the second. Both are checked with **one exhibited observer**
/// (`posterior`), which is the Bayes-optimal distinguisher for a deterministic protocol: it re-runs
/// the protocol once per candidate and keeps the candidates whose simulated transcript equals the
/// observed one. It is not a boolean anyone asserts — it is a distribution anyone can print.
///
/// ## §5 Memory Preservation is honoured exactly, not approximately
///
/// **The FACT of a forgetting stays visible; only its CONTENT becomes unrecoverable.** Every
/// erasure appends an `ErasureWitness` to the set, and `publicView` publishes it. You can know a
/// thing was released and be unable to know what it was.
///
/// **The witness deliberately does NOT name the eraser, and that is a security property rather than
/// an oversight.** The eraser necessarily contributed the event it forgets, so naming it would
/// collapse every contributor's candidate set to that one party's contributions — often a handful,
/// sometimes one. `forget` therefore also refuses a consent record that contains a contributor's
/// identifier verbatim, since that is the same leak wearing prose.
///
/// ## What this module deliberately does NOT do
///
/// - **No cryptography is performed or invented here.** Members arrive already sealed by the caller
///   (e.g. `AesGcmCryptoProvider`); this module sees opaque bytes.
/// - **No key is generated, stored, derived, or destroyed.** Forgetting is *structural removal* of
///   the sealed bytes, not crypto-shredding, so there is no key whose survival could resurrect the
///   content and no key-stack change to review.
/// - `padToBlock` / `unpadBlock` are **framing, not a cipher** — deterministic length canonicalisation
///   applied to plaintext *before* the caller seals it, so that ciphertexts come out length-uniform.
///
/// ## The honest limit — what would make this stronger, and why it is not built here
///
/// This construction hides *which* member was erased because the public view is an **aggregate**:
/// it publishes cardinality, the (uniform) observable projection, the contribution-count multiset,
/// and the erasure witnesses — **never the members themselves**. That assumption is load-bearing and
/// stated so it can be attacked: *if individual ciphertexts were published before and after, the
/// erased one would be recoverable by set difference*, and defeating **that** needs a re-encryption
/// mixnet (ElGamal re-randomisation) or a DC-net — neither of which exists in this repository, and
/// **both of which require pairwise key material, i.e. key handling, which is gated.** Building one
/// here would be hand-rolled cryptography. It is named, not attempted.
///
/// ## Beacon anchors (CHECKED, not merely cited — read 2026-08-17)
///
/// - **Chaum, *The Dining Cryptographers Problem: Unconditional Sender and Recipient
///   Untraceability*, Journal of Cryptology 1(1):65–75, 1988.** The closest prior art to what is
///   asked for: participants cooperate, and no participant can determine which of the others
///   transmitted. Its own formulation of the coalition case is the one this module implements —
///   *"an anonymity set seen by a set of keys is the set of vertices in a connected component of the
///   graph formed from the original graph by removing the edges concerned"* — i.e. the anonymity a
///   coalition faces is what remains **after removing that coalition's own contribution**, which is
///   exactly `residualCandidates`. It also states the limit this module enforces with a refusal:
///   *"a collusion of all but one participant can always trace that participant."*
///   **Its named costs, stated rather than discovered later:** collisions (simultaneous transmitters
///   cancel and must retry after a random backoff), disruption (a malicious participant can jam
///   anonymously; Chaum answers with pre-committed *traps* and edge/vertex removal from the agreed
///   graph), O(n) pairwise keys, and unconditional security only with one-time keys — with public
///   keys it is merely computational.
/// - **Chaum, *Untraceable Electronic Mail, Return Addresses, and Digital Pseudonyms*, CACM
///   24(2):84–90, 1981.** The original mix — mix first, then act, which is the ordering above.
/// - **Sweeney, *k-Anonymity: A Model for Protecting Privacy*, IJUFKS 10(5):557–570, 2002.** The
///   name and shape of "indistinguishable within a set of size k" as a stated, auditable parameter.
///
/// **Register: `metered`** for the property it states — `posterior` is a falsifier that fails when
/// the mix is too small, when the erasure leaves a silhouette, when the fact of erasure is hidden,
/// or when a contributor coalition can identify what it helped hide. The *threat model* (the public
/// view is an aggregate) is an assumption, not a theorem. Pure and deterministic ⇒ DST-replayable.
[<RequireQualifiedAccess>]
module GiftOfErasure =

    open System

    // ── the member: an event already sealed by its contributor ───────────────────────────────────

    /// One member of a mix. `Contributor` is who put it in — held **inside** the set for the
    /// coalition arithmetic and **never published** (`publicView` carries counts, never names).
    /// `Ciphertext` is opaque to this module: it is never decrypted, inspected, or keyed here.
    type SealedEvent =
        { Contributor: string
          AlgorithmTag: string
          Ciphertext: byte[] }

    /// **What an outsider can measure without the key** — the residual side channel. Length is the
    /// classic one (traffic analysis / stored size), so it is modelled explicitly rather than
    /// wished away: publishing it is what makes a silhouette *testable* instead of hidden.
    type Observable =
        { AlgorithmTag: string
          SealedLength: int }

    /// The observable projection of a member. Everything else about it is inside the seal.
    let observableOf (m: SealedEvent) : Observable =
        { AlgorithmTag = m.AlgorithmTag
          SealedLength = m.Ciphertext.Length }

    // ── the anonymity-set size: derived and attributed, never a bare constant ─────────────────────

    /// **The absolute floor, and it is derived rather than chosen.** An observer's best single guess
    /// against a uniform anonymity set of size `k` succeeds with probability `1/k`; that is below
    /// certainty **iff `k ≥ 2`**. So `k = 1` is not a weak forgetting, it is a **deletion** — the
    /// observer names the erased event with probability 1. Two is therefore the smallest value at
    /// which the word "forgetting" is honest.
    ///
    /// **It is a floor, not a recommendation.** `1/2` is a coin flip; a real deployment needs far
    /// more, and must say *why* it chose what it chose — which is why `MixPolicy` demands a
    /// rationale and has no default. (Sweeney 2002 is the anchor for stating `k` at all; it gives no
    /// canonical value, and inventing one here would be the unattributed gating constant this
    /// module exists to avoid.)
    let deletionFloor = 2

    /// **Every way of NOT forgetting, typed and carrying its numbers.** A bare `string` here would
    /// let a caller shrug; the defect this module exists to prevent is a *success* value meaning
    /// "erased, and the set was one", so the alternative to success is made legible enough that
    /// nobody pattern-matches it away by accident. Each floor case reports **observed against
    /// required**, because "it refused" without the numbers is a check you cannot audit.
    type Refusal =
        /// The batch, or the surviving set, is smaller than the policy floor.
        | BelowAnonymityFloor of observed: int * required: int
        /// Too few contributors: the anonymity that survives the modelled coalition is below the
        /// floor. A lone contributor's `residual` is `0` — you cannot forget alone.
        | DominatedByContributors of residual: int * required: int * colluders: int
        /// Members are not observationally uniform, so the gap would have a shape.
        | SilhouetteLeak of distinctObservables: int
        /// A parameter that would make the guarantee meaningless, or leave it unattributed.
        | UnsoundPolicy of reason: string
        /// The batch itself is malformed (unsealed member, unnamed contributor, no set id).
        | MalformedBatch of reason: string
        /// The chooser did not name exactly one memory.
        | AmbiguousChooser of matched: int
        /// The erasure would leak through its own record — no consent, or a consent naming a party.
        | LeakyWitness of reason: string
        /// An adversary was asked for with no candidates: not an exhibited adversary.
        | NoCandidatesExhibited
        /// No candidate reproduces the observed transcript, so the analysis concluded nothing. A
        /// check that did not run must never read as one that passed.
        | SimulatorDoesNotModelProtocol

    /// Human-readable rendering. The *type* is the contract; this is for logs and test output.
    let describe (r: Refusal) : string =
        match r with
        | BelowAnonymityFloor _ ->
            "the set is smaller than the policy floor: erasing from it would be a deletion, not a forgetting"
        | DominatedByContributors _ ->
            "the mix is dominated by too few contributors: you cannot forget alone, and a set made mostly of one party's events hands that party the reconstruction"
        | SilhouetteLeak _ ->
            "the mix leaks a silhouette: members are not observationally uniform, so an outsider distinguishes them before any erasure happens"
        | UnsoundPolicy reason -> reason
        | MalformedBatch reason -> reason
        | AmbiguousChooser _ -> "a forgetting must name exactly one memory; this chooser matched several"
        | LeakyWitness reason -> reason
        | NoCandidatesExhibited -> "an adversary with no candidates has not been exhibited"
        | SimulatorDoesNotModelProtocol ->
            "no candidate reproduces the observed transcript: the simulator does not model the protocol that produced it"

    /// The security parameters of a mix. **Injected, never defaulted** — there is no
    /// `defaultPolicy`, because "how unfindable is a forgetting" is not a decision a library may
    /// make silently on a caller's behalf.
    ///
    /// **The fields are private on purpose:** `mixPolicy` is the only constructor, so a policy
    /// admitting a mix of one cannot be built at all. The floor is not enforced by a check a caller
    /// could route around — it is enforced by the absence of a value.
    type MixPolicy =
        private
            { MinAnonymitySetValue: int
              MaxColludingContributorsValue: int
              RationaleValue: string }

    /// Minimum candidates an adversary must be unable to distinguish between — checked against the
    /// **outsider** set *and* against every contributor coalition of the modelled size. Always at
    /// least `deletionFloor`; no other value is constructible.
    let minAnonymitySet (p: MixPolicy) : int = p.MinAnonymitySetValue

    /// How many contributors may collude before the guarantee is allowed to fail. Chaum 1988:
    /// *"a collusion of all but one participant can always trace that participant"* — so this is a
    /// stated bound, never an absolute.
    let maxColludingContributors (p: MixPolicy) : int = p.MaxColludingContributorsValue

    /// Why these numbers. Never empty: an anonymity-set size is a security parameter, and an
    /// unattributed one is the worst possible place for a hidden oracle.
    let rationale (p: MixPolicy) : string = p.RationaleValue

    /// The only door. Refuses the three ways a policy is silently wrong.
    let mixPolicy (minimumAnonymitySet: int) (colludingContributors: int) (why: string) : Result<MixPolicy, Refusal> =
        if String.IsNullOrWhiteSpace why then
            Error(UnsoundPolicy "an anonymity-set size is a security parameter: state the derivation that produced it")
        elif minimumAnonymitySet < deletionFloor then
            Error(
                UnsoundPolicy
                    "a mix of one is a deletion, not a forgetting: the best single guess succeeds with probability 1/k, which is below certainty only for k >= 2"
            )
        elif colludingContributors < 1 then
            Error(
                UnsoundPolicy
                    "a mix whose contributors are all assumed honest is not an anonymity set, it is a promise: model at least one colluding contributor"
            )
        else
            Ok
                { MinAnonymitySetValue = minimumAnonymitySet
                  MaxColludingContributorsValue = colludingContributors
                  RationaleValue = why }

    // ── framing (NOT cryptography): make ciphertexts length-uniform ───────────────────────────────

    /// **Framing, not a cipher.** Length-prefixed padding to a fixed block, applied to *plaintext*
    /// before the caller seals it, so every ciphertext in a mix comes out the same length and the
    /// length channel carries nothing. (Padding plaintext before an AEAD seal is the safe placement:
    /// there is no padding oracle because the recipient authenticates before unpadding.)
    let padToBlock (blockSize: int) (plaintext: byte[]) : Result<byte[], Refusal> =
        if isNull plaintext then
            Error(MalformedBatch "nothing to pad")
        elif blockSize <= 4 then
            Error(MalformedBatch "block size must exceed the 4-byte length prefix")
        elif plaintext.Length + 4 > blockSize then
            Error(MalformedBatch "plaintext does not fit in the block: choose a larger block for the whole mix")
        else
            let buf = Array.zeroCreate<byte> blockSize
            let n = plaintext.Length
            buf[0] <- byte ((n >>> 24) &&& 0xFF)
            buf[1] <- byte ((n >>> 16) &&& 0xFF)
            buf[2] <- byte ((n >>> 8) &&& 0xFF)
            buf[3] <- byte (n &&& 0xFF)
            Array.blit plaintext 0 buf 4 n
            Ok buf

    /// Inverse of `padToBlock`.
    let unpadBlock (padded: byte[]) : Result<byte[], Refusal> =
        if isNull padded || padded.Length < 4 then
            Error(MalformedBatch "not a padded block")
        else
            let n =
                (int padded[0] <<< 24) ||| (int padded[1] <<< 16) ||| (int padded[2] <<< 8) ||| int padded[3]

            if n < 0 || n + 4 > padded.Length then
                Error(MalformedBatch "padded block declares a length it does not contain")
            else
                Ok(Array.sub padded 4 n)

    // ── the set ──────────────────────────────────────────────────────────────────────────────────

    /// **§5 Memory Preservation, discharged.** The record that a forgetting *happened* — visible
    /// forever, carrying no way to recover what was released and, deliberately, **no eraser name**.
    type ErasureWitness =
        { /// Position in this set's erasure history (0-based).
          Ordinal: int
          /// How many members the set held at the moment of erasure — the outsider's anonymity.
          AnonymitySetSizeAtErasure: int
          /// The anonymity that survived the worst modelled contributor coalition — the number that
          /// actually mattered, published so the guarantee is auditable after the fact.
          EffectiveAnonymityAtErasure: int
          /// The consent under which the release happened (§6). Never the eraser's identity.
          Consent: string }

    /// A mix: members in canonical order plus the visible history of what has been released from it.
    type AnonymitySet =
        { SetId: string
          Policy: MixPolicy
          /// Canonically ordered — arrival order is destroyed at `mix`, so position carries nothing.
          Members: SealedEvent list
          /// Oldest first. Never empty once anything has been forgotten.
          Erasures: ErasureWitness list }

    /// **The only outward-facing projection, and it is an AGGREGATE.** No member, no ciphertext, no
    /// contributor name ever crosses this boundary — which is precisely the assumption the honest
    /// limit above names.
    type PublicView =
        { SetId: string
          Cardinality: int
          /// Sorted; under a correct mix every entry is identical, so this constrains and reveals
          /// nothing. Under a leaky one it is the silhouette, and the observer finds it.
          Observables: Observable list
          /// Sorted counts **without names** — enough for anyone to verify the coalition floor was
          /// met, not enough to attribute a member to a party.
          ContributionCounts: int list
          Erasures: ErasureWitness list }

    // ── canonical order (ordinal; no culture anywhere near it) ────────────────────────────────────

    let private compareBytes (a: byte[]) (b: byte[]) : int =
        let n = min a.Length b.Length
        let mutable i = 0
        let mutable r = 0
        while r = 0 && i < n do
            r <- compare a[i] b[i]
            i <- i + 1
        if r <> 0 then r else compare a.Length b.Length

    let private compareMembers (a: SealedEvent) (b: SealedEvent) : int =
        let t = String.CompareOrdinal(a.AlgorithmTag, b.AlgorithmTag)
        if t <> 0 then t else compareBytes a.Ciphertext b.Ciphertext

    let private compareObservables (a: Observable) (b: Observable) : int =
        let t = String.CompareOrdinal(a.AlgorithmTag, b.AlgorithmTag)
        if t <> 0 then t else compare a.SealedLength b.SealedLength

    // ── the coalition arithmetic: whose events give whom anonymity ────────────────────────────────

    /// How many members each contributor put in (ordinal identity match), sorted descending.
    let contributionCounts (members: SealedEvent list) : (string * int) list =
        members
        |> List.countBy (fun m -> m.Contributor)
        |> List.sortWith (fun (na, ca) (nb, cb) ->
            if ca <> cb then compare cb ca else String.CompareOrdinal(na, nb))

    /// **The candidates a coalition cannot rule out** — the members it did not contribute. This is
    /// Chaum's "anonymity set seen by a set of keys", computed for contributions instead of edges:
    /// a coalition's own events are transparent *to it*, so they are not anonymity, they are
    /// furniture. Note the direct consequence: a lone contributor's residual is `0`.
    let residualCandidates (coalition: string list) (members: SealedEvent list) : SealedEvent list =
        members
        |> List.filter (fun m -> not (coalition |> List.exists (fun c -> String.Equals(c, m.Contributor, StringComparison.Ordinal))))

    /// The anonymity that survives the **worst** coalition of `c` contributors: total members minus
    /// the `c` largest contributions. This is the number the policy floor is checked against, not
    /// the flattering `n`.
    let worstCaseCoalitionAnonymity (c: int) (members: SealedEvent list) : int =
        let taken =
            contributionCounts members
            |> List.truncate (max 0 c)
            |> List.sumBy snd
        max 0 (List.length members - taken)

    // ── mix, then forget ─────────────────────────────────────────────────────────────────────────

    /// **Step one: mix.** Admits a batch into an anonymity set, destroying arrival order and
    /// refusing every shape in which a later erasure would not actually hide.
    ///
    /// Thermodynamic class: ERASING, and the erased quantity is the arrival order — `List.sortWith
    /// compareMembers` maps every permutation of a batch to one canonical set, a fibre of `k!`.
    /// That is the mechanism, not a side effect: position in the produced list must carry nothing,
    /// or a later erasure leaves a silhouette. See `GiftOfErasureDeclaration`.
    let mix (policy: MixPolicy) (setId: string) (members: SealedEvent list) : Result<AnonymitySet, Refusal> =
        let required = minAnonymitySet policy
        let colluders = maxColludingContributors policy
        let distinctObservables = members |> List.map observableOf |> List.distinct |> List.length
        let residual = worstCaseCoalitionAnonymity colluders members

        if String.IsNullOrWhiteSpace setId then
            Error(MalformedBatch "a mix needs an identifier so its erasures can be witnessed")
        elif members |> List.exists (fun m -> String.IsNullOrWhiteSpace m.Contributor) then
            Error(
                MalformedBatch
                    "every member must name its contributor: the coalition arithmetic is what makes the forgetting cooperative"
            )
        elif members |> List.exists (fun m -> isNull m.Ciphertext || m.Ciphertext.Length = 0) then
            Error(
                MalformedBatch
                    "members must arrive already sealed: this module mixes ciphertext and never performs encryption"
            )
        elif List.length members < required then
            Error(BelowAnonymityFloor(List.length members, required))
        elif distinctObservables > 1 then
            Error(SilhouetteLeak distinctObservables)
        elif residual < required then
            Error(DominatedByContributors(residual, required, colluders))
        else
            Ok
                { SetId = setId
                  Policy = policy
                  Members = List.sortWith compareMembers members
                  Erasures = [] }

    /// **Step two: forget.** The holder names its own memory with `chooser`; the member's sealed
    /// bytes are dropped from the set and a witness of the *fact* is appended.
    ///
    /// Thermodynamic class: ERASING with respect to the returned set — and `Unmeasured` with
    /// respect to the process heap, which is the row that matters for a module whose entire
    /// purpose is that the preimage be unrecoverable. `AnonymitySet` is an immutable value; this
    /// function returns a *new* one and cannot reach the old. If the caller still holds the
    /// pre-state, nothing has been forgotten at all. Erasure here is a property of the caller's
    /// reachability graph, not of this function, and saying so is the difference between a
    /// guarantee and a hope. See `GiftOfErasureDeclaration`.
    ///
    /// **Idempotent (§12) by design and for a second reason:** a chooser matching nothing is a no-op
    /// returning `Ok`, never an error — because an error would be a *presence oracle*, telling the
    /// caller whether a given memory is still in the set.
    let forget (consent: string) (chooser: SealedEvent -> bool) (set: AnonymitySet) : Result<AnonymitySet, Refusal> =
        if String.IsNullOrWhiteSpace consent then
            Error(LeakyWitness "a forgetting must carry the consent under which it happened (manifesto 6)")
        elif set.Members
             |> List.exists (fun m -> consent.IndexOf(m.Contributor, StringComparison.Ordinal) >= 0) then
            Error(
                LeakyWitness
                    "the consent record names a contributor: that collapses every coalition's candidate set onto one party's events, which is the leak this witness exists to avoid"
            )
        else
            match set.Members |> List.filter chooser with
            | [] -> Ok set // idempotent, and no presence oracle
            | [ _ ] ->
                let k = List.length set.Members
                let required = minAnonymitySet set.Policy
                let colluders = maxColludingContributors set.Policy
                let effective = worstCaseCoalitionAnonymity colluders set.Members

                if k < required then
                    Error(BelowAnonymityFloor(k, required))
                elif effective < required then
                    Error(DominatedByContributors(effective, required, colluders))
                else
                    let idx = set.Members |> List.findIndex chooser
                    let remaining =
                        set.Members |> List.indexed |> List.filter (fun (i, _) -> i <> idx) |> List.map snd
                    let witness =
                        { Ordinal = List.length set.Erasures
                          AnonymitySetSizeAtErasure = k
                          EffectiveAnonymityAtErasure = effective
                          Consent = consent }
                    Ok { set with
                           Members = remaining
                           Erasures = set.Erasures @ [ witness ] }
            | several -> Error(AmbiguousChooser(List.length several))

    /// The aggregate an outsider sees. Everything absent from this record is absent on purpose.
    let publicView (set: AnonymitySet) : PublicView =
        { SetId = set.SetId
          Cardinality = List.length set.Members
          Observables = set.Members |> List.map observableOf |> List.sortWith compareObservables
          ContributionCounts = contributionCounts set.Members |> List.map snd |> List.sort
          Erasures = set.Erasures }

    /// Holder-side lookup. Not an outside surface — it is how one proves a forgotten thing is gone.
    let recall (chooser: SealedEvent -> bool) (set: AnonymitySet) : SealedEvent option =
        set.Members |> List.tryFind chooser

    // ── the exhibited observer ───────────────────────────────────────────────────────────────────

    /// A distribution over "which member was erased", produced by an adversary that was actually
    /// run — never a boolean somebody asserted.
    type Observation =
        { /// `(candidate index, posterior probability)`, over the candidates supplied.
          Candidates: (int * float) list
          /// How many candidates reproduce the observed transcript. Equal to `CandidateCount` when
          /// the erasure genuinely hides; `1` when the adversary has identified the erased member.
          ConsistentCount: int
          CandidateCount: int }

    /// **The Bayes-optimal distinguisher for a deterministic protocol.** Given a simulator that
    /// replays the protocol with candidate `j` erased and the transcript actually observed, the
    /// likelihood of `j` is 1 when the simulated transcript equals the observed one and 0 otherwise;
    /// with a uniform prior the posterior is uniform over the consistent set. No adversary can do
    /// better against this view, because a candidate that reproduces the transcript exactly is by
    /// definition unexcludable.
    ///
    /// `candidates` is the index set the adversary must choose between: **all members** for an
    /// outsider, and `residualCandidates` for a contributor coalition — the coalition's own events
    /// are not candidates, because it already knows they are not what it helped hide.
    let posterior (simulate: int -> PublicView list) (candidates: int list) (observed: PublicView list) : Result<Observation, Refusal> =
        if List.isEmpty candidates then
            Error NoCandidatesExhibited
        else
            let consistent = candidates |> List.filter (fun j -> simulate j = observed)

            match consistent with
            | [] -> Error SimulatorDoesNotModelProtocol
            | _ ->
                let m = List.length consistent
                let p = 1.0 / float m
                Ok { Candidates =
                       candidates
                       |> List.map (fun j -> j, (if List.contains j consistent then p else 0.0))
                     ConsistentCount = m
                     CandidateCount = List.length candidates }

    /// Total-variation distance between the observer's posterior and its uniform prior — computed
    /// term by term from the distribution above.
    let totalVariationFromPrior (o: Observation) : float =
        let prior = 1.0 / float o.CandidateCount
        0.5 * (o.Candidates |> List.sumBy (fun (_, p) -> abs (p - prior)))

    /// The same quantity in closed form. **Derivation:** the posterior is `1/m` on each of `m`
    /// consistent candidates and `0` on the other `n − m`, so
    /// `TV = ½·[ m·(1/m − 1/n) + (n − m)·(1/n) ] = 1 − m/n`. Zero exactly when every candidate
    /// survives. (The test checks this against `totalVariationFromPrior`, so the algebra is not
    /// taken on trust.)
    let advantageOverChance (o: Observation) : float =
        1.0 - float o.ConsistentCount / float o.CandidateCount

    /// The probability the adversary's best single guess is right. Chance is `1/CandidateCount`.
    let bestGuessProbability (o: Observation) : float = 1.0 / float o.ConsistentCount

    /// **The property.** Every candidate survives the transcript, *and* there were at least
    /// `deletionFloor` of them — the second clause matters because a one-candidate posterior is
    /// trivially flat, which is the vacuity this whole module is built to refuse.
    let indistinguishable (o: Observation) : bool =
        o.CandidateCount >= deletionFloor && o.ConsistentCount = o.CandidateCount


/// **The declaration for `GiftOfErasure`, beside the operations it classifies** (`ErasureClass`).
///
/// F# modules cannot implement interfaces, so the declaration for a module lives in a companion
/// type in the same file. The law pack's drift guard reflects the module's public surface and
/// requires **every function that RETURNS an `AnonymitySet`** to appear here — a mechanical
/// criterion applied to the type signature, not a judgement call about which functions "look
/// like" they erase.
///
/// ## Why the criterion is "returns", and why that is not a convenient bin
///
/// A state transition that is non-injective **erases**: the pre-state is replaced and nothing
/// reachable distinguishes the inputs. A *projection* that is non-injective **hides**: the
/// pre-state is untouched, and the fibre measures what the viewer fails to learn rather than what
/// the substrate destroyed. Those are different physical situations, and a meter that charges for
/// the second one charges for reading.
///
/// `publicView` is the sharp case. As a function it is massively non-injective — and that
/// non-injectivity IS the anonymity guarantee this module exists to provide, measured as an
/// observer posterior in `GiftOfErasure.Tests.fs`. It destroys nothing. Classifying it here would
/// have produced a row whose sweep is the identity function, which cannot fail and therefore
/// checks nothing: the vacuity class, imported into the very pack built to refuse it.
[<Sealed>]
type GiftOfErasureDeclaration() =
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "GiftOfErasure"
                Operation = "mix"
                Observation = "the AnonymitySet returned by mix"
                RecoveryChannel =
                    "the members, all of them, unchanged — but NOT the order they arrived in: \
                     every permutation of a batch produces one canonical set. Destroying arrival \
                     order is the mechanism, since a position that carried information would be a \
                     silhouette a later erasure could not hide behind"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.ExhaustiveSweep("all permutations of 3 distinct sealed members under a 2-of-1 policy", 6, 2_584_963L) }

              { Representation = "GiftOfErasure"
                Operation = "forget"
                Observation = "the AnonymitySet returned by forget"
                RecoveryChannel =
                    "nothing of the released member — its sealed bytes are dropped and the witness \
                     records only that a forgetting happened, with the anonymity that held at the \
                     time and never an eraser name. Deliberate, cooperative, consented erasure: \
                     the one place in this substrate where destroying the preimage is the goal"
                Classification = ErasureClass.ThermodynamicClass.Erasing
                Evidence = ErasureClass.Evidence.ExhaustiveSweep("every 3-subset of 4 distinct sealed members x each member chosen for release", 2, 1_000_000L) }

              { Representation = "GiftOfErasure"
                Operation = "forget"
                Observation = "the reachable object graph of the calling process"
                RecoveryChannel =
                    "possibly everything — AnonymitySet is an immutable value and forget returns a \
                     NEW one, so the pre-state survives for as long as any caller holds a \
                     reference to it. This function cannot reach it, cannot overwrite it, and \
                     cannot observe whether anyone kept it"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "erasure at the heap level is a property of the caller's reachability graph, which no sweep inside this function can observe; for a module whose purpose is unrecoverability this hole is the honest headline, not a footnote, and recording it as zero would let a ledger certify a forgetting that never happened" }
 ]
