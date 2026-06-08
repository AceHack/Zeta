# `file` extensions — folder templates, branch deps, the static git-native fs graph

**Aaron, 2026-06-07** (#7024–#7026), extending the `file` noun-class (#7002).

## 1. Folder-layout templates + instance dependson (#7024)

> "we should be able to have folder layout templates like yyyy/mm/dd or whatever and have a file depend on
> an instance of that template chain."

A **`FolderTemplate`** is an ordered list of **`Segment`**s — each a fixed `Lit` or a named `Placeholder`
(e.g. `[Placeholder "yyyy"; Placeholder "mm"; Placeholder "dd"]`). An **instance** binds the placeholders
to values, yielding a concrete folder chain a file `dependson` (#7021). Built (module `Files`):

- `instantiate root bindings tmpl` → `Ok "/logs/2026/06/07"` (or `Error "<unbound placeholder>"`).
- `fileUnderTemplate root bindings tmpl name` → the file's full **dependson chain**: every folder of the
  instantiated chain root-first, then the file path — exactly the `ancestors` edges (#7021), produced by
  the template and resolved by `ZetaGraph.topoOrder` (#6984). Literals mix with placeholders.

So a date-partitioned layout is a *template*; `2026/06/07` is an *instance*; the log file dependson that
instance's folder chain.

## 2. FileEntries can dependson branches (#7025)

> "file entries can depend on branches."

Beyond parent folders, a `FileEntry`'s `dependson` may reference a **git branch** (a git ref — the
git-native control-plane backend, #6994): `dependson branch:main`. This is the "git-ref ZetaId pointer"
convention (per-repo registries) applied to file deps. Built: `branchRef "main"` → `"branch:main"`;
`isBranchDep` distinguishes a branch token from a folder path. The git backend resolves the branch; a file
can thus depend on a folder chain *and* a branch (cross-branch/versioned file deps).

## 3. The filesystem graph exists statically in git-native format (#7026)

> "now our filesystem graph can exist statically too in git-native format."

The whole fs graph — the file/folder tree + its dependson edges — isn't only a runtime fold; it can be a
**static, content-addressed git-native artifact.** This is git's own model: **folders ≡ git tree
objects, files ≡ git blobs addressed by content hash** (Merkle DAG, BLAKE3). So the `file` noun-class's
`FileState` maps directly onto git-native storage — *defined, not calculated* (the full-graph-known-
statically theme, #6972), and the **git-native `db` backend** (#6994/#6995) given file/folder shape. The
runtime fold and the static git-native tree are two views of the same graph: fold the event stream → the
tree; serialize the tree → git objects; both content-addressed, both diffable, both DST-replayable.

## 4. Self-hosting, meta-recursive filesystem (#7027)

> "the filesystem can be self-hosted now where the filesystem's metadata is a file within the filesystem
> itself … meta-recursive filesystem."

The fs is **self-describing**: its own metadata (the graph from #7026) is stored **AS a `FileEntry` within
itself**, at a well-known path `MetaPath = "/.zeta/fs.meta"` whose content hash addresses the serialized
graph (git-native, #7026). This is **meta-recursion** — the filesystem contains its own description —
recursive / self-similar (manifesto §9/§10), the same shape as git storing its own refs, a compiler that
compiles itself, or a Lisp metacircular evaluator. **This generalizes across noun-classes (Aaron #7028):**
just as file-metadata is a file, **table-metadata is itself a table** (the system-catalog pattern —
Postgres `pg_catalog`, SQLite `sqlite_master`); self-hosting is the standing meta-recursive principle for
every noun-class (homoiconic CLI≡file≡data). (`table`/`stream` nouns themselves are the next interface,
#7029 — the DBSP stream↔table duality.) Built: `MetaPath`, `isSelfHosted st` (true when the
metadata file is present in the tree). The fs bootstraps from a file inside itself; no external metadata
store needed (ties the airgapped/self-contained goal #7008 — the fs needs nothing outside itself).

## Honest scope (peel)

Built + tested (19/19 `file` tests green, 0-warning): `Segment`/`FolderTemplate`, `instantiate` (with
unbound-placeholder error), `fileUnderTemplate` (instance dependson chain), `branchRef`/`isBranchDep`,
`MetaPath`/`isSelfHosted`.
NOT built: the actual **serialization** of `FileState` to git tree/blob objects (the static git-native
artifact is *described*, mapping folders→trees / files→blobs, but no writer/reader is implemented — that's
the git-native `db` backend driver, still unbuilt #6995), and template/branch-dep wiring into the
`ZetaCli` grammar. Semantics + dependency-shape floor, not the storage driver.

## Anchors (Beacon)

- **git object model** — tree (folder) + blob (file) + content-hash; the static git-native fs graph is
  git's native representation (Torvalds; Merkle DAG).
- **Date-partitioned / templated layouts** — Hive-style partitioning (`yyyy/mm/dd`), log rotation paths;
  path templates as prior art for folder-layout templates.
- **Content addressing / defined-not-calculated** — IPFS/IPLD, Nix store; #6972 (full graph defined, not
  calculated), #6994 (git control plane), #6995 (pluggable db backends incl. git-native + DagFs).
- Internal: #7002 (file noun-class), #7021 (parent-folder dependson), #6984 (topoOrder), #6996 (db one
  stream + DepSetup).
