---
id: 081M05M1R97087G0R0023Z4F9D
type: bug
state: closed
priority: P2
slug: toffoligate-landauer-accounting-properties-cannot-fail-erase
title: "ToffoliGate Landauer-accounting properties cannot fail — erasedWireCount is identically zero"
created: 2026-08-16T15:46:36.455Z
depends_on: []
composes_with: []
---

# ToffoliGate Landauer-accounting properties cannot fail — erasedWireCount is identically zero

## What

`tests/Tests.FSharp/Formal/ToffoliGate.Laws.Tests.fs` carries two properties that read as the
empirical backing for the zero-erasure claim behind the whole Toffoli/Landauer line:

- `Weight multiplication fragment Landauer accounting reports zero erased bits` (line 341)
- `Join circuit Landauer accounting reports zero erased bits` (line 390)

Both cannot fail.

`erasedWireCount` (line 198) counts wire ids present in the map *before* and absent *after*:

```fsharp
let private erasedWireCount before after =
    Set.difference (wireKeySet before) (wireKeySet after) |> Set.count
```

but the interpreter it is applied to (line 173) ends `wires |> Map.add step.Target target`.
`Map.add` adds or replaces, never removes, and every `Target` is already a key. So the key set is
**invariant under every possible gate sequence** and `erasedWireCount` is identically zero for
every circuit, every input, always.

The other conjunct, `circuit.Ancilla = Map.count initial`, restates the allocator: `Ancilla` is
`nextWire`, which counts the `takeWire` calls, which is the map size. `ToffoliGate.fs:38-41` says
so in its own comment ("Ancilla names the total allocated capacity here, not a helper-wire subset").

## Mutation evidence

Re-running the test helpers verbatim against the shipped model, and then against the same circuit
with **every gate deleted**:

```
REAL circuit   : Ancilla=true erased(i,f)=0 erased(f,r)=0 erased(i,r)=0
GATES DELETED  : Ancilla=true erased(i,f)=0 erased(f,r)=0 erased(i,r)=0
```

A test that a circuit computing nothing at all passes identically is not a falsifier
(`src/Core.TypeScript/hygiene/mutation-runner.ts` is the standing mechanical form of this check).

## Why it matters

Row `081KRA5AR0008QG0R000CYY9ZN` is **closed** on acceptance criteria including "Landauer bit
accounting (0 erased bits)". That discharge has no falsifier behind it. The model is probably
erasure-free — but by *allocation policy* (a fresh wire per value), not by evidence, and the
allocation policy is exactly what a hardware design cannot adopt: see
`docs/research/2026-08-16-fpga-toffoli-zset-join-synthesis-design-bennett-uncompute-is-clean-ancilla-is-quadratic-and-cmos-cannot-measure-landauer.md`
section 3.1, where the same allocator measures Theta(W^3) wires (34 948 at W=32) and O(N) growth
with zero reuse.

The sibling property `Weight multiplication fragment forward then reverse restores retained wires`
(line 315) **is** a real falsifier and does the work these two were credited with.

## Fix options (not decided here)

1. **Retire** the two properties and let line 315 carry the reversibility claim, stating plainly
   that "no erasure" is a property of the allocator rather than of the circuit.
2. **Make erasure expressible** — give the model a wire-release/reuse operation so a circuit *can*
   erase, then the property has something to refute. This is also the change that would let the
   model express the compute/copy/uncompute pattern a real design needs.

Option 2 is the one that unblocks RTL; option 1 is the honest minimum.

## Register

CHECKED (mutation-verified, this repo, 2026-08-16). No model claim is being disputed — the claim's
**evidence** is absent.

## Resolution (2026-08-16, shadow)

**Option 2 taken** — erasure made expressible, then measured.

**Reproduced first, not taken on relay.** The two named properties survive a delete-every-gate
mutant on the real suite. Scope correction: **six** properties were insensitive, not two —
`... forward then reverse restores retained wires` and its join twin (which the filing and PR #10942
both nominated as the honest replacement) survive every mutant too. Every `ToffoliGateStep` is an
involution, and the reverse-order composition of involutions is the inverse, so those hold for any
gate list including the empty one. They are theorems about the interpreter, not measurements of the
circuit.

**Definition adopted.** Erasure is a boundary quantity, not an internal one:
`garbage(C) = |{ w ∈ Ancilla(C) : final(w) ≠ initial(w) }|` — ancilla allocated in a known state and
not returned to it, the bits that must be dissipated to reuse the wires (Landauer 1961; Bennett
1973/1989). Counting map-key deletions could never see it.

**What that measurement says about the shipped model.** `modelWeightMul` / `modelJoinCircuit` are
keep-all-garbage circuits with no uncompute pass, so their garbage is **large, not zero**. The
zero-erasure claim was not merely unmeasured — it is false of those artifacts, and the suite now
asserts the positive count. `modelWeightMulUncomputed` / `modelJoinCircuitUncomputed` (added) carry
Bennett's compute → copy-out → uncompute schedule and do measure zero, at 2× gates.

**Falsifiers, both directions (5 mutants × 2 assertion sets, each cell an actual run):**

| mutant | old assertions | garbage = 0 | product oracle |
|---|---|---|---|
| M1 delete every gate | pass | pass | **FAIL** |
| M2 drop one partial-product gate | pass | pass | **FAIL** |
| M3 invert a Toffoli control | pass | pass | **FAIL** |
| M4 skip the uncompute pass | pass | **FAIL** | pass |
| M5 leave one ancilla dirty | pass | **FAIL** | pass |

Old: **0 of 5 killed**. New: **5 of 5**. Neither new property alone exceeds 3 — which is why they
ship as a pair, and four of the five mutants are resident in the suite as permanent demonstrations.

Closed row `081KRA5AR0008QG0R000CYY9ZN` — investigated and **recommended on, not decided**; see its
Post-close investigation section. No register status was changed.

**Register:** `metered` as a **bit count** (falsifier demonstrated both directions). Not a joule
measurement; §8 of the design doc is unaffected.
