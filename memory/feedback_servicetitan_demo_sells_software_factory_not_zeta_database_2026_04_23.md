---
name: ServiceTitan demo sells the software factory — NOT Zeta as data store; standard DB backend for demo; database sell is phase-next after factory adoption
description: Aaron's 2026-04-23 load-bearing directive on ServiceTitan demo positioning. The demo pitches the SOFTWARE FACTORY (AI-agent-built apps), backed by standard DB technology (Postgres-shaped). Zeta the database is explicitly NOT in the demo's pitch — that's a later-phase sell after factory adoption. Suggesting DB-technology changes during the factory pitch would kill factory adoption.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# ServiceTitan demo: software factory, not Zeta

## Verbatim (2026-04-23)

> the doemo does not need to try to get ServiceTitan to buy into
> Zeta for ther data store yet, we are really just trying to
> demo them the software factory, that will likely use a postgres
> backend or some other stanadard database technology.  The
> database still is a phase next kind of thing for service titan.
> Get them internested in the software fasctor first whith this
> demno, really don't need to even mention the database
> technolgy and once they start using the sofware factory for a
> while the database sell will be a much easier sell, please
> make sure our demo to service titan reflects this.  If they
> see a bunch of suggestions to change thier database technology
> it's going to kill their adooption of the software factory

## Rule

**Phase 1 (the demo): sell the software factory.** The demo
shows ServiceTitan what the AI-agent-built-software-factory can
do for CRM-shaped problems. Backend is a standard DB (Postgres
or similar) — boring, battle-tested, no friction.

**Phase 2 (later, after factory adoption): sell the database.**
After ServiceTitan has been using the factory for a while,
Zeta-the-database becomes a much easier sell because the
relationship and trust exist.

**Never in the demo:** algebraic-delta-inspector widgets,
retraction-native UI surfaces framed as differentiating
features, *"every interaction is a Z-set delta"* narratives,
any pitch that the database layer is remarkable. These are
correct internally but wrong-audience in a factory-adoption
pitch.

## Why this matters

Aaron's own diagnosis: *"If they see a bunch of suggestions to
change thier database technology it's going to kill their
adooption of the software factory"*. The database-change pitch
IS a threat signal to a company with existing data-tier
commitments. The factory pitch is additive — it builds on top
of whatever they already have.

Two separate sells, two separate phases. Do not compress them.

## How to apply

- **CRM-UI demo scope** — standard DB backend. Postgres or SQL
  Server, whichever ServiceTitan would accept without question.
  The UI pitches the *how it was built* (software factory +
  agents) story, not the *what it runs on top of* story.
- **Demo narrative** — the factory built this CRM app in N
  hours with M agents. Watch how changes compose. The database
  is mentioned only if asked, and then it's: "standard
  Postgres, same as anything else."
- **Commit messages, PR titles, doc headings** — when
  describing ServiceTitan-facing work, lead with "factory" or
  "AI-assisted development" framing, not with "Zeta" or
  "DBSP" or "retraction-native." The algebraic story is for
  the implementation layer, not the pitch.
- **Sample code** — if a ServiceTitan-facing sample shows ZSet
  operations, frame them as internal implementation detail. A
  reader landing on the sample should see CRM-app code that
  *happens* to use a good library, not a demo-of-the-library.
- **Agent-internal reasoning** — agents (me, specialists) can
  and should still reason using Zeta's algebraic vocabulary
  (retraction, delta, consolidate, spine). The discipline is
  about *what reaches ServiceTitan*, not what happens inside
  the factory.
- **Phase-2 signal** — if ServiceTitan starts asking questions
  about performance, scale, or reliability that a standard
  Postgres setup won't handle well, THAT is the cue to
  transition into the Zeta-database pitch. Do not pre-empt.

## What this is NOT

- Not a directive to stop building Zeta-the-database. Zeta
  work continues at the library / platform layer; it is
  phase-2 of the ServiceTitan relationship, not cancelled.
- Not a directive to hide Zeta from ServiceTitan forever.
  The phase-2 sell is after the factory adoption proves
  value — at that point, the database story is welcome.
- Not a license to over-abstract the demo. The demo still
  needs to be a real working app ServiceTitan can evaluate.
  Standard DB + great factory-built UX is the bar.
- Not a change to what Zeta *is* as a project. Zeta remains
  the F# DBSP implementation + alignment substrate. What
  changes is how we talk to *this specific audience at this
  specific phase*.
- Not a rule that extends to other audiences. Academic
  audiences get the DBSP / retraction-native pitch. Aurora
  partners get the algebraic-substrate pitch. ServiceTitan
  gets the software-factory pitch. Audience-tailored.

## How this changes the open CRM-UI plan

`docs/plans/servicetitan-crm-ui-scope.md` (just landed in PR
#144) currently frames the demo around "every interaction is an
algebraic delta on a live Zeta circuit" and a "delta inspector
as the differentiating demo surface." **That framing is wrong
for this audience.** Needs a revision to:

- Lead with "software factory built this in N hours with M
  agents."
- Swap delta-inspector for a factory-build-time visualisation
  or a "watch the agents collaborate" surface.
- Replace "retraction-native UI that surfaces Z-set semantics"
  with "clean CRM UI, standard Postgres backend, built by the
  factory in record time with measurable quality."
- Keep the CRM scenarios (customer roster, pipeline kanban,
  duplicate-review) — those are the actual CRM work. Implement
  them on top of a standard DB.
- Move the algebraic-delta demo to a SEPARATE "how it works
  internally" page linked from the demo but not on the landing
  path.

This correction should land as the next commit on PR #144 or
as a follow-up PR.

## Composes with

- `memory/project_aaron_servicetitan_crm_team_role_demo_scope_narrowing_2026_04_22.md`
  (ServiceTitan CRM team context — unchanged)
- `memory/project_aaron_funding_posture_servicetitan_salary_plus_other_sources_2026_04_23.md`
  (funding posture — ST pays for Aaron being useful; the demo
  is that usefulness made visible)
- `memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`
  (ServiceTitan+UI as priority #1)
- `docs/plans/servicetitan-crm-ui-scope.md` (needs rewrite per
  this directive)
