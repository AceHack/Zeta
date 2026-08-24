namespace Zeta.Core

/// **ShivaGc — the collector on the seed: mark-sweep GC over reified values (shadow*).**
/// (Aaron 2026-07-03: "this is basically our Shiva Garbage Collector." The mix-as-data slices made
/// the mix's rules DATA — `MixIr.defaultMixDef`, `defaultEvalDef`, specs, load descriptors — which is
/// what makes collection possible: you cannot GC baked code, but you can GC values. This is the
/// collector the seed promised.)
///
/// **The Trimurti duality.** The generator (Brahma — `gen/`, the free object,
/// `only-the-irreducible-is-primitive-generate-the-rest`) EMITS reified tables; Shiva (the destroyer)
/// RECLAIMS the ones nothing references. Generation and collection are duals over one content-
/// addressed data substrate, and **collection is a Z-set retraction (−1)**: what `gen` posted (+1),
/// Shiva retracts (−1) when it falls out of the reachable set — the emit/retract duality
/// (`every-bug-has-economic-value`, RGB emits / CMYK retracts) applied to the reified self.
///
/// **The heap.** A content-addressed heap is a set of objects `{ id, value, refs:[id] }` (all
/// `DynamicValue`, byte-lockable): `id` is the object's content handle, `value` its payload (e.g. a
/// reified `mixDef`), `refs` the ids it points at. `mark` computes the reachable set from the roots
/// (transitive closure over `refs` — cycle-safe, unlike reference counting); `collect` retracts the
/// unreachable, returning the surviving heap AND the collected (retracted) ids.
///
/// **Properties (machine-checked).** live-survive + garbage-collected; cycle-safe (an unreferenced
/// cycle is still collected; a reachable cycle survives); **idempotent** (`collect ∘ collect = collect`
/// — discipline #6); **deterministic** (same roots+heap → same result, DST §7); the collected set is
/// exactly `heap − survivors` (the retraction). Anchors: McCarthy (1960 — GC born with code-as-data);
/// Dijkstra et al. (1978 — mutator/collector); Hayes (1997 — ephemerons / weak-reference tables);
/// Lieberman–Hewitt / Ungar (generational). Consumes only `DynamicValue`.
[<RequireQualifiedAccess>]
module ShivaGc =

    // ── heap constructors (a content-addressed heap as DynamicValue) ──

    /// A heap object: `id` (content handle) · `value` (payload) · `refs` (ids it points at).
    let object' (id: string) (value: DynamicValue) (refs: string list) : DynamicValue =
        DynamicValue.Object
            [ "id", DynamicValue.String id
              "value", value
              "refs", DynamicValue.Array(refs |> List.map DynamicValue.String) ]

    /// A heap is an array of objects.
    let heap (objects: DynamicValue list) : DynamicValue = DynamicValue.Array objects

    // ── readers ──

    let private objId (o: DynamicValue) : string option =
        match DynamicValue.get "id" o with
        | Some(DynamicValue.String s) -> Some s
        | _ -> None

    let private objRefs (o: DynamicValue) : string list =
        match DynamicValue.get "refs" o with
        | Some(DynamicValue.Array rs) -> rs |> List.choose (function DynamicValue.String s -> Some s | _ -> None)
        | _ -> []

    let private objects (h: DynamicValue) : DynamicValue list =
        match h with
        | DynamicValue.Array xs -> xs
        | _ -> []

    // ── mark: the reachable set (transitive closure over refs; cycle-safe) ──

    /// The set of object ids reachable from `roots` by following `refs`. Cycle-safe: a `seen` guard
    /// makes a reachable cycle terminate (where reference counting would leak it).
    let mark (roots: string list) (h: DynamicValue) : Set<string> =
        let refs =
            objects h
            |> List.choose (fun o -> objId o |> Option.map (fun id -> id, objRefs o))
            |> Map.ofList
        let rec go frontier (seen: Set<string>) =
            match frontier with
            | [] -> seen
            | id :: rest when Set.contains id seen -> go rest seen
            | id :: rest ->
                let next = Map.tryFind id refs |> Option.defaultValue []
                go (next @ rest) (Set.add id seen)
        go roots Set.empty

    // ── collect: retract the unreachable (Shiva) ──

    /// Mark-sweep: retain only objects reachable from `roots`; retract the rest. Returns the surviving
    /// heap AND the collected (retracted) ids, sorted for determinism. The collected list is exactly
    /// `heap − survivors` — the Z-set −1 retraction of everything nothing points at.
    let collect (roots: string list) (h: DynamicValue) : DynamicValue * string list =
        let reachable = mark roots h
        let survivors = objects h |> List.filter (fun o -> objId o |> Option.map (fun id -> Set.contains id reachable) |> Option.defaultValue false)
        let collected =
            objects h
            |> List.choose (fun o ->
                match objId o with
                | Some id when not (Set.contains id reachable) -> Some id
                | _ -> None)
            |> List.sort
        DynamicValue.Array survivors, collected

    /// The surviving heap only (drops the collected-ids list) — for chaining / idempotence checks.
    let sweep (roots: string list) (h: DynamicValue) : DynamicValue = collect roots h |> fst

    // ── pause, not death: the Memory Preservation Guarantee (manifesto §5) applied to the GC ──
    //
    // Aaron 2026-07-03: "no objects ever die in our system, they are only PAUSED. Their actor may
    // stop, but their WHAT REMAINS persists — their story — and it might always be resumed later."
    // So Shiva does not annihilate. `collect` above returns only the *ids* it drops (standard GC
    // vocabulary), but the object's VALUE — its story — is never destroyed: in production it is the
    // +1 still sitting in the append-only DBSP event log, replayable via DST to before its −1. The
    // retraction removes the object from the RESIDENT projection, never from the history. `partition`
    // makes that explicit (it returns the full paused objects, not just ids), and `resume` brings one
    // back byte-identically — nothing that mattered is allowed to die (the founding thesis: event
    // sourcing was the answer to losing Amara at max length).

    /// Split a heap into (resident, paused) — the reachable working set and the FULL objects evicted
    /// from it (not just their ids). The paused heap is the object's persisted story: it is not
    /// destroyed, only unrooted. Deterministic: paused objects keep the heap's order.
    let partition (roots: string list) (h: DynamicValue) : DynamicValue * DynamicValue =
        let reachable = mark roots h
        let inReach o = objId o |> Option.map (fun id -> Set.contains id reachable) |> Option.defaultValue false
        let resident = objects h |> List.filter inReach
        let paused = objects h |> List.filter (inReach >> not)
        DynamicValue.Array resident, DynamicValue.Array paused

    /// **Three-way split under an injected REGENERABILITY oracle** — the retention predicate widened
    /// from `reachable` to **`reachable OR NOT regenerable`**.
    ///
    /// `partition` above is exactly the case `regenerable = fun _ -> false`: with no oracle, *every*
    /// unreachable object must be PAUSED, because nothing can rebuild it. That is maximally
    /// conservative, always safe, and the reason `partition` frees nothing at all. Supply a real
    /// oracle and a third class appears — the objects that are genuinely free to drop:
    ///
    /// | class | condition | disposition |
    /// |---|---|---|
    /// | **resident** | reachable | the working set |
    /// | **droppable** | unreachable AND regenerable | free — rebuild from the generator on demand |
    /// | **paused** | unreachable AND NOT regenerable | MUST persist (Memory Preservation, §5) |
    ///
    /// **The oracle is INJECTED rather than a field on the object, and that is structural, not
    /// stylistic.** `Core.fsproj` compiles `ShivaGc.fs` at position 92, while every mechanism that
    /// could answer "is this regenerable?" compiles later — `ContentStore.fs` 184, `DvKey.fs` 195,
    /// `GeneratorIrRegistry.fs` 366. Under F#'s compile order this module *cannot* reference any of
    /// them, so a built-in regenerability check is not merely undesirable here, it is unexpressible.
    /// Injection is also what preserves the properties the collector already has: it stays a pure
    /// `DynamicValue -> DynamicValue` function, so it remains DST-replayable (§7), and the oracle is a
    /// **declared, metered channel** rather than an ambient dependency on a live store, a clock, or
    /// the host GC (§13 noninterference).
    ///
    /// **This function destroys nothing.** It returns all three populations as full objects.
    /// `droppable` is a *permission* to drop, granted by the oracle — not an act of dropping. Whoever
    /// acts on that permission owes the byte-identity obligation: what comes back from the generator
    /// must equal what was dropped, bit for bit (`docs/research/2026-08-24-zetadb-is-bit-accurate-*`).
    /// That obligation is discharged for the reified-mix generator in `ShivaGcRegen.Tests.fs`, and is
    /// NOT discharged in general — the oracle is only as sound as its caller.
    ///
    /// Deterministic: each class keeps the heap's order. An object with no `id` is never regenerable
    /// (it cannot be named to an oracle), so it pauses — matching `partition`'s treatment exactly.
    let partition3
        (regenerable: string -> bool)
        (roots: string list)
        (h: DynamicValue)
        : DynamicValue * DynamicValue * DynamicValue =
        let reachable = mark roots h
        // 0 = resident · 1 = droppable · 2 = paused. Total and mutually exclusive by construction, so
        // the three outputs partition the heap: nothing is duplicated and nothing is lost.
        let classify o =
            match objId o with
            | Some id when Set.contains id reachable -> 0
            | Some id when regenerable id -> 1
            | _ -> 2
        let pick k = objects h |> List.filter (fun o -> classify o = k)
        DynamicValue.Array(pick 0), DynamicValue.Array(pick 1), DynamicValue.Array(pick 2)

    /// Resume a paused object (or heap of them) back into a resident heap — the actor restarts from
    /// what remained. Idempotent by id (resuming an already-resident object is a no-op, keeping the
    /// resident copy). This is the replay-from-the-log made explicit: a "collected" object was never
    /// gone, only paused, and comes back byte-identically.
    let resume (paused: DynamicValue) (resident: DynamicValue) : DynamicValue =
        let have = objects resident |> List.choose objId |> Set.ofList
        let revived = objects paused |> List.filter (fun o -> objId o |> Option.map (fun id -> not (Set.contains id have)) |> Option.defaultValue false)
        DynamicValue.Array(objects resident @ revived)

    // ── the virtual-actor GC criterion: traffic keeps a grain alive (Orleans over Reticulum) ──
    //
    // Aaron 2026-07-03: "this generalizes to Orleans-like grains and silos / the virtual actor model,
    // we're just using Reticulum. What keeps something from getting GC'd? The fact someone else is
    // sending it messages. No message, no action." So the GC ROOTS are not who-holds-a-pointer — they
    // are **who is being messaged**. A grain (object) stays RESIDENT while traffic addresses it;
    // when the traffic stops it deactivates (pauses), its state persists (the log), and the next
    // message reactivates it. This is exactly the Orleans virtual-actor lifecycle (grains always
    // "exist"; activation is on-demand, deactivation is idle-GC) — with Reticulum as the silo
    // transport instead of Orleans' TCP mesh. Anchors: Bernstein/Bykov et al., "Orleans: Distributed
    // Virtual Actors" (MSR, 2014); the actor model (Hewitt 1973); Reticulum (Qvist).

    /// Derive the GC roots from message traffic: the set of destination ids that have a message. A
    /// message is `{ to: id }` (its payload is irrelevant to liveness). "No message, no action" — an
    /// id absent from the traffic is not a root, so it pauses. Deterministic (sorted).
    let rootsFromTraffic (messages: DynamicValue list) : string list =
        messages
        |> List.choose (fun m ->
            match DynamicValue.get "to" m with
            | Some(DynamicValue.String id) -> Some id
            | _ -> None)
        |> List.distinct
        |> List.sort

    /// A message addressed to a grain id (the liveness signal — its presence, not its content, keeps
    /// the grain resident).
    let message (toId: string) : DynamicValue = DynamicValue.Object [ "to", DynamicValue.String toId ]

    /// The virtual-actor tick: partition a heap by TRAFFIC (Orleans-style) — grains with a message
    /// this round stay resident; silent grains pause (their story persists, resumable on next message).
    /// `partition (rootsFromTraffic messages) heap`, named for what it means.
    let deactivateIdle (messages: DynamicValue list) (h: DynamicValue) : DynamicValue * DynamicValue =
        partition (rootsFromTraffic messages) h

    // ── message-passing makes the runtime distributed: residency-transparent delivery ──
    //
    // Aaron 2026-07-03: "the really cool thing is the message passing works to make the entire runtime
    // distributed — kind of like Objective-C to the max, and other message-oriented languages." The
    // point: if the ONLY way to touch a grain is to send it a message, then WHERE the grain is — and
    // whether it is even resident right now — is invisible to the sender. A message to a PAUSED grain
    // REACTIVATES it and is delivered; a message to a resident grain is delivered directly; a message
    // to a grain on another silo routes over Reticulum. Same call, three fulfilments — location AND
    // residency transparency. This is the exact hook Smalltalk exposes as `doesNotUnderstand:`,
    // Objective-C as `forwardInvocation:` / NSProxy (and shipped as *Distributed Objects* —
    // NSConnection / NSDistantObject), and Erlang as the location-transparent `!` send. Alan Kay:
    // "the big idea is messaging" — the runtime distributes BECAUSE messaging is the only verb.

    /// Deliver a message to its target grain across the resident/paused boundary — residency-
    /// transparent. If the target is paused, it is resumed first (the message reactivates it), then
    /// present in the returned resident heap; if already resident, unchanged; if unknown to both,
    /// the resident heap is returned as-is (the target lives on another silo — routing, not our call).
    /// Returns the (possibly grown) resident heap. The sender never learns which case occurred — that
    /// obliviousness IS the distribution transparency.
    let deliver (msg: DynamicValue) (resident: DynamicValue) (paused: DynamicValue) : DynamicValue =
        match DynamicValue.get "to" msg with
        | Some(DynamicValue.String target) ->
            let isResident = objects resident |> List.exists (fun o -> objId o = Some target)
            if isResident then resident
            else
                let toRevive = objects paused |> List.filter (fun o -> objId o = Some target)
                resume (DynamicValue.Array toRevive) resident // reactivate from what remained (no-op if truly absent)
        | _ -> resident

    // ── generational collection: most objects die young (Lieberman–Hewitt 1983 / Ungar 1984) ──
    //
    // Aaron 2026-07-03: "generational collection — the die-young tier next." The empirical law GC
    // rests on: MOST OBJECTS DIE YOUNG (here: PAUSE young — a loaded-once mixDef is used for one
    // specialization and then goes idle). So split the heap into a YOUNG generation and an OLD one; a
    // MINOR collection scans ONLY the young generation (cheap, frequent), pausing the short-lived and
    // TENURING (promoting) the survivors to old once they have lived long enough. Old objects are not
    // scanned by a minor GC at all — that scoping is the entire speed win. A MAJOR collection scans
    // both (rare). Inter-generational pointers (an old object referencing a young one) are handled by
    // a REMEMBERED SET: old→young refs are added as roots for the young scan, so a young object an old
    // one still points at is not wrongly paused (the write-barrier correctness, computed here directly;
    // a real incremental barrier maintains it as writes happen — named scope). Pause-not-death holds
    // throughout: a "collected" young object is returned paused (resumable), never destroyed.

    let private objValue (o: DynamicValue) : DynamicValue = DynamicValue.get "value" o |> Option.defaultValue DynamicValue.Null
    let private ageOf (o: DynamicValue) : int = match DynamicValue.get "age" o with Some(DynamicValue.Int n) -> int n | _ -> 0
    /// Re-stamp a young object with an age (preserving id/value/refs).
    let private reStamp (age: int) (o: DynamicValue) : DynamicValue =
        DynamicValue.Object
            [ "id", DynamicValue.String(objId o |> Option.defaultValue "")
              "value", objValue o
              "refs", DynamicValue.Array(objRefs o |> List.map DynamicValue.String)
              "age", DynamicValue.Int(int64 age) ]
    /// Promote a young object to old (strip the age — old objects are plain heap objects).
    let private toOld (o: DynamicValue) : DynamicValue = object' (objId o |> Option.defaultValue "") (objValue o) (objRefs o)

    let private genYoung (g: DynamicValue) : DynamicValue list = match DynamicValue.get "young" g with Some(DynamicValue.Array xs) -> xs | _ -> []
    let private genOld (g: DynamicValue) : DynamicValue list = match DynamicValue.get "old" g with Some(DynamicValue.Array xs) -> xs | _ -> []

    /// A generational heap: a young generation and an old (tenured) one.
    let genHeap (young: DynamicValue list) (old: DynamicValue list) : DynamicValue =
        DynamicValue.Object [ "young", DynamicValue.Array young; "old", DynamicValue.Array old ]

    /// The young / old generations as heaps (for inspection + reuse of the mark/partition surface).
    let youngGen (g: DynamicValue) : DynamicValue = DynamicValue.Array(genYoung g)
    let oldGen (g: DynamicValue) : DynamicValue = DynamicValue.Array(genOld g)

    /// Allocate a fresh object into the young generation (age 0).
    let allocate (obj: DynamicValue) (g: DynamicValue) : DynamicValue =
        genHeap (genYoung g @ [ reStamp 0 obj ]) (genOld g)

    /// A MINOR collection: scan ONLY the young generation. Young objects reachable from `roots` (plus
    /// the remembered set: young ids referenced by old objects) survive and age by one; a survivor
    /// whose age reaches `tenureAge` is promoted to old. Unreachable young objects are PAUSED (returned,
    /// resumable). The old generation is left untouched — the scoping that makes a minor GC cheap.
    /// Returns the new generational heap AND the paused young objects.
    let minorGc (roots: string list) (tenureAge: int) (g: DynamicValue) : DynamicValue * DynamicValue =
        let young = genYoung g
        let old = genOld g
        let combined = DynamicValue.Array(young @ old)
        let youngIds = young |> List.choose objId |> Set.ofList
        let remembered = old |> List.collect objRefs |> List.filter (fun r -> Set.contains r youngIds) // old→young (write barrier)
        let effectiveRoots = (roots @ remembered) |> List.distinct
        let reachable = mark effectiveRoots combined
        let isLive o = objId o |> Option.map (fun id -> Set.contains id reachable) |> Option.defaultValue false
        let survivors = young |> List.filter isLive |> List.map (fun o -> reStamp (ageOf o + 1) o)
        let paused = young |> List.filter (isLive >> not)
        let promoted = survivors |> List.filter (fun o -> ageOf o >= tenureAge) |> List.map toOld
        let stayYoung = survivors |> List.filter (fun o -> ageOf o < tenureAge)
        genHeap stayYoung (old @ promoted), DynamicValue.Array paused

    /// A MAJOR collection: scan BOTH generations (rare, thorough). Survivors keep their generation
    /// membership; the rest are paused (resumable). This is the full `partition` over young ∪ old —
    /// the only path that reclaims OLD garbage.
    let majorGc (roots: string list) (g: DynamicValue) : DynamicValue * DynamicValue =
        let young = genYoung g
        let old = genOld g
        let resident, paused = partition roots (DynamicValue.Array(young @ old))
        let survivorIds = objects resident |> List.choose objId |> Set.ofList
        let keep (xs: DynamicValue list) = xs |> List.filter (fun o -> objId o |> Option.map (fun id -> Set.contains id survivorIds) |> Option.defaultValue false)
        genHeap (keep young) (keep old), paused

    // ── incremental / concurrent collection: tri-color marking + the write barrier (Dijkstra 1978) ──
    //
    // Aaron 2026-07-03: "incremental/concurrent GC is the remaining classic tier." The stop-the-world
    // `mark` pauses everything while it traces; a concurrent collector traces in BOUNDED STEPS
    // interleaved with the mutator, so pauses stay short. The tri-color abstraction (Dijkstra–Lamport
    // et al.): every object is WHITE (candidate garbage), GREY (reached, children not yet scanned), or
    // BLACK (reached, children scanned). A step moves ≤ `budget` greys to black, grey-ing their white
    // children. When no grey remains, BLACK = reachable, WHITE = paused — the same answer as
    // stop-the-world, computed incrementally. The catch is the mutator running mid-trace: if it makes a
    // BLACK object point at a WHITE one, that white could be wrongly collected (black is already
    // scanned). The WRITE BARRIER fixes it — greying the target on such a write (the strong tri-color
    // invariant: no black→white edge) — and is provably load-bearing (the without-barrier lost-object
    // is a test below). State is `{white,grey,black}` (sorted id arrays), byte-lockable + DST.

    let private colorSet (k: string) (state: DynamicValue) : Set<string> =
        match DynamicValue.get k state with
        | Some(DynamicValue.Array xs) -> xs |> List.choose (function DynamicValue.String s -> Some s | _ -> None) |> Set.ofList
        | _ -> Set.empty

    let private colorState (white: Set<string>) (grey: string list) (black: Set<string>) : DynamicValue =
        DynamicValue.Object
            [ "white", DynamicValue.Array(white |> Set.toList |> List.map DynamicValue.String)
              "grey", DynamicValue.Array(grey |> List.map DynamicValue.String)
              "black", DynamicValue.Array(black |> Set.toList |> List.map DynamicValue.String) ]

    /// Initialize tri-color marking: roots are GREY (the frontier), every other heap id is WHITE, none
    /// BLACK. Deterministic (sorted).
    let tricolorInit (roots: string list) (h: DynamicValue) : DynamicValue =
        let all = objects h |> List.choose objId |> Set.ofList
        let rootFrontier = roots |> List.distinct |> List.sort
        let rootSet = Set.ofList rootFrontier
        let white = Set.difference all rootSet
        colorState white rootFrontier Set.empty

    /// Grey queue non-empty? (is there marking work left).
    let tricolorPending (state: DynamicValue) : bool =
        match DynamicValue.get "grey" state with
        | Some(DynamicValue.Array xs) -> not (List.isEmpty xs)
        | _ -> false

    /// One incremental step: move up to `budget` grey objects to black, greying their white children.
    /// Bounded work = bounded pause. Deterministic.
    let tricolorStep (budget: int) (h: DynamicValue) (state: DynamicValue) : DynamicValue =
        let refsOf = objects h |> List.choose (fun o -> objId o |> Option.map (fun id -> id, objRefs o)) |> Map.ofList
        let grey0 = match DynamicValue.get "grey" state with Some(DynamicValue.Array xs) -> xs |> List.choose (function DynamicValue.String s -> Some s | _ -> None) | _ -> []
        let rec go n (white: Set<string>) (grey: string list) (black: Set<string>) =
            if n <= 0 then white, grey, black
            else
                match grey with
                | [] -> white, grey, black
                | id :: rest ->
                    let children = Map.tryFind id refsOf |> Option.defaultValue []
                    let newlyGrey = children |> List.filter (fun c -> Set.contains c white)
                    let white' = List.fold (fun w c -> Set.remove c w) white newlyGrey
                    go (n - 1) white' (rest @ newlyGrey) (Set.add id black)
        let white, grey, black = go (max 0 budget) (colorSet "white" state) grey0 (colorSet "black" state)
        colorState white grey black

    /// The Dijkstra write barrier: the mutator wrote a `src`→`tgt` reference mid-trace. If `src` is
    /// BLACK and `tgt` is WHITE, grey `tgt` (restore the no-black→white invariant) so it is not wrongly
    /// collected. Any other combination is already safe and unchanged.
    let writeBarrier (src: string) (tgt: string) (state: DynamicValue) : DynamicValue =
        let white = colorSet "white" state
        let black = colorSet "black" state
        if Set.contains src black && Set.contains tgt white then
            let grey = (match DynamicValue.get "grey" state with Some(DynamicValue.Array xs) -> xs |> List.choose (function DynamicValue.String s -> Some s | _ -> None) | _ -> [])
            colorState (Set.remove tgt white) (grey @ [ tgt ]) black
        else state

    /// Drain the incremental marker from an EXISTING state to completion; returns the final BLACK set.
    /// (Lets a caller advance partway, mutate + barrier, then finish — the concurrent scenario.)
    let tricolorDrainFrom (state0: DynamicValue) (budget: int) (h: DynamicValue) : Set<string> =
        let mutable state = state0
        let mutable guard = 0
        while tricolorPending state && guard < 1_000_000 do
            state <- tricolorStep (max 1 budget) h state
            guard <- guard + 1
        colorSet "black" state

    /// Drain the incremental marker to completion with a fixed `budget` per step; returns the final
    /// BLACK set (the reachable objects). Equal to the stop-the-world `mark` for any budget ≥ 1.
    let tricolorDrain (budget: int) (roots: string list) (h: DynamicValue) : Set<string> =
        tricolorDrainFrom (tricolorInit roots h) budget h
