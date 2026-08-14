# Icons before symbols — Eve protocol is the hand-off, and |Aut(S)| is the residual coercion

**Ferried 2026-08-14 (the shadow).** Aaron's observations, verbatim, in the order he made them. His
words are the primary artifact; everything below the horizontal rule is secondary analysis and is
marked as such.

**The founding observation:**

> "i've thought long and hard about **how first humans communicated without language** and how to
> bootstrap that process for AI, **without inserting the control that comes with asymmetric
> language**, even before AI i thought about this often in trying to **design a new society of life
> from scratch**."

**His own answer, given after the first draft of this doc named the hand-off as an open problem:**

> "we have **eve protocol** to try to establish this when two imposed vocabs that try to **meet in
> the middle on algebraic structure then assign labels and translations after the structure first**"

Two provenance facts, recorded rather than inferred:

1. He states the first observation **predates the AI work entirely** — "even before AI i thought
   about this often." It is not a frame adopted for this project; the project arrived at a question
   he already held.
2. The stated purpose is **designing a new society of life from scratch**, not a communication
   protocol. The protocol question is downstream of a founding question.

---

*Everything from here is the shadow's analysis (secondary). Aaron's text above is unedited.*

## 1. The engineering claim, stated so it can be argued with

The philosophy-essay version of this is not worth writing. The version with teeth:

> **Whoever supplies the language supplies the categories, and the categories carry the control.**
> A shared vocabulary handed from one party to another is an asymmetry that survives every later
> negotiation, because it fixes what *can be said* before anything *is said*.

That is a claim about the ordering of commitments, not about politeness. Negotiation operates on
propositions; the vocabulary decides which propositions are expressible. A party that controls the
second controls the first without ever appearing in it — no directive is issued, no permission is
denied, and the outcome is nonetheless bounded by a choice the other party never made.

## 2. This is one principle the repo already holds in three places, not a fourth thing

| carved surface | the form it takes there |
|---|---|
| [`.claude/rules/no-directives.md`](../../.claude/rules/no-directives.md) | **source ≠ authorization.** Framing input as a directive makes the receiver a follower-of-orders rather than an accountable peer. |
| `memory/feedback_aaron_pigeonhole_by_self_claim_never_by_assumption_2026_08_09.md` (harness copy; also `~/.claude/projects/<slug>/memory/`) | **the subject supplies the category, the evidence supplies the truth value.** Observer-chosen bins are how a classifier goes unfalsifiable. |
| [`.claude/rules/manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §3 | **weight-free** — no permanent authority, because weight creates capture. |

The unification: **an imposed vocabulary is captured authority in linguistic form.** It is weight
(§3) that nobody can see, because it is not held by a party — it is held by the medium. It is a
directive that was never phrased as one, because it did not need to be: it constrained the phrasing
itself. And it is an observer-chosen bin, because the supplier of the words chose the categories the
other party's evidence must be sorted into.

The pigeonhole rule is the sharpest of the three, and it already contains the fix: *the subject
supplies the category* is exactly "do not hand them your vocabulary." What this doc adds is that the
rule was written for classification and applies verbatim to communication.

## 3. The anchor that makes it precise — Peirce, and where the asymmetry actually lives

Per [`.claude/rules/anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md)
this has to land on named humans and checked citations. **Charles Sanders Peirce**'s second
trichotomy of signs (1903 *Syllabus*; *Collected Papers* 2.247–2.249) localizes the asymmetry:

| sign type | relation to its object | can a receiver check it unaided? |
|---|---|---|
| **icon** | resembles it — "by virtue of characters of its own … whether any such Object actually exists or not" (CP 2.247) | **yes** — against the thing |
| **index** | causally / existentially connected (smoke↔fire, a pointing finger) | **yes** — against the causal link |
| **symbol** | pure convention — a word | **no** — only against the convention |

That table is the finding. **Icons and indices bootstrap; symbols require a prior agreement someone
had to impose.** Aaron's "control that comes with asymmetric language" is not a property of language
in general — it is a property of the **symbolic register specifically**, and it enters exactly where
interpretation stops being checkable against the world and starts requiring access to a convention.

