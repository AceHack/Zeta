---
id: B-0269
priority: P1
status: open
title: "Extract carved sentences from CLAUDE.md to .claude/rules/"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0158
depends_on: [B-0268]
classification: blocked-on-B-0268
decomposition: atomic
type: feature
---

# B-0269 — Extract carved sentences to rules

If B-0268 confirms auto-load works: move carved-sentence
bullets from CLAUDE.md to individual .claude/rules/<rule>.md
files. Each rule = one carved sentence + rationale pointer.

If B-0268 fails: this row becomes "alternative spillover
surface" research.

## Acceptance criteria

- At least 5 carved sentences extracted from CLAUDE.md
- Each in its own .claude/rules/<name>.md
- CLAUDE.md shrinks by the extracted content
- Build + tests still pass
