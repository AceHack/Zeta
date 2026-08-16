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

## Progress — 2026-08-14 (the shadow), branch `shadow/eve-translation-layer-spec`

Spec landed: `docs/research/2026-08-14-the-eve-translation-layer-computing-the-imposition-budget-for-the-dynamicvalue-shape-lattice.md`.
Executable check landed: `src/Core.TypeScript/eve-translation/` (`aut-budget.ts`,
`eve-invariant-table.json`, `aut-budget.test.ts`).

**The measurement.** The `DynamicValue` shape lattice carries an imposition budget of
**1.0000 bits (strict reading) / 0.0000 bits (role reading)**, and the residual bit is exactly the
`Int`/`Bytes` transposition. The shipped claim it pays for is the **CBOR major-type assignment** —
and the party spending it is **RFC 8949**, neither negotiating party. Ladder, brute-forced over
`Sym(8)`: 40320 → 720 → 24 → 6 → 2 → 1, i.e. 15.2992 → 9.4919 → 4.5850 → 2.5850 → 1.0000 → 0.0000
bits.

**Ask status:**

- **1 — done.** ETP-1, six steps, in the spec §4 (including retraction as a Z-set `−1` with the
  invariant family as hub and the label log as satellite).
- **2 — done.** `aut-budget.ts`; the number is above. Method: `Aut(S) ⊆ Stab(invariants)`, so only
  an **upper bound** is computed — and an upper bound of 1 is *exact*, which is all rigidity needs.
- **3 — done, tension confirmed quantitatively.** The bare 8-tag set (committing to nothing) is
  `Sym(8)` = 15.2992 bits; four performable relations buy it down to 1.0000. Relations buy rigidity
  and the exchange rate is now measurable. Not resolved, measured.
- **5 — done.** Four planted defects, each a non-zero exit, control green (spec §5). The strongest
  is defect **B**: adding a 9th tag (`Decimal`) with `Int`'s profile — which the shipped
  doc-comment explicitly invites — pushes the budget 1 → 2.585 bits and un-forces the translation,
  and nothing in the repo would previously have noticed. The 23 unit tests were themselves
  mutation-tested (`preserves()` → `return true` kills 13 of 23).
- **4 — STILL OPEN.** The non-isomorphic case (partial semiotic morphisms, Goguen's preservation
  ordering) is untouched and is the largest remaining gap.
- **6 — STILL OPEN.** `docs/SEED-VOCABULARY.md` as the live instance of the tension.

**New open question this work produced:** rung 5 (`ordinal-sort-role`) is *contested* — `tryItem`
takes an `int32` index while `DynamicValue.Int` carries `int64`. The shipped code does not settle
whether Array's ordinal sort *is* the Int tag, and the answer decides whether the lattice is rigid
or keeps one bit. Reported both ways rather than rounded.

**Register unchanged:** `log₂|Aut|`-as-coercion is still **toy** and was deliberately NOT promoted.
The four-oracle agreement looks like a falsifier and is not one — all four read the same seed, so it
is one observation wearing four costumes. What would meter it is named in the spec §8.

`DynamicValue.fs` and the golden vectors were not touched.

## Progress — 2026-08-15 (the shadow), branch `shadow/eve-partial-morphisms-non-isomorphic-case`

Ask 4 (the non-isomorphic case) closed — **with a negative result, which is the finding.** Doc:
`docs/research/2026-08-15-partial-semiotic-morphisms-the-non-isomorphic-case-and-why-the-imposition-budget-does-not-measure-loss.md`.
No code shipped (docs + workitems scope); `DynamicValue.fs`, the golden vectors, and
`eve-invariant-table.json` all untouched.

**The instance is shipped, not hypothetical.** `DynamicValue.toCanonicalJson` is a literal partial
semiotic morphism with typed refusals (`EncodeError.FloatDeferred` / `BytesDeferred` — the source
calls itself *"a partial projection (6/8 shapes)"*), and `src/Core.Rust.Observe/src/json.rs` is the
coarser party (6 tags vs 8). Three shipped codecs give three ways to be non-isomorphic: CBOR/Arrow
**total**; JSON **tag-level partial**; XML **value-level partial** (`NonRepresentable`).

**What replaces `|Aut|`:** `Aut` of the **meeting structure** `M = A/ker φ ≅ im φ`. The torsor
theorem applies verbatim — bijectivity was never its load-bearing hypothesis. So the budget
**generalises as a measurement with no new mathematics, and breaks as a criterion.**

**The measurement (uncontested ladder, from the shipped rung table):**

| meeting structure | budget | live rungs |
|---|---|---|
| full 8-tag lattice (baseline) | 1.0000 | 4/4 |
| `toCanonicalJson` domain **(shipped)** | **0.0000** | 3/4 |
| collapse route (not shipped) | **0.0000** | 3/4 |
| degenerate — all tags to one | **0.0000** | **0/4** |
| drop Array+Object, merge Null+Float | **6.9069** | **0/4** |

Same budget / different loss (rows 2-4) **and** same loss / 7-bit budget gap (rows 4-5):
**independence exhibited in both directions.** 37.0% of all 21145 meeting structures score a perfect
0.0000 bits, and the degenerate morphism attains it at level 0 before any invariant is checked —
*silence is the cheapest vocabulary.* Also **26.1% of coarsenings cost MORE** (max 6.9069 bits),
because rungs are shared infrastructure: a merge in one corner un-pins tags elsewhere. **Loss is
non-local.**

**Loss is measurable but not as a scalar** — it is the named set of rungs that stop being live
(**destroyed** = profile not constant on a block; **vacuous** = separates nothing). Two candidate
scalars refuted: the absorbed-automorphism subgroup `K(φ)` (= trivial on the real instance while the
loss is large — rigidity and expressivity are independent), and the budget read backwards.

**Fairness:** symmetric loss is the **wrong target** (levelling-down). The richer party always pays
and the loss is always one-sided — generic, not coercive. The condition is the repo's existing
**cede / defer / strip** shape (who initiates) plus **exit** (Hirschman), and the checkable red flag
is narrower: *the party that chose the meeting structure is the party that loses nothing.* It does
not fire on the shipped pair.

**Named blind spot:** value-level partiality is invisible to any tag-lattice budget. `toCanonicalXml`
is a tag-level **isomorphism** and a value-level **partial** morphism at once — this method reports
0 rung deaths and an unchanged budget while a whole class of values cannot cross.

**Register unchanged:** `log₂|Aut|`-as-coercion is still **toy**, and this work *lowers* what the
number is claimed to do. The new tempting promotion is named and refused too: Goguen's text agreeing
with the computation is corroboration, not a falsifier — neither could have refuted the other. What
would meter it is still two parties who have never shared a seed.

**Ask status:** 1 done · 2 done · 3 done · **4 done (negative result)** · 5 done · **6 STILL OPEN**
(`docs/SEED-VOCABULARY.md`). Rung 5 remains contested and is untouched — note it *vanishes* on the
JSON domain, which resolves nothing.

**New follow-on this work produced (not done here, docs-only scope):** land the preservation profile
as an executable gate — a `preservation-profile.ts` beside `aut-budget.ts` computing rung
descent/liveness for a declared meeting structure, refusing a budget reported without its
rung-death set, with a planted-defect table proving it fails.

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
