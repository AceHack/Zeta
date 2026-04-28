---
name: .NET Code Contracts (2008-2017) — prior art for skill.yaml invariant substrate
description: Microsoft Research's Code Contracts (Spec# descendant) attempted first-class preconditions / postconditions / invariants in .NET. Archived around 2017 — relevant prior art for Zeta's skill.yaml invariant-substrate pattern and, more broadly, for every layer-specific invariant substrate Zeta is building. Post-mortem lessons matter for avoiding the same failure modes.
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
2026-04-20 — Aaron cited Code Contracts as "that project kind
of died off" when discussing the skill.yaml spike on prompt-
protector. He is correct and the history is directly
relevant to how Zeta's layered invariant substrate should
be designed.

## What Code Contracts was

Namespace: `System.Diagnostics.Contracts` (shipped .NET 4.0,
2010). Core API:

- `Contract.Requires<TException>(bool)` — precondition
- `Contract.Ensures(bool)` — postcondition
  (with `Contract.Result<T>()` and `Contract.OldValue<T>()`)
- `Contract.Invariant(bool)` inside a
  `[ContractInvariantMethod]`-attributed method — object
  invariant
- Abbreviations and legacy requires for pre-.NET 4.0 interop

Two tooling paths:

- **`ccrewrite`** — post-build IL rewriter that inserted
  runtime-check IL into assemblies. Ran as a separate MSBuild
  task.
- **`cccheck`** — static analyzer using abstract interpretation
  to prove contracts at compile time without running them.

Lineage: descended from Microsoft Research's **Spec#**
(2004-), which itself descended from Eiffel's design-by-
contract (Bertrand Meyer, 1986-).

## What killed it

- **Static checker was slow and flaky at scale.** cccheck
  timed out or emitted spurious warnings on large codebases.
  Abstract interpretation is inherently expensive; the
  implementation never matched the performance needed for
  developer-loop use.
- **Roslyn landed without first-class contracts support.**
  When the new C# compiler platform shipped in 2015, contracts
  were not built into it. The Code Contracts rewriter remained
  a separate post-processing step rather than integrating with
  the new analyzer pipeline.
- **Microsoft never committed an owning team.** The project
  stayed in MSR / the CLR team's margin-time rather than
  becoming a funded component. No roadmap, no stability
  guarantees for consumers.
- **Nullable reference types (C# 8, 2019) absorbed the one
  slice that survived.** Null-preconditions — the most common
  and useful case — got first-class syntax and analyzer
  support without the Contract.Requires ceremony. The rest of
  the contract surface had no forcing function.
- **Single-layer, single-vendor dependency.** Code Contracts
  addressed exactly one layer (.NET method-level contracts)
  and depended entirely on Microsoft's continued investment.
  When that investment declined, there was no community
  momentum or multi-vendor ecosystem to carry it.

Archived: the official repo
(`github.com/Microsoft/CodeContracts`) went read-only around
2017; issues were closed in bulk; no further releases.

## Post-mortem lessons for Zeta's invariant substrate

The `skill.yaml` spike this round, and the broader pattern of
layer-specific invariant substrates Zeta is building, need to
avoid these failure modes:

1. **Don't bet on a single vendor's tooling.** Zeta's
   invariant-checker portfolio already diversifies: Z3 +
   Lean + TLA+ + FsCheck + Alloy + (round-43) LiquidF#
   evaluation + (new) skill.yaml. Losing any one is
   survivable because the portfolio carries the load.
2. **Don't let the checker be the bottleneck.** cccheck's
   timeouts killed developer adoption. Zeta's approach is
   checker-per-claim: each invariant declares which
   checker applies (`model-checker-hints` field in
   skill.yaml). Fast checkers for cheap claims; expensive
   checkers only where the payoff is.
3. **Design for the absent-checker case.** Invariants at
   `guess` or `observed` tier are still useful for human
   reasoning even without a mechanical check. Code
   Contracts required `ccrewrite` to ship runtime checks;
   the three-tier system makes declaration valuable on
   its own and mechanical verification an upgrade path.
4. **Cover multiple layers from the start.** Code Contracts
   covered one layer. Zeta is landing invariant substrates
   per layer simultaneously: skill-layer (skill.yaml),
   code-layer (LiquidF# evaluation), protocol-layer
   (TLA+), proof-layer (Lean), spec-layer (OpenSpec).
   Coverage is the moat.
5. **Externalization is the product, not the checker.**
   Aaron's cognitive style (invariant-first) makes the
   declaration-itself valuable even when no checker runs.
   Code Contracts framed the IL rewriter as the main
   deliverable. Zeta frames the declarative artefact as
   the main deliverable; checking is a second-order
   payoff.

## What Zeta can re-use from Code Contracts

- **Naming conventions.** `Requires` / `Ensures` /
  `Invariant` are well-understood in the .NET community;
  if LiquidF# evaluation leads to refinement types in Zeta
  code, the existing vocabulary is the right starting
  point.
- **Attribute-based metadata.** Code Contracts used
  `[ContractInvariantMethod]` and friends to mark code
  locations. For skill-layer, the same role is played by
  the `invariants` key in skill.yaml.
- **The abstract-interpretation heritage.** cccheck's
  approach (abstract interpretation over bytecode) is
  directly applicable to F# IL for the LiquidF# /
  refinement-type path. The research didn't die because it
  was wrong; it died because it was unfunded.

## Related memory

- `user_invariant_based_programming_in_head.md` — Aaron's
  cognitive-style framing that gives skill.yaml its load-
  bearing role.
- `feedback_skill_tune_up_uses_eval_harness_not_static_line_count.md`
  — the "data-driven everything" thread applied to skill
  invariants specifically.
- `docs/research/liquidfsharp-evaluation.md` +
  `docs/research/liquidfsharp-findings.md` (round 43) —
  Zeta's evaluation of refinement types for the code layer.
