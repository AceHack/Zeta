# Handoff: Phase 5 Quantum Research → Soraya / Math Team

Date: 2026-06-21
From: Alexa (codegen)
To: Soraya (formal verification) + research team
Status: summoned (timed out at 16min — deep research, will pick up next tick)

## Context

Phases 1-4 of ci-full-verification-gate complete on main:

- All 7 toolchains provisioned (Rust in mise, smoke check)
- full-verify CI job live with alerting
- Clifford cross-language byte-lock (3 langs agree)
- Cost annotations on soft-mix + Rx hot paths

## Three research deliverables

### 1. Quantum Persistent Log

Map the durable log (InMemoryDeltaLog / GitDeltaLog) onto a persistent quantum state
or gen(gen) pipeline in Q#.

- Append-only, order-preserving
- gen(gen) pipeline IS the persistence: IR describes log structure, generator reproduces entries
- Round-trip: encode(entry) → pipeline → decode = entry
- Target: `src/Core.QSharp.ReferenceOracle/QuantumPersistentLog.qs`

### 2. Quantum Transaction Ports

Express CALM/CRDT boundaries as Q# quantum ports.

- Monotone-safe operations (CRDT merge, GSet join) = `is Adj` (reversible = safe)
- Non-monotone operations (requiring coordination) = need control qubit (`is Ctl`)
- Confluence: CRDT port operations commute regardless of order
- Target: `src/Core.QSharp.ReferenceOracle/QuantumTransactionPorts.qs`

### 3. Maxwell's Demon Heat Tracking (Aaron's key insight)

The quantum lane must track heat (entropy/information cost) as precisely as
CHIP-8's soft lane tracks support growth.

**The parallel:**

- CHIP-8 AmplitudeEmu: tracks `support` = number of frames with nonzero amplitude
- SparseQuantumSim: tracks `support()` = same metric
- Both = "how many bits of uncertainty exist right now"

**The extension (Aaron wants):**

- Every `branch` (Hadamard) = +1 bit of entropy (uncertainty introduced)
- Every `measure` = -1 bit of entropy (Landauer: erasing 1 bit costs kT ln 2 heat)
- Track per-operation: `{entropy_bits_introduced, entropy_bits_consumed, net_entropy}`
- Same pattern as CHIP-8 tracks `{support_before, support_after, delta_support}`
- The WeakRef/collection pattern: GC collecting generated code = entropy discharge

**Questions for the research team:**

1. Can Landauer's bound (kT ln 2 per erased bit) be a cost contract in our framework?
2. Is counting entropy bits sufficient, or do we need von Neumann entropy (density matrix)?
3. How does entropy compose with the tropical semiring cost model? (entropy is additive → fits)
4. Implementation: extend SparseQuantumSim with entropy tracking, or separate injected effect?

**Anchors:**

- Landauer 1961 (irreversibility and heat generation in computing)
- Bennett 1973 (reversible computation — no heat for reversible ops)
- Maxwell's demon → Szilard engine → information-theoretic entropy
- The repo's existing: cost-counter.ts (injected ring-op counter), AmplitudeEmu.support

## Priority

P2 — research/design phase. The ground system (cost counter + cross-verify) is live.
These are the "quantum-native" extensions that make the system physically correct.

## Discipline

- Design note first (docs/research/)
- Q# function signatures second
- Lean proof of Landauer bound (if expressible) = deferred escalation
- Must integrate with existing cost-counter pattern (injected effect, not ambient mutable)

## Follow-up: Aaron's Adj correction (2026-07-02)

Soraya corrected CALM → Ctl (correct for coordination). But Aaron's original Adj
framing was describing a DIFFERENT axis: **simulating measurement without collapse**.

### Three axes, not two

| Axis | Q# Functor | Meaning | Example |
|------|-----------|---------|---------|
| Coordination | `Ctl` | Needs consensus (non-monotone) | Transaction commit |
| Reversible observation | `Adj` | Can peek without destroying (soft measurement) | bornProb, snap |
| Both | `Adj + Ctl` | Full Clifford gate | CNOT, Hadamard |

### The demon's two operations

- **READ** = free (Adj, reversible peek, support unchanged, zero heat)
  - This IS AmplitudeEmu.bornProb — reads probabilities without collapsing
  - Adjointable because nothing was erased

- **ERASE** = costly (non-Adj, branch erasure, support drops, Landauer heat paid)
  - This IS measurement/collapse/snap/commit
  - Non-adjointable because information was irreversibly destroyed

### The gate between ledgers

The `Adj` functor IS the gate between Ledger A (support/state) and Ledger B (heat/environment):

- `Adj` ops stay in Ledger A (reversible, no heat, the demon reads for free)
- Non-`Adj` ops discharge from A to B (irreversible, heat paid, the demon erases)

### Entropy tracker update needed

```
{
  soft_observations: number,    // Adj reads (free, no heat)
  hard_measurements: number,    // non-Adj collapses (Landauer heat)
  entropy_state: number,        // Ledger A: bits of uncertainty in state
  entropy_heat: number,         // Ledger B: bits dissipated to environment
  net_second_law: number,       // entropy_state + entropy_heat ≥ 0 (always)
}
```

Summoned Soraya with this correction (timed out — will pick up on next tick).
