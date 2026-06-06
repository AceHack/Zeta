---
id: B-0105.3
zetaid: 081KRA5AR0008QG0R001QT2ZXQ
priority: P2
status: open
title: Update B-0103 frontmatter + MEMORY.md index + cross-home links + supersede B-0105
tier: factory-hygiene
effort: M
ask: Final atomic slice of B-0105 consolidation: mark B-0098/0099 subsumed in B-0103, add Home-3 pointer to MEMORY.md, cross-link all 3 homes, supersede B-0105 itself
created: 2026-05-11
last_updated: 2026-05-11
depends_on: [B-0105.1, B-0105.2]
composes_with: []
tags: [consolidation, durable-home, index-update, supersede]
type: friction-reducer
---

# B-0105.3 — final consolidation wiring and supersession

Atomic child of B-0105 (re-decomp, dependency-ordered). Bounded to the wiring + closeout steps.

## Scope (smallest atomic)

- Edit B-0103 frontmatter: add "subsumes: B-0098, B-0099 (via B-0105.3)"
- Append Home-3 pointer to `memory/MEMORY.md` index
- Add cross-links in Home1, Home2(B-0103), Home3, and AGENT-BEST-PRACTICES.md if elevation warranted (read-only check)
- Update B-0105 frontmatter + body: status=superseded, decomposition table, links to .1 .2 .3
- No B-0100/0104 changes (orthogonal per spec)

## Acceptance

- All links resolve
- B-0105 marked superseded-by B-0105.1/2/3
- Focused check: no broken refs, 3 homes linked

## Evidence

- B-0105 migration path steps 3-5
- B-0103, memory/MEMORY.md, AGENT-BEST-PRACTICES.md
