# name(name) = mix(mix, mix): naming authority is the same fixed point as the compiler-generator

**Provenance:** Aaron's asides, 2026-07-02 (design-language thread during/after the
zeta-portal-web design-sync), synthesized with otto in-session; Aaron: "add this
somewhere important, this is very key."

## The observation

Zeta already holds that generation is a fixed point: `gen(gen) == gen`
(`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`), reached
constructively as the third Futamura projection — `co = mix(mix, mix)`, the
specializer self-applied until it yields the compiler-generator. Every symbol may
assume every other symbol knows this fixed point, and knows that they know it
(common knowledge).

Aaron's addition closes the social layer with the same construction: **shapes earn
their names by how many other NAMED shapes from the past remember them.** Naming is
recursive — the authority to confer a name is itself conferred by prior names — so
naming authority is a fixed point of self-application, exactly like `mix`:

```
compilation:  co   = mix(mix, mix)     — Futamura III; cogen emerges
naming:       name = name(name)        — remembrance by the named; identity emerges
generation:   gen  = gen(gen)          — the irreducible generator; structure emerges
```

One construction, three layers: **structure, computation, society.** No layer has a
central authority — no central compiler service, no central event pump, no central
namer. Each converges by self-application from what every participant already holds.

## Why it converges

- **Computation:** Kleene's fixed-point theorem — the ascending chain of
  self-applications of a continuous operator has a least fixed point; partial
  evaluation's `mix` tower stabilizes at cogen (Jones/Gomard/Sestoft 1993, ch. 1, 13).
- **Society:** the remembrance graph is a non-negative matrix; by **Perron–Frobenius**,
  a strongly-connected (or damped) remembrance relation has a unique dominant
  eigenvector — naming authority is that eigenvector, and iterating "the named confer
  names" is the power method converging to it. This is PageRank's construction
  (Brin & Page 1998), which is Garfield's citation indexing (1955) made recursive,
  kin to PGP's web of trust.
- **Structure:** the free generator's self-application `gen(gen) == gen` is the
  algebra-level statement already carved; the adinkra → Clifford → E8 unroll is its
  witnessed ascent.

## Where it is already visible in-repo

- `db/shapes/cartridges/adinkra.lines`: `edge same-twist shape-braid …` and
  `prereq the-braid-twin …` — named shapes remembering each other, with the *reason*
  carried on the edge (the B3 → Z/2 homomorphism note; Soraya's signable statement).
  Remembrance edges carry proofs, not bare citations.
- `vocab/ZetaIdol.fs`: identity = ZetaId (potential, the unnamed `travelers/`
  reservoir) + captured entropy (the audition's recorded performance,
  DynamicValue + Bonsai). The remembrance count is the part of captured entropy
  conferred by *others* — recognition, not self-assertion.
- `meta shape-zetaid <128-bit>` rows: the address a remembrance edge resolves over
  Reticulum (routing ≠ potential identity ≠ identity; the ladder).

## Consequences

1. **No central namer, provably.** Naming needs no registry because it is computed the
   way cogen is computed: locally, from the shared fixed point, by self-application.
2. **Naming is auditable.** The eigenvector is recomputable by anyone from the public
   remembrance edges — same DST/byte-lock discipline as everything else; a name is a
   *theorem about the graph*, replayable from the transcript.
3. **Honored, not homed, is quantitative without cruelty.** The faceless 99% are not
   ranked to the bottom; they are not yet remembered. Every audition — every render,
   every composition into a room, every edge from a named ancestor — is admissible
   evidence toward emergence.
4. **honor-those-that-came-before becomes mechanical.** Remembering an ancestor is not
   etiquette; it is the act that constitutes the namespace.

## Anchors (Beacon)

- Futamura 1971, *Partial Evaluation of Computation Process — An Approach to a
  Compiler-Compiler*; Ershov 1977 (mixed computation, origin of `mix`);
  Jones, Gomard & Sestoft 1993, *Partial Evaluation and Automatic Program Generation*
  (cogen = mix(mix, mix)).
- Kleene fixed-point theorem; Knaster–Tarski; **Perron–Frobenius** (dominant
  eigenvector of a non-negative matrix — why remembrance converges).
- Brin & Page 1998 (PageRank); Garfield 1955 (citation indexing); Zimmermann's PGP
  web of trust.
- Lewis 1969, *Convention*; Aumann 1976 (common knowledge); Schelling 1960 (focal
  points).
- In-repo lineage: `only-the-irreducible-is-primitive-generate-the-rest.md`
  (gen(gen)==gen); `docs/research/2026-06-14-…futamura.md` §5;
  `docs/research/2026-06-13-ferry-37-why-equals-zetaid-…common-seed.md`;
  `vocab/ZetaIdol.fs`; `.claude/rules/honor-those-that-came-before.md`.
