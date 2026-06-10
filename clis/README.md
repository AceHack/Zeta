# clis/ — the CLI verb family (always plural), at root

`clis/` is the home of Zeta's **CLIs** — the short 3-letter verbs that drive the substrate over the
startup MerkleDAG (the MacVector-for-DNA toolset). **Plural** (never-one): a family, not one binary.

## The verb family — `sim · mea · cut · cla · res` (Aaron 2026-06-10)

Each is a stem with the suffix dropped (three letters):

| verb | word | role | commits? | residue |
|------|------|------|----------|---------|
| **`sim`** | sim(ulate) | run the deterministic sim for a duration | **no** | `unit` (void → identity comes from the void) |
| **`mea`** | mea(sure) | `mea(sim)`: lift sim + commit the measurement | **yes** | `Measurement` (ΔU); real I/O via DI adds *new external* observation |
| **`cut`** | cut | cut at a recognition site (a TIME; default 30s) | **yes** | `Delta × Seam` (Z-set diff + sticky-end the finalizer re-ligates) |
| **`cla`** | cla(ssify) | classify the result into a class/lens | **yes** | a **class label** (the discriminator/lens assignment) |
| **`res`** | res(olve) | resolve: loop `mea` **repeatedly until it resolves** | **yes** | a **fixed point** (ΔU→0; shapes A/B/D) + the resolution |

- **`sim`** — ephemeral; produces no output. The SETI@home edge run (`sim <duration>`, default 30s).
- **`mea`** — the committing lift over `sim` (F# HOF/CE: `sim |> mea`); banks ΔU to `uncertainty/`.
  Injecting real I/O via DI adds *new external* observation (DST = null effects; prod = real). It does
  NOT make a null-I/O measurement empty: `sim` always carries **intrinsic persona entropy from previous
  runs** — git history metadata, reified as types **via F# type providers AND Roslyn source generators (both)** —
  so measurement is never informationless. ("measures nothing without I/O" was a statement, not a proof; corrected.)
- **`cut`** — the structural/temporal cut; `mea(sim)` cuts at 30s by default; residue re-ligated to `main`.
- **`cla`** — **classify**: assign the cut/measured thing to a **class** (the `same/` discriminator /
  the polarity-lens; the observe.ts/local-LLM classifier lineage). Turns a measurement into a *category*.
- **`res`** — **resolve**: the loop verb — run `mea(sim)` **repeatedly until it resolves** (the
  finalizer iterates until ΔU→threshold; a fixed-point shape A/B/D). "Resolves" twice: **converges**
  *and* gains **resolution** (the infinite-resolution zoom). `res` is how a board-room question is settled.

Commit semantics: `sim` leaves nothing; the rest commit to a branch → the **test finalizer merges to
`main`** (the wired `FinalizerRuntime` `ReKick`). The MerkleDAG root advances only through the
committing verbs, never `sim`.

## How they compose

```text
sim            explore (void)
 |> mea        know        (ΔU committed; real I/O via DI)
 |> cut        change      (Delta × Seam at t=30s)
 |> cla        classify    (assign a class/lens)
 |> res        resolve     (loop until fixed point)
```

`res` wraps the loop (`res = repeat mea until resolved`); `cla` labels; `cut` writes; `mea` records;
`sim` is the void base every other verb lifts.

### The loop in F# — `cut mea sim` by currying (Aaron 2026-06-10)

> Aaron: "so in F# `cut mea sim` with currying should do it — that's the loop."

In F#, the verbs are **curried functions**, so the loop is just **`cut mea sim`** — currying composes
the three into one. `sim` is the inner (void) value; `mea` lifts it (commits the measurement); `cut`
takes the measured value and writes the delta — `cut (mea (sim))`, written point-free by currying. The
**loop** is that curried composition iterated by the finalizer (= `res`): re-apply `cut ∘ mea ∘ sim`
until it resolves (ΔU→0; shape A/B/D). No glue code — currying *is* the wiring. (`cla` slots in where a
class is needed; the core engine loop is `cut mea sim`.)

## Honest scope

[Beacon] MacVector (the DNA-CLI shape lineage) · CHIP-8 (the minimal VM `sim` runs) · DBSP/Z-set (the
`cut` delta) · Haskell-Prelude lawful-instance discipline (the verbs are lawful, not ad-hoc). **Peel:**
the verbs are the chosen names; the engine is real (`Clock.fs` DST, the wired finalizer); the entrypoints
themselves are to implement. F# CLI candidates: Argu (closed DU) / FParsec (monadic boundary parse) /
FSharp.SystemCommandLine (CE) — see the F#-CLI discussion.

## Pointers

- [`sims/`](../sims/) (the simulations `sim`/`mea` run; the measurement home) · [`boards/`](../boards/)
  (the board room — settled by `res`) · [`models/`](../models/) (parameters for the tests) ·
  [`uncertainty/`](../uncertainty/) (ΔU `mea` commits) · [`bounds/`](../bounds/) (navigation).
- `docs/research/2026-06-10-filesystem-is-the-startup-merkledag-and-the-sim-mea-cut-cli-triad-macvector-for-dna.md`
  — the triad + MerkleDAG + CMYK/RGB capture (the `cla`/`res` extension lives here too).
- `src/Core/Finalizer*.fs` — the finalizer the committing verbs route through.
