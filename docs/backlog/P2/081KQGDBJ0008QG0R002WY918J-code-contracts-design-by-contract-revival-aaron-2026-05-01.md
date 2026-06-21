---
id: 081KQGDBJ0008QG0R002WY918J
priority: P2
status: open
title: Code Contracts revival — design-by-contract primitives enforcing pre/post-conditions and invariants at compile/runtime, not at review time (Aaron 2026-05-01; sibling of 081KQGDBJ0008QG0R0015RNK3P)
tier: tooling
effort: L
ask: Aaron 2026-05-01 named the row in the parallelism-scaling-ladder memo (`memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`) — "081KQGDBJ0008QG0R002WY918J, not yet filed" — as the mechanization primitive at the runtime/compile boundary for pre-condition enforcement. ID was reserved 2026-05-01; per-row file filed 2026-05-03 by Otto audit pass post-081KQGDBJ0008QG0R0015RNK3P filing.
created: 2026-05-01
last_updated: 2026-05-03
depends_on: []
composes_with: [081KQGDBJ0008QG0R002Y31XJ3, 081KQGDBJ0008QG0R0015RNK3P, 081KQNJ500008QG0R003SCWBDV, 081KQNJ500008QG0R0035QCEX9]
tags: [code-contracts, design-by-contract, pre-condition, post-condition, invariant, mechanization, runtime, compile-time, fsharp, csharp, tooling]
type: feature
---

# Code Contracts revival — design-by-contract primitives at compile/runtime

## Origin

Aaron 2026-05-01, in the parallelism-scaling-ladder memo (autonomous-loop maintainer channel), named this row in the mechanized-guardrail-vs-mover table:

> | Pre-condition violation | Code Contracts (081KQGDBJ0008QG0R002WY918J, not yet filed) throws at runtime | Compiler-time refinement-types reject the build |

**Editorial note on the verbatim "throws at runtime" wording**: the originating memo's table cell predates this row's spec. Per CLAUDE.md's Result-over-exception invariant ("user-visible errors surface as `Result<_, DbspError>` or `AppendResult`-style values; exceptions break the referential-transparency the operator algebra depends on"), the actual implementation of 081KQGDBJ0008QG0R002WY918J MUST flow **recoverable-user-facing-failure contract violations** as Result-error values, NOT throw exceptions. **Scope of "MUST"**: limited to recoverable-user-facing failures within Result-flow code paths. **Programmer-error preconditions** (e.g., F# `invalidArg` for argument validation in `src/Core/**`) are explicitly OUT OF SCOPE for the no-throw rule and stay as exceptions per F# idiom — see "Migration concerns + scope clarification" below for the precise scope split. The verbatim quote is preserved; the row spec normalizes to Result-flow within its narrowed scope.

And in the row-listing section:

> - **Code Contracts revival** (per 081KQGDBJ0008QG0R002WY918J (not yet filed)) — design-by-contract primitives that enforce invariants at compile/runtime, not at review time.

ID was reserved; per-row file was never filed. Otto 2026-05-03 audit pass (post-081KQGDBJ0008QG0R0015RNK3P filing, post-081KQNJ500008QG0R0035QCEX9 audit-row landing) found 081KQGDBJ0008QG0R002WY918J missing alongside 081KQGDBJ0008QG0R0015RNK3P in the same memo. Two days of substrate-time without the row materializing — sibling instance of the failure mode 081KQNJ500008QG0R0035QCEX9 captures.

## The problem

Pre-conditions, post-conditions, and invariants currently live in two places:

1. **Prose / comments**: documented in code comments + design docs. Not mechanically enforced; review-time guard.
2. **Tests**: assertions in unit tests verify the contract IS held by some inputs. Not exhaustive; only specific cases tested.

Neither catches:

- Pre-condition violations at the call-site (caller passed bad input)
- Post-condition violations at the implementation (implementation broke the promise)
- Invariant violations across object lifetime (state mutated to violate the invariant)

**Review-time enforcement** is the current discipline: reviewers spot pre-condition violations during code review. This is the failure mode the parallelism-scaling-ladder memo's "guardrail-vs-mover" table calls out — manual review is the static guardrail; mechanized enforcement (Code Contracts) is the kinetic mover.

## What this row builds

Design-by-contract primitives integrated into the F# / C# codebase:

