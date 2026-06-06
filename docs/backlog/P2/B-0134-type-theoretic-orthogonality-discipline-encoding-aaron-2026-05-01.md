---
id: B-0134
zetaid: 081KQGDBJ0008QG0R0032X1MMC
priority: P2
status: open
title: Type-theoretic encoding of orthogonality discipline (extension vs creation as decidable judgment)
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: feature
---

# B-0134 — Type-theoretic encoding of orthogonality discipline

**Priority:** P2 (research-grade; fourth tractable slice of formalization roadmap).

**Filed:** 2026-05-01.

**Effort:** M-L (1-3 months — type-theoretic encoding; potentially mechanize in Lean).

## What

Encode the meta-meta-meta-rule (orthogonality check before creating a new substrate class) as a decidable type-theoretic judgment. Currently orthogonality is judged informally; mechanizing the check would catch class-creation failures at compose-time rather than at PR-review-time.

**Reference:** *Theorem Proving in Lean 4* (Avigad et al.) for the type-theory side; HoTT book for refinement-types side.

## Acceptance criteria

1. **Formal definition** of "extension" vs "new orthogonal class" as a typed predicate on substrate-tree positions.
2. **Decidability proof or procedure**: given a candidate new class, mechanically determine whether it reduces to existing classes (extension) or is genuinely independent (orthogonal).
3. **Soundness**: never claim "extension" when the candidate genuinely adds an irreducible base concept.
4. **Lean mechanization** (or equivalent) integrated with `tools/lean4/`.
5. **Test fixtures** exercising the catch logic on prior orthogonality decisions (the meta-meta-meta-rule's empirical validation).

## Composes with

- `memory/feedback_class_level_rules_need_orthogonality_check_extend_or_create_aaron_2026_05_01.md` — the rule being mechanized.
- B-0130 (audit-suite) — this row's mechanization is one specific audit in B-0130's family.
- B-0131 + B-0133 — type-theoretic encoding composes with sequent calculus and Z-set Lean.

## Status

**Filed.** Pace after B-0131 + B-0133 progress.
