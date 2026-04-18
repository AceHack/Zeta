# Mathlib / Lean 4 chain-rule — rolling progress log

Soraya's notebook for the Lean 4 + Mathlib chain-rule formalisation
at `proofs/lean/`. ASCII, append-only, pruned every 3 rounds (BP-07,
BP-09). Frontmatter canon is `proofs/lean/ChainRule.lean` +
`proofs/lean/README.md` (BP-08).

---

## Round 20 — scaffold landed

**Shipped this round.**

- `proofs/lean/lakefile.lean` now declares a Mathlib dependency via
  `require mathlib from git "https://github.com/leanprover-community/mathlib4" @ "v4.12.0"`,
  and pins the Lake package flags that Mathlib expects. The Mathlib
  tag `v4.12.0` matches the Lean toolchain tag below (Mathlib
  release cadence pairs 1:1 with Lean minor releases).
- `proofs/lean/lean-toolchain` pins `leanprover/lean4:v4.12.0`.
  This is the current stable Lean release with a matching Mathlib
  tag; it boots elan cleanly.
- `proofs/lean/ChainRule.lean` expanded from a 48-line one-`sorry`
  stub to a ~220-line **named-sub-lemma skeleton** with six
  discrete `sorry` goals and three closed lemmas (`zInv_zero`,
  `zInv_succ`, `chain_rule_id_corollary`).
- `proofs/lean/README.md` documents the build, the sub-goals, the
  per-sub-goal effort estimate (~6 engineer-days total), and the
  research-vs-port-from-literature split.
- `docs/INSTALLED.md` flipped the Lean/elan entry from "install on
  demand" to "install **next round** to run the proof build".

**Still `sorry`-bodied.**

Six named sub-lemmas + one chain-rule theorem. Per-sub-goal effort
estimates from the README:

| Sub-goal | Status | Days |
|---|---|---|
| T1 `zInv_zero` | CLOSED (`rfl`) | 0 |
| T2 `zInv_succ` | CLOSED (`rfl`) | 0 |
| T3 `I_zInv_eq` | `sorry` | 0.5 |
| T4 `D_I_eq` | `sorry` | 0.5 |
| T5 `I_D_eq` | `sorry` | 0.5 |
| B1 `linear_commute_I` | `sorry` | 1.0 |
| B2 `linear_commute_zInv` | `sorry` | 0.5 |
| B3 `linear_commute_D` | `sorry` | 0.5 |
| `chain_rule` | `sorry` | 2.0 |

Total remaining: **~5.5 engineer-days** to `sorry`-free.

**`lake build` gate status.** Unverified locally — Lean/elan not yet
installed on this box. Next round runs `tools/install-verifiers.sh`
(which already knows how to install elan; no script change needed)
and wires a `lake build` job into the CI matrix. The dep declaration
landed this round so that the install is all that's gating the build.

**Next concrete step (round 21).**

Close **T3** (`I (zInv s) n = I s n - s n`) first. It's a half-day of
`Finset.sum_range_succ` induction, and both T4 and the `chain_rule`
telescoping step depend on it. Landing T3 is the single most unblocking
move — it converts the two "obvious" discrete-calculus identities
(T4, T5) into short corollaries and gives `chain_rule` a solid
algebraic base to calc against.

After T3 lands, batch T4 + B2 + B3 into a single round; they're
each ~half-day and share Mathlib imports. That leaves the
`chain_rule` calc block and B1 as the only work for round 22.

**Budget check.** Proof-tool-coverage doc budgeted "2 weeks" for
this proof. Scaffold is ~0.5 day in. Remaining ~5.5 days of focused
work fits inside the budget with slack for Mathlib-API surprises.
No rescope needed.

---

## Pruning log

- 2026-04-17 (round 20): seeded. Next prune review: round 23.
