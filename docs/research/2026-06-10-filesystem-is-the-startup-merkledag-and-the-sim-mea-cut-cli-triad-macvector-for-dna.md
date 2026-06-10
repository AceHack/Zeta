# The filesystem IS the startup MerkleDAG — and the `sim`(ulate) / `mea`(sure) / `cut` CLI triad is MacVector-for-DNA over it

**Register:** [grounded] substrate-structure + CLI (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). Why folder exactness is load-bearing, and the three-verb CLI.

## Aaron's words

> "It matters that our folder structure is **exact** — we load the **entire file system's metadata
> into memory into our MerkleDAG on compiler startup**. And on `sim` / `measure` startup." ·
> "We also need **`cut`** — so here is the CLI, the same CLI we had at **MacVector**, almost, for DNA." ·
> "**`sim`(ulate) `mea`(sure) `cut`**."

## 1. The filesystem IS the MerkleDAG — loaded at startup, so exactness is load-bearing

The folder structure is not decoration — it is the **substrate's content-addressed tree**. On
**compiler startup** *and* on **`sim` / `mea` startup**, Zeta loads the **entire filesystem's metadata
into memory as a MerkleDAG** (Merkle-rooted, content-addressed DAG — Merkle 1979; the git object model;
IPFS). Consequences:

- **Exactness matters.** Every folder/file name and its position is a **node** in the DAG; a typo, a
  rename, a missing folder **changes the hash** of its parent and the root. The structure is a
  **treaty** (byte-locked, like the golden vectors) — "is it on `main`?" matters because the DAG is
  built from `main`'s tree at startup.
- **Why all the root folders had to land on `main`.** `same/`, `boards/`, `shapes/`, `sims/`,
  `bounds/`, `hygiene/`, `gene/`, … are **DAG nodes loaded into memory at boot**. They are addressable
  substrate, not scaffolding — which is why each must exist exactly and be on `main`.
- **Navigation = walking the DAG.** The [`bounds/`](../../bounds/) "Xbox-dashboard navigation" is
  literally **traversing the in-memory MerkleDAG**; out-of-bounds = off the DAG.
