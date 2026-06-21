---
id: 081KR2E4K0008QG0R0024JZ0CR
priority: P0
status: closed
title: "Mechanical authorization check — CLAUDE.md discoverable-skill pointer"
effort: XS
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQJZR90008QG0R000FTJ1TC
depends_on: [081KR2E4K0008QG0R002S3FDXN]
classification: closed
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [documentation, mechanical-check, claude-md]
---

# 081KR2E4K0008QG0R0024JZ0CR — CLAUDE.md discoverable-skill pointer

## What

Add a CLAUDE.md bullet that makes the mechanical-authorization-
check skill discoverable at wake-time. Per the wake-time-substrate-
or-it-didn't-land rule, the skill exists but is invisible to cold-
start agents without a CLAUDE.md pointer or a transitive path
from CLAUDE.md.

Depends on 081KR2E4K0008QG0R002S3FDXN (loop integration) rather than just 081KR2E4K0008QG0R00361ZCDR
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
   check" (currently referencing the backlog item 081KQJZR90008QG0R000FTJ1TC for
   skill build) is updated to reference the landed skill instead.
3. Doc-only change — no code.
4. The pointer composes with the existing skill-router-as-
   substrate-inventory bullet (the skill is now in the router
   AND in the CLAUDE.md pointer tree).

## Pre-start checklist

_To be completed with proof before implementation begins._

- [ ] Prior-art search: searched CLAUDE.md for existing mechanical-
  authorization-check bullet; confirmed it references 081KQJZR90008QG0R000FTJ1TC
  (to be updated)
- [ ] Dependency walk: 081KR2E4K0008QG0R002S3FDXN (loop integration) landed and
  verified working; full pipeline (081KR2E4K0008QG0R00361ZCDR → 081KR2E4K0008QG0R0007CFSZ7 → 081KR2E4K0008QG0R003CF4YHE →
  081KR2E4K0008QG0R002S3FDXN) is operative

## Composes with

- 081KQJZR90008QG0R000FTJ1TC (parent umbrella)
- 081KR2E4K0008QG0R00361ZCDR (skill body this pointer references)
- 081KR2E4K0008QG0R002S3FDXN (loop integration this pointer presupposes)
- The wake-time-substrate-or-it-didn't-land CLAUDE.md bullet
- The skill-router-as-substrate-inventory CLAUDE.md bullet
