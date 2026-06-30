---
id: B-0552
priority: P2
status: open
title: "Probabilistic type system step 1 — Type-level computation expression for Distributions (F#)"
effort: M
created: 2026-05-16
last_updated: 2026-05-16
depends_on: [B-0358]
classification: buildable
decomposition: atomic
owners: [architect]
type: feature
tags: [type-system, probabilistic, research, language-design, bayesian, fsharp]
---

# B-0552 — Probabilistic type system step 1: F# Computation Expression

## What

Decomposed from B-0359 (Probabilistic type system research arc).
This is step 1: Research Question 1 from the parent row. "Can F#'s type system express 'all returns are distributions' without a language fork? (Computation expressions + custom operators may suffice)".

## Acceptance Criteria

- [ ] Implement an F# Computation Expression builder `dist { ... }` that models a probabilistic distribution over values (using ZSet weights as the confidence primitive).
- [ ] Implement `Bind`, `Return`, `ReturnFrom` to allow monadic composition of probabilistic values.
- [ ] Provide proof-of-concept tests demonstrating that sharp types (`bool`) can be lifted into `dist { ... }` and composed without explicitly reverting to sharp conditionals.
- [ ] Determine if this approach allows enforcing `probabilistic: strict` rules at the API boundary.

## Composes with

- B-0359 (Parent research arc)
- B-0358 (bool → float API returns)
