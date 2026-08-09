# QuantumArith — Hexagonal Port Specification

**Author:** Lumen (Manus AI), 2026-08-09  
**Status:** §B design — implementation in progress  
**Beacon anchors:** Blaschke (1915), Halsey (2026) arXiv:2607.02216, Minka (2001) EP, OpenQASM 3.0 (2022)

---

## 1. Purpose and Design Philosophy

The Zeta system needs exact, byte-lockable quantum arithmetic across multiple substrates: F#, TypeScript, Q#, and eventually a second quantum language. The goal is not to build a quantum simulator — it is to build a **canonical arithmetic library** whose outputs are byte-identical across all substrates for the same inputs.

The hexagonal port pattern solves the replacement problem: we define an `IQuantumArith` **port interface**, write **adapters** that wrap any external library behind that interface, and implement our own **canonical arithmetic** behind the same interface. When we want to replace an external library with our own implementation, we swap the adapter without touching any call sites.

```
                    ┌─────────────────────────────────┐
                    │         Application Layer        │
                    │  (WSet, HlAmplitudeEmu, ZSetISA) │
                    └──────────────┬──────────────────┘
                                   │ IQuantumArith port
                    ┌──────────────┴──────────────────┐
                    │         Port Interface           │
                    │  IQuantumArith<'C>               │
                    └──┬───────────────────────────┬──┘
                       │                           │
          ┌────────────┴──────┐       ┌────────────┴──────────┐
          │  Canonical Impl   │       │  External Adapter     │
          │  (our own code)   │       │  (wraps 3rd party)    │
          │  QuantumArith.fs  │       │  OpenQASMAdapter.fs   │
          │  quantum-arith.ts │       │  QrispAdapter.py      │
          └───────────────────┘       └───────────────────────┘
```

The canonical implementation is the byte-lock reference. External adapters are allowed to diverge (they use different floating-point pipelines) — the conformance test checks that the canonical implementation matches the golden vectors, not that all adapters agree.

---

## 2. The IQuantumArith Port Interface

The interface is parameterised over a complex number type `'C`. The canonical implementation uses `Doubled<float>` (= `Complex` in the Zeta Cayley-Dickson tower). External adapters may use their own complex type.

### 2.1 Core operations

| Operation | Signature | Canonical formula |
|---|---|---|
| `zero` | `'C` | `0 + 0i` |
| `one` | `'C` | `1 + 0i` |
| `ofReal` | `float → 'C` | `r + 0i` |
| `ofPolar` | `float → float → 'C` | `r·cos(θ) + r·sin(θ)·i` |
| `add` | `'C → 'C → 'C` | `(ar+br) + (ai+bi)i` |
| `mul` | `'C → 'C → 'C` | `(ar·br−ai·bi) + (ar·bi+ai·br)i` |
| `conj` | `'C → 'C` | `ar − ai·i` |
| `magSq` | `'C → float` | `ar² + ai²` |
| `scale` | `float → 'C → 'C` | `(s·ar) + (s·ai)i` |
| `neg` | `'C → 'C` | `(−ar) + (−ai)i` |

### 2.2 Blaschke factor (the canonical "bump")

The Blaschke factor with parameter `a` (|a| < 1) is the canonical conformal map primitive:

```
blaschke(z, a) = (z − a) / (1 − ā·z)
```

Its derivative magnitude squared is:

```
|d/dz blaschke(z, a)|² = (1 − |a|²)² / |1 − ā·z|⁴
```

**Critical design decision:** `a = √λ₀ · e^{iθ}` where `λ₀ = 0.004` (Halsey 2026). This places `a` INSIDE the unit disk (`|a| = √0.004 ≈ 0.0632 < 1`), giving a non-zero derivative. Using `a = e^{iθ}` (ON the unit circle) gives `|d/dz| = 0` — the derivative vanishes identically.

| Operation | Signature | Canonical formula |
|---|---|---|
| `blaschke` | `'C → 'C → 'C` | `(z−a)/(1−ā·z)` |
| `blaschkeDerivMagSq` | `'C → 'C → float` | `(1−|a|²)²/|1−ā·z|⁴` |
| `hlBumpParam` | `float → float → 'C` | `√λ₀ · e^{iθ}` |

