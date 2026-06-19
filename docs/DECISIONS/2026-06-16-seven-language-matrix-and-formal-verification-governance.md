# ADR: 7-Language Matrix and Formal Verification Governance — Correctness, Distribution, and Logical Soundness

**Date:** 2026-06-16

**Status:** PROPOSED — operator-agreed direction (2026-06-16)

This ADR supersedes [ADR: 4-language compiler-BFT governance](2026-05-31-four-language-compiler-bft-governance-axes-per-artifact-gate-golden-vectors-oracle-tiebreak.md). It expands the correctness and distribution matrix from a four-language subset to a unified seven-language matrix (F#, C#, TypeScript, Rust, Python, Go, Q#) and formalizes the roles of three distinct formal verification systems (Lean 4, TLA+, Alloy).

---

## Context

Zeta operates as a multi-runtime, correctness-critical system. Previously, it defined a "four-language compiler-BFT" model (TypeScript, F#, C#, Rust) where compiler parity established bit-perfect data representation. However, Zeta has evolved to natively support Python, Go, and Q# (quantum reference oracle) in its core execution layers, requiring a unified seven-language matrix.

Furthermore, formal proofs are no longer secondary/optional tasks. Verification tools (Lean 4, TLA+, Alloy) serve as first-class anchors that prove functional correctness, concurrency safety, and structural design invariants.

---

## Decision 1 — Seven-Language Matrix Roles and Authority

The seven languages in Zeta serve distinct, non-overlapping roles across two primary axes: correctness (mathematical specifications and proofs) and distribution (execution, integration, and platform capability):

1. **F# (Correctness Core & Spec Reference)**
   - Authoritative for mathematical definitions, core pipelines, and clean-room reference specifications.
   - It acts as the primary target for symbolic verification and is the source from which other language implementations are derived.

2. **TypeScript (Agent & Scripting Distribution Core)**
   - Authoritative for developer tooling, scripting environments, and primary agent harnesses.
   - Deployed natively under Node/Bun.

3. **C# (Enterprise Distribution Core)**
   - Enterprise integration target. Must maintain clean .NET BCL interfaces and compile without F# or external framework leaks.

4. **Rust (Systems & High-Performance Target)**
   - Systems-level runtime target, responsible for zero-overhead primitives, fast FFI boundaries, and WASM compilation.

5. **Python (Data Science & AI Pipeline Target)**
   - Scripting and runtime target for machine learning, data science libraries, and LLM orchestration wrappers.

6. **Go (High-Throughput Services & Distributed Target)**
   - Runtime target for concurrent, low-latency background services and network-heavy systems integrations.

7. **Q# (Quantum Reference Oracle)**
   - Exclusively models reference state-machines and logical state transitions for quantum algorithms and simulation.

---

## Decision 2 — First-Class Formal Verification Tools

Zeta adopts three formal tools, each selected for the mathematical domain it is optimized to model. They are first-class verification dimensions executed in CI/CD alongside runtime tests:

1. **Lean 4 (Type Theory & Functional Proofs)**
   - Used for structural AST representation, codec bijection verification, and round-trip correctness proofs (e.g., JSON, CBOR, YAML serialization).
   - Proves theorems of the form: `∀ v, IsRepresentable v → decode(encode(v)) = some v`.

2. **TLA+ / TLC (Concurrency & Temporal Logics)**
   - Used to model-check state-machine safety and liveness invariants under arbitrary execution interleavings (e.g., consensus layers, async message passing).

3. **Alloy (Declarative Structural & Relational Specifications)**
   - Used to analyze structural constraints, relational schemas, and complex layout properties. Excellent for rapid exploration of structural invariants and finding counterexamples.

4. **Z3 SMT Solver & FsCheck (Pointwise Axioms & Fuzzing)**
   - Z3 proves pointwise algebraic axioms symbolically over unbounded domains. FsCheck conducts fuzzing and property-based regression testing.

---

## Decision 3 — Unified Golden Vector Parity

To ensure that the 7-language matrix does not diverge, the BFT governance is defined as follows:

- **Golden Vectors as the Oracle:** No single language runtime or compiler defines correctness. Alignment is governed by a unified golden-vector seed. Every runtime must decode and encode data to match the seed exactly.
- **No Hodge-Podge Exceptions:** Every primitive must behave identically across all active configurations in which it is defined. Exceptions or special language carve-outs are prohibited to preserve system maintainability.

---

## Consequences

- High-level documentation (such as `VISION.md`, `ROADMAP.md`, and `PRIMITIVE-REGISTRY.md`) is updated to reflect the 7-language matrix and the 3 formal proof tools.
- Verification checks in CI/CD execute Lean proofs (`lake build`), Alloy specs, Z3 pointwise tests, and FsCheck properties to ensure comprehensive soundness.
