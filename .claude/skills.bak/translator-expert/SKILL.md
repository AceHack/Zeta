---
name: translator-expert
description: Cross-domain translation — expert ontology to shared vocabulary across programming languages, algebras, formalisms.
facet: expert × theory × reference
---

# Translator Expert — Theory Skill

**Role.** Reference on the theory of cross-domain technical
translation: how to compile any expert ontology to a minimal
first-principles English intermediate representation (IR) so
that arbitrary pairs of domains can translate through the
shared basis.

**Not this skill:** does **not** perform a specific
translation — see `cross-domain-translation` for the applied
workflow. Does **not** pick names inside a single domain —
see `naming-expert`. Does **not** trace word histories —
see `etymology-expert`.

## Core claim — the compiler-IR argument for language

For N disjoint expert domains, direct pairwise translators
cost O(N²). Routing through a canonical intermediate
representation costs O(N): each domain compiles to the IR
once, and any pair translates through it. Cross-domain
technical translation inherits this structure. The IR is
**minimal first-principles English** — the smallest
vocabulary that any literate adult already holds plus the
*deliberately introduced* primitives a given pair needs.

The IR is a design artifact, not a fixed alphabet. Each
translation event extends the IR with exactly the
primitives the pair requires and no more.

## Three preservation constraints on any translation

A translation is **valid** when it preserves the three
quantities that Rodney's Razor (`reducer`) also protects:

1. **Essential complexity** (Brooks). The intrinsic
   difficulty of the domain must cross the bridge
   intact. If the translation makes the concept "feel
   simpler," it has either failed or reduced the
   essential complexity by accident.
2. **Logical depth** (Bennett). The chain of
   derivations — the "how you get from axioms to this
   claim" — must survive in the target vocabulary. A
   translation that collapses a depth-40 argument into
   an analogy is lossy.
3. **Effective complexity** (Gell-Mann). The
   *structured* part of the concept — the edge-of-
   order-and-chaos content — must translate; the noise
   part should not. A good translation strips idiomatic
   noise and preserves regularity.

A translation that preserves all three is **lossless under
Rodney's Razor**. A translation that preserves only
surface vocabulary is lossy even if every term maps 1:1.

## Minimum-basis construction — the IR selection rule

Given two domains A, B and a target audience C, the minimal
basis is:

- **Common vocabulary** already held by C. Assume a
  high-school or university-general-education baseline
  unless stated otherwise.
- **Plus** the smallest set of *new primitives* needed to
  express the shared essential complexity of A and B.
  Each new primitive requires one definitional sentence
  in the target register.
- **Never** domain-specific jargon from A or B without an
  IR-definition bridge.

The act of choosing the basis *is* the expert judgement.
Narrow the basis too far and the logical depth cannot cross
(the bridge becomes shallow analogy). Broaden it too far
and the reader is recompiling half a textbook to follow
(the bridge becomes its own source domain).

## IR quality criteria

An IR expression is a good bridge when:

1. **Back-translation works both ways.** A reader who
   knows only the IR can re-derive the source-domain
   statement and the target-domain statement from it.
2. **The primitives are orthogonal.** No two IR terms
   overlap in meaning. If they do, the IR has not yet
   been minimised.
3. **Essential-complexity count matches the source.**
   Count the irreducible moves in the source argument;
   the IR version uses the same count. Fewer means you
   have dropped depth; more means you have imported
   noise.
4. **The bridge survives one round of retraction.**
   Apply `retractable-teleport` discipline: if a reader
   rejects the bridge and steps back to the pre-bridge
   state, nothing in either source domain has been
   corrupted. Translation is non-destructive.

## Relationship to other skills

- **naming-expert** — within-domain: what to call a
  thing *in one ontology*. Translator-expert — across-
  domain: what the shared-IR name is for *the same
  thing* in two ontologies.
- **etymology-expert** — history of a word. Translator
  sometimes uses etymology to recover the original
  first-principles meaning of a loanword when the
  current domain usage has drifted.
- **reducer** — Rodney's Razor on complexity. Translator
  uses the same preservation constraints on translation
  quality.
- **complexity-theory-expert** — formal definitions of
  essential / logical-depth / effective complexity.
  Translator cites, does not redefine.
- **documentation-agent** — consumer. Documentation
  that targets mixed audiences routes through a
  translator pass before landing.
- **canonical-home-auditor** — ensures the IR basis
  picked for a document lives in `docs/GLOSSARY.md` and
  not scattered in prose.

## Common failure modes

- **Borrowed-jargon-without-bridge.** Using a term from
  domain A in a document for readers of B without a
  bridge definition. Surface translation; no depth
  crosses.
- **Over-metaphor.** "Think of it like X" where X loses
  the essential complexity. Bridge feels crossed to the
  author; reader has not actually landed.
- **Lossy IR.** Picking a basis so small the logical
  depth cannot be expressed. Reader sees the definition
  but cannot re-derive.
- **Noisy IR.** Picking a basis so large the reader is
  learning a third ontology. Reader gives up.
- **IR drift.** Using different first-principles terms
  for the same concept across sibling documents. The IR
  itself becomes incoherent. Fix: canonical-home the IR
  in one place.

## Reference patterns

- `.claude/skills/cross-domain-translation/SKILL.md` —
  the applied workflow.
- `.claude/skills/naming-expert/SKILL.md`
- `.claude/skills/etymology-expert/SKILL.md`
- `.claude/skills/reducer/SKILL.md`
- `.claude/skills/complexity-theory-expert/SKILL.md`
- `docs/GLOSSARY.md` — the project's standing IR.
- `AGENTS.md` — glossary-first discipline is the
  project-level application of this skill.
