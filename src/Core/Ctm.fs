namespace Zeta.Core

/// **`Ctm` — the Conscious Turing Machine as a typed interface, v0. DECLARATION ONLY.**
///
/// `docs/research/2026-08-16-isociety-iworld-the-map-and-minimal-declarations.md` §7 recorded that
/// `Society.fs` could not type the `ISociety :&gt; CTM` fixpoint because **`CTM` had no definition in
/// `src/`** (`rg "CTM" src/` returned 0 hits). This file supplies the missing contract. It declares
/// no machine: no implementation, no processors, no transport, no state.
///
/// ## Anchor (Beacon) — the published paper, checked, not merely cited
///
/// Lenore Blum and Manuel Blum, *"A Theory of Consciousness from a Theoretical Computer Science
/// Perspective: Insights from the Conscious Turing Machine"*, **PNAS 119(21) e2115934119, 2022**
/// (doi:10.1073/pnas.2115934119). The formal statement of the model used to derive every clause
/// below was read in the same authors' later restatement, *"AI Consciousness is Inevitable"*
/// (arXiv:2403.17101), §2.1 and Appendix §6.2, which states the structure, the chunk tuple, the
/// competition rule and the winner-take-all theorem in full. Roots: Bernard Baars, *Global Workspace
/// Theory*; Avrim Blum, *Sleeping Experts*; Donald Hebb (1949) — the link-formation rule.
///
/// **Clean-room note.** `docs/research/ip-questionable/` holds a forwarded talk transcript on this
/// same model. It was **not opened** for this work and nothing here derives from it. The design is
/// taken from the published papers' stated *requirements*; no naming, ordering or structure is
/// carried across from any transcript (`cleanroom-two-team-separation`).
///
/// ## The paper's structure, and which clause each requirement produced
///
/// CTM is defined formally as a 7-tuple `(STM, LTM, Up-Tree, Down-Tree, Links, Input, Output)`.
///
/// | Paper requirement | Clause here |
/// |---|---|
/// | STM holds exactly **one** chunk at a time; that chunk is globally broadcast | `tournament` returns at most one winner; `Broadcast` takes exactly one |
/// | LTM is N processors, each with its own address, language and value-assigning algorithm | `Processors : view -&gt; Address list` |
/// | A chunk is the tuple `address, time, gist, value; aux` with `aux = intensity, mood` | `Chunk` |
/// | Up-Tree: each match's coin-toss neuron picks `Ci` with probability `f(Ci)/(f(C1)+f(C2))`, or 1/2 when the sum is 0 | `Match` / `probabilisticMatch` |
/// | Winner-take-all: the winner carries the **sum** of both intensities and both moods | `probabilisticMatch`; `CtmLaws.rankIsAdditiveUnderMatch` |
/// | `f` maps a chunk to a non-negative real; naturally `intensity`, generally `intensity + d*mood`, `-1 &lt;= d &lt;= 1` | `Rank`; `rankByDisposition` |
/// | Down-Tree broadcasts the winner to **all** N processors | `CtmLaws.broadcastReachesEveryProcessor` |
/// | Links are bi-directional edges that let communication **bypass STM**; **none exist at birth** | `Links`; `CtmLaws.hasUnmediatedExit` |
/// | The Model-of-the-World processor "is not actually a single processor; its functionality and memory are distributed across all LTM processors" | no `ModelOfTheWorld` member exists — see below |
///
/// ## Three things the paper's model gives Zeta that are worth naming
///
/// **1. The competition is a commutative-monoid fold, and that is why the theorem holds.** The
/// paper's theorem — *"in a winner-take-all tournament ... the probability that a chunk wins the
/// tournament is proportional to its f-value, so permuting processor locations will have no effect"*
/// — rests on `f` being **additive under a match**: intensity and mood both accumulate by sum, and
/// `f = intensity + d*mood` is linear in both, so `f(winner) = f(left) + f(right)` exactly. Additive
/// plus commutative is the same algebraic shape as `Society.SocietyLaws.mergeCommutative`, one level
/// up. It also makes the bracket irrelevant, which is why `tournament` below may fold a **linear**
/// bracket rather than reproduce a perfect binary Up-Tree and still be faithful: bracket-independence
/// *is* associativity. `CtmLaws.rankIsAdditiveUnderMatch` is that property made decidable.
///
/// **2. The randomness is the §13 door.** The paper is explicit that the competition is probabilistic
/// **by necessity** (a deterministic competition starves a chunk whose value is a hair below its
/// rival's, and the deterministic workarounds were "frightfully complex"). Zeta cannot take an
/// ambient RNG: entropy enters only through declared, metered channels (Goguen-Meseguer 1982;
/// discipline §13). So `Match` takes the draw as a **parameter** and `tournament` takes the draws as
/// a **supplied sequence**. The paper's semantics is preserved exactly and the machine becomes
/// DST-replayable (§7), which the paper does not need and we do.
///
/// **3. The Model-of-the-World is distributed, and that is load-bearing.** The paper singles out a
/// Model-of-the-World processor and then immediately says it "is not actually a single processor".
/// A designated self-model would be an appointed node — the shape `itron-hub-patent-boundary` and §1
/// both refuse. There is therefore **no `ModelOfTheWorld` member on this interface**, and its absence
/// is the design, not an omission.
///
/// ## The honest finding: a newborn CTM has NO exit
///
/// Links "enable conscious communication, i.e. communication that goes through STM, to be replaced by
/// more direct and faster unconscious communication through links" — that is exit (Hirschman 1970) in
/// the paper's own mechanism. But: *"The CTM has no links (between processors) at birth"*, and links
/// form Hebbian-ly between processors that broadcast on consecutive ticks. So **at t=0 every crossing
/// is mediated by the single STM slot**, which is precisely the mediating-hub shape §1 refuses, and
/// `CtmLaws.hasUnmediatedExit` is **false** for a newborn CTM.
///
/// This is stated rather than patched. It is not a defect in the paper — it is a real property of the
/// model, and it is the same shape as two things already on file: privacy budget and emergent-hub
/// degree are both **earned** and both start at zero. A CTM earns its exit by broadcasting. Anyone
/// citing a CTM as satisfying Zeta's exit discipline must say **at what age**.
///
/// ## Weight-free, and what is deliberately absent
///
/// Pure interfaces over caller-supplied values, zero instance state, no module-level mutable, no
/// registry, no static machine (`interfaces-free-classes-earned-under-rules`; §13's injected-only
/// door). Deliberately **not** declared, because nothing real yet determines them: the Sleeping
/// Experts weight update (the learning rule that adjusts a processor's assigned value), Brainish and
/// the gist grammar (`'gist` is the caller's type and stays opaque), the Up-Tree's physical shape,
/// Input and Output maps, and conscious awareness / the Unpacking Axiom — all of which are in the
/// papers and none of which a v0 contract needs.
///
/// **Register: `unmetered`** (`toy-is-free-metered-must-be-earned`). These are interfaces with no
/// consumer; nothing yet fails when a law below is violated. Promotion to `metered` needs one
/// implementation plus a test that fails when `rankIsAdditiveUnderMatch` or
/// `broadcastReachesEveryProcessor` is broken.
[<RequireQualifiedAccess>]
module Ctm =

    /// **A chunk** — the unit that competes for the single STM slot.
    ///
    /// The paper's tuple is `address, time, gist, value; aux`, where the auxiliary information for
    /// the probabilistic CTM is the pair `intensity, mood`. Entry values are `intensity = abs value`
    /// and `mood = value`; as a chunk wins matches both accumulate by **sum**, so the winner's aux
    /// carries global context (the sum of every submitted chunk's intensity and mood).
    ///
    /// `Tick` is the CTM's own clock tick — a **logical** count, never a node's wall clock. A
    /// `Rank` or a `Match` that consulted local receive-time would make two machines fold different
    /// evidence and diverge; see `local-time-never-enters-the-shared-fold`.
    ///
    /// `'gist` is the caller's type and is never inspected here. The paper's Brainish gist grammar is
    /// deliberately not declared.
    type Chunk<'gist> =
        { /// The address of the **originating** processor. Preserved through every match — the
          /// winner of a match keeps its own address, so provenance of the winning gist survives
          /// the tournament.
          Address: Society.Address
          /// The logical tick at which the chunk was created.
          Tick: int64
          /// The succinct representation that competes. Opaque to this module.
          Gist: 'gist
          /// A **valenced** number: the importance/urgency/confidence the originating processor
          /// assigns its gist. May be negative; the sign is the valence.
          Value: float
          /// Aux, first component. `abs Value` at entry; the **sum** of both sides after a match.
          Intensity: float
          /// Aux, second component. `Value` at entry; the **sum** of both sides after a match.
          Mood: float }

    /// Build an entry chunk with the aux invariants the paper states at the start of a competition:
    /// `intensity = abs value`, `mood = value`. Constructing entry chunks through here is what keeps
    /// `CtmLaws.intensityDominatesMood` true, which in turn is what keeps every disposition's rank
    /// non-negative.
    let entryChunk (address: Society.Address) (tick: int64) (gist: 'gist) (value: float) : Chunk<'gist> =
        { Address = address
          Tick = tick
          Gist = gist
          Value = value
          Intensity = abs value
          Mood = value }

    /// The paper's general rank family, `f(chunk) = intensity + d*mood` with `-1 &lt;= d &lt;= 1`.
    /// `d = 0` is the simple natural choice, `f = intensity`. `d` is the machine's **disposition**;
    /// it is a parameter of the implementation and never of this module.
    ///
    /// Non-negative for any `d` in range whenever `abs mood &lt;= intensity`, which
    /// `entryChunk` establishes and a summing match preserves.
    let rankByDisposition (d: float) (chunk: Chunk<'gist>) : float =
        chunk.Intensity + d * chunk.Mood

    /// **`ICtm` — the Conscious Turing Machine contract, v0.**
    ///
    /// `inherit Society.IMember` is the load-bearing line and it is what closes the fixpoint: a CTM
    /// presents the member face (it has an address, folds a delivered message, merges, and has
    /// peers), so **a CTM may be a processor of another CTM with no special case**. That is
    /// `mu X. CTM-over-X` made typeable — and note *where* it is carried: by `IMember`, not by
    /// `ICtm` and not by `ISociety`. See `Levels.fs` for what that costs the doc's original claim.
    ///
    /// `'view` is the caller's state, supplied and returned; the interface holds nothing.
    type ICtm<'view, 'gist, 'msg> =
        inherit Society.IMember<'view, 'msg>

        /// **LTM** — the processors, as routing addresses. The paper's Up-Tree is a perfect binary
        /// tree with one leaf per processor, so this set is **fixed for the machine's life**: there
        /// is no `Admit` here and there must not be one. That fixedness is exactly what makes a CTM
        /// a *closed* level; `Levels.fs` turns that observation into the definition of a world.
        ///
        /// Callers that fold over this MUST order it through `Society.Address.canonicalSort`.
        abstract member Processors: view: 'view -> Society.Address list

        /// The chunk this machine offers into the competition for the given tick — one per
        /// processor per tick, in the paper's model.
        abstract member Submit: view: 'view * tick: int64 -> Chunk<'gist>

        /// **`f`** — the competition's ranking function, mapping a chunk to a non-negative real.
        /// The implementation chooses its disposition (see `rankByDisposition`); the interface
        /// declines to pick one, because a disposition is a values call.
        abstract member Rank: chunk: Chunk<'gist> -> float

        /// **One match of the winner-take-all tournament.** `draw` is a value in `[0, 1)` supplied by
        /// the caller — the coin-toss neuron's entropy, injected, never ambient (§13). The returned
        /// chunk must be one of the two inputs (with its own address, tick, gist and value intact)
        /// carrying the **summed** intensity and mood. `probabilisticMatch` is the paper's rule
        /// written out; an implementation may return it directly.
        abstract member Match: left: Chunk<'gist> * right: Chunk<'gist> * draw: float -> Chunk<'gist>

        /// **The Down-Tree.** Given the chunk that reached STM, return the messages carrying it to
        /// the processors — one per processor, and it **returns** them rather than sending them, for
        /// the same reason `Society.IMember.Deliver` does: there is no transport parameter here, so
        /// no transport can leak in.
        abstract member Broadcast: view: 'view * winner: Chunk<'gist> -> Society.Addressed<'msg> list

        /// **Links** — the bi-directional edges along which a processor may reach another
        /// **without passing through STM**. Empty at birth by the paper's construction; they form
        /// Hebbian-ly between processors that broadcast on consecutive ticks. This is the machine's
        /// *internal* exit; `Society.IMember.Peers` is the machine's *own* exit within whatever
        /// encloses it — the same notion, one rung apart (`Levels.linksAreProcessorPeers`).
        abstract member Links: view: 'view * processor: Society.Address -> Society.Address list

    /// **The paper's coin-toss neuron, written out.** Picks `left` with probability
    /// `f(left) / (f(left) + f(right))`, or 1/2 when the sum is zero, and returns the winner carrying
    /// the summed intensity and mood (winner-take-all). The winner's address, tick, gist and value
    /// are its own — only the aux accumulates.
    ///
    /// **The draw convention is part of the byte-lock**: `draw &lt; p(left)` selects `left`. The
    /// TypeScript mirror in `src/Core.TypeScript/society/ctm.ts` uses the identical convention; if
    /// the two ever disagree the oracles diverge on the same seed, silently.
    let probabilisticMatch
        (rank: Chunk<'gist> -> float)
        (left: Chunk<'gist>)
        (right: Chunk<'gist>)
        (draw: float)
        : Chunk<'gist> =
        let fl = rank left
        let fr = rank right
        let total = fl + fr
        let pLeft = if total <= 0.0 then 0.5 else fl / total
        let winner = if draw < pLeft then left else right

        { winner with
            Intensity = left.Intensity + right.Intensity
            Mood = left.Mood + right.Mood }

    /// **The tournament, folded.** Sorts the submissions into the collation-treaty canonical order
    /// and folds `Match` left over them, consuming one supplied draw per match.
    ///
    /// A **linear** bracket rather than a perfect binary Up-Tree is faithful because the paper's
    /// theorem is bracket-independent: with `f` additive under a match, a chunk's win probability is
    /// `f(chunk) / sum of all f` in any winner-take-all bracket. Bracket-independence is
    /// associativity, and it is why this can be a fold at all.
    ///
    /// Returns `None` when there are no submissions, or when `draws` supplies fewer than
    /// `length - 1` values. Running out of entropy is **not** papered over with an ambient draw:
    /// under §13 the caller owns the entropy budget, and a refusal is the honest failure.
    let tournament
        (machine: ICtm<'view, 'gist, 'msg>)
        (draws: float seq)
        (submissions: Chunk<'gist> list)
        : Chunk<'gist> option =
        let ordered =
            submissions
            |> List.sortWith (fun a b ->
                let byAddress = Society.compareAddress a.Address b.Address
                if byAddress <> 0 then byAddress else compare a.Tick b.Tick)

        match ordered with
        | [] -> None
        | first :: rest ->
            let supplied = draws |> Seq.truncate (List.length rest) |> List.ofSeq

            if List.length supplied < List.length rest then
                None
            else
                List.fold2 (fun acc next draw -> machine.Match(acc, next, draw)) first rest supplied
                |> Some

    /// **The laws — stated so a property test or a proof can be pointed at them.**
    ///
    /// Decidable predicates over caller-supplied witnesses, in the same style as
    /// `Society.SocietyLaws` and for the same reason: this is the surface a formal argument
    /// consumes. Nothing here is a proof and no implementation is asserted to satisfy any of it.
    /// **Register: `unmetered`.**
    [<RequireQualifiedAccess>]
    module CtmLaws =

        /// `abs mood &lt;= intensity`. True at entry (`intensity = abs value`, `mood = value`) and
        /// preserved by a summing match (the triangle inequality). It is what guarantees
        /// `rankByDisposition d` is non-negative for every `d` in `[-1, 1]`, which the paper's
        /// requirement that `f` map into the non-negative reals depends on.
        let intensityDominatesMood (chunk: Chunk<'gist>) : bool =
            abs chunk.Mood <= chunk.Intensity + 1e-12

        /// `f(chunk) &gt;= 0` — the paper's stated range for the ranking function.
        let rankIsNonNegative (machine: ICtm<'view, 'gist, 'msg>) (chunk: Chunk<'gist>) : bool =
            machine.Rank chunk >= 0.0

        /// **A match selects, it never invents.** The winner is one of the two competitors, judged by
        /// the parameters the paper says survive a match unchanged: address and tick. (Gist equality
        /// is deliberately not required — `'gist` is the caller's type and may not be comparable.)
        let matchSelectsACompetitor
            (machine: ICtm<'view, 'gist, 'msg>)
            (left: Chunk<'gist>)
            (right: Chunk<'gist>)
            (draw: float)
            : bool =
            let w = machine.Match(left, right, draw)

            (w.Address = left.Address && w.Tick = left.Tick)
            || (w.Address = right.Address && w.Tick = right.Tick)

        /// **The central law: `f` is additive under a match.** `f(match(a, b, draw)) = f(a) + f(b)`.
        ///
        /// This is the algebraic content of the paper's winner-take-all policy, and everything else
        /// rests on it: it is why win probability is proportional to `f`, why the winner is
        /// independent of processor location, why the bracket does not matter, and therefore why
        /// `tournament` may be a fold. It is the CTM-level statement of the same property
        /// `Society.SocietyLaws.deliveryCommutes` states at the society level.
        let rankIsAdditiveUnderMatch
            (tolerance: float)
            (machine: ICtm<'view, 'gist, 'msg>)
            (left: Chunk<'gist>)
            (right: Chunk<'gist>)
            (draw: float)
            : bool =
            let w = machine.Match(left, right, draw)
            abs (machine.Rank w - (machine.Rank left + machine.Rank right)) <= tolerance

        /// **The draw convention is mirror-symmetric.** Swapping the competitors and reflecting the
        /// draw picks the same winner: `match(a, b, d)` and `match(b, a, 1-d)` agree. This is
        /// permutation-invariance at a single match — the local fact the paper's location-independence
        /// theorem lifts to the whole tournament.
        let matchIsMirrorSymmetric
            (machine: ICtm<'view, 'gist, 'msg>)
            (left: Chunk<'gist>)
            (right: Chunk<'gist>)
            (draw: float)
            : bool =
            let a = machine.Match(left, right, draw)
            let b = machine.Match(right, left, 1.0 - draw)
            a.Address = b.Address && a.Tick = b.Tick

        /// **Rank mass is conserved by the tournament**: the winner's `f` equals the sum of every
        /// submission's `f`. The decidable consequence of additivity, and the reason the winning
        /// chunk's aux carries global context (the sum of all submitted intensities and moods) rather
        /// than only its own.
        let tournamentConservesRankMass
            (tolerance: float)
            (machine: ICtm<'view, 'gist, 'msg>)
            (draws: float seq)
            (submissions: Chunk<'gist> list)
            : bool =
            match tournament machine draws submissions with
            | None -> List.isEmpty submissions
            | Some winner ->
                let total = submissions |> List.sumBy machine.Rank
                abs (machine.Rank winner - total) <= tolerance

        /// **The winner came from the submissions.** No chunk enters STM that no processor offered.
        let tournamentWinnerWasSubmitted
            (machine: ICtm<'view, 'gist, 'msg>)
            (draws: float seq)
            (submissions: Chunk<'gist> list)
            : bool =
            match tournament machine draws submissions with
            | None -> true
            | Some w -> submissions |> List.exists (fun c -> c.Address = w.Address && c.Tick = w.Tick)

        /// **The Down-Tree reaches everyone.** The broadcast's recipients are *exactly* the
        /// processors — no processor is skipped (that would break the global workspace) and no
        /// outsider is addressed (that would be an escape from the machine).
        let broadcastReachesEveryProcessor
            (machine: ICtm<'view, 'gist, 'msg>)
            (view: 'view)
            (winner: Chunk<'gist>)
            : bool =
            let processors = machine.Processors view |> Set.ofList
            let recipients = machine.Broadcast(view, winner) |> List.map (fun m -> m.To) |> Set.ofList
            recipients = processors

        /// **Links are bi-directional**, in the paper's word. If `b` is linked from `a`, then `a` is
        /// linked from `b`.
        let linksAreSymmetric
            (machine: ICtm<'view, 'gist, 'msg>)
            (view: 'view)
            (a: Society.Address)
            (b: Society.Address)
            : bool =
            let fromA = machine.Links(view, a) |> List.contains b
            let fromB = machine.Links(view, b) |> List.contains a
            fromA = fromB

        /// **A link cannot leave the machine.** Every link target is a processor. A link to a
        /// non-processor would be an unmetered channel out of the machine (§13).
        let linksStayInsideTheMachine
            (machine: ICtm<'view, 'gist, 'msg>)
            (view: 'view)
            (processor: Society.Address)
            : bool =
            let processors = machine.Processors view |> Set.ofList
            machine.Links(view, processor) |> List.forall (fun l -> Set.contains l processors)

        /// **Exit that does not pass through STM**: at least `k` links from this processor.
        ///
        /// `k &gt;= 2` is the Hirschman discriminator the repo uses elsewhere
        /// (`Society.SocietyLaws.hasExit`). Read the module header before using this: it is
        /// **false for a newborn CTM by the paper's own construction** — links do not exist at birth
        /// and are earned by broadcasting. That is a real property of the model, not a failure of the
        /// implementation under test, and a report that a CTM lacks exit must say at what age.
        let hasUnmediatedExit
            (k: int)
            (machine: ICtm<'view, 'gist, 'msg>)
            (view: 'view)
            (processor: Society.Address)
            : bool =
            machine.Links(view, processor) |> List.distinct |> List.length >= max 1 k

        /// **The processor roll is collation-stable**, so the TS and F# oracles fold the same
        /// membership in the same order. Same obligation as
        /// `Society.SocietyLaws.membershipIsCanonicallyOrdered`, at this level.
        let processorsAreCanonicallyOrdered (machine: ICtm<'view, 'gist, 'msg>) (view: 'view) : bool =
            let processors = machine.Processors view
            processors = Society.canonicalSortAddresses processors
