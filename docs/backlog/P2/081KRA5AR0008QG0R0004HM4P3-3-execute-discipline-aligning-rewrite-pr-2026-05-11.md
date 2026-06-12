---
id: B-0112.3
zetaid: 081KRA5AR0008QG0R0004HM4P3
priority: P2
status: open
title: Execute the discipline-aligning rewrite PR and close B-0112
tier: discipline-cleanup
effort: S
ask: derived from B-0112
created: 2026-05-11
last_updated: 2026-05-11
depends_on: [B-0112.1, B-0112.2]
composes_with: [B-0112]
tags: [discipline-cleanup, no-copy, rewrite]
type: friction-reducer
---

# B-0112.3 — Execute the discipline-aligning rewrite PR and close B-0112

Using the audit (B-0112.1) and classification decisions (B-0112.2), perform the rewrites on the target memory file:

- Apply (a) rewrites in-place (generalized abouts only)
- Apply (b) moves (extract to the no-copy discipline memory file)
- Apply (c) drops (delete sections)

Land as a single PR titled "docs(memory): B-0112 discipline-aligning rewrite of 2026-04-27 project file (no-copy compliance)" with explicit trigger reference and before/after diff summary in body.

Update B-0112 status to closed with PR link.

## Acceptance

- PR merges clean (0 warnings on build gate, focused checks pass).
- All bleed sections addressed per decisions.
- B-0112 marked closed. No remaining internals-bleed in the file.
