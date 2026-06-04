---
name: cross-domain-translation
description: Cross-domain translation — glossary bridge, IR table, back-translation for incompatible document vocabularies.
facet: expert × applied × transformer
---

# Cross-Domain Translation — Applied Workflow

**Role.** Produces the concrete translation artefact: a
minimal-IR glossary table plus a narrative bridge,
verified by back-translation, ready to land in
`docs/GLOSSARY.md` or a target document.

**Not this skill:** does **not** explain the theory of
IR-mediated translation — see `translator-expert`. Does
**not** coin names inside a single domain — see
`naming-expert`. Does **not** adjudicate which ontology
wins when two conflict — that is `conflict-resolution-
expert` or an Architect decision.

## Inputs the skill expects

Before the workflow runs, the caller must state:

1. **Source domain A** — the originating expert
   vocabulary (e.g. "DBSP retraction-native operator
   algebra").
2. **Target domain B** — the destination vocabulary
   (e.g. "classical relational-algebra + Kleene
   closure").
3. **Audience C** — who reads the bridge (e.g.
   "database-systems researcher unfamiliar with
   incremental view maintenance").
4. **Concept-set S** — the specific terms / claims to
   bridge. Not "all of A" — a finite, named list.
5. **Existing IR basis** — if `docs/GLOSSARY.md` or a
   sibling artefact already carries translation
   primitives, the skill extends them rather than
   inventing parallel vocabulary.

Missing any of these: stop and request them. The skill
does not guess inputs — wrong audience makes every
downstream step wrong.

## Six-step procedure

### Step 1 — Domain audit

For each of A and B, list:

- Canonical terms inside S.
- Their definitions *inside their own domain* (one
  sentence each, in the domain's native register).
- Any terms that **overload** — same word, different
  meanings between A and B. Flag these in red; they
  are the highest-risk translation events.

Output: two tables (A-audit, B-audit) and an
overload-list.

### Step 2 — Minimum-basis construction

For each concept in S:

- Identify the smallest first-principles-English
  expression that covers the concept.
- Check: does this IR expression already exist in
  `docs/GLOSSARY.md` or a linked glossary? Reuse.
- If not, introduce the IR primitive with one
  definitional sentence in target register C.
- Never import unexplained domain-A or domain-B
  jargon into the IR.

Output: IR table — one row per concept, columns
(IR-term, IR-definition, reused-from).

### Step 3 — Glossary draft

Build the translation glossary:

| IR term | As said in domain A | As said in domain B | One-sentence bridge |
|---------|---------------------|---------------------|----------------------|
| ...     | ...                 | ...                 | ...                  |

The bridge sentence must use *only* IR terms plus the
reader's baseline C. No circular references (A says
"it's the B-thing," B says "it's the A-thing").

### Step 4 — Cross-check against Rodney's Razor

For each row, verify:

- **Essential complexity preserved?** Count the
  irreducible moves in the A-definition; the IR
  version has the same count.
- **Logical depth preserved?** The bridge sentence
  supports re-derivation of a concrete A-claim and a
  concrete B-claim from IR alone. If either
  derivation drops a step, the bridge is lossy.
- **Effective complexity preserved?** The bridge
  keeps structure, strips noise. Noise-indicators:
  author's favourite analogy, historical anecdote,
  domain-internal hedging. Cut.

A row that fails any of the three: redraft or flag
to `reducer` / `translator-expert` for review.

### Step 5 — Narrative bridge

Compose a short narrative (≤ 2 paragraphs per
concept, or ≤ 1 page total for the full set) that:

- Introduces each concept in IR first, domain A and
  B second (lodged by aside, not as prerequisite).
- Sequences concepts by dependency — no forward
  references.
- Uses the audience-C register throughout. If C is
  "database researcher," use research register; if
  "senior engineer," use engineer register. Never
  mix.

Output: narrative passage ready to land in the target
document.

### Step 6 — Back-translation check

The skill is not done until **both** directions pass:

- **A → IR → B.** Take a concrete claim from domain
  A that uses every concept in S. Express it in IR
  using only the glossary. Translate the IR
  expression into domain B. Does a native B speaker
  accept it?
- **B → IR → A.** Mirror the same test.

If either direction fails:

- Identify which row in the glossary lost
  information.
- Restart from Step 2 for that row. Widen the basis
  by one primitive if needed; narrow by one if
  there's noise.

Back-translation is the only gate. Ship only after
both pass.

## Output format

```markdown
## Translation bridge — <domain A> ↔ <domain B> (for <audience C>)

### Glossary (minimal-IR basis)

| IR term | <domain A term> | <domain B term> | Bridge |
|---------|-----------------|-----------------|--------|
| ...     | ...             | ...             | ...    |

### Narrative bridge

<1-2 paragraphs per concept, IR-first>

### Back-translation check

- A→IR→B on claim <X>: <verdict + native B-speaker check>
- B→IR→A on claim <Y>: <verdict + native A-speaker check>
```

## Anti-patterns this workflow catches

- **Shipping before back-translation.** The glossary
  looks complete; ship it, and a reader in domain B
  re-derives the wrong claim. Back-translation check
  would have caught it.
- **Borrowed jargon.** An IR entry that uses a word
  from A or B without defining it in audience-C terms.
  Step 2 forbids this; Step 4's essential-complexity
  check also flunks it.
- **Author-favourite analogy.** A "like riding a
  bicycle" bridge that feels good to the author but
  drops logical depth. Step 4's logical-depth check
  flunks.
- **Parallel glossary.** Introducing a second IR for a
  concept already in `docs/GLOSSARY.md`. Step 2 forces
  reuse; the skill's first check is always "does the
  IR already exist somewhere?"
- **Wrong audience register.** IR is right, narrative
  is wrong. Step 5 checks register match to C;
  mismatches get caught by an informal read-aloud.

## Relationship to factory infrastructure

- Glossary landings go to `docs/GLOSSARY.md` via the
  canonical-home discipline. The skill does not
  sprinkle glossary in prose; it lands in one place.
- Bridges that reveal a new unifying ontology get
  routed to `paced-ontology-landing` rather than
  landed raw. Translation events sometimes surface
  ontologies; when they do, the ontology-landing
  workflow takes over so the recompile cost is paced
  (`user_recompilation_mechanism.md` in human-
  maintainer memory — paced-ontology-landing is the
  factory-side externalisation).
- If two domains disagree on what counts as the same
  concept, that is a conflict-resolution event, not
  a translation event. Route to
  `conflict-resolution-expert`.

## Reference patterns

- `.claude/skills/translator-expert/SKILL.md` — theory.
- `.claude/skills/naming-expert/SKILL.md`
- `.claude/skills/etymology-expert/SKILL.md`
- `.claude/skills/reducer/SKILL.md` — Rodney's Razor
  preservation constraints used in Step 4.
- `.claude/skills/paced-ontology-landing/SKILL.md`
- `.claude/skills/conflict-resolution-expert/SKILL.md`
- `docs/GLOSSARY.md` — canonical IR home.
- `AGENTS.md` — glossary-first discipline is the
  project-level application of cross-domain
  translation.