1. **Pre-condition primitives**: `requires(condition, message)` at function entry; returns Result-error if violated **for recoverable-user-facing-failure contracts** (Result-over-exception per CLAUDE.md; NO throw / panic flow within that scope). For programmer-error preconditions (argument validation, internal invariants), use `requires_assert()` two-mode variant which composes with existing F# `invalidArg` idiom.
2. **Post-condition primitives**: `ensures(condition, message)` at function exit; verifies the return value satisfies the contract
3. **Invariant primitives**: `invariant(condition, message)` for class/object state; verified at all entry/exit points
4. **Optional compile-time mode**: refinement types (F# units of measure, C# nullable annotations, custom type-level constraints) that reject violations at the build step rather than runtime
5. **Integration with Result-over-exception** (per CLAUDE.md): contract violations produce structured `Result<_, ContractViolation>` values, not unhandled exceptions, when the call site is in a Result-flow

## Why "revival"

.NET historically had Microsoft Code Contracts library + ccrewrite tool that injected runtime checks. The library is now archived / unmaintained. Modern alternatives:

- **F#'s built-in features**: pattern matching exhaustiveness, units of measure, Result-types
- **C# nullable reference types**: compile-time null-violation detection
- **Third-party libraries**: PostSharp Aspect Framework (commercial), Fody.Aspects (community), custom source-generators
- **Roslyn analyzers**: compile-time custom checks via Microsoft.CodeAnalysis
- **F# type providers**: compile-time constraint generation

The row's scope: evaluate which of these (or combination) provides the design-by-contract primitives the project needs without the maintenance burden of the original Microsoft Code Contracts.

## Composes with

- **081KQGDBJ0008QG0R0015RNK3P (brittle-pointer auto-rewriter)**: sibling-instance of mechanization-primitives. 081KQGDBJ0008QG0R0015RNK3P mechanizes substrate cross-reference quality; 081KQGDBJ0008QG0R002WY918J mechanizes function-boundary contract quality.
- **081KQGDBJ0008QG0R002Y31XJ3 (verify-before-state-claim mechanized auditor)**: claim-integrity discipline; this row mechanizes the contract-integrity discipline at function boundaries
- **081KQNJ500008QG0R003SCWBDV (substrate-claim-checker)**: data-claim verification; this row's tool is code-claim verification
- **081KQNJ500008QG0R0035QCEX9 (audit memos for misfiled backlog)**: this row's existence IS another empirical hit for 081KQNJ500008QG0R0035QCEX9's audit hypothesis (sibling to 081KQGDBJ0008QG0R0015RNK3P)
- **`memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`**: the originating substrate where the ID was reserved alongside 081KQGDBJ0008QG0R0015RNK3P

## Why this is L-effort

- Library / tooling selection requires evaluating multiple options (PostSharp, Fody, Roslyn analyzers, F# type providers, custom source-generators)
- Integration with existing Result-over-exception pattern (per CLAUDE.md) requires non-trivial design — contracts must compose with Result-flow, not break it
- Test coverage for the contract primitives themselves
- Migration of existing prose-documented contracts to mechanized form (substantial; many functions in F# core have pre/post-conditions in comments)
- CI integration (compile-time mode requires custom build steps; runtime mode requires test-suite integration)

## Migration concerns + scope clarification (post-merge review absorption)

Reviewer findings on the original row revealed three real compatibility concerns the row must acknowledge:

1. **Existing `invalidArg` / exception-based code in `src/Core/**`**: programmer-error preconditions currently use `invalidArg` (e.g., bucket/count/window validation). The Result-over-exception invariant per CLAUDE.md applies to **user-visible failures**; programmer-error preconditions historically use exceptions in F# idiom. **Scope refinement**: 081KQGDBJ0008QG0R002WY918J's contract primitives target **recoverable user-facing failures** (`Result<_, ContractViolation>` flow); programmer-error preconditions stay as `invalidArg` until a separate decision (likely future row) decides whether to migrate. The row does NOT blanket-ban exceptions; it adds Result-flow contracts WHERE Result-flow is the operator-algebra path.

2. **Plain-returning APIs (`bool`, `Stream`, `ValueTask`)** in `src/Core/**`: contract primitives returning `Result<_, ContractViolation>` aren't drop-in for plain-returning functions. **Scope refinement**: 081KQGDBJ0008QG0R002WY918J's `requires()`/`ensures()`/`invariant()` apply to functions whose return-type already accommodates Result-flow OR whose call-site is willing to accept a wrapping change. For pure plain-returning APIs, the contract layer is **assertion-only** (debug-mode runtime check; production mode no-op) rather than Result-returning. Two-mode primitive: `requires_result()` (Result-returning) vs `requires_assert()` (assertion).

3. **`TreatWarningsAsErrors=true` in `Directory.Build.props`**: the original row's open-question framed contract violations as "warnings or errors" — a false dichotomy under the current build configuration where warning ≡ error. **Scope refinement**: contract violations are categorized at the contract layer (severity field on ContractViolation), but the build-gate disposition is uniform: any contract-layer issue that reaches build is a build break. Per-contract-class CI gating (some contracts produce build-breaks; some only fail tests) is itself a future design question, NOT a per-violation warning/error toggle.

## Open design questions (NOT for this row; for the design pass)

1. **Library vs source-generator vs Roslyn-analyzer**: which mechanization layer fits Zeta's F#-primary + C#-secondary surface?
2. **Compile-time vs runtime trade-off**: refinement types catch violations earlier but require type-system extension; runtime checks are less restrictive but slower-feedback
3. **Contract-violation handling within Result-flow**: structured Result-error type (single ContractViolation variant vs per-contract-type variants)? Per-function-config of contract-error severity?
4. **Migration strategy**: bulk-migrate prose contracts vs migrate-on-touch? (Note: scope of "prose contracts" is recoverable-user-facing-failure preconditions; programmer-error preconditions stay as `invalidArg` per scope refinement above)
5. **Build-gate disposition**: per-contract-class severity → build-break OR test-failure-only OR ignore? (Resolves the warning-vs-error confusion by routing contract-layer severity to build-gate disposition explicitly)

## Why this matters

Pre/post-condition violations are silent-failure-class bugs. The function technically returned, but the contract was violated; the violation surfaces later as an unrelated downstream bug. Mechanized contracts catch the violation at the source, not at the symptom. Composes with the alignment-frontier framing: substrate-quality at the code-boundary layer is alignment-frontier substrate.

## Carved sentence

**"Code Contracts revival mechanizes pre/post-conditions and invariants at function boundaries: requires() at entry, ensures() at exit, invariant() across lifetime. Compile-time mode (refinement types) rejects violations at build; runtime mode catches at execution and surfaces violations as Result-error values for **recoverable-user-facing-failure contract violations** (Result-over-exception per CLAUDE.md; NO throw / panic flow within that scope). **Programmer-error preconditions** (e.g., F# `invalidArg`) are out of scope for the no-throw rule and stay as exceptions per F# idiom. Replaces review-time enforcement (manual, brittle) with mechanized enforcement (deterministic, durable). Sibling-instance of 081KQGDBJ0008QG0R0015RNK3P (substrate-cross-reference quality) at the code-boundary layer."**
