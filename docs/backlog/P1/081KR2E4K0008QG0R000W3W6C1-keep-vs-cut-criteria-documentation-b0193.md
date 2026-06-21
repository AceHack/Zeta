---
id: 081KR2E4K0008QG0R000W3W6C1
priority: P1
status: closed
title: Keep-vs-cut criteria documentation — define the 4 category taxonomy before bootstrap-razor runs
tier: foundation
effort: S
ask: 081KQTPYE0008QG0R00392KABJ decomposition — AC 3 (keep-vs-cut criteria documented before experiment)
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQTPYE0008QG0R00392KABJ
depends_on: []
composes_with: [081KQTPYE0008QG0R00392KABJ, 081KR2E4K0008QG0R001BRHAPK, 081KR2E4K0008QG0R002PHZR58, 081KR2E4K0008QG0R00322TP58]
tags: [bootstrap-razor, keep-vs-cut, criteria, taxonomy, foundation, trajectory-child]
type: friction-reducer
---

# 081KR2E4K0008QG0R000W3W6C1 — Keep-vs-cut criteria documentation

## Parent

081KQTPYE0008QG0R00392KABJ (bootstrap razor + 23-hour recreation test).

## What

Document the keep-vs-cut taxonomy as a project-policy file
before any experiment runs. The four categories from Aaron
2026-05-05 + Claude.ai same-tick:

1. **Research-grade preservation** — mirror-not-beacon
   shards, falsifiability-catches, external-AI conversation
   absorbs. Not regeneratable from specs by definition.
   Kept as research artifact.
2. **Decision rationale** — tried-X-failed-because-Y.
   Sometimes capturable from commit messages + resulting
   spec, sometimes only in feedback files. The 23-hour test
   will cut some; whether that's feature or bug depends on
   whether the rationale was load-bearing.
3. **External-context files** — genealogy, calibration docs,
   persona biographies. Different ontological category,
   different rules. Kept under own discipline.
4. **Personal-history surfaces** — CURRENT-aaron.md /
   CURRENT-amara.md / etc. Per-maintainer first-party-consent
   surfaces; kept regardless.

## Acceptance criteria

1. A `docs/bootstrap-razor/KEEP-VS-CUT.md` file defines each
   category with examples from actual Zeta substrate.
2. Each category has a clear disposition: KEEP (never cut),
   CUT-IF-REGENERABLE (the test decides), or EXEMPT (outside
   experiment scope).
3. The criteria are citable by 081KR2E4K0008QG0R0035HNPG1 (the experiment run).

## Effort

S — pure documentation, no tooling needed.
