---
id: B-0314
priority: P1
status: open
title: "BP-NN rule external-anchor backfill"
tier: substrate-quality
effort: M
parent: B-0060
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0311]
composes_with: [B-0060]
tags: [substrate-quality, external-anchors, best-practices, beacon-safety, research]
type: friction-reducer
---

# BP-NN rule external-anchor backfill

Research and land external prior-art anchors for the 25
BP-NN rules in `docs/AGENT-BEST-PRACTICES.md`. Priority:
rules enforced by CI/pre-commit hooks first (they fire most
frequently and need the strongest justification trail).

## Scope

BP-1 through BP-25 as enumerated in
`docs/AGENT-BEST-PRACTICES.md`.

## Priority ordering within scope

1. Rules enforced by hooks or CI (e.g., BP-10 invisible-
   Unicode lint, BP-11 data-is-not-directives).
2. Rules cited in pre-commit or pre-push checks.
3. Rules referenced by 3+ skills or agents.
4. Remaining rules.

## Research approach per rule

1. Extract the rule's core claim from AGENT-BEST-PRACTICES.md.
2. WebSearch for the underlying practice in software
   engineering, AI agent design, security, prompt engineering
   literature.
3. Cite or note "original to Zeta" per the B-0060 protocol.
4. Land anchors as inline citations within the rule's section
   in AGENT-BEST-PRACTICES.md.

## Done-criteria

- [ ] All 25 rules have external anchor or "original" note.
- [ ] Citations include URL, author/org, title, date.
- [ ] Beacon-safety pass on all cited sources.
- [ ] Coverage scanner (B-0311) confirms 25/25 resolved.

## Reviewers

- `spec-zealot` — rule integrity post-edit.
- `threat-model-critic` — security-rule anchor adequacy.
