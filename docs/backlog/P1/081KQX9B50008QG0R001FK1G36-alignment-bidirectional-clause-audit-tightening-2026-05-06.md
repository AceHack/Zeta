---
id: B-0217
zetaid: 081KQX9B50008QG0R001FK1G36
priority: P1
status: in-progress
title: "ALIGNMENT.md rewrite - bidirectional clause audit and tightening"
created: 2026-05-06
last_updated: 2026-05-08
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

## Pre-start checklist (gate per CLAUDE.md / AGENTS.md)

**Proof of prior-art search (Otto-364 + 7-axis inventory before starting B-0217):**

- Wake-time-substrate: read CLAUDE.md bidirectional section + docs/ALIGNMENT.md §"Alignment is bidirectional" (lines 197+) + research/2026-05-02-*.md
- Skill-router: alignment-auditor, alignment-observability, razor-discipline (Rodney's), spec-zealot
- Orthogonal-axes: B-0192 razor-cadence, B-0160 mechanical-auth, B-0193 bootstrap-razor
- Decision-archaeology: B-0169 (walked depends_on B-0215 + parent B-0003)
- PR #1701 prior-art-grep: N/A (doc-audit, not new surface)
- LOST-FILES: N/A
- Result: section exists, needs tightening vs one-way frame; no superseding prior row found. Logged 2026-05-08.

**Dependency-restructure proof:**

- depends_on: [B-0215] walked — B-0215 is closed (closed 2026-05-07; dependency satisfied).
- Reciprocal composes_with added to B-0215 row? Deferred to next atomic (this slice is gate-only).
- Supersession: none (original B-0003 ask preserved).
- Broken pointers: none.

**Re-decomposition note (per "assume decomposition mistakes" + "re-decompose during build"):** The "atomic" flag on this row was a planning error; the true smallest safe slice is the start-gate fulfillment itself (this edit). The actual ALIGNMENT.md tightening is child B-0217.1 (future). This keeps the item claimable without broad doc rewrite in one step.

**Gate satisfied:** Row now carries proof. Next bounded step (B-0217.1) can edit ALIGNMENT.md under separate claim.
