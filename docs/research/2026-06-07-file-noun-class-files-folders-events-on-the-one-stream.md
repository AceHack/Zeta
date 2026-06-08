# The `file` noun-class — files & folders as events on the one stream

**Aaron, 2026-06-07** (#7016–#7018):

> "we need a zeta fs or zeta file for working with files … I like `file` better than `fs` (F# uses `fs`) …
> we likely need file, folder, and entry — the generic word for file-or-folder … `entry` seems too generic
> for a global namespace noun; it's not obvious it's file-related."

## What was built (`src/Core/File.fs`, module `Files`, 9/9 tests green, 0-warning)

Another interface (#6992) on the universal grammar — same shape as `Db` (#6996) / `KeyStore` (#6998):
operations are events on the ONE DBSP Z-set stream (#6997/#7000), folded into a tree; deterministic +
replayable (DST §7). Over `db`'s flat key/value, the `file` noun-class adds **folders** and **move/copy**
(subtree-aware) and **content-by-hash**.

- **Seam: `file`** (not `fs` — collides with F#/`fsharp`). `SeamName = "file"`, `isFileCommand`.
- **`FileEntry`** — the file-or-folder type: `File of contentHash | Folder`. Named **`FileEntry`**, not
  bare `Entry` (#7018: a global noun must be obviously file-related).
- **`FileEvent`** on the stream: `Write(path, contentHash)` · `MkFolder path` · `Remove path`
  (prefix-cascade) · `Move(src,dst)` · `Copy(src,dst)`.
- **`fold` / `apply`** → `FileState { Entries: Map<path, FileEntry> }`; plus `readHash`, `listFolder`
  (immediate children, ordinal-sorted).

## Pluggable backends + hexagonal (Aaron #7019/#7020)

`file` has pluggable backends like `db` (#6995) — **`ExternalFs`** (real OS multi-file paths) ·
**`DagFs`** (internal single-file content-addressed; the default) · **`ObjectStore`** (S3 / MinIO / any
S3-compatible). The fold is **backend-invariant** (same stream → same tree on all three; tested). And the
governing principle Aaron stated: **every interface should be pluggable and hexagonal (ports & adapters)
across all the CLIs** — the noun-class is the *port*; each backend is an *adapter*; the semantics
(event-fold) live in the port, swappable underneath. (`db`, `key`, `file` all follow this; it's the
standing rule for new noun-classes.)

## Entries depend on their parent folders (#7021/#7022/#7023)

> "in our fs a file just depends on its parent folders … more accurately, two FileEntries with the same
> name can't depend on the same folder."

- **Parent-folder dependson.** A `FileEntry` (file *or* folder) **dependson** its parent folder — the
  dependency edge of the file tree, identical to `Db`'s `DepSetup` (#6996): the parent must be "set up"
  (exist) before the child. `parent path` / `ancestors path` give those edges; `ZetaGraph.topoOrder`
  (#6984) sequences parent folders before children on the one stream. So `file write /d/x dependson /d`.
- **Name unique within a folder — at the *FileEntry* level.** Because the full path is the key, two
  **FileEntries** (file or folder, #7023) with the same name can't both depend on the same parent folder —
  they are the **same node** (last write wins; can't coexist). This is the ZetaCli "**unique-in-scope
  noun**" rule, scope = parent folder; validates `FileEntry` + `Map<path, FileEntry>`. (Tested.)

## Load-bearing disciplines

- **Reference-not-copy / no-binary-in-proof-lineage.** A `Write` carries a **content HASH** (BLAKE3 CAS
  pointer into `ContentStore`/`DagFs`), NEVER the bytes. The stream stays text + diffable; bytes live in
  the content store (dedup + verify for free). This is the single-file/DagFs backend of `db` (#6995)
  given proper file/folder semantics. `readHash` returns the pointer; the caller resolves bytes.
- **Idempotency (#6), named honestly.** `Write` / `MkFolder` are upserts; `Remove` is a prefix-cascade
  tombstone ⇒ apply-N == apply-once. `Move` / `Copy` are **transformations, NOT idempotent** (re-applying
  after the source moved nets a different effect) — named per the discipline; treat like Z-set
  corrections, not dedup-guarded upserts. (Tested: write/upsert, remove-cascade, move file + subtree,
  copy-keeps-source, listFolder one-level, fold determinism.)
- **Culture-invariant.** All path comparison/sort is `Ordinal` (subtree prefix checks, `listFolder` sort).

## Honest scope (peel)

Semantics layer built + tested as a pure F# oracle: the event DU, the tree fold, files/folders, move/copy
subtree relocation, content-by-hash, listing. NOT built: the live bridge to a real filesystem or to
`ContentStore`/`DagFs` (it traffics in hash *strings* — wiring `Write` to actually store bytes in the CAS
and `readHash` to fetch them is the named next step), and the `file` verbs in `ZetaCli`'s grammar (a `file`
seam command → `FileEvent`). It's the file/folder semantics floor, sharing the one stream + the `db`
pluggable backends (#6995).

## Anchors (Beacon)

- **Content-addressed filesystems / Merkle trees** — git tree objects, IPFS/IPLD, our `DagFs`/
  `ContentStore` (BLAKE3); content-by-hash is the prior art for reference-not-copy file storage.
- **Event-sourced / log-structured filesystems** — the fold-over-events tree (cf. `db` #6994).
- **POSIX file/dir + move/rename semantics** — the operation vocabulary (file/folder/move/copy).
- Internal: #6996 (db one-stream + backends), #6998 (KeyStore parallel), #6995 (single-file/DagFs
  backend), #6992 ("another interface"), manifesto §7 DST / §8 DV2.0, idempotency #6, culture-invariant rule.
