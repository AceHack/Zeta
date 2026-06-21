---
id: 081KRHWGX0008QG0R002VD5ZNP
priority: P3
status: open
title: Decomposed: Tinygrad UOp rewrite walk + retract mapping (peeled from 081KQTPYE0008QG0R002Y7X5KH)
tier: research+engineering-direction
effort: S
created: 2026-05-14
last_updated: 2026-05-14
depends_on: [081KQTPYE0008QG0R002Y7X5KH]
composes_with: [081KQ3HBZ0008QG0R000FQ69NN, 081KQ3HBZ0008QG0R000JWFD37]
tags: [tinygrad, uop-ir, retract-semantics]
type: task
---

# 081KRHWGX0008QG0R002VD5ZNP -- Tinygrad UOp rewrite walk + retract mapping

This row was decomposed from 081KQTPYE0008QG0R002Y7X5KH.

## Acceptance criteria

**Read the source + walk one rewrite manually + map to Zeta retract semantics.**

Verifier: a memo (committed under `docs/research/`) walking through one ALU rewrite from `tinygrad/uop/ops.py` plus `tinygrad/codegen/simplify.py` step-by-step, mapping the rewrite to the closest equivalent in Zeta's existing retract semantics.

Pass: the walk is concrete + cites specific line numbers in the tinygrad source.

Fail-falsifier: the walk reveals that PatternMatcher rewrites are NOT referentially transparent in practice (e.g. depend on iteration order, hidden global state, undocumented mutation), invalidating the DST-safe initial answer.
