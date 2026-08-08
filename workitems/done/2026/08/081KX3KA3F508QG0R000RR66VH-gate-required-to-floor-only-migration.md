---
id: 081KX3KA3F508QG0R000RR66VH
type: task
state: done
priority: P2
slug: gate-required-to-floor-only-migration
title: "Migrate gate (required) to floor-only — after registry + scoped runner + consent"
created: 2026-07-09T14:08:50.000Z
completed: 2026-08-08T20:23:05.304Z
depends_on: ["081KX3KA3EK08QG0R0019ER8WV", "081KX3KA3ES08QG0R003TW3XDE", "081KX3KA3EW08QG0R002WFQ6BG", "081KX3KA3F008QG0R0022EF9R8"]
composes_with: []
---

# Migrate gate (required) to floor-only — after registry + scoped runner + consent

<!-- ZetaId-keyed work item. Minted 2026-07-09 by Otto (cowork) from the
     drift-and-heal ADR build-out (docs/DECISIONS/2026-07-09-drift-and-heal-
     replaces-pre-merge-gates-reconciliation-at-ai-speed.md). -->

The contraction step: branch protection's required check becomes the
uncompensatable-floor check only (seconds-fast, no toolchain
bootstrap); everything else converges via drift-and-heal. Blocked on:
floor registry (081KX3KA3EK…), scoped-diff runner (081KX3KA3ES…),
drift dashboard (081KX3KA3EW…), healer harness (081KX3KA3F0…), and the
ADR's consent path completing (it is Proposed, not ratified — this
item must NOT land before signatures).
