---
id: 081M10BD9BM087G0R001SGDRXT
type: task
state: in-progress
priority: P1
slug: full-1-retraction-is-erasing-uncertainty-widening-is-non-era
title: "Full -1 retraction is erasing; uncertainty widening is non-erasing"
created: 2026-08-27T00:55:06.872Z
depends_on: []
composes_with:
  - 081M108RYNT087G0R001JSRNZE
---

# Full −1 is erasing of the view; widen is non-erasing of support

Aaron 2026-08-26: −1 as full retraction is erasing; uncertainty
widening is non-erasing. Reversible computing (`ErasureClass`) already
has the vocabulary.

## This increment

`RetractionReading.fs`: `fullErasesView`, `negateIsInvolution`,
`widenKeepsSupport`. Tests pin all three.

## Remaining

- Do not invoice Landauer on `neg`
- Do not put `widen` in the shared fold (it does not commute with
  `observe`); use `foldRetained` there
- Inverse-free corners still cannot take full −1
