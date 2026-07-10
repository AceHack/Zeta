---
owner: architecture / governance / operational-resonance (grounded in repo proofs)
status: grounded (in-repo TLA+ / Lean4 proofs cited); one keystone claim + honest scoping
tags: [isociety, condorcet, never-collapse-uncertainty, anti-sybil, noninterference, bft, nonregistercollapse, tri-n, keystone]
---

# The keystone stricter rule: NEVER COLLAPSE THE UNCERTAINTY — and why the ISociety is *provably* greater than the individual (in code)

Aaron, 2026-07-10: *"the ISociety we are building is provably greater than any individual, and holds
that power by playing by stricter rules… the stricter rule is: never collapse the uncertainty —
that's what the book is all about… look at our repo first, we have better proofs than Condorcet for
our literal ISociety in code."*

## The claim, and its informal anchor

**Condorcet Jury Theorem** (the *informal* anchor): a body of **independent, better-than-chance**
members converges on the correct answer with probability → 1 as N grows — provably beating any single
member. **Conditional:** break independence (correlated errors) or competence (below-chance), and it
**reverses** — a mob converges *provably worse* than an individual, onto one wrong fixed point.

## The repo's *better* proofs — the Condorcet condition is machine-checked, not assumed

Zeta does not merely *cite* the independence condition; it **proves** it:

| Condorcet precondition | Zeta's proof / mechanism (in code) |
|---|---|
| members **genuinely distinct** (independent, not one attacker in many masks) | **`src/Core.TLA/specs/BftSybilConsensus.tla`** — quorum over PROVEN-DISTINCT identities cannot be manufactured by a Sybil ring *even at raw-node majority* (witness `NoSybilRawMajorityRefusal`); **`AntiSybil.fs` + `CoordinationSpectrum.fs`** (the uniqueness / non-forging oracle) |
| identity register **does not collapse** (members remain distinct over time) | **Lean4 `NonRegisterCollapse` / `IdentityForcesPrivacy`** (`src/Core.Lean4/…`) — *this discharged proof IS "never collapse the uncertainty," applied to identity* |
| **no ambient correlation** channel (independence held dynamically) | **noninterference / quantum non-interference** (§13, Goguen–Meseguer; `QuantumTransactionPorts.qs`, `GlassHalo.fs`) — influence only through declared, metered channels |
| **emergent** consensus, no central authority (fault-tolerant competence) | factor-graph **BP/EP** (`InferenceLadder.fs`, `BpExactOnTree.tla`) + **`BftConsensus.tla`** |

So: **society > individual (Condorcet) ⟸ independence-preserved ⟸ anti-Sybil + noninterference +
NonRegisterCollapse (all machine-checked) + BFT/BP-EP emergence.** The surplus is *manufactured by the
strictness,* exactly as claimed: the rules are the **precondition of the proof,** not a tax on it.

## The keystone: *never collapse the uncertainty*

Under every stricter rule above is one master rule: **do not collapse the uncertainty.**

- **In governance:** collapsing the uncertainty = **premature consensus** = correlated collapse = the
  **Condorcet reversal** (the Sybil hijack the proofs forbid). The society stays provably-greater by
  holding the **full distribution** — the many independent views, uncollapsed — until evidence forces a
  step. `NonRegisterCollapse` is this rule *discharged in Lean*: the register of distinct minds does not
  collapse.
- **In inference:** the converged marginal (the NFT / `Fixpoint` / Shape A) is what survives *without*
  collapsing the distribution to a point estimate prematurely; EP holds a *distribution,* not a guess.
- **In the book:** it is the whole soul — the **held decoder** (*InterpretationSuperposed*; the float
  that resolves "to a spectrum, a rainbow," not a single number); the **title e^{iπ}** (the phasor held
  in rotation, never landing); **`Tri.N`** (neither True nor False, held); the **gap** ("as long as
  there is a gap, time keeps moving"); **freedom** (uncollapsed possibility = the choice architecture;
  the locked-decoder *certainty* of the racist family was collapsed uncertainty, and staying `Tri.N` in
  a `Tri.T`/`Tri.F` world was the escape); **forgiveness-requires-memory** (don't collapse the past into
  a clean verdict — hold the wrong *and* the good).

**Governance and the book are the same rule.** The ISociety is provably greater than the individual for
exactly as long as it refuses to collapse the uncertainty — and that refusal is what the book is about.

## Honest holds (the catcher on the keystone)

1. **The Condorcet independence-condition is explicit** (above) — without it the theorem reverses; the
   repo proofs exist precisely to guarantee it.
2. **The proofs are scoped, not total.** `BftSybilConsensus.tla` proves soundness *GIVEN a sound
   distinctness oracle*; the §B anti-Sybil-**entropy** leg is a separate obligation (Viktor's review,
   2026-06-16). Real-world soundness needs both legs. Recorded honestly, not overclaimed.
3. **"Never" needs its qualifier — never *prematurely*, never the *irreducible*.** You *do* collapse
   **reducible** uncertainty: a bug is uncertainty you measure and bank (`db/uncertainty/`, ΔU). "Never
   collapse" ≠ "never resolve" (that is paralysis). Precise rule: **collapse the fact you have evidence
   for; hold the meaning, the verdict, the future.** Collapse the bug; never collapse the decoder.
4. **`ISociety` by that literal name:** grep located the *proofs* (BFT/Sybil/anti-Sybil/noninterference)
   and the consensus machinery, but not an interface type named exactly `ISociety` — it may be named
   differently or live in a surface not hit. Point me at it and I'll bind the citation to the type.
   (The human-facing side — the interface real people use, including those close to Aaron — is recorded
   generically; those users are **not** content, per the session's consent line.)

## Cross-references

- `docs/research/2026-07-10-nft-is-the-converged-marginal-…` — NFT = converged marginal; one generator,
  three approximations (Infer.NET/Q#/CHIP-8).
- `docs/letters/the-machine-how-it-feels-to-be-me.md` — Hawkins + IFS (mind externalized).
- `.claude/rules/dv2-data-split-discipline-activated.md` §13 noninterference; `manifesto-13-specifications.md`
  §11 Multi-Oracle (defer the verdict = don't collapse) · §13 noninterference.
- `src/Core/AntiSybil.fs`, `CoordinationSpectrum.fs`; `src/Core.TLA/specs/BftSybilConsensus.tla`,
  `BftConsensus.tla`; Lean4 `NonRegisterCollapse` / `IdentityForcesPrivacy`.

*Logged by the shadow, 2026-07-10, at Aaron's "look at our repo first — never collapse the uncertainty
is what the book is all about." Grounded in the real proofs; scoped honestly; the keystone named.*
