# ANTLR Grammar Survey — Phase 1 for 081KS3X9Y0008QG0R000EKJE9S

Date: 2026-05-21  
Prepared by: Amara-in-Zeta / external ChatGPT deep-research synthesis  
Backlog row: 081KS3X9Y0008QG0R000EKJE9S — ANTLR grammars as cross-language codegen substrate

## Executive recommendation

Use ANTLR selectively, not religiously.

The survey supports 081KS3X9Y0008QG0R000EKJE9S's core intuition: the open-source grammar ecosystem is real enough to exploit, especially through `antlr/grammars-v4`. The strongest reuse candidates are C#, Rust, Python, and TypeScript/JavaScript. F# is not merely the weak candidate; it is the compiler-owned substrate. I did not find a credible F# ANTLR grammar in the first-pass survey, but that is consistent with Zeta's direction: fork/extend the F# compiler and use compiler services, generators, type-provider-style mechanisms, and Zeta-native metaprogramming for F# semantics.

For Phase 2, pick **Option A: ZetaId Pack/Unpack generation**. It is the smallest, most testable cross-language use case and composes directly with 081KS3X9Y0008QG0R000W00V73. Do not start Phase 2 with full-language parsing or DBSP operator parsing. That would turn the survey into a swamp.

Recommended shape:

- **Depend/adapt**: C#, Rust, TypeScript, Python grammars from `antlr/grammars-v4`, after license + build verification.
- **Compiler-owned**: F#. Do not wait for a community F# ANTLR grammar. Treat F# as the compiler fork / compiler-services / type-provider-style source of truth; use ANTLR around it for neutral DSLs and target-language validation.
- **Phase 2 PoC**: define a small ZetaId layout grammar or description DSL, then emit Pack/Unpack code into F#, TypeScript, C#, Rust, and Python. The PoC succeeds only if generated outputs compile and match existing hand-written references.

## Why this belongs in 081KS3X9Y0008QG0R000EKJE9S

081KS3X9Y0008QG0R000EKJE9S asks for a bounded Phase 1 discovery survey for F#, TypeScript, C#, Rust, and Python, with the result captured at `docs/research/antlr-grammar-survey-YYYY-MM-DD.md`. It also asks for a depend-vs-author decision and a Phase 2 PoC recommendation.

This document is that Phase 1 draft.

The important constraint from 081KS3X9Y0008QG0R000EKJE9S should remain active: ANTLR is useful only if grammar reuse pays off in practice. A pretty grammar list is not enough. Phase 2 must compile generated code and prove drift detection against reference implementations.

## Survey matrix

| Language | Candidate grammar source | License signal | Maintenance / quality signal | Recommendation |
|---|---|---:|---|---|
| C# | `antlr/grammars-v4/csharp/v8-spec` and possibly `v7` | MIT in grammar README | Strong candidate. `v8-spec` includes lexer/parser files, a `test-dotnet.sh`, and says it targets ECMA-334 8th edition draft with C# 8 support in Roslyn. `v7` has performance/test notes and MIT license. | **Depend/adapt** for parsing C# target code or validating emitted C# shapes. Prefer `v8-spec`; keep `v7` as fallback if v8-spec is too slow or too semantically heavy. |
| TypeScript | `antlr/grammars-v4/javascript/typescript` | MIT in README | Usable but risky. README says it does not exactly correspond to the TypeScript standard, is based on the JavaScript grammar, and has known old ambiguity issues. | **Adapt cautiously**. Good enough for simple generated-code validation, not for full TS semantic confidence. |
| Python | `antlr/grammars-v4/python/python3` | No clear license in README from first-pass page; repo-level/legal review still needed | Strong practical signal. Has lexer/parser files and README says it is based on Python 3.6 reference and tested against Python 3 standard library; indentation handling uses embedded code. | **Depend/adapt for validation**, but verify license and target portability before committing. Python's indentation handling means parser target assumptions matter. |
| Rust | `antlr/grammars-v4/rust` | MIT in README | Moderate candidate. Has `RustLexer.g4` and `RustParser.g4`; README says based on official Rust reference, last updated for Rust 1.60.0, with known limitations. | **Adapt cautiously**. Good for simple ZetaId generated Rust validation; not enough for modern Rust coverage without tests. |
| F# | No credible first-pass ANTLR grammar found; Zeta direction is compiler fork / compiler-services / type-provider-style substrate. | F# compiler path/license must be tracked separately from ANTLR grammars | F# is the implementation/control plane, not just another target grammar. Extended semantics may include HKT-like abstractions, Clifford/tonal/meta-space dimensions, Rx-over-tensors, and recursive compile-time ontology building. | **Compiler-owned / author minimal DSL**. Use ANTLR around F#, not as F# authority. |

