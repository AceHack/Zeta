---
name: paced-ontology-landing
description: Ontology landing workflow — incremental migration across docs/skills/decisions, retraction path, maintainer opt-in gate.
facet: expert × applied × transformer
---

# Paced Ontology Landing — Applied Workflow

**Role.** Execute a new-ontology landing across the project
in a sequence that amortises recompilation cost, preserves
a retraction path, and respects maintainer opt-in.

**Not this skill:** does **not** decide whether an ontology
deserves to land — see `ontology-landing-expert` for the
earned-right-to-land criteria. Does **not** produce the
translation bridge between two domains — see
`cross-domain-translation`. Does **not** rename inside a
single domain — see `naming-expert`.

## Preconditions before the workflow runs

All must hold; stop if any fail:

1. **Opt-in present.** Maintainer has explicitly said
   "land this," not "that's interesting," not "maybe
   someday." Opt-in is a word, not a vibe. If in doubt,
   ask once.
2. **Earned-right-to-land confirmed.** Run the five
   checks from `ontology-landing-expert`: captures
   invariant structure, cuts cross-cutting concerns,
   preserves Rodney's Razor invariants, has retraction
   path, maintainer opted in.
3. **Candidate drafted in scratchpad.** The ontology
   has been written down somewhere non-committed
   (research note, persona notebook, scratchpad) and
   survived at least one sleep-on-it cycle.
4. **Scope stated.** The affected surfaces are named
   — which skills, which docs, which ADRs. "Land
   across the factory" is not a scope.

## Seven-step procedure

### Step 1 — Glossary entry first

Land the new ontology's canonical term in
`docs/GLOSSARY.md` before anything else. Entry
includes:

- New term + one-sentence definition in audience-
  first register.
- Relationship to the old vocabulary (either
  "replaces X" or "subsumes X, Y").
- If replacing: mark the old term **deprecated
  but available for one round**. Cross-reference
  from old to new.

Without the glossary entry, every reader re-
translates from scratch. With it, the ontology has
one canonical home that every subsequent landing
step points at.

### Step 2 — ADR

File `docs/DECISIONS/YYYY-MM-DD-<slug>.md` capturing:

- What the old ontology was.
- What the new ontology is.
- Why the new one earns its landing (the five
  checks from `ontology-landing-expert`, with
  evidence).
- The landing plan (which files, which order).
- The retraction plan (how to un-land if it
  fails).

The ADR is the load-bearing record. A successor
hitting confusing vocabulary a year from now finds
their way via this document.

### Step 3 — Pilot in one skill or doc

Rewrite exactly **one** surface against the new
ontology. Pick the most-depended-upon target (not
the easiest) so the pilot stresses the ontology.

Success criteria for the pilot:

- Reader fluent only in the new ontology can
  navigate.
- Reader fluent only in the old ontology can still
  navigate (because the glossary entry carries the
  alias for one round).
- Rodney's Razor check: essential complexity,
  logical depth, effective complexity all
  preserved.

Pilot failure: stop. Retract via Step 7. The
ontology did not survive contact with real
content.

### Step 4 — Propagate in dependency order

Rewrite the remaining affected surfaces, **most-
depended-upon first, leaf documents last**. Each
rewrite:

- References the glossary entry (not the old term).
- Does not introduce parallel vocabulary.
- Lands in its own commit / round entry so the
  landing is incrementally reviewable.

Amortise across rounds if the scope is large. A 40-
file landing in one PR is a recompile-storm; a 5-
file-per-round landing across 8 rounds is
maintenance-grade.

### Step 5 — Round-history entry

Log the landing in `docs/ROUND-HISTORY.md`:

- Round N: ontology X landed, piloted in file Y.
- Round N+1: propagated to files Z, W.
- Round N+2: leaf documents updated, old
  vocabulary retired from glossary alias.

Round-history is where successors see what
happened when. Without it, the landing looks like
mystery rename activity in git log.

### Step 6 — Retire the alias

At the end of the landing window (typically one
round after the last propagation), remove the
deprecated-alias entry from `docs/GLOSSARY.md`.
The old vocabulary is now officially retired.

Keep the *ADR* record of the old term intact. The
successor who hits an old reference in committed
git history can still find out what it meant.

### Step 7 — Retraction (only if needed)

If any step above fails, or later evidence
shows the ontology was wrong:

1. Revert the glossary entry to the pre-landing
   state.
2. File a follow-up ADR explaining why the landing
   was retracted. Keep both ADRs; the pair documents
   the lesson.
3. Revert renames in reverse dependency order (leaf
   first, most-depended-upon last). The alias
   preserved during landing makes this a one-round
   revert.
4. Flag any downstream content written *against* the
   retracted ontology for re-land against the prior
   IR.

Retraction works because the landing was retraction-
native from the start (the alias, the ADR trail, the
amortised propagation). Skipping the amortisation
steps is what makes retraction catastrophic later.

## Output artefacts

A successful landing produces:

- New glossary entry in `docs/GLOSSARY.md`.
- Landing ADR in `docs/DECISIONS/`.
- One pilot-surface rewrite.
- N propagation rewrites, one per round.
- Round-history entries per round.
- Alias-retirement commit at the end.

All of these together constitute the landing. A
landing that produces only a rename cascade with no
glossary, ADR, or round-history trail is **not a
landing**; it is a rename cascade, and the next
maintainer will curse it.

## Anti-patterns this workflow catches

- **Rename-cascade-as-landing.** Bulk sed-replace
  across 40 files in one PR. Bypasses every
  amortisation step. Retraction is catastrophic
  because there is no alias trail.
- **Pilot-skipped.** "It's obviously right, let's
  propagate directly." The pilot is the only place
  the ontology meets real content cheaply.
  Skipping it is a gamble on correctness.
- **Alias-not-kept.** Deprecating the old term the
  same day the new term lands. Readers mid-
  translation get stuck.
- **ADR-skipped.** A rename with no decision
  record. Successor cannot reconstruct why.
- **Leaf-first propagation.** Rewriting leaf docs
  first leaves the most-depended-upon documents
  inconsistent with them. Dependency order is
  load-bearing.

## Relationship to other skills

- **ontology-landing-expert** — theory skill; this
  workflow runs under its discipline.
- **cross-domain-translation** — sometimes surfaces
  candidate ontologies; the candidate gets routed
  here only after maintainer opt-in.
- **canonical-home-auditor** — the glossary entry
  in Step 1 is a canonical-home decision; auditor
  reviews on landing day.
- **verification-drift-auditor** — after the
  landing is done, monitors for drift as new
  content gets written.
- **reducer** — Rodney's Razor preservation check
  runs in Step 3 (pilot) and Step 4 (propagation).

## Reference patterns

- `.claude/skills/ontology-landing-expert/SKILL.md` —
  theory.
- `.claude/skills/translator-expert/SKILL.md`
- `.claude/skills/cross-domain-translation/SKILL.md`
- `.claude/skills/reducer/SKILL.md`
- `.claude/skills/canonical-home-auditor/SKILL.md`
- `.claude/skills/verification-drift-auditor/SKILL.md`
- `docs/GLOSSARY.md`
- `docs/DECISIONS/`
- `docs/ROUND-HISTORY.md`