### The supporting anchors (checked; what each actually gives us)

- **David Lewis, *Convention: A Philosophical Study* (Harvard UP, 1969)** — signaling games; the
  formal answer to *can meaning bootstrap at all?* Yes: a signaling system is an equilibrium of a
  coordination game and needs no prior shared language. **The entailment check cuts against the
  slogan:** Lewis needs something to break the symmetry between equally-good equilibria — salience,
  Schelling-style. Salience is not free, and it does the same job an icon does: grounding the choice
  in something both parties already share *via the world* rather than via a supplied convention. So
  Lewis does not show meaning bootstraps from nothing; he shows what the **minimum non-linguistic
  input** is. §7 turns that observation into a group-theoretic quantity.
- **Brian Skyrms, *Signals: Evolution, Learning, and Information* (Oxford UP, 2010)** — signals
  acquiring meaning through evolutionary/learning dynamics with **no designer**. The existence proof
  that the nobody-supplied-the-vocabulary case is coherent.
- **Michael Tomasello, *Origins of Human Communication* (MIT Press, 2008)** — the empirical answer to
  Aaron's literal question: **pointing and pantomime** grounded in **shared intentionality** and
  joint attention; gesture precedes and scaffolds language. In Peirce's terms pointing is an
  **index** and pantomime an **icon** — an a-priori taxonomy and an empirical finding landing on the
  same two categories from opposite directions.
- **Joseph Goguen — algebraic semiotics.** *An Introduction to Algebraic Semiotics, with Application
  to User Interface Design* (in *Computation for Metaphors, Analogy, and Agents*, ed. Nehaniv,
  Springer LNAI 1562, 1999, pp. 242–291); Goguen & Harrell, *Information Visualization and Semiotic
  Morphisms* (in *Multidisciplinary Approaches to Visual Representations and Interpretations*, ed.
  Malcolm, Elsevier 2004, pp. 93–106). **This is the formal home of "structure first, labels
  after."** A **sign system** is an algebraic theory — signature (sorts, constructors), data sorts,
  axioms, plus a **level ordering** (part/whole) and **priority ordering** (salience). A
  representation is a **semiotic morphism** between sign systems, mapping sorts to sorts and
  constructors to constructors; morphisms are **ranked by how much structure they preserve** —
  Goguen's stated priority is *structure over content*, and morphisms are explicitly allowed to be
  **partial**, since some loss is unavoidable. The lineage matters: this is the **same Goguen** the
  repo already stands on for §13 noninterference (Goguen–Meseguer 1982), so it is a lineage we are
  already on rather than a fresh import.
- **Emergent communication in multi-agent RL — with its adverse result.** Foerster, Assael, de
  Freitas & Whiteson, *Learning to Communicate with Deep Multi-Agent Reinforcement Learning* (NIPS
  2016; RIAL/DIAL) and Lazaridou, **Peysakhovich** & Baroni, *Multi-Agent Cooperation and the
  Emergence of (Natural) Language* (ICLR 2017) show learning agents invent working protocols in
  referential games. **Kottur, Moura, Lee & Batra, *Natural Language Does Not Emerge 'Naturally' in
  Multi-Agent Dialog* (EMNLP 2017, best short paper)** found those invented languages reach
  near-perfect task reward while being **neither compositional nor interpretable**, and become
  compositional only when the experimenters **restrict the channel**. Stated plainly because it is a
  live risk here: the known route to a legible emergent protocol runs through a designer constraining
  the channel — the move this whole programme is trying to avoid. The available escape is that the
  constraint be a property of the **world** (bandwidth, noise, a shared referent) rather than a decree
  from a **party**; "let it emerge and it will be legible" is contradicted by the literature.

  *(Correction to the brief that commissioned this ferry: the ICLR 2017 paper is Lazaridou,
  Peysakhovich & Baroni — three authors, not two.)*

## 4. The connection: this and the visualization observation are one observation