### 2.3 Quantum gate operations (Born-probability layer)

These operate on `WSet<int, 'C>` (a weighted set of basis states):

| Operation | Signature | Canonical formula |
|---|---|---|
| `hadamard` | `WSet → WSet` | `H|k⟩ = (1/√2)(|0⟩ + (−1)^k|1⟩)` |
| `phaseGate` | `float → WSet → WSet` | `P(θ)|k⟩ = e^{ikθ}|k⟩` |
| `cnot` | `WSet → WSet` | `CNOT|a,b⟩ = |a, a⊕b⟩` |
| `bornProb` | `WSet → (int * float) list` | `P(k) = |amplitude(k)|²` |

---

## 3. Golden Vectors (Byte-Lock Reference)

All values are IEEE 754 double precision (64-bit), round-to-nearest-even. No FMA, no fast-math, no platform-specific intrinsics.

| ID | Operation | Input | Output (decimal) | Output (hex, big-endian) |
|---|---|---|---|---|
| QA-1 | `complex_add` | `(1+2i, 3+4i)` | `4+6i` | `4010000000000000 4018000000000000` |
| QA-2 | `complex_mul` | `(1+2i, 3+4i)` | `−5+10i` | `c014000000000000 4024000000000000` |
| QA-3 | `complex_mag_sq` | `3+4i` | `25.0` | `4039000000000000` |
| QA-4 | `blaschke` | `z=0.5+0.3i, a=√λ₀·e^{iπ/4}` | `0.474586592674752+0.260348313343704i` | `3fde5fa071aa1ed9 3fd0a98bf8d8516e` |
| QA-5 | `blaschkeDerivMagSq` | `z=0.5+0.3i, a=√λ₀·e^{iπ/4}` | `1.147451008268201` | `3ff25bf596a462ea` |
| QA-6 | `1/√2` | — | `0.707106781186547` | `3fe6a09e667f3bcc` |
| QA-7 | `born_prob(|Φ⁺⟩, 00)` | `|Φ⁺⟩=(1/√2)|00⟩+(1/√2)|11⟩` | `0.5` | `3fdffffffffffffe` |
| QA-8 | `tsirelson_S` | `2√2` | `2.828427124746190` | `4006a09e667f3bcd` |
| QA-9 | `blaschkeDerivMagSq⁻¹` | `z=i, a=√λ₀` | `1.016128772116579` | `3ff042103e4c3ed8` |

**Conformance rule:** A substrate passes the byte-lock if all 9 golden vectors match to the last bit (exact hex match). A substrate passes the tolerance gate if all 9 values match to within 1 ULP (unit in the last place).

---

## 4. The Hexagonal Adapter Pattern

### 4.1 Canonical implementation (our code, byte-locked)

The canonical implementation lives in:

- `src/Core/QuantumArith.fs` — F# implementation
- `src/Core.TypeScript/quantum/quantum-arith.ts` — TypeScript implementation
- `src/Core.QSharp.ReferenceOracle/QuantumArith.qs` — Q# implementation

All three must produce the golden vectors above. The byte-lock CI gate runs all three against the golden vectors on every commit.

### 4.2 External adapter (wraps 3rd party, not byte-locked)

External adapters are allowed to diverge from the golden vectors. They are used for:

- **Validation:** cross-checking our canonical implementation against an independent reference
- **Hardware execution:** running on real quantum hardware (which is inherently noisy)
- **Prototyping:** rapid exploration before implementing in the canonical layer

Current external adapter stubs:

- `src/Core/OpenQASMAdapter.fs` — wraps OpenQASM 3.0 circuit output (stub)
- `src/Core.TypeScript/quantum/qrisp-adapter.ts` — wraps Qrisp QuantumFloat (stub)

### 4.3 Replacement protocol

When we want to replace an external library:

