# `proofs/lean/` — Machine-checked DBSP theorems

Lean 4 + Mathlib formalisation of the DBSP chain rule (Budiu et al.,
VLDB 2023). This directory is the *strongest verification artefact*
the repo can ship: once `sorry`-free, the chain rule becomes a
machine-checked theorem, not a property test.

**Status: legacy scaffold pinned to Mathlib v4.12.0.** The
current working copy is at `tools/lean4/Lean4/DbspChainRule.lean`
on the v4.30.0-rc1 toolchain — prefer that path. The file in
this directory stays for diff reference until the migration is
verified green, then it goes away (see `docs/DEBT.md`).
Proof body is still `sorry` in six named sub-lemmas
(see §Sub-goals below). The `lake build` gate is **pending Lean
toolchain install** — see §Local build.

---

## Files

| File | Role |
|---|---|
| `ChainRule.lean` | Theorem statements + proof skeleton (six named sub-lemmas, one chain-rule theorem) |
| `lakefile.lean` | Lake build config — declares Mathlib dependency at `v4.12.0` |
| `lean-toolchain` | Pins `leanprover/lean4:v4.12.0` (matches Mathlib tag) |
| `README.md` | This file |

---

## Local build

```bash
# 1. One-time: install elan (Lean version manager) if not already present
curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y
source "$HOME/.elan/env"

# 2. From the repo root:
cd proofs/lean

# 3. elan will read `lean-toolchain` and install lean4:v4.12.0 on first run
lean --version   # should print 4.12.0

# 4. Fetch Mathlib as a git dependency (first run downloads ~1 GB of .olean
#    cache; subsequent builds are seconds)
lake update

# 5. Build the library — this is the CI gate
lake build
```

Build success criterion: `lake build` exits 0 and prints
`Build completed successfully`. A *clean* build succeeds iff every
`sorry` has been replaced — **the CI gate fails closed on `sorry`.**

> **Gate status:** `lake build` will succeed (`sorry` is a valid
> Lean term) but `#print axioms chain_rule` currently includes
> `sorryAx`. A supplementary CI check greps for `sorry` in
> `*.lean` and fails the job if any remain. This supplementary
> check is **not yet wired** pending elan install on the CI box.

---

## Sub-goals — what each `sorry` says and what it needs

All sub-lemmas live in `ChainRule.lean`. Numbering matches the
comments in the source file.

### `T1 zInv_zero` — CLOSED (proof: `rfl`)
`zInv s 0 = 0`. Zero effort; done.

### `T2 zInv_succ` — CLOSED (proof: `rfl`)
`zInv s (n+1) = s n`. Zero effort; done.

### `T3 I_zInv_eq` — SKELETON, **0.5 engineer-days**
Statement: `I (zInv s) n = I s n - s n`.
Tactic plan: induction on `n`; expand `Finset.sum_range_succ` on
both sides; cancel the head term. Only Mathlib lemma needed is
`Finset.sum_range_succ`. No novel mathematics — this is a direct
port of a standard discrete-calculus identity.
**Classification:** port-from-literature.

### `T4 D_I_eq` — SKELETON, **0.5 engineer-days**
Statement: `D (I s) = s`. The DBSP "fundamental theorem of
calculus". Direct consequence of T3 + definition of `D`.
**Classification:** port-from-literature.

### `T5 I_D_eq` — SKELETON, **0.5 engineer-days**
Statement: `I (D s) = s`. Telescoping sum in the opposite
direction; same technique as T4. Independent of chain rule but
symmetrises the core calculus.
**Classification:** port-from-literature.

### `B1 linear_commute_I` — SKELETON, **1 engineer-day**
Statement: for linear `f`, `f (I s) n = I (f ∘ s) n` pointwise.
Induction + `hf.map_add` + `Finset.sum_range_succ`. Care needed
around the fact that `IsLinear` in this file is stated for
pointwise-function-of-stream operators, not operators on individual
tuples — the statement may need a sharper formulation once the
real `Query K` type replaces `Stream G`. For now the statement is
provable as-written with the current `IsLinear` predicate.
**Classification:** port-from-literature with a minor novelty (the
bridging between "stream-level linearity" and "pointwise linearity"
is not explicitly worked out in Budiu et al.).

