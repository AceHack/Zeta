# Interfaces are free; classes must be earned under rules/

Carved sentence:

> The **rules of the game are interfaces** — free, default, **weight-free** (pure
> shape, no instance state). A concrete **class** (state ⇒ weight ⇒ capture) is
> **NOT free**: it must be **earned**, and the earning is governed **under
> `rules/`** (an explicit rule justifies each class). Default to interfaces;
> reach for a class only when you have *earned* it under a rule. Generators read
> **interfaces, not classes** (`gen/`), so pure-interface code stays
> DST-deterministic and byte-lockable across the four oracles.

## Why

A class carries hidden state — weight, in the manifesto sense (§3 weight-free): it
creates capture, breaks DST determinism (state to reflect over), and resists
byte-lock. An interface is pure shape: nothing to capture, total to generate from,
free to compose (`cut mea sim` by currying). So interfaces are the **free default**
(the rules of the game everyone plays by); a class is a **privilege** that must be
*earned* — justified under `rules/` like any other weight-bearing exception. This
is weight-free made concrete at the type level, and it is what lets `gen/`
generate CHIP-8 asm + reified types **from the F# itself** (pure interfaces).

> **This is a META-RULE** (Aaron 2026-06-10): its subject is the `rules/` system itself (a privilege is
> earned *under* `rules/`). Recognized + indexed in `meta/` (rules about rules; shape A self-reference).

## Pointers

- `meta/` — this rule recognized as a meta-rule (rules about rules).
- [`manifesto-11-specifications.md`](manifesto-11-specifications.md) — §3 weight-free (class state = weight).
- `gen/` — generators read pure interfaces, no classes · `universal/` — interfaces = universal shapes.
- `docs/research/2026-06-10-parser-generator-emits-chip8-assembly-for-the-cut-mea-sim-loop-then-interrupts-thats-our-game.md`
  — "from the F# itself — pure interface, no class."
- [`every-bug-has-economic-value.md`](every-bug-has-economic-value.md) — sibling earned-privilege economy (a class, like a reward, is earned).
