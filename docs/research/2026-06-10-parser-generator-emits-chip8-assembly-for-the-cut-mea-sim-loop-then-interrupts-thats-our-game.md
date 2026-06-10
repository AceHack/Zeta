# A parser generator that emits CHIP-8 assembly for the `cut mea sim` loop — then tie in interrupts: that's our game

**Register:** [grounded] build-plan (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). The architecture for "our game" — the runnable substrate.

## Aaron's words

> "We write a **parser generator** that generates **CHIP-8 assembly** for that loop, and then we will
> tie in **interrupts** — **that's our game**."

## The build

The `cut mea sim` curried loop (the [`clis/`](../../clis/) verb family) gets a **runnable target**: a
**parser generator** compiles it down to **CHIP-8 assembly**, and **interrupts** make it interactive —
the result is **the game** (the CHIP-8-class VM that *is* `sim`).

### 0. From the F# itself — pure interfaces, no classes (Aaron 2026-06-10)

> Aaron: "from the F# itself — that's pure interface, right? no class?"

**Yes: pure interfaces, no classes.** The CHIP-8 asm is generated **from the F# itself** — the
**interface definitions** are the source the generator reads, not concrete classes. F# **interfaces**
(abstract members only; no class, no instance state) are the **pure boundary**: nothing to reflect over
but the *shape*, so the generator emits asm from the interface contract directly. This is exactly the
[`universal/`](../../universal/) discipline (**interfaces = universal shapes**) and Core-pure
(Result-over-exception, no hidden class state). The loop's verbs (`sim`/`mea`/`cut`) are **interface
members**; `cut mea sim` (curried) is interface composition; the generator ([`gen/`](../../gen/)) turns
those pure interfaces into CHIP-8 opcodes. No class state ⇒ DST-deterministic ⇒ byte-lockable across
the four oracles.

### 1. Parser generator → CHIP-8 assembly

A **parser generator** (F#: FParsec — `Parser<'a>` is a monad, the "monadic, closed, over Markov
boundaries" shape from the F#-CLI discussion; or Argu for the closed verb DU) parses the **`cut mea
sim`** loop expression and **emits CHIP-8 assembly** for it. So the curried loop (`cut (mea (sim))`,
currying = the wiring) is **compiled**, not interpreted — the parser is the front end, CHIP-8 asm the
back end. CHIP-8 (Weisbecker 1977; ~35 opcodes) is the **minimal honest target**: small enough to
byte-lock across the four oracles, DST-replayable, the common-ground emulator floor (`hooks/`).

- **Front end:** parse the loop / the sim program (the grammar over the MerkleDAG sequence).
- **Code gen:** emit CHIP-8 opcodes for `sim` (run), `mea` (measure→commit), `cut` (cut at site).
- **Why a *generator*:** it writes the asm from the parsed loop — ties the type-provider / Roslyn-gen
  story (generators that run `sim`/`mea`/`cut` in the compiler): the parser generator is the same move
  at the asm level.

### 2. Tie in interrupts → the game

CHIP-8 has **timers** (delay + sound, 60Hz) — the seed of **interrupts**. Tying interrupts in makes the
loop **interactive / reactive**: an interrupt fires an action mid-loop. This is exactly
[`triggers/`](../../triggers/) (**act-on-condition**) and the finalizer's `ReKick` — the interrupt *is*
a trigger. With interrupts wired, the `cut mea sim` loop becomes a **playable game**: input/timer
interrupts drive the loop; `sim` renders (ray-traced ZetaId), `mea`/`cut` commit, interrupts steer.
(The Cheat-Engine lineage: triggers / conditional breakpoints are interrupts on the running game —
`hooks/`.)

## Why it matters

This is the **runnable bottom** of the whole stack: the abstract `sim`/`mea`/`cut` loop gets a real
compile target (CHIP-8 asm via a parser generator) and real interactivity (interrupts = triggers). It
makes "prod = sim" concrete — the game is the simulation, compiled to the minimal VM, driven by
interrupts. Bounded (shape A/F; CHIP-8 is tiny and total → terminates, DST-replayable).

## Honest scope / peels

[Beacon] CHIP-8 / Weisbecker 1977 (real minimal VM + timers) · parser generators (yacc/ANTLR lineage;
F# FParsec monadic combinators, Argu closed-DU) · interrupts / interrupt service routines (real;
CHIP-8's 60Hz timers are the hook) · DBSP/Z-set (`cut`'s delta). **Peels:** "that's our game" — the
game *is* the running compiled loop; building the parser-generator + CHIP-8 codegen + interrupt wiring
is the **work to do** (routes to Core team), not yet built. CHIP-8 is the chosen minimal target; a
richer target can come later.

## Ties / routing

[`clis/`](../../clis/) (the `cut mea sim` loop being compiled) · [`triggers/`](../../triggers/) +
[`hooks/`](../../hooks/) (interrupts = act-on-condition = the Cheat-Engine hook) · [`sims/`](../../sims/)
(the game = the sim) · the F#-CLI discussion (FParsec/Argu as the parser generator) ·
`docs/research/2026-06-10-filesystem-is-the-startup-merkledag-and-the-sim-mea-cut-cli-triad-macvector-for-dna.md`
(CHIP-8 = the VM; the triad). **Routes to:** the Core team (parser generator + CHIP-8 codegen +
interrupt wiring), Soraya (the grammar / asm byte-lock), Aaron (the game).
