# Verb → code map — the CLI verb family and what implements each

The registry Aaron asked for (2026-06-10): every verb in the family, its status
(**in-code** / **floated** / **new**), and the source file(s) it maps to. Companion to
[`README.md`](README.md) (the prose) and [`Verbs.fs`](Verbs.fs) (the interface stubs).

## Canonical six — `sim · mea · cut · ben · cla · res` (in code)

Diskpart-style minimum-unique-prefix abbreviation (`measure`≡`mea`; `cut`/`cla` diverge at the 2nd
letter). Resolver: [`src/Core/CliVerb.fs`](../src/Core/CliVerb.fs).

| verb | word | role | residue | code |
|---|---|---|---|---|
| **`sim`** | sim(ulate) | run the deterministic sim for a duration | `unit` (void) | **concrete:** [`src/Core/Sim.fs`](../src/Core/Sim.fs) (`Sim.run seed duration`); stub `ISimVerb` in `Verbs.fs` |
| **`mea`** | mea(sure) | `mea(sim)`: lift sim + commit ΔU | `Measurement` (ΔU → `uncertainty/`) | stub `IMeaVerb` ([`Verbs.fs`](Verbs.fs)) |
| **`cut`** | cut | cut at a recognition site (a TIME; default 30s) | `Delta × Seam` (re-ligated by the finalizer, [`src/Core/Finalizer.fs`](../src/Core/Finalizer.fs)) | stub `ICutVerb` |
| **`ben`** | ben(chmark) | instrument sim for perf — loop `cut mea ben sim` | `Benchmark` (→ `bench/`) | stub `IBenVerb` |
| **`cla`** | cla(ssify) | assign to a class / lens | class label (→ `same/`) | stub `IClaVerb` |
| **`res`** | res(olve) | loop `mea` until it resolves (fixed point) | fixed point (ΔU→0) + resolution | stub `IResVerb` |

The loop is `sim |> mea |> cut` (pipe = `cut(mea(sim))`; F# is left-associative so bare `cut mea sim` is
multi-arg application, NOT nesting); `res` iterates it. The soft scheduler that can drive verb-ISRs:
[`src/Core/SoftScheduler.fs`](../src/Core/SoftScheduler.fs).

## Floated — the "outside the cube" mini-cube over Cayley (NOT yet in code)

Sketched 2026-06-10 alongside the six; captured here as shapes, **not** implemented as verbs yet:

| verb(s) | word | note |
|---|---|---|
| **`rem` / `whe`** | rem(ember) / whe(n) | the memory/time mini-cube |
| **`pay` / `att`** | pay / att(ention) | attention — now known to be the *only endogenous choice* (see the choice/soft-topology synthesis doc) |
| **`how` / `man` / `whi` / `way`** | how / man(y) / whi(ch) / way | over Cayley |

## New — the braid / soft-topology verbs → effective qubits (2026-06-10)

`bob · weave · braid · tie` — the soft-topology / braid operations. Aaron 2026-06-10: *"bob weave braid
tie all tie to 2×2, 3×3, 4×4 etc. structures that make effective qubits."* **Braiding is the
topological-quantum-computing primitive** (anyon braids = fault-tolerant gates), and the n×n structures
are the qubit substrate — which **already exists** in code:

| verb | operation | maps to existing qubit-substrate code |
|---|---|---|
| **`tie`** | the soft link / join (and the tie is *soft* — soft topology) | the soft tie: [`src/Core/FingerprintPrism.fs`](../src/Core/FingerprintPrism.fs) (`soft` Match); soft links on [`src/Core/WeightedSet.fs`](../src/Core/WeightedSet.fs) |
| **`braid`** | interleave the independent deterministic choice-streams (anyon braid → gate) | [`src/Core/QubitIso.fs`](../src/Core/QubitIso.fs) (Pauli/SU(2) closes); [`src/Core/Cl3.fs`](../src/Core/Cl3.fs) (Clifford Cl(3,0)) |
| **`weave` / `bob`** | the interleaving motion of the braid | [`src/Core/AmplitudeEmu.fs`](../src/Core/AmplitudeEmu.fs) (complex amplitudes → interference on merge); [`src/Core/BellTest.fs`](../src/Core/BellTest.fs) (CHSH = 2√2, Tsirelson, in sim) |

The **2×2 → 4×4 → 8×8 doubling** is [`src/Core/CayleyDickson.fs`](../src/Core/CayleyDickson.fs)
(ℝ→ℂ→ℍ→𝕆; ℍ = quaternion = SU(2) = one qubit); the weight-algebra spine
([`src/Core/WeightedSet.fs`](../src/Core/WeightedSet.fs)) admits these as the weight `'W` (matrix /
amplitude weights → qubit-valued bags). SUSY adinkra graphs: [`src/Core/BitAdinkra.fs`](../src/Core/BitAdinkra.fs).

**Peel:** "effective qubits" = qubit-shaped linear-algebra structures (Pauli/SU(2)/Clifford/complex-
amplitude), classically simulated and replayable — `BellTest` reproduces the Tsirelson bound `2√2` *in
deterministic simulation* via staged coincidence + seed, not on quantum hardware. The braid/soft-topology
framing for fault tolerance is the direction (anyons live in 2D topological order); the existing code is
the qubit *algebra* + emulation, the braid-as-gate layer is to build. Routes: Soraya/Sova (formalize),
Core (braid/tie verbs + matrix-weighted WeightedSet), Aaron (which verbs are real).

## Status summary

- **In code (6):** `sim mea cut ben cla res` (sim concrete; rest interface stubs + resolver + finalizer).
- **In code (4, new 2026-06-10):** `bob weave braid tie` — interface stubs in [`Verbs.fs`](Verbs.fs)
  (`ITieVerb`/`IBraidVerb`/`IWeaveVerb`/`IBobVerb` + `IBraidCli`; supporting `ISoftTie`/`IBraid`/`IWeave`),
  the effective-qubit constructors over the qubit substrate. Aaron greenlit ("lets go").
- **Floated (7):** `rem whe pay att how man whi way` (shapes, no verbs yet).

Adding the *floated* verbs as interface stubs in `Verbs.fs` remains a verb-family-expansion **design
decision** (which shapes are real verbs) — pending Aaron's call, not auto-added.
