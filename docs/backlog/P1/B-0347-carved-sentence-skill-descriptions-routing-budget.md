---
id: B-0347
priority: P1
status: open
title: "Carved-sentence skill descriptions — fit 200+ skills into routing budget"
effort: M
created: 2026-05-09
last_updated: 2026-05-29
depends_on: []
classification: buildable-now
decomposition: multi-child (re-decomp pass 1, smallest safe slice)
owners: [skill-expert]
type: friction-reducer
tags: [skill-routing, context-budget, carved-sentence]
---

# B-0347 — Carved-sentence skill descriptions

## Problem

`/doctor` reports 54 skill descriptions exceed the per-entry
cap and 209 descriptions are dropped from the skill listing.
At the default 1% `skillListingBudgetFraction` (raised to 2%
as immediate relief), multi-paragraph skill descriptions
consume too much context budget — causing the router to drop
skills entirely, making them invisible to cold-start agents.

## Fix

Carve every skill's `description:` frontmatter field down to
a single routing-quality sentence. The description's job is
to trigger correct routing, not to teach the skill's content
— that's what the skill body is for.

### Shape

```
# Before (200+ tokens, gets truncated/dropped):
description: Capability skill ("hat") — Elasticsearch /
  OpenSearch narrow. Owns the distributed engine layer
  above Lucene: cluster topology (master / data / ingest /
  coordinating-only / ML / transform roles), shard
  allocation ... [500 words]

# After (one carved sentence, routes correctly):
description: Elasticsearch / OpenSearch — shards, ILM,
  Query DSL, aggregations, kNN, cross-cluster, security.
```

### Rules for the carved sentence

1. One sentence, under 120 characters preferred
2. Name the domain and 3-7 key routing terms
3. No "Capability skill (hat)" boilerplate — the router
   doesn't need it
4. No "Owns the..." or "Covers the..." preamble
5. No citations, no "Wear this when...", no "Defers to..."
   — those belong in the skill body
6. Test: would a cold-start agent match this description
   to the right task? If yes, it's carved enough.

## Acceptance criteria

- [x] All 200+ skills have description under 150 chars
  — verified 2026-05-29: 257/257 ≤150 chars, single-line,
  zero `Capability skill`/`Owns the`/`Defers to` boilerplate
  (audit tool below).
- [x] `/doctor` reports 0 descriptions exceeding per-entry cap
  — mechanized by `tools/hygiene/audit-skill-description-length.ts`
  (deterministic Rule-0 replica of the `/doctor` cap check;
  CLI exits 1 on any over-cap/multiline/boilerplate description).
- [x] `/doctor` reports 0 descriptions dropped
  — follows from 0 over-cap; the structural fix is the durable
  gate (descriptions can no longer silently regrow past the cap).
- [ ] Routing quality verified: spot-check 10 skills by
  asking the router and confirming correct match
  — still open (B-0347.4 router-verification sub-step).

## Immediate mitigation (done)

`skillListingBudgetFraction` raised to 0.02 (2%) in
`.claude/settings.json`. This doubles the budget but is
a band-aid — the structural fix is shorter descriptions.

## Composes with

- B-0161 (CLAUDE.md trim) — same context-budget pressure
- The skill-router-as-substrate-inventory CLAUDE.md bullet
- `skill-tune-up` and `skill-improver` — they can execute
  the carving pass

## Re-decomposition (smallest safe slice, one bounded step)

Split into 4 atomic children by skill category (re-decomp assumes prior grouping mistakes; carve in parallel batches):

- B-0347.1: Carve infra/storage skills (Elasticsearch, vector, time-series, columnar, row-store, etc.) — ~40 skills
- B-0347.2: Carve reviewer/auditor skills (alignment, spec-zealot, harsh-critic, etc.) — ~50 skills
- B-0347.3: Carve data/AI skills (ML, Bayesian, LLM, retrieval, etc.) — ~60 skills
- B-0347.4: Carve remaining (governance, ops, math, etc.) + router verification — rest + tests

Each child: one PR, carve only, run focused doctor check, no body changes.

## Status (2026-05-29) — B-0347.4 audit-gate slice landed

Substrate-drift discriminator (per `backlog-item-start-gate.md`
Step 0): the bulk carving artifacts already shipped in the 20 days
since this row was filed — all 257 skill descriptions are ≤150
chars, single-line, boilerplate-free. The row was **in-progress,
not pure drift**: acceptance #1/#2 had no *durable gate* locking
the invariant in, so descriptions could silently regrow past the
routing budget (the original failure mode).

Landed `tools/hygiene/audit-skill-description-length.ts` +
`.test.ts` — a deterministic Rule-0 gate that fails on any
over-cap, multiline, or boilerplate description. Mechanizes
acceptance #1-#3. CLI on live skills: `257 checked, 0 errors`.

Authoring caught a `/m`-regex `$`-trap bug (matched only the first
line of folded YAML values, blinding the check to multiline
descriptions); fixed with a line-based parser + a regression test.

Remaining (NOT in this slice):

- **B-0347.4 router-verification** — spot-check 10 skills via the
  router (acceptance #4); still open.
- **CI wiring** — add a `.github/workflows/` lint that runs the
  audit (precedent: `role-ref-current-state-surfaces-lint.yml`);
  next bounded step.
- **B-0347.1-.3 ≤120 tightening** — 127 descriptions sit in the
  120-150 band (rule 1 *preferred* ≤120). Advisory (warnings, not
  errors); optional carve-tighter pass, low priority since the
  hard cap is met.