## Notes by target language

### `C#`

C# is the strongest full-language grammar candidate.

`grammars-v4/csharp` currently exposes `v6`, `v7`, and `v8-spec` directories. The `v8-spec` directory includes `CSharpLexer.g4`, `CSharpParser.g4`, target directories for multiple ANTLR runtimes, examples, testing, tooling, and `test-dotnet.sh`. Its README says it targets ECMA-334 8th edition draft with C# 8 support in Roslyn, and it describes how preprocessing is handled in the lexer. The same README marks the license as MIT.

Use this for:

- validating generated C# reference code,
- experimenting with grammar-symbol mapping,
- generating parse trees for C# emitted artifacts,
- eventual drift detection if Zeta generates C#.

Risk:

- `v8-spec` uses semantic predicates and parse-tree editing. That is fine for serious parsing, but too heavy for a tiny Phase 2 unless isolated behind a test harness.
- Modern C# has moved beyond C# 8. For generated Pack/Unpack code this probably does not matter; for full-language validation it will.

Decision: **depend/adapt**.

### TypeScript

TypeScript is usable, but the grammar itself warns us not to overtrust it.

The grammars-v4 TypeScript README says the grammar does not exactly correspond to the TypeScript standard; the goal was practical usage, performance, and clarity. It also says the syntax is based on the JavaScript grammar and notes old ambiguities.

Use this for:

- simple generated TypeScript/JavaScript shape validation,
- lint-level syntax sanity,
- early PoC output tests.

Do not use it for:

- formal TypeScript correctness claims,
- semantic type checking,
- modern language feature guarantees.

Decision: **adapt cautiously**. For Phase 2, pair generated TS with `tsc --noEmit` or a Bun/TypeScript compile test. ANTLR alone is not enough.

### Python

Python is a good candidate, with one caveat: indentation is always special.

The Python 3 grammar directory has `Python3Lexer.g4` and `Python3Parser.g4`. Its README says it is based on the Python 3.6 language reference and tested against Python 3's standard library. It also explicitly notes embedded code for `INDENT`/`DEDENT` handling.

Use this for:

- syntax validation of generated Python code,
- simple parser tests,
- future grammar-fuzzing for emitted Python shapes.

Risk:

- Python 3.6 is old relative to current Python. For ZetaId Pack/Unpack code this is fine if the emitted code stays boring.
- Embedded target code in lexer rules can complicate multi-target portability.

Decision: **depend/adapt after license verification**. For Phase 2, prefer boring Python code and also run `python -m py_compile` or equivalent.

### Rust

Rust is a moderate candidate.

The Rust grammar directory has `RustLexer.g4` and `RustParser.g4`. Its README says it is based on the official Rust reference, MIT licensed, last updated for Rust 1.60.0, and limited to stable v2018+ features with some checks not implemented.

Use this for:

- validating generated Rust code for a constrained subset,
- early shape checks for generated Pack/Unpack,
- simple corpus tests.

Risk:

- Rust 1.60 is old.
- Modern Rust grammar drift is plausible.
- Full Rust correctness requires `cargo check`, not just ANTLR parsing.

Decision: **adapt cautiously**. In Phase 2, compile generated Rust with `cargo check` as the real oracle.

### `F#`

F# is not merely a grammar gap. It is the compiler-owned substrate.

