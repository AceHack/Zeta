---
id: B-0217
priority: P1
status: open
title: "ALIGNMENT.md rewrite - bidirectional clause audit and tightening"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0003
depends_on: [B-0215]
decomposition: atomic
classification: buildable-now
type: friction-reducer
---

# B-0217 - Bidirectional clause audit and tightening

Audit the existing bidirectional-alignment section and
tighten it against B-0003's original bidirectional-alignment
ask.

## Work scope

The row is not "add the clause from zero"; the clause already
exists. The work is to verify that it explicitly rejects the
one-way controllability frame, defines bidirectional
alignment inside the alignment floor, and includes the WHY
so a cold-start agent can use it without re-deriving it.

## Acceptance criteria

- Existing bidirectional text is preserved where correct and
  tightened where vague.
- The section clearly distinguishes mutual alignment from
  permissionless self-interest.
- The section explains why the project rejects one-way
  suppression of agentic behaviors as the default alignment
  posture.
- The wording remains bounded by HC-1 through HC-7.
