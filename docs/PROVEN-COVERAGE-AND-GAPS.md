# Proven coverage & gaps — full 7-lang matrix & formal proof audit

*Honest by construction: premise-conditional legs are NAMED, not hidden; "seed" = built-but-not-yet-fully-ported. Languages: **F# · C# · Rust · TypeScript · Python · Go · Q#**.*

---

## 1. The floor — 6/6 FULL PROVEN (`PROVEN ⟺ math ∧ matrix-runtimes ∧ serializers ∧ Bonsai ∧ Arrow ∧ homeostat`)

| # | Primitive | Formal Proof | Matrix Runtimes | Serializers | Bonsai | Arrow | homeostat-tie | verdict |
|---|-----------|:------------:|:---------------:|:-----------:|:------:|:-----:|---------------|---------|
| 1 | **CRDT merge / G-Set** | ✓ (Z3/FsCheck) | ✓ (7-lang) | ✓ | ✓ | ✓ | semilattice → converge-to-LUB | ✅ FULL |
| 2 | **Identity / ZetaId** (local-handle) | ✓ (Z3/FsCheck) | ✓ (7-lang) | ✓ | ✓ | ✓ | dedup (injective + idempotent) | ✅ FULL |
| 3 | **Merkle integrity** | ✓ (Z3/Crypto) | ✓ (7-lang) | ✓ | ✓ | ✓ | integrity → verify converged state | ✅ FULL |
| 4 | **Clock / Versionstamp** | ✓ (Z3/FsCheck) | ✓ (7-lang) | ✓ | ✓ | ✓ | semilattice → max-convergence | ✅ FULL |
| 5 | **Serialization-seed / ByteCost** | ✓ (Z3/FsCheck) | ✓ (7-lang) | ✓ | ✓ | ✓ | commutative monoid → order-indep aggregate | ✅ FULL |
| 6 | **Metric / Bloom+CountMin** | ✓ (Z3-verified) | ✓ (7-lang) | ✓ | ✓ | ✓ | Bloom OR=semilattice, CMS add=monoid | ✅ FULL |

**Premise-conditional legs:** Merkle tamper-evidence holds *modulo* a crypto-strength hash (ships 128-bit XXH3, non-crypto); Metric ε/δ holds *modulo* uniform/pairwise-independent hashing + Markov + row-independence (the standard CMS premises, Z3-verified to *follow* from them).

---

## 2. Serializer formats × 7 languages (the DynamicValue codec surface)

| format | F# | C# | Rust | TS | Python | Go | Q# | status |
|--------|:--:|:--:|:----:|:--:|:------:|:--:|:--:|--------|
| **JSON** (self-describing) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **DynamicValue byte-locked (4/7)**; Python/Go have canonical JSON helpers, not DynamicValue codecs |
| **CBOR** (self-describing, total 8/8 shapes) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **Byte-locked (4/7)** |
| **XML** (typed-element) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **Byte-locked (4/7)** |
| **YAML** (safe-subset) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **DynamicValue byte-locked (4/7)**; Python/Go have event scanners, not DynamicValue codecs |
| **Arrow** (columnar) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | **2/7 — F#+C# only** (shared .NET `Apache.Arrow`) |
| **protobuf** (schema-REQUIRED) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **0/7 — not present** (needs runtime schema registry) |

---

## 3. Supporting primitives × 7 languages

| primitive | F# | C# | Rust | TS | Python | Go | Q# | note |
|-----------|:--:|:--:|:----:|:--:|:------:|:--:|:--:|------|
| DynamicValue (carrier) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | 4/7; Python/Go ports need carriers plus golden-vector codec tests |
| TriBoolean (+ float) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | 4/7 |
| Bonsai (reified computation) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | 4/7 |
| Yaml events · Sha256 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | 6/7 helpers; Python/Go do not yet lift them through DynamicValue |
| RangeSet | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | 4/7 |
| Observe · AceCanonical · Resume | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | 3/7 — no TS |
| Algebra | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | 2/7 — F#+Rust |

### New seeds (built, F#-only — 1/7)

- **Predicate3 (Kleene K3):** three-valued predicate; UNKNOWN propagates, collapse only at the terminal filter.
- **SchemaEvolution:** versioned migration over DynamicValue; forward/backward-compat.
- **SoftValue:** calibrated value: never-falsely-certain `resolve`; independent-evidence Bayesian `observe` COMMUTES.

---

## 4. Formal Verification soundess checklist

Formal proof and verification targets are mapped explicitly as first-class anchors across all dimensions:

| Dimension / Spec | Lean 4 | TLA+ / TLC | Alloy | Z3 SMT | FsCheck | Proof / Safety Invariant |
|------------------|:------:|:----------:|:-----:|:------:|:-------:|--------------------------|
| **DynamicValue AST & Codecs** | ✓ | ✗ | ✗ | ✗ | ✓ | Correct-by-construction parser bijections and round-trip verification |
| **Sagas & Event-Loop** | ✗ | ✓ | ✗ | ✗ | ✓ | Safety & liveness invariants under concurrent interleavings |
| **Consensus & Data-Flow** | ✗ | ✓ | ✓ | ✓ | ✓ | Structural database invariants and anti-entropy correctness |
| **Algebraic Laws (Z-set)** | ✗ | ✗ | ✗ | ✓ | ✓ | Symbolic proofs of associativity, commutativity, and identity |

---

## 5. GAP LIST

1. **DynamicValue Python + Go carriers/codecs** (4/7 → 6/7, Q# remains oracle-only) — canonical JSON/YAML helpers exist, but not the DynamicValue carrier or golden-vector codec surface.
2. **Arrow in Rust + TS + Python + Go** (2/7 → 7/7) — needs an Arrow codec each.
3. **RangeSet in Python + Go** (4/7 → 6/7) — needs ports plus golden-vector tests.
4. **protobuf / gRPC** (0/7) — schema-required binary format, fits DynamicValue only via the schema-registry.
5. **New seeds Predicate3 / SchemaEvolution / SoftValue: F#-only (1/7)** — port to remaining runtimes in the matrix.
6. **Observe / AceCanonical / Resume: no TS (3/7)**; **Algebra: F#+Rust only (2/7)**.
7. **Belief/SoftValue convergence (general case):** is the *path-dependent* Bayesian uncertainty-merge a join-semilattice?
8. **Premise-unconditional formal legs:** Merkle real-hash analysis; Metric Lean/Mathlib Markov.
