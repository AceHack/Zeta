namespace Zeta.Core

/// **Ephemeron — the weak-value table on the Shiva GC: collect on strong-ref-drop (shadow*).**
/// (Aaron 2026-07-03: "ephemeron integration — weak-value table, collect on strong-ref-drop." The
/// Shiva collector reclaims what the STRONG heap stops referencing; this adds the WEAK layer — the
/// interning table that holds shared reifications (`MixIr.defaultMixDef` shared across every ISA) so
/// they live exactly as long as something strong points at them, and no longer.)
///
/// **What a weak-value table is.** An ordinary strong reference keeps its target alive. A *weak*
/// reference does not — it observes the target while others hold it, and goes silent once they drop
/// it. A weak-value table is a set of `{ key, value }` entries whose OWN edges do NOT keep the key
/// alive: an entry survives a collection iff its `key` is **strongly reachable from the heap roots**.
/// So when the last strong reference to a key drops, its entry is collected automatically — the
/// interning table never leaks.
///
/// **True ephemeron semantics (Hayes 1997), not just weak refs.** The distinguishing property: an
/// ephemeron's VALUE becomes reachable ONLY IF its KEY is reachable — the value is marked *through*
/// the key, not independently. So `reachable` is a FIXPOINT: strong-mark from the roots; any ephemeron
/// whose key is now reachable contributes its value as a new root; re-mark; iterate. This gives two
/// properties a plain weak table lacks: (1) an ephemeron **chain** (A→B, B→C) keeps C alive when A is
/// rooted; (2) an ephemeron **cycle** with no external strong root collects entirely — ephemerons
/// cannot keep *each other* alive (where strong refs would leak the cycle). That cycle-collapse is the
/// whole point of ephemerons over weak refs.
///
/// **Collection is still a Z-set retraction (−1).** `prune` returns the surviving table plus the
/// dropped keys — exactly the entries whose key left the strong-reachable set. Brahma interned (+1),
/// Shiva retracts (−1) on strong-ref-drop. Built on `ShivaGc` (strong mark) + `MixIr` (what gets
/// interned). Deterministic (DST), idempotent (#6), byte-lockable. Anchors: Hayes (1997, "Ephemerons");
/// Barry Hayes' weak-table semantics; Java `WeakHashMap` / .NET `ConditionalWeakTable`; McCarthy (GC).
[<RequireQualifiedAccess>]
module Ephemeron =

    // ── weak-table constructors (a weak-value table as DynamicValue) ──

    /// A weak entry: `key` (the id whose strong reachability decides survival) → `value` (an id made
    /// reachable ONLY WHILE the key is). The entry's edges keep NOTHING alive by themselves.
    let entry (key: string) (value: string) : DynamicValue =
        DynamicValue.Object [ "key", DynamicValue.String key; "value", DynamicValue.String value ]

    /// A weak-value table is an array of entries.
    let table (entries: DynamicValue list) : DynamicValue = DynamicValue.Array entries

    // ── readers ──

    let private rows (t: DynamicValue) : DynamicValue list =
        match t with
        | DynamicValue.Array xs -> xs
        | _ -> []

    let private keyOf (e: DynamicValue) : string option =
        match DynamicValue.get "key" e with
        | Some(DynamicValue.String s) -> Some s
        | _ -> None

    let private valOf (e: DynamicValue) : string option =
        match DynamicValue.get "value" e with
        | Some(DynamicValue.String s) -> Some s
        | _ -> None

    // ── the ephemeron reachability fixpoint ──

    /// The set of ids reachable given strong `roots`, the strong `heap`, and the weak `table`. Starts
    /// from the strong-reachable set; any ephemeron whose KEY is reachable contributes its VALUE as a
    /// new root (marked through the strong heap); iterate to a fixpoint. Monotone over a finite id
    /// set, so it terminates. Deterministic (roots visited in sorted order).
    let reachable (roots: string list) (heap: DynamicValue) (table: DynamicValue) : Set<string> =
        let es = rows table |> List.choose (fun e -> match keyOf e, valOf e with Some k, Some v -> Some(k, v) | _ -> None)
        let rec fix (seedRoots: Set<string>) : Set<string> =
            let strong = ShivaGc.mark (Set.toList seedRoots) heap
            let addedValues = es |> List.choose (fun (k, v) -> if Set.contains k strong then Some v else None) |> Set.ofList
            let grown = Set.union strong addedValues
            if Set.isSubset grown strong then strong // no new ephemeron value became a root → fixpoint
            else fix grown
        fix (Set.ofList roots)

    // ── prune: collect entries whose key dropped out of the strong-reachable set (Shiva, weak) ──

    /// Prune the weak table against the strong heap: keep only entries whose KEY is reachable (by the
    /// ephemeron fixpoint); drop the rest. Returns the surviving table AND the dropped keys (sorted) —
    /// the Z-set −1 retraction of every entry collected on strong-ref-drop.
    let prune (roots: string list) (heap: DynamicValue) (table: DynamicValue) : DynamicValue * string list =
        let live = reachable roots heap table
        let survivors = rows table |> List.filter (fun e -> keyOf e |> Option.map (fun k -> Set.contains k live) |> Option.defaultValue false)
        let dropped =
            rows table
            |> List.choose (fun e ->
                match keyOf e with
                | Some k when not (Set.contains k live) -> Some k
                | _ -> None)
            |> List.sort
        DynamicValue.Array survivors, dropped

    /// The surviving weak table only (drops the collected-keys list) — for chaining / idempotence.
    let pruned (roots: string list) (heap: DynamicValue) (table: DynamicValue) : DynamicValue = prune roots heap table |> fst
