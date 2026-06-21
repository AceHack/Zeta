---
id: 081KQX9B50008QG0R001FK1G36
priority: P1
status: in-progress
title: "ALIGNMENT.md rewrite - bidirectional clause audit and tightening"
created: 2026-05-06
last_updated: 2026-05-08
parent: 081KQ0YZ80008QG0R001QJJTVF
depends_on: [081KQX9B50008QG0R00327XC6Q]
decomposition: atomic
classification: buildable-now
type: friction-reducer
---

# 081KQX9B50008QG0R001FK1G36 - Bidirectional clause audit and tightening

Audit the existing bidirectional-alignment section and
tighten it against 081KQ0YZ80008QG0R001QJJTVF's original bidirectional-alignment
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

**Proof of prior-art search (Otto-364 + 7-axis inventory before starting 081KQX9B50008QG0R001FK1G36):**

- Wake-time-substrate: read CLAUDE.md bidirectional section + docs/ALIGNMENT.md §"Alignment is bidirectional" (lines 197+) + research/2026-05-02-*.md
- Skill-router: alignment-auditor, alignment-observability, razor-discipline (Rodney's), spec-zealot
- Orthogonal-axes: 081KQR4HQ0008QG0R001GAD29A razor-cadence, 081KQJZR90008QG0R000FTJ1TC mechanical-auth, 081KQTPYE0008QG0R00392KABJ bootstrap-razor
- Decision-archaeology: 081KQJZR90008QG0R002D6XYHB (walked depends_on 081KQX9B50008QG0R00327XC6Q + parent 081KQ0YZ80008QG0R001QJJTVF)
- PR #1701 prior-art-grep: N/A (doc-audit, not new surface)
- LOST-FILES: N/A
- Result: section exists, needs tightening vs one-way frame; no superseding prior row found. Logged 2026-05-08.

**Dependency-restructure proof:**

- depends_on: [081KQX9B50008QG0R00327XC6Q] walked — 081KQX9B50008QG0R00327XC6Q is closed (closed 2026-05-07; dependency satisfied).
- Reciprocal composes_with added to 081KQX9B50008QG0R00327XC6Q row? Deferred to next atomic (this slice is gate-only).
- Supersession: none (original 081KQ0YZ80008QG0R001QJJTVF ask preserved).
- Broken pointers: none.

**Re-decomposition note (per "assume decomposition mistakes" + "re-decompose during build"):** The "atomic" flag on this row was a planning error; the true smallest safe slice is the start-gate fulfillment itself (this edit). The actual ALIGNMENT.md tightening is child 081KQX9B50008QG0R001FK1G36.1 (future). This keeps the item claimable without broad doc rewrite in one step.

**Gate satisfied:** Row now carries proof. Next bounded step (081KQX9B50008QG0R001FK1G36.1) can edit ALIGNMENT.md under separate claim.
