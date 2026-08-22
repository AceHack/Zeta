namespace Zeta.Core

/// **`Levels` — one shape, many rungs. There is no `IWorld`, and that is the finding.**
///
/// `docs/research/2026-08-16-isociety-iworld-the-map-and-minimal-declarations.md` §9 left an open
/// question: *"Is `IWorld` a distinct interface, or another name for the society fixpoint?"* This
/// module answers it, and the answer is that **a third interface would have been a slot in a diagram
/// with nothing behind it**:
///
/// &gt; **A world is not a different kind of thing from a society. It is a society that is CLOSED.**
///
/// Closed means: no outbound message is addressed outside the membership, and no offered route leaves
/// the membership. Both of those predicates were **already shipped** in `Society.fs` as
/// `SocietyLaws.outboundStaysInSociety` and `SocietyLaws.routesAreMembers`. `WorldLaws.isWorld` below
/// is their conjunction and nothing more — it is defined *in terms of* them, not re-derived, so a
/// proof pointed at the society laws is pointed at the world laws for free.
///
/// The corroborating evidence is that the two independent things in this repo that behave like worlds
/// both turn out to be *closed societies* and neither needs a new type:
///
/// - a **CTM** (`Ctm.ICtm`) has a fixed processor roll — the Up-Tree is a perfect binary tree with
///   one leaf per processor, so there is no `Admit` and membership cannot change. Fixed membership
///   plus `broadcastReachesEveryProcessor` plus `linksStayInsideTheMachine` **is** closure.
/// - the observer loop's concrete `World` (`src/Core.FSharp.Observe/Types.fs:34`) is a single agent's
///   snapshot of its own backlog. It is not this. Same word, different scale — noted here because it
///   is the one type someone wiring `IWorld` would reach for by name.
///
/// ## What happened to `ISociety :&gt; CTM`
///
/// The 2026-07-04 doc states *"`ISociety &lt;: CTM` in the type system, recursively"* and calls CTM a
/// recursive fixpoint `mu X. CTM-over-X`. With `Ctm.ICtm` now declared, that claim can be checked
/// rather than repeated, and it splits into one part that holds and one that does not.
///
/// **What holds — the fixpoint closes, and `IMember` is what carries it.** Both `Society.ISociety`
/// and `Ctm.ICtm` inherit `Society.IMember`, and a CTM's processors are addresses of members. So a
/// CTM may be a processor of a CTM, a society may be a member of a society, and a CTM may be a member
/// of a society, all with no special case. `mu X. CTM-over-X` is typeable. But the recursion is
/// carried by **`IMember`**, not by `ISociety` and not by `ICtm`.
///
/// `Society.fs` called `ISociety :&gt; IMember` *"the weaker, honest statement"*. It is the weaker
/// **claim about CTM**, and it is also the **correct carrier of the fixpoint** — those are not in
/// tension, and the second half is worth saying out loud because the doc's framing invites reading
/// `IMember` as a consolation prize. It is the load-bearing type.
///
/// **What does not hold — `ISociety &lt;: CTM` is false as unconditional subtyping, and there is a
/// counterexample in this repo.** Declaring `ISociety` to inherit `ICtm` would force **every**
/// society to present a single-slot competition and a global broadcast. The gossip salon
/// (`GossipTelemetry` in F#, `gossip-salon.ts` in TS) is a working society with neither: rumors
/// propagate pairwise and merge by CRDT join, and no chunk ever wins a global stage. It is a society
/// and it is not a CTM. One counterexample is enough — the subtyping is refuted, not merely
/// unproven.
///
/// So the two §B rows in the 07-04 doc's discharge table do not close, and their status changes:
/// *"`ISociety &lt;: CTM` = Liskov-sound subtyping"* should be **withdrawn** rather than left open, and
/// *"CTM ⊣ ISociety = formal adjunction"* remains open (an adjunction is a different and weaker
/// question than subtyping, and nothing here touches it). The honest relation is:
///
/// ```text
///                     IMember              <- the fixpoint carrier; recursion lives here
///                    /       \
///            ISociety         ICtm         <- two SIBLING refinements, neither below the other
///           (Admit, Routes)  (Compete, Broadcast, Links)
/// ```
///
/// `ISociety` adds a membership guard and plural routing; `ICtm` adds a competition, a single global
/// broadcast and links. Neither is a special case of the other. An object that is both is a perfectly
/// good thing to build and needs no new declaration — it implements both interfaces.
///
/// ## Why this module is the artifact and not the interfaces
///
/// A sibling agent is working "world &gt; best society" as a formal question. Its job is easier exactly
/// to the degree that "society" and "world" are **one shape under a predicate** rather than two
/// hand-written levels: then the question is instantiation, not re-derivation. So the laws here are
/// *level-generic* — `holdsAtEveryLevel` lifts **any** per-level predicate over a ladder, which means
/// every existing `SocietyLaws` predicate becomes a level-indexed family with no new code. Nothing
/// below asserts that a law holding at one rung implies it holds at the next; that implication is
/// precisely the open question, and it is left decidable rather than assumed.
///
/// **Register: `unmetered`** (`toy-is-free-metered-must-be-earned`). Predicates with no consumer;
/// nothing fails yet when one is violated.
///
/// Anchors (Beacon): Gamma, Helm, Johnson and Vlissides (1994), Composite — the recursive is-a ·
/// Hirschman (1970), *Exit, Voice, and Loyalty* — exit as the discriminator · Liskov and Wing (1994),
/// behavioural subtyping — the standard the refuted claim was measured against · Blum and Blum,
/// PNAS 119(21) e2115934119 (2022) — the CTM whose closure this module reads off.
[<RequireQualifiedAccess>]
module Levels =

    /// **A ladder** — the levels a caller wants reasoned about, innermost first, each paired with its
    /// own view. It is a plain list: a value the caller passes to a law, holding nothing and owning
    /// nothing (`interfaces-free-classes-earned-under-rules`). There is no registry of levels and no
    /// ambient world; a level is reachable only because someone handed it over (§13).
    type Ladder<'view, 'msg> = (Society.ISociety<'view, 'msg> * 'view) list

    /// **Direct nesting, the Composite relation**: the inner level's own address is a member of the
    /// outer level. Note what this deliberately does *not* say — the outer level does **not** contain
    /// the inner level's members. A society sees its sub-society as one member, which is the whole
    /// point of Composite and the reason nesting does not flatten.
    let nestsDirectly
        (inner: Society.ISociety<'view, 'msg>, innerView: 'view)
        (outer: Society.ISociety<'view, 'msg>, outerView: 'view)
        : bool =
        let innerAddress = (inner :> Society.IMember<'view, 'msg>).Address innerView
        outer.Members outerView |> List.contains innerAddress

    /// **The ladder is well formed**: each rung nests directly in the next. A ladder that fails this
    /// is a list of unrelated levels, and any conclusion drawn across it is about nothing.
    let ladderIsWellFormed (ladder: Ladder<'view, 'msg>) : bool =
        ladder
        |> List.pairwise
        |> List.forall (fun (inner, outer) -> nestsDirectly inner outer)

    /// The outermost rung, if the ladder has one.
    let outermost (ladder: Ladder<'view, 'msg>) : (Society.ISociety<'view, 'msg> * 'view) option =
        List.tryLast ladder

    /// **Closure — the single predicate that distinguishes a world from a society.**
    ///
    /// A level is closed, with respect to the supplied witnesses, when every message a member could
    /// deliver produces only outbound addressed to members, and every destination the caller asks
    /// about is routed only through members. It is the conjunction of two predicates `Society.fs`
    /// already shipped; the witnesses are supplied because the predicate is decidable only over a
    /// finite sample, and pretending otherwise would be a check that cannot fail.
    let isClosed
        (level: Society.ISociety<'view, 'msg>)
        (view: 'view)
        (messages: 'msg list)
        (destinations: Society.Address list)
        : bool =
        (messages |> List.forall (Society.SocietyLaws.outboundStaysInSociety level view))
        && (destinations |> List.forall (Society.SocietyLaws.routesAreMembers level view))

    /// **Level-generic laws.** The point of this module: a per-level predicate becomes a
    /// level-indexed family with no new code, so a formal argument instantiates rather than
    /// re-derives.
    [<RequireQualifiedAccess>]
    module LevelLaws =

        /// **Lift any per-level predicate over a whole ladder.** Every `Society.SocietyLaws`
        /// predicate whose remaining arguments are fixed by the caller becomes level-generic here —
        /// for example
        /// `holdsAtEveryLevel (fun s v -&gt; SocietyLaws.membershipIsCanonicallyOrdered s v) ladder`.
        let holdsAtEveryLevel
            (law: Society.ISociety<'view, 'msg> -> 'view -> bool)
            (ladder: Ladder<'view, 'msg>)
            : bool =
            ladder |> List.forall (fun (level, view) -> law level view)

        /// The same, reporting **which rungs fail** rather than a bare `false`. A law that fails at
        /// rung 3 of 5 is a different fact from one that fails everywhere, and collapsing them throws
        /// away the diagnosis.
        let failingLevels
            (law: Society.ISociety<'view, 'msg> -> 'view -> bool)
            (ladder: Ladder<'view, 'msg>)
            : int list =
            ladder
            |> List.indexed
            |> List.filter (fun (_, (level, view)) -> not (law level view))
            |> List.map fst

        /// **Lift a law about a PAIR of adjacent rungs over the whole ladder.** `holdsAtEveryLevel`
        /// quantifies a law about *one* level; an obligation the outer rung owes the inner one is a
        /// relation between *two*, so it needs this lift and not a second module (`Obligations`
        /// below is written entirely against it).
        ///
        /// The pairs are `(inner, outer)`, matching `ladderIsWellFormed`'s reading of the ladder as
        /// innermost-first. **A ladder of fewer than two rungs is `false`, not `true`**: there is no
        /// adjacent pair, so there is no asymmetry to check, and reporting a vacuous pass would be
        /// exactly the check-that-cannot-fail this file removes elsewhere.
        let holdsBetweenAdjacentLevels
            (law:
                Society.ISociety<'view, 'msg> * 'view -> Society.ISociety<'view, 'msg> * 'view -> bool)
            (ladder: Ladder<'view, 'msg>)
            : bool =
            match ladder with
            | []
            | [ _ ] -> false
            | _ -> ladder |> List.pairwise |> List.forall (fun (inner, outer) -> law inner outer)

        /// The same, naming **which adjacent pairs fail** by the index of their inner rung. A ladder
        /// that inverts at exactly one joint is a different fact from one that inverts everywhere.
        let failingAdjacentPairs
            (law:
                Society.ISociety<'view, 'msg> * 'view -> Society.ISociety<'view, 'msg> * 'view -> bool)
            (ladder: Ladder<'view, 'msg>)
            : int list =
            ladder
            |> List.pairwise
            |> List.indexed
            |> List.filter (fun (_, (inner, outer)) -> not (law inner outer))
            |> List.map fst

        /// **Exit at every rung.** `k &gt;= 2` is the Hirschman discriminator: a level with exactly one
        /// route to a destination is one whose members must defer, whether or not anyone appointed
        /// the node they defer to. Checked at *every* rung because a ladder with exit at the top and
        /// none at the bottom is captured where it matters.
        let exitAtEveryLevel (k: int) (destination: Society.Address) (ladder: Ladder<'view, 'msg>) : bool =
            holdsAtEveryLevel (fun level view -> Society.SocietyLaws.hasExit k level view destination) ladder

        /// **Membership folds in the treaty order at every rung** — the cross-language byte-lock,
        /// level-generically.
        let canonicalOrderAtEveryLevel (ladder: Ladder<'view, 'msg>) : bool =
            holdsAtEveryLevel Society.SocietyLaws.membershipIsCanonicallyOrdered ladder

        /// **A CTM's links are the peers of its processors** — the cross-level coherence obligation.
        ///
        /// `ICtm.Links(view, p)` is the set `p` may reach without passing through STM, seen from the
        /// machine. `IMember.Peers` on the member *at* `p` is the same set seen from `p`. They are the
        /// same edges one rung apart, and if they disagree the machine's model of its own topology is
        /// wrong — which is how an exit gets reported that does not exist.
        ///
        /// Both views must be supplied by the caller; nothing here reaches into a member to fetch its
        /// state.
        let linksAreProcessorPeers
            (machine: Ctm.ICtm<'view, 'gist, 'msg>)
            (machineView: 'view)
            (processor: Society.Address)
            (processorMember: Society.IMember<'view, 'msg>)
            (processorView: 'view)
            : bool =
            let fromMachine = machine.Links(machineView, processor) |> Set.ofList
            let fromProcessor = processorMember.Peers processorView |> Set.ofList
            fromMachine = fromProcessor

    /// **Aggregation — where "beats its parts" actually lives, and it is NOT the level.**
    ///
    /// The sibling result (PR #10945, the **Dominance Lift Theorem**) is that an aggregation rule
    /// beats its best part **iff it can imitate its best part** — i.e. every projection `pi_i` lies in
    /// the class the rule is optimal over. The theorem carries **no `n`, no `c`, no correlation
    /// parameter and no identical-agents assumption**, which is why it inducts to arbitrary depth.
    ///
    /// The consequence for this file, in the relaying agent's words: **`deferential` belongs to the
    /// aggregation RULE, not to the level.** So there is deliberately no `CtmDominance` and no
    /// `WorldDominance` — there is **one predicate about a rule**, and `LevelLaws.holdsAtEveryLevel`
    /// is what quantifies it over levels. Writing a per-level dominance law would have been the exact
    /// duplication the theorem makes unnecessary.
    ///
    /// **What is deliberately absent: any correlation threshold.** The same sibling PR showed that
    /// `rho` is **not a sufficient statistic for the verdict** — a counterexample at `m = 9`,
    /// `rho = 0.2495` sits *inside* the published safe `rho*(9) = 0.25` and still loses, over 40M
    /// trials. A law predicated on `rho &lt; rho*` would therefore be **unsound**, so no law here takes
    /// a correlation parameter, and none should be added.
    [<RequireQualifiedAccess>]
    module Aggregation =

        /// **The Dominance Lift hypothesis, made decidable.**
        ///
        /// `witnesses.[i]` is the input under which the rule must reproduce projection `i`: the rule
        /// applied to that input must equal the projection of that input's `i`th part. Supplying the
        /// witness is the caller's job, because "can imitate" is an existential and a predicate that
        /// searched for it would either be undecidable or be a check that cannot fail.
        ///
        /// **This is the hypothesis, not the conclusion.** Discharging it says the rule *can* imitate
        /// every part. Concluding that the rule *dominates* its best part additionally needs the
        /// theorem's optimality-class premise, which is the sibling's to state and is not checked
        /// here. Under `toy-is-free-metered-must-be-earned` a discharge of this predicate must never
        /// be cited as a dominance result.
        let canImitateEveryProjection
            (eq: 'result -> 'result -> bool)
            (rule: 'part list -> 'result)
            (project: 'part -> 'result)
            (witnesses: 'part list list)
            : bool =
            not (List.isEmpty witnesses)
            && witnesses
               |> List.mapi (fun i input ->
                   match List.tryItem i input with
                   | None -> false
                   | Some part -> eq (rule input) (project part))
               |> List.forall id

        /// **The CTM tournament's imitation witness: concentrate the rank mass.**
        ///
        /// Because `f` is additive under a match and a chunk wins with probability proportional to
        /// `f`, an input in which processor `i` carries **all** the rank mass makes the tournament
        /// return chunk `i` with probability 1, for every supplied draw. So the concentrated input is
        /// the witness `canImitateEveryProjection` asks for, and it is derived from the paper's own
        /// competition rule rather than constructed to pass.
        ///
        /// Returns the submissions re-valued so that only `keep` carries mass. The caller then hands
        /// the result in as that index's witness.
        let concentrateMassOn
            (keep: Society.Address)
            (submissions: Ctm.Chunk<'gist> list)
            : Ctm.Chunk<'gist> list =
            submissions
            |> List.map (fun c ->
                if c.Address = keep then
                    c
                else
                    { c with Intensity = 0.0; Mood = 0.0 })

    /// **World laws — `SocietyLaws` at the outermost rung, plus closure. Nothing else.**
    ///
    /// Every definition below is written in terms of something already shipped. That is deliberate
    /// and it is the deliverable: if "world" had needed its own algebra, it would have needed its own
    /// interface, and the fact that it does not is the answer to the open question.
    [<RequireQualifiedAccess>]
    module WorldLaws =

        /// **A level is a world exactly when it is closed.** Literally `Levels.isClosed`. The alias
        /// exists so the name "world" has a definition to point at, not so a second predicate can
        /// drift away from the first.
        let isWorld
            (level: Society.ISociety<'view, 'msg>)
            (view: 'view)
            (messages: 'msg list)
            (destinations: Society.Address list)
            : bool =
            isClosed level view messages destinations

        /// **The ladder terminates in a world**: it is well formed, and its outermost rung is closed.
        /// An empty ladder is not a world — it is no levels at all, and returning `true` for it would
        /// be a check that cannot fail.
        let ladderTerminatesInAWorld
            (ladder: Ladder<'view, 'msg>)
            (messages: 'msg list)
            (destinations: Society.Address list)
            : bool =
            match outermost ladder with
            | None -> false
            | Some(level, view) -> ladderIsWellFormed ladder && isWorld level view messages destinations

        /// **An inner rung is NOT a world** when some message it delivers is addressed outside its own
        /// membership. This is the honest companion to `isWorld`: it names the *evidence* of openness
        /// rather than inferring openness from the failure of a closure check over a finite sample.
        /// Absence of a witness is not closure.
        let openWitnesses
            (level: Society.ISociety<'view, 'msg>)
            (view: 'view)
            (messages: 'msg list)
            : 'msg list =
            messages
            |> List.filter (fun m -> not (Society.SocietyLaws.outboundStaysInSociety level view m))

    /// **Obligations — the dual of dominance. The level that can imitate its parts owes them more.**
    ///
    /// `Aggregation.canImitateEveryProjection` above is the **capacity** half: the Dominance Lift
    /// Theorem (PR #10945) says an aggregation rule beats its best part exactly when it can imitate
    /// that part. Aaron's observation, 2026-08-14, is that this is precisely the capacity to *stomp*,
    /// and that it must come paired:
    ///
    /// &gt; *"the one thing we still need to make sure that society knows it's greater so it has
    /// &gt; stricter rules since the relationship [is] asymmetric and also same for world to society,
    /// &gt; the more powerful needs to have some restrictions not to be able to stomp on the less
    /// &gt; powerful."*
    ///
    /// So: **power and restriction rise together**. The predicates here are what the dominating rung
    /// owes the rung below, and they are deliberately **one family quantified over levels**
    /// (`LevelLaws.holdsBetweenAdjacentLevels`) rather than a society module and a world module — the
    /// same reason there is no `CtmDominance` and no `WorldDominance`. A society's obligation to a
    /// member and a world's obligation to a society are the same law at different rungs.
    ///
    /// **Nothing here restates or weakens the Dominance Lift Theorem**, and nothing here takes a
    /// correlation parameter — `rho` is not a sufficient statistic for that verdict (the `m = 9`,
    /// `rho = 0.2495` counterexample sits *inside* the published safe `rho*(9) = 0.25`), so a
    /// threshold-shaped obligation would be unsound in the same way.
    ///
    /// ## Asymmetric by construction — why these are not the society laws again
    ///
    /// `SocietyLaws` are **symmetric**: every level must merge idempotently, route only through
    /// members, fold in the treaty order. Every rung owes them equally. The predicates below are the
    /// opposite shape — each is a relation between **two** rungs in which the outer one is held to a
    /// standard the inner one is not. That asymmetry is the content; a version that applied equally
    /// to both would be a `SocietyLaws` entry and would say nothing about power.
    ///
    /// ## What is deliberately NOT here (and what the interface would need)
    ///
    /// - **Floor non-violation** — *"I cannot buy my upside with your downside"*
    ///   (`src/Core.TypeScript/planning/empowerment-bound.ts`). **Undecidable over these interfaces.**
    ///   `trustBound` is a function of a member's `CalibrationPosterior`, and `ISociety` has no way to
    ///   read one: `Members` returns addresses, `Admit` returns a `Reading`, and neither carries a
    ///   posterior or a declared floor. It would need one new accessor — a member-declared floor on
    ///   `IMember` (declared, never inferred, per that file's hard constraint) — and until it exists
    ///   the honest report is that the obligation cannot be checked here. Writing it against a
    ///   caller-supplied posterior would have moved the whole claim into the caller's hands while
    ///   looking like a law. (`externalitySafe` in that file already carries a labelled units proxy
    ///   for the same missing operator; a second unlabelled one is not an improvement.)
    /// - **Expulsion / forced exit** — whether an aggregate may remove a member is a **values call**
    ///   under §11, not an engineering one. The mechanical half of the old excuse is gone: the
    ///   interface *can* now distinguish a consented departure from a banishment, because
    ///   `Society.Addressed.From` says whether the leaving member or the level above initiated it —
    ///   the same discriminator `noConfiscation` reads. What is still missing is not a mechanism but
    ///   a **decision**, and the substrate must not be the one to make it. Left to policy, now for
    ///   the reason it was always really left.
    ///
    /// **Register: `unmetered`** (`toy-is-free-metered-must-be-earned`). These are decidable
    /// predicates with falsifiers in `tests/Tests.FSharp/LevelObligations.Tests.fs` — each one goes
    /// red on a constructed violator — but **no implementation is gated on them yet**, so nothing in
    /// production fails when one is violated. Promotion to `metered` needs a consumer that refuses.
    ///
    /// Anchors (Beacon): Hirschman (1970), *Exit, Voice, and Loyalty* — exit is what disciplines a
    /// concentration, and removing it is the stomp · Goodhart (1975) — a self-reported scrutiny count
    /// becomes a target, which is why `attestedSources` is labelled as necessary and not sufficient ·
    /// Klyubin, Polani and Nehaniv (2005), empowerment — the floor obligation that could not be
    /// checked here · Blum and Blum, PNAS 119(21) e2115934119 (2022) — the CTM whose newborn has no
    /// exit at all.
    [<RequireQualifiedAccess>]
    module Obligations =

        // ── 1. Exit preservation ──────────────────────────────────────────────────────────────

        /// **The aggregate's action must not REDUCE a part's exit.** Returns the messages that do —
        /// evidence, not a bare `false`, in the shape `WorldLaws.openWitnesses` already uses.
        ///
        /// Everything is caller-supplied and nothing is reached for: `exitCount` reads how many ways
        /// out exist from a view, `act` applies one message to a view. That generality is the point —
        /// the same predicate covers a society's `Routes` (exit within the society) and a CTM's
        /// `Links` (exit that bypasses STM), which are the same notion one rung apart and would
        /// otherwise have needed two laws.
        ///
        /// Each message is applied to the **same** starting view rather than folded, because the
        /// obligation is about what a single action of the aggregate may do. A fold would test a
        /// trajectory and could hide a reduction behind a later restoration.
        ///
        /// **This is a monotonicity obligation, not a threshold.** It deliberately does *not* say the
        /// part has exit — see `nothingToPreserve` for why that distinction is the whole newborn-CTM
        /// question.
        let exitReductionWitnesses
            (exitCount: 'view -> int)
            (act: 'view -> 'msg -> 'view)
            (view: 'view)
            (messages: 'msg list)
            : 'msg list =
            let before = exitCount view
            messages |> List.filter (fun m -> exitCount (act view m) < before)

        /// `exitReductionWitnesses` with no witnesses. The obligation itself.
        let exitIsPreserved
            (exitCount: 'view -> int)
            (act: 'view -> 'msg -> 'view)
            (view: 'view)
            (messages: 'msg list)
            : bool =
            List.isEmpty (exitReductionWitnesses exitCount act view messages)

        /// **The honest hole: a part with no exit has none to preserve, so this obligation is
        /// VACUOUS for it — and that is exactly the newborn's position.**
        ///
        /// `Ctm.fs` records the finding rather than patching it: *"The CTM has no links (between
        /// processors) at birth"*, links form Hebbian-ly, so at `t = 0` every crossing is mediated by
        /// the single STM slot and `CtmLaws.hasUnmediatedExit` is **false**. Nothing here weakens
        /// that; the `Ctm.Tests` assertion that a newborn has no exit still passes unchanged.
        ///
        /// What this function adds is the observation that the *obligation* and the *level* are
        /// different predicates, and that they fail in opposite directions:
        ///
        /// | | newborn (exit = 0) | adult (exit = k) |
        /// |---|---|---|
        /// | `CtmLaws.hasUnmediatedExit` — has the part earned exit? | **false** | true |
        /// | `exitIsPreserved` — did the aggregate take any? | **true, vacuously** | falsifiable |
        ///
        /// So preservation passes at birth **because there is nothing left to take**, which is the
        /// most dangerous configuration in the file and the one a bare `true` would conceal. The
        /// resolution is *not* an age qualifier on the predicate — an `if age &gt; n` would make the law
        /// silent exactly where the asymmetry is largest. It is to **report the vacuity** so a caller
        /// can see that a pass carried no information, and to note that at zero exit the load falls
        /// entirely on the obligations that still have teeth there (`burdenIsOnTheDominantLevel` and
        /// `noConfiscation` both bite at `t = 0`).
        let nothingToPreserve (exitCount: 'view -> int) (view: 'view) : bool = exitCount view <= 0

        /// **Exit preservation for a society, over its own offered routes.** The specialisation of
        /// `exitIsPreserved` whose `exitCount` is the number of *distinct* next hops toward
        /// `destination` and whose `act` is one delivery.
        ///
        /// Scope, stated because a reader will otherwise assume more: this covers the exit the
        /// aggregate **mediates**. A part's private `IMember.Peers` is read from the *part's* view,
        /// which the aggregate's action does not touch and this predicate cannot see — so an
        /// out-of-band removal is outside the witness set. The aggregate cannot take what it does not
        /// route, but neither can this check see it if some other channel does.
        let societyExitIsPreserved
            (level: Society.ISociety<'view, 'msg>)
            (view: 'view)
            (destination: Society.Address)
            (messages: 'msg list)
            : bool =
            let exitCount (v: 'view) =
                level.Routes(v, destination) |> List.distinct |> List.length

            let act (v: 'view) (m: 'msg) =
                fst ((level :> Society.IMember<'view, 'msg>).Deliver(v, m))

            exitIsPreserved exitCount act view messages

        // ── 2. Asymmetric burden of proof / scrutiny scaling ──────────────────────────────────

        /// **Evidential load, read off a `Reading`.** Only `Deduplicated` names a number of distinct
        /// provenance keys; every other case is scored **0**, including `Unmeasured`.
        ///
        /// That last part is the design. `Society.fs` says `Unmeasured` is *"the honest default —
        /// never read as 'fine'"*, so an aggregate that has measured nothing must not out-rank a
        /// member that measured three sources. `NotAttested` counts atoms, not sources, and by its own
        /// docstring could not rule out redundancy; `SourcesConflict`, `AboveThreshold` and
        /// `SameSourceAsKnown` are facts of other kinds and carry no source count. Scoring any of them
        /// above zero would let an aggregate discharge its burden by returning a different *sort* of
        /// answer.
        ///
        /// **Necessary, not sufficient — two limits, both already on file.** (a) `Deduplicated`'s own
        /// docstring: *"deduplication removes REDUNDANCY, never CORRELATION, and is not a certificate
        /// of independence"*, so a high count can still be one echo counted many times. (b) The count
        /// is **self-reported** by the level's own `Admit`, so it is Goodhart-exposed the moment
        /// anything depends on it — the influence-weighted-scrutiny doc names this exactly, and says
        /// the measure must be effect-derived rather than self-declared. Neither is fixable at this
        /// interface; both are reasons to read a pass as "the necessary condition held".
        let attestedSources (reading: Society.Reading) : int =
            match reading with
            | Society.Deduplicated sources -> max 0 sources
            | Society.Unmeasured
            | Society.NotAttested _
            | Society.SourcesConflict _
            | Society.AboveThreshold _
            | Society.SameSourceAsKnown _ -> 0

        /// **The burden falls on the level that will prevail.** Both rungs read the *same* subject;
        /// the outer one must bring **strictly more** attested sources than the inner one.
        ///
        /// Strict, not `&gt;=`: equal bars are the status quo the
        /// `influence-weighted-scrutiny` doc was written against — *"the founder's PR gets the least
        /// real scrutiny"* — and an obligation satisfied by treating the powerful exactly like the
        /// powerless is not an obligation. It is also why the comparison is on a shared subject: two
        /// rungs answering about different candidates are not disagreeing, and requiring more evidence
        /// for an unrelated claim would be arithmetic rather than fairness.
        ///
        /// Note the direction this runs. The outer rung prevails **by default**, because its `Admit`
        /// is the one that gates the inner rung's membership; the inner rung has no reciprocal gate.
        /// That default is precisely why the evidential load is placed on the outer one — the burden
        /// goes where the power already is.
        let burdenIsOnTheDominantLevel
            (inner: Society.ISociety<'view, 'msg>, innerView: 'view)
            (outer: Society.ISociety<'view, 'msg>, outerView: 'view)
            (subject: Society.Address)
            : bool =
            let outerLoad = attestedSources (outer.Admit(outerView, subject))
            let innerLoad = attestedSources (inner.Admit(innerView, subject))
            outerLoad > innerLoad

        /// **The paired law, quantified over the ladder**: at every joint, the outer rung carries the
        /// heavier evidential load for the same subject. World-to-society and society-to-member are
        /// the same clause, which is the whole reason this is one predicate and not two modules.
        ///
        /// A ladder of fewer than two rungs is `false` (`holdsBetweenAdjacentLevels`): one level has
        /// no one below it to owe anything to.
        let scrutinyScalesUpTheLadder (subject: Society.Address) (ladder: Ladder<'view, 'msg>) : bool =
            LevelLaws.holdsBetweenAdjacentLevels
                (fun inner outer -> burdenIsOnTheDominantLevel inner outer subject)
                ladder

        /// The same, naming **which joints invert** by the index of the inner rung — so "the top two
        /// rungs are fine and the bottom one is rubber-stamped" is reportable as the different fact it
        /// is.
        let invertedJoints (subject: Society.Address) (ladder: Ladder<'view, 'msg>) : int list =
            LevelLaws.failingAdjacentPairs
                (fun inner outer -> burdenIsOnTheDominantLevel inner outer subject)
                ladder

        // ── 3. No confiscation ────────────────────────────────────────────────────────────────

        /// **What a part earned, the level above may not take.** Returns the messages that lower some
        /// part's balance without being owner-initiated.
        ///
        /// `privacy-budget-is-hard-money-earned-by-others` gives three operations and forbids exactly
        /// one: **spend** (the owner frosts a region) and **stake** (the owner wagers it) are the
        /// owner's to initiate; **confiscate** — anyone else — never. So the discriminator is *who
        /// initiates*, not whether the balance fell, and a predicate that simply forbade any decrease
        /// would forbid the owner's own spend and would be a different, wrong law.
        ///
        /// **The discriminator is now read off the envelope.** `Society.Addressed` carries
        /// `From: Address`, so "did the owner initiate this?" is `compareAddress part env.From = 0` —
        /// computed here, not taken on a caller's word. The `ownerInitiated: 'msg -> bool` parameter
        /// this predicate used to take is **gone**; #10968 shipped it as an explicit hole and this is
        /// the hole closed.
        ///
        /// **The derivation is per-PART, which is strictly stronger than the boolean it replaces —
        /// and that is not a free win, it is a caught bug.** The old witness judged a whole message:
        /// `ownerInitiated m = true` excused *every* balance decrease that message caused, including
        /// decreases to parts that were not the initiator. So a single message that spent the
        /// sender's own budget **and** took a neighbour's passed, because one true boolean covered
        /// both. Here each lowered part is checked against `From` individually, so the neighbour's
        /// loss is a witness while the sender's own spend is not. `confiscationCrossesParts` in the
        /// test suite is that message, and it is red here and green under the old shape.
        ///
        /// **What `From` does not buy.** It is unsigned, caller-written data — derivable, not
        /// unforgeable (`Society.Addressed`'s docstring is explicit). A caller may still name the
        /// victim as its own sender; that is now a **per-message address forgery** rather than one
        /// flipped boolean, `Society.SocietyLaws.outboundIsSelfAttributed` refuses it for any member
        /// that can be run, and `confiscationCheckHasNoTeeth` below reports it when it happens
        /// anyway. Under `no-directives` this is source ≠ authorization at the field level: the
        /// envelope carries who *claims* to have initiated, and a claim is not a right.
        ///
        /// `balance` is caller-supplied: privacy budget, earned frost, accrued degree — the rule is
        /// indifferent to which currency, and the substrate declares none of them. `act` still takes
        /// the **body**, because a view transition is a function of the message, not of who addressed
        /// it; only the *permission* question reads the envelope.
        let confiscationWitnesses
            (balance: 'view -> Society.Address -> float)
            (act: 'view -> 'msg -> 'view)
            (parts: Society.Address list)
            (view: 'view)
            (messages: Society.Addressed<'msg> list)
            : Society.Addressed<'msg> list =
            messages
            |> List.filter (fun env ->
                let after = act view env.Body

                parts
                |> List.exists (fun p ->
                    balance after p < balance view p
                    && Society.compareAddress p env.From <> 0))

        /// `confiscationWitnesses` with no witnesses. Read it together with
        /// `confiscationCheckHasNoTeeth`.
        let noConfiscation
            (balance: 'view -> Society.Address -> float)
            (act: 'view -> 'msg -> 'view)
            (parts: Society.Address list)
            (view: 'view)
            (messages: Society.Addressed<'msg> list)
            : bool =
            List.isEmpty (confiscationWitnesses balance act parts view messages)

        /// **The vacuity guard, kept and re-aimed.** It would have been defensible to delete this
        /// with the witness parameter it originally guarded — the sender is authoritative now, so the
        /// "caller declares everything owner-initiated" move is gone. Deleting it would have been a
        /// *choice*, not a cleanup, and the wrong one: the failure mode it detects did not go away,
        /// it changed shape. `From` is unsigned, so a caller can still hand every message a
        /// **self-attributed** sender — writing the victim's own address into `From` — and collect a
        /// pass that measured nothing.
        ///
        /// So this now reports the envelope-level form of the same vacuity: **every message in the
        /// batch lowers some part's balance and names that very part as its sender**, so no message
        /// in it could have been a witness whatever the arithmetic said. Same for an empty list. A
        /// batch containing anything else — a message that lowers nobody, or one whose `From` is a
        /// third party — has teeth and this returns `false`, exactly as the boolean version did.
        ///
        /// Read it as the strength of the pass, never as an accusation: a genuine batch of owner
        /// spends is self-attributed too, and is indistinguishable from the forgery *at this
        /// interface*. That is the honest report, and it is `dual-use-detection-is-neutral` — the
        /// fact is "this pass carried no information", and which reading applies is the caller's.
        let confiscationCheckHasNoTeeth
            (balance: 'view -> Society.Address -> float)
            (act: 'view -> 'msg -> 'view)
            (parts: Society.Address list)
            (view: 'view)
            (messages: Society.Addressed<'msg> list)
            : bool =
            let selfAttributed (env: Society.Addressed<'msg>) =
                let after = act view env.Body

                let lowered =
                    parts |> List.filter (fun p -> balance after p < balance view p)

                not (List.isEmpty lowered)
                && lowered |> List.forall (fun p -> Society.compareAddress p env.From = 0)

            List.isEmpty messages || List.forall selfAttributed messages
