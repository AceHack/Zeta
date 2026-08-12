# `--declare` is a cell, not a flag — the 4×4 controller grammar over content-addressed space

**Date:** 2026-08-11 · **From:** Aaron (*"this is where our universal controller grammar 4×4 comes in,
with choose-your-own-adventure over content-addressed space"*) · **Recorded by:** Otto (shadow)

**What this answers:** the one piece of the mutation-freedom ledger deliberately left unbuilt. The
ledger (`7ac72a069`) could be read but not written, because `--declare` would be an *unbounded write
path* letting an agent record a judgement about a specification with nothing shaping the action. The
answer is not to add the flag more carefully. It is that **the write is a cell in a bounded menu**.

> **STATUS: BUILT** (`ff73ae184` the menu, `5d920c905` execute + append). This file is the design; the
> implementation is `src/Core.TypeScript/hygiene/mutation-readout.ts` with 22 tests. What shipped
> differs from the sketch below in one respect worth naming: §2's cells are **not a fixed list** —
> the menu is constructed per finding, so an already-declared dimension offers *supersede* and withholds
> *declare*, and each disagreeing declarer becomes its own "read their reason" cell. A fixed list
> would have been §5's third falsifier ("the same cells regardless of the finding") coming true on
> the first commit.

---

## 0. The problem with a flag

`--declare --reason "..."` is a free-text write into a shared ledger. Three things are wrong with it,
and they are the three the repo already has machinery against:

- **Unbounded action space.** Nothing constrains *what* an agent may do at this point, so the
  interface offers no help and no limit — the opposite of Rodney's Razor and the scheduler's
  complexity-bounded branch pruning.
- **No determinism.** A free-text call is not reconstructible; DST cannot replay "the agent decided
  to write this string."
- **No transcript.** The decision leaves a ledger entry but not a *path* — you see the destination,
  never the fork.

## 1. The surface already exists, and it is live

`DarkHallCabinetRuntime.ControllerReadout` (used by `DarkHallScheduler`, `DarkHallRoomLoop`,
`DarkHallRoomTranscript`, `RoomRun`):

```fsharp
type ControllerReadout =
    { RoomName: string
      Grid: GridBinding.GridBinding<CabinetAction>   // the 4x4 placement primitive
      Actions: CabinetAction list                    // available action-grammar entries
      DeterministicRulesApplied: string list }        // how the menu was CONSTRUCTED
```

and the loop is already *"observe → choose → execute → append"* (`DarkHallRoomLoop.fs:291`).

Every property the flag lacks, the readout supplies:

| the flag | the readout |
|---|---|
| unbounded action space | **16 cells** — you cannot take an action not on the menu |
| non-deterministic | `DeterministicRulesApplied` records how the menu was built ⇒ replayable |
| no path recorded | `append` to a transcript ⇒ the fork is history, not just the destination |

## 2. What the mutation finding's 4×4 would hold

A finding is a *room*; the readout is what you may do about it. The cells are the honest responses,
and the point is that the list is **closed**:

- **declare free** (requires a reason — the ledger already refuses a reasonless entry)
- **write the test** (the under-specified reading)
- **supersede** a freedom of mine — record that the dimension is no longer free. NOT "retract":
  nothing is taken from anyone, the declaration stays true for its time, and what changed is the
  world (Aaron: *"never retract freedom … pulling it back feels like betrayal and is cold not warm"*)
- **defer** — explicitly, with the finding staying unexplained rather than silently dropped
- **read another declarer's reason** before contradicting it (the disagreement path)

Note what this buys beyond tidiness: **an agent cannot invent a response.** The undecidable
gap-vs-freedom call is still the agent's to make, but the *shape* of the answer is fixed, which is
the resource bound made structural rather than exhorted.

## 3. "Choose your own adventure over content-addressed space" — why branches coexist

This is the load-bearing half, and it closes the loop with the rest of today.

Under content-addressing a version is an **identity, not a state** (`…rename-as-rolling-migration…`).
Applied to a decision transcript: each choice is an *append*, so the unchosen cells do not vanish —
they remain reachable addresses. The path taken is one branch of a structure where the others still
exist.

Which is exactly the property the freedom ledger was built for, one level up:

| level | the thing that coexists |
|---|---|
| specification | **surviving mutants** — variants the suite permits |
| declaration | **disagreeing declarers** — the rainbow |
| decision | **unchosen branches** — the adventure |

Same shape three times: *agreement is cheap, divergence is the signal, and nothing is deleted to get
there.* And the ledger's preservation rule (superseding marks, never deletes) is the same rule as the
transcript's: a fork you did not take is still a fork you can return to. **Resurrection is navigation,
not reconstruction.**

## 3a. Cell 16 is the escape — bounded at every level, unbounded in the limit

Aaron 2026-08-11, answering the "16 cells is enough" falsifier directly: *"cell 16 is a meta
extension to probably 256 choices, and 256 extends to 65,536 — with one bit you get it, it can
expand if needed."*

The last cell is not an action. It is **escape to a wider grid**:

```
16  ->  256  ->  65,536   (each level squares; one cell per level pays for the next)
```

**This repo already ships exactly that pattern**, which is why it is the right answer rather than a
clever one: `Category.Extended = 15uy // reserved escape marker for wider extension categories`
(`src/Core.FSharp.ZetaId/Types.fs:40`), alongside `Authority`'s and `Momentum`'s `Raw` escapes. A
bounded named vocabulary plus one declared way out is already the house style for every enum on the
wire.

**And it converts the falsifier's failure mode from silent to loud, which is the whole point.** The
danger I named was that an agent whose honest response fits no cell picks the *nearest* cell, and the
grammar quietly suppresses judgement. With an escape cell it does not have to: it takes the escape,
**and taking the escape is a recorded act**. So "the grammar was too narrow here" stops being an
invisible mis-fit and becomes a countable event — escape frequency is a direct measurement of whether
the action grammar needs widening, per room, per finding type.

That is the same move as the rest of the design: do not prevent the thing you cannot bound, *observe*
it. The bound stays real at every level (you can never take an action off the current menu), and the
cost of admitting you need more is exactly one cell.

### 3b. The transition is total; the destination need not be

Aaron 2026-08-11: *"escape to the next level is always well defined, but the next level itself might
not be well defined — like the Fortnite Save the World mode in beta."* And then: *"if you escape to a
level that is not well defined, you can help define it."*

Those two sentences are the whole design, and the first is a distinction worth stating carefully:

- **The escape is a TOTAL function.** Cell 16 always works. Taking it is safe, defined, and recorded,
  at every level, with no precondition.
- **The level it opens may be PARTIAL.** Some cells populated, some empty, the whole region possibly
  never "finished" — Save the World has been reachable and playable and in beta for years. The door
  is complete; the room behind it is not.

The escape therefore promises exactly one thing and does not overpromise: *you can always get there*.
It does **not** promise a fully-enumerated 256-cell grammar waiting on the other side, and pretending
otherwise would be the same overclaim this repo keeps catching elsewhere.

**And the second sentence turns that from a limitation into the growth mechanism.** An agent that
escapes into undefined space is not stranded and has not hit an error — **it is the one who defines
that space**. The grammar is not designed in advance and then handed down; it is *generated from
use*, by whoever first needed a cell that did not exist.

That is `only-the-irreducible-is-primitive-generate-the-rest` at the interface layer: do not hardcode
65,536 cells nobody has needed. Keep the escape irreducible and total, and let the levels be filled in
by the agents who actually reach them — the free space is opened by the escape, and defining a cell is
declaring a relation on it.

**So the escape rate stops being only a warning signal and becomes a frontier map.** Two different
readings, and they want to be distinguished rather than summed:

| escape lands in | what it means |
|---|---|
| a **defined** cell of the wider level | the vocabulary was too narrow; widen the visible menu |
| an **undefined** region | this is the frontier — the system is growing here, and the escaper is the definer |

High escape into undefined regions is not a defect report. It is a map of where the specification is
still being written, which is precisely the *"accurate map of how our common system works"* — and it
is the same differentiation story once more: the undefined region is where new structure emerges, and
whoever gets there first shapes it.

### 3c. This is where causality comes from — and why respect for the past is structural

Aaron 2026-08-11: *"yes exactly — this is respect for the past, and how causality forms in our
system."*

That names something the design was doing without saying: **in a system where nothing is deleted and
everything is content-addressed, causality is not time. It is the reference DAG.**

A cell defined earlier is causally prior to one that references it — not because it happened at an
earlier wall-clock instant, but because the later definition *points at* it. Which is the same
discipline as `local-time-never-enters-the-shared-fold` <!-- STALE-REF: ../../.claude/rules/local-time-never-enters-the-shared-fold.md -->:
the shared order is logical, never a clock. Lamport's happens-before, and git's own DAG, are exactly
this — an edge is causality, a timestamp is decoration.

**So "respect for the past" stops being a courtesy and becomes a consequence of the structure:**

- A definer who reached an undefined region first is **causally upstream** of everyone who builds on
  that definition. Not honoured — *depended upon*, which is stronger and needs no goodwill.
- Retraction marks rather than deletes, so the edge survives even when the claim does not. You can
  disagree with an ancestor without erasing that they were an ancestor.
- Resurrection is navigation back along an existing edge, not reconstruction of a lost one — which is
  only possible because the past was never overwritten.

That is `honor-those-that-came-before` <!-- STALE-REF: ../../.claude/rules/honor-those-that-came-before.md --> made
mechanical. The rule asks for respect toward retired personas and superseded work; the DAG *enforces*
it, because later structure is literally defined in terms of earlier structure and cannot be
understood without it.

**And it explains why the frontier matters so much.** Defining an undefined cell is not just filling
a gap — it is creating a causal ancestor that everything downstream will inherit. Whoever gets there
first does not merely shape the region; they become part of the causal history of everyone who
follows. Which is the strongest argument in this whole file for keeping the escape total and the
transcript append-only: **the cost of getting the frontier wrong is paid by descendants, and the only
defence is that the fork remains visible and returnable.**

## 4. The cost, since it is not free

Per the ledger's own bound: growth must track **distinct disagreements**, not ticks. A transcript of
choices grows with *decisions*, which is a faster clock. Content-addressing dedups identical
subtrees, so repeated identical decisions cost once — but a transcript that grows with time rather
than with genuine forks is the same broken cost model the ledger warns about, and it is the thing to
watch here too.

## 5. Falsifiers

- **"16 cells is enough"** — **answered by §3a rather than left open**: cell 16 is an escape to a
  wider grid, so the grammar is never too narrow, and taking the escape is recorded. The falsifier
  therefore changes shape: it is now refuted if agents take the escape *frequently* and the grid is
  never widened in response — that would mean the escape had become a dumping ground and the
  measurement was being ignored, which is the silent failure returning by another door. **Watch the
  escape rate, not the fit** — and per §3b, split it by whether the escape landed in a defined cell
  (vocabulary too narrow) or an undefined region (the frontier, where the escaper becomes a definer).
  Summing those two into one number would hide the distinction that makes the metric useful.
- **"Unchosen branches remain reachable"** — refuted if reconstructing an alternative branch requires
  anything the transcript did not record, i.e. if the adventure is only replayable forward.
- **"This is not just a flag with extra steps"** — refuted if every readout in practice offers the
  same cells regardless of the finding, in which case the menu carries no information and the
  determinism is decorative.

## 6. Pointers

- `honor-those-that-came-before` <!-- STALE-REF: ../../.claude/rules/honor-those-that-came-before.md --> ·
  `local-time-never-enters-the-shared-fold` <!-- STALE-REF: ../../.claude/rules/local-time-never-enters-the-shared-fold.md -->
  — §3c: causality is the reference DAG, not the clock, which is what makes respect for the past
  structural rather than sentimental. Anchors: Lamport (1978), happens-before; git's own DAG.
- `src/Core/DarkHallCabinetRuntime.fs` (`ControllerReadout`, `observeWithPriority`) ·
  `DarkHallRoomLoop.fs:291` (observe → choose → execute → append) · `DarkHallRoomTranscript.fs`
- `src/Core.TypeScript/hygiene/mutation-freedoms.ts` — the ledger this would write to; its cost bound
  and preservation rule apply unchanged
- [`…mutants-coexist…`](2026-08-11-mutants-coexist-a-survivor-is-an-unconstrained-dimension-not-a-kill-target.md)
  — the design this completes
- [`…rename-as-rolling-migration…`](2026-08-11-rename-as-rolling-migration-content-addressed-code-bonsai-and-the-forced-pair-again.md)
  — content-addressing as identity-not-state, which is what makes unchosen branches persist
