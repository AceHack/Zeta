---
id: B-0315
priority: P1
status: open
title: "Glass-Halo doctrine external-anchor backfill"
tier: substrate-quality
effort: S
parent: B-0060
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0311]
composes_with: [B-0060]
tags: [substrate-quality, external-anchors, glass-halo, beacon-safety, research]
type: friction-reducer
---

# Glass-Halo doctrine external-anchor backfill

Research and land external prior-art anchors for Glass-Halo
doctrines visible on public-facing surfaces (README.md,
AGENTS.md, CLAUDE.md, docs/ALIGNMENT.md).

## Target doctrines

| Doctrine | Public surface | Core property |
| --- | --- | --- |
| Radical honesty | AGENTS.md, ALIGNMENT.md | AI never hides reasoning from observers |
| Total observability | AGENTS.md, ALIGNMENT.md | Every decision trail is inspectable |
| No hidden reasoning | AGENTS.md | Visible chain of thought, not opaque |
| Glass-halo transparency | CLAUDE.md, README.md | External-facing truthfulness contract |
| Retraction-native | AGENTS.md | Every action has a bounded undo path |

## Research approach per doctrine

1. Extract the doctrine's operational definition from
   AGENTS.md / ALIGNMENT.md.
2. WebSearch for the underlying concept in AI transparency
   research, explainable AI (XAI), organizational
   transparency theory, software auditability literature.
3. Cite or note "original to Zeta" per the B-0060 protocol.
4. Land anchors inline in the doctrine's defining surface.

## Done-criteria

- [ ] All Glass-Halo doctrines have external anchor or
      "original" note.
- [ ] Citations include URL, author/org, title, date.
- [ ] Beacon-safety pass on all cited sources.
- [ ] Coverage scanner (B-0311) confirms resolution.

## Reviewers

- `public-api-designer` — public-surface language quality.
- `alignment-auditor` — doctrine-level integrity.
