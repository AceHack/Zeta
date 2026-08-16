namespace Zeta.Core

open System

/// **`Society` — `IMember` ⊣ `ISociety`: the two faces of one membrane. DECLARATION ONLY.**
///
/// `ISociety` / `IWorld` have been named across ~8 docs since 2026-06 with **no `interface` or
/// `type` definition anywhere in `src/`** (verified 2026-08-16: `rg "ISociety|IWorld" src/` → 0
/// hits). Aaron's reason for the gap is on the record — *"we've not had a use for it yet"* — and
/// his authorization to close it names the uses that arrived: a GitHub-Actions society of small
/// LLMs in runner RAM, CHIP-8/Atari play, LLMTV, and other-LLM agents attaching. This module is
/// the **declaration**, not the society: no implementation, no transport wiring, no BNN change.
///
/// ## What determines the shape (each clause below is generalised from working code, not invented)
///
/// | Clause | Generalised from |
/// |---|---|
/// | `Deliver` returns `(view × outbound)` and performs no I/O | `SybilBftProtocol.receive` — a pure DU reducer, explicitly transport-agnostic |
/// | `Merge` is a CRDT join | `GossipTelemetry.merge` (set-union both sides) · `Attested.admit` (bounded join-semilattice) |
/// | `Members` are **routing addresses**, never provenance | `ReferenceFrameAgent.Id` — *"A routing address, never a provenance id"* |
/// | `Admit` returns a neutral **reading**, never a verdict | `SocietyBootstrap.SocietyRefusal` · `GossipTelemetry.Plausibility` |
/// | `Routes` is plural | manifesto §11 read as topology: deference must have >1 independently accrued peak |
/// | address ordering routes through the collation treaty | `Collation.binary` (F#) ≡ `collation.ts stringCompare` (TS) |
///
/// ## Weight-free: interfaces only, and why that is load-bearing here
///
/// Both faces are **pure interfaces — abstract members over caller-supplied values, zero instance
/// state** (`interfaces-free-classes-earned-under-rules`). This is not a style preference. A class
/// would hold society state, and held state is weight ⇒ capture ⇒ exactly the permanent hierarchy
/// §3 forbids. The precedent in-repo is `SoftScheduler.fs`: *"Pure module + one free interface
/// (interfaces free, classes earned under rules/); no classes."* Same discipline, same reason.
///
/// ## Transport-agnostic by CONSTRUCTION, not by convention
///
/// `Deliver` **returns** the messages to send; it never sends them. So there is no transport
/// parameter to abstract over and no transport type to name — a transport cannot leak in, because
/// the interface has no door for one. The several transports that could back propagation
/// (`OracleTransport.ITransport`, the git-native agent-bus G-Set, the /tmp local bus, the UDP
/// `[8,4,4]` lossy transport) all sit strictly *outside* this boundary, and new ones need no change
/// here. This is also the §13 noninterference door: a member reaching the society only through an
/// injected `ISociety` has no ambient path to it — there is deliberately no static society, no
/// global registry, and no module-level mutable state in this file.
///
/// ## No mediating hub (manifesto §1; and the IP boundary)
///
/// `Routes` returns candidate next hops **drawn from the society's own membership**, so there is no
/// broker slot in the type for anyone to fill. Emergent concentration is permitted and expected
/// (Barabási–Albert preferential attachment); an *appointed* broker is not. The discriminator is
/// **exit** — `SocietyLaws.hasExit` below is that question made checkable, per Hirschman (1970).
///
/// ## Honest scope — what this file does NOT establish
///
/// `docs/research/2026-07-04-tick-sources-strange-attractors-eve-ks-entropy-ctm-isociety-connections.md`
/// §4 states **`ISociety <: CTM`, recursively** (`μX. CTM-over-X`, the Composite pattern). **CTM has
/// no definition in `src/` either** (verified: 0 hits). So the fixpoint cannot be *typed* against a
/// CTM contract that does not exist. What is declared here is the weaker, honest statement:
/// `ISociety` inherits `IMember`, so a society **is-a** member and can be nested in another society
/// without a special case. `IMember` is the *membrane face* the doc calls CTM — it is **not** the
/// full Blum–Blum–Blum Conscious Turing Machine contract (LTM/STM competition, the global broadcast
/// channel, sleeping experts), none of which is declared. The two §B open rows in that doc —
/// "CTM ⊣ ISociety = formal adjunction" and "ISociety <: CTM = Liskov-sound subtyping" — remain
/// **open**; nothing here discharges them, and `ISociety <: IMember` must not be cited as if it did.
///
/// Anchors (Beacon): Shapiro et al. (2011) CRDTs — the `Merge` laws · Gamma et al. (1994) Composite
/// — the recursive is-a · Hirschman (1970) *Exit, Voice, and Loyalty* — exit disciplines
/// concentration · Barabási–Albert (1999) — emergent, unappointed hubs · Goguen–Meseguer (1982)
/// noninterference — the injected-only door · Blum, Blum & Blum (2021) CTM — the contract this file
/// deliberately does not claim to meet.
module Society =

    /// A member's **routing address**: where messages go, never who someone is.
    ///
    /// `docs/writer-actor-routing-model.md` and `shared-checkout-is-view-only` both carry the same
    /// carved line — *"A bus/routing address is not identity"* — and `ReferenceFrameAgent.Id` says it
    /// at the field. Kept as a single-case DU so an address can never be silently interchanged with a
    /// provenance/source id: conflating them is the failure
    /// `dual-use-detection-is-neutral-oracle-decides` names in its functional half (recognising
    /// sameness is not assigning identity).
    [<Struct>]
    type Address = Address of string

    /// **Reachable only from inside this file** — use `Society.compareAddress` /
    /// `Society.canonicalSortAddresses` below from anywhere else, and see the note there for why.
    [<RequireQualifiedAccess>]
    module Address =

        /// The raw routing string.
        let value (Address a) : string = a

        /// **The collation treaty, applied to addresses.** Delegates to `Collation.binary` — Unicode
        /// code-point order (≡ UTF-8 byte order), the ordering every oracle and every golden vector
        /// conforms to. NOT `Comparer<string>.Default`, NOT `String.CompareOrdinal` (that is UTF-16
        /// code-unit order and disagrees on non-BMP), NOT any linguistic collation.
        ///
        /// The TypeScript mirror is `stringCompare` in `src/Core.TypeScript/collation/collation.ts`,
        /// which walks code points via spread. Same order, both languages, astral planes included.
        let compare (a: Address) (b: Address) : int =
            Collation.binary.Compare(value a, value b)

        /// Canonical order for any address set that enters a fold. Any society-level fold that sorts
        /// members MUST sort through here, or TS and F# can order the same membership differently and
        /// the byte-lock is gone.
        let canonicalSort (addresses: Address seq) : Address list =
            addresses |> Seq.sortWith compare |> List.ofSeq

    /// **The treaty comparator, as a name that actually resolves.**
    ///
    /// `Society.Address.compare` does **not** compile from any other file, and the reason is a name
    /// collision that is invisible at the declaration site: `Address` is a union **case constructor**
    /// as well as a type and a module, so the path `Society.Address` binds to the case and the module
    /// is shadowed. Verified directly against the built assembly on 2026-08-16 by the first consumer
    /// (`Ctm.fs`): `error FS0039: The field, constructor or member 'compare' is not defined`.
    ///
    /// That made every "MUST sort through `Address.canonicalSort`" instruction in this file
    /// unfollowable outside it — a check nobody could run. These two functions are the reachable
    /// surface; they delegate, so there is one implementation and no second place to drift. They also
    /// carry the **same names as the TypeScript mirror** (`compareAddress`,
    /// `canonicalSortAddresses` in `society.ts`), which is how it should have read from the start.
    let compareAddress (a: Address) (b: Address) : int = Address.compare a b

    /// Canonical order for any address set entering a fold. The reachable name for
    /// `Address.canonicalSort`; see `compareAddress` for why the alias exists.
    let canonicalSortAddresses (addresses: Address seq) : Address list = Address.canonicalSort addresses

    /// An **addressed** outbound message. The recipient is an `Address` drawn from the society's own
    /// membership — there is no `Via`, no `Broker`, no `Hub` field, and that absence is the design.
    ///
    /// ## `From` — the sender, added because a law needed it and could not compute it
    ///
    /// `Levels.Obligations.noConfiscation` states the hard-money rule — **spend** and **stake** are
    /// the owner's to initiate, **confiscate** by anyone else never — and its entire discriminator is
    /// *who initiates*, not whether a balance fell. With `To`/`Body` only, that question was not
    /// readable from the substrate, so the predicate took a caller-supplied `ownerInitiated: 'msg ->
    /// bool` witness and had to ship `confiscationCheckHasNoTeeth` alongside it to report when a
    /// caller had talked the check out of existence. `From` makes the discriminator **derivable from
    /// the envelope**, and the witness parameter is gone.
    ///
    /// **What this does NOT do — stated because the field is easy to over-read.** `From` is
    /// *asserted data, not authentication*: nothing in this interface signs it, so a constructing
    /// caller may write any address it likes. What changed is the shape of the lie, not its
    /// possibility — a caller must now forge a **specific address per message**, which is inspectable
    /// (`SocietyLaws.outboundIsSelfAttributed` refuses a member that stamps someone else's address on
    /// its own outbound) and reportable (`confiscationCheckHasNoTeeth` survives, re-aimed at exactly
    /// the self-attributed/forged case). Derivable ≠ unforgeable, and only the first was claimed.
    ///
    /// **The asymmetry that remains, named rather than papered over.** The envelope is the
    /// **outbound** shape: `Deliver` *returns* `Addressed<'msg>` but *takes* a bare `'msg`. So a
    /// member folding a delivered message still cannot see who sent it — delivery drops the envelope.
    /// Obligations stated over what an aggregate **emits** are now self-contained; anything stated
    /// over what a member **received** is not, and closing that would mean changing `Deliver`'s
    /// argument to an envelope. That is a larger interface change and is deliberately not made here.
    type Addressed<'msg> =
        {
          /// The sender's routing address — **who initiated this message**, never a provenance id and
          /// never a proof (see the type's docstring: asserted, unsigned, forgeable-but-inspectable).
          From: Address
          To: Address
          Body: 'msg }

    /// What a society is entitled to **report** about a candidate or a member.
    ///
    /// Every case names a **fact**; none names a verdict (`dual-use-detection-is-neutral-oracle-decides`).
    /// There is deliberately no `BadActor`, no `Sybil`, no `Forger` — reunion-vs-conviction is caller
    /// policy under §11, and baking the adversarial reading in would both pre-judge a morally-relevant
    /// call and throw away the legitimate half of the mechanism. This generalises the two refusal
    /// vocabularies already in the tree: `SocietyBootstrap.SocietyRefusal` and
    /// `GossipTelemetry.Plausibility`.
    ///
    /// Aaron's framing of the need: *"we can't fully block non mutual empowerment actions in the
    /// interface, then we will need some sort of society guard."* The guard's **place** is declared
    /// here; the guard's **policy** deliberately is not.
    type Reading =
        /// Nothing has been measured. The honest default — never read as "fine".
        | Unmeasured
        /// The evidence names `sources` distinct provenance keys, none counted twice. Bookkeeping only:
        /// deduplication removes REDUNDANCY, never CORRELATION, and is not a certificate of independence.
        | Deduplicated of sources: int
        /// `atoms` pieces of evidence named no source, so redundancy could not be ruled out.
        | NotAttested of atoms: int
        /// One source arrived carrying conflicting messages.
        | SourcesConflict of keys: string list
        /// A named metric crossed a named threshold. The metric and the number, not their meaning.
        | AboveThreshold of metric: string * value: float * threshold: float
        /// This candidate's evidence stream matches one already known. **Reunion and Sybil are the two
        /// honest readings of exactly this fact**; the interface reports the fact and refuses to choose.
        | SameSourceAsKnown of other: Address

    /// **`IMember` — the face a participant presents to its society** (the membrane seen from
    /// outside; the doc's "CTM" side, with the honest-scope caveat in the module header).
    ///
    /// `'view` is the participant's local state, supplied by the caller and returned transformed —
    /// the interface **holds nothing**. `'msg` is the protocol union: Aaron's standing constraint is
    /// that **logic lives in the DUs, not in the model**, so `'msg` is expected to be a discriminated
    /// union whose cases carry the protocol (as `SybilBftProtocol.Message` and `GossipTelemetry.Rumor`
    /// already do), and `Deliver` is expected to be a `match`.
    ///
    /// **Massively parallel by construction:** every member is a pure function of
    /// `(view, msg) → (view, outbound)` with no shared mutable state, no locks, and no I/O — so N
    /// members fold independently. `SybilBftProtocol` already states the consequence this preserves:
    /// the same reducer runs as a CPU algebra in production *and* on a GPU for DST, with cross-warp
    /// shuffle standing in for the networked fan-out. Nothing declared here is anything a shader
    /// cannot run.
    type IMember<'view, 'msg> =

        /// This member's routing address, as read from its own view.
        abstract member Address: view: 'view -> Address

        /// **The reducer.** Fold one delivered message into the local view and return the view plus
        /// the messages to send. Pure: no sockets, no `Task`, no clock, no ambient anything.
        ///
        /// At DoP=1 a single cooperative loop folds an inbox in a replayable order (DST §7); at DoP=N
        /// a ferry drains the same queue. Same code path, no special case — exactly
        /// `SybilBftProtocol.receive` / `receiveAll` generalised.
        abstract member Deliver: view: 'view * message: 'msg -> 'view * Addressed<'msg> list

        /// **CRDT join** of two views of the same member (commutative, associative, idempotent —
        /// see `SocietyLaws`). This is what makes redelivery, partial replay, and reconciliation after
        /// partition safe (§12 idempotency), and it is the operation `Attested.admit` and
        /// `GossipTelemetry.merge` already implement at their own scales.
        abstract member Merge: left: 'view * right: 'view -> 'view

        /// The peers this member can address **directly**, without anyone's permission. Non-empty is
        /// what makes exit real; see `SocietyLaws.hasExit`.
        abstract member Peers: view: 'view -> Address list

    /// **`ISociety` — the face the environment presents to a member** (the same membrane, seen from
    /// inside). `inherit IMember` is the recursion: a society **is-a** member, so societies nest with
    /// no special case (Composite). Read the module header before citing this as the `ISociety <: CTM`
    /// fixpoint — it is strictly weaker, and the §B rows stay open.
    type ISociety<'view, 'msg> =
        inherit IMember<'view, 'msg>

        /// Current membership, as addresses. Callers that fold over this MUST order it through
        /// `Address.canonicalSort`.
        ///
        /// Deliberately **not** a closed union. The existing `AgentId` in
        /// `src/Core.TypeScript/bus/types.ts` is a hardcoded roster of persona strings, which cannot
        /// admit a small LLM that exists for the 6 minutes of a GitHub Actions run — one of the very
        /// uses this declaration is for. Membership is data.
        abstract member Members: view: 'view -> Address list

        /// **The society guard's place.** Report the neutral fact about a candidate or member; the
        /// caller's oracle attaches the meaning. Returning `Reading` rather than `bool` is the whole
        /// point: a `bool` would have already decided.
        abstract member Admit: view: 'view * candidate: Address -> Reading

        /// Candidate next hops toward a destination — **plural, and drawn from `Members`**. A single
        /// mandatory next hop for every destination is a mediating hub whether or not anyone appointed
        /// it; plurality here is §11 stated as topology.
        abstract member Routes: view: 'view * destination: Address -> Address list

    /// **The laws — stated so a property test or a proof can be pointed at them.**
    ///
    /// This module is why the F# exists and is not a port of the TypeScript: these are the algebraic
    /// obligations an implementation must discharge, written as decidable predicates over
    /// caller-supplied witnesses. Each takes an explicit equality so the caller chooses the
    /// observational equivalence — no structural equality is assumed on `'view`.
    ///
    /// Nothing here is a proof, and no implementation is being asserted to satisfy any of it. Under
    /// `toy-is-free-metered-must-be-earned` these predicates are **unmetered** until something fails
    /// when they are violated.
    [<RequireQualifiedAccess>]
    module SocietyLaws =

        /// `merge v v = v` — idempotent (§12). Redelivery is free.
        let mergeIdempotent (eq: 'view -> 'view -> bool) (m: IMember<'view, 'msg>) (v: 'view) : bool =
            eq (m.Merge(v, v)) v

        /// `merge a b = merge b a` — commutative. Arrival order cannot change the state.
        let mergeCommutative (eq: 'view -> 'view -> bool) (m: IMember<'view, 'msg>) (a: 'view) (b: 'view) : bool =
            eq (m.Merge(a, b)) (m.Merge(b, a))

        /// `merge (merge a b) c = merge a (merge b c)` — associative. Grouping cannot change it either.
        let mergeAssociative
            (eq: 'view -> 'view -> bool)
            (m: IMember<'view, 'msg>)
            (a: 'view)
            (b: 'view)
            (c: 'view)
            : bool =
            eq (m.Merge(m.Merge(a, b), c)) (m.Merge(a, m.Merge(b, c)))

        /// **Delivery commutes under merge**: folding `x` then `y` merges to the same view as folding
        /// `y` then `x`. This is the convergence property the whole substrate rests on — and it is
        /// where `local-time-never-enters-the-shared-fold` bites: a `Deliver` that consulted a local
        /// wall clock would break this for two nodes with different receive times, and the failure
        /// would show up as divergence, not as an error.
        let deliveryCommutes
            (eq: 'view -> 'view -> bool)
            (m: IMember<'view, 'msg>)
            (v: 'view)
            (x: 'msg)
            (y: 'msg)
            : bool =
            let vx, _ = m.Deliver(v, x)
            let vxy, _ = m.Deliver(vx, y)
            let vy, _ = m.Deliver(v, y)
            let vyx, _ = m.Deliver(vy, x)
            eq (m.Merge(vxy, vyx)) (m.Merge(vyx, vxy))

        /// **No mediating hub**: every route the society offers is a member of the society. A hop that
        /// is not a member is an outside broker, which is the shape §1 forbids and the shape the
        /// Itron hub-and-agent claims cover.
        let routesAreMembers (s: ISociety<'view, 'msg>) (v: 'view) (destination: Address) : bool =
            let members = s.Members v |> Set.ofList
            s.Routes(v, destination) |> List.forall (fun hop -> Set.contains hop members)

        /// **Exit is real**: at least `k` independently reachable next hops toward a destination.
        /// `k = 1` only says a path exists; **`k >= 2` is the property that makes deference a choice**
        /// rather than a capture (Hirschman). Concentration was never the defect — being unable to
        /// route around it is.
        let hasExit (k: int) (s: ISociety<'view, 'msg>) (v: 'view) (destination: Address) : bool =
            s.Routes(v, destination) |> List.distinct |> List.length >= max 1 k

        /// **Every outbound message is addressed to a member.** A member cannot smuggle in an external
        /// recipient the society never admitted.
        let outboundStaysInSociety (s: ISociety<'view, 'msg>) (v: 'view) (message: 'msg) : bool =
            let members = s.Members v |> Set.ofList
            let _, outbound = (s :> IMember<'view, 'msg>).Deliver(v, message)
            outbound |> List.forall (fun o -> Set.contains o.To members)

        /// **A member stamps its OWN address on its outbound.** Every envelope `Deliver` returns must
        /// carry `From = Address view` — a member that stamps a peer's address on its own outbound is
        /// impersonating that peer, and the hard-money rule reads `From` to decide whether a balance
        /// decrease was a permitted **spend** or a forbidden **confiscation**. So this is the guard
        /// that keeps `From` worth reading.
        ///
        /// It is **not** authentication and must not be cited as any: it is decidable only for a
        /// member you can *run*, and it says nothing about an envelope that arrived over a wire from
        /// something you cannot. Signing is a transport-layer concern and this interface deliberately
        /// has no transport. What this buys is that impersonation is a **law violation** with a
        /// falsifier rather than an unremarked possibility — the same standing as
        /// `outboundStaysInSociety`, which likewise catches a smuggled recipient without preventing
        /// one.
        let outboundIsSelfAttributed (m: IMember<'view, 'msg>) (v: 'view) (message: 'msg) : bool =
            let self = m.Address v
            let _, outbound = m.Deliver(v, message)
            outbound |> List.forall (fun o -> compareAddress o.From self = 0)

        /// **The membership fold is collation-stable**: sorting the membership yields the byte-locked
        /// canonical order. The TS mirror must produce the identical sequence; if it cannot, the
        /// cross-language byte-lock is broken and that must be named, not hoped away.
        let membershipIsCanonicallyOrdered (s: ISociety<'view, 'msg>) (v: 'view) : bool =
            let members = s.Members v
            members = Address.canonicalSort members
