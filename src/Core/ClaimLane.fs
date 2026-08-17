namespace Zeta.Core

/// **`ClaimLane` — the lane classifier: which merge algebra may an edit take?**
/// (work-item `081M00TS219087G0R0016S5PMC`, minted by the skill-mutation study PR #10691.)
///
/// The study established two lanes and named the classifier as the load-bearing deliverable:
///
///   - **Lane 1 — commutative.** Edits expressible as assert/retract over a shared claim vocabulary
///     merge at agent speed, no judgment, redelivery-safe.
///   - **Lane 2 — the dilated region.** Edits that cannot be so expressed fall where convergence
///     deliberately slows and multi-observer consensus runs (Aaron 2026-08-14: *"it genuinely needs
///     multiple eyes to converge on the best answer for all involved"*).
///
/// **The failure asymmetry dictates the whole design.** A judgment-edit misrouted to Lane 1 silently
/// unions two incompatible meanings **and shows green** — converged and wrong. The reverse costs only
/// latency. Therefore this classifier is **sound for Lane 1**, **permitted to be incomplete**, and
/// **unsure ⇒ Lane 2**. Every predicate below is a *reason to refuse Lane 1*; there is no predicate
/// that admits.
///
/// ## The one constraint that keeps it honest
///
/// It asks only **decidable structural questions** and never *"did the meaning change?"* Its input is
/// the **derived** diff of two parsed documents — never an editor's declaration of what it did. An
/// agent that makes a semantic change while reusing an id and labelling it "pointer update" defeats a
/// declaration-based classifier completely; it cannot defeat `diff`, because `diff` reads the bytes.
/// This is why the claim layer must be a *parseable format* (`parse` below) rather than a convention:
/// a classifier over a convention is unsound at the first editor who does not follow it.
///
/// **The soft spot, named** (there is exactly one): `parse` decides where the claim region ends and
/// prose begins from the document's own syntax. A document that does not parse is not classified
/// permissively — `Unparseable` is a Lane-2 reason (unsure ⇒ Lane 2), so the soft spot fails safe.
///
/// ## Lane 1 is `QuorumAlgebra`, not a new subsystem
///
/// Claim weights are Z-set weights (`+1` assert, `−1` retract), so a site's edit set is literally a
/// `QuorumAlgebra.Contribution<string>` over claim atoms and the two-structure split lands exactly:
///
///   - **`join`** — idempotent, source-keyed: the same site's edits delivered twice count once. This
///     is the redelivery-safety half.
///   - **`interfere`** — has inverses: `+1` and `−1` on the same atom annihilate. This is the
///     retraction half.
///
/// Two structures, and `BeliefConvergence.fs` says why one cannot do both: *"an idempotent group is
/// trivial — `a + a = a ⇒ a = e` — so a single operator cannot be both redelivery-safe and
/// retraction-capable."* Any single-merge-function design for this is refuted before it is written.
///
/// **The float caveat in `QuorumAlgebra` does not bite here, and that is checkable.** `AmplitudeEmu`'s
/// `EPS = 1e-12` drop breaks associativity for general amplitudes. Z-set weights are small integers,
/// exactly representable in IEEE-754, so every partial sum is an exact integer: the drop fires at
/// `sum = 0` and nowhere else — which *is* the Z-set convention that zero-weight atoms are absent.
/// Pinned by `ClaimLane.Tests.fs` §E.
///
/// ## The vocabulary rigidity gate (`|Aut|`) — a precondition, not a per-edit trigger
///
/// PR #10733 computed an **imposition budget** `log₂|Aut(S)|` for the `DynamicValue` shape lattice and
/// proved the asymmetry this module reuses: **an upper bound of 1 is exact**, because the identity is
/// always an automorphism, so `1 ≤ |Aut| ≤ 1`. Rigidity is certifiable by upper bound alone.
///
/// Applied here: an automorphism is a permutation of claim ids preserving every declared invariant
/// (body, prose, anchors, in/out citation degree). If a non-trivial one exists, two ids are
/// **structurally interchangeable**, and then `−claim(i)` and `−claim(j)` are indistinguishable to
/// every per-edit predicate — so a retraction can land on the wrong atom with nothing to notice.
///
/// **This catches a case the four per-edit triggers miss, and the test proves it** (§D): two claims
/// with identical bodies, site A retracts one and site B retracts the other. No id collision, no
/// retract/edit race, no cited claim, no prose — every per-edit predicate says Lane 1, the Z-set
/// weights all land in `{0,1}` so the post-hoc weight check is also green, and the merged result has
/// annihilated a claim neither site meant to remove.
///
/// **Honest shape of the finding:** rigidity is a property of the *vocabulary*, not of an *edit*, so
/// it gates the lane rather than the edit. It is the one Lane-2 reason that can fire with an empty
/// diff. See the research doc for why the *interpretation* of `log₂|Aut|` as coercion remains a toy
/// (PR #10733 §8) — nothing here depends on that reading; only on the rigidity bound, which is a
/// theorem.
///
/// Anchors (Beacon, checked 2026-08-14 — not merely cited):
///   - **Terry, D. B., Theimer, M. M., Petersen, K., Demers, A. J., Spreitzer, M. J., Hauser, C. H.
///     (1995)**, *Managing Update Conflicts in Bayou, a Weakly Connected Replicated Storage System*,
///     SOSP '95, pp. 172–183. Every Bayou write carried an application-supplied **dependency check**
///     and **merge procedure** — classify-then-route, thirty years early, adopted *because* syntactic
///     merge was unsound for application semantics. `dependencyCheck` below is that mechanism by name.
///   - **Shapiro, M., Preguiça, N., Baquero, C., Zawirski, M. (2011)**, *A Comprehensive Study of
///     Convergent and Commutative Replicated Data Types*, INRIA RR-7506 — Lane 1's algebra (the
///     join-semilattice / commutative-monoid conditions sufficient for eventual consistency).
///   - **Ellis, C. A. & Gibbs, S. J. (1989)**, *Concurrency Control in Groupware Systems*, SIGMOD
///     Record 18(2):399–407 (the dOPT algorithm) — **named and rejected, with reason.** OT transforms
///     operations on *character positions* so concurrent edits converge to one string. That is the
///     wrong guarantee: convergence-of-characters is exactly the "silently unions two incompatible
///     meanings" failure above, delivered *deterministically and with a green light*. OT would make
///     the worst misclassification invisible. Rejected on that ground, not on complexity.
///
/// Pointers: `src/Core/QuorumAlgebra.fs` (the two algebras this routes between) ·
/// `src/Core/BeliefConvergence.fs` (the one-line theorem forcing two structures) ·
/// `docs/research/2026-08-14-skills-as-the-second-invariance-case-*.md` §6 (the design) ·
/// `.claude/rules/local-time-never-enters-the-shared-fold.md` (Lane 2 dilates by *round count*, never
/// by a wall clock — see `Verdict` below).
[<RequireQualifiedAccess>]
module ClaimLane =

    open System
    open System.Text.RegularExpressions

    // ── the claim layer: a parseable format, not a convention ────────────────────────────────────

    /// One claim: a stable id, the normative sentence it carries, the structured fields an edit may
    /// touch without touching meaning, and the free prose that may never merge.
    ///
    /// The split of `Anchors` (structured citations/pointers) out of `Prose` is load-bearing and is a
    /// refinement of the study's §6.4: that section admits "a pointer/citation update" to Lane 1 while
    /// also refusing "the prose body at all". Those are consistent only if citations are a *structured
    /// field* rather than free text — otherwise the admission is not derivable. Modelled accordingly.
    type Claim =
        { /// Stable id, ordinal-compared. The key; never merged, only asserted/retracted.
          Id: string
          /// The normative sentence. Changing this may change meaning, so it is never a "pointer update".
          Body: string
          /// Cross-references to other claim ids, derived from the entry's text. Bayou's dependency
          /// check reads this.
          Cites: Set<string>
          /// Structured citations/pointers (URLs, doc paths). Updatable without touching `Body`.
          Anchors: Set<string>
          /// Free rationale. Irreducibly non-commutative — forks, never unions.
          Prose: string }

    /// A parsed claim document: the claim region, plus whatever text did not parse as a claim.
    type ClaimDoc =
        { /// claim id -> claim. Ordinal string keys, so the structure is culture-invariant.
          Claims: Map<string, Claim>
          /// Regions the parser could not resolve into claims. Non-empty ⇒ `Unparseable` ⇒ Lane 2.
          Unparsed: string list }

    /// The empty document — the unit of the Lane-1 merge.
    let emptyDoc : ClaimDoc = { Claims = Map.empty; Unparsed = [] }

    // ── parsing (derivation, so an editor cannot lie about what it did) ──────────────────────────

    /// `- **BP-01** …` — the claim-entry OPENER. Matches the id only: the body may wrap across
    /// several lines (28 of 28 entries in the shipped document use the format; 5 of them wrap), so
    /// the body is extracted from the whole assembled block rather than from the opener line.
    let private openerRe =
        Regex(@"^-\s+\*\*(?<id>[A-Z][A-Z0-9]*-[A-Za-z0-9]+)\*\*(?<rest>.*)$", RegexOptions.Compiled)

    /// A bullet whose bold run *starts with a claim-id-shaped token* but which did not match
    /// `openerRe` — i.e. something that is plainly trying to declare a claim and is not in the
    /// format. This must be recorded, never skipped: a silently-skipped entry is a claim that exists
    /// in the document and not in the parse, which is the "a check that did not run looks like one
    /// that passed" failure. Found live — `BP-25` in the shipped document is exactly this shape.
    let private claimishRe =
        Regex(@"^-\s+\*\*(?<id>[A-Z][A-Z0-9]*-[A-Za-z0-9]+)", RegexOptions.Compiled)

    /// The normative sentence: the italic run that must begin the entry immediately after the id.
    /// Anchored, and refusing a doubled `*`, so a `**Rationale:**` lead-in does NOT get mistaken for
    /// a body — an entry with no italic body fails to parse and becomes a Lane-2 reason.
    let private bodyRe = Regex(@"^\*(?<body>[^*]+)\*", RegexOptions.Compiled)

    /// A candidate claim id mentioned inside an entry. Filtered against the document's actual ids in
    /// a second pass, so a placeholder like `BP-NN` or a bibliography code like `RR-7506` never
    /// becomes a cross-reference edge to a claim that does not exist.
    let private idRe = Regex(@"\b(?<id>[A-Z][A-Z0-9]*-[A-Za-z0-9]+)\b", RegexOptions.Compiled)

    /// A structured anchor: an angle-bracketed URL, the form the repo's citation convention uses.
    let private anchorRe = Regex(@"<(?<url>https?://[^>]+)>", RegexOptions.Compiled)

    /// Collapse runs of whitespace so that a pure re-wrap of a paragraph is not read as an edit.
    /// This normalises *layout*, never *words* — it must never be extended to normalise meaning.
    let private normalize (s: string) : string =
        Regex.Replace(s.Trim(), @"\s+", " ")

    /// **Parse the claim layer out of a markdown document.** An entry runs from its opener to the next
    /// opener or the next markdown heading; the body is the leading italic run of the assembled block
    /// and the prose is what remains.
    ///
    /// **`Anchors` are removed from `Prose`, and that is load-bearing.** The study admits "a
    /// pointer/citation update" to Lane 1 while also refusing "the prose body at all" — those are
    /// consistent only if citations are a *separate structured field*. If anchors were merely text
    /// inside the prose, every anchor edit would also be a prose edit and the Lane-1 admission would
    /// be unreachable. Splitting them makes it reachable *and* derivable.
    ///
    /// Text before the first entry is document preamble and is deliberately *not* recorded as
    /// `Unparsed`: it is not claiming to be a claim. `Unparsed` is for a block that opens like an
    /// entry and then does not resolve — where the parser genuinely does not know what it is looking
    /// at, which must reach Lane 2 rather than be dropped.
    let parse (text: string) : ClaimDoc =
        let lines = text.Replace("\r\n", "\n").Split('\n')

        // Pass 1 — assemble blocks: (id, lines-of-the-entry-with-the-id-prefix-stripped).
        let blocks = ResizeArray<string * ResizeArray<string>>()
        let unparsed = ResizeArray<string>()
        let mutable current : (string * ResizeArray<string>) option = None

        let flush () =
            match current with
            | Some b -> blocks.Add b
            | None -> ()
            current <- None

        for line in lines do
            let m = openerRe.Match(line)
            if m.Success then
                flush ()
                current <- Some(m.Groups.["id"].Value, ResizeArray [ m.Groups.["rest"].Value ])
            elif claimishRe.IsMatch(line) then
                // Declares a claim id and is not in the format. Ends the previous entry (we do not
                // know what this text belongs to) and becomes a Lane-2 reason rather than vanishing.
                flush ()
                unparsed.Add(sprintf "non-conforming claim entry: %s" (normalize line))
            elif line.StartsWith("#", StringComparison.Ordinal) then
                flush ()
            else
                match current with
                | Some(_, acc) -> acc.Add(line)
                | None -> ()
        flush ()

        // Pass 2 — resolve each block into a claim, or record it as unresolved.
        let resolved = ResizeArray<string * string * string * Set<string> * string>()
        for (id, acc) in blocks do
            let whole = normalize (String.Join(" ", acc))
            let bm = bodyRe.Match(whole)
            if not bm.Success then
                unparsed.Add(sprintf "entry %s has no parseable claim body" id)
            else
                let body = normalize bm.Groups.["body"].Value
                let tail = whole.Substring(bm.Length)
                let anchors = anchorRe.Matches(tail) |> Seq.map (fun m -> m.Groups.["url"].Value) |> Set.ofSeq
                // prose excludes the structured anchors, so an anchor-only edit leaves prose identical.
                let prose = normalize (anchorRe.Replace(tail, ""))
                resolved.Add(id, body, prose, anchors, whole)

        // Pass 3 — cross-reference edges, restricted to ids that actually exist here.
        let known = resolved |> Seq.map (fun (id, _, _, _, _) -> id) |> Set.ofSeq
        let claims =
            resolved
            |> Seq.map (fun (id, body, prose, anchors, whole) ->
                let cites =
                    idRe.Matches(whole)
                    |> Seq.map (fun m -> m.Groups.["id"].Value)
                    |> Seq.filter (fun i -> Set.contains i known && not (String.Equals(i, id, StringComparison.Ordinal)))
                    |> Set.ofSeq
                id, { Id = id; Body = body; Cites = cites; Anchors = anchors; Prose = prose })
            |> List.ofSeq

        // A duplicated id in one document is unresolvable structure, not a last-wins merge.
        for (d, _) in claims |> List.countBy fst |> List.filter (fun (_, n) -> n > 1) do
            unparsed.Add("duplicate claim id: " + d)

        { Claims = Map.ofList claims; Unparsed = List.ofSeq unparsed }

    // ── the derived edit (never a declaration) ───────────────────────────────────────────────────

    /// A structural edit, **computed** by `diff`. There is deliberately no constructor an editor can
    /// hand us: the whole soundness argument is that the edit type is derived from bytes.
    [<RequireQualifiedAccess>]
    type Edit =
        /// A claim id present in `after` and absent from `before`.
        | Added of id: string
        /// A claim id present in `before` and absent from `after`.
        | Retracted of id: string
        /// The normative sentence changed under a stable id.
        | BodyChanged of id: string
        /// The cross-reference set changed under a stable id.
        | CitesChanged of id: string
        /// Structured citations/pointers changed; `Body` untouched.
        | AnchorsChanged of id: string
        /// Free prose changed; `Body` untouched.
        | ProseChanged of id: string

    /// The claim id an edit is about.
    let editTarget (e: Edit) : string =
        match e with
        | Edit.Added id | Edit.Retracted id | Edit.BodyChanged id
        | Edit.CitesChanged id | Edit.AnchorsChanged id | Edit.ProseChanged id -> id

    /// **Derive the edit set from two document states.** One claim may yield several edits (a body
    /// change and a prose change are different edits with different lane consequences), which is the
    /// point: the finest structural resolution available is the soundest input to the classifier.
    let diff (before: ClaimDoc) (after: ClaimDoc) : Edit list =
        let ids =
            Set.union (before.Claims |> Map.toSeq |> Seq.map fst |> Set.ofSeq)
                      (after.Claims |> Map.toSeq |> Seq.map fst |> Set.ofSeq)
        [ for id in ids do
            match Map.tryFind id before.Claims, Map.tryFind id after.Claims with
            | None, Some _ -> yield Edit.Added id
            | Some _, None -> yield Edit.Retracted id
            | Some b, Some a ->
                if not (String.Equals(b.Body, a.Body, StringComparison.Ordinal)) then yield Edit.BodyChanged id
                if b.Cites <> a.Cites then yield Edit.CitesChanged id
                if b.Anchors <> a.Anchors then yield Edit.AnchorsChanged id
                if not (String.Equals(b.Prose, a.Prose, StringComparison.Ordinal)) then yield Edit.ProseChanged id
            | None, None -> () ]

    // ── vocabulary rigidity: the |Aut| upper bound ───────────────────────────────────────────────

    /// **Upper bound on `|Aut(claim vocabulary)|`**, by the stabilizer construction of PR #10733:
    /// every automorphism preserves every declared invariant, so
    /// `Aut(S) ⊆ Stab(invariants)` and `|Stab|` is computable as `∏ |class|!` over the classes the
    /// invariants induce. The invariant family is (body, prose, anchors, out-degree, in-degree).
    ///
    /// **An upper bound of 1 is exact** — the identity is always an automorphism, so `1 ≤ |Aut| ≤ 1`.
    /// A large bound proves nothing; a bound of 1 proves everything the lane needs. That asymmetry is
    /// what makes this affordable, and it is the same argument #10733 made for the shape lattice.
    let autUpperBound (doc: ClaimDoc) : bigint =
        let claims = doc.Claims |> Map.toList |> List.map snd
        let inDegree =
            claims
            |> List.collect (fun c -> c.Cites |> Set.toList)
            |> List.countBy id
            |> Map.ofList
        let key (c: Claim) =
            (c.Body, c.Prose, c.Anchors, c.Cites.Count, (match Map.tryFind c.Id inDegree with Some n -> n | None -> 0))
        let factorial (n: int) : bigint =
            let mutable acc = bigint 1
            for i in 2 .. n do acc <- acc * bigint i
            acc
        claims
        |> List.groupBy key
        |> List.fold (fun acc (_, grp) -> acc * factorial grp.Length) (bigint 1)

    /// The vocabulary is **rigid** iff the upper bound is 1 — i.e. no two claim ids are structurally
    /// interchangeable, so an assert/retract by id cannot land on the wrong atom.
    let isRigid (doc: ClaimDoc) : bool = autUpperBound doc = bigint 1

    /// `log₂` of the bound — the imposition budget in bits, in #10733's units. Reported for continuity
    /// with that work; the *rigidity decision* uses `isRigid`, which needs no logarithm.
    ///
    /// Honest note carried forward from #10733 §8: reading this number as *coercion* is a **toy** and
    /// is not promoted here. Nothing in this module depends on that reading.
    let impositionBits (doc: ClaimDoc) : float =
        let b = autUpperBound doc
        if b <= bigint 1 then 0.0 else Math.Log(float b, 2.0)

    // ── the classifier ───────────────────────────────────────────────────────────────────────────

    /// A named reason to refuse Lane 1. Every one is decidable from structure; none asks about meaning.
    [<RequireQualifiedAccess>]
    type Reason =
        /// The edit touches free prose, which is irreducibly non-commutative and forks rather than unions.
        | ProseTouched of id: string
        /// Both sites produced a claim at the same id with different bodies — the id collision.
        | SameIdDifferentBody of id: string
        /// One site retracted an id the other site edited — retraction races an edit.
        | RetractRacesEdit of id: string
        /// Bayou's dependency check: the edit changes or removes a claim that another claim cites.
        | CitedClaimTouched of target: string * citer: string
        /// The document did not parse — unsure, and unsure routes to Lane 2.
        | Unparseable of region: string
        /// The vocabulary admits a non-trivial automorphism, so assert/retract by id is not sound.
        /// Fires on the *vocabulary*, and can therefore fire with an empty diff.
        | VocabularyNotRigid of autUpperBound: string

    /// The classifier's guards, as first-class values. Naming them makes the mutation harness
    /// (`classifyOmitting`) complete over the guard set rather than a hand-picked sample.
    [<RequireQualifiedAccess>]
    type Guard =
        | Prose
        | SameIdDifferentBody
        | RetractRacesEdit
        | DependencyCheck
        | Parseability
        | VocabularyRigidity

    /// Every guard. A mutation test asserts each one is individually load-bearing.
    let allGuards : Guard list =
        [ Guard.Prose; Guard.SameIdDifferentBody; Guard.RetractRacesEdit
          Guard.DependencyCheck; Guard.Parseability; Guard.VocabularyRigidity ]

    /// Where an edit pair is routed.
    ///
    /// **`Lane2` carries no deadline and no timestamp, deliberately.** A dilated region is exactly
    /// where someone reaches for a wall-clock timeout to bound the round — and a local clock that
    /// filters which evidence reaches the shared fold makes different nodes fold different sets, so
    /// they diverge (`.claude/rules/local-time-never-enters-the-shared-fold.md`). Lane 2's dilation is
    /// measured in **consensus rounds**, a shared logical quantity; if a node wants to give up it may
    /// do so *locally*, and its local decision must not shrink the evidence set anyone else folds.
    [<RequireQualifiedAccess>]
    type Verdict =
        /// Commutative: merge now, no round, redelivery-safe.
        | Lane1
        /// Judgment: multi-observer consensus, dilated by round count. Carries every reason found —
        /// not the first — because a reviewer needs the whole picture, and because a mutation that
        /// removes one guard must still be visible when another guard also fires.
        | Lane2 of Reason list

    /// Bayou's **dependency check**, by name: which claims does the edit's target participate in as a
    /// citation target? Checked against `before` *and* both afters, so a citation added concurrently
    /// with an edit to its target is caught rather than raced.
    let private dependencyCheck (docs: ClaimDoc list) (target: string) : string list =
        docs
        |> List.collect (fun d -> d.Claims |> Map.toList |> List.map snd)
        |> List.filter (fun c -> Set.contains target c.Cites)
        |> List.map (fun c -> c.Id)
        |> List.distinct
        |> List.sortWith (fun a b -> String.CompareOrdinal(a, b))

    /// **The classifier, with an explicit guard set — the falsifier surface.**
    ///
    /// Production callers use `classify`, which enables every guard. This overload exists so the
    /// mutation harness can construct a *permissive* classifier by removing one guard and prove a test
    /// goes red. That is the `toy-is-free-metered-must-be-earned` discipline applied to the classifier
    /// itself: a guard nobody can demonstrate the removal of is not a guard, it is a comment.
    ///
    /// **It is not a production mode.** Calling this with a proper subset of `allGuards` yields an
    /// unsound classifier by construction, which is the entire point of it existing.
    let classifyOmitting (enabled: Set<Guard>) (baseDoc: ClaimDoc) (siteA: ClaimDoc) (siteB: ClaimDoc) : Verdict =
        let on g = Set.contains g enabled
        let editsA = diff baseDoc siteA
        let editsB = diff baseDoc siteB
        let allDocs = [ baseDoc; siteA; siteB ]
        let reasons = ResizeArray<Reason>()

        // 1. parseability — unsure ⇒ Lane 2.
        if on Guard.Parseability then
            for d in allDocs do
                for r in d.Unparsed do reasons.Add(Reason.Unparseable r)

        // 2. vocabulary rigidity — a precondition on the vocabulary, so it is checked on every state
        //    an atom could be resolved against, including the base with an empty diff.
        if on Guard.VocabularyRigidity then
            for d in allDocs do
                let b = autUpperBound d
                if b > bigint 1 then
                    reasons.Add(Reason.VocabularyNotRigid(b.ToString(Globalization.CultureInfo.InvariantCulture)))

        // 3. prose is never Lane 1.
        if on Guard.Prose then
            for e in editsA @ editsB do
                match e with
                | Edit.ProseChanged id -> reasons.Add(Reason.ProseTouched id)
                | _ -> ()

        let targetsA = editsA |> List.map editTarget |> Set.ofList
        let targetsB = editsB |> List.map editTarget |> Set.ofList
        let contested = Set.intersect targetsA targetsB

        for id in contested do
            let inA = Map.tryFind id siteA.Claims
            let inB = Map.tryFind id siteB.Claims
            // 4. same id, different body — the collision the whole design exists to catch.
            if on Guard.SameIdDifferentBody then
                match inA, inB with
                | Some a, Some b when not (String.Equals(a.Body, b.Body, StringComparison.Ordinal)) ->
                    reasons.Add(Reason.SameIdDifferentBody id)
                | _ -> ()
            // 5. a retraction on one side racing any edit on the other.
            if on Guard.RetractRacesEdit then
                match inA, inB with
                | None, Some _ | Some _, None -> reasons.Add(Reason.RetractRacesEdit id)
                | _ -> ()

        // 6. the dependency check, over every edit (not only contested ones): touching a claim that
        //    something else cites can invalidate the citer, and no per-claim test can see that.
        if on Guard.DependencyCheck then
            for e in editsA @ editsB do
                match e with
                | Edit.Added _ | Edit.AnchorsChanged _ | Edit.CitesChanged _ -> ()
                | Edit.BodyChanged id | Edit.Retracted id | Edit.ProseChanged id ->
                    for citer in dependencyCheck allDocs id do
                        reasons.Add(Reason.CitedClaimTouched(id, citer))

        if reasons.Count = 0 then Verdict.Lane1
        else Verdict.Lane2(reasons |> Seq.distinct |> Seq.toList)

    /// **The classifier.** Every guard enabled; sound for Lane 1, permitted incomplete, unsure ⇒ Lane 2.
    let classify (baseDoc: ClaimDoc) (siteA: ClaimDoc) (siteB: ClaimDoc) : Verdict =
        classifyOmitting (Set.ofList allGuards) baseDoc siteA siteB

    // ── Lane 1: the merge, routed through QuorumAlgebra ──────────────────────────────────────────

    /// The canonical atom string for a claim — the Z-set key. Two claims merge iff they are
    /// byte-identical in every field, so a body change is a retract of one atom and an assert of
    /// another rather than an in-place mutation.
    let atomOf (c: Claim) : string =
        String.Join(
            "",
            [ c.Id
              c.Body
              String.Join("", c.Cites |> Set.toList)
              String.Join("", c.Anchors |> Set.toList)
              c.Prose ])

    let private weight (w: float) : Complex = { Real = w; Imag = 0.0 }

    /// One site's contribution: `+1` for every atom it asserts, `−1` for every atom it retracts,
    /// relative to the base. This is a `QuorumAlgebra.Contribution<string>` — the Z-set as amplitudes
    /// with zero phase.
    let contributionOf (baseDoc: ClaimDoc) (site: ClaimDoc) : QuorumAlgebra.Contribution<string> =
        let baseAtoms = baseDoc.Claims |> Map.toList |> List.map (snd >> atomOf) |> Set.ofList
        let siteAtoms = site.Claims |> Map.toList |> List.map (snd >> atomOf) |> Set.ofList
        [ for a in Set.difference siteAtoms baseAtoms -> a, weight 1.0
          for r in Set.difference baseAtoms siteAtoms -> r, weight -1.0 ]

    /// **The Lane-1 merge.** `join` first (idempotent, source-keyed — the same site's edits delivered
    /// twice count once), then `interfere` (assert/retract annihilate). Two structures, per the
    /// theorem; `QuorumAlgebra` already names them apart, so this is a caller, not a subsystem.
    ///
    /// Returns the resulting Z-set of atoms with their integer weights.
    let lane1Merge (baseDoc: ClaimDoc) (sites: (string * ClaimDoc) list) : (string * float) list =
        let baseQ = QuorumAlgebra.single "\u0000base" [ for c in baseDoc.Claims |> Map.toList |> List.map snd -> atomOf c, weight 1.0 ]
        let q =
            sites
            |> List.map (fun (name, doc) -> QuorumAlgebra.single name (contributionOf baseDoc doc))
            |> List.fold QuorumAlgebra.join baseQ
        QuorumAlgebra.interfereQuorum q
        |> List.map (fun (atom, z) -> atom, z.Real)
        |> List.sortWith (fun (a, _) (b, _) -> String.CompareOrdinal(a, b))

    /// **A post-hoc falsifier on the Lane-1 merge itself**: a valid claim set has every atom weight in
    /// `{0, 1}`. A weight outside that range is *proof* the edit pair was not commutative-representable
    /// — e.g. two sites retracting the same atom sum to `−1`.
    ///
    /// **Its limit is stated because it is the interesting part:** it does *not* catch the
    /// interchangeable-id case (§C of the tests), where every weight lands in `{0,1}` and a claim is
    /// still annihilated. That is precisely why the rigidity gate is not redundant with it.
    let lane1Anomalies (merged: (string * float) list) : (string * float) list =
        merged |> List.filter (fun (_, w) -> w < -0.5 || w > 1.5)
