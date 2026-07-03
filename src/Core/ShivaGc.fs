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
