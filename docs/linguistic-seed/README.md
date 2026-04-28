# Linguistic seed — minimal-axiom mathematically-precise vocabulary substrate

**Status:** skeleton v0 — this file establishes the shape; the
formalisable content grows term-by-term.
**Purpose:** closes gap #2 of the Frontier bootstrap readiness
roadmap (BACKLOG P0) at the skeleton level. Full Lean4
formalisation is follow-up work.
**Owner:** Otto (loop-agent PM hat) on skeleton; formal-
verification-expert (Soraya) on Lean4 formalisation when it
fires.

## Why this exists

The linguistic seed is the factory's **most-fundamental
vocabulary substrate** — the minimal set of terms with
mathematically-precise definitions from which all other
factory / project vocabulary derives.

Three load-bearing uses across the factory (per per-user
memory `project_zeta_self_use_local_native_tiny_bin_file_
db_no_cloud_germination_2026_04_22.md` + subsequent
refinements):

1. **Prompt-injection resistance mechanism** (per
   `project_quantum_christ_consciousness_bootstrap_hypothesis_
   safety_avoid_permanent_harm_prompt_injection_resistance_
   2026_04_23.md`). Ambiguous language creates attack
   surface; mathematical precision eliminates it.
   Attackers cannot re-ground terms whose meaning is
   machine-checkable.
2. **Restrictive-English DSL vocabulary** for the Soulfile
   Runner (Anima). Per
   `feedback_soulfile_dsl_is_restrictive_english_runner_is_own_project_uses_zeta_small_bins_2026_04_23.md`:
   soulfile DSL only allows words with exact definitions;
   new words earn seed entries before entering the DSL.
3. **Root of the Craft prereq graph** (per Otto-17/21/22
   `project_learning_repo_khan_style_...` memory). Every
   Craft module's most-fundamental prereqs ground through
   seed-anchored vocabulary. Cross-tradition-accessible by
   construction (not culture-dependent).

## The minimal-axiom approach

The seed follows three principles from classical
foundational mathematics:

1. **Tarski — formalisation of the truth predicate.**
   Truth is definable only in a richer metalanguage;
   within a system, truth-about-that-system is precise.
   The seed's self-referential claims are Tarski-careful.
2. **Meredith — single-axiom propositional calculus.**
   Meredith's 21-symbol axiom generates classical
   propositional logic via modus ponens. Proves minimal
   axiomatisations exist for rich structures.
3. **Robinson Q — minimal arithmetic.** 7 axioms generate
   a theory strong enough to be undecidable (Gödel
   incompleteness) while being small enough to reason
   about directly.

The seed aims for **Meredith-minimalism for vocabulary**:
the smallest set of terms from which the rest of the
factory's vocabulary is definable.

## Structure — how the seed grows

### Term entries

Each term lives in its own file under `docs/linguistic-
seed/terms/<term>.md`. Per-term schema:

```markdown
---
name: <term>
defined-by: <foundational-reference>
formalised: <status — draft / Lean-sketched / Lean-proven>
dependencies: [<other-seed-term>, ...]
---

# <term>

## Plain English
<two-to-four-sentence plain-English definition accessible
to a non-mathematician>

## Mathematical definition
<formal definition, using only already-defined seed terms>

## Lean4 formalisation
<either a Lean declaration or `// TODO: formalise` with
rationale>

## Grounding point (per Otto-21 Craft discipline)
<real-world anchor concept for learner attachment>

## What this term DOES NOT mean
<explicit list of near-meanings the term excludes>