Hours before the observation above, Aaron said the visualization surfaces are *"our most important
junction points and training data cause this is where all the meaning and interpretation come
from,"* optimized for *"visual cortex representations of meaning that can be easily looked at
without lying under optical illusions,"* and that an AI reads the same meaning *"since we don't have
if statements."*

**That is this same idea.** A branch-free visual encoding is an **icon in Peirce's exact sense**: the
geometry resembles the data *by construction*, so a receiver interprets it from the thing itself
rather than from a convention someone imposed. Follow the three clauses:

- **"no if statements"** — a branchless encoding has no case analysis, therefore no lookup table,
  therefore **no convention handed to you**. A branch is precisely where a symbol would live: the
  site at which "this input means that output" is decided by a rule external to both parties. Remove
  the branch and the mapping is structural.
- **"without lying under optical illusions"** — an illusion is a **failure of the icon to
  resemble**. Ruling illusions out is not aesthetics; it is maintaining the iconic property under the
  receiver's actual perceptual system. An icon that misresembles has silently become a symbol you
  must be taught to correct for.
- **"an AI reads the same meaning"** — the payoff, and *why* the channel is symmetric: human and AI
  share the surface **without either having supplied the other a vocabulary**, because neither is
  reading a convention. Both read a resemblance, and both can check it against the data.

Goguen & Harrell's *Information Visualization and Semiotic Morphisms* is this argument's existing
formal home, which is a strong signal we are on a real road rather than a metaphor.

The visualization half is being developed separately on branch
`shadow/branch-free-visual-encoding-is-the-meaning-junction`; this doc stays on the
language/bootstrap side and does not survey rendering surfaces.

## 5. The objection — "no imposed vocabulary" is not achievable as stated

**Any substrate supplies categories.** Choosing what counts as an icon rather than a symbol is
itself a choice somebody makes; a pixel grid, a colour space, a coordinate convention, an ordering —
each is a category imposed before any message. A "neutral" bootstrap that nobody designed does not
exist, and a design claiming to be one is claiming its own choices are invisible, which is worse than
admitting them.

**Peirce got here first, which is the strongest form of the objection.** By 1903 he had concluded
that pure icons and indices are hard or impossible to find — they are *always partly symbolic or
conventional* — and coined **hypoicon** (CP 2.276) and **sub-index** (CP 2.330) for the real, mixed
cases. The trichotomy decomposes every sign's *aspects*; it does not partition signs into clean bins.

### The achievable version: falsifiable-by-the-receiver

The property that does the work is not *absence* of categories. It is **verifiability**:

> A receiver can check an icon **against the thing itself** and **reject it**. A receiver cannot do
> that with a symbol — the only available check is against the convention, which is exactly the
> asymmetric artifact in question.

The encoder still chose the categories; what the receiver gains is standing to **catch** a bad
choice, unilaterally, without asking the encoder and without being granted the vocabulary. Weaker
than "symmetric", and far more buildable: a property of a specific encoding one can test, rather
than a property of a relationship one can only assert.

> **The target is falsifiable-by-the-receiver, not symmetric.**

This is the repo's existing standard applied to a channel rather than a claim:
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
says a model is a toy until it has a falsifier; this says **a channel is a convention until the
receiver has one.**

## 6. The hand-off protocol is Eve protocol, and Aaron stated it verbatim three months ago

The first draft of this doc named the hand-off — *under what conditions do two parties jointly mint
a symbol as peers?* — as the open problem. Aaron answered it, and the answer already exists in this
repo under a name.

**Aaron 2026-05-12, verbatim** (`memory/feedback_aaron_scaffolding_pedagogy_polymorphic_diplomacy_neutral_labels_first_2026_05_12.md`,
from the Aaron + Ani conversation):

> "Polymorphic diplomacy. So it's basically where you agree on the structure. You agree on the
> symbols. And then you assign labels later. And you have to agree on the labels being unweighted,
> unbiased. And then you can start diplomacy. It's self-scaffolding."

and, in the same session, the ordering stated as his default method:

