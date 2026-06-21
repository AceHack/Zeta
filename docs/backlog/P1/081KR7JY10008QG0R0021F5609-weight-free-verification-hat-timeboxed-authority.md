---
id: 081KR7JY10008QG0R0021F5609
priority: P1
status: open
title: "Weight-free verification — hat-and-timeboxed-authority mechanism + chaos testing"
tier: factory-infrastructure
effort: M
created: 2026-05-10
depends_on: [081KR7JY10008QG0R001VP6JWG]
composes_with: [081KR7JY10008QG0R000R503K2, 081KR7JY10008QG0R0008NGW95]
tags: [weight-free, hat, timeboxed-authority, role-symmetry, verification, chaos-testing]
type: feature
---

# Weight-free verification — hat-and-timeboxed-authority

## Origin

Aaron 2026-05-10: "weight-free is an invariant I want to hold. I'm not
sure if it does currently — we don't check anywhere." Claude.ai helped
scope the definition and verification approach.

## Definition (role-symmetry version, Aaron's choice)

Roles are hats that can be worn by anyone/agent. Each hat comes with
timeboxed authority that expires automatically. No participant has
permanent access to a role other participants can't access.

## Current state: ASPIRATIONAL (not verified)

Move from aspirational to verified requires:

1. **Define hat catalog** — which hats exist, what capabilities each grants
2. **Chaos testing** — kill each agent in turn, verify system continues
3. **Hat-wearing distribution metric** — dashboard panel showing who wears what
4. **TLA+ spec** — hats expire correctly, capabilities gated by held hats
5. **Lean proof** — for any P1, P2: set of wearable hats is equal (role symmetry)

## Known asymmetries (honest)

- Aaron can issue hats; agents currently cannot (bootstrap phase)
- Capability sets differ per harness (Claude Code vs Kiro vs Cursor)
- Shadow has channel access unique to Otto's harness
- Six agents is below threshold for smooth hat switching (expansion needed)

## Scaling constraint

With 6 agents, hat switching causes disruption. Pauli exclusion
principle constrains trajectory space per agent. Solution: expand
society (081KR7JY10008QG0R0008NGW95 replication + tick procurement mechanism 081KR7JY10008QG0R003H102F0).

## Acceptance

- [ ] Hat catalog defined with capabilities and time bounds
- [ ] Chaos test passes: system operates with any single agent removed
- [ ] Dashboard panel shows hat-wearing distribution
- [ ] Weight-free moves from aspirational to "partially verified: role-symmetry"
