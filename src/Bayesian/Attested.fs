namespace Zeta.Bayesian

/// # Attested evidence — the provenance-keyed belief fold (`universal/evidence`)
///
/// The reference implementation of the **Universal Evidence Interface**
/// (`universal/evidence.md`). One shape, three scales: an individual folding
/// observations, a society folding members, and a world folding societies all
/// use THIS operation, unchanged. That is manifesto §9 (recursive) and §10
/// (self-similar) applied to belief.
///
/// ## The problem it exists to remove
///
/// For **proper** messages, the exponential-family product is monotone in
/// precision: `tau(a*b) = tau_a + tau_b >= max(tau_a, tau_b)`. So evidence can
/// only ADD, and **no admissible input to a fold can say -this was already
/// counted-**. Six agents resting on one data stream therefore fold to six
/// times the confidence of any one of them, and nothing inside the fold can
/// notice. Measured, before this module existed: six agents on one stream gave
/// `precision = 66.0` on a mean wrong by 5.66.
///
/// The one message that DOES reduce precision is improper (`tau < 0`), and that
/// is exactly the EP cavity (Minka 2001) — a **removal**, not a correlation
/// coefficient. So the algebra already had the right operator; what it lacked
/// was the information needed to aim it. That information is **provenance**,
/// and provenance is not derivable from `(nu, tau)` — which is precisely why
/// the correction cannot come from inside the fold.
///
/// ## The shape
///
/// A belief is not a message. A belief is the **set of evidence atoms** it
/// rests on, each keyed by the identity of the source it came from; the message
/// is the *product* of that set, computed on demand. Combining two beliefs is
/// then a **set union**, which is idempotent, commutative and associative — a
/// bounded join-semilattice, i.e. a G-Set CRDT keyed by provenance (Shapiro,
/// Preguica, Baquero and Zawirski 2011). Redundancy cannot survive a set union,
/// so double counting stops being something to detect and becomes something
/// that cannot be expressed.
///
/// ## Sameness is not identity — how the key is chosen
///
/// The key is the identity of the evidence **SOURCE**, never a hash of the
/// message value. Two agents that independently arrived at `N(0,1)` hold two
/// pieces of evidence; two agents that copied one prior hold one. Keying on the
/// value would conflate those, which is `dual-use-detection-is-neutral-oracle-decides`
/// exactly: recognising sameness is not assigning identity. Mint the id from the
/// source (content-addressed on the stream, never on the holder name — a name is
/// a routing address); use a detector to CHECK it, never to produce it.
///
/// ## What this does NOT do (the limit, stated so it cannot be quietly lost)
///
/// Deduplication removes **redundancy** — the same source counted twice. It does
/// NOT remove **correlation** — two genuinely distinct sources with a common
/// cause. `Deduplicated` is a fact about bookkeeping and is *not* a claim of
/// independence. The correlation half needs an external observer over repeated
/// rounds (`DecorrelationExcess`, and the CHSH oracle in `AntiSybil`), and both
/// convict without ever acquitting. Reading `Deduplicated` as "independent" would
/// be the overclaim this paragraph exists to prevent.
///
/// Anchors: Minka 2001 (EP cavity = the removal operator); Kschischang, Frey and
/// Loeliger 2001 (the product is the combine); Shapiro et al. 2011 (state-based
/// CRDT join-semilattice). Cited from standing knowledge, not page-checked.
type Attestation =
    /// Evidence naming the source it came from. Content-addressed on the evidence
    /// stream; comparison is ORDINAL (F# structural comparison on `string` is
    /// `String.CompareOrdinal`), so the fold order is culture-invariant.
    | FromSource of sourceId: string
    /// Evidence naming no source. Distinctness is UNKNOWN, so it can never be
    /// deduplicated against anything. The nonce keeps two unattested atoms from
    /// silently merging into one — absence of provenance is not evidence of
    /// sameness any more than it is evidence of difference.
    | Unattested of nonce: string

/// What a fold is entitled to say about its own bookkeeping.
type ProvenanceReading =
    /// Every atom named a source, so no source was counted twice. A fact about
    /// BOOKKEEPING, never a claim of independence — see the module header.
    | Deduplicated of sourceCount: int
    /// `count` atoms named no source. The folded precision may over-count and no
    /// confidence claim may be published from it.
    | UnattestedAtoms of count: int
    /// The same source arrived carrying two DIFFERENT messages, which violates the
    /// stated key invariant. Those atoms are excluded and named; a winner is never
    /// picked, because picking one would be an arbitrary choice wearing a merge.
    | ConflictingSources of keys: Attestation list

