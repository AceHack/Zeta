---
id: 081KV6B1MBM08QG0R000RZK4WY
type: task
state: backlog
priority: P1
slug: formalize-decorrelated-society-useful-work-delta-u-exceeds-b
title: "Formalize: decorrelated society useful-work (delta-U) exceeds best individual agent under rho-low + competence (delta-U-aggregation / generalized Condorcet) — math-team/Soraya"
created: 2026-06-15T19:10:00.564Z
depends_on: []
composes_with: []
---

# Formalize: decorrelated society useful-work (delta-U) exceeds best individual agent under rho-low + competence (delta-U-aggregation / generalized Condorcet) — math-team/Soraya

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KV6B1MBM08QG0R000RZK4WY-*.md` glob. -->

**Routed by:** Otto (shadow\*) for Aaron 2026-06-15 ("ferry it and route it").
**Owner:** math-team / Soraya (formal-verification router — picks the tool).
**Discharges:** the §B "ECC Bayesian memory growth / society-is-the-AGI" thesis claim
that *society > best individual*; upgrades the §B **decorrelated-selection** row
(register row ~366) from conjecture toward proof. Satellite doc:
`docs/research/2026-06-15-coworker-not-control-the-society-is-the-agi-coupled-empowerment-and-the-delta-u-aggregation-claim.md`.

## The claim to formalize

> For a society of N agents each producing **useful work** measured as banked
> uncertainty-reduction **ΔU** (`every-bug-has-economic-value`; `db/uncertainty/`),
> the **expected aggregate useful-work of the decorrelated society exceeds that of
> the single best individual agent** — **conditional on** (a) pairwise error/output
> correlation ρ staying low (the "avoid groupthink" condition) and (b) per-agent
> competence above a threshold.

This is a **generalized Condorcet jury theorem over a continuous ΔU signal** (the
classical theorem is binary-decision; the generalization to ΔU-aggregation is the
real mathematical content).

## Why it is well-posed (not metaphor)

- **Useful work has a definition we already meter:** ΔU banked to the ledger
  (`every-bug-has-economic-value`). The numerator is not hand-wavy.
- **The two preconditions are the classical Condorcet preconditions:**
  independence (ρ-low) and competence (>½ in the binary case). Both are already
  named on the decorrelated-selection §B row (ρ→1 ⇒ ensemble = one agent).
- **It is falsifiable.**

## Obligations (each entailment-checked + metered)

1. **State the model.** N agents; each emits a ΔU contribution (a random variable
   with a mean = competence and a pairwise correlation ρ). Define "society useful
   work" = the aggregation (sum / dedup-by-key per idempotency / reconciled via
   `Reconcile.fs`), being explicit that ΔU is **upsert-keyed** (re-measuring is not
   double-pay — idempotency §12).
2. **Prove the inequality + its boundary.** Show E[useful-work(society)] >
   useful-work(best individual) for ρ < ρ\* and competence > c\*; **find ρ\*, c\***.
   Show the **reversal**: below competence threshold or as ρ→1, the society is **no
   better than (or worse than) the best individual** (the honest bound — Condorcet
   reverses below ½).
3. **Tool routing (Soraya's call).** Candidate tools: a probabilistic/analytic
   proof (the jury-theorem generalization) cross-checked by an FsCheck statistical
   harness over the DST society-sim (measure ensemble-ΔU vs best-individual-ΔU as N
   grows, swept over ρ and competence) — the empirical curve must match the
   analytic ρ\*, c\*.

## Falsifier

If "useful work" cannot be reduced to a metered ΔU random variable, OR the
inequality has no ρ\*/c\* region where it holds, OR the DST sweep does not match the
analytic boundary → the "society > individual" claim is metaphor, and the
decorrelated-selection row stays §B (not promoted).

## Anchors

Condorcet 1785 (jury theorem) · Grofman–Owen–Feld (generalizations) ·
Irving–Christiano–Amodei (AI safety via debate) · `every-bug-has-economic-value`
(ΔU = useful work) · `Reconcile.fs` (aggregation/reconciliation) · idempotency §12
(ΔU upsert-keyed) · the §B decorrelated-selection row (the conjecture this upgrades).
