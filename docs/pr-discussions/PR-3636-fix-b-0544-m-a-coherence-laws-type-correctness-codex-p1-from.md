---
pr_number: 3636
title: "fix(b-0544): M/A coherence-laws type-correctness \u2014 Codex P1 from PR #3614"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T00:28:17Z"
merged_at: "2026-05-16T00:29:49Z"
closed_at: "2026-05-16T00:29:49Z"
head_ref: "fix/coherence-laws-type-correctness-otto-cli-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T00:39:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3636: fix(b-0544): M/A coherence-laws type-correctness — Codex P1 from PR #3614

## PR description

## Summary

Addresses the deferred deep finding from [PR #3614](https://github.com/Lucent-Financial-Group/Zeta/pull/3614) Codex review: the three M/A coherence laws in the Step-1 research doc were not well-typed under the stated signatures `M : Zeta → Zeta` and `A : Ω → Ω`. The earlier [PR #3626](https://github.com/Lucent-Financial-Group/Zeta/pull/3626) addressed the terminology issues (idempotence-vs-associativity, D∘Q∘I-as-monad); this PR addresses the deeper type-correctness gap.

**Substrate-honest scope** (does NOT claim to solve the open math):

- Strikes the three originally-stated coherence laws from the research doc
- Replaces with a structured "resolution paths" table — Lawvere-Tierney lifting (`Ã : Zeta → Zeta`), strength data (`θ : M(Ω) → Ω`), or propositional restriction
- Provides **Provisional Law 1'** (type-correct under propositional restriction + strength): `A_*(M_*(p)) = M_*(A_*(p))` where `A_*(p) := A ∘ p` and `M_*(p) := θ ∘ M(p)`. Both sides type `M(X) → Ω`.
- Defers Laws 2 (μ-coherence) and 3 (η-coherence) to a new **Step 1.5** pending construction of `Ã`
- Flags that path (a) is complicated because `A` is *not* a closure operator (no `p ≤ A(p)`), so the standard Lawvere-Tierney construction does not apply directly

**Out of scope** (intentionally):

- Does NOT construct `θ` or `Ã` — open research, not landable in one tick
- Does NOT claim Laws 2 and 3 are proven; they are formally deferred to Step 1.5
- Does NOT prove Law 1' — provisional, contingent on the strength `θ` existing

## Files changed

```
docs/research/2026-05-15-qg-isomorphism-step-1-formalize-remember-when-pay-attention-as-categorical-primitives.md  +57/-3
memory/feedback_otto_qg_isomorphism_step_1_formalize_remember_when_pay_attention_as_categorical_primitives_2026_05_15.md  +2/-1
docs/backlog/P2/081KRMEXM0008QG0R003YWZC21-qg-isomorphism-step-1-formalize-remember-when-pay-attention-as-categorical-primitives-2026-05-15.md  +1/-1
```

## Test plan

- [x] Pre/post-commit `git ls-tree HEAD` canary clean (53/53 root entries) — Lior was active 3rd consecutive tick
- [x] Local `markdownlint-cli2` passes on all 3 modified files
- [x] Borrow-on-existing on `/private/tmp/zeta-tick-2210z` (~6h+ old)
- [x] Explicit-path staging (no `git add -A`)
- [ ] CI green (docs-only, expected)
- [ ] Codex/Copilot review on the new substrate-honest formulation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T00:30:26Z)

## Pull request overview

This PR updates the 081KRMEXM0008QG0R003YWZC21 research substrate to acknowledge that the original memory/attention coherence laws were not type-correct under the stated `M` and `A` signatures, and reframes the work as provisional plus deferred Step 1.5 research.

**Changes:**

- Replaces the original coherence laws with resolution paths involving `Ã`, `θ`, or propositional restriction.
- Adds provisional Law 1' and defers μ/η coherence to Step 1.5.
- Updates the related memory and backlog row to reflect the Codex P1 follow-up.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `docs/research/2026-05-15-qg-isomorphism-step-1-formalize-remember-when-pay-attention-as-categorical-primitives.md` | Reframes coherence laws, adds Law 1', and introduces Step 1.5 research paths. |
| `memory/feedback_otto_qg_isomorphism_step_1_formalize_remember_when_pay_attention_as_categorical_primitives_2026_05_15.md` | Updates the absorbed memory summary with the type-correctness caveat and new open question. |
| `docs/backlog/P2/081KRMEXM0008QG0R003YWZC21-qg-isomorphism-step-1-formalize-remember-when-pay-attention-as-categorical-primitives-2026-05-15.md` | Updates the backlog item to note the Step 1.5 coherence-law sub-task. |

## Review threads

### Thread 1: docs/backlog/P2/081KRMEXM0008QG0R003YWZC21-qg-isomorphism-step-1-formalize-remember-when-pay-attention-as-categorical-primitives-2026-05-15.md:33 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T00:30:25Z):

P1: This content edit also needs the row frontmatter `last_updated` date bumped; the backlog schema requires `last_updated` to be updated on every content edit (`tools/backlog/README.md:57-70`).

### Thread 2: docs/research/2026-05-15-qg-isomorphism-step-1-formalize-remember-when-pay-attention-as-categorical-primitives.md:160 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T00:30:26Z):

P1: This reintroduces a terminology drift from the earlier definition: line 85 states the observer-context shift is not non-monotonicity within a single context, while this sentence frames `A` as having “observer-relative non-monotonicity.” Reword this to the precise obstruction already named above and in the PR body: `A` is not a closure operator because `p ≤ A(p)` is not assumed.

### Thread 3: memory/feedback_otto_qg_isomorphism_step_1_formalize_remember_when_pay_attention_as_categorical_primitives_2026_05_15.md:67 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T00:30:26Z):

P1: “observer-relative non-monotonicity” conflicts with the research doc’s own definition that the non-classical move is observer-context shift, not non-monotonicity within a fixed context. Use the more precise obstruction here as well: `A` is not a closure operator because `p ≤ A(p)` is not assumed.
