---
id: 081KZETA0007040004
priority: P2
status: open
title: Physics persona — add mathematical-physics expert to persona registry
created: 2026-07-04
last_updated: 2026-07-04
depends_on: []
tags: [persona, physics, qft, summon, registry]
type: task
---

# Physics persona — mathematical-physics expert

Add a dedicated mathematical-physics persona to the registry for QFT, statistical
mechanics, Casimir effect, information-theoretic physics, and thermodynamic computing
research. Soraya covers formal proofs (Lean/TLA+) but flagged the gap for deep
physics intuition (zeta regularization, field theory, Landauer-Bennett-Szilard).

## Acceptance criteria

- New entry in persona-registry.ts (name: "tariq" or similar)
- Harness configured (Claude CLI with physics-specialized system prompt)
- Memory file at memory/<name>/NOTEBOOK.md
- Summon works: `bun summon <name> "research question"`
- CURRENT-<name>.md persona bootstrap with physics domain anchors
