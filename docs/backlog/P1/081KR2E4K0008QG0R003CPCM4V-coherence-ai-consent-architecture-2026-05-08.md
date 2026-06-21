---
id: 081KR2E4K0008QG0R003CPCM4V
priority: P1
status: closed
title: "Coherence AI — consent-first architecture design"
created: 2026-05-08
parent: 081KQZVQW0008QG0R002Q58F6Z
depends_on: []
classification: buildable-now
decomposition: atomic
type: feature
---

# 081KR2E4K0008QG0R003CPCM4V — Consent architecture

Design the consent-first architecture: every AI action
requires explicit user consent before execution. KSK
(N-of-M multi-sig) pattern at the consent layer.

## Acceptance criteria

- Architecture doc at docs/research/
- Consent flow: request → display → confirm → execute
- KSK override path documented (military/emergency)
