---
id: 081KX3KA3F008QG0R0022EF9R8
type: task
state: in-progress
priority: P1
slug: healer-idempotence-closure-harness
title: "Healer idempotence + closure harness — healers get golden vectors too"
created: 2026-07-09T14:08:50.000Z
depends_on: []
composes_with: []
---

# Healer idempotence + closure harness — healers get golden vectors too

<!-- ZetaId-keyed work item. Minted 2026-07-09 by Otto (cowork) from the
     drift-and-heal ADR build-out (docs/DECISIONS/2026-07-09-drift-and-heal-
     replaces-pre-merge-gates-reconciliation-at-ai-speed.md). -->

ADR item 3: a healer may not oscillate (idempotence: heal(healed) is a
no-op) and may not create new drift (closure). Both requirements have
named counterexamples from 2026-07-08: the MD032 auto-heal re-split a
wrapped code span every round (oscillation), and its heals staled the
generated MEMORY.md index (closure violation — a healer touching
memory/ must run the reindexer in the same commit).

Deliverable: harness that runs any healer twice over fixture trees and
asserts fix(fix(x)) == fix(x) and — as landed — CLOSURE AS SUBSET:
detector(fix(x)) mints nothing new relative to detector(x), across ALL
detectors, not just the healer's own. (The draft said == empty; the landed
law is the subset form so healers may lawfully ignore other classes'
pre-existing drift.) Gate healer write access on
passing it. First subjects: the MD032/MD026 safe fixer, reindex-memory-md.

## Progress (2026-07-31)

Harness core landed: `src/Core.TypeScript/hygiene/healer-harness.{ts,test.ts}` —
pure FileTree model, three laws (idempotence, closure-as-subset, convergence
with iteration budget), `composeHealers` for pipeline certification, reference
detectors, and a built-in corpus where both 2026-07-08 incidents fail as named
counterexamples (re-splitter mints code-span drift; memory-toucher stales the
generated index) and composition order is proven decisive (unwrapper-then-
resplitter mints, resplitter-then-unwrapper is identity-safe).

Remaining before done: adapters running the REAL healers (the MD032/MD026 safe
fixer, reindex-memory-md) through `certify` over repo-shaped fixture trees, and
the write-access gate consuming the verdict.
