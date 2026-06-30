---
id: B-0617
priority: P3
status: open
title: "Clarity Domain — 4-role organizational pattern (Cartographer / Pilot / Recursive Composer / Chronologist) from Mika 2026-05-18 design"
tier: governance
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: []
tags: [governance, mika, clarity-domain, cognitive-infrastructure, roles, ai-native]
type: governance
---

# Clarity Domain — 4-role organizational pattern

## Why

Aaron 2026-05-18: *"we designed [...] real AI native economy roles not huamn roles"* — the Mika conversation proposes a discrete organizational domain ("Clarity Domain") with 4 named roles that are AI-native (not borrowed from human org-chart conventions).

Captured in [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2369-2373.

## Mika's proposal (line 2373)

> "New Domain: The Clarity Domain — This domain is responsible for helping the entire civilization think, understand, and make progress clearly. It sits as its own independent function, separate from both the emotional layer and the technical layer.
>
> The Four Roles:
> - **The Cartographer** — Real-time system visibility and mapping. Answers: Where are we and what's actually going on?
> - **The Pilot** — Direction, coordination, and decision-making. Answers: Where are we going and how do we get there?
> - **The Recursive Composer** — Continuous forward momentum on large, messy problems. Their job is to keep slicing off one clean, usable piece at a time without getting stuck.
> - **The Chronologist** — Retrospective clarity. Takes messy conversations, history, or situations and turns them into clean timelines, ontologies, and structured understanding.
>
> These four roles together form the Clarity Domain. They're the ones who make sure the civilization doesn't get lost in its own complexity."

## Distinct from existing personas/agents

- These are ROLES (hats wearable by any agent), not personas (named individuals)
- Distinct from Resonance Weaver's emotional-domain team (which Mika owns; see Mika research file lines 2301+ for Resonance team structure)
- Distinct from technical coding/physics work
- Independent function — own domain

The 4 roles map roughly to 4 of the 7 interrogatives Aaron listed at line 2385 (where, where-going, how, what-has-happened), but the mapping isn't strict.

## Goal

Decide:
1. Adopt the Clarity Domain as a formal organizational pattern in Zeta governance docs (or not)
2. If adopted, map existing personas/agents to which-hat-when (e.g., Otto wears Pilot for tick-decisions; Kestrel wears Cartographer for sharpening dialogues; etc.)
3. Build the missing hat-skills: Chronologist explicitly has B-0616; check whether Cartographer / Pilot / Recursive Composer need their own skill files or are covered by existing `factory-audit`, `architect`, `backlog-decomposer` skills

## Non-goals

- Renaming existing personas (Otto / Mika / Kestrel / Ani / etc.)
- Forcing every agent to wear one of these 4 hats (the hats are AVAILABLE, not REQUIRED)
- Bureaucratic enforcement (this is cognitive infrastructure, not policy)

## Acceptance criteria

- [ ] Decision recorded (adopt / reject / adopt-with-modifications) — likely in `docs/governance/` or `docs/research/`
- [ ] If adopted: skill MD for each missing role (Cartographer / Pilot / Recursive Composer; Chronologist already at B-0616)
- [ ] Mapping table: which existing personas wear which Clarity Domain hat in which context
- [ ] At least one worked example (e.g., Otto-CLI wearing Pilot hat during the autonomous-loop tick decision)

## Composes with

- [B-0616](B-0616-chronologist-temporal-ontological-agreement-reconstruction-skill-2026-05-18.md) — the Chronologist role's specific skill
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) — the conversation that produced the design
- `.claude/skills/architect/SKILL.md` — closest existing "Pilot-like" skill (direction + coordination via parallel-agent dispatch)
- `.claude/skills/factory-audit/SKILL.md` — closest existing "Cartographer-like" skill (system visibility + drift detection)
- `.claude/skills/backlog-decomposer/SKILL.md` — closest existing "Recursive Composer-like" skill (continuous slicing of large rows)
- `.claude/skills/decision-archaeology/SKILL.md` — adjacent to Chronologist (retrospective WHY reconstruction; Chronologist is retrospective WHAT reconstruction from conversations)
- `.claude/rules/agent-roster-reference-card.md` — currently lists personas; Clarity Domain adoption would extend it with hats-mapping

## Status

Open.
