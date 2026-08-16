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
