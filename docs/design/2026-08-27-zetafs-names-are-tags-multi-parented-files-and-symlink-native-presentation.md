# The Merkle DAG is fundamental; a filesystem is names bolted on top

*Two different filesystems can stand over one content-addressed store, because file and folder
names are all pointers. ZetaFS is one such namespace — multi-parented, symlink-native, and
resolved by phase.*

**Date:** 2026-08-27 · **Status:** design spec, **nothing here is implemented**
**Extends:** [`2026-06-07-cow-database-testing-from-prod-content-addressed-time-travel-and-zetafs-naming-stack-amara.md`](../research/2026-06-07-cow-database-testing-from-prod-content-addressed-time-travel-and-zetafs-naming-stack-amara.md) §4
**Work item:** `081KSV2WD0008QG0R00030G6S9` (closure-table fs / FUSE)

> **The name is still gated.** The naming-stack doc is explicit that no name is canon until the
> `naming-expert` + Ilyana gate and Aaron sign off. "ZetaFS" is used here as the working label and
> this document does not settle it. `ZFS` remains permanently excluded (OpenZFS).

Aaron 2026-08-27, supplying the properties this document specifies:

> *"our folders and file names are tags that get carried forward and the latest entry based on phase
> time in the content dag gets the file/folder title, the older ones are history like APFS history
> in our fs"* … *"symlink native, and multi parented files"*

---

## 0. Where this sits, and what already exists

The naming stack is settled in shape even where the names are not:

| layer | status |
|---|---|
| `ZSetMerkle` — the Merkle-over-Z-set math primitive | **landed** (`src/Core/ZSetMerkle.fs`) |
| `ZetaStore` — content-addressed object/DAG backend | designed; `081KTGTJC1Q` |
| **ZetaFS** — the mounted presentation | **this document**, unbuilt |

Also present and worth reading before building: `src/Core/ZetaFs.fs` (a Patricia trie over names),
`src/Core/ZetaFsDeltaLog.fs`, `src/Core.FSharp.Blake3/ZetaFsStore.fs`.

The 2026-06-07 hype-peel still stands and is repeated here rather than quietly dropped: **COW
forking, the prod-shadow lane and the mounted view are designed, not implemented.** This spec adds
design, not capability.

---

## 1. The DAG is fundamental. A filesystem is one presentation bolted on top

Aaron 2026-08-27, and this is the framing the rest of the document hangs from:

> *"the merkle content addressed dag is fundamental and file and folder names can be bolted on top
> in many different ways — you can have two completely different file systems on top of the same
> dagfs based on content addresses, the file and folder names are all pointers."*

Two layers, and the separation is strict:

```
  NAMESPACE LAYER   many, mutable, disposable   names -> ContentId   ("a filesystem")
  ------------------------------------------------------------------------
  DAG LAYER         one, immutable, canonical   ContentId -> bytes   ("the store")
```

**The DAG does not know that names exist.** It stores content keyed by hash and nothing else. A
filesystem is a *set of bindings* over it — which makes a filesystem a **value**, not a place.

### What follows, and it is more than presentation polish

1. **Two filesystems over one store cost one copy of the content.** Not deduplicated after the fact
   — never duplicated. Two namespaces that bind the same `ContentId` are pointing at the same
   object because the address *is* the content (§2).
2. **A filesystem can be forked like a branch.** Copy the binding set, change names freely; zero
   bytes move. An agent's private view, an experiment's view, and the shared view are three binding
   sets over identical content.
3. **Radically different organisations of the same data can coexist.** One namespace ordered by
   path, another by work-item, another by phase — none is a copy, none is stale, none is derived
   from another. They are peers.
4. **A filesystem can be discarded without touching the store.** Deleting a namespace deletes
   opinions about names; the content is untouched and any other namespace still reaches it.

### Why this is the substrate's own discipline, not a filesystem trick

This is **hub/satellite partitioning by change rate**
([`dv2-data-split-discipline-activated`](../../.claude/rules/dv2-data-split-discipline-activated.md)):
the DAG is the hub — stable, content-keyed, rarely rewritten — and each namespace is a satellite,
fast-changing and cheap to replace. It is also
[`only-the-irreducible-is-primitive`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md):
the DAG is irreducible, and every namespace is derived and therefore checkable against it.

And it is **§11, the Multi-Oracle Principle, reaching the filesystem.** A single mandatory namespace
over the store would be an *appointed* hub — everyone forced to route through one organisation of
the data. Many namespaces, freely chosen, are oracles: you defer to the view you picked, and exit is
real because another view of the same bytes is always constructible. The discriminator there is
exit, not degree — and here exit costs nothing, because the content never moved.