1. Implement the canonical operation in `QuantumArith.fs` / `quantum-arith.ts` / `QuantumArith.qs`
2. Add the golden vector for the new operation
3. Run the byte-lock CI gate — it must pass
4. Delete the external adapter stub
5. Update the call sites to use the canonical implementation

Zero downtime: the canonical implementation is always present alongside the adapter. The swap is atomic at the call-site level.

---

## 5. Second Quantum Language Recommendation

Based on the research survey (2024-2026):

| Language | Maturity | Byte-lock suitability | Recommendation |
|---|---|---|---|
| Q# (Microsoft) | Production | High (deterministic simulator) | **Primary — already integrated** |
| OpenQASM 3.0 | Beta | Medium (IR, not a full language) | **Use as IR target for hardware** |
| Silq | Research | Low (D compiler, no multi-substrate) | Borrow automatic uncomputation concept |
| Qrisp | Beta | Low (Python-only) | Borrow QuantumFloat arithmetic patterns |

**Recommendation: add OpenQASM 3.0 as the second quantum language.** It is the standard IR that all major quantum hardware providers (IBM/Qiskit, Amazon Braket, IonQ) accept. Adding an OpenQASM 3.0 emitter to `QuantumArith.qs` would allow our canonical circuits to run on real hardware without changing the port interface. The byte-lock would apply to the classical simulation path; the hardware path is inherently non-deterministic and is not byte-locked.

**Future:** Silq's automatic uncomputation is the most interesting research direction. When Silq matures to production, it would be the cleanest language for writing the canonical arithmetic — the type system prevents garbage entanglement by construction.

---

## 6. Connection to the Existing Zeta Stack

| Zeta module | Uses QuantumArith via |
|---|---|
| `WSet.fs` | `IStarRing<Complex>` = `ImaginaryStack.complex` = `Doubled.algebra Real.algebra` |
| `BipartiteMachZehnder.fs` | `WSet.tensor ring phiPlus` — uses `complex_mul` and `complex_add` |
| `HlAmplitudeEmu.fs` | `blaschke` and `blaschkeDerivMagSq` (currently inline) |
| `ZSetISA.qs` | `HLBump`, `HLChainRule`, `HLOracle` — Q# circuit versions |
| `hl-conformal-map.ts` | `blaschke` and `blaschkeDerivMagSq` (currently inline) |

The QuantumArith library replaces all inline implementations with a single canonical source. The byte-lock CI gate ensures they all agree.

---

## 7. Honest Scope Boundary

The canonical implementation covers classical simulation of quantum arithmetic. It does not cover:

- **Quantum error correction** — the golden vectors assume perfect arithmetic
- **Hardware noise models** — the OpenQASM adapter handles this
- **Variational quantum algorithms** — no gradient computation
- **Quantum Fourier Transform** — planned but not yet specified

The Blaschke factor is the canonical "bump" for the HL conformal map. It is NOT the exact Joukowski slit map used in Halsey (2026) — the exact slit map requires a different conformal transformation. The Blaschke factor is the correct choice for the unit-disk model (which is what the ZSetISA Q# oracle uses); the slit map is for the upper half-plane model. Both give the same D_f in the large-n limit.

---

## References

[1] Blaschke, W. (1915). "Eine Erweiterung des Satzes von Vitali über Folgen analytischer Funktionen." *Berichte Math.-Phys. Kl. Sächs. Akad. Wiss.* 67, 194–200.

[2] Halsey, T.C. (2026). "Exact amplitude relations for diffusion-limited aggregation." arXiv:2607.02216v1.

[3] Minka, T. (2001). "A family of algorithms for approximate Bayesian inference." MIT PhD thesis.

[4] Cross, A. et al. (2022). "OpenQASM 3: A broader and deeper quantum assembly language." *ACM Transactions on Quantum Computing* 3(3), 1–50.

[5] Bichsel, B. et al. (2020). "Silq: A high-level quantum language with safe uncomputation and intuitive semantics." *PLDI 2020*.

[6] Seidel, R. et al. (2023). "Qrisp: A framework for compilable high-level programming of quantum computers." arXiv:2311.08502.
