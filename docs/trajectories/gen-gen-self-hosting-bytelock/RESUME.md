# Trajectory — `gen(gen) == gen` self-hosting byte-lock (diverse-double-compiling, N-fold)

Status: **active — plan written; blocked on the IR-v1 freeze (Phase A) + the multi-language generator (dependency)**
Last refreshed: 2026-06-19
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

## Futamura projections ↔ the three Faces of `gen(gen)===gen` (2 of 3 proven — checkpoint 2026-06-19)

Futamura (1971, *Partial Computation of Programs*) — the specialization triple. The repo encodes
them as the three **Faces** of `gen(gen)===gen` in `src/Core/AdinkraCode.fs`:

| Face | object (code) | Futamura projection | status |
|---|---|---|---|
| 1 | duality fixed point `isSelfDual` (C = C⊥) | the generator sits on the self-dual fixed point | ✅ PROVEN |
| 2 | codespace projector `project` (Π∘Π = Π) — re-gen changes nothing | idempotent specialization | ✅ PROVEN |
| 3 | `mix(mix,mix) = cogen` reflective fixpoint — `gen(gen)` byte-identical in every target | **the 3rd projection itself** (cogen / self-hosting) | ⏳ OPEN (§B) — the capstone |

- **2 of 3 proven — at the code/algebra level** (self-duality + idempotent projector). The
  **operational** triple over `zeta-ir` rides the same blocked generator as Face 3 (Phase A IR-freeze
  + the multi-language generator). So: "2 of 3 proven as the algebraic shadows; the operational triple
  all waits on the generator."
- **Face 3 §B home:** `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` — the *"Entropic propagation →
  self-dual code attractor (`gen(gen)=gen`, Face 3)"* row (two proven legs — structural
  octonion→Fano→[8,4] + propagation Bayesian/NCI — and the **open MacWilliams/Hadamard bridge**: the
  crux is proving the SoftValue/NCI accumulation operator IS the MacWilliams transform).
- **Honest peel (Face 2):** projector along the *parity* complement, not the orthogonal projector
  (over GF(2) the code is self-orthogonal, `G·Gᵀ=0`, so the orthogonal projector is undefined).
- **Why it's the trust / "superdeterminism" mechanism:** same seed + same generator → reproduces
  itself byte-for-byte → humans and AIs agree *without reading every line*. The fixed point is
  simultaneously generation, fixed-point, AND ECC (space [N-oracle byte-lock] + time [DST replay]).
  **Phase D below is its discharge.** Anchor: Futamura 1971; Thompson "Trusting Trust"; Wheeler DDC.

## Where it stands (2026-06-19)

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

## Q# self-hosting lane — `gen(gen)===gen` + `cogen=mix(mix,mix)` in Q# (Aaron 2026-06-19)

Aaron's stated horizon: **after** the six Z-set operators land in standalone Q#
(`docs/handoffs/2026-06-19-zset-isa-six-operators-qsharp-build-spec.md`, Alexa), get the **same
fixed points** — `gen(gen)===gen` and `cogen = mix(mix,mix)` — **in the Q# lane.** This is the Q#
instance of **Face 3** (the §B capstone), and it maps onto the phases above:

- The six Q# ops are the *content*; the next step is **`gen(Q#-ops from IR)`** (the generator emits the
  Q# ISA) → then **`gen(gen)` in Q#** = Phase F (**behavioral-equivalence**, NOT byte-lock — Q#'s
  execution model; tiers §1).
- **`cogen = mix(mix,mix)`** is the open Face 3 research discharge (3rd Futamura projection) — same §B
  obligation, now with Q# as a target lane.
- **Same prereqs apply:** Phase A (IR-v1 freeze) + the multi-language generator. So the Q# self-hosting
  lane is gated on those — the operators are the start, not the fixed point.

## Dependencies / seams (honest)

- **The multi-language generator itself is in-flight** — today `gen/` emits CHIP-8 asm + reified
  types from F#. This trajectory is the *test* spec; the generator build is the dependency.
- **Byte-lock is on the canonical encoding**, not raw source (UTF-16 vs UTF-8 divergence, B-0969) —
  pretty-print is a normalized layer; the *artifact* is what's locked.
- **Bootstrap/Trusting-Trust:** the first generator's trust is bootstrapped, not proven from inside —
  name the bootstrap pair (F# host + one clean-room oracle).
- Phases A–C are engineering on the existing harness; **Phase D is the research discharge**, not mechanical.
