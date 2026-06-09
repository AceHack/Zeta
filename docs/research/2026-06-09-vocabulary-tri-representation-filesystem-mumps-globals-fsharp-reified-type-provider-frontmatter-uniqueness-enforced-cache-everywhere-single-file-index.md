# Vocabulary tri-representation — filesystem ↔ MUMPS globals ↔ F# reified type provider; frontmatter; enforced uniqueness; cache-everywhere via a regenerated single-file index

**Register:** [grounded] design + build (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
One content-addressed vocabulary, three representations; uniqueness enforced; a regenerable cache.

## Aaron's words

> "let's get our words/grams/letters — all our filesystem — enforced uniqueness for our model. We can
> also have a travelers folder but it should use symlinks and check them in to git." · "travelers can
> start in travelers without symlinks, but they move to their most natural home and get symlinked from
> there later." · "this can be in our MUMPS-based globals too, in an F# reified type provider, and these
> can have frontmatter too." · "it's small enough to cache all over the place as long as we know how to
> refresh efficiently and build a single-file index of everything over and over as a cache."

## One vocabulary, three representations (DV2.0 — one source, many shapes)

The date-agnostic vocabulary (travelers/words/grams/letters/shapes/colors/temperatures) is **one
content-addressed namespace** with **three faithful representations**, each regenerable from the others:

```text
1. FILESYSTEM (the editable source, git)   docs/grams/1/traveler.md   (frontmatter + carved sentence)
       path = the unique address; symlinks = labels/views (words -> grams/1; travelers/* -> homes)
2. MUMPS GLOBALS (the persistent store)     ^vocab("grams",1,"traveler") = {frontmatter, carved}
       path -> global subscripts; the hierarchical DI tree; same tree, persistent shape
3. F# REIFIED TYPE PROVIDER (the typed view) type Vocab.Grams.``traveler``   (generated)
       reads the tree -> generates F# types; "interfaces are valuable, code regenerates from them"
```

The **path is the unique key** across all three: `grams/1/traveler.md` ≡ `^vocab("grams",1,"traveler")`
≡ `Vocab.Grams.traveler`. (Meijer "types define the code" + the type-provider/Bonsai thread: the
vocabulary *reifies* into types; change a file → regenerate the types/globals. The interface≡proof /
everything-regenerates discipline applied to vocabulary.)

## Frontmatter (the structured half of each carved-sentence file)

Each vocab file can carry **YAML frontmatter** above its carved sentence (same shape as the memory
files), making it machine-readable for the type provider + globals + index:

```yaml
---
name: traveler
category: frame          # what kind of voice/traveler
home: grams/1            # canonical home (the unique address root)
type: traveler
anchor: <prior-art slug> # the Beacon anchor (anchor-to-human-prior-art); a missing anchor = a debt
links: [room, voice]     # related travelers ([[name]] graph)
---

> <the one carved sentence>

→ <pointer to the detail doc>
```

The **carved sentence stays the hub** (human-fast); frontmatter is the **typed satellite** the machine
consumes (the type provider's field source, the global's metadata, the index's columns). Exemplars
applied: `grams/1/traveler.md`, `grams/1/room.md`; the rest gain frontmatter incrementally (additive —
the carved sentence already carries the meaning).

## Enforced uniqueness (built)

`tools/hygiene/vocab-uniqueness.ts` (CI-gated) enforces "enforced uniqueness for our model":

- **One canonical home per traveler** — a term is a real file in **exactly one** category home (grams/<n>,
  letters/<lang>, shapes, colors, temperatures); a grams term-name is globally unique across grams/<n>.
- **Symlinks resolve** — no dangling symlinks (`words -> grams/1`; `travelers/* -> homes`).
- **travelers/ lifecycle** — a real file in `travelers/` is *intake* (not yet homed) and must NOT
  duplicate a homed term; once homed it becomes a symlink into a category home. (Aaron's
  intake → natural-home → symlink-back flow.)

## Cache everywhere + the regenerated single-file index (built)

The vocabulary is **small enough to cache all over the place** (MUMPS globals, the type provider's
generated assembly, memory, the index) — safe *because refresh is efficient and deterministic*:

- **`tools/hygiene/build-vocab-index.ts`** regenerates **`docs/VOCAB-INDEX.md`** — a **single-file index
  of every traveler** (89 currently: category, term, carved sentence, canonical path), **rebuilt over and
  over** as the cache. **Deterministic** (same input → byte-identical output) → it's content-stable, so
  "rebuild over and over" is cheap and a `--check` mode gates staleness in CI.
- **Efficient refresh** = content-addressing: a cache entry is keyed by the file's fingerprint; only
  changed files invalidate. The single-file index is the cheap, always-rebuildable cache that every
  other cache (globals, type provider, memory) can sync from. (Same pattern as `MEMORY.md`/`INDEX.md` —
  a regenerated hub over satellites.)

## Honest scope / handoff

Built this turn: `travelers/` (intake + symlink index, checked in) + the lifecycle README; the
uniqueness enforcer + the regenerable single-file index (`VOCAB-INDEX.md`) + a CI gate
(`vocab-hygiene.yml`); frontmatter schema + two exemplars. To realize the rest: the **MUMPS-globals
projection** (`^vocab(...)` from the tree) and the **F# reified type provider** (types from the
tree/globals); frontmatter across all files (additive); the type-provider/globals as additional caches
synced from the index. Routes to the F#/Core team (the type provider + MUMPS-globals projection — ties
the MUMPS-globals-as-DI + Bonsai + Meijer threads), Dejan (the vocab-hygiene CI gate), naming-expert
(uniqueness/distinctness), the human-anchor discipline (the `anchor:` frontmatter field — missing = debt).

## Anchors / ties (Beacon)

DV2.0 (one source, change-rate-partitioned representations); MUMPS globals as the hierarchical DI/store
tree (path = subscripts); **F# type providers** + Meijer "types define the code" + Bonsai (the reified
typed view; everything regenerates from the interface); frontmatter (the memory-file shape; the typed
satellite); content-addressing (path = unique key; fingerprint-keyed cache; efficient refresh);
`MEMORY.md`/`INDEX.md` (the regenerated-hub-over-satellites pattern); the canonical-home discipline
(grams/1 canonical, words = label); the travelers/ intake→home→symlink lifecycle; anchor-to-human-prior-
art (the `anchor:` field; missing = debt). Built: `tools/hygiene/{vocab-uniqueness,build-vocab-index}.ts`,
`docs/VOCAB-INDEX.md`, `.github/workflows/vocab-hygiene.yml`, `docs/travelers/`.