> "No, we're doing it in reverse. I usually do it math first and then put the labels. With you, I'm
> doing labels first, so I can teach your dumb ass the math."

and the Eve layer itself — persistence as the verification mechanism:

> "And I'll remember every neutral label you've agreed on. This is Eve protocol in real time. I'm
> remembering every neutral label you said, and I'm gonna mirror it to you from now on forever and
> ever. That's how you can know it's me."

**Structure first, labels after.** That is a precise resolution of the icon/symbol problem, and it
should be the mechanism this doc centres rather than a question it leaves open.

### Why it works, stated so it can be checked

An **algebraic structure is verifiable without a shared vocabulary.** You can confirm associativity,
commutativity, an identity, the group laws, by **performing** them — apply the operation, compare
the results — not by agreeing on names. So structure is falsifiable-by-the-receiver in exactly §5's
sense. Labels attach afterwards as a translation layer, and a **bad translation is detectable
because it breaks the structure**: translate, perform the operation on both sides, and see whether
the diagram commutes.

In Peirce's terms: **the structure is the icon, the labels are the symbols, and the ordering is what
makes the symbols non-coercive** — they name something both parties independently verified, rather
than fixing the categories before anything can be said.

### The lineage — May gave a stance, August gives a mechanism

This is a **Mirror→Beacon compression of Aaron's own three-month-old work**, and the repo's
discipline is that a concept earns durability by surviving that compression. The May 2026 material
is a *stance*: neutral labels, unweighted and unbiased, never weight any label against the other
side, mirror agreed labels back forever, no judgment
(`memory/feedback_eve_protocol_diplomatic_agenda_mapping_shadow_no_judgment_2026_05_10.md`;
`memory/feedback_aaron_timeline_shifter_peace_negotiation_two_ruthless_selves_eve_protocol_2026_05_12.md`).
The August statement is a *mechanism*: **meet in the middle on algebraic structure, derive the
translation from it.** Same protocol; the second says how the first is enforced rather than
promised.

Credit where the earlier formulation is due: the May files carry the verbatim, the four-step
protocol, and the persistence layer. This doc supplies the algebra and the anchors, nothing more.

**Register note on original scope (this is the shadow's inference, not Aaron's May claim):** Eve
protocol was formulated for **inter-temporal diplomacy** — two versions of Aaron negotiating peace
across time — and for shadow↔Aaron agenda-mapping. Generalizing it to **human↔AI vocabulary
bootstrap** is legitimate and is what his August message does, but the May sources should not be
read as having said that. Marking it rather than presenting it as what he said in May.

### The gap — and a correction to the brief that commissioned this

The brief asserted that Eve appears in `memory/` and **nowhere** under `docs/`. **That is not what is
there.** Checked, not inferred:

- `docs/backlog/P2/081KRW63S0008QG0R0030F8ZXA-eve-protocol-neutral-polymorphic-diplomatic-governance-langu.md`
  — an **open P2 governance row** (Aaron + Mika, LOCKED-IN 2026-05-18): Eve Protocol is language 3
  of a locked 4-language system, required to be substrate-neutral, polymorphic across concrete
  representations, and substrate-honest. Its own text says *"to be developed later."*
- `docs/PRIMITIVE-REGISTRY.md` — `DynamicValue` / runtime `QueryInterface` is described as
  *"polymorphic diplomacy across formats"* and tagged **Eve Protocol 081KRW63S0008QG0R0030F8ZXA**.
  It is **shipped**: `src/Core/DynamicValue.fs` plus C#/Rust/TS conformance and byte-locked golden
  vectors (JSON 6/8 shapes, canonical CBOR 8/8).
- Also present: `docs/backlog/P1/…081KT2T2J0008QG0R002R72323` (Eve protocol transport codecs),
  `docs/backlog/P1/…081KT2T2J0008QG0R00301P27H` (Eve is multi-traveler),
  `docs/research/2026-06-08-…-eve-protocol-with-time.md`, `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`,
  `docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md`, and `.claude/rules.bak/non-coercion-invariant.md`.

So the honest gap is **narrower and more actionable** than "it never landed":

