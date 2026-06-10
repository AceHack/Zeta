# clis/ — the CLI verb family (always plural), at root

`clis/` is the home of Zeta's **CLIs** — the short 3-letter verbs that drive the substrate over the
startup MerkleDAG (the MacVector-for-DNA toolset). **Plural** (never-one): a family, not one binary.

## The verb family — `sim · mea · cut · ben · cla · res` (Aaron 2026-06-10)

**Abbreviation model — diskpart-style minimum-unique prefix (Aaron 2026-06-10):** the full word **and**
any **unambiguous prefix** resolve to the same verb — `measure` ≡ `measu` ≡ `meas` ≡ `mea`;
`simulate` ≡ `sim`; `classify` ≡ `cla`; `resolve` ≡ `res`; `benchmark` ≡ `ben`; `cut`. This is exactly
how **diskpart** works (`list disk` ≡ `lis dis`, `select` ≡ `sel` — the minimum unique abbreviation).
The 3-letter stems below are just the *guaranteed-unambiguous shortest* form, chosen so they never
collide (e.g. `cut`/`cla` diverge at the 2nd letter: `cu`→cut, `cl`→cla). Ambiguous prefixes are
rejected, not guessed.

Each is a stem with the suffix dropped (three letters):

| verb | word | role | commits? | residue |
|------|------|------|----------|---------|
| **`sim`** | sim(ulate) | run the deterministic sim for a duration | **no** | `unit` (void → identity comes from the void) |
| **`mea`** | mea(sure) | `mea(sim)`: lift sim + commit the measurement | **yes** | `Measurement` (ΔU); real I/O via DI adds *new external* observation |
| **`cut`** | cut | cut at a recognition site (a TIME; default 30s) | **yes** | `Delta × Seam` (Z-set diff + sticky-end the finalizer re-ligates) |
| **`ben`** | ben(chmark) | instrument the sim for perf: the loop `cut mea ben sim` | **yes** | `Benchmark` (timing/allocs/throughput → `bench/`); perf, not ΔU |
| **`cla`** | cla(ssify) | classify the result into a class/lens | **yes** | a **class label** (the discriminator/lens assignment) |
| **`res`** | res(olve) | resolve: loop `mea` **repeatedly until it resolves** | **yes** | a **fixed point** (ΔU→0; shapes A/B/D) + the resolution |

> **The benchmark loop (Aaron 2026-06-10): `cut mea ben sim`.** `ben` instruments `sim` for
> **performance** (timing / allocations / throughput → [`bench/`](../bench/)) — the perf sibling of
> `mea`'s uncertainty-reduction (ΔU). So the loop has two measuring verbs: `mea` (how much uncertainty
> did we reduce) and `ben` (how fast / cheap was it). `cut mea ben sim` = simulate, benchmark, measure,
> cut. (Routes perf to Naledi.)

- **`sim`** — ephemeral; produces no output. The SETI@home edge run (`sim <duration>`, default 30s).
  **Implemented:** `src/Core/Sim.fs` — `Sim.run (seed) (duration)` runs the deterministic finalizer
  loop for the duration (60Hz tick budget) and returns `unit` (the void); never merges (that's
  `mea`/`cut`); bounded + DST-replayable (tests in `tests/Tests.FSharp/Sim.Tests.fs`). The console
  `sim` binary is the thin wrapper over this (next).
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

The interface stubs for the five verbs live in [`Verbs.fs`](Verbs.fs) — pure interfaces, no classes
(the meta-rule).

### Homoiconic across F# · CLI · filesystem — the `fs` pun (Aaron 2026-06-10)

> Aaron: "`cut mea sim` works on the CLI too, like currying — homoiconic to **fs**: **F#** /
> **filesystem** homoiconicity."

`cut mea sim` is **the same expression in three registers** — code = data = tree (homoiconicity, the
Lisp property: program and data share one representation). The pun is **`fs`**:

- **F# code** — `cut mea sim` as curried functions (point-free composition).
- **the CLI** — `cut mea sim` on the command line: the **shell** curries too (partial application /
  composition of the verb commands). Same expression, run as a command.
- **the filesystem** — the startup **MerkleDAG** (the `fs`) *is* that structure: folders/paths are the
  same tree the F# and the CLI walk. The filesystem is the code.

So **F# ≅ CLI ≅ filesystem** — one homoiconic structure. Writing `cut mea sim` in F#, typing it at the
shell, and walking the MerkleDAG are the *same act* over the *same representation*. (This is why the
folder structure is load-bearing: the filesystem is not a container for the code — it **is** the code,
homoiconically.)

## Outside the cube — the Cayley mini-cubes (cognitive/query verbs) (Aaron 2026-06-10)

`sim · mea · cut` is the **main cube** (the RGB primaries; the run/commit loop). `ben · cla · res` are
**axes around it** (perf / classify / iterate). Beyond those sit two **mini-cubes over Cayley** — the
**cognitive / query** verbs, paired as natural-language phrases:

> Aaron: "(outside the cube) rem(ember)/whe(n) \ pay/att(ention) — mini cube over cayley" · "also
> how/man(y) \ whi(ch)/way over cayley."

- **Mini-cube A — memory + attention:** **`rem`(ember) · `whe`(n)** ("remember when") and **`pay` ·
  `att`(ention)** ("pay attention"). `rem` recalls from the persona entropy / git history (the reified
  types); `whe` is the temporal query (quantum-phase time — *when*); `pay`/`att` are the attention pair
  (focus / weight where to look — the transformer "pay attention"; ties the bug→reward `pay` economy).
- **Mini-cube B — quantity + direction:** **`how` · `man`(y)** ("how many") and **`whi`(ch) · `way`**
  ("which way"). `how`/`man` = the counting/cardinality query; `whi`/`way` = the navigation query
  (which direction over the tree — the `bounds/` dashboard walk).

**"Over Cayley"** = these mini-cubes are situated over the **Cayley structure** — the Cayley graph
(group generators → navigation) / the **Cayley–Dickson** phasor spiral (the doubling that gave us the
shape-F attractor). The main cube *acts*; the Cayley mini-cubes *query/navigate* over the algebra that
generates the space. (Together they read as English phrases — remember-when, pay-attention, how-many,
which-way — the interrogatives + how/many/which/way: the substrate's introspection verbs.)

*(Peel: the core six (`sim·mea·cut·ben·cla·res`) have settled semantics + stubs in `Verbs.fs`; the
Cayley mini-cube verbs are **forming** — captured as the cognitive/query layer, semantics to crystallize
(no stubs yet). "Over Cayley" = Cayley graph / Cayley–Dickson, to formalize with the math team.)*

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