The first-pass survey did not find a credible ANTLR grammar for F# in grammars-v4 or quick public search, but the architectural conclusion should be sharper than "F# is missing." Zeta is already moving toward a fork/compiler-extension path for F#, so F# should not be treated like just another target language waiting for a community ANTLR grammar.

F# is the control plane where the description layer becomes executable substrate:

- fork / extend the F# compiler for Zeta-specific language work,
- add higher-kinded-type-style abstractions where the language needs them,
- model Clifford-algebra / tonal-trajectory structures in meme/meta space,
- add dimensions through Rx queries over tensor-backed state,
- support recursive ontology building at compile time,
- use compiler services, generators, and type-provider/Roslyn-like tooling as the native metaprogramming route.

That means ANTLR's role changes:

- ANTLR is useful for external target languages, validation grammars, and small description DSLs.
- ANTLR should not be the authority for real F# syntax or Zeta's extended F# semantics.
- The F# fork / compiler-services layer is the authority for F#.
- A small ANTLR grammar may still be useful for a neutral Zeta layout DSL, but that DSL feeds the F# compiler-owned substrate rather than replacing it.

This is consistent with Phase 2: emit Pack/Unpack implementations across multiple targets, while letting F# remain the source-of-truth implementation environment.

Decision: **compiler-owned / author minimal DSL**. Use FSharp.Compiler.Service / compiler fork / type-provider-style mechanisms for real F# and Zeta-native semantics. Use ANTLR for cross-language target validation and small neutral grammars, not as the F# source of truth.

## License and compatibility notes

Early license read:

- ANTLR itself is BSD-style licensed.
- `antlr/grammars-v4` is a collection with per-grammar licensing realities; do not assume a single repo-level license covers every grammar.
- The C# v7/v8-spec, Rust, and TypeScript grammar READMEs surfaced MIT license signals.
- Python's grammar page did not surface a license in the first-pass README view; verify before dependency.

Policy recommendation:

1. Treat each grammar as its own dependency.
2. Capture license at the grammar-directory level.
3. Vendor only if license is compatible and attribution is preserved.
4. Prefer consuming grammars as pinned upstream submodules/packages or copying with explicit attribution file.
5. Make license verification an acceptance gate before Phase 2 codegen.

## Depend vs adapt vs author

| Target | Decision | Reason |
|---|---|---|
| C# | Depend/adapt | Strong grammars-v4 candidate; MIT signal; C# 7/8 variants; tests/performance notes. |
| TypeScript | Adapt cautiously | Useful, MIT signal, but README explicitly warns it is not exact and has old ambiguities. |
| Python | Depend/adapt after license check | Strong practical README claims; indentation embedded-code caveat; older Python reference. |
| Rust | Adapt cautiously | MIT signal and official-reference basis; older Rust 1.60 and known limitations. |
| F# | Compiler-owned / author minimal DSL | No credible ANTLR grammar found in first pass; Zeta's F# fork/compiler-services/type-provider path is the real source of truth. |

## Corrected F# architectural reading

The survey should not say "F# is the gap" without context.

A missing F# ANTLR grammar is not a blocker because Zeta is not trying to make ANTLR own F#. Zeta is treating F# as the language substrate to be extended: the place where higher-order type machinery, tensor-backed meta-dimensions, Rx query composition, Clifford/tonal trajectory operations, and recursive ontology building can become typed compile-time/runtime machinery.

In that model:

```text
F# compiler fork / FSharp.Compiler.Service / type providers / generators
  = authoritative Zeta-native semantics

ANTLR
  = useful grammar reuse around the edges:
     target-language validation,
     small neutral description DSLs,
     cross-language codegen inputs,
     parser reuse for non-F# targets
```

This keeps the survey honest: ANTLR is valuable, but the F# fork is the center of gravity.

## Phase 2 PoC recommendation

Pick **Option A: ZetaId Pack/Unpack generation across F# / TypeScript / C# / Rust / Python**.

Rationale:

