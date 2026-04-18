# Formal verification strategy

Three independent oracles, each using the right tool for its problem.

| Tool | Covers | Runs in CI? | File(s) |
|---|---|---|---|
| **FsCheck** (property-based tests) | Algebraic laws over generated Z-sets + pipelines | ✓ (xUnit) | `tests/Tests.FSharp/FuzzTests.fs` |
| **Z3 SMT solver** | Pointwise axioms over **unbounded integers** | ✓ (xUnit shells to `z3`) | `tests/Tests.FSharp/FormalVerificationTests.fs` |
| **TLA+ / TLC** | Concurrent-protocol invariants (interleavings) | Manual (optional) | `tools/tla/specs/SpineAsyncProtocol.tla` |

## Why each tool where

**Z3 for pointwise axioms.** Given a claim like
`∀ a, b, c ∈ ℤ. (a + b) + c = a + (b + c)`, we negate it and ask Z3
`check-sat`. UNSAT = proof over all integers. Each axiom takes ~5 ms;
we run 8 of them as xUnit tests on every `dotnet test`. This is
strictly stronger than finite enumeration: Z3 reasons symbolically
over the integer theory, not a bounded domain.

**TLA+ for concurrent protocols.** The `SpineAsync` producer/worker
protocol has threads racing over counters and channel writes. The
invariant "every sent batch is eventually processed" isn't a pointwise
theorem — it's a temporal property over interleavings of two threads'
steps. Z3 can't express that naturally; TLC's BFS enumeration of
reachable states is the canonical approach. Running it found 15
distinct states across a 4-batch model; all invariants hold.

**FsCheck for the rest.** Property-based testing explores larger
concrete domains than either formal tool and catches concrete
implementation bugs (off-by-one in consolidate, bad array indexing,
etc.). The algebraic laws check for free (FsCheck generates adversarial
Z-sets and pipelines).

## `tools/tla/specs/DbspSpec.tla` status

An earlier pass encoded the pointwise axioms in TLA+ and model-checked
them on 1 million states. It's kept as **human-readable documentation**
(the TLA+ syntax is cleaner than SMT-LIB for math-first readers) but
**not run in CI** because Z3 already proves everything stronger. If
you edit the algebra and want a quick visual sanity check, open the
`.tla`; if you want machine verification, run the Z3 xUnit tests.

## Running each manually

```bash
# Z3 (runs automatically under dotnet test)
dotnet test tests/Tests.FSharp -c Release \
    --filter "FullyQualifiedName~FormalVerificationTests"

# TLA+ protocol spec
java -cp tla2tools.jar tlc2.TLC -config tools/tla/specs/SpineAsyncProtocol.cfg \
    tools/tla/specs/SpineAsyncProtocol.tla

# TLA+ pointwise axiom spec (documentation)
java -cp tla2tools.jar tlc2.TLC -config tools/tla/specs/DbspSpec.cfg \
    tools/tla/specs/DbspSpec.tla
```
