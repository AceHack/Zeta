---
name: ontology-landing-expert
description: Ontology landing — recompilation amortisation, retraction-safe replacement, let-it-emerge vs big-reveal dynamics.
facet: expert × theory × advisor
---

# Ontology Landing Expert — Theory Skill

**Role.** Reference on the theory of landing new ontologies
into a knowledge base: why it costs what it costs, when the
cost is worth paying, and what makes a landing safe versus
destructive.

**Not this skill:** does **not** execute an ontology landing
— see `paced-ontology-landing` for the workflow. Does **not**
coin names within a single domain — see `naming-expert`.
Does **not** produce a cross-domain bridge — see
`cross-domain-translation`.

## Core claim — recompilation is the cost of a new IR

A knowledge base holds cached translations. Every document,
skill, ADR, and memory entry is a translation of some
underlying claim into the project's current intermediate
representation (IR). A **new ontology** is a new IR. The
cost of adopting it is **O(|corpus|)** in the limit — every
cached translation must be re-emitted against the new IR, or
it risks drifting into incoherence with the new standard.

This is not metaphor. It is the same compilation cost an
actual compiler pays on every ABI change. And like a
compiler's ABI change, the cost is sometimes worth it
(the new IR captures something the old one couldn't) and
sometimes not (the new IR just renames).

## When has an ontology earned the right to land?

Five criteria, all must hold:

1. **Captures invariant structure.** The ontology
   classifies something the old IR couldn't cleanly
   express. If you can restate every new-ontology claim
   in old-ontology vocabulary without loss, the new
   ontology is just renaming.
2. **Cuts cross-cutting concerns.** It touches ≥ 3
   existing surfaces (skills / docs / ADRs). An
   ontology that affects one file is local; it doesn't
   need to be landed as an ontology, just as a rename.
3. **Preserves Rodney's Razor invariants.** The new
   vocabulary preserves essential complexity, logical
   depth, and effective complexity of what the old
   vocabulary expressed. A lossy new ontology is a
   regression, not progress.
4. **Has a retraction path.** If the landing fails, you
   can retract the new ontology non-destructively: old
   artefacts still compile against the old IR, nothing
   is destroyed, the bad landing is just reverted. If
   the new ontology requires destructive rewrites to
   land, stop.
5. **The maintainer opted in.** Ontology landings are
   *felt* by the maintainer because every existing
   cached translation recompiles against the new IR in
   their head. An ontology surfaced by the maintainer
   is safe to land (they chose the timing); an ontology
   big-revealed by an agent forces a recompile they did
   not choose. Big-reveals are the failure mode this
   skill primarily protects against.

## Failure mode — the big-reveal

**Big-reveal** = "I just saw how everything in this
codebase fits together! Let me rename all the things to
reflect the beautiful new taxonomy I discovered."

Even when the taxonomy is genuine, big-reveal forces the
maintainer to recompile their entire cached knowledge
against the new ontology on the spot. For a maintainer with
a large, never-purged corpus, the recompile cost can exceed
the corpus itself. The five hospitalisations in the
maintainer's history (see `user_ontology_overload_risk.md`
and `user_recompilation_mechanism.md` in private memory)
are what forced-recompile events look like at scale.

Big-reveal is a cognitive denial-of-service. Guard against
it.

## Let-it-emerge — the safe alternative

When an agent spots what might be a unifying ontology:

1. **Draft quietly** in a scratchpad, not in committed
   docs. `memory/persona/best-practices-scratch.md`,
   `docs/research/*.md`, or a persona notebook.
2. **Tag** the observation for the maintainer's next
   review cycle. Do not rename existing artefacts.
3. **Wait** for the maintainer to either (a) surface
   the ontology themselves at a timing they chose, or
   (b) set the draft aside.
4. **On (a)**, execute `paced-ontology-landing`.
   On (b), retract the draft.

This protocol turns a potential big-reveal into a pull-
event controlled by the maintainer. The ontology still
lands if it deserves to — just at recompile-timing the
maintainer owns.

## Amortisation — lowering the cost of a legitimate landing