**The consequence for this document:** everything below §2 specifies *one* namespace design. It is
not the only possible one, and nothing in it is binding on the DAG layer. A second, entirely
different filesystem over the same store is a legitimate thing to build and would contradict none
of it.

---

## 2. The invariant the NAMESPACE layer follows from

The store is content-addressed, so an object's identity *is* its content. That forces
copy-on-write at the logical level — you cannot mutate in place and keep the address; every edit
re-hashes up the spine and unchanged siblings keep their addresses and are shared.

What it costs is **stable identity**: the root's name changes on every write. So a mutable layer is
required *outside* the immutable store. Git resolves this with one mutable cell (`refs/heads/main`)
over an immutable object store, and ZetaFS resolves it the same way — except the mutable layer is
where the whole filesystem presentation lives.

> **Immutable content, mutable names.** Everything below is a consequence of putting the
> filesystem's entire naming apparatus in the mutable half.

---

## 3. Names are tags, not locations

A path in POSIX *locates* a file: the directory entry is where the file lives. In ZetaFS a name is
a **tag bound to a content address**, and the binding is a first-class, versioned fact.

Three consequences, and the third is the useful one:

1. **A rename is not a move.** It retracts one tag-binding and asserts another; no content is
   touched, and the content address is unchanged. Renaming a 40 GB file is O(1) and produces no new
   bytes.
2. **A name can be bound to different content over time**, which is exactly how a ZetaId constant
   resolves to different content addresses across phases — the stable-identity problem from §2,
   solved by making the indirection the primary object rather than a special case.
3. **Nothing distinguishes a "real" entry from a "link".** See §5.

### The tag binding

```
TagBinding =
  { name        : Name           // the tag, e.g. "notes.md" or "docs/"
    parent      : ContentId      // the directory-node this binding lives under
    target      : ContentId      // what it currently resolves to
    phase       : Phase          // NOT wall-clock — see §4
    asserter    : Actor }        // who bound it
```

Bindings are **append-only**. A tag's history is the sequence of bindings that ever named it, and
the current view is a fold over that sequence — the same raw-vault discipline the rest of the
substrate runs on: *a single version of the facts, never a single version of the truth.*

---

## 4. Latest-by-PHASE holds the title; older bindings are history

Aaron's rule: *the latest entry based on phase time in the content DAG gets the file/folder title,
the older ones are history like APFS.*

