# Zeta Lean 4 formalizations

[![Lean Proof CI](https://github.com/Lucent-Financial-Group/Zeta/actions/workflows/lean-proof.yml/badge.svg?branch=main)](https://github.com/Lucent-Financial-Group/Zeta/actions/workflows/lean-proof.yml)

Machine-checked formalizations of Zeta's load-bearing mathematical claims using
[Lean 4](https://leanprover.github.io/) +
[Mathlib](https://leanprover-community.github.io/). The artifact-grade module
`Lean4/DbspChainRule.lean` is fully machine-checked — no `sorry`, no `admit` —
and CI-type-checked against the pinned toolchain on every PR that touches
`src/Core.Lean4/**`. As of 2026-06-05, `ImaginaryStack/ToyModel.lean` (the
Adinkra-as-generator / bulk-from-boundary toy lemma) is **also** machine-checked
and sorry-free — CI type-checks it and runs an axiom audit that fails on
`sorryAx`. Its honest scope (erasure-distance for arbitrary erasure patterns; the
specific generator the multiplication table induces; the continuous lift) is
named in the file header and in `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B.

## Repository layout

| Path | Role |
|------|------|
| `lakefile.toml` | Lake project manifest: lean-toolchain pin + Mathlib pin at matching rev |
| `lean-toolchain` | Pinned Lean 4 toolchain (`leanprover/lean4:v4.30.0-rc1`) |
| `Lean4.lean` | Library root — imports every machine-checked module so `lake build` walks them transitively |
| `Lean4/DbspChainRule.lean` | DBSP chain rule formalization (Budiu et al. arXiv:2203.16684) |
| `Lean4/DynamicValue.lean` | Defines `DynamicValue` AST matching the canonical F# definition, plus tag injectivity proofs |
| `Lean4/JsonCodec.lean` | Simplified JSON AST mapping and structural round-trip proofs for JSON representable subset |
| `Lean4/CborCodec.lean` | Simplified CBOR encoding model and fuel-based round-trip proofs for CBOR representable subset |
| `ImaginaryStack/ToyModel.lean` | Adinkra-as-generator / bulk-from-boundary toy lemma — machine-checked, sorry-free (2026-06-05) |
| `ImaginaryStack/ErasureDistance.lean` | Erasure-correction principle (distance ⇒ any `<d` erasures correctable; distance-5 ⇒ any 12-of-16) **+ a concrete Reed–Solomon `[16,12]` code proven distance-5 / corrects-any-4-erasures** — machine-checked, sorry-free (2026-06-05) |
| `Zeta23/LinAlg/*.lean` | **ADAPTED PORT** of `Zeta23/LinAlg/` from `anthropics/zeta-23-lean` (Apache-2.0, © 2026 Anthropic PBC): von Neumann's trace inequality, Sylvester's law of inertia (Hermitian), the `Q = Q₊ − Q₋` splitting, and the paper's §3 Lemmas 3.1/3.2/3.4. **Not an independent replication — the upstream source was read.** Register, licence compliance and scope: `Zeta23/README.md` + `Zeta23/NOTICE` |
| `Lean4/VonNeumannTraceWitness.lean` | **OURS**, not ported — the anti-vacuity witness for the theorem above: a NON-COMMUTING pair where the bound is strict, an aligned pair where it is attained, an anti-aligned pair strictly below, and a machine-checked refutation of the swapped-pairing mutant. Sorry-freeness cannot check any of these |
| `Privacy/IdentityForcesPrivacy.lean` | Privacy-from-identity *necessity* (Leibniz identity-of-indiscernibles: under public convergence, distinction must live in private state) — pure Lean, **axiom-free**, sorry-free (2026-06-05) |

## Build

```bash
# Install elan + the pinned Lean toolchain (one-time setup) via the
# canonical three-way-parity install script — it installs elan with a
# pinned commit + SHA256 verification and respects
# tools/lean4/lean-toolchain (leanprover/lean4:v4.30.0-rc1).
./tools/setup/install.sh

cd src/Core.Lean4
lake exe cache get               # fetch Mathlib's pre-built oleans (multi-GB; first run only)
lake env lean Lean4/DbspChainRule.lean  # type-check the artifact (~30s after cache warm)
# Or, to build everything `Lean4.lean` imports:
lake build
```

First build fetches Mathlib (multi-GB) and warms the `.lake/packages/mathlib`
cache. Subsequent builds are incremental.

## DBSP chain rule artifact (`Lean4/DbspChainRule.lean`)

Formalizes the chain rule of DBSP (Database Stream Processing) per
[Budiu, McSherry, Ryzhyk, Tannen et al., *"DBSP: Automatic Incremental View
Maintenance for Rich Query Languages"*, VLDB 2023](https://arxiv.org/abs/2203.16684).

### Paper-to-Lean mapping

| Paper reference | Lean theorem | Location |
|-----------------|--------------|----------|
| Definition 3.1 (`Q^Δ := D ∘ Q ∘ I`) | `Qdelta` | `DbspChainRule.lean` Section 6 |
| Proposition 3.2 chain clause (`Qdelta(Q1 ∘ Q2) = Qdelta Q1 ∘ Qdelta Q2`, no preconditions) | `chain_rule_proposition_3_2` | `DbspChainRule.lean` Section 6 |
| Theorem 3.3 corollary (`Dop (f ∘ g) s = f (Dop g s)` for LTI `f, g`) | `Dop_LTI_commute` | `DbspChainRule.lean` Section 6 |
| Theorem 2.22 (`I ∘ D = id` on streams) | `I_D_eq` | `DbspChainRule.lean` Section 4 |
| "Fundamental theorem of DBSP calculus" (`D ∘ I = id`) | `D_I_eq` | `DbspChainRule.lean` Section 4 |
| §4.2 telescoping identity (`I (z⁻¹ s) n = I s n - s n`) | `I_zInv_eq` | `DbspChainRule.lean` Section 4 |

### Contribution beyond the paper

The paper handles operator-class distinctions informally. The Lean formalization
makes the hierarchy machine-checkable via a four-tier predicate stratification:

| Predicate | Captures | DBSP primitives satisfying |
|-----------|----------|----------------------------|
| `IsLinear` | `map_zero` + `map_add` | `D`, `I`, `zInv` |
| `IsCausal` | Output at tick `n` depends only on input ticks `0..n` | `D`, `I`, `zInv` |
| `IsTimeInvariant` | `f ∘ zInv = zInv ∘ f` (the LTI condition; Theorem 3.3) | `D`, `I`, `zInv` |
| `IsPointwiseLinear` | `∃ φ : G →+ H, ∀ s n, f s n = φ (s n)` | Pointwise-lifted scalar maps; **NOT** `D`/`I`/`zInv` (they integrate over history or shift) |

Upgrade theorems `IsPointwiseLinear.toCausal` + `IsPointwiseLinear.toTimeInvariant`
formalize the relationships the paper handles informally.

### Round-35 paper-drift audit (substrate-honest provenance)

The artifact's evolution is recorded transparently in
[`docs/research/chain-rule-proof-log.md`](../../docs/research/chain-rule-proof-log.md).
Round-35 landed three substantive corrections after a paper-drift audit against
arXiv:2203.16684 §3.1-3.2:

1. **`chain_rule` renamed** to `Dop_LTI_commute` — original name overclaimed; it
   is a Theorem-3.3 corollary, not Proposition 3.2. Old name retained as
   `@[deprecated]` alias for back-compat.
2. **B1 statement fixed** — earlier `f (fun _ => s k) k` form silently required
   pointwise-linearity; generic LTI form is `f (I s) = I (f s)`.
3. **`chain_rule` statement fixed** — earlier "expanded bilinear" eight-term form
   was unsound for composition (impulse counter-example: `f = g = id`, `s = δ₀`,
   `n = 0` gave LHS `= 1`, RHS `= 0`). Restated in classical form
   `Dop (f ∘ g) s = f (Dop g s)`.

### Future work (named in artifact)

`chain_rule_poly` — fully polymorphic bilinear chain rule over three distinct
abelian groups `G`, `H`, `J` (for general bilinear `⊗` chain rule, not just
composition). Currently named as future-round target at
`Lean4/DbspChainRule.lean:593`.

## DynamicValue Serialization Proofs (`Lean4/DynamicValue.lean`, `Lean4/JsonCodec.lean`, `Lean4/CborCodec.lean`)

Formalizes the structural round-trip properties of the canonical `DynamicValue` AST on the representable subset of JSON, CBOR, and YAML shapes.

### Model Boundaries and Simplifying Assumptions

Per Riven's adversarial review (2026-06-16), these proofs verify the **structural bijections of the nested value-tree abstraction** rather than the full byte-level wire formats defined by RFC 8949 (CBOR) and RFC 8259 (JSON).

Key simplifications include:

1. **Simplified Header Encoding (CBOR)**: Headers are encoded as `[major, arg]` (fixed two-byte header representation in Nat lists) rather than bit-packed variable-length bytes.
2. **Simplified String Encoding (CBOR)**: Unicode characters map directly to lists of `Nat` code points via `Char.toNat` / `Char.ofNat` instead of proper UTF-8 byte stream compilation.
3. **Float & Byte Stubs**: Floats are marked as unrepresentable in JSON, CBOR, and YAML until each runtime's finite canonical number contract is modeled in Lean. Bytes are also excluded from YAML.
4. **Key Sorting & Formatting**: Maps are serialized in insertion order. Text-level constraints (whitespace rules, escape sequences, JSON number representations) are not modeled.

### Parity Strategy (The 7 Languages + Lean 4)

- **Production parity**: Parity across the production runtime languages is maintained and enforced via differential tests executing and validating against the shared golden vectors (e.g., `golden-vectors-cbor.json` / `golden-vectors.json`). Python and Go currently have canonical JSON/YAML helpers but not the DynamicValue carrier/codec surface; Q# remains an oracle/reference lane.
- **Mathematical soundness**: The Lean 4 formalization ensures the theoretical soundness of the serialization/deserialization bijection on the representable value-trees.

## Verification registry

Both DBSP chain rule theorems are tracked in
[`docs/research/verification-registry.md`](../../docs/research/verification-registry.md)
with provenance, audit cadence, and cross-check status.

## CI

[`.github/workflows/lean-proof.yml`](../../.github/workflows/lean-proof.yml)
runs `./tools/setup/install.sh` (to install elan + the pinned toolchain), then
`lake exe cache get` (to fetch Mathlib's pre-built oleans), then
`lake build` (to build the `Lean4.lean` package root and all imported codec proofs),
plus explicit theorem-file checks and the sorry-free axiom audit on every
PR touching `src/Core.Lean4/**`. Path-filtered to run out-of-band from the main
`gate.yml` matrix (Mathlib cache is multi-GB and toolchain setup is heavier
than the dotnet/bun gates). See workflow source for SHA-pinning +
concurrency-group + minimum-permissions details.

## Citation

If you cite this artifact:

```bibtex
@misc{zeta-dbsp-chain-rule-lean,
  author       = {{Lucent Financial Group}},
  title        = {Zeta DBSP chain rule, machine-checked in Lean 4 + Mathlib},
  year         = {2026},
  howpublished = {\url{https://github.com/Lucent-Financial-Group/Zeta/tree/main/src/Core.Lean4}},
  note         = {Formalizes Budiu et al. (VLDB 2023, arXiv:2203.16684) Proposition 3.2 + Theorem 3.3 corollary}
}
```

For the paper this artifact formalizes:

```bibtex
@inproceedings{budiu2023dbsp,
  author    = {Mihai Budiu and Frank McSherry and Leonid Ryzhyk and Val Tannen},
  title     = {{DBSP: Automatic Incremental View Maintenance for Rich Query Languages}},
  booktitle = {VLDB 2023},
  year      = {2023},
  eprint    = {2203.16684},
  archivePrefix = {arXiv}
}
```

## Composes with

- [`docs/research/chain-rule-proof-log.md`](../../docs/research/chain-rule-proof-log.md) — round-by-round decision history; sub-lemma table; paper-drift audit results
- [`docs/research/verification-registry.md`](../../docs/research/verification-registry.md) — Class-0-drift-prevention registry for every formal-verification artifact
- [`docs/research/proof-tool-coverage.md`](../../docs/research/proof-tool-coverage.md) — portfolio-wide tool routing
- [`.claude/skills/formal-methods/blueprints/verification-drift-auditor.md`](../../.claude/skills/formal-methods/blueprints/verification-drift-auditor.md) — drift-detection procedure
- [`.claude/agents/formal-verification-expert.md`](../../.claude/agents/formal-verification-expert.md) — the formal-verification-expert agent (routing authority for every formal-verification job)
