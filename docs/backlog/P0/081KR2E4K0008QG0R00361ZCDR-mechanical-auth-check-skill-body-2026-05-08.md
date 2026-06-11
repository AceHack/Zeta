---
id: B-0305
zetaid: 081KR2E4K0008QG0R00361ZCDR
priority: P0
status: closed
closed: 2026-05-08
closed_by: "PR #2082 merged — SKILL.md landed"
title: "Mechanical authorization check — skill body (SKILL.md via skill-creator)"
effort: XS
ask: "Substrate-class promotion (new skill); needs maintainer grading before landing under .claude/skills/"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0160
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [skill-build, mechanical-check, authorization-source]
---

# B-0305 — Mechanical authorization check skill body

## What

Author `.claude/skills/mechanical-authorization-check/SKILL.md`
via the `skill-creator` workflow (GOVERNANCE.md §4). The skill
body is harness-agnostic prose — it defines WHAT the check does,
WHEN to wear the hat, and WHAT it defers to. It does NOT contain
the implementation script.

## Acceptance criteria

1. SKILL.md follows the `skill-documentation-standard` frontmatter
   pattern (capability skill, no inline persona).
2. Body covers: source-filter rule (only human maintainer for pace),
   recency-filter rule (most-recent-not-rescinded wins), rescind-
   detection semantics (explicit revocation only — implicit
   displacement does NOT rescind), print-at-tick-start output
   shape, no-grading invariant ("unclear substrate =
   substrate-quality bug, not judgment problem").
3. "When to wear / When to defer" section names the composing
   surfaces: `refresh-before-decide`, `never-idle`, `substrate-or-
   it-didn't-happen`, autonomous-loop tick-start.
4. Passes `prompt-protector` review (BP-10 invisible-Unicode lint).
5. Does NOT reference a TS implementation path — the skill body
   is the contract; implementation lands in B-0306/B-0307.

## Pre-start checklist

Completed 2026-05-08.

- [x] Prior-art search: grepped `.claude/skills/` for
  "authorization" / "pace" / "mechanical-auth" / "source.*filter"
  — 12 files matched on generic "authorization" (consent, graphql,
  governance, etc.), zero on mechanical-authorization-check scope.
  Skill router listing confirmed no existing skill with this slug.
  No overlapping scope found.
- [x] Dependency walk: `depends_on: []` — this is a root child
  of B-0160. Sibling items B-0306/B-0307/B-0308 depend on this
  skill's contract but this item has no upstream blockers.
- [x] Source materials verified: memory file at
  `memory/feedback_mechanical_authorization_check_supersedes_introspective_discipline_claudeai_2026_05_02.md`
  EXISTS. Research doc at
  `docs/research/2026-05-02-claudeai-mechanical-authorization-check-supersedes-introspective-discipline.md`
  EXISTS. Both read and used as source material for the skill body.

## Composes with

- B-0160 (parent umbrella)
- B-0306 (extractor implementation honors the contract this skill
  defines)
- B-0307 (resolver implements the source-filter + rescind rules
  this skill defines)
- B-0308 (autonomous-loop wiring references this skill)
- `memory/feedback_mechanical_authorization_check_supersedes_
  introspective_discipline_claudeai_2026_05_02.md`