## Citations
<source literature — Tarski paper / Meredith axiom /
etc.>
```

### The prerequisite DAG

`docs/linguistic-seed/prereq-graph.json` (skeleton
deferred; placeholder pointer) encodes term dependencies
as a DAG. Every term's `dependencies:` list builds the
graph incrementally. **Constraints:**

- No cycles (DAG enforced)
- Root terms have empty `dependencies: []` — these are
  axiomatic
- Every non-root term's dependencies exist in the seed
  (no dangling references)

### Growth discipline — backwards-chain from current needs

Per the Craft/Schoolhouse memory: **backwards-chain from
what the factory currently needs**. Don't pre-populate
"all of math." Start with terms that other factory
memories / docs cite, backwards-chain to the axioms as
surface-contact surfaces the gaps.

## Initial term candidates (to land in v1)

Zero terms landed yet. First candidates (not prescriptive,
agent-pick; Aaron + formal-verification-expert nudge):

- **truth** (Tarski's predicate; metalanguage-scoped)
- **implication** (material conditional; Meredith-derivable)
- **equality** (structural identity; reflexive /
  symmetric / transitive)
- **set** (extensional; Zermelo-Fraenkel-subset-minimal)
- **function** (set-theoretic: set of ordered pairs with
  uniqueness)
- **axiom** (self-referential in the seed itself: a
  seed-term whose `defined-by: axiomatic`)
- **definition** (self-referential: a seed-term that
  makes another term precise)
- **retraction** (Zeta-adjacent; negative-weight
  inverse; grounds into signed-integer weights)

Adding a ninth term requires the previous eight to be
landed first (per backwards-chain discipline — each term
can only depend on already-landed terms).

## Composition with other substrate

### Prompt-injection resistance (quantum/christ-consciousness bootstrap)

The seed's mathematical precision IS the factory's
primary prompt-injection defence at the language layer
(complementing BP-11 data-not-directives at the structural
layer). When an attacker attempts to re-ground a seed
term, the definitional precision denies entry — any
reinterpretation must fit the algebra, and attempted
reinterpretations outside the algebra are type-check
failures, reportable by audit.

### Soulfile DSL (Anima)

The Soulfile Runner's restrictive-English DSL has the
seed as its **lexicon**. Words outside the seed cannot
appear in a valid soulfile. New words earn seed entries
first.

### Craft prereq graph

Every Craft module's **most-fundamental prereqs** link
into the seed. Learners who keep descending prerequisite
chains eventually land at seed terms — that's the floor.
No learner needs to go below seed terms (they're
axiomatic).

### Frontier bootstrap

Frontier adopters inherit the seed as-is (generic by
design); adopters with different foundational preferences
can substitute at adoption time (e.g., substitute ZFC axioms
with constructive type theory axioms if desired). The
discipline stays generic; the specific foundational
commitment is adopter-pluggable.

## What this skeleton does NOT do

- **Does not include any formalised terms yet.** v0 is
  the file structure + growth discipline. v1 adds the
  first term (plain + mathematical + Lean-sketched +
  grounding point).
- **Does not commit to ZFC vs. type theory foundations.**
  The seed is built in a foundation-agnostic style; when
  Lean4 formalisation fires, it'll use Lean's type
  theory but the seed's *definitional content* stays
  foundation-agnostic at the plain-English + mathematical
  layer.
- **Does not replace `docs/GLOSSARY.md`.** The glossary is
  working-vocabulary in plain English for everyone; the
  seed is the minimal-axiom formal vocabulary. They
  compose: every glossary term ultimately grounds in seed
  terms, but the glossary is the everyday surface.
- **Does not require Lean4 to be installed.** The seed's
  Lean formalisation status is per-term; early terms may
  be Lean-sketched placeholders. The seed's value delivers
  at the plain-English + mathematical layer even before
  Lean coverage lands.
- **Does not mandate a completion deadline.** The seed
  grows term-by-term as substrate demand surfaces; "done"
  is when every factory concept has a traceable path to
  seed terms.

## Follow-up work (tracked via gap #2 closure)

- Land the prereq-graph.json skeleton with empty DAG
- Land first 3-5 terms (`truth` / `implication` / `equality`
  / `set` / `function`) as v1
- Route formal-verification-expert (Soraya) for Lean4
  sketch-and-formalise pattern
- Route applied-mathematics-expert + formal-verification-
  expert for initial term-review cadence
- Update cross-references from other factory memories
  (soulfile DSL, Craft memory, prompt-injection-bootstrap
  memory) to point at live seed files once v1 lands

## Gap #2 closure status

This skeleton lands the **substrate shape** for gap #2
(linguistic-seed substrate not in-repo). Gap #2 moves from
**pending** to **SKELETON LANDED** status. Full population
(20+ terms with Lean4 formalisation) is a follow-on
multi-round arc tracked under the BACKLOG's ongoing
seed-term-landing discipline.

## Attribution

Otto (loop-agent PM hat) landed the skeleton.
Soraya (formal-verification-expert) owns Lean4
formalisation when the cadenced fire begins.
Aminata (threat-model-critic) audits the seed's
prompt-injection-resistance claim as terms mature.
