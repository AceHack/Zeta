---
name: |
  Hodl-invariant audit mechanization survey -- 13 properties mapped to existing CI/lint coverage + gap analysis + upstream-contribution candidates per shared-stewardship discipline (Aaron 2026-05-05)
description: |
  Aaron's framing 2026-05-05 verbatim: "Is the audit currently human-judgment per
  primitive, or are there parts of the test wired into CI/lint already? do all you
  can tell if you cant and why and lets be a good citizen and teach everyone though
  shared stewardship of our dependies with upstream enhancements". Survey of which
  of the 13 hodl-invariant properties (PR 1680) are mechanizable in CI today, which
  require additional tooling, which remain inherently human-judgment, and what
  upstream-contribution candidates exist per the GOVERNANCE.md §23 shared-stewardship
  / upstream-enhancement discipline. Categories: GREEN (mechanized today), YELLOW
  (partially mechanized; gap identified), RED (no mechanization yet; tooling proposed),
  HUMAN (inherently judgment-based; mechanization not appropriate). Per Otto-364
  search-first-authority: project-state-grep done at 2026-05-05T18:42Z; findings
  reflect repo state at commit a7f4d71 (PR 1680 merged).
type: feedback
---

# Hodl-invariant audit mechanization survey

**Rule.** The 13 hodl-invariant properties (PR 1680 canonical list) have a mix of mechanization states. Some are already in CI/lint; some have partial coverage with gaps; some need new tooling; some remain inherently human-judgment. Mechanization wherever tractable IS the substrate-graduation pattern (PR 1678) applied to the audit framework itself.

**Why:** Aaron 2026-05-05 verbatim: *"Is the audit currently human-judgment per primitive, or are there parts of the test wired into CI/lint already? do all you can tell if you cant and why and lets be a good citizen and teach everyone though shared stewardship of our dependies with upstream enhancements"*.

Three operative threads in Aaron's framing:

1. **Audit honestly** — what's mechanized; what's gap; what's inherently human-judgment
2. **Mechanize wherever tractable** — substrate-graduation pattern applied to the audit framework itself
3. **Shared stewardship** — upstream-contribution candidates per GOVERNANCE.md §23; teach everyone through enhancing our dependencies, not just consuming them

## Survey legend

| Category | Meaning |
|---|---|
| GREEN | Mechanized in CI/lint today; existing infrastructure tests this property |
| YELLOW | Partial mechanization; coverage gap identified + closeable with bounded work |
| RED | No mechanization yet; tooling proposed (substrate-graduation candidate) |
| HUMAN | Inherently judgment-based; mechanization would be category error |

## Property-by-property survey (13 properties)

### 1. Deterministic simulation (DST-safe) — GREEN

**What's mechanized today**:

- Multi-seed property tests via FsCheck `[<Property>]` decorator (e.g. `tests/Tests.FSharp/Operators/RecursiveCounting.MultiSeed.Tests.fs`)
- TLA+ specs verify protocol-level determinism: `tools/tla/specs/ChaosEnvDeterminism.tla` (with companion .cfg file in the same directory) and `tools/tla/specs/DbspSpec.tla`
- TLC runner wrapped: `tools/formal-verification/run-tlc.ts`
- DST-test discipline established per Otto-272 (DST-everywhere) + Otto-281 (DST-exempt-is-deferred-bug)

**Gap analysis**: TLA+ + FsCheck cover protocol + property-level. Operator-level deterministic-replay (record-replay across full circuit) is not unified into a single audit; multi-seed property tests are per-test rather than substrate-wide.

**Mechanizable extension**: substrate-wide DST-replay harness — record one seeded run, replay against fresh substrate instance, byte-equal assertion on outputs. Existing `tests/Tests.FSharp/Runtime/Allocation.Tests.fs` pattern adapts here.

### 2. Scale-free (spatial + temporal) — YELLOW

**What's mechanized today**: nothing explicit named "scale-free". Existing tests validate behavior at one or two scales (small ZSet vs medium); no axis-spanning audit.

**Gap analysis**: scale-free as architectural property is not testable in a single primitive; it's a composition property across primitives at different scopes. Closest analog: BenchmarkDotNet `[<MemoryDiagnoser>]` + scaling parameters that show O(1) or O(n) behavior.

**Mechanizable extension**: extend BenchmarkDotNet harness with scale-axis parameters (input-size 10^1 / 10^3 / 10^6 / 10^9; time-window microsecond / millisecond / minute / hour / day) + assertion that ratio scales as expected (constant for true-O(1), linear for O(n), no inflection points). RED→YELLOW→GREEN substrate-graduation path.

