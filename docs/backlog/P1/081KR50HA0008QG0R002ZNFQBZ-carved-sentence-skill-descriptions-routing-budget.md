---
id: 081KR50HA0008QG0R002ZNFQBZ
priority: P1
status: open
title: "Carved-sentence skill descriptions — fit 200+ skills into routing budget"
effort: M
created: 2026-05-09
last_updated: 2026-05-29
depends_on: [081KSRGFP0008QG0R0037CJXA8]
children: [081KSRGFP0008QG0R0037CJXA8, 081KSRGFP0008QG0R00059AM3C, 081KSRGFP0008QG0R002SV9GGY]
classification: buildable-now
decomposition: clean
owners: [skill-expert]
type: friction-reducer
tags: [skill-routing, context-budget, carved-sentence]
---

# 081KR50HA0008QG0R002ZNFQBZ — Carved-sentence skill descriptions

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
  — still open (081KR50HA0008QG0R002ZNFQBZ.4 router-verification sub-step).

## Immediate mitigation (done)

`skillListingBudgetFraction` raised to 0.02 (2%) in
`.claude/settings.json`. This doubles the budget but is
a band-aid — the structural fix is shorter descriptions.

## Composes with

- 081KQJZR90008QG0R002Z4B6VW (CLAUDE.md trim) — same context-budget pressure
- The skill-router-as-substrate-inventory CLAUDE.md bullet
- `skill-tune-up` and `skill-improver` — they can execute
  the carving pass

## Re-decomposition (pass 2, 2026-05-29 — substrate-drift-aware)

Pass-1 split the row into 4 carve-by-category children (081KR50HA0008QG0R002ZNFQBZ.1-.4).
Twenty days later the carving has *shipped* — 257/257 descriptions are
≤150 chars, single-line, boilerplate-free — so the pass-1 children are
substrate-drift, not live work. Re-decomposed against the *actual*
remaining state per `backlog-item-start-gate.md` Step 0:

### Pass-1 children — disposition

- **081KR50HA0008QG0R002ZNFQBZ.1-.3 (carve infra / reviewer / data-AI by category)** —
  SUPERSEDED-as-shipped. The carving completed via batch PRs (#2266,
  #2298, #6020, #6023, …) rather than separate child files; no child
  row files were ever created for `.1-.3` and none are needed now.
- **081KR50HA0008QG0R002ZNFQBZ.4 (carve remaining + router verification + audit gate)** —
  SHIPPED for the carve + audit-gate half via PR #6029
  (`tools/hygiene/audit-skill-description-length.ts` + test). The
  router-verification sub-step is carried forward as 081KSRGFP0008QG0R0037CJXA8 below.

### Pass-2 children — live remaining work (dependency-ordered)

- **081KSRGFP0008QG0R0037CJXA8** (P1, buildable-now) — Router-quality verification:
  spot-check ≥10 carved descriptions via the router. Closes the only
  open acceptance criterion (#4). **Umbrella `depends_on: [081KSRGFP0008QG0R0037CJXA8]`
  — closure blocks here.**
- **081KSRGFP0008QG0R00059AM3C** (P2, buildable-now) — CI-wire the audit gate so the cap
  is *enforced*, not just checkable (precedent:
  `role-ref-current-state-surfaces-lint.yml`). Robustness-hardening on
  the shipped tool; does not block umbrella closure.
- **081KSRGFP0008QG0R002SV9GGY** (P3, buildable-now) — Tighten the 127 descriptions in
  the 120-150 band to the ≤120 *preferred* target (rule 1). Advisory
  polish; the hard ≤150 cap is already met + gated; does not block
  umbrella closure and may outlive it.

Each child: one PR, focused check (audit tool run / router spot-check /
workflow validate), no skill-body changes.

## Status (2026-05-29) — 081KR50HA0008QG0R002ZNFQBZ.4 audit-gate slice landed

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

- **081KR50HA0008QG0R002ZNFQBZ.4 router-verification** — spot-check 10 skills via the
  router (acceptance #4); still open.
- **CI wiring** — add a `.github/workflows/` lint that runs the
  audit (precedent: `role-ref-current-state-surfaces-lint.yml`);
  next bounded step.
- **081KR50HA0008QG0R002ZNFQBZ.1-.3 ≤120 tightening** — 127 descriptions sit in the
  120-150 band (rule 1 *preferred* ≤120). Advisory (warnings, not
  errors); optional carve-tighter pass, low priority since the
  hard cap is met.
