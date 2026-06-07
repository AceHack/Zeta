namespace Zeta.Core

/// **Caché / MUMPS-style multidimensional hierarchical "global" — a sparse persistent array addressed by a
/// subscript PATH (`string list`), with the canonical MUMPS verbs (Aaron 2026-06-07; "like InterSystems
/// Caché plus its DB features").** A global is one uniform tree: `^G(a,b,c) = v` is the value at path
/// `["a";"b";"c"]`. This is the storage shape under Caché's multi-model (object/SQL/document) façade — the
/// same idea as a `DynamicValue` tree / the path-addressed DAG, made into a first-class primitive.
///
/// **Ordinal subscript collation (B-0969).** F#'s structural string comparison is `String.CompareOrdinal`,
/// so the backing sorted `Map<string list,'V>` orders subscript paths ordinally by construction — no
/// culture-sensitivity, DST-stable, 4-language-portable. (MUMPS canonical `$ORDER` collation is
/// numeric-then-string; numeric-subscript collation is a documented later nuance, not this slice.)
///
/// Pure / immutable: every verb returns a new global. Anchors: MUMPS (Octo Barnett et al., 1966) — the
/// sparse multidimensional array + `$ORDER`/`$QUERY`/`$DATA`/`KILL`; InterSystems Caché/IRIS (multi-model
/// over globals). Multi-model views, F#-typed access, and globals-over-the-content-addressed-DAG (CRDT
/// values, DST replay) layer on top later (backlog).
[<RequireQualifiedAccess>]
module Globals =

    /// A subscript path: `^G(a,b,c)` ↔ `["a"; "b"; "c"]`. The empty path is the root.
    type Path = string list

    [<NoEquality; NoComparison>]
    type Global<'V> =
        private
            { Nodes: Map<Path, 'V> } // ordinal-collated (F# string comparison is CompareOrdinal)

    /// The empty global (no defined nodes).
    let empty<'V> : Global<'V> = { Nodes = Map.empty }

    /// `SET ^G(path) = v` — upsert the value at `path`. Intermediate nodes need not exist (sparse).
    let set (path: Path) (v: 'V) (g: Global<'V>) : Global<'V> = { Nodes = Map.add path v g.Nodes }

    /// `$GET(^G(path))` — the value at `path`, or `None` if no value is defined there.
    let get (path: Path) (g: Global<'V>) : 'V option = Map.tryFind path g.Nodes

    /// True iff `prefix` is a (proper or improper) prefix of `path`.
    let private isPrefixOf (prefix: Path) (path: Path) : bool =
        List.length prefix <= List.length path
        && List.forall2 (=) prefix (List.truncate (List.length prefix) path)

    /// `KILL ^G(path)` — delete the node at `path` **and all descendants** (the whole subtree).
    /// Killing the empty path clears the global.
    let kill (path: Path) (g: Global<'V>) : Global<'V> =
        { Nodes = g.Nodes |> Map.filter (fun k _ -> not (isPrefixOf path k)) }

    /// True iff any defined node is a strict descendant of `path`.
    let private hasChildren (path: Path) (g: Global<'V>) : bool =
        let n = List.length path
        g.Nodes |> Map.exists (fun k _ -> List.length k > n && isPrefixOf path k)

    /// `$DATA(^G(path))` — node status: `0` undefined, `1` value & no descendants, `10` no value but has
    /// descendants (a pure intermediate), `11` value & has descendants.
    let data (path: Path) (g: Global<'V>) : int =
        let hasVal = Map.containsKey path g.Nodes
        let hasKids = hasChildren path g
        match hasVal, hasKids with
        | false, false -> 0
        | true, false -> 1
        | false, true -> 10
        | true, true -> 11

    /// The immediate-child subscripts of `prefix`, in ordinal order, deduplicated. A child subscript is the
    /// element at depth `|prefix|` of any defined node strictly below `prefix`.
    let children (prefix: Path) (g: Global<'V>) : string list =
        let n = List.length prefix
        g.Nodes
        |> Map.toSeq
        |> Seq.choose (fun (k, _) -> if List.length k > n && isPrefixOf prefix k then Some(List.item n k) else None)
        |> Seq.distinct
        |> Seq.sortWith compare // ordinal (F# string comparison)
        |> List.ofSeq

    /// `$ORDER(^G(prefix, after))` — the next immediate child subscript of `prefix` in ordinal order:
    /// `after = None` ⇒ the first child; `after = Some s` ⇒ the first child strictly greater than `s`.
    /// `None` when there is no such child. Drives sibling iteration.
    let nextChild (prefix: Path) (after: string option) (g: Global<'V>) : string option =
        let kids = children prefix g
        match after with
        | None -> List.tryHead kids
        | Some s -> kids |> List.filter (fun c -> compare c s > 0) |> List.tryHead

    /// `$QUERY(^G(path))` — the next **defined** node after `path` in global (depth-first / ordinal-path)
    /// order, or `None` at the end. Walks the entire global one node at a time regardless of depth.
    let nextNode (path: Path) (g: Global<'V>) : Path option =
        g.Nodes
        |> Map.toSeq
        |> Seq.map fst
        |> Seq.filter (fun k -> compare k path > 0)
        |> Seq.tryHead

    /// All defined `(path, value)` pairs in ordinal-path order.
    let toSeq (g: Global<'V>) : (Path * 'V) seq = Map.toSeq g.Nodes

    /// The number of defined nodes (values), not counting pure intermediates.
    let count (g: Global<'V>) : int = g.Nodes.Count