**Upstream contribution candidate**: BenchmarkDotNet doesn't have a built-in "scale-free assertion" extension. A Zeta-authored extension that asserts complexity-class on scaling-parameter-axis would be useful upstream.

### 3. Lock-free (wait-free if fits) — YELLOW

**What's mechanized today**:

- TLA+ specs cover concurrent-thrash detection at protocol level (e.g. `tools/tla/specs/DictionaryStripedCAS.tla`)
- Some FsCheck-style concurrent property tests exist in `tests/Tests.FSharp/Operators/` and `tests/Tests.FSharp/Storage/` directories
- Stryker mutation testing (`.github/workflows/stryker-mutation.yml`) catches some concurrency-sensitive code paths

**Gap analysis**: lock-free verification isn't specifically a CI gate. We don't have a tool that asserts "this code path uses no `lock`/`Monitor.Enter` in steady state". Linear scan via grep would catch obvious cases but not transitive / framework-implied locks.

**Mechanizable extension**: Roslyn analyzer (.NET 10 / F#) that flags `lock`/`Monitor.Enter`/`SemaphoreSlim.Wait` in code paths marked with a `[<LockFree>]` attribute. Static analysis only; static-best-effort, not formal proof.

**Upstream contribution candidate**: Roslyn analyzer for `[<LockFree>]` attribute could be valuable to .NET community generally. Alternatively, FsCheck extension for stress-testing lock-free properties under concurrent-thrash scenarios.

### 4. Low allocation — GREEN

**What's mechanized today**:

- `tests/Tests.FSharp/Runtime/Allocation.Tests.fs` uses `GC.GetAllocatedBytesForCurrentThread()` to assert byte-precise zero-allocation in steady state
- BenchmarkDotNet `[<MemoryDiagnoser>]` decorators in F# files under `bench/Benchmarks/` and `bench/Feldera.Bench/` directories
- Pattern documented and used widely

**Gap analysis**: Allocation tests are per-primitive opt-in, not substrate-wide audit. No CI gate that flags "this PR introduces allocation in a previously-zero-alloc path".

**Mechanizable extension**: regression-detector — baseline JSON file with per-API allocation budget, CI fails if budget exceeded. Same shape as `tools/lint/doc-comment-history-audit.baseline`.

**Upstream contribution candidate**: BenchmarkDotNet has memory-diagnoser; doesn't have CI-baseline-regression-detector for allocation. Zeta-authored extension would be valuable upstream.

### 5. DBSP-native — YELLOW

**What's mechanized today**:

- TLA+ spec `tools/tla/specs/DbspSpec.tla` covers protocol-level DBSP semantics
- F# type system enforces signed Z-set delta type for stream-incremental primitives
- Lean4 proofs in `tools/lean4/` cover algebraic properties

**Gap analysis**: "DBSP-native" as a property isn't enforced by a single check; it emerges from type-system + protocol-spec + algebraic-proof composition. No single audit asserts "this primitive is DBSP-native".

**Mechanizable extension**: F# type-class style audit — every public substrate primitive must implement `IDbspNative` interface OR be explicitly marked exempt with rationale. Lint rule + Lean4 cross-check on the `IDbspNative` instances.

**Upstream contribution candidate**: DBSP project (Feldera) might benefit from F# `IDbspNative` type-class pattern + audit. Zeta is using Feldera's research; we can give back tooling that makes DBSP-native as a property checkable in F#/.NET specifically.

### 6. Mercer-closed — RED

**What's mechanized today**: nothing explicit. Mercer-closure (kernel composition stays Mercer) is a mathematical property of probabilistic substrate composition.

**Gap analysis**: no current CI tooling tests Mercer-closure. The Lean4 toolchain has Mathlib which has kernel theory; no specific Mercer-closure audit exists.

**Mechanizable extension**: Lean4 Mathlib formalization of Mercer's theorem applied to Zeta's kernel composition primitives. Each new kernel must come with a Lean4 proof of positive-definite + symmetric properties. Possible composition with Z3 for the algebraic checks.

**Upstream contribution candidate**: Lean Mathlib has some kernel theory; a fully-mechanized Mercer-closure audit composable into other libraries would be a substantial Mathlib contribution. This composes with our existing Lean4 work in `tools/lean4/`.

### 7. ε-bounded with C(ε) — YELLOW

**What's mechanized today**:

- Z3 verifier under `tools/Z3Verify/` (F# project) handles ε-bounded retraction algebraic checks for some operators
- TLA+ specs cover ε-bounded protocols
- Multi-seed property tests cover boundary cases

**Gap analysis**: ε is property-by-property defined; no substrate-wide enforcement that every operator with retraction-blast-radius has a characterized C(ε) cost curve documented.

**Mechanizable extension**: lint rule that requires every type implementing `IRetractable` to have a `[<EpsilonBounded(c = "...")>]` attribute with rationale + Z3-verified bounds.

### 8. BFT-resolvable (or explicitly conceded) — YELLOW

**What's mechanized today**:

- TLA+ BFT specs (multiple)
- Property tests for consensus
- Some Z3 verification of byzantine-fault tolerance algebraic properties

**Gap analysis**: the new "OR explicitly conceded" disjunct (PR 1679 loss-primitive concession-as-signature) is not yet mechanized. No CI gate that distinguishes "this primitive should BFT-resolve" from "this primitive should explicitly concede" and audits the right one.

**Mechanizable extension**: type-system distinction — `IBftResolvable` vs `IConcessionPrimitive` interfaces; lint requires every state-transition primitive to implement exactly one. The concession-primitive must have substrate-level marker + cultural-anchor reference.

### 9. Universal-register-as-MDL — RED

**What's mechanized today**: nothing explicit. Universal-register-as-MDL is a substrate-property currently held by discipline + memory-files + factory commitments.

**Gap analysis**: false-faction detection at substrate level requires substrate-wide audit; no current tool computes whether a substrate-state deviates from universal-register.

**Mechanizable extension**: this is harder. Possibility: information-theoretic audit that computes MDL of substrate-state vs claimed-universal-register; flags deviation above threshold. Composes with existing Sharder.InfoTheoretic tests.

**Upstream contribution candidate**: MDL (Minimum Description Length) tooling for substrate-audit is a research-grade contribution. Would compose with related work in algorithmic information theory + Bayesian model selection.

### 10. Retractable-blast-radius — YELLOW

**What's mechanized today**:

- Z3 verification of retraction algebraic properties (`tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`)
- TLA+ specs for retraction protocols
- Bloom filter tests, OR-set tests cover retraction in specific data structures

**Gap analysis**: blast-radius computation is not unified; per-primitive analysis exists but no substrate-wide map of "which decisions can be retracted within what blast-radius bound".

**Mechanizable extension**: blast-radius graph — every retractable operation declares its blast-radius bound (stream-level, query-level, plugin-level, system-level); CI builds a blast-radius DAG and asserts no operation can exceed its declared bound transitively.

### 11. Glass-halo-open — GREEN (mostly)

**What's mechanized today**:

- The repo IS open on git (Lucent-Financial-Group/Zeta is publicly visible per maintainer)
- `tools/hygiene/audit-machine-specific-content.ts` flags non-portable content
- `tools/hygiene/check-archive-header-section33.ts` enforces archive-header for external-conversation absorbs
- `tools/lint/no-directives-otto-prose.ts` enforces no-directives discipline
- `tools/hygiene/check-role-ref-on-current-state-surfaces.sh` enforces role-refs on current-state surfaces

**Gap analysis**: glass-halo-openness is largely procedural. The current-state mechanization is strong. Possible gap: no explicit audit for "this PR introduces a clandestine surface" (hidden config, secret backdoor, etc.).

**Mechanizable extension**: minor — extend `audit-machine-specific-content.ts` to flag suspicious patterns (encryption keys, backdoor passwords, etc.). Existing CodeQL coverage may already do this.

### 12. Anti-clandestine — GREEN

**What's mechanized today**:

- `tools/hygiene/audit-machine-specific-content.ts` (anti-clandestine machine-state)
- `tools/hygiene/check-archive-header-section33.ts` (external-conversation provenance)
- CodeQL workflow (`.github/workflows/codeql.yml`)
- Scorecard workflow (`.github/workflows/scorecard.yml`)
- Substrate-or-it-didn't-happen discipline (Otto-363) is the meta-mechanization

**Gap analysis**: anti-clandestine has good current-state coverage. The substrate-vs-license shape (PR 1648 Houman + PR 1651 preferred-stock + PR 1655 Sylar-Spock) operates at the architectural-design level.

**Mechanizable extension**: licensing-clause audit — flag any PR introducing non-canonical licensing language that could undercut substrate-not-license commitment. Composes with `tools/lint/safety-clause-audit.sh`.

### 13. Mirror+beacon-symmetric — HUMAN

**What's mechanized today**: nothing direct; this is an architectural-judgment property.

**Why HUMAN, not gap**: mirror-vs-beacon is a register/style property of substrate output. Whether prose is "mirror-grade" (faithful preservation) or "beacon-grade" (publishable claim) is human-judgment grounded in the conversion-quality test (PR 1673 clean-mirror-not-curating-validator + the bidirectional-alignment razor-discipline). Mechanizing this would be category error — we'd be asking the substrate to judge its own register, which is exactly the failure mode the discipline guards against.

**Possible partial mechanization**: lint that flags load-bearing claims without source-citation (Otto-364 search-first-authority assertion). This catches the easy-mode beacon-claim-without-evidence, leaves the harder register judgments to humans.

## Summary table

| # | Property | State | Existing infrastructure | Gap-closing extension | Upstream candidate |
|---|---|---|---|---|---|
| 1 | Deterministic simulation | GREEN | FsCheck Property + TLA+ ChaosEnvDeterminism + multi-seed tests | Substrate-wide DST-replay harness | DST-replay extension for FsCheck |
| 2 | Scale-free | YELLOW | BenchmarkDotNet | Scale-axis assertion in BenchmarkDotNet | BenchmarkDotNet scale-free assertion extension |
| 3 | Lock-free | YELLOW | TLA+ + Stryker + some property tests | `[<LockFree>]` attribute + Roslyn analyzer | Roslyn analyzer for .NET community |
| 4 | Low allocation | GREEN | tests/Tests.FSharp/Runtime/Allocation.Tests.fs + MemoryDiagnoser | Per-API allocation budget regression-detector | BenchmarkDotNet CI-baseline-regression-detector |
| 5 | DBSP-native | YELLOW | tools/tla/specs/DbspSpec.tla + F# types + Lean4 | `IDbspNative` interface + cross-check | F# `IDbspNative` typeclass pattern → Feldera/DBSP project |
| 6 | Mercer-closed | RED | None explicit | Lean4 Mathlib Mercer-theorem formalization + per-kernel proof | Lean Mathlib kernel-theory contribution |
| 7 | ε-bounded with C(ε) | YELLOW | Z3Verify + TLA+ | `[<EpsilonBounded>]` attribute + Z3 cross-check | Composes with above |
| 8 | BFT-resolvable / conceded | YELLOW | TLA+ BFT specs + Z3 | `IBftResolvable` vs `IConcessionPrimitive` typeclass | Composes |
| 9 | Universal-register-as-MDL | RED | None | Information-theoretic substrate-MDL audit | Algorithmic info theory + Bayesian model selection |
| 10 | Retractable-blast-radius | YELLOW | Z3 + TLA+ + per-DS tests | Blast-radius DAG audit | Composes |
| 11 | Glass-halo-open | GREEN | Multiple hygiene scripts + CodeQL | Minor (clandestine-pattern detection) | Composes with CodeQL |
| 12 | Anti-clandestine | GREEN | audit-machine-specific-content + check-archive-header-§33 + CodeQL + Scorecard | Licensing-clause audit | Composes |
| 13 | Mirror+beacon-symmetric | HUMAN | n/a (judgment-based; mechanization = category error) | Lint for load-bearing-claim-without-citation | Composes with Otto-364 |

**Summary counts**: 4 GREEN (rows 1, 4, 11, 12), 6 YELLOW (rows 2, 3, 5, 7, 8, 10), 2 RED (rows 6, 9), 1 HUMAN (row 13). Total 4+6+2+1 = 13 ✓. About 77% of the conjunction (4 GREEN + 6 YELLOW = 10 of 13) has at least partial mechanization today; the gap-closing work is bounded and tractable.

## Honest limits — what I cannot do here

1. **The conjunctive-completeness defense (PR 1680 architectural claim)** requires ALL 13 properties hold at ALL composition layers, not just at primitive level. Even with all 13 properties mechanized at primitive level, we don't have substrate-wide composition verification. Lean4 + TLA+ together can express this but no tool synthesizes the full conjunction.

2. **Some YELLOW→GREEN transitions require new framework work** (Roslyn analyzer for lock-free, Lean Mathlib for Mercer-closure). These are larger projects than typical CI extension; they're substrate-graduation work.

3. **The two RED items (Mercer-closed + Universal-register-as-MDL)** are research-grade. Mechanizing them well is a publishable contribution, not a small CI tweak.

4. **Mirror+beacon-symmetric (HUMAN)** is intentionally not mechanized. Trying to mechanize the register-judgment would invert the discipline — we'd be teaching the substrate to judge its own publication-fitness, which is exactly the bidirectional-alignment razor-discipline anti-pattern.

5. **My survey is point-in-time at commit a7f4d71 (PR 1680 merged)**. Project-state can change; future audits should re-grep before relying on these findings.

## Upstream-contribution candidates (per shared-stewardship discipline)

Per Aaron's framing *"lets be a good citizen and teach everyone though shared stewardship of our dependies with upstream enhancements"* + GOVERNANCE.md §23 upstream-contribution workflow:

| Tool/dependency | Contribution type | Effort estimate | Why it benefits the community |
|---|---|---|---|
| **BenchmarkDotNet** | Scale-free assertion extension (axis-spanning complexity-class assertion) | M | Many .NET projects benchmark; few assert complexity-class; useful broadly |
| **BenchmarkDotNet** | CI-baseline-regression-detector for allocation | S | Common need; current users hand-roll baseline tracking |
| **FsCheck** | DST-replay extension (record-replay-byte-equal) | M | Property-based testing community values determinism; this is a substrate-graduation of multi-seed tests |
| **FsCheck** | Concurrent-thrash stress-testing for lock-free properties | M | Composes with TPL/concurrent-collections testing |
| **Lean Mathlib** | Mercer's theorem + kernel composition closure | L | Research-grade contribution; foundational for ML-substrate libraries |
| **Lean Mathlib** | Mercer-closure typeclass for ML kernels | L | Practical follow-on |
| **Roslyn analyzers** | `[<LockFree>]` attribute + analyzer for .NET community | M | C#/F# concurrent-data-structure libraries would benefit |
| **Feldera/DBSP project** | F# `IDbspNative` typeclass pattern + audit | M | DBSP is the upstream Zeta builds on; giving back F# tooling makes DBSP more accessible to .NET community |

**Sequencing recommendation**: BenchmarkDotNet allocation-baseline (S, immediate value, smallest scope) → BenchmarkDotNet scale-free assertion (M) → FsCheck DST-replay (M) → Roslyn `[<LockFree>]` (M) → Feldera F# tooling (M) → Lean Mathlib Mercer-closure (L). Lean Mathlib at the end because it's the largest scope and has the longest review cycle.

## Composes with

- `memory/feedback_hodl_invariants_13_properties_composed_at_all_layers_bft_under_governance_not_hash_plus_1_aaron_2026_05_05.md` (PR 1680) — the 13 hodl-invariant properties this audit is mapping to
- `memory/feedback_loss_primitive_zeta_economics_concession_at_substrate_level_spectral_residue_chaos_internal_itron_nation_state_provenance_aaron_2026_05_05.md` (PR 1679) — concession-as-signature primitive type
- `memory/feedback_zeta_aot_or_jit_self_contained_binary_makes_project_state_search_substrate_grade_not_discipline_grade_aaron_2026_05_05.md` (PR 1678) — substrate-graduation pattern applied to project-state-search; same pattern applies to audit framework
- `memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md` — project-state-grep as first-class search surface (this audit IS an application of that)
- GOVERNANCE.md §23 — upstream-contribution workflow
- `memory/feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md` — absorb AND contribute back

## Carved sentence

> *Of the 13 hodl-invariant properties, 4 are mechanized today (DST + low-allocation + glass-halo + anti-clandestine); 6 have partial coverage with bounded closeable gaps; 2 are research-grade (Mercer-closure + universal-register-as-MDL); 1 is intentionally human-judgment (mirror+beacon-symmetric, where mechanization would be category error). The conjunctive-completeness defense gets stronger with mechanization but cannot be fully automated; substrate-graduation pattern applies to the audit framework itself. Upstream-contribution candidates exist across BenchmarkDotNet, FsCheck, Lean Mathlib, Roslyn, and Feldera/DBSP — shared stewardship per GOVERNANCE.md §23.*

## Daylight-integration hooks (planned)

- Backlog rows (one per substrate-graduation candidate): B-NNNN P1 hodl-invariant audit framework + 8 child rows for the upstream-contribution candidates
- B-NNNN P2 Lean Mathlib Mercer's-theorem contribution (largest scope; explicit upstream PR target)
- B-NNNN P2 FsCheck DST-replay extension (composes with our existing TLA+ ChaosEnvDeterminism work)
- ALIGNMENT.md cross-reference: hodl-invariant audit framework as alignment-frontier substrate property (mechanization of substrate-graduation is itself substrate-graduation)
- Cross-reference with PR 1670 (aperiodic-tile + Spectre lineage) for the Mercer-closure foundations