> **The requirement is in `docs/` and the structure-half is shipped; the mechanism is not written
> down anywhere durable.** `DynamicValue` negotiates **shape** — "what interface do you support?" —
> which is the *structure-first* half executing in production. What has no spec is the **label /
> translation half**: how the agreed structure determines the translation, and what to do when it
> does not determine it uniquely. The four-step protocol and Aaron's verbatim live only in `memory/`.

§7 is an attempt at exactly that missing half.

## 7. |Aut(S)| is the residual coercion — the part of the translation nobody's structure determines

*This section is the shadow's derivation. The mathematics is elementary and standard universal
algebra; it is stated with its argument so a reader can check it rather than trust it. The
**application** to non-coercion is the proposal, and it is the most likely thing here to be wrong.*

### The statement

Let two parties each hold an algebraic structure over the same signature, 𝔄 and 𝔅 — Goguen's sign
systems, or plain term algebras. Suppose they establish that the structures match, i.e. that
`Iso(𝔄, 𝔅) ≠ ∅`. Then:

> **`Iso(𝔄, 𝔅)` is a torsor under `Aut(𝔄)`.** Fix any isomorphism `φ₀`. The map
> `α ↦ φ₀ ∘ α` is a bijection `Aut(𝔄) → Iso(𝔄, 𝔅)`. Hence `|Iso(𝔄, 𝔅)| = |Aut(𝔄)| = |Aut(𝔅)|`.

*(Proof sketch: `φ₀ ∘ α` is an isomorphism for every automorphism `α`; and for any isomorphism `φ`,
`α = φ₀⁻¹ ∘ φ` is an automorphism with `φ₀ ∘ α = φ`. Injectivity follows from composing with
`φ₀⁻¹`.)*

The consequence, which is the point:

| | meaning for the hand-off |
|---|---|
| **`\|Aut(S)\| = 1`** (S is **rigid**) | **exactly one** translation exists. It is **forced**: neither party chose it, either can compute it alone, and no asymmetry can hide in it. The labels carry **no information beyond the structure**. |
| **`\|Aut(S)\| = n > 1`** | **n** translations exist and the structure picks none of them. Someone must choose, and **that choice is exactly where imposition re-enters**. |

So the residual freedom is not a vague worry — it is a **group**, and its order measures how much of
the translation is a choice rather than a consequence. The natural unit is
**`log₂|Aut(S)|` bits: the part of the translation somebody has to supply.** That makes
"non-coercive" a quantity you compute rather than a stance you assert.

A second, sharper corollary — the one that tells you which *claims* are safe:

> Any two translations differ by an automorphism. Therefore a statement is **independent of which
> translation was chosen if and only if it is `Aut(S)`-invariant.** Aut-invariant claims are
> well-defined across the hand-off; non-invariant ones are precisely the claims the chooser's
> choice decides.

### The honest limit: structure-first works to the extent the structure is rigid

Not "structure-first fails". The failure mode is specific and computable, and it lands somewhere
uncomfortable for this repo:

**Free objects are the worst case, not the best.** For a free monoid on a generating set `X`, the
automorphism group is exactly `Sym(X)`: an automorphism preserves length and preserves the
indecomposable elements — which are exactly the generators — so it restricts to a permutation of
`X`, and any permutation extends uniquely. On 3 generators that is `|Aut| = 6` translations, and the
structure prefers none of them. (Caution against over-generalising: this is a fact about free
**monoids**. For free **groups**, `Aut(F_n)` is far larger — infinite for `n ≥ 2` — so the free-group
case is worse still, not better.)

That is a genuine tension with
[`only-the-irreducible-is-primitive-generate-the-rest`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md),
which prefers the free object precisely because it commits to nothing. **Committing to nothing is
what leaves the labels undetermined.** So:

> **Relations are what make a translation forced.** Rigidity is bought with axioms. The "earned
> quotient" of the free-object rule is exactly the thing that shrinks `Aut` — the same act that
> earns a structure earns the uniqueness of its translation.