### `B2 linear_commute_zInv` — SKELETON, **0.5 engineer-days**
Statement: for linear `f`, `f (zInv s) n = zInv (f s) n`.
Case-split on `n`; the `n=0` case uses `hf.map_zero`.
**Classification:** port-from-literature.

### `B3 linear_commute_D` — SKELETON, **0.5 engineer-days**
Statement: for linear `f`, `f (D s) = D (f s)`.
Follows from B2 + distribution over subtraction via
`AddCommGroup.sub_eq_add_neg` + `hf.map_add`.
**Classification:** port-from-literature.

### `chain_rule` — SKELETON, **2 engineer-days**
The main theorem. Stated in terms of `Dop` (the operator-lifted `D`)
so that the RHS typechecks: `Dop f`, `Dop g` both have operator
type `Stream G → Stream G` and can be applied to intermediate stream
values. Restricted to endomorphisms of the same abelian group; the
fully-polymorphic `G → H → J` form is a follow-up
(`chain_rule_poly`).

Body is a `calc` chain that invokes T3, B2, B3 in sequence. The
trickiest step is the telescoping cancellation of the two
`f (g (I (z⁻¹ s)))` terms — stated explicitly in Budiu et al. §4.2
but *not* with the algebraic rigour needed for Mathlib. Expect a
half-day porting the informal paper proof into a Lean `calc` block.

**Classification:** part port, part research. The *statement* is from
the paper; the *Lean-level proof tactics* are new because the paper
uses diagrammatic algebra, not Mathlib's `AddMonoidHom` API.

### `chain_rule_id_corollary` — CLOSED (defers to `D_I_eq`)
Sanity check — once `chain_rule` closes, re-derive `D ∘ I = id` from
it. Currently just aliases `D_I_eq`.

---

## Research vs port-from-literature — one-line table

| Sub-goal | Research? | Port? |
|---|---|---|
| T1, T2 | — | trivial (rfl) |
| T3, T4, T5 | — | yes — standard discrete calc |
| B1 | minor | mostly yes |
| B2, B3 | — | yes — abelian-group bookkeeping |
| `chain_rule` | **yes** (Mathlib-level proof scripting) | statement ports |
| corollary | — | yes |

**Total port-from-literature effort: ~3.5 engineer-days.**
**Total research effort: ~2 engineer-days (chain_rule calc block).**
**Total to `sorry`-free: ~5.5 engineer-days** (call it **6** with
contingency for Mathlib-API surprise fixes).

---

## What this proof does *not* prove (explicit scope)

- **It does not prove termination of the semi-naïve fixpoint.** That
  belongs in a `Recursive.lean` sibling (P3; deferred).
- **It does not prove `Distinct` soundness.** `Distinct` is not a
  linear operator, so the chain rule as stated does not apply to it
  directly. `Distinct` soundness is property-tested in
  `tests/Dbsp.Tests.FSharp/MathInvariantTests.fs` and SMT-encoded in
  `tools/Z3Verify/Program.fs`; a Lean proof is possible but out of
  scope for this file.
- **It does not prove equivalence to the F# implementation.** The
  Lean theorem is over the abstract operators `D`, `I`, `zInv`; the
  F# code (`src/Dbsp.Core/Incremental.fs`) implements them. The
  bridge is a hand-checked semantic argument — Coq/Lean-certified
  code extraction is a P3 roadmap item, not this proof.

---

## Next concrete step

1. Close **T3** (half-day; pure Mathlib `Finset.sum_range_succ` induction).
2. Close **T4** (half-day; immediate from T3).
3. Close **B2** (half-day; case-split + `map_zero`).

Landing T3+T4+B2 cuts the remaining `sorry` count from 6 to 3 and
gives the chain-rule theorem a solid algebraic base to calc-against.

See `docs/research/mathlib-progress.md` for the rolling status log.