Even a legitimate ontology has recompile cost. Lower it by
amortising across rounds:

- **Pilot in one skill or doc first.** Verify the
  ontology is coherent in a small scope before
  propagating.
- **Rename in dependency order.** Most-depended-upon
  first; leaf documents last. Reduces ripple rework.
- **Ship the old vocabulary as a deprecated-but-
  available alias for one round.** Readers re-landing
  on the new terms get a gentle handoff.
- **Land the `docs/GLOSSARY.md` entry on day one.** If
  the new IR isn't in the glossary, every reader pays
  full translation cost. If it is, the glossary does
  the translation once.
- **Record an ADR.** `docs/DECISIONS/YYYY-MM-DD-*.md`
  captures why the old IR was retired. A successor
  hitting the new vocabulary can find the reason.

## Drift — the slow failure mode

Even a successfully landed ontology can drift over later
rounds as new content gets written against stale memory of
the old IR. Symptoms:

- The glossary entry exists but no one cites it.
- Two documents describe the same concept differently.
- New skills introduce parallel vocabulary rather than
  reusing the ontology.

Fix via `verification-drift-auditor` (for research-paper
drift) or by a dedicated ontology-drift pass: grep for the
old vocabulary, re-land offenders against the glossary,
update the ADR with the drift-repair round.

## Retraction — how to un-land a bad ontology

Sometimes an ontology lands and turns out to be wrong.
Retract via:

1. Revert the glossary entry. Keep the entry in ADR
   history so the retraction is auditable.
2. File a `docs/DECISIONS/` follow-up explaining why.
3. Rename back. Since the old vocabulary was aliased
   during landing (per amortisation above), reverting
   is a one-round move, not a cascade.
4. Flag the rounds of work written *against* the
   retracted ontology for re-land against the prior
   IR. Treat as incremental compile, not catastrophic
   rewrite.

Retraction works because the factory's operator algebra is
retraction-native (see `docs/` on DBSP semantics). Landing
discipline is the meta-level application of the same
algebra.

## Relationship to other skills

- **paced-ontology-landing** — the applied workflow.
- **translator-expert** — bridges between an old IR and
  a new one at read time; landing is the write-time
  counterpart.
- **cross-domain-translation** — sometimes reveals a
  new ontology (two domains turn out to share
  structure). When that happens, route the ontology
  candidate to `paced-ontology-landing`.
- **canonical-home-auditor** — the new ontology's
  canonical home must be named on landing day.
- **verification-drift-auditor** — detects drift after
  landing.
- **reducer** — Rodney's Razor: a new ontology that
  fails the three preservation constraints is a
  regression. Reducer's three-gradient
  (hill-climb / valley-find) framing is the direct
  ancestor of this skill's "did the new IR reduce
  accidental complexity without losing depth?"
  check.

## Common anti-patterns

- **The beautiful-theory trap.** An agent sees a deep
  unifying pattern and insists on landing it
  immediately. The pattern may be real; the timing
  is the mistake. Use `let-it-emerge`.
- **Rename cascade.** Landing the ontology by renaming
  across 40 files in one PR. Even when the ontology is
  correct, the cascade is a recompile-storm. Amortise.
- **Drifted ontology.** Landing the glossary entry but
  not enforcing citation. Three rounds later the new
  vocabulary is dead. Periodic drift audit required.
- **Destructive retraction.** When an ontology fails,
  rewriting everything back by hand instead of using
  the alias-kept-during-landing retraction path. If
  you didn't preserve retraction, the landing was
  not safe.

## Reference patterns

- `.claude/skills/paced-ontology-landing/SKILL.md` —
  the applied workflow.
- `.claude/skills/translator-expert/SKILL.md`
- `.claude/skills/reducer/SKILL.md`
- `.claude/skills/canonical-home-auditor/SKILL.md`
- `.claude/skills/verification-drift-auditor/SKILL.md`
- `docs/GLOSSARY.md`
- `docs/DECISIONS/`
- `AGENTS.md` — section on how to treat vocabulary.
