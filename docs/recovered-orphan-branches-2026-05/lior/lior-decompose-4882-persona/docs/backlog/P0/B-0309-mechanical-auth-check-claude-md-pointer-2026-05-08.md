---
id: B-0309
priority: P0
status: open
title: "Mechanical authorization check — CLAUDE.md discoverable-skill pointer"
effort: XS
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0160
depends_on: [B-0308]
classification: blocked
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [documentation, mechanical-check, claude-md]
---

# B-0309 — CLAUDE.md discoverable-skill pointer

## What

Add a CLAUDE.md bullet that makes the mechanical-authorization-
check skill discoverable at wake-time. Per the wake-time-substrate-
or-it-didn't-land rule, the skill exists but is invisible to cold-
start agents without a CLAUDE.md pointer or a transitive path
from CLAUDE.md.

Depends on B-0308 (loop integration) rather than just B-0305
(skill body) because a CLAUDE.md pointer to a skill that doesn't
work end-to-end would be misleading. The pointer should land only
after the full pipeline (skill body + extractor + resolver + loop
integration) is operative.

## Acceptance criteria

1. CLAUDE.md gains a bullet under "Ground rules Claude Code
   honours here" that names the skill, its purpose (disposition-
   independent pace-authorization check at every wake), and the
   carved sentence.
2. The existing CLAUDE.md bullet about "Mechanical authorization
   check" (currently referencing the backlog item B-0160 for
   skill build) is updated to reference the landed skill instead.
3. Doc-only change — no code.
4. The pointer composes with the existing skill-router-as-
   substrate-inventory bullet (the skill is now in the router
   AND in the CLAUDE.md pointer tree).

## Pre-start checklist

_To be completed with proof before implementation begins._

- [ ] Prior-art search: searched CLAUDE.md for existing mechanical-
  authorization-check bullet; confirmed it references B-0160
  (to be updated)
- [ ] Dependency walk: B-0308 (loop integration) landed and
  verified working; full pipeline (B-0305 → B-0306 → B-0307 →
  B-0308) is operative

## Composes with

- B-0160 (parent umbrella)
- B-0305 (skill body this pointer references)
- B-0308 (loop integration this pointer presupposes)
- The wake-time-substrate-or-it-didn't-land CLAUDE.md bullet
- The skill-router-as-substrate-inventory CLAUDE.md bullet