[<RequireQualifiedAccess>]
module Attested =

    /// A belief carried AS the evidence it rests on. The message is DERIVED
    /// (`value`), never stored, so a confidence that has lost track of where it
    /// came from is not representable.
    type Belief<'M when 'M: equality> =
        { /// source identity -> the message that source contributed.
          Atoms: Map<Attestation, 'M> }

    /// The identity of the fold: no evidence at all.
    let empty<'M when 'M: equality> : Belief<'M> = { Atoms = Map.empty }

    /// One atom of evidence naming its source. The admissible form.
    let ofSource (sourceId: string) (message: 'M) : Belief<'M> =
        { Atoms = Map.ofList [ FromSource sourceId, message ] }

    /// One atom of evidence naming no source. Admissible — silence about
    /// provenance is honest where a fabricated id would not be — but a fold
    /// containing one may not publish a confidence claim.
    let ofUnattested (nonce: string) (message: 'M) : Belief<'M> =
        { Atoms = Map.ofList [ Unattested nonce, message ] }

    /// The message this belief amounts to: the PRODUCT of its atoms. Order does
    /// not matter (the product is a commutative monoid) and `Map` iterates in
    /// ordinal key order, so the result is deterministic and DST-replayable.
    let value (algebra: IMessage<'M>) (belief: Belief<'M>) : 'M =
        belief.Atoms |> Map.fold (fun acc _ m -> algebra.Product(acc, m)) algebra.Uniform

    /// The sources this belief rests on.
    let provenance (belief: Belief<'M>) : Set<Attestation> =
        belief.Atoms |> Map.toList |> List.map fst |> Set.ofList

    /// The provenance the two beliefs SHARE — the evidence a naive product would
    /// count twice.
    let sharedWith (a: Belief<'M>) (b: Belief<'M>) : Set<Attestation> =
        Set.intersect (provenance a) (provenance b)

    /// The EP cavity, KEYED: remove one source contribution. This is the only
    /// precision-reducing operation, and it is a removal aimed by provenance
    /// rather than a correlation coefficient fitted to taste.
    let remove (key: Attestation) (belief: Belief<'M>) : Belief<'M> =
        { Atoms = Map.remove key belief.Atoms }

    /// Atoms whose key collides while carrying a DIFFERENT message — a violation
    /// of the key invariant (a source id is content-addressed on its evidence, so
    /// one id can only ever carry one message).
    let private conflicts (a: Belief<'M>) (b: Belief<'M>) : Attestation list =
        b.Atoms
        |> Map.toList
        |> List.choose (fun (k, mb) ->
            match Map.tryFind k a.Atoms with
            | Some ma when ma <> mb -> Some k
            | _ -> None)

    /// **The join.** Set union on provenance: idempotent, commutative, associative,
    /// identity `empty` — a bounded join-semilattice, so folding in any order and
    /// any GROUPING gives the same answer. That grouping-invariance is what makes
    /// the interface scale-free: the result is again a `Belief` carrying the union
    /// of its inputs provenance, hence a valid input to the next fold up.
    ///
    /// `Error` NAMES the conflicting keys rather than resolving them.
    let tryCombine (a: Belief<'M>) (b: Belief<'M>) : Result<Belief<'M>, Attestation list> =
        match conflicts a b with
        | [] -> Ok { Atoms = Map.fold (fun acc k v -> Map.add k v acc) a.Atoms b.Atoms }
        | ks -> Error ks

    /// The total form, for folds that must not stop: conflicting atoms are
    /// EXCLUDED from the result and returned, never resolved by picking a winner.
    /// Exclusion is deterministic and order-independent; picking is neither.
    ///
    /// Honest limit: on the degenerate conflicting path the exclusion is not
    /// claimed to be associative. A conflict means the caller already broke the
    /// key invariant, and the fold reports that rather than pretending to repair it.
    let combineReporting (a: Belief<'M>) (b: Belief<'M>) : Belief<'M> * Attestation list =
        let ks = conflicts a b
        let excluded = Set.ofList ks
        let merged =
            Map.fold (fun acc k v -> Map.add k v acc) a.Atoms b.Atoms
            |> Map.filter (fun k _ -> not (Set.contains k excluded))
        { Atoms = merged }, ks

    /// Fold a whole population into one belief, deduplicating on provenance as it
    /// goes. THE SAME OPERATION AT EVERY SCALE: observations into an individual,
    /// members into a society, societies into a world.
    let admit (beliefs: Belief<'M> seq) : Belief<'M> * Attestation list =
        beliefs
        |> Seq.fold
            (fun (acc, ks) b ->
                let merged, conflicted = combineReporting acc b
                merged, List.append ks conflicted)
            (empty, [])

    /// True iff every atom named its source — the precondition for publishing any
    /// confidence claim derived from this belief.
    let isPublishable (belief: Belief<'M>) : bool =
        belief.Atoms
        |> Map.forall (fun k _ -> match k with FromSource _ -> true | Unattested _ -> false)

    /// What this fold is entitled to SAY about its own bookkeeping. Never a claim
    /// of independence — see the module header.
    let reading (conflicted: Attestation list) (belief: Belief<'M>) : ProvenanceReading =
        if not (List.isEmpty conflicted) then
            ConflictingSources(conflicted |> List.distinct)
        else
            let unattested =
                belief.Atoms
                |> Map.toList
                |> List.filter (fun (k, _) -> match k with Unattested _ -> true | FromSource _ -> false)
            if not (List.isEmpty unattested) then UnattestedAtoms unattested.Length
            else Deduplicated belief.Atoms.Count
