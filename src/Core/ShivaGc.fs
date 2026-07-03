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
