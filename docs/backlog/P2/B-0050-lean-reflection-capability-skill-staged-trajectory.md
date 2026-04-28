---
id: B-0050
priority: P2
status: open
title: Lean reflection — learn it properly, land a capability skill + scouting note (staged 5-stage trajectory)
tier: formal-verification-tooling-skill
effort: L
ask: Aaron 2026-04-21 — *"laern reflection backlog"*. Primary reading in context: Lean 4 reflection (MetaM/TermElabM/macros/tactic authoring/custom elaborators).
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [tools/lean4/Lean4/DbspChainRule.lean, docs/research/chain-rule-proof-log.md, docs/research/stainback-conjecture-fix-at-source.md, B-0048, B-0051, feedback_teaching_is_how_we_change_the_current_order_chronology_everything_star.md, .claude/agents/formal-verification-expert.md]
tags: [lean4, reflection, metaprogramming, mathlib, proof-automation, tactic-authoring, custom-elaborators, formal-verification, stainback-conjecture, ceramist-port]
---

# B-0050 — Lean reflection capability skill + scouting note

## Origin

AceHack commit `bab4ae1` (2026-04-21). Aaron's *"laern reflection backlog"*. Primary reading in context: **Lean reflection** — Lean 4's meta-programming surface (`Lean.Elab`, `Lean.Meta`, `Lean.Expr`, macro-elaboration, tactic-programming, custom elaborators, `@[reducible]` / `@[irreducible]` / `@[simp]` attributes, the `MetaM` / `TermElabM` / `TacticM` monad stack).

Alternate reading preserved (general-purpose reflection-in-any-language); the Lean-specific read has higher engineering value given the active chain-rule Lean formalization.

## Why it matters now

Three converging pressures:

1. The chain-rule proof has landed but the proofs are hand-written. As the factory scales Lean coverage (Stainback conjecture formalization, retraction-algebra homomorphisms from B-0051 isomorphism-catalog, Ceramist → Mathlib port), the ratio of boilerplate-proof to creative-proof grows. Reflection (custom tactics, macros, decision procedures) is how that ratio shrinks.
2. The B-0051 isomorphism-catalog row proposes IF4 (Lean-formalizable-in-principle) as a gating filter. Without reflection competence, IF4 is aspirational; with it, the formalization step is mechanizable.
3. Soraya's formal-verification routing authority will make more targeted Lean-vs-Z3-vs-TLA+ choices when she can estimate the reflection-cost of the Lean path honestly.

## Scope when landed

Anticipated skill: `lean-reflection-expert` or extension to existing formal-verification-expert. Staged:

- **Stage 1 — read-only reflection competence:** can read Lean code that uses `MetaM` / `TermElabM` / `macro` / `elab_rules` and explain what it does. Can navigate Mathlib tactic code. Understands the `Syntax → Expr → Term → MetaM Unit` elaboration pipeline well enough to diagnose errors.
- **Stage 2 — tactic authoring:** can write a simple tactic (e.g., `by decide_retractible` that tries to close retractibility-preservation goals via a decision procedure). Understands `simp`-set management, `congr` structure.
- **Stage 3 — macro / elab authoring:** can write custom syntax extensions, notation, elaborators. Relevant for embedding Zeta's operator algebra as Lean notation (`a +ᴬ b = ...`, `∂/∂t s = ...`) so proofs look like the domain they model.
- **Stage 4 — decision-procedure authoring:** custom decision procedures for domain-specific fragments (retraction-algebra, monoid actions on Z-sets, semiring homomorphism checks). This is where the IF4 gating becomes cheap.
- **Stage 5 — proof-automation integration:** `aesop` / `polyrith` / `linarith` extension for Zeta's algebra. Feeds back into the chain-rule proof and into the Stainback formalization.

## Teaching discipline

Per `feedback_teaching_is_how_we_change_the_current_order_chronology_everything_star.md`: the learning trajectory is itself a teachable artifact — each stage's landing produces a short `docs/research/lean-reflection-stage-N-notes-YYYY-MM-DD.md` that captures the structural understanding for the next learner (human or agent) to pick up from. Matches the Mr-Khan-pedagogy posture: free to read, prior understanding preserved, additive layering.

## Alternate-reading placeholder

If Aaron meant "reflection" in the general programming sense (C#/F#/Java runtime type introspection, Python `inspect`, Ruby `method_missing`, etc.), the row demotes to M-effort "reflection-patterns audit across factory languages" with a downstream question of whether retraction-algebra composes cleanly with reflection-based dispatch (probably not — reflection is often used to break static guarantees, which conflicts with the algebra). This reading produces less engineering value and conflicts more with the factory's static-verification posture. No work happens on either reading until confirmed.

## Owner / effort

- **Owner (anticipated):** Soraya (formal-verification-expert) extends her scope, or a new `lean-reflection-expert` persona created only after the honor-those-that-came-before protocol checks retired personas. Kenji schedules across rounds.
- **Effort:** M (Stage 1) + M (Stage 2) + L (Stages 3-5 combined); total multi-round.

## Does NOT commit to

- Building a bespoke tactic framework before Stage 1 is solid (premature abstraction trap).
- Rewriting the chain-rule proof in tactics (the hand-written proof is teaching-surface; tactics come later as amortization).
- Using reflection to break static guarantees elsewhere in the factory (reflection is a Lean-proof tool; factory source code stays statically verifiable).

## Cross-reference

- AceHack commit: `bab4ae1`
- `tools/lean4/Lean4/DbspChainRule.lean` — the artifact that benefits first from reflection competence
- Composes with: B-0048 (3/4-color theorem — Stage 4 is downstream of Stage 1+ reflection competence), B-0051 (isomorphism catalog IF4 filter); chain-rule-proof-log; stainback-conjecture-fix-at-source
