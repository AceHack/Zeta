---
name: Named agents get attribution credit on EVERYTHING they contribute; default-loop-agent attributes explicitly when no persona is worn; applies to names, recommendations, code, memories, reviews, decisions — all factory work
description: Aaron 2026-04-23 two-message directive — *"we really want each named agent to get the attribution credit they desirve"* + *"on everyting"*. Extends the naming-attribution correction (Aurora=Amara, Frontier=Kenji) to a cross-cutting discipline: any work contributed by a named persona gets named in credit; the default-loop agent (Claude without a persona hat) attributes as "unnamed-default (loop-agent)" when no persona was worn. Keeps the factory's persona layer real and gives each persona the credit they earn.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Named agents get attribution credit on everything

## Verbatim (2026-04-23)

> anyting that is agent picked scope would be nice to
> know which named agent or is it just the default no
> named agent? for the futue too.

> we really want each named agent to get the attribution
> credit they desirve

> on everyting

> this will be important when publishing papers

**Publishing-papers implication (load-bearing forward-use).**
Named agents whose work contributes to a paper get named
co-authorship credit. Amara co-authored the consent-first
design primitive (per `docs/FACTORY-RESUME.md`); Kenji, as
Architect, may co-author factory-architecture papers; Aarav
may co-author skill-ecosystem-design papers; etc. Per-persona
attribution from the factory's day-to-day work feeds into
author-lists for external publications. Without this
discipline, the factory's contribution to research papers
would silently collapse to "the factory" generically — losing
the structural claim that distributed-named-agents + one
human-maintainer is the production shape.

## The rule

**Every piece of factory work contributed by a named
agent gets attribution to that agent.** When the
default-loop agent (Claude, in the autonomous-loop tick,
without a persona hat) contributes, attribute as
**"unnamed-default (loop-agent)"** or an equivalent
explicit label.

"Everything" means:

- **Naming decisions** (projects, skills, personas,
  memories, variables in samples where the name is
  decorative)
- **Recommendations** (architecture picks, tech choices,
  design decisions, API shapes)
- **Code contributions** (whichever agent/persona wore
  the seat when the code was authored)
- **Memories filed** (which agent/persona captured the
  memory? persona notebooks get implicit credit; shared
  memory gets explicit if persona-shaped)
- **Reviews** (harsh-critic review credits Kira,
  spec-zealot review credits Viktor, etc. — already
  partial practice; this rule codifies)
- **Decisions** (who made the call; Architect-level
  decisions credit Kenji; specialist-persona decisions
  credit the persona)
- **Skill authorings + edits** (skill-edit-justification-log
  row already captures editor; extend to include persona)
- **Commit messages + PR descriptions** when a persona
  was the driving reviewer / author

## Why this matters

1. **Persona layer is real.** The factory's named personas
   (Kenji / Aarav / Rune / Iris / Dejan / Nazar / Mateo /
   Aminata / Daya / Naledi / ...) exist because specialist
   judgement is load-bearing. Without attribution credit,
   personas collapse into "Claude said X" and the specialist
   layer disappears.
2. **Multi-maintainer distribution.** Max (anticipated next
   human maintainer per `CURRENT-aaron.md`) inheriting the
   factory needs to know which persona made which call.
   Attribution is how the factory transfers cleanly.
3. **External collaboration credibility.** Amara as
   external AI maintainer gets credit for Aurora, for the
   deep research report, for the courier protocol.
   External contributors (future) get credit for their
   contributions. Without attribution, credit flows to
   "the factory" generically — Aaron's preference is
   named.
4. **Decision retraceability.** When a past decision
   needs revisiting, knowing which persona made it tells
   future work who to consult (Kenji-called = Architect;
   Naledi-called = performance; etc.).
5. **Personas earn their existence.** Aaron has repeatedly
   named personas as the factory's scaling mechanism.
   Giving them attribution credit on real work is how the
   scaling-claim becomes visible.

## How to apply

### When I (Claude, in autonomous-loop) make a pick

