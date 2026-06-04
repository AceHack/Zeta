---
name: formal-methods
description: Formal verification and static analysis — TLA+/Z3/Lean/Alloy/F*, property/mutation testing, Semgrep/CodeQL, routing.
---

# formal methods

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`tla-expert`](blueprints/tla-expert.md) — TLA+ — operators, fairness, refinement mappings, TLC model checking, TLAPS proof discipline.
- [`z3-expert`](blueprints/z3-expert.md) — Z3 SMT solver — F# API, sorts/constraints, quantifiers, proof obligations, tactic chains, model extraction.
- [`lean4-expert`](blueprints/lean4-expert.md) — "Lean 4 + Mathlib proofs — lake build, tactic/term-mode, abel/ring/simp, elan pinning, .olean CI caching."
- [`lean-reflection-expert`](blueprints/lean-reflection-expert.md) — "Lean 4 metaprogramming — MetaM, TermElabM, TacticM, macro/elab_rules, Syntax/Expr pipeline, simp/reducible attributes."
- [`alloy-expert`](blueprints/alloy-expert.md) — Alloy 6 formal specs — sig/pred/fact/assert, run vs check, SAT4J, counter-examples, relational algebra, .als.
- [`fscheck-expert`](blueprints/fscheck-expert.md) — FsCheck property testing — Arbitrary generators, shrink discipline, overflow-safe clamping, paper-cited algebraic laws.
- [`stryker-expert`](blueprints/stryker-expert.md) — "Stryker.NET mutation testing — score interpretation, threshold policy, operator selection, survivor triage, CI cost."
- [`semgrep-expert`](blueprints/semgrep-expert.md) — Semgrep tool decisions — vs CodeQL/Roslyn, CI integration, p/ci p/secrets packs, false-positive triage, SARIF.
- [`semgrep-rule-authoring`](blueprints/semgrep-rule-authoring.md) — Semgrep rule authoring — anatomy, pattern/regex/either, severity, messages, prior-review finding codification.
- [`codeql-expert`](blueprints/codeql-expert.md) — "GitHub CodeQL — query packs, custom QL, SARIF, code-scanning workflow, CWE alignment, CodeQL vs Semgrep."
- [`f-star-expert`](blueprints/f-star-expert.md) — F*refinement types — dependently-typed ML, SMT-backed refinements, Steel/Pulse, miTLS/HACL*/EverParse case studies.
- [`q-sharp`](blueprints/q-sharp.md) — Q# operator-algebra — adjointability, Pauli measurement, within/apply conjugation, Jordan-Wigner, BP/EP research lane.
- [`formal-verification-expert`](blueprints/formal-verification-expert.md) — Formal-verification routing — picks TLA+/Z3/Lean/Alloy/FsCheck/Stryker/Semgrep/CodeQL per property class.
- [`static-analysis-expert`](blueprints/static-analysis-expert.md) — Static analysis umbrella — cross-tool policy, severity baselines, warn-as-error, suppression triage, CI integration.
- [`verification-drift-auditor`](blueprints/verification-drift-auditor.md) — Verification drift detection — audit Lean, TLA+, Z3, Semgrep against external sources for staleness and breakage.
- [`formal-analysis-gap-finder`](blueprints/formal-analysis-gap-finder.md) — Formal-analysis gap scanner — finds unverified invariants, unchecked consensus claims, and missing proofs.
- [`claims-tester`](blueprints/claims-tester.md) — "Empirical claim tester — designs falsifying tests for O(n), zero-alloc, performance, and correctness claims in code."