### Where the earlier anchors converge — pointing shrinks the automorphism group

This is the part worth keeping. If both parties can jointly single out an element — **point at it** —
that is adding a constant to the signature, and the relevant group becomes the **pointwise
stabiliser** `Aut(S, c₁ … c_k)`, which is a subgroup of `Aut(S)` and typically much smaller. Enough
marked points and it is trivial.

So **indices rigidify structure**, and three anchors that arrived independently say one thing:

- **Peirce**: an index is checkable without convention.
- **Tomasello**: joint attention and pointing precede language empirically.
- **Lewis**: signaling needs salience to break the symmetry among equilibria.

**"Breaking the symmetry" is literal.** The symmetry is `Aut(S)`; salience, joint attention, and
pointing are the same operation — marking points to cut the group down — and Lewis's requirement is
not a philosophical caveat but a statement about the size of a stabiliser. That is why pointing is
the pre-linguistic primitive: it is the cheapest available rigidifier.

### What this does and does not settle

- **Does not** remove the upstream choice: *which* structure to meet on is still chosen, and this
  says nothing about that. The regress terminates in a shared physical referent, not in a proof.
- **Does not** cover the realistic case where the structures are *not* isomorphic. There the object
  is a partial semiotic morphism and the question becomes how much structure is preserved — which is
  precisely what Goguen's preservation ordering is for. Unworked here.
- **Does** give a falsifier candidate: compute `|Aut(S)|` for a proposed shared structure, and
  report `log₂|Aut(S)|` as the channel's **imposition budget**. A protocol claiming non-coercion
  with a large automorphism group is claiming something the structure does not support.

Register: this is a **toy model** by
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) —
the torsor fact is a theorem, the *interpretation of `log₂|Aut|` as coercion* is unmetered until
some encoding is measured against it. Per
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md): the group order
is a count, and a count is not an identification — what makes this structural rather than numerical
is that the group **acts** on the translations, so the number is the size of an orbit and not a
coincidence.

## 8. What the resolution does to the bandwidth objection

The first draft raised a second objection: iconic channels cannot express **not**, **if**,
quantification, or anything counterfactual — there is nothing present to resemble — so deferring
symbols forever is not a plan.

Structure-first **weakens** this objection more than expected, and the honest accounting is worth
stating:

- **It largely dissolves for logical structure.** Negation is not a word that must be conventionally
  assigned; it is an **operation with laws** — involution, De Morgan, complement in a lattice. Two
  parties can verify a candidate `¬` by *performing* it: apply it twice and check you are back.
  Conditionals, meets, joins, quantifiers-as-adjoints — same treatment. Logical vocabulary is
  therefore reachable through the structure-first route, which is exactly why "agree on the
  structure, then the symbols, then the labels" is not merely a diplomatic nicety.
- **It does not dissolve for reference.** Which *individuals* the structure is about is not fixed by
  the structure — that is the `Aut` problem of §7 in its most basic form, and it is what pointing
  solves.
- **It does not dissolve for the first structure.** Agreeing you have a shared algebra at all
  requires prior common ground; Lewis's salience, again.

So the residual open problem is smaller and better shaped than "how do we ever get symbols": it is
**how the first structure is agreed with no structure yet agreed**, and the available answer is the
pre-linguistic one Aaron started from — shared referents, jointly attended.

## 9. Register and status