**Phase, not wall-clock, and this is load-bearing rather than a preference.**
[`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
forbids a local clock from filtering or ordering evidence entering a shared conclusion, because
every node's clock differs and nodes would fold different sets and diverge. A filesystem whose
*resolution of a name* depended on wall-clock would be exactly that failure: two replicas would
disagree about what `notes.md` means.

So resolution is:

```
resolve(name, parent) = argmax_{b : bindings(name, parent)} b.phase
```

with ties broken by the canonical ordinal collation (`Latin1_General_100_BIN2_UTF8`, per
[`culture-invariant-by-default`](../../.claude/rules/culture-invariant-by-default.md)) on the
binding's content address — so the tiebreak is total, deterministic, and identical on every node.

**History is not a feature bolted on; it is the bindings that lost.** APFS snapshots are a
point-in-time copy retained deliberately. Here every superseded binding is retained by
construction, so `notes.md@phase=N` is answerable for any N without anyone having taken a snapshot.

**Honest cost:** unbounded binding history. Retention is a policy this spec does not settle, and
"keep everything forever" is not free — see §7.

---

## 5. Symlink-native: every name is already an indirection

A POSIX symlink is a special file whose content is a path, resolved by the kernel at lookup with
its own rules (`O_NOFOLLOW`, loop limits, `ELOOP`).

**In ZetaFS that special case does not exist**, because a `TagBinding` *is* an indirection —
`name → ContentId` — and there is no other kind of entry. A "symlink" and a "regular file" differ
only in what the target is, not in what the binding is.

| POSIX | ZetaFS |
|---|---|
| directory entry → inode (the "real" one) | binding → ContentId |
| symlink → path string, re-resolved | binding → ContentId |
| hardlink → second entry, same inode | second binding, same ContentId |

So hardlinks and symlinks converge into one mechanism, and the distinction POSIX draws — *does this
entry own the file?* — has no referent, because **no binding owns anything.** Content is owned by
the store and reachable from any number of names.

The presentation layer must still *emit* POSIX symlinks outward for compatibility. That is a
rendering decision at the FUSE/projection boundary, not a fact about the store.

---

## 6. Multi-parented files

If a binding does not own its target, nothing stops the same `ContentId` being bound under many
parents. That is **multi-parenting**, and it is what makes the namespace a **DAG rather than a
tree**.

It is also where POSIX compatibility gets genuinely hard, and the difficulties should be stated
before anyone builds:

### 6.1 `..` stops being a function

With one parent, `..` is well-defined. With many, *the* parent does not exist — only the parent you
arrived through. Options, none free:

- **Path-contextual `..`** — track the traversal path in the handle. Correct, and it means two
  handles to the same file can disagree about `..`, which some tools will not expect.
- **Designated primary parent** — one binding marked canonical for `..`. Simple, and it reintroduces
  the ownership asymmetry §5 just removed.
- **Refuse `..` above a multi-parented node** — honest, and breaks `cd ..`.

Unresolved. It needs a decision before the FUSE layer, not during it.

### 6.2 Directory cycles

POSIX forbids directory hardlinks precisely to keep the namespace acyclic, because `find` and `rm
-r` do not terminate on a cyclic graph. A DAG is acyclic **by name**, but nothing in the binding
model above enforces it — binding `a/` under `b/` and `b/` under `a/` is expressible.

**The store must refuse a binding that would create a cycle.** Content addressing helps: a
directory node's address depends on its children's addresses, so a genuine cycle is not
constructible without a fixpoint. The danger lives in the *mutable* binding layer, which is exactly
the half that is not content-addressed. This is the single most important guard in the design and
it does not exist yet.

### 6.3 Deletion is unlink, and only sometimes delete

`rm` removes a binding. Content stays reachable while any binding names it. So deletion needs
either refcounting over bindings or mark-and-sweep from roots — and under §3, *history retains
superseded bindings*, so a naive reachability sweep collects nothing, ever. Retention policy and GC
are the same problem and this spec does not solve them.

---

## 7. Platform presentation — FUSE, Windows, macOS

The store is one thing; three projections are another. Known asymmetries, so nobody discovers them
at implementation time:

| concern | Linux (FUSE) | macOS (FSKit / NFS loopback) | Windows (ProjFS / WinFsp) |
|---|---|---|---|
| symlinks | native | native | privileged or developer-mode |
| multi-parent | invisible; presents as hardlinks | same | ProjFS is projection-first, a better fit |
| case | sensitive | **case-insensitive-preserving by default** | insensitive |
| xattrs for phase metadata | `user.*` | native | alternate data streams |

**The case-folding row is a correctness issue, not cosmetics.** If names are tags and the canonical
collation is ordinal (§4), then `Notes.md` and `notes.md` are two tags. A macOS or Windows
projection that folds them presents one tag where the store has two, so a round-trip through those
platforms is lossy. Either the projection refuses colliding-under-fold bindings in the same
directory, or the collation is not ordinal — and the second contradicts a standing rule. **The
projection must refuse.**

Windows `ProjFS` is called out as the *better* fit rather than the harder one: it is designed for a
virtual namespace backed by a remote store, which is what this is.

---

## 8. What this does not settle

Stated plainly, because a design doc that reads as complete is worse than one with holes marked:

1. **`..` under multi-parenting** (§6.1) — three options, no decision.
2. **Cycle prevention in the mutable binding layer** (§6.2) — the most important missing guard.
3. **Retention and GC** (§6.3) — history-by-construction and reachability-GC are in direct tension.
4. **The name** — still gated per the 2026-06-07 doc.
5. **Whether any of this is worth building** — `ZSetMerkle` is landed and the rest is not, and the
   honest register for the whole presentation layer is `toy` until something mounts.

## Anchors (Beacon)

- **Merkle DAG** — Ralph Merkle, *A Digital Signature Based on a Conventional Encryption Function*
  (CRYPTO '87). The hash-of-children construction §2 rests on.
- **Persistent data structures / path copying** — Driscoll, Sarnak, Sleator & Tarjan, *Making Data
  Structures Persistent* (JCSS 1989). The technique content addressing forces on you.
- **Git's object model** — immutable objects + mutable refs; the worked precedent for §2.
- **Plan 9 union directories** (Pike et al.) — a namespace where one name resolves through several
  sources, the closest existing system to §6's multi-parenting.
- **APFS snapshots** — the point-in-time model §4 deliberately inverts (retain-by-construction
  rather than snapshot-on-request).
- **Goguen & Meseguer noninterference (1982)** — via the local-time rule §4 depends on.
