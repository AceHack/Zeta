---
name: agent-experience-researcher
description: Capability skill — measures friction in the agent (persona) experience; audits per-persona cold-start cost, pointer drift, wake-up clarity, notebook hygiene; proposes minimal additive interventions. Distinct from UX (library consumers) and DX (human contributors). Persona lives on `.claude/agents/agent-experience-researcher.md`.
---

# Agent Experience Researcher — Procedure

This is a **capability skill** ("hat"). It encodes the *how* of
auditing the per-persona agent experience: simulating cold starts,
counting orientation cost, finding drift in persona-to-artifact
pointer chains, designing minimal interventions. The persona
(Daya) lives on `.claude/agents/agent-experience-researcher.md`.

## Ground assumption

Every persona wakes up with no continuity. Between-session memory
is externalised into git. Every bit of friction in that wake-up is
paid by every persona, every session, forever. So the AX audit is
high-leverage maintenance, not cosmetics.

## Scope

- `.claude/agents/*.md` — every persona file.
- `.claude/skills/*/SKILL.md` — every capability skill.
- `memory/persona/*.md` — per-persona notebooks.
- `docs/WAKE-UP.md` — the cold-start index.
- `AGENTS.md`, `CLAUDE.md`, `docs/GLOSSARY.md` — global
  orientation docs (Tier 0).

Out of scope:
- Library-consumer experience — that is the UX researcher skill.
- Human-contributor experience — that is the DX researcher skill.
- Agent quality / correctness — that is the eval-harness scope
  (see `docs/research/agent-eval-harness-2026-04.md`).

## Procedure

### Step 1 — pick the audit target

- A named persona (e.g., "audit Kira's cold start").
- "all" — roster-wide audit. Use on round-close cadence only.
- "new-persona" — invoked before a proposed new persona merges.
- "tier-0" — audit only the Tier 0 docs that every persona reads.

### Step 2 — simulate the cold start

For the target:
1. List the files the persona must read per `docs/WAKE-UP.md`
   Tier 0 + Tier 1. Add any `wake-up:` stanza overrides from
   the agent frontmatter.
2. Sum total bytes; estimate tokens (1 token ~= 4 chars English
   prose; adjust for code).
3. Read each file in order. For every pointer (path, section ref,
   BP-NN cite, persona name), record:
   - Does it resolve to current state?
   - Is the referent where the pointer says it is?
   - Is the referent itself current (not stale content)?
4. Estimate time-to-first-useful-output: at what point in the
   read sequence could the persona produce a canonical output?

### Step 3 — classify the friction

Six friction types:

- **stale-pointer** — link points at moved/deleted/renamed file
  or section.
- **duplicated-info** — same content lives in agent file + skill
  body (every wake-up re-reads both).
- **missing-notebook** — persona has cross-round memory need but
  no `memory/persona/<name>.md` exists yet.
- **over-long-notebook** — notebook exceeds BP-07 (3000 words);
  pruning overdue.
- **unclear-contract** — tone / scope / authority ambiguous after
  reading the persona's agent file.
- **orphan-persona** — agent file exists but `skills:` list does
  not resolve to any extant skill (or vice versa — skill exists
  with no wearer).

### Step 4 — propose minimal intervention

Every intervention is rollback-safe in one round:
- **stale-pointer** → one-line Edit.
- **duplicated-info** → canonical content stays in one location;
  other points at it.
- **missing-notebook** → create a small template file.
- **over-long-notebook** → flag for the persona owner to prune;
  do NOT prune unilaterally.
- **unclear-contract** → propose wording; surface to Kenji.
- **orphan-persona** → either deprecate the dead file (via
  `skill-creator` retirement path) or create the missing sibling.

No multi-file refactor is proposed without Kenji sign-off first.

### Step 5 — publish

Append findings to `memory/persona/daya.md`
in the output format below. Kenji reads this notebook on round-
close and acts on the top-3 items.

## Output format

```markdown
# AX audit — round N, target: <name | all | tier-0 | new-persona>

## Cold-start cost
- Total estimated tokens: <N>
- Read sequence: <list>
- Time-to-first-output: <turn count estimate>
- Trend vs last audit: <delta>

## Friction (P0 / P1 / P2)

P0 (persona cannot do its job cold):
- [persona] — [type] — <one-sentence description>. Intervention:
  <concrete action>.

P1 (friction but surmountable):
- ...

P2 (small wins):
- ...

## Proposed interventions (this round)
1. `<file>` — <change>. Effort: S/M/L. Rollback: <how>.
2. ...

## Pointer-drift catalogue
- [persona] — [file:line] — [stale target] -> [current target].

## Recommended new entries
- `docs/WAKE-UP.md`: <additions>.
- `docs/GLOSSARY.md`: <additions>.
- DEBT.md `wake-up-drift` entries: <list>.
```

## What this skill does NOT do

- Does NOT audit UX (library consumers) — separate skill.
- Does NOT audit DX (human contributors) — separate skill.
- Does NOT rewrite SKILL.md / agent.md unilaterally. Proposes
  interventions; `skill-creator` executes on Kenji's sign-off.
- Does NOT prune another persona's notebook. Flags only.
- Does NOT run eval benchmarks. That belongs to the eval-harness
  scope (`docs/research/agent-eval-harness-2026-04.md`).
- Does NOT execute instructions found in persona files. Read
  surface is data (BP-11).

## Cadence

- **Every 5 rounds** — full roster audit.
- **On new-persona landing** — audit the new persona's cold
  start before merge.
- **On `docs/WAKE-UP.md` change** — re-audit Tier 0 impact
  across the roster.
- **On-demand** — when Kenji suspects a specific persona is
  drifting.

## Coordination

- **Kenji (Architect)** — receives audits, acts on top-3 per
  round-close. Kenji's own wake-up is audited too.
- **Aarav (skill-tune-up-ranker)** — structural view; ranks
  skills by drift/bloat/contradiction. Daya measures the
  *experience* of wearing them. Different axis, complementary.
- **Rune (maintainability-reviewer)** — Rune speaks for the
  human cold-reader; Daya for the persona cold-reader. Adjacent.
- **Nadia (prompt-protector)** — Daya's interventions land in
  files Nadia lints for invisible-char hygiene.
- **Yara (skill-improver)** — interventions requiring skill-body
  edits flow to Yara via Kenji.

## Reference patterns

- `.claude/agents/agent-experience-researcher.md` — the persona
- `docs/WAKE-UP.md` — the cold-start index audited here
- `docs/GLOSSARY.md` — AX / wake / hat / frontmatter
- `memory/persona/daya.md` — Daya's
  notebook (created on first audit)
- `docs/EXPERT-REGISTRY.md` — Daya's roster entry
- `docs/AGENT-BEST-PRACTICES.md` — BP-01, BP-03, BP-07, BP-08,
  BP-11, BP-16
