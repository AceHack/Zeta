namespace Zeta.Core

open System.Collections.Immutable

/// **Multi-parent content-addressed file tree — the "same file in many folders" + two edit modes
/// (Aaron 2026-06-07; 081KTGTJC1Q).** A thin path layer over `ContentStore`: paths map to CONTENT
/// ADDRESSES, so identical content under N paths is ONE stored node (single-instance / dedup), and a node
/// can live under many paths at once (multi-parent — hardlink- / git-blob-shaped). Immutable/COW: every
/// mutation returns a new `Tree` version (old roots persist as cheap branches).
///
/// The two edit modes Aaron specified:
///   - **`editLocal`** (DEFAULT, regular-filesystem feel): copy-on-write fork — only THIS path sees the
///     change; other paths sharing the old content keep it.
///   - **`editEverywhere`**: content update — every path that referenced the old content follows the new
///     content (the shared-object edit).
[<RequireQualifiedAccess>]
module DagFs =

    /// A file tree: a content-addressed `store` of nodes + a `links` map from path -> content address.
    [<NoEquality; NoComparison>]
    type Tree<'V> =
        private
            { store: ContentStore.Store<'V>
              links: ImmutableDictionary<string, MerkleHash> }

    /// Empty tree over a content store keyed by `hashOf`.
    let create (hashOf: 'V -> MerkleHash) : Tree<'V> =
        { store = ContentStore.create hashOf
          links = ImmutableDictionary.Create<string, MerkleHash>() }

    /// Link `path` to `value`: store the content (dedup) and point `path` at its address. If another path
    /// already holds identical content, they share the single node (multi-parent). Returns the new tree.
    let link (path: string) (value: 'V) (t: Tree<'V>) : Tree<'V> =
        let h, store' = ContentStore.put value t.store
        { store = store'; links = t.links.SetItem(path, h) }

    /// Resolve `path` to its content, or `None` if unlinked.
    let resolve (path: string) (t: Tree<'V>) : 'V option =
        match t.links.TryGetValue path with
        | true, h -> ContentStore.get h t.store
        | _ -> None

    /// The content ADDRESS at `path` (without fetching), or `None`.
    let addressAt (path: string) (t: Tree<'V>) : MerkleHash option =
        match t.links.TryGetValue path with
        | true, h -> Some h
        | _ -> None

    /// Remove the link at `path` (the node stays in the store — it may be shared / GC is separate).
    let unlink (path: string) (t: Tree<'V>) : Tree<'V> =
        { t with links = t.links.Remove path }

    /// Every path that currently points at content address `h` (the multi-parent / reverse view — the
    /// "which folders hold this file" question). Order unspecified.
    let pathsOf (h: MerkleHash) (t: Tree<'V>) : string list =
        t.links
        |> Seq.filter (fun kv -> kv.Value = h)
        |> Seq.map (fun kv -> kv.Key)
        |> List.ofSeq

    /// **Edit just this folder (DEFAULT — copy-on-write fork).** Store the new content and repoint ONLY
    /// `path`; any other path that shared the old content is untouched. No-op if `path` is unlinked.
    let editLocal (path: string) (value: 'V) (t: Tree<'V>) : Tree<'V> =
        match t.links.TryGetValue path with
        | true, _ -> link path value t
        | _ -> t

    /// **Content update everywhere.** Repoint EVERY path that referenced `path`'s current content to the
    /// new content (the shared-object edit). No-op if `path` is unlinked.
    let editEverywhere (path: string) (value: 'V) (t: Tree<'V>) : Tree<'V> =
        match t.links.TryGetValue path with
        | true, oldH ->
            let newH, store' = ContentStore.put value t.store
            let affected = pathsOf oldH t
            let links' = affected |> List.fold (fun (m: ImmutableDictionary<string, MerkleHash>) p -> m.SetItem(p, newH)) t.links
            { store = store'; links = links' }
        | _ -> t

    /// Number of linked paths.
    let pathCount (t: Tree<'V>) : int = t.links.Count

    /// Every linked path in the tree (the directory-listing view — the forward map's keys). Order
    /// unspecified. Complements `pathsOf` (reverse, by content) and `pathCount` (cardinality); needed to
    /// enumerate the tree as a mountable filesystem (see the ZetaFS WebDAV host).
    let paths (t: Tree<'V>) : string list = t.links.Keys |> List.ofSeq

    /// Number of distinct stored nodes (single-instanced).
    let nodeCount (t: Tree<'V>) : int = ContentStore.count t.store

    /// **Merge two file trees** (same `hashOf`) — content-addressing makes this nearly free (Aaron 2026-06-07).
    /// The CONTENT layer is an unconditional, conflict-free union (identical content = identical node → dedup).
    /// The PATH layer enforces name-uniqueness: a path is a unique key (a full path `folder/name` ⇒ per-folder
    /// name uniqueness is implied), so the only real conflict is **same path → different content**, resolved
    /// by `resolve path valueA valueB`. (NB folders are not *just* labels — name-uniqueness-within-folder is a
    /// structural constraint; this flat-path model handles it via full-path keys, the richer folder-structured
    /// model — closure table / per-folder name-map over HAMT/Patricia/Hitchhiker — is the upgrade. See the
    /// fs-Merkle research doc.)
    let merge (resolve: string -> 'V -> 'V -> 'V) (a: Tree<'V>) (b: Tree<'V>) : Tree<'V> =
        let mutable store = ContentStore.merge a.store b.store
        let mutable links = a.links
        for kv in b.links do
            match a.links.TryGetValue kv.Key with
            | true, ha when ha = kv.Value -> () // same path, same content — no conflict
            | true, ha -> // same path, different content — resolve the two values
                let va = ContentStore.get ha store |> Option.get
                let vb = ContentStore.get kv.Value store |> Option.get
                let winner = resolve kv.Key va vb
                let h, store' = ContentStore.put winner store
                store <- store'
                links <- links.SetItem(kv.Key, h)
            | _ -> links <- links.SetItem(kv.Key, kv.Value) // only in b
        { store = store; links = links }