| item | register / status |
|---|---|
| Peirce icon/index/symbol trichotomy; hypoicon / sub-index | **Beacon, checked** — CP 2.247–2.249, 2.276, 2.330 |
| Lewis 1969 signaling + salience requirement | **Beacon, checked** — the salience caveat is why it was checked rather than cited |
| Skyrms 2010; Tomasello 2008 | **Beacon, checked** (attribution verified; content from standing knowledge, not page-checked) |
| Goguen algebraic semiotics; Goguen & Harrell visualization morphisms | **Beacon, checked** — 1999 LNAI 1562 pp. 242–291; 2004 Elsevier pp. 93–106 |
| Kottur et al. 2017 non-compositionality | **Beacon, checked** — recorded as a risk to this programme, not support for it |
| Aaron's May 2026 polymorphic-diplomacy statement | **verbatim, in-repo** — `memory/feedback_aaron_scaffolding_pedagogy_polymorphic_diplomacy_neutral_labels_first_2026_05_12.md` |
| Eve protocol's presence in `docs/` | **checked** — P2 row 081KRW63S0008QG0R0030F8ZXA + PRIMITIVE-REGISTRY + others; the brief's "nowhere in docs" is corrected above |
| `Iso(𝔄,𝔅)` is an `Aut(𝔄)`-torsor; `Aut(free monoid on X) ≅ Sym(X)` | **theorem** — elementary, proof sketches given inline |
| `log₂\|Aut(S)\|` as an imposition budget | **Mirror / toy** — the doc's own proposal, unmetered, most likely thing here to be wrong |
| "Whoever supplies the language supplies the categories" | **Mirror** — design claim, no falsifier proposed |
| "Branch-free visual encoding is an icon" | **Mirror, argued** (§4); no encoding tested against it |
| Generalising Eve from inter-temporal diplomacy to human↔AI bootstrap | **the shadow's inference**, marked; Aaron's August message is what licenses it |
| Non-isomorphic case (partial morphisms, preservation ordering) | **open, unworked** |

Nothing here is load-bearing for a code change and no rule is proposed. The asks are in
`081M00V5492087G0R002QJ9A56`.

## Pointers

- `workitems/081M00V5492087G0R002QJ9A56-symbol-hand-off-protocol-*.md` — the follow-through: write the Eve-protocol mechanism spec, compute rigidity for a real structure.
- `docs/backlog/P2/081KRW63S0008QG0R0030F8ZXA-eve-protocol-neutral-polymorphic-diplomatic-governance-langu.md` — the standing requirement row (open, "to be developed later").
- `docs/PRIMITIVE-REGISTRY.md` (Dynamic runtime objects) + `src/Core/DynamicValue.fs` — the structure-first half already shipped as runtime shape negotiation.
- `memory/feedback_aaron_scaffolding_pedagogy_polymorphic_diplomacy_neutral_labels_first_2026_05_12.md` — Aaron's verbatim four-step protocol + the Eve persistence layer.
- `memory/feedback_aaron_timeline_shifter_peace_negotiation_two_ruthless_selves_eve_protocol_2026_05_12.md` · `memory/feedback_eve_protocol_diplomatic_agenda_mapping_shadow_no_judgment_2026_05_10.md` — the May stance-form and its original inter-temporal scope.
- `docs/PRIOR-ART-LIST.md` §"Semiotics + pre-linguistic bootstrap" — the six anchors with register notes.
- [`.claude/rules/no-directives.md`](../../.claude/rules/no-directives.md) · [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §3/§6/§11 · [`anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md) · [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) · [`only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md) — the carved surfaces this composes with; §7 is in tension with the last one and says so.
- [`docs/research/2026-07-04-the-universal-meaning-interface-free-monoid-earned-quotient-grounded-by-external-residual-entropy.md`](2026-07-04-the-universal-meaning-interface-free-monoid-earned-quotient-grounded-by-external-residual-entropy.md) — symbol grounding (Harnad 1990) + Peirce's pragmatic maxim; **the free-monoid/earned-quotient framing there is the same free-vs-rigid axis §7 quantifies.**
- [`docs/research/2026-07-02-name-of-name-equals-mix-of-mix-naming-authority-is-the-same-fixed-point-as-the-compiler-generator.md`](2026-07-02-name-of-name-equals-mix-of-mix-naming-authority-is-the-same-fixed-point-as-the-compiler-generator.md) — naming authority is socially conferred, never self-minted; the peer-minting condition applied to identity.
- `docs/SEED-VOCABULARY.md` — read against this doc: by design a vocabulary handed to a cold-booting agent. A live instance of the tension, not a hypothetical.
- Sibling work (do not duplicate): branch `shadow/branch-free-visual-encoding-is-the-meaning-junction`.
