---
id: 081M05M1R97087G0R0023Z4F9D
type: bug
state: backlog
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
