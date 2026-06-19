# Formal verification strategy

Zeta implements a multi-tier formal verification strategy where each component is validated using the formal proof or analysis system optimized for its mathematical domain. All verification tools are integrated into the repository as first-class anchors.

| Tool | Covers | Runs in CI? | Key File(s) / Directories |
|---|---|---|---|
| **Lean 4** (interactive theorem prover) | Strict functional correctness, type theory, and serialization round-trip bijection proofs | ✓ (via `lake build`) | `src/Core.Lean4/` |
| **TLA+ / TLC** (temporal logic model checker) | Concurrent-protocol safety/liveness invariants and state-space interleavings | ✓ (via TLC spec verification) | `tools/tla/specs/` |
| **Alloy** (relational constraint solver) | Declarative structural specifications, relational schemas, and layout invariants | ✓ (via Java/TS Alloy runners) | `src/Core.Alloy/` |
| **Z3 SMT solver** | Pointwise algebraic axioms over unbounded domains | ✓ (xUnit shells to `z3`) | `tests/Tests.FSharp/FormalVerificationTests.fs` |
| **FsCheck** (property-based testing) | Algebraic laws, randomized fuzzing, and concrete implementation regressions | ✓ (xUnit) | `tests/Tests.FSharp/FuzzTests.fs` |

---

## The Verification Ecosystem

### Lean 4 for Functional Soundness and Codec Bijection

Lean 4 provides interactive, machine-checked proofs of functional correctness. It verifies that data schemas and serialized outputs form mathematical bijections.
For example, for the JSON, CBOR, and YAML codecs, Lean 4 proves:
```lean
theorem yaml_roundtrip : ∀ v, IsRepresentableInYaml v → fromYaml (toYaml v) = some v
```
This guarantees that no valid runtime state can produce non-deserializable representations.

### TLA+ for Concurrency and Protocols

Concurrency-critical operations (such as distributed logs, consensus protocols, and asynchronous worker pools) are subject to state-space verification under arbitrary scheduler interleavings. TLA+ model checking ensures that temporal safety ("bad things never happen") and liveness ("good things eventually happen") hold across all reachable execution states.

### Alloy for Structural Invariants

Alloy models the structural invariants of state databases, key-value stores, and index hierarchies. Using first-order logic and relational calculus, Alloy analyzes structural layouts and relations to verify invariants or locate minimal counterexamples.

### Z3 for Pointwise Algebraic Axioms

Pointwise algebraic properties (e.g., Z-set addition commutativity, associativity, and identity) are checked symbolically over unbounded domains using the Z3 SMT solver. UNSAT results demonstrate that these axioms hold universally without restricting verification to finite model sizes.

### FsCheck for Concrete Implementation Parity

FsCheck generates millions of adversarial test cases to verify that concrete implementations in the runtime languages match the formal algebraic models and do not suffer from off-by-one errors, memory overflows, or range bounds violations.

---

## Running Verification Locally

```bash
# 1. Lean 4 proof compilation
cd src/Core.Lean4
lake build

# 2. Alloy specification checks
bun run tools/formal-verification/run-alloy.ts --all

# 3. Z3 symbolic verification
dotnet test tests/Tests.FSharp -c Release --filter "FullyQualifiedName~FormalVerificationTests"

# 4. TLA+ concurrent protocols model checking
java -cp tla2tools.jar tlc2.TLC -config tools/tla/specs/SpineAsyncProtocol.cfg tools/tla/specs/SpineAsyncProtocol.tla
```