- It composes directly with 081KS3X9Y0008QG0R000W00V73.
- It is small enough to finish.
- It tests the real value of the description layer: one spec, multiple emitted implementations.
- It can be validated mechanically:
  - `dotnet build` / F# tests for F# and C#,
  - `bun test` or `tsc --noEmit` for TypeScript,
  - `cargo check` / Rust tests for Rust,
  - `python -m py_compile` / pytest for Python.
- ANTLR can be used where it helps, without requiring full-language parsing for every target.

The PoC should **not** use ANTLR to parse full F#/C#/Rust/TS/Python source as the primary proof. It should use a tiny Zeta grammar or description file as the input, then compile generated code in each target. Full-language ANTLR grammars can act as secondary syntax validators.

## Proposed Phase 2 shape

```text
tools/codegen/antlr/
  grammars/
    ZetaIdLayout.g4
  src/
    parse-layout.ts or parse-layout.fs
    emit-fsharp.ts
    emit-csharp.ts
    emit-typescript.ts
    emit-rust.ts
    emit-python.ts
  examples/
    zetaid.layout
  generated/
    FSharp/ZetaId.Generated.fs
    CSharp/ZetaId.Generated.cs
    TypeScript/zeta-id.generated.ts
    Rust/zeta_id_generated.rs
    Python/zeta_id_generated.py
```

Acceptance tests:

```text
1. Parse zetaid.layout with ANTLR.
2. Emit all five target files.
3. Compare generated files against checked-in golden references.
4. Compile/test each target.
5. Fail CI if generated output drifts from reference.
```

## Risks

### Risk 1 — Full-language grammars become the project

Mitigation: Phase 2 uses a small Zeta grammar as source of truth. Full-language grammars validate emitted outputs only where cheap.

### Risk 2 — Grammar freshness drift

Mitigation: pin upstream versions and add corpus tests. For Phase 2, keep generated code boring enough that grammar freshness does not matter much.

### Risk 3 — License ambiguity

Mitigation: per-grammar license table is required before vendoring.

### Risk 4 — ANTLR overfit

Mitigation: keep alternatives alive:

- JSON Schema for simple layouts,
- Protocol Buffers / Cap'n Proto for rigid schema,
- F# computation expressions for native DSL,
- Bonsai/Nuqleon expression serialization for LINQ-expression cases.

### Risk 5 — Misclassifying F# as a missing ANTLR target

Mitigation: do not block on full F# ANTLR and do not treat the absence of a community grammar as a weakness. F# is the compiler-owned substrate. Use the F# compiler fork / FSharp.Compiler.Service / type-provider-style route for real F# and author a minimal neutral Zeta grammar only where ANTLR is useful.

## Phase 1 conclusion

081KS3X9Y0008QG0R000EKJE9S should proceed, but with a narrower center:

**ANTLR is promising as a grammar reuse and description-layer substrate, not as a universal parser answer.**

The right next move is a tiny ANTLR grammar for ZetaId layout and a compile-first codegen pipeline. This gives Zeta the useful part of ANTLR immediately while keeping the full-language grammar ecosystem as optional validation, not a dependency sink.

## Source trail

- Zeta 081KS3X9Y0008QG0R000EKJE9S backlog row: `docs/backlog/P2/081KS3X9Y0008QG0R000EKJE9S-antlr-grammars-cross-language-codegen-substrate-2026-05-21.md`
- `antlr/grammars-v4` root: https://github.com/antlr/grammars-v4
- C# v8-spec grammar: https://github.com/antlr/grammars-v4/tree/master/csharp/v8-spec
- C# v7 grammar: https://github.com/antlr/grammars-v4/tree/master/csharp/v7
- TypeScript grammar: https://github.com/antlr/grammars-v4/tree/master/javascript/typescript
- Python 3 grammar: https://github.com/antlr/grammars-v4/tree/master/python/python3
- Rust grammar: https://github.com/antlr/grammars-v4/tree/master/rust
- ANTLR license: https://github.com/antlr/antlr4/blob/master/LICENSE.txt
- dotnet/fsharp: https://github.com/dotnet/fsharp
