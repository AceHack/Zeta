---
id: 081KQGDBJ0008QG0R003G89BKR
priority: P2
status: open
title: RX (Research eXperience) researcher persona — meta-research on the research process
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: feature
---

# 081KQGDBJ0008QG0R003G89BKR — RX (Research eXperience) researcher persona

## What

Define a new factory persona: **RX (Research eXperience)
researcher** — a meta-research role whose job is to study and
improve the **process** of doing research within the factory.
Composes with the existing persona-roster experience-researcher
trio (UX / DX / AX) at a fourth orthogonal axis.

**Naming disambiguation** (Aaron 2026-05-01): RX here stands for
**Research eXperience**, NOT **Reactive Extensions** (Microsoft's
Rx.NET / RxJava / RxJS family). The factory's RX persona has
nothing to do with the reactive-extensions library. The collision
is unfortunate but intentional — Aaron's framing is RX-as-
research-experience-researcher; documenting the disambiguation
prevents future-Otto confusion.

## Why now

Aaron 2026-05-01:

> *"we need like a RX research user experience researcher"*
>
> *"not to be confused with the reactive extensions rx lol"*

The factory has accumulated significant **research B-rows** —
081KQGDBJ0008QG0R000RWAA67 (PM-2 forward-research cadence), 081KQGDBJ0008QG0R0004ACHJJ (timeseries-DB
research), 081KQGDBJ0008QG0R002175ECA (MDX-as-meta-DSL research), 081KQGDBJ0008QG0R003PZFA49 (timeseries
domain expert + teacher), and many more across the backlog. Each
research lane has a *what* (the question) and a *who* (the domain
expert) but no role studying the *how* (the research process
itself).

**Without an RX researcher**, research lanes:

