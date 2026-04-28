# Trajectory — Formal Analysis

## Scope

Every formal-verification tool that proves properties about
Zeta's operator algebra, specs, distributed protocols, or
crypto primitives. Open-ended because new tools emerge and
existing tools' Mathlib equivalents grow continuously.
Bar: prove the load-bearing mathematical claims; expand
coverage as the system grows; don't go stale.

## Cadence

- **Per-property review**: monthly — what's claimed but not
  proved? what's proved but not currently CI-checked?
- **Per-tool radar**: quarterly — new entrants, version updates,
  Mathlib lemma growth.
- **Per-claim**: when a paper draft, ADR, or core algebra change
  asserts a property, the formal-analysis trajectory routes it
  to the right tool (Soraya's `formal-verification-expert`
  routing per BP-16).

## Current state (2026-04-28)

| Tool | Surface | State | Coverage |
|---|---|---|---|
| **TLA+ / TLC** | distributed protocols, retraction semantics, consensus, ordering | 18 specs under `tools/TLA/*.tla` | active; specs reviewed per round; TLC model-checks on PR |
| **Lean 4 + Mathlib** | proofs about operator algebra (DBSP chain rule, retraction homomorphisms, Stainback conjecture) | tools/lean4/Lean4/DbspChainRule.lean and others | active; chain-rule proof landed; Stainback conjecture in flight |
| **Z3 (SMT)** | decision-procedure verification at `tools/Z3/*.smt2` | active | per-property; bounded |
| **Alloy 6** | structural / relational specs | tools/alloy/*.als | active; per-spec |
| **F\*** | dependent-type proofs (research) | scouting only | not yet adopted |
| **FsCheck** | property-based F# tests | active (test suite) | core algebra invariants + edge-case suites |
| **Stryker** | mutation testing as proof-coverage proxy | configured; not yet on cadence | F# + C# |
| **CodeQL** | semantic flow-analysis (taint, null deref, unsafe reflection) | active per static-analysis trajectory | overlaps; CodeQL is static-analysis primary, formal-analysis secondary |

## Target state

- Every property class in Zeta's load-bearing claims has a
  formal-verification artifact (proof, model-check, property test).
- Soraya's routing matrix (TLA+ vs Z3 vs Lean vs Alloy vs FsCheck
  vs Stryker) is documented + applied per claim.
- Mathlib coverage of Zeta-relevant lemmas is tracked; ports/PRs
  upstream when we land Zeta-side proofs.
- Reflection-cost in Lean is mechanizable (B-0050 trajectory) so
  IF4 (Lean-formalizable-in-principle) becomes a real gating filter.
- Stainback conjecture: full formalization in Mathlib eventually.

## What's left

In leverage order:

1. **Lean reflection capability skill** (B-0050) — current Lean
   proofs are hand-written; reflection drops boilerplate-vs-creative
   ratio. Staged 5-stage trajectory in the BACKLOG row.
2. **Stainback conjecture full formalization** — chain-rule lemma
   landed; rest of the conjecture in flight.
3. **Cross-check triage rule (BP-16)** — Soraya's portfolio view
   needs to be applied per-property; some properties currently
   only have one tool's proof when two would catch different
   classes of error.
4. **Mathlib upstream contributions** — we've landed proofs that
   may be Mathlib-worthy; need a triage pass for upstream-port
   candidates per the upstream-contribution discipline.
5. **Stryker activation** — see static-analysis trajectory; same
   item from a different angle.
6. **F\* evaluation** — research-grade scouting; useful for the
   wallet-experiment (EIP-7702 delegation security claims).

## Recent activity + forecast

- 2026-04-27: chain-rule Lean proof landed (`tools/lean4/Lean4/DbspChainRule.lean`).
- 2026-04-26: B-0048 retraction-algebra isomorphism work.
- 2026-04-26: B-0051 isomorphism catalog with IF1-IF4 grading.
- 2026-04-25: Soraya formal-verification-expert hat fully
  documented in `.claude/agents/formal-verification-expert.md`.

**Forecast (next 1-3 months):**

- B-0050 Lean reflection skill landing (staged 5-stage).
- Stainback conjecture next-lemma push.
- Wallet experiment v0 may surface security-property claims that
  warrant Z3 / TLA+ verification (signing topology, freeze paths,
  retraction window).
- Mathlib version updates — track upstream + bump pin per
  Otto-247 version-currency.

## Pointers

- Skill: `.claude/skills/formal-verification-expert/SKILL.md` (Soraya, routing)
- Skill: `.claude/skills/lean4-expert/SKILL.md`
- Skill: `.claude/skills/tla-expert/SKILL.md`
- Skill: `.claude/skills/z3-expert/SKILL.md`
- Skill: `.claude/skills/alloy-expert/SKILL.md`
- Skill: `.claude/skills/fscheck-expert/SKILL.md`
- Skill: `.claude/skills/stryker-expert/SKILL.md`
- Skill: `.claude/skills/f-star-expert/SKILL.md`
- BACKLOG: B-0048, B-0050, B-0051
- Decision: `docs/DECISIONS/` (see formal-verification ADRs)
- Verification audit: `docs/research/verification-drift-audit.md`
