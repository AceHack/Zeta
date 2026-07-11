---
id: 081KX3KA3EK08QG0R0019ER8WV
type: task
state: backlog
priority: P1
slug: uncompensatable-floor-registry-not-prose
title: "Uncompensatable-floor registry — the drift ADR floor as data, not prose"
created: 2026-07-09T14:08:50.000Z
depends_on: []
composes_with: []
---

# Uncompensatable-floor registry — the drift ADR floor as data, not prose

<!-- ZetaId-keyed work item. Minted 2026-07-09 by Otto (cowork) from the
     drift-and-heal ADR build-out (docs/DECISIONS/2026-07-09-drift-and-heal-
     replaces-pre-merge-gates-reconciliation-at-ai-speed.md). -->

The drift-and-heal ADR (docs/DECISIONS/2026-07-09-…) defines the pre-merge
floor: secrets/keys, treaty byte-lock vectors, HC-9 consent invariants,
signed-history rewrites, workflow supply-chain/script-injection findings,
scoped build/test breaks. Its Ratification section requires the list be a
REGISTRY so detectors, hooks, and humans read one source of truth.

Deliverable: registry/uncompensatable-floor.yaml (schema zeta-registry/v1)
with one entry per floor class: id, description, detector pointer,
rationale (erasure-class derivation per the deterministic-time ferry),
consent requirement for additions (treaty-amendment path). Codegen twins
optional; consumers list in the entry.
