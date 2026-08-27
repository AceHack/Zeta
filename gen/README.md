# gen/ — the generators (always plural), at root

`gen/` is the home of Zeta's **generators** — the compile-time machinery that **generates code/types
from pure F# interfaces + git-history metadata**. **Plural** (never-one): a family of generators, one
discipline.

## What generates what

All generators share one move: read a **pure interface** (no class state — [`universal/`](../universal/)
shapes) and/or **git-history metadata**, and **emit** something at compile time. The family:

- **F# type providers** — generate **reified types from git-history metadata** (the persona entropy of
  previous runs, made first-class). The provider reads the event-sourced commit metadata and produces
  types `sim` can see.
- **Roslyn source generators** — the C#-side counterpart (both: F# type providers **and** Roslyn
  generators reify from git history).
- **F# generators inside type providers** — can **recursively run `sim`/`mea`/`cut` in the compiler**
  (once the rules are filtered) → compile-time *is* sim. The self-hosting strange loop.
- **The parser generator → CHIP-8 assembly** — parses the `cut mea sim` loop (FParsec monadic / Argu
  closed-DU) and **emits CHIP-8 opcodes** **from the F# itself (pure interfaces, no classes)**; then
  interrupts ([`triggers/`](../triggers/)) tie in → the game.

## The discipline — generate from pure interfaces, no classes

Generators read **interfaces, not classes**: abstract members only, no instance state. Nothing to
reflect over but the *shape*, so generation is **DST-deterministic** and **byte-lockable** across the
four oracles. (Aaron: "from the F# itself — that's pure interface, no class.") This keeps `gen/`
Core-pure: a generator is a total function `interface (+ git metadata) → emitted artifact`.

**The rule (Aaron 2026-06-10): interfaces are free; classes must be earned under `rules/`.** "The rules
of the game are interfaces — or free; classes have to be earned under `rules/`." An interface is
weight-free (pure shape); a concrete class is **state ⇒ weight ⇒ capture** and is **not free** — it must
be **earned** under an explicit rule. Default to interfaces; a class is a privilege governed under
`rules/`. See `.claude/rules/interfaces-free-classes-earned-under-rules.md`.

## Honest scope / peels

[Beacon] F# type providers (compile-time generated types) · Roslyn source generators · parser
generators (yacc/ANTLR lineage; FParsec monadic combinators) · CHIP-8 (the asm target). **Peel:** the
generators are the **plan/standard**; the parser-gen + CHIP-8 codegen + the recursive-compiler-sim are
**work to build** (route to Core). `gen/` is their home + the discipline (pure-interface, no-class).

**Schema source is AdditionalFiles / JSON IR today, not the store.** Next honest slice:
`TypeSchema` from a `DynamicValue` (store-native), then these generators consume it. That wiring
lives in the **control plane** (data plane stays dumb). Workitem `081M125DNKK087G0R00292E3ET`;
VISION §compiler ladder (DESIGNED).

## Pointers

- [`clis/`](../clis/) (the `cut mea sim` loop the parser-gen compiles) · [`triggers/`](../triggers/) +
  [`hooks/`](../hooks/) (interrupts) · [`universal/`](../universal/) (interfaces = the generators' input) ·
  [`sims/`](../sims/) (the game the asm runs).
- `docs/research/2026-06-10-parser-generator-emits-chip8-assembly-for-the-cut-mea-sim-loop-then-interrupts-thats-our-game.md`
  — the parser-gen → CHIP-8 → interrupts build plan.
- `docs/research/2026-06-10-filesystem-is-the-startup-merkledag-and-the-sim-mea-cut-cli-triad-macvector-for-dna.md`
  — reified types via type providers + Roslyn gens; recursive sim in the compiler.
