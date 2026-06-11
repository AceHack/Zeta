---
id: B-0294
zetaid: 081KR2E4K0008QG0R00009QQJM
priority: P1
status: open
title: "Coherence AI — KSK override implementation"
created: 2026-05-08
parent: B-0245
depends_on: [B-0293]
classification: buildable-now
decomposition: decomposed
type: feature
---

# B-0294 — KSK override

Implement the KSK override path: N-of-M multi-sig
authorization for bypassing consent gate in emergency.

## Pre-start checklist (start-gate proof)

**Prior-art-search completed (2026-05-11):**

- Searched wake-time-substrate, skill-router, orthogonal-axes, Otto-364, PR #1701, decision-archaeology, LOST-FILES-LOCATIONS.md via worldview refresh + grep on coherence/consent/KSK/multi-sig.
- Results: B-0293 (closed) provides the design doc at docs/research/ (KSK documented as emergency override); no prior impl; no conflicting surfaces. No lost files.

**Dependency-restructure completed:**

- depends_on: [B-0293] — B-0293 closed (consent architecture design complete, including KSK path doc).
- Backfilled reciprocal: B-0293 now notes "KSK override impl in B-0294".
- No broken pointers; supersession via decision-archaeology (B-0169) clean.

**Re-decomposition note (always-re-decomp rule):** Original "atomic" mistaken; the machine-readable frontmatter now stays on the canonical `decomposed` token while this prose records the AGENTS.md re-decomposition rationale. Re-decomposed AC into two smallest atomic children for one-bounded-step safety:

- B-0294.1: F# KSK types (signers, threshold, scope) — pure data
- B-0294.2: N-of-M threshold tests (FsCheck properties)

This is the smallest safe slice: start-gate + re-decomp (no code yet; impl follows in child rows).

## Acceptance criteria

- F# types for KSK authorization (signers, threshold, scope)
- Tests for N-of-M threshold logic
