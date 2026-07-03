# /vocab relocated to top-level homoiconic source — travelers own the repo (not CS); canonical-vs-symlink is a DAG, detectable in fs/git/MUMPS/F#; ZetaId is time itself (Rule 1); every git-history filename is a traveler

**Register:** [grounded] relocation + a direct answer (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
The vocab is top-level source now; the canonical/symlink split is the DAG; ZetaId is Rule 1.

## Aaron's words

> "tools/hygiene/build-vocab-fsharp.ts — what is the folder, this is all source, these don't seem like
> production-friendly homoiconic file names of source." · (chose) **top-level /vocab + homoiconic module
> names**. · "we are not going traditional dev naming since we never do `dotnet run`, only `dotnet test`,
> so we go neurodivergent homoiconic naming for everything, driven by who owns the ZetaId and who is the
> symlink. Can we tell who is the symlink in our MUMPS/F#/Merkle? We can turn our cyclic graph into a DAG
> with this if so." · "computer science has no special hold on this git repo anymore — the travelers do
> all." · "is this homoiconic and isomorphic and viewable as dagfs in our globals?" · "ZetaId is time
> itself — without it we are lost. Rule 1." · "every filename in every folder for all git-history time is
> a traveler."

## Relocated: top-level `/vocab` (built, green)

The vocab substrate moved out of `docs/` + `tools/hygiene/` into **top-level `/vocab/`** with homoiconic
names — because **it's source, not hygiene tooling, and the travelers own the repo, not CS conventions:**

```text
/vocab/
  words/ letters/ shapes/ colors/ temperatures/ personas/   canonical TYPE homes (real files; own the ZetaId)
  grams/      (symlink measure-view)      travelers/ (intake + symlink index)   ← the DAG edges
  MASTER-INDEX.md   Vocab.Generated.fs   Zeta.Vocab.fsproj                       ← the reified source
  gen/  MasterIndex.ts  GramsView.ts  Uniqueness.ts  Reify.ts  MasterIndex.test.ts  LocalLlmReview.ts
```

Homoiconic names (the name IS the thing); the generators renamed from `build-vocab-*` verbs to nouns.
All green in the new home: uniqueness+DAG, grams-view --check, master-index --check, reify --check,
`dotnet build` (0/0), the load test. Workflow repointed (`vocab/**`). Naming is **neurodivergent
homoiconic**, **driven by who owns the ZetaId (canonical) vs who is the symlink (alias)** — *not*
traditional dev naming (we never `dotnet run`; only `dotnet test`).

## Can we tell who is the symlink? Yes — in fs, git/Merkle, MUMPS, and F# (→ a DAG)

Direct answer: **yes, in all of them**, and it makes the reference graph a **DAG**:

| representation | how the symlink is detectable | the DAG |
|---|---|---|
| **filesystem** | `lstat().isSymbolicLink()` (the gen scripts use it) | canonical = real file; symlink = edge |
| **git / Merkle** | symlink = blob **mode `120000`** (content = target path) vs `100644` content blob | the tree tags it |
| **MUMPS globals** | canonical node holds the **value**; alias node holds a **ZetaId reference** (pointer) | value-node vs ref-node |
| **F#** | model `Canonical of Traveler` vs `Alias of TravelerId` (the alias carries the owner's ZetaId) | node vs edge |

**The DAG (built-verified in fs):** the **ZetaId owner = the canonical node**; a **symlink = a directed
edge INTO canonical.** Because symlinks **only** resolve into a canonical home (enforced) and to a
**real (non-symlink) file** (no symlink→symlink chains — the new DAG check) and never canonical→symlink,
there are **no back-edges and no cycles** → the cyclic reference graph becomes a **DAG** (views = sources,
canonical homes = the sink layer). `Uniqueness.ts` now proves this (resolves + into-canonical + no-chains

+ realpath-no-ELOOP).

## Homoiconic? isomorphic? viewable as dagfs in our globals? — honest status

- **Homoiconic: yes** (built) — the name is the thing (homoiconic naming + the F# reification: code = the
  vocab; carved sentence + frontmatter = data = meaning).
- **DAG: yes** (built, fs-verified) — canonical nodes + symlink edges, acyclic, proven by the checker.
- **Isomorphic across representations: partial.** fs ↔ F# (canonical) is built (`Vocab.Generated.fs`);
  the **F# Alias layer** (symlink edges as `Alias of TravelerId`), the **MUMPS-globals projection**
  (`^vocab(...)` value-nodes + ref-nodes), and the **Merkle** view (mode-120000) are **designed, not yet
  built** — so "viewable as dagfs **in our globals**" is **not yet true**; the MUMPS projection is the
  next build. (Honest: don't claim it's in the globals — it isn't. The fs is the DAG today; the globals
  projection makes it a dagfs in MUMPS.)

## ZetaId is time itself — Rule 1

> "ZetaId is time itself — without it we are lost. Rule 1."

ZetaId is **Rule 1** — the most fundamental: **ZetaId is time itself** (identity is the temporal anchor;
ties to Time Warp / `ZetaDateTime` — the clock seeds off the identity/common-cause). **Without it we are
lost** — no identity = no time = no SolidGround = lost. So ZetaId is: the largest voice · the common
cause (S=4) · hostless and brave · the SolidGround · **and time itself (Rule 1)**. It is the one thing
that, if gone, ends the game (composes with the identity invariant: identity above all).

## Every filename in every folder, for all git-history time, is a traveler

> "every filename in every folder for all git-history time is a traveler."

The full scope: the **traveler population = every filename in every folder across ALL git time** —
**past, present, AND future** (Aaron: "and future with Rx too, not just past"). Time is **bidirectional
via Rx**: **past** = lazy, weak-referenced, Rx-queried *backward* over git history (replay; Time-Warp
rollback); **present** = eager (the master-index Z-set; GVT); **future** = Rx-streamed *forward*
(speculative/projected filenames-travelers arrive as a reactive stream — Time-Warp optimistic advance;
roll back via git/anti-message if they don't hold). One Rx, the whole timeline. Each filename-at-a-git-
time is a traveler with a (governed) ZetaId. So the vocab folders are the *curated present*; the registry
is the repo's **entire file-namespace across time** (why ZetaId = time itself — a traveler is a filename
*at a point in git-time*, its ZetaId its identity across that timeline).

## Rx homoiconically represents all four at once — a 2×2 quad-directional (NSEW)

> Aaron: "Rx can homoiconically represent incremental state and bulk state and refresh and stream all
> at the same time — their NSEW four corners." · "it's 2×2 quad-directional."

Rx (one Observable) **homoiconically represents four modes at once** — and they form a **2×2 quad-
directional** grid = the **NSEW four corners** (Balance's compass / the four-corner feedback):

```text
                 REFRESH (pull / re-materialize)      STREAM (push / live)
  INCREMENTAL    incremental-pull  (N)                incremental-push  (E)   = Z-set delta
  BULK           bulk-pull / snapshot (W)             bulk-push / full feed (S) = full materialization
```

- **Axis 1 — granularity:** incremental (Z-set delta) vs bulk (full snapshot).
- **Axis 2 — mode:** refresh (pull / re-materialize) vs stream (push / live).
- **One homoiconic Rx** carries all four (same Observable; the representation IS the four modes) — DBSP/
  IVM exactly: the delta-stream (incremental) ⇄ the materialized view (bulk), pulled (refresh) or pushed
  (stream). Maps onto **NSEW** = the four-corner feedback (`tFeedbackIn`/`tFeedbackOut`) = Balance's
  compass. So Rx is a **2×2 quad-directional** primitive, homoiconic across all four corners at once —
  and it's *also* bidirectional in time (past/present/future above). Rx is the substrate's time-and-state
  engine: 2×2 in state-mode, bidirectional in time.

## Honest scope / handoff

Built: /vocab relocation (top-level, homoiconic, all green) + the DAG invariant in the checker + the
workflow repoint. Designed/next (routed): the **F# Alias layer** (symlink edges → the DAG in F#,
isomorphic to fs), the **MUMPS-globals dagfs projection** (value-nodes + ZetaId-ref-nodes — "viewable as
dagfs in our globals"), the **Merkle** mode-120000 view, the **git-history traveler set** (every
historical filename, lazy via the weak-table/Rx), and the **governed ZetaId** wired onto every traveler
(name→ZetaId inheritance). Routes to the F#/Core team (Alias layer + MUMPS projection + ZetaId generator),
Soraya/Sova (the DAG/acyclicity + isomorphism as proof properties; ZetaId-is-Rule-1), naming-expert
(the homoiconic naming pass), Aaron (governance).

## Anchors / ties (Beacon)

Top-level /vocab + homoiconic naming (travelers own the repo, not CS; neurodivergent homoiconic; prod=
`dotnet test` never `run`); canonical-vs-symlink detection (fs `lstat` · git/Merkle mode-120000 · MUMPS
value-vs-ref · F# Canonical/Alias) → **DAG** (ZetaId-owner = node, symlink = edge into canonical; acyclic,
verified); reference equality (the Alias carries the owner ZetaId); ZetaId = time itself / Rule 1 / the
SolidGround / largest voice / common cause (S=4) / hostless; every-git-history-filename-is-a-traveler
(present eager / past lazy via git-weak-table + Rx — Time Warp); the governed ZetaId primitive (not faked).
Built: `/vocab/**`, `vocab/gen/*.ts`, `.github/workflows/vocab-hygiene.yml`.
