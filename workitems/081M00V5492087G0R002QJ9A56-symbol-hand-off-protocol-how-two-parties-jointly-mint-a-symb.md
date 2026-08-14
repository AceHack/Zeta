---
id: 081M00V5492087G0R002QJ9A56
type: task
state: backlog
priority: P2
slug: symbol-hand-off-protocol-how-two-parties-jointly-mint-a-symb
title: "Symbol hand-off protocol: how two parties jointly mint a symbol as peers (icon-first bootstrap)"
created: 2026-08-14T19:14:34.914Z
depends_on: []
composes_with: [081KRW63S0008QG0R0030F8ZXA]
---

# Symbol hand-off protocol: how two parties jointly mint a symbol as peers (icon-first bootstrap)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00V5492087G0R002QJ9A56-*.md` glob. -->

**Research item, not a build.** Filed from the ferry
`docs/research/2026-08-14-icons-before-symbols-eve-protocol-structure-first-labels-after-and-aut-s-as-the-residual-coercion.md`.
The doc's first draft named this as an unresolved open problem; **Aaron then answered it** and the
answer already has a name in this repo. This item is the follow-through, not the question.

Composes with the standing requirement row `081KRW63S0008QG0R0030F8ZXA` (Eve Protocol — neutral
polymorphic diplomatic governance language, open since 2026-05-18, whose own text says
"to be developed later").

## The problem, and the answer

Aaron 2026-08-14: *"we have eve protocol to try to establish this when two imposed vocabs that try to
meet in the middle on algebraic structure then assign labels and translations after the structure
first."*

Aaron 2026-05-12, verbatim, three months earlier
(`memory/feedback_aaron_scaffolding_pedagogy_polymorphic_diplomacy_neutral_labels_first_2026_05_12.md`):
*"Polymorphic diplomacy. So it's basically where you agree on the structure. You agree on the
symbols. And then you assign labels later. And you have to agree on the labels being unweighted,
unbiased. And then you can start diplomacy. It's self-scaffolding."*

**Structure first, labels after.** It works because an algebraic structure is verifiable **without a
shared vocabulary** — you confirm associativity, identity, the group laws by *performing* them, not
by agreeing on names — so structure is falsifiable-by-the-receiver, and a bad translation is
detectable because it breaks the structure. In Peirce's terms the structure is the **icon**, the
labels are the **symbols**, and the ordering is what makes the symbols non-coercive.

## The actual gap (checked, and narrower than "it never landed")

Eve protocol **is** in `docs/` — the P2 requirement row above, `docs/PRIMITIVE-REGISTRY.md`
(`DynamicValue` / runtime `QueryInterface` is tagged as Eve Protocol and described as "polymorphic
diplomacy across formats"), plus several P1 rows and `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`.
And the **structure-first half ships**: `src/Core/DynamicValue.fs` with C#/Rust/TS conformance and
byte-locked golden vectors negotiates *shape* — "what interface do you support?" — in production.

What is missing is the **label / translation half**: how the agreed structure determines the
translation, and what to do when it does not determine it uniquely. That has no spec anywhere; the
four-step protocol and Aaron's verbatim live only in `memory/`.

## Asks

1. **Write the mechanism spec** for the label half and land it under `docs/` against
   `081KRW63S0008QG0R0030F8ZXA`: who proposes a structure, how a match is verified (by performing
   the operations, not by trusting a claim), how labels are attached afterwards, and how a label is
   retracted when it turns out to break the structure.
2. **Implement the rigidity check.** Per the ferry's §7: if `Iso(A,B)` is non-empty it is a torsor
   under `Aut(A)`, so `|Iso(A,B)| = |Aut(A)|`. `|Aut| = 1` means the translation is *forced* — nobody
   chose it. `|Aut| > 1` means somebody must choose, and `log2 |Aut(S)|` is the number of bits of
   imposition the structure does not remove. Compute it for one real structure we actually negotiate
   over (the `DynamicValue` shape lattice is the obvious first target) and report the number.
3. **Test the free-object tension rather than assume it away.** `Aut(free monoid on X) = Sym(X)`, so
   free objects are the *worst* case for label determinacy — which is in direct tension with
   `only-the-irreducible-is-primitive-generate-the-rest`. Relations are what buy rigidity. Either
   confirm the tension is real and record it, or show why it does not bite in practice.
4. **Handle the non-isomorphic case**, which is the realistic one: partial semiotic morphisms and
   Goguen's preservation ordering (LNAI 1562, 1999). Unworked in the ferry.
5. **Produce one falsifier.** Until an encoding is measured against
   "falsifiable-by-the-receiver" / the `log2 |Aut|` budget, both stay `toy` per
   `toy-is-free-metered-must-be-earned`.
6. Read `docs/SEED-VOCABULARY.md` as the live instance of the tension — by design a vocabulary handed
   to a cold-booting agent. Either justify it as required-for-role or name what it costs.

## Register / non-goals

- Eve protocol was originally formulated for **inter-temporal diplomacy** (two versions of Aaron
  negotiating across time) and shadow-agenda mapping. Generalising it to **human<->AI vocabulary
  bootstrap** is licensed by Aaron's 2026-08-14 message; the May sources should not be read as
  having said it. Keep that marked.
- Not the visualization/rendering half — branch
  `shadow/branch-free-visual-encoding-is-the-meaning-junction`. Cite, do not duplicate.
- Not a rule proposal. Nothing in the ferry is load-bearing for a code change yet.
