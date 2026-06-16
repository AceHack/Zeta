# Trajectory — `gen(gen) == gen` self-hosting byte-lock (diverse-double-compiling, N-fold)

Status: **active — plan written; blocked on the IR-v1 freeze (Phase A) + the multi-language generator (dependency)**
Last refreshed: 2026-06-16
Parent trajectory: none (sibling of `sim-mea-cut-soft-substrate-shaders` — shares the gen/IR substrate)
Grounding:

- `docs/research/2026-06-16-gen-gen-equals-gen-test-plan-across-all-oracle-languages-diverse-double-compiling-capstone.md` (the phased plan A–F + test matrix + seams)
- `docs/research/2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-fsharp-host-csharp-contracts-self-hosting-futamura.md` (§5 north star, §7 Futamura)
- `docs/DECISIONS/2026-05-31-four-language-compiler-bft-governance-axes-per-artifact-gate-golden-vectors-oracle-tiebreak.md` (the 4-oracle compiler-BFT + golden-vectors-as-oracle)
- `src/Core/AdinkraCode.fs` (`l=gen` Faces 1+2 PROVEN; **Face 3 = the open capstone, §B**)
- B-0982 / B-0867.27 (four-oracle multi-format golden-vector seeds — the harness to extend)

## Why this exists

The north star: **the generator generates itself in all targets** — the 3rd Futamura
projection = **diverse-double-compiling N-fold** (Thompson→Wheeler). `gen(gen)==gen`
byte-identically in every target is the **termination test** and the **trust mechanism**:
*humans and AIs agree without reading every line*. It is simultaneously a generation, a
fixed-point, and a drift-check (ECC across space [N-oracle] + time [DST]).

## Where it stands (2026-06-16)

- ✅ Phased plan written (A–F), test matrix, conformance-kind-per-tier, honest seams.
- ✅ Legs confirmed: `AdinkraCode` Faces 1+2 proven (`isSelfDual`, `project`); per-primitive
  cross-language byte-lock built (observe / DynamicValue / ZSet / Bag / GSet across 4 oracles);
  hex-in-JSON golden-vector harness + one canonical collation + DoP=1 injected scheduler.
- ⏳ **Face 3 (Futamura `mix(mix,mix)=cogen`) is genuinely OPEN (§B)** — that *is* the capstone.

## The tiers (don't blur "all our languages")

- **4 correctness oracles (start here):** TS · F# · C# · Rust — already have golden-vector infra.
- **6 codegen targets:** + Python + Go. **+ Q#** (behavioral-equiv). **+ CHIP-8 cart** (behavioral-equiv).
- **Conformance KIND:** byte-lock for source langs; **behavioral-equivalence** for cart/Q#/VMs/shaders.

## Next concrete steps (phased gates)

1. **Phase A (blocking prereq):** freeze `zeta-ir-v1-layout.yaml` with the evolution contract; golden-vector its hex serialization.
2. **Phase B:** `gen(observe-IR)` byte-matches the committed observe golden vectors in all 4 oracles.
3. **Phase C:** generate ZSet/DynamicValue/Bag/GSet from IR — idempotence + cross-oracle byte-lock on the same CI gates.
4. **Phase D (the capstone / §B Face 3):** `gen(gen)` in the 4 oracles == committed generator, byte-for-byte → route the *proof* obligation to Soraya/math team; the *test* is the engineering artifact.
5. **Phase E:** + Python/Go (byte-lock) + CHIP-8 cart (behavioral).
6. **Phase F:** + Q# + document the Trusting-Trust bootstrap (≥2 independent generators to seed trust).

## Dependencies / seams (honest)

- **The multi-language generator itself is in-flight** — today `gen/` emits CHIP-8 asm + reified
  types from F#. This trajectory is the *test* spec; the generator build is the dependency.
- **Byte-lock is on the canonical encoding**, not raw source (UTF-16 vs UTF-8 divergence, B-0969) —
  pretty-print is a normalized layer; the *artifact* is what's locked.
- **Bootstrap/Trusting-Trust:** the first generator's trust is bootstrapped, not proven from inside —
  name the bootstrap pair (F# host + one clean-room oracle).
- Phases A–C are engineering on the existing harness; **Phase D is the research discharge**, not mechanical.
