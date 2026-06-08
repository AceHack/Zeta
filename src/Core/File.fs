namespace Zeta.Core

/// **The `file` noun-class — files & folders as events on the one stream.**
///
/// Aaron #7016/#7017: *"we need a zeta file for working with files … I like `file` better than `fs` (fsharp
/// uses fs); we likely need file, folder, and entry — the generic word for file-or-folder."* So: the seam is
/// **`file`**; an **`Entry`** is the generic (a **`File`** addressed by content hash, or a **`Folder`**).
///
/// Same shape as `Db` (#6996) / `KeyStore` (#6998): operations are events on the ONE DBSP Z-set stream
/// (#6997/#7000), folded into a tree; deterministic + replayable (DST §7). Over `db`'s flat key/value, the
/// `file` noun-class adds **folders** and **move/copy** (subtree-aware), and **content-by-hash**.
///
/// **Reference-not-copy / no-binary-in-proof-lineage:** a `Write` carries a **content HASH** (a CAS pointer —
/// BLAKE3, the `ContentStore`/`DagFs` address), NEVER the file bytes. The stream stays text + diffable; the
/// bytes live in the content store (dedup + verify for free). This is the single-file/DagFs backend of `db`
/// (#6995) given proper file/folder semantics.
///
/// Idempotency (#6): `Write` / `MkFolder` are upserts and `Remove` is a prefix-cascade tombstone ⇒ apply-N ==
/// apply-once. `Move` / `Copy` are **transformations, NOT idempotent** (re-applying after the source moved is a
/// no-op with a different net effect) — named here per the discipline; treat them like Z-set corrections, not
/// dedup-guarded upserts. F# reference oracle; C#/Rust/TS ports follow.
module Files =

    open ZetaCli

    /// A file-or-folder (Aaron #7017): a `File` (content addressed by hash) or a `Folder`. Named `FileEntry`
    /// (not bare `Entry`) so the global noun is obviously file-related (#7018).
    type FileEntry =
        | File of contentHash: string // CAS pointer (BLAKE3) into ContentStore/DagFs — NOT the bytes
        | Folder

    /// An event (`+1` delta) on the one stream. Paths are the keys; `Write` carries a content HASH, not bytes.
    type FileEvent =
        | Write of path: string * contentHash: string // upsert a file at path with the given content hash
        | MkFolder of path: string // upsert a folder at path
        | Remove of path: string // remove path and all descendants (prefix cascade)
        | Move of src: string * dst: string // move a file/subtree (NOT idempotent)
        | Copy of src: string * dst: string // copy a file/subtree (NOT idempotent)

    /// Pluggable backend (Aaron #7019, mirrors `Db.Backend` #6995): an **external** OS filesystem (real
    /// multi-file paths) or our **internal single-file content-addressed `DagFs`**. The fold is backend-
    /// INVARIANT — the same stream folds to the same tree on either; only WHERE entries + content durably land
    /// differs (external: real files; DagFs: one content-addressed file).
    type Backend =
        | ExternalFs // an existing OS filesystem (multi-file, real paths)
        | DagFs // internal single-file content-addressed filesystem (our DagFs/ContentStore)
        | ObjectStore // S3 / MinIO / any S3-compatible object store (#7020)

    /// DagFs by default: self-contained + content-addressed (zeta-native); `ExternalFs` is opt-in.
    let defaultBackend = DagFs

    /// The materialized tree = fold over the stream. `path → FileEntry`. `Backend` records where entries +
    /// content durably land (it does not change the fold result — see `Backend`).
    type FileState =
        { Backend: Backend
          Entries: Map<string, FileEntry> }

    let empty backend = { Backend = backend; Entries = Map.empty }

    /// True when `path` is `prefix` itself or lies under `prefix/` (subtree membership).
    let private isUnderOrEqual (prefix: string) (path: string) : bool =
        path = prefix || path.StartsWith(prefix + "/", System.StringComparison.Ordinal)

    /// Re-key a path from under `src` to under `dst` (subtree relocation).
    let private reKey (src: string) (dst: string) (path: string) : string =
        dst + path.Substring(src.Length)

    /// Apply one stream event. Deterministic; ordinal throughout (culture-invariant).
    let apply (st: FileState) (ev: FileEvent) : FileState =
        match ev with
        | Write(p, h) -> { st with Entries = Map.add p (File h) st.Entries }
        | MkFolder p -> { st with Entries = Map.add p Folder st.Entries }
        | Remove p ->
            { st with Entries = st.Entries |> Map.filter (fun k _ -> not (isUnderOrEqual p k)) }
        | Move(src, dst) ->
            let moved =
                st.Entries |> Map.toList |> List.filter (fun (k, _) -> isUnderOrEqual src k)
            let without =
                st.Entries |> Map.filter (fun k _ -> not (isUnderOrEqual src k))
            let relocated =
                moved |> List.fold (fun (m: Map<string, FileEntry>) (k, v) -> Map.add (reKey src dst k) v m) without
            { st with Entries = relocated }
        | Copy(src, dst) ->
            let copied =
                st.Entries |> Map.toList |> List.filter (fun (k, _) -> isUnderOrEqual src k)
            let withCopy =
                copied |> List.fold (fun (m: Map<string, FileEntry>) (k, v) -> Map.add (reKey src dst k) v m) st.Entries
            { st with Entries = withCopy }

    /// Fold a whole stream into a tree on a backend — deterministic, replayable (DST §7), backend-INVARIANT.
    let fold backend (events: FileEvent list) : FileState = List.fold apply (empty backend) events

    /// Read a file's content hash at `path` (None if absent or a folder). The caller resolves the hash against
    /// the ContentStore/DagFs to get the bytes (reference-not-copy).
    let readHash (path: string) (st: FileState) : string option =
        match Map.tryFind path st.Entries with
        | Some(File h) -> Some h
        | _ -> None

    /// List the immediate children of a folder `path` (one level), sorted ordinal for determinism.
    let listFolder (path: string) (st: FileState) : string list =
        let prefix = if path = "/" then "/" else path + "/"
        st.Entries
        |> Map.toList
        |> List.map fst
        |> List.filter (fun k -> k <> path && k.StartsWith(prefix, System.StringComparison.Ordinal))
        // immediate children only: no further "/" after the prefix
        |> List.filter (fun k -> not (k.Substring(prefix.Length).Contains "/"))
        |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))

    /// A path's **parent folder** — the dependson edge of the file tree (Aaron #7021: *"a file just depends on
    /// its parent folders"*). `None` for a top-level path (`/x`) or root (`/`). The parent must be "set up"
    /// (exist) before the child, exactly like `Db`'s `DepSetup` (#6996); topo-order over these edges
    /// (`ZetaGraph.topoOrder`, #6984) sequences parent folders before their children on the one stream.
    let parent (path: string) : string option =
        match path.LastIndexOf '/' with
        | i when i > 0 -> Some(path.Substring(0, i))
        | _ -> None

    /// All ancestor folders of a path, ordered shallowest → deepest (root-most first). These are the file's
    /// `dependson` chain: each must precede the next, and all precede the path itself.
    let ancestors (path: string) : string list =
        let rec up acc p =
            match parent p with
            | Some par -> up (par :: acc) par
            | None -> acc

        up [] path

    [<Literal>]
    let SeamName = "file"

    /// Is this command on the `file` seam (`zeta file <verb> <noun>`)?
    let isFileCommand (cmd: ZetaCommand) = cmd.Seam = Some SeamName
