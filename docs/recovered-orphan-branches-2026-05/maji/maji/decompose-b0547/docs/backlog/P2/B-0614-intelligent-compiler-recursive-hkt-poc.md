---
id: B-0614
title: Intelligent compiler — Step 1: Recursive HKT representation proof-of-concept
priority: P2
status: open
type: research
created: 2026-05-17
ask: Otto-CLI
effort: M
tags: [research, fsharp-fork, hkt, recursive-hkt, intelligent-compiler]
depends_on: []
composes_with: [B-0547]
last_updated: 2026-05-17
---

## Why

This is the first peeled slice from the B-0547 intelligent compiler blob. Before we can build Roslyn Source Generators, LINQ integrations, or Recursive Type Providers, we need to prove the core algebraic type-level mechanism: **Recursive HKT representation**.

## Scope

1. **Recursive HKT representation** — Prove Higher-Kinded Types that can be applied to themselves (M<M<'T>> as a type-level computation, not just nested generic) in the F# fork.
2. Enables representing the antigen-propagation as a recursive type — e.g., Antigen<Oracle<Antigen<...>>>.

### Acceptance criteria

- [ ] Recursive HKT pattern demonstrated in F# fork (proof-of-concept type that applies itself)
- [ ] At least one minimal type-level test proving recursion terminates or is bounded correctly
