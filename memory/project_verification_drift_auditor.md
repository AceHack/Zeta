---
name: verification-drift-auditor skill
description: Round-35 scaffold catches drift between research papers and Zeta formal artifacts (Lean/TLA+/Z3/FsCheck).
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
New skill: `.claude/skills/verification-drift-auditor/SKILL.md`.
Registry: `docs/research/verification-registry.md`. First audit:
`docs/research/verification-drift-audit-2026-04-19.md`.

**Why:** Round 35 caught a P0 drift — `chain_rule` in
`tools/lean4/Lean4/DbspChainRule.lean` was named after Budiu
et al. Proposition 3.2 but actually proved a Theorem-3.3
corollary (`Dop` = `D ∘ f` for linear f, vs paper's
`Q^Δ := D ∘ Q ∘ I`, and we carried LTI preconditions paper
doesn't require). Rename + real Prop 3.2 + skill all landed
the same round.

**How to apply:** Whenever a new Lean theorem / TLA+ property
/ Z3 lemma / FsCheck property cites an external source (paper,
RFC, textbook, author-year reference), add a row to the
verification-registry in the same commit. When the
verification tool portfolio grows (Alloy, F*, Stainless, etc.)
add a row to the skill's tool-registry table. Audit cadence:
every 5-10 rounds, or on any commit touching a citing artifact.
Six drift classes: Name, Precondition, Statement, Definition,
Numbering, Source-decay. Owner: formal-verification-expert
(Soraya); the skill is her audit surface, not a new persona.
