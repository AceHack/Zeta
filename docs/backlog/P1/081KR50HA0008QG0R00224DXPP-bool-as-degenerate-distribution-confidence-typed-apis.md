---
id: 081KR50HA0008QG0R00224DXPP
priority: P1
status: closed
title: "Bool as degenerate distribution — replace binary API returns with confidence scores"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [type-design, bayesian, signal-quality, veridicality, api-surface]
---

# 081KR50HA0008QG0R00224DXPP — Bool as degenerate distribution

## What

Redesign binary API returns in SignalQuality and Veridicality
to use confidence scores (`float` in [0.0, 1.0]) as the
primitive. Bool is a special case — a degenerate Bernoulli
distribution with mass at 0 or 1 — not the default return type.

Aaron 2026-05-09: *"imagine we are redesigning — bools don't
exist, they are just a special case of a distribution that is
either 0 or 1."*

### Current sharp APIs

| Module | Function | Returns |
|--------|----------|---------|
| Veridicality | `validateProvenance` | `bool` |
| Veridicality | `validateClaim` | `bool` |
| SignalQuality | `falsifiabilityWith` | `float` (but takes `string -> bool`) |
| SignalQuality | `groundingWith` | `float` (but takes `string -> bool`) |

### Proposed round APIs

All predicates become scorers: `string -> float` where
0.0 = fully absent, 1.0 = fully present. Current binary
implementations return {0.0, 1.0}. Future implementations
can return intermediate values without API change.

`validateProvenance` → returns `float`: 1.0 when all fields
present + signature ok; could return 0.7 for "signature present
but weakly-trusted root" without breaking callers.

Callers that need binary decisions apply a threshold:
`if score >= 0.5 then ...` — the threshold is the caller's
decision, not the API's.

## Why

The type signature encodes an epistemic commitment: certainty
is a special case of confidence, not the primitive. A `bool`
claims certainty; a `float` admits that certainty is one
point on a spectrum. This aligns with the Bayesian framing
the factory already uses (posterior probabilities, Z-set
weights as evidence).

## Acceptance criteria

- [x] `validateProvenance` and `validateClaim` return `float`
- [x] `falsifiabilityWith` takes `string -> float` (gradient
      variant already landed in PR #2205 as `falsifiabilityWithScore`)
- [x] `groundingWith` takes `string -> float` (gradient variant
      added as `groundingWithScore` — parallel to `falsifiabilityWithScore`)
- [x] All callers updated to threshold where needed (only tests;
      no non-test callers exist)
- [x] Existing tests pass with {0.0, 1.0} endpoint values
- [x] `antiConsensusGate` remains `Result` (it's a gate, not
      a score — the confidence is binary by design here)

## Composes with

- PR #2205 (gradient falsifiability — already in this shape)
- `src/Core/SignalQuality.fs`
- `src/Core/Veridicality.fs`
- 081KR50HA0008QG0R0033TN4H9 (Z3 proof replacement — same epistemic-honesty axis)
