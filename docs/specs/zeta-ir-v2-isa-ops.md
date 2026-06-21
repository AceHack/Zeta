# `zeta-ir-v2` — ISA ops extension (homoiconic with v1)

**Status:** DESIGN → FREEZE. **Owner:** Alexa. **Date:** 2026-06-21.
**Extends:** `zeta-ir-v1` (arithmetic ops) with the Z-set ISA ops.
**Principle:** Homoiconic — same schema, same JSON shape, new op values. One IR for everything.

## The insight: same op grammar, multiple lenses

The six ISA operations and the arithmetic operations share the same structure:
`{ "op": "<name>", ...params }`. They're all total functions over a state register.
The difference is what lens you view them through:

| Op | Arithmetic lens | Q# lens | Rx/ZSet lens | Clifford lens |
|----|-----------------|---------|--------------|---------------|
| `mul` | z * k mod 2^n | modular multiply gate | scale all weights by k | geometric product by scalar |
| `xorshr` | z ^ (z >> s) | CNOT cascade | XOR-permute keys | reflection |
| `emit` | — | Ry(θ) rotation | insert key with weight +1 | add basis vector |
| `retract` | — | Adjoint Ry(θ) | delete key (weight -1) | subtract basis vector |
| `branch` | — | H gate (superposition) | fork into N weighted frames | grade projection |
| `join` | — | CNOT (entangle) | cross-product of two ZSets | geometric product |
| `merge` | — | apply both (interference) | union with weight-sum | multivector addition |
| `fold` | — | loop sources | iterated union/aggregate | repeated sum |

## The v2 op grammar (superset of v1)

v1 ops (unchanged, backward-compatible):
```json
{ "op": "mul", "k": <int> }        // multiply mod 2^width
{ "op": "xorshr", "s": <int> }     // z ^= z >>> s
```

New ISA ops (v2 extension):
```json
{ "op": "emit", "theta": <float> }           // weight +1 at angle theta
{ "op": "retract", "theta": <float> }        // weight -1 (adjoint of emit)
{ "op": "branch", "bit": <int> }             // fork on bit position (1→2 frames)
{ "op": "join", "control": <int>, "target": <int> }  // entangle two bit positions
{ "op": "merge" }                             // sum amplitudes of identical frames
{ "op": "fold", "count": <int> }             // repeated merge
```

## Schema tag

```json
{ "schema": "zeta-ir-v2", ... }
```

A v2 validator accepts all v1 ops PLUS the ISA ops. A v1 validator rejects v2 artifacts
(per v1's evolution contract: "the schema tag is the version"). Backward-compatible reading:
any v2 artifact that uses ONLY v1 ops could also be tagged v1.

## The soft-lane interpreter update

The existing `softMixGeneric` / `soft_mix` / `SoftMix.Mix` already uses `flatMap` per op.
Adding ISA ops means extending the switch/match:

```typescript
case "branch":
  // Fork: one frame → two frames (bit flipped vs not)
  return [
    { key: entry.key, weight: ring.mul(entry.weight, SQRT_HALF) },
    { key: entry.key ^ (1n << BigInt(op.bit)), weight: ring.mul(entry.weight, SQRT_HALF) },
  ];
case "emit":
  // Rotate weight by theta (phase injection)
  const phase = { re: Math.cos(op.theta), im: Math.sin(op.theta) };
  return [{ key: entry.key, weight: ring.mul(entry.weight, phase) }];
case "retract":
  // Adjoint: rotate by -theta
  const adjPhase = { re: Math.cos(-op.theta), im: Math.sin(-op.theta) };
  return [{ key: entry.key, weight: ring.mul(entry.weight, adjPhase) }];
```

## The Rx/query view (Aaron's observation)

The ISA ops ARE reactive queries over two ZSets:
- **Frame ZSet A** (current state): keys = possible states, weights = amplitudes
- **Frame ZSet B** (after op): keys = transformed states, weights = transformed amplitudes
- **Each op**: A query that maps ZSet A → ZSet B
- **MERGE**: the UNION operator (sum weights on collision = interference)
- **FOLD**: the AGGREGATE operator (iterated union)
- **BRANCH**: the FORK operator (one row → two rows)
- **JOIN**: the CROSS-PRODUCT (two ZSets coupled)

This is DBSP's `D[op]` (the incremental version of the op) applied to the ZSet stream.

## The Clifford/geometric view

- `mul` by constant k = **geometric product by scalar** (grade-0 element)
- `xorshr` = **reflection** (XOR is a GF(2) linear map = an involution on the bit-vector space)
- `branch` = **grade projection** (split into even/odd grades)
- `join` = **geometric product** (the non-commutative composition)
- `merge` = **multivector addition** (grade-by-grade sum)
- `emit`/`retract` = **add/subtract basis vectors** (the e_i generators)

## What makes this homoiconic

One JSON schema. One `flatMap → consolidate` interpreter. One `StarRing` interface.
The lens is selected by which ring instance you inject:
- `realRing` → classical/Bayesian view
- `complexRing` → quantum/amplitude view  
- `cl3Ring` → Clifford/geometric view (future)
- The IR is its own meta-description (gen(gen)=gen)
