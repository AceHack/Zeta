namespace Zeta.Core

/// **Caché / MUMPS-style hierarchical-"global" navigation — the canonical MUMPS verbs over `DynamicValue`
/// directly (Aaron 2026-06-07: "this is just DynamicValue; SoftValue even makes this soft").** A "global"
/// `^G(a,b,c)` is a node in a `DynamicValue` tree at subscript path `["a";"b";"c"]`; `DynamicValue` already
/// *is* the ragged, sparse, heterogeneous, path-addressed array (no declared shape) — so these verbs are a
/// thin navigation API over it, **not** a parallel store. A `DynamicValue` whose leaves are `SoftValue`-
/// shaped is a *soft* (probabilistic) sparse tensor; the verbs are leaf-agnostic, so that falls out for free.
/// A model `state_dict` (dotted-path keys → tensors) is a global; navigating it with these verbs is the
/// human-readable model API.
///
/// **Leaf-xor-object semantics (DynamicValue's nature).** Children live under `Object` nodes; a scalar leaf
/// has a value but no children. So a node is a leaf *or* an object — never both. (MUMPS allows a node to
/// hold a value AND children — `$DATA` 11; that is the one way globals are strictly more expressive than a
/// JSON-like tree. Reproducing it would need a reserved value-key; out of scope — DynamicValue is the
/// canonical substrate and its document model is leaf-xor-object, so `data` returns 0 / 1 / 10 only.)
///
/// **Ordinal subscript collation (081KT07NV0008QG0R001YDB73K).** `$ORDER`/`$QUERY` iterate children in ordinal key order
/// (`StringComparer.Ordinal` via F# string `compare`), independent of `Object` insertion order — DST-stable,
/// 4-language-portable. Pure/immutable: every verb returns a new `DynamicValue`.
///
/// Anchors: MUMPS (Octo Barnett et al., 1966) — the sparse multidimensional array + `$ORDER`/`$QUERY`/
/// `$DATA`/`KILL`; InterSystems Caché/IRIS (multi-model over globals); sparse-tensor COO/CSF (Smith &
/// Karypis 2015) — the scaling layout for the same shape.
[<RequireQualifiedAccess>]
module Globals =

    /// A subscript path: `^G(a,b,c)` ↔ `["a"; "b"; "c"]`. The empty path is the root node itself.
    type Path = string list

    /// The empty global — `Null` (an undefined root).
    let empty: DynamicValue = DynamicValue.Null

    /// Ordinal-sorted, de-duplicated child subscripts of an `Object`; `[]` for any non-object.
    let private objKeys (dv: DynamicValue) : string list =
        match dv with
        | DynamicValue.Object kvs -> kvs |> List.map fst |> List.distinct |> List.sortWith compare
        | _ -> []

    /// `$GET(^G(path))` — the `DynamicValue` at `path`, or `None` if undefined (a segment is missing or
    /// traverses through a non-object). The empty path returns the root unless it is `Null`.
    let rec get (path: Path) (root: DynamicValue) : DynamicValue option =
        match path with
        | [] -> (match root with DynamicValue.Null -> None | v -> Some v)
        | k :: rest ->
            match root with
            | DynamicValue.Object kvs ->
                match List.tryFind (fun (kk, _) -> compare kk k = 0) kvs with
                | Some(_, child) -> get rest child
                | None -> None
            | _ -> None

    /// `SET ^G(path) = v` — functional upsert of `v` at `path`, creating intermediate `Object` nodes as
    /// needed (any non-object encountered along the path is replaced by a fresh object — SET wins). The
    /// empty path replaces the whole root with `v`.
    let rec set (path: Path) (v: DynamicValue) (root: DynamicValue) : DynamicValue =
        match path with
        | [] -> v
        | k :: rest ->
            let existing =
                match root with
                | DynamicValue.Object kvs -> kvs
                | _ -> []

            let child =
                match List.tryFind (fun (kk, _) -> compare kk k = 0) existing with
                | Some(_, c) -> c
                | None -> DynamicValue.Null

            let newChild = set rest v child
            let others = existing |> List.filter (fun (kk, _) -> compare kk k <> 0)
            DynamicValue.Object(others @ [ k, newChild ])

    /// `KILL ^G(path)` — delete the node at `path` **and its whole subtree** (remove the key from its parent
    /// object). Killing the empty path clears the global to `Null`. A no-op if the path is undefined.
    let rec kill (path: Path) (root: DynamicValue) : DynamicValue =
        match path with
        | [] -> DynamicValue.Null
        | [ k ] ->
            match root with
            | DynamicValue.Object kvs -> DynamicValue.Object(kvs |> List.filter (fun (kk, _) -> compare kk k <> 0))
            | other -> other
        | k :: rest ->
            match root with
            | DynamicValue.Object kvs ->
                match List.tryFind (fun (kk, _) -> compare kk k = 0) kvs with
                | Some(_, child) ->
                    let killed = kill rest child
                    let others = kvs |> List.filter (fun (kk, _) -> compare kk k <> 0)
                    DynamicValue.Object(others @ [ k, killed ])
                | None -> root
            | other -> other

    /// The immediate-child subscripts of the node at `path`, ordinal-ordered (`[]` if the node is a leaf,
    /// undefined, or has no children).
    let children (path: Path) (root: DynamicValue) : string list =
        match get path root with
        | Some dv -> objKeys dv
        | None -> []

    /// `$DATA(^G(path))` — node status under leaf-xor-object semantics: `0` undefined, `1` a scalar leaf
    /// (value, no children), `10` an object node (children slot). (`11`/value+children is not representable;
    /// see the module note.)
    let data (path: Path) (root: DynamicValue) : int =
        match get path root with
        | None -> 0
        | Some(DynamicValue.Object _) -> 10
        | Some _ -> 1

    /// `$ORDER(^G(path, after))` — the next immediate child subscript of `path` in ordinal order:
    /// `after = None` ⇒ the first child; `after = Some s` ⇒ the first child strictly greater than `s`;
    /// `None` when there is none. Drives sibling iteration.
    let nextChild (path: Path) (after: string option) (root: DynamicValue) : string option =
        let kids = children path root
        match after with
        | None -> List.tryHead kids
        | Some s -> kids |> List.filter (fun c -> compare c s > 0) |> List.tryHead

    /// All leaf `(path, value)` pairs in depth-first ordinal-path order (`Null` root ⇒ empty).
    let toSeq (root: DynamicValue) : (Path * DynamicValue) seq =
        let rec walk (prefix: Path) (dv: DynamicValue) : (Path * DynamicValue) seq =
            seq {
                match dv with
                | DynamicValue.Null -> ()
                | DynamicValue.Object kvs when not (List.isEmpty kvs) ->
                    let ordered = kvs |> List.distinctBy fst |> List.sortWith (fun (a, _) (b, _) -> compare a b)

                    for k, child in ordered do
                        yield! walk (prefix @ [ k ]) child
                | leaf -> yield prefix, leaf
            }

        walk [] root

    /// `$QUERY(^G(path))` — the next **defined leaf** node after `path` in depth-first ordinal-path order,
    /// or `None` at the end. Walks the whole global one leaf at a time regardless of depth.
    let nextNode (path: Path) (root: DynamicValue) : Path option =
        toSeq root
        |> Seq.map fst
        |> Seq.filter (fun p -> compare p path > 0)
        |> Seq.tryHead

    /// The number of defined leaf nodes.
    let count (root: DynamicValue) : int = toSeq root |> Seq.length