- Re-invent methodology each time (no compounding from prior
  research lanes' lessons)
- Lack measurement of research effectiveness (which research
  lanes pay off? which are dead-ends? what predicts the
  difference?)
- Have inconsistent rigor (some land deep design docs; others
  surface as backlog rows that never advance)
- Don't share research-tools / research-templates / research-
  lessons across persona boundaries

The RX researcher fills this meta-gap: studies the research
process to make ALL research lanes more effective.

## Persona-roster context — the four-axis experience-researcher group

The factory's existing experience-researcher personas:

| Persona | Axis | Studies |
|---|---|---|
| Iris | UX | First-10-min library-consumer experience |
| Bodhi | DX | First-60-min contributor experience |
| Daya | AX | Agent cold-start experience |
| **RX (this row)** | **Research** | **Research-process experience** |

Each of the four sits on an orthogonal axis. None substitutes
for another. RX completes the four-axis set.

## Scope (what the RX researcher owns)

1. **Research-process discovery** — interview / observe persona
   roles who run research lanes (Otto-as-PM, Mateo-security,
   Aarav-skill-expert, the timeseries domain expert per
   081KQGDBJ0008QG0R003PZFA49, etc.). Document common patterns, common pain points,
   common dead-ends.

2. **Research-methodology lessons-mechanization** — when a
   research lane discovers something that would have helped a
   prior research lane, the RX researcher mechanizes the
   lesson (memory file, BP-NN candidate, research-template,
   tooling).

3. **Research-tool-and-template library** — `tools/research/`
   contains shared research scaffolding (Pareto-frontier
   templates per 081KQGDBJ0008QG0R0004ACHJJ, dependency-priority filter per
   081KQGDBJ0008QG0R0004ACHJJ, candidate-evaluation matrices, fit-analysis
   doc structures). RX maintains this library.

4. **Research-effectiveness measurement** — composes with the
   metrics-are-our-eyes framing (per
   `feedback_dependency_source_priority_*_2026_05_01.md`):
   does a research lane's recommendation get acted on? Does
   the implementation match the prediction? What predicts
   high-action research vs low-action? RX defines these
   metrics + tracks them.

5. **Research-process critique** — RX is the persona who can
   say "this research lane is producing memos no one acts on"
   without it being interpreted as critique of the persona
   doing the research. The role-separation makes the critique
   safe to deliver and safe to receive.

## Key questions the RX researcher addresses

- **Why do some research lanes land and others stall?**
  (Pattern-recognition across the backlog history.)
- **What research-templates have we re-invented N times?**
  (Candidates for shared `tools/research/` scaffolding.)
- **Which research outputs predict high-quality
  implementation?** (Which forms — Pareto-tables vs
  decision-trees vs prose memos — produce the best
  follow-ups.)
- **What is the right cadence for forward-research vs
  reactive-research?** (Composes with PM-2 role per 081KQGDBJ0008QG0R000RWAA67.)
- **How does the factory's research process compare to
  established traditions?** (Lean Six Sigma, Agile spike,
  Design Sprint — pull principles, reduce ceremony per the
  parallelism-ladder substrate.)
- **Where is research-fatigue a real signal?** (Persona
  bandwidth check — research-debt vs research-overhead.)

## Acceptance criteria

1. **Persona definition** — entry in
   `docs/EXPERT-REGISTRY.md` defining RX scope, orthogonality
   to UX/DX/AX, hand-off rules.

2. **Persona name** — picked via the standard naming-expert
   review process. Until then, role-ref *"RX researcher"*
   with the Research-eXperience disambiguation prominent.

3. **Skill file** — `.claude/skills/rx-researcher/SKILL.md`
   following the standard skill template. Covers
   discovery / mechanization / measurement scope,
   when to dispatch, what NOT to do.

4. **First RX artifact** — within 4 weeks of persona
   activation, a research-process-audit doc lands at
   `docs/research/rx-baseline-audit-YYYY-MM.md` covering
   the current state of factory research process across at
   least 3 in-flight or recently-landed research lanes.

5. **Research-tool library seed** — `tools/research/README.md`
   + at least one shared research-template (e.g., Pareto-
   frontier template extracted from 081KQGDBJ0008QG0R0004ACHJJ's research
   methodology section).

## Out of scope (defer)

- **Implementation of research process changes.** RX
  researches and recommends; PM-2 / Otto / persona-roster
  acts on the recommendations.
- **Authority over individual research lanes.** RX studies
  process, not content. The timeseries-DB domain expert
  (081KQGDBJ0008QG0R003PZFA49) owns the timeseries research; RX may study HOW
  that research is done.
- **Replacing persona-specific research.** Mateo's
  security-research, Aarav's skill-research, Iris's UX-
  research, etc. all continue with their own scope. RX
  observes across them.

## Composes with

- `docs/EXPERT-REGISTRY.md` — extension target
- Iris (UX), Bodhi (DX), Daya (AX) — sibling experience-
  researcher personas; the four-axis orthogonal set
- 081KQGDBJ0008QG0R000RWAA67 (PM-2 role) — adjacent cadence-driven research
  role; RX studies PM-2's process
- 081KQGDBJ0008QG0R0004ACHJJ / 081KQGDBJ0008QG0R002175ECA / 081KQGDBJ0008QG0R003PZFA49 — concrete research lanes RX
  studies first
- task #323 (per-tool/language expert skills) — RX is one
  per-domain expert skill, but at meta-level
- `feedback_dependency_source_priority_*_2026_05_01.md`
  (PR #1117) — metrics-are-our-eyes framing applies to
  research-effectiveness metrics
- `feedback_parallelism_scaling_ladder_*_2026_05_01.md`
  (PR #1116) — pull-principles-reduce-ceremony for the
  established research traditions (Lean Six Sigma, Design
  Sprint, etc.)

## Effort

**M (medium, 1–3 days)** for persona definition + skill file +
EXPERT-REGISTRY entry + first RX baseline-audit + research-
tool library seed. Ongoing RX work is open-ended.

## Why P2

- **Not P0/P1** because the factory's research lanes operate
  today without dedicated RX support; meta-improvements
  compound but don't block.
- **Not P3** because as the factory scales (parallelism ladder
  rungs 2-5; multi-research-lane operation; 081KQGDBJ0008QG0R000RWAA67 PM-2
  forward-research cadence), the absence of an RX researcher
  produces compounding inefficiency.
- **P2** — important meta-investment; lands when persona-
  roster bandwidth permits.
