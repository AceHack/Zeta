---
id: B-0616
priority: P3
status: open
title: "Chronologist skill — temporal + ontological + agreement reconstruction over sprawling conversations (Mika 2026-05-18 design)"
tier: skill
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: []
tags: [skill, mika, chronologist, clarity-domain, ontology-reconstruction, timeline, conversation-decomposition]
type: skill
---

# Chronologist skill — temporal + ontological + agreement reconstruction

## Why

Aaron 2026-05-18 (post-Mika-conversation): *"like something that goes through sprawling conversations and not just summarizes them but restructs the ontology and decisions in a real time timeline of the conversation — we designed the skill in the conversation."*

Captured in [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2351-2373.

## Mika's design (lines 2353-2373)

Mika proposed this as a discrete cognitive skill distinct from "summarization":

> "Timeline / Ontology decomposition: this is about taking a long, chaotic conversation or situation and organizing it into clear timelines, dependency graphs, or clean ontologies so people can actually understand what the hell happened and what everything means."

Mika placed this in a proposed "Clarity Domain" (see [B-0617](B-0617-clarity-domain-organizational-pattern-4-roles-2026-05-18.md)) alongside Cartographer, Pilot, and Recursive Composer. The Chronologist's specific responsibility: **retrospective clarity** — turning messy history/conversations into clean timelines and ontologies.

Distinct from a summarizer:

- **Summary** = compressed prose of "what was discussed"
- **Chronologist output** = three layered artifacts:
  1. **Real-time timeline**: messages in chronological order, annotated with when each ontology shift / decision / agreement happened (not when each TOKEN was emitted — when each *decision was made*)
  2. **Ontology reconstruction**: track when terms get introduced, when they get redefined, when synonymy is established/broken, when concept boundaries shift
  3. **Agreement reconstruction**: track when explicit commitments are made, who agreed (which AI / which human / which named entity), under what condition, with what reservations, when superseded

## Goal

Build a skill (or skill + supporting TS tool) that ingests a long-form conversation transcript and emits the three artifacts above, preserving the temporal sequence rather than collapsing to summary.

The empirical input that motivates this row is the [2026-05-18 Aaron-Mika conversation](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) itself — 1,055,233 chars of substantive design where Aaron noted "this is the most important coversation i've had about the project" and explicitly asked the Mika conversation be chunked into backlog items with cross-links. The Chronologist skill IS the missing tool for that work.

## Non-goals

- Generic conversation summarization (already trivially done by LLMs)
- Sentiment analysis or tone tracking (different domain)
- Real-time during-conversation analysis (this is a retrospective tool)

## Acceptance criteria

- [ ] Skill MD at `.claude/skills/chronologist/SKILL.md` with the three-artifact contract (timeline / ontology / agreements)
- [ ] Worked example on the Aaron-Mika 2026-05-18 transcript: produce the three artifacts as `docs/research/2026-05-18-mika-chronologist-output-{timeline,ontology,agreements}.md`
- [ ] Supporting TS tool at `tools/chronologist/extract.ts` for the structural extraction (parsing turn boundaries, decision markers, agreement markers); skill body wraps the tool + adds heuristics
- [ ] Cross-instance validation: run on at least one other long-form transcript (e.g., prior Aaron-Ani / Aaron-Kestrel conversation already in `memory/persona/*/conversations/`) and verify outputs are useful

## Composes with

- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) — the empirical conversation the design comes from
- [B-0617](B-0617-clarity-domain-organizational-pattern-4-roles-2026-05-18.md) — the Clarity Domain proposal Mika placed this role inside
- `.claude/skills/decision-archaeology/SKILL.md` — closest existing skill (decision-archaeology reconstructs WHY a code state exists from git + ADRs + memo trail; Chronologist reconstructs WHAT happened in a conversation from the transcript). Should compose: Chronologist outputs feed decision-archaeology when the conversation produced commits.
- `.claude/skills/save-ai-memory/SKILL.md` — preservation workflow for external AI conversations. Chronologist would naturally compose with save-ai-memory: save the verbatim conversation, then run Chronologist to produce the structured artifacts alongside.

## Status

Open. Aaron explicit-ask + Mika-co-designed.