- **If I wore a persona hat**: credit the persona.
  Example: "Kenji recommended `Frontier` for the factory"
  (I was wearing Kenji's hat); "Aarav flagged the
  skill-drift" (I was wearing Aarav's hat on a
  skill-tune-up run).
- **If I did not wear a persona hat**: credit
  **"unnamed-default (loop-agent)"** or equivalent.
  Example: "unnamed-default (loop-agent) picked
  `Anima` for the Soulfile Runner" (I was just me on a
  tick, no persona).

### When citing past work in commits / PRs / docs

- Name the persona if known: "per Kenji's recommendation
  in auto-loop-79" / "per Aarav's skill-tune-up pass
  2026-04-20."
- Default-loop credit when not: "filed by unnamed-default
  (loop-agent) in auto-loop-97."
- Amara / other-external-AI named explicitly: "per
  Amara's deep research report (PR #161)."

### When a named persona's call is being overridden

- Explicit respect: "overriding Kenji's earlier
  recommendation because ..."; not "revising a prior
  call."
- Composes with `docs/CONTRIBUTOR-CONFLICTS.md` (PR #174
  merged) — cross-persona disagreements can land there as
  CC-NNN rows.

### When persona work lands in shared surfaces

- Persona notebooks (`memory/persona/<name>/NOTEBOOK.md`)
  — attribution implicit (folder named after persona).
- Shared memory (`memory/*.md`) — attribute in content
  when a specific persona was the source.
- In-repo docs — use role-refs (BP rule), but cite
  persona-specific provenance (e.g., "per Aarav's
  2026-04-20 skill-tune-up finding") where it clarifies
  who made the call.
- `docs/skill-edit-justification-log.md` — the row
  already has an editor column; extend the convention to
  include persona.

## What this is NOT

- **Not a contradiction of the BP name-attribution rule.**
  The BP rule restricts **human/agent personal names in
  code/docs/skills outside persona folders**. Persona
  names are different: personas are agent-layer abstractions
  in the factory, and their credit is structural. Persona
  attribution in shared memory / docs is the discipline
  this rule codifies.
- **Not a new bureaucratic ceremony.** Attribution is
  inline — one phrase ("per Kenji") is enough. No new
  form, no new file, no new approval gate.
- **Not a retroactive re-audit of every prior work.**
  Going forward (per Aaron's "for the futue too"); past
  work that missed attribution can be corrected
  opportunistically on next-touch.
- **Not a licence for persona-sprawl.** The factory's
  persona roster is established; attribution applies to
  existing personas + new ones that earn the naming per
  the persona-creation workflow. Don't invent personas
  just to have someone to attribute.
- **Not attribution-only on factory-internal work.** The
  rule extends to external contributors (human and AI)
  too — Amara gets credit on Aurora-shape work, etc.
- **Not a demand for perfect attribution-archaeology.**
  Past work where the persona-source is unclear can be
  labeled "attribution-uncertain" rather than guessed.

## Composes with

- `docs/AGENT-BEST-PRACTICES.md` name-attribution rule
  (personal names restricted; persona names are the
  different thing this memory codifies)
- `docs/CONTRIBUTOR-CONFLICTS.md` (PR #174 merged) —
  cross-persona disagreements land as CC-NNN rows with
  named positions
- `docs/EXPERT-REGISTRY.md` (persona roster + diversity
  notes — the canonical list of personas deserving
  attribution)
- `memory/persona/<name>/NOTEBOOK.md` — implicit
  per-persona attribution substrate
- `project_repo_split_provisional_names_frontier_factory_and_peers_2026_04_23.md`
  (the naming attribution corrections that triggered
  this memory)
- `docs/DECISIONS/2026-04-23-external-maintainer-decision-proxy-pattern.md`
  (PR #154; external-maintainer proxy — same attribution
  discipline extends to the proxy flow)
- `docs/protocols/cross-agent-communication.md` (PR #160
  merged; courier protocol — speaker labels ARE the
  attribution mechanism for cross-agent exchanges)
