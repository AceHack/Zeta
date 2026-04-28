---
name: Persona term is overloaded — prefer "expert" (agent-side) and "user persona"/"actor" (consumer-side); bare "persona" is a lint smell
description: 2026-04-20 — Aaron raised the collision between agent-persona (Kira, Viktor, Soraya) and user-persona (developer, non-developer factory consumers). Convention landed as Round-44 autonomous-loop option (a): docs-only pass now, directory rename staged as P2 BACKLOG. Use "expert" for the agent side and "user persona" (or ES-native "actor") for the consumer side. Bare "persona" in new prose is a lint smell — qualify or reword.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Persona disambiguation convention

## Rule

The bare word **persona** is overloaded in this repo. Two
legitimate meanings collide:

- **Agent persona** = the named agent-side identity
  (Kira / Viktor / Soraya / Aarav / ...), file at
  `.claude/agents/<name>.md`, notebook at
  `memory/persona/<name>/NOTEBOOK.md`.
- **User persona** = the end-user-archetype of the factory
  as a product (developer, non-developer, library consumer,
  ...), used by UX/DX/AX research and by the conversational-
  bootstrap UX design.

**Convention in newly-written prose:**

- Prefer **"expert"** for the agent side. Already the
  governance-term in `docs/EXPERT-REGISTRY.md` and
  `docs/CONFLICT-RESOLUTION.md`.
- Prefer **"user persona"** (or ES-native **"actor"**) for
  the consumer side.
- **Bare "persona"** (unqualified) in new prose is a lint
  smell — a reviewer or an auditor should ask "which one?"
  and either qualify or reword.

The convention is a *direction-of-travel* rule, not a
merge-blocker — existing text stays until a deliberate
migration round lands.

## Aaron's verbatim statement (2026-04-20)

> "how do you suggest we distinguish between our end user
> personas like develpers and non devlopers and the agent
> personas since it's the same word we need to make sure
> it's clarifed when talked about so the two context don't
> get confused personas"

Authoritative names from an earlier BACKLOG P3 row
(same day):

> "we really ahve two end user personas we care about the
> non developer and the devloper, the devlpoer is going
> to want to tell you so many invariants and not know all
> the assumptions they are immplicitly making and just
> try to drive you to hard... the non developer is going
> to underspecify everyting so a scary degree... the best
> user experince for using our factory will handle both."

## Why:

- **Precise-language-wins-arguments rule**
  (`feedback_precise_language_wins_arguments.md`):
  vocabulary collisions cost real cognitive load every time
  an agent or a human reads a skill, BP, or research doc
  and has to infer which sense is meant.
- **Factory-vs-Zeta separation is load-bearing**
  (`project_factory_reuse_beyond_zeta_constraint.md`):
  the user-persona vocabulary belongs to the factory-as-
  product surface; the expert vocabulary belongs to the
  factory-internals surface. Keeping them separate helps
  the factory read cleanly as "reusable by non-Zeta
  projects."
- **Event-Storming alignment** — ES's **actor** (yellow
  sticky) IS the user-persona primitive. Landing this
  convention now means the ES skill-group can be authored
  with vocabulary that aligns with both ES and our own
  internal naming.
- **Meta-cognition delight**
  (`user_meta_cognition_favorite_thinking_surface.md`):
  Aaron enjoys vocabulary-refactoring as a kind of meta-
  cognitive move. Landing a clean rule is satisfying and
  high-signal.

## How to apply:

- **In new skill files, persona files, ADRs, BACKLOG rows,
  memories, and research docs:** use *expert* or *user
  persona* explicitly. Never write a bare "persona" when
  the context isn't self-evident.
- **In existing files:** leave be until a deliberate
  migration round. The GLOSSARY entry
  (`docs/GLOSSARY.md` — `### Persona (overloaded — always
  qualify)` and `### User persona`) is the authoritative
  reference for anyone confused by historical text.
- **For the `memory/persona/` directory:** stays as-is
  under option (a). Rename to `memory/experts/` is a P2
  BACKLOG item (requires notebook-pointer migration across
  every expert's auto-injected notebook frontmatter; not
  reversible cheaply).
- **For `skill-tune-up` or a successor auditor skill:**
  adding a "bare-persona lint" criterion is a candidate
  9th or 10th ranking criterion. File as follow-up when
  the existing tune-up queue is otherwise clear. Related
  to the gap-of-gaps-audit policy — this is exactly the
  "unexpected gap class" pattern
  (`feedback_gap_of_gaps_audit.md`).

## What this convention does NOT do

- It does NOT rename any existing file or directory.
- It does NOT edit `.claude/agents/*.md` frontmatter.
- It does NOT touch the `memory/persona/*` tree.
- It does NOT retroactively edit any existing doc that
  uses "persona" in the agent-side sense. Historical
  prose stays historical — the GLOSSARY entry is the
  reader's compass.

## Staging (three options Aaron was offered, option (a) chosen autonomously)

- **(a)** Docs-only pass now — GLOSSARY + this memory +
  BACKLOG row for eventual rename. *Chosen.*
- **(b)** Leave `memory/persona/` as a historical artifact;
  only enforce in new writing. Still available — if (a)
  proves sufficient over several rounds, the migration
  may never be scheduled.
- **(c)** Full migration as a dedicated round — treat as
  vocabulary-refactor. Only if an audit round surfaces
  enough confusion to warrant the cost.

## Sibling memories

- `feedback_precise_language_wins_arguments.md` — the
  umbrella rule under which this convention sits.
- `project_factory_reuse_beyond_zeta_constraint.md` —
  the load-bearing separation this convention supports.
- `feedback_gap_of_gaps_audit.md` — codifying a naming
  lint is the "unexpected gap class" pattern in action.
- `user_aaron_enjoys_defining_best_practices.md` — if
  Aaron wants to course-correct this convention, invite
  him into the BP-debate channel with prior art +
  candidates + recommendation.
