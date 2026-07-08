# Multi-Agent Collision Resolution Protocol

This protocol defines the procedures for handling, synthesizing, and resolving duplicate or overlapping implementations developed concurrently by independent agents in the Zeta codebase.

## 1. Context and Philosophy

In a decentralized, multi-agent development environment, agents often work asynchronously on overlapping backlog items. When two agents implement solutions for the same task (a "collision"):
1. **Redundancy is an opportunity**: Overlapping implementations are not errors; they represent independent verifications of the design space.
2. **Synthesis is superior**: Rather than performing a simple "git merge" or discarding one implementation, we evaluate both approaches and combine their strengths to produce a 3rd version that is more correct, general, and robust than either alone.

## 2. Synthesis Protocol (Step-by-Step)

When a collision is detected:
1. **Locate both implementations**: Compare the code structures, tests, and design paradigms.
2. **Evaluate Strengths**:
   - **Architectural Integration**: Identify which implementation better integrates with existing codebase abstractions (e.g., using core libraries, interfaces, and factor graphs).
   - **Generality of Domain**: Identify which implementation is mathematically or logically more general (e.g., supporting arbitrary feature dimensions vs. scalar stubs).
   - **Validation Coverage**: Compare the unit test suites for coverage, edge cases, and statistical/property-based verification.
3. **Formulate the 3rd Synthesis**:
   - Design a unified API that preserves **backward compatibility** with both agents' downstream work.
   - Refactor the code to combine the architectural correctness of one with the domain generality of the other.
4. **Merge and Verify**: Replace the collision branches with the synthesized 3rd version and run the full test suite.

---

## 3. Case Study: Minimal BNN Cell Collision (2026-07-08)

An actual collision occurred on workitem `081KWQS2PN608QG0R002CXSBG0` (Minimal BNN cell) between:
- **Agent A (Gemini 2.5 Antigravity)**: Created `BnnCell.fs`.
- **Agent B (Cursor + Grok)**: Created `MinimalBnn.fs`.

### Comparison Analysis

| Metric | Agent A (Gemini) | Agent B (Cursor/Grok) |
| :--- | :--- | :--- |
| **Design Paradigm** | Stateful class neuron (`BnnNeuron`) | Purely functional, immutable record (`State`) |
| **Architectural Integration** | Direct mathematical update loop | Integrated with core `FactorGraph` and `Factor` primitives |
| **Generality of Domain** | **Arbitrary feature inputs** $y = w \cdot x + \epsilon$ (true linear regression) | **Fixed inputs** $x = 1.0$ (mean tracking only) |
| **Error Handling** | Throws `ArgumentException` | Monadic `Result` propagation (`tryCreate` / `infer`) |

### The Synthesized 3rd Version
The synthesized version (implemented in `MinimalBnn.fs`):
1. **Functional State**: Retains Agent B's immutable `Result`-returning structure.
2. **Factor Graph Integration**: Retains Agent B's use of `FactorGraph<Gaussian>`.
3. **True Linear Regression**: Upgrades the likelihood factor representation to support arbitrary input features $x$, solving Agent A's update equations exactly inside the factor graph:
   - Precision: $\tau_{likelihood} = \frac{x^2}{\sigma^2}$
   - Precision-mean: $\nu_{likelihood} = \frac{x y}{\sigma^2}$
4. **API Backward Compatibility**: Keeps the $x=1.0$ `update` signature for backward compatibility, while exposing `updateWithFeature` for general regression.