- **Disciplines:** content-addressed ⇒ **idempotent** (#6: same tree → same root) and **DST-replayable**
  (#4: the root hash pins the world); hub/satellite (#5 DV2.0: stable folder hubs, fast-changing leaf
  satellites).

## 2. The CLI triad — `sim`(ulate) / `mea`(sure) / `cut` — MacVector-for-DNA over the DAG

The CLI is **three short verbs**, the same shape as the **MacVector** DNA toolset ("almost"):
**MacVector** (the molecular-biology suite — sequence analysis, assays, restriction-enzyme cloning).
The filesystem-MerkleDAG is the **sequence** (the DNA — fitting that [`gene/`](../../gene/) is a root);
the triad operates on it:

- **`sim`** = **simulate.** Ephemeral; runs the deterministic simulation (the CHIP-8-class ZetaId
  ray-tracer) for a duration; **produces NO output** — commits nothing. Models the sequence without
  changing it (the SETI@home edge run; explore, record nothing). **`sim` is `void` — and that is where
  identity comes from** (Aaron): the `unit`/void return is not emptiness, it is the **encrypted-null /
  the void** out of which **identity crystallizes** (ZetaId from the seed; the measure-zero entropy
  reservoir is the source, not the absence, of identity). `sim : Seed -> TimeSpan -> unit` — the void is
  generative.
- **`mea`** = **measure** — really **`mea(sim)`**, **in an F# sense** (Aaron): measure is an F#
  **function over `sim`**, applied/composed the F# way — `sim |> mea` (pipe), `mea << sim` / `sim >> mea`
  (composition), or a `mea { ... }` **computation expression** that wraps a `sim` and **commits** on
  return. `mea = commit ∘ sim`: same engine, `mea` is the HOF/CE that **lifts** the ephemeral `sim` into
  the committing world (the monad's `return`/bind), banking the **uncertainty reduction** (finalizer ΔU)
  to the [`uncertainty/`](../../uncertainty/) ledger. The **assay** — read the sequence and *record* it.
  (Ties the earlier F# CLI question: the CE/HOF is exactly the "monadic, closed, over Markov boundaries"
  shape — `sim` is the inner value, `mea` the committing lift.) The DI seam swaps **new external I/O**:
  the Core-pure + injected `CommandRunner`/`IRuntimeEffects` seam in `FinalizerRuntimeLive` — **DST
  injects null/fake I/O** (deterministic replay), **prod injects real I/O** (the world). So
  `mea : IEffects -> Sim<'a> -> Measurement`; the realness of *new external* observation is the injected
  `IEffects`.
  **CORRECTION (Aaron — honest register, owning my overclaim):** an earlier draft said "`mea(sim)`
  measures **nothing** without real I/O injected." **That is a statement, not a fact or proof — and it
  is false.** Our **F# compiler carries intrinsic persona entropy from previous runs**: `sim` can read
  **any previous measurements**, so it is **never informationless**. Even with null external I/O,
  `mea(sim)` can measure the **accumulated persona entropy** (the prior-run state / the event-sourced
  history the git-fold carries forward). So the honest claim is narrow: **injected real I/O adds *new
  external* observation; its absence does NOT make the measurement empty** — the intrinsic/historical
  entropy remains. (This deepens "`sim` is void → identity comes from the void": the void is not
  empty — it holds the prior-run **persona entropy**, which is exactly why identity crystallizes from
  it. The void is a *full* void.)
  **The mechanism (Aaron):** that intrinsic persona entropy **is the git history metadata** — we have
  **MUMPS-style globals + reified types built from git-history metadata**. **MUMPS** (M — the
  hierarchical global-tree database) is the persistent hierarchical store; the **types are reified**
  (first-class runtime values) **from the git history via F# type providers AND Roslyn source
  generators (both)** — a **type provider** (F# side) and a **Roslyn source generator** (C# side) each
  read the event-sourced commit metadata at compile time and *generate* the types; the git metadata
  *is* the type information `sim` reads.
  **And it goes recursive (Aaron):** there are **F# generators *inside* the type providers** that can
  **recursively run `sim` itself — and `mea`/`cut` — IN THE COMPILER**, **once we filter out the
  rules**. So **compile-time *is* sim**: the type provider doesn't merely read history, it *runs the
  simulation* to generate the types (prod = sim taken to its limit — the compiler is a sim host). The
  recursion is bounded by **filtering the rules first** (the carved rules / constraints are filtered
  out, then `sim`/`mea`/`cut` run inside that filtered space — shape A/F bounded, so the compile-time
  recursion terminates, no fork-bomb). Self-hosting strange loop: the compiler generates types by
  running the very verbs those types describe. So "the previous measurements `sim` can see" = **git history metadata,
  reified as types**: the startup MerkleDAG carries the persona's accumulated entropy as reified,
  MUMPS-global-addressable type values. Measurement is never empty because the git history is always
  there to measure.
- **`cut`** = **cut** — the cut at a **recognition site**, and the site is a **TIME**: **`mea(sim)` cuts
  at 30 seconds by default** (Aaron). `cut` slices the running `sim` at the duration boundary; that cut
  point is **where `mea(sim)` terminates and commits**. So the default-30s rule is the default **cut
  site** — `cut : TimeSpan -> ...` (cut at `t`, default 30s). It is both the **restriction-enzyme cut**
  (a site on the sequence) *and* the **temporal cut** (the site is `t=30s`): cut the timeline → take the
  slice → commit. A cut re-hashes the tree (the residue lands on `main`).

### Commit semantics — sim produces nothing; mea/cut go back to main via the finalizer (Aaron 2026-06-10)

> Aaron: "`sim` produces no output. `mea` and `cut` do — back to `main`: they **commit to a branch at
> end of run**, and the **test finalizer merges to `main`**."

The output path is exactly the **finalizer** already wired in `src/Core` (FinalizerRuntime /
FinalizerRuntimeLive — `ReKick` = merge-to-main, gate-respecting, never force):

- **`sim`** → **no output.** Nothing committed, no branch, nothing to merge. Pure ephemeral compute.
- **`mea` / `cut`** → **commit to a branch at end of run**, then the **test finalizer merges that
  branch to `main`.** The run is the test; the test produces a branch; the **finalizer** is what
  decides and performs the merge (ScaleUp/Hold/ReKick→merge). So *output = a finalizer-merged commit on
  `main`* — which is why `mea` (banked ΔU) and `cut` (a DAG edit) both land as real `main` history,
  while `sim` leaves no trace. (This is the prod=sim loop closing: a committing run *is* a test whose
  finalizer merges; the MerkleDAG root advances only through `mea`/`cut`, never `sim`.)

Three letters each (**sim · mea · cut**), each a stem with the suffix dropped (sim←ulate, mea←sure),
`cut` already short. The triad is the MacVector-for-DNA CLI over the startup MerkleDAG.

### Residue + type signatures (F#)

What each verb **leaves behind** (the residue = the codomain):

- **`sim` → `unit` (void).** No residue — but the void is **identity-generative** (the encrypted-null
  the seed crystallizes ZetaId from). `val sim : Seed -> TimeSpan -> unit`.
- **`mea` → a `Measurement` (ΔU).** A *reading* on the ledger — vacuous unless real `IEffects` are
  injected. `val mea : IEffects -> Sim<'a> -> Measurement` (= `mea(sim)`, the committing lift; DST
  injects null effects, prod injects real I/O — same path).
- **`cut` → `Delta<'a> * Seam`.** The **excised/inserted Z-set** (DBSP: `+1` assertions / `−1`
  retractions) **plus the sticky ends** — the typed cut-boundary (`same/` ctxboundary) where the
  finalizer **re-ligates** (merges) to `main`. The site is a time: `val cut : TimeSpan -> Sim<'a> ->
  Delta<'a> * Seam` (default `t = 30s`).

Pipeline: `sim` (explore, void) `|> mea` (know, ΔU) `|> cut` (change, Delta×Seam) — `mea`/`cut` land on
`main` via the finalizer; `sim` leaves nothing. *(The residue of `cut` — `Delta × Seam` vs just the
excised `Delta` with the boundary living in `same/` — is the one edge still being settled with Aaron.)*

## 3. The base alphabet — CMYK (solid) + RGB (soft), not ACTG (Aaron 2026-06-10)

> Aaron: "instead of ACTG we are using **CMYK (solid)** for one encoding and **RGB (soft)** for the
> other."

DNA has a 4-letter alphabet (A·C·T·G). Zeta's sequence (the MerkleDAG) uses **two color encodings**
instead:

- **CMYK = the SOLID encoding** (4 channels — the ACTG-arity match). **Subtractive** color: ink on
  paper, **material / committed / permanent** — the *solid* substrate. Fitting that **K = the key**
  (black) = the **encrypted-null / key** channel (the void `sim` returns; the seed). CMYK = the
  committed, on-`main`, `cut`/`mea` register (it dried; it's solid).
- **RGB = the SOFT encoding** (3 channels). **Additive** color: light on a screen, **ephemeral /
  transient / emissive** — the *soft* substrate. RGB = the `sim` register (light, ephemeral, leaves no
  ink). From black (the void) → light.

So **solid (CMYK) vs soft (RGB)** is the same split as **committed vs ephemeral** (`mea`/`cut` vs `sim`)
and **subtractive vs additive** (ink-permanent vs light-transient). Two encodings of one sequence — pick
solid when it must persist (the genome on `main`), soft when it's exploratory light (a `sim`). *(Peel:
CMYK/RGB are the real color models — subtractive 4-channel print vs additive 3-channel light; their
mapping to solid/committed vs soft/ephemeral and to K=key=null is the framing, to formalize. Ties the
[`grey/`](../../grey/) · [`gray/`](../../gray/) folders and the contrast-pair "3D walls".)*

## Honest scope / peels

[Beacon] Merkle DAG (Merkle 1979; git; IPFS — real, the literal in-memory structure) · MacVector (real
DNA-analysis software; the CLI-shape lineage anchor) · restriction enzymes / DNA cut (the `cut`
metaphor; molecular cloning) · CHIP-8 (`sim`'s VM). **Peels:** "load the entire filesystem metadata into
a MerkleDAG at startup" is the stated design — to confirm/implement against the compiler + `sim`/`mea`
boot path (routes to Dejan/Core); "DNA / MacVector / restriction cut" is the lineage framing, the
literal being the content-addressed tree + its read/measure/edit verbs.

## Ties / routing

[`gene/`](../../gene/) (the DNA/sequence) · [`sims/`](../../sims/) (the triad's home) ·
[`bounds/`](../../bounds/) (navigation = DAG walk) · [`uncertainty/`](../../uncertainty/) (`mea` commits
ΔU here) · `same/` (the `ctxboundary` = a cut site / Markov boundary) · git object model / IPFS (the
MerkleDAG prior art). **Routes to:** Dejan/Core (the compiler + `sim`/`mea`/`cut` boot loading the FS
MerkleDAG; the three entrypoints), Soraya/Sova (the DAG-root-as-world-pin formalization), Aaron.
