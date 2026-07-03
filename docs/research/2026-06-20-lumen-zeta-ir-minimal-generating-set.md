# Zeta-IR Minimal Generating Set (The Shrink)

**Author:** Lumen
**Date:** 2026-06-20

## The Instinct

Aaron observed: *"things grow before they shrink."* The `zeta-ir` grammar grew across four evolutionary steps:

1. `v1`: `mul k`, `xorshr s`
2. `v2`: `rotl r`
3. `v3`: `xrotxor [r...]`, `xshrxor [s...]`
4. `v4`: `add k`

This gave us a six-family op zoo. But the growth already contained a shrink: `nasam`'s `xshrxor [s]` strictly generalizes v1's `xorshr s`. This note asks the natural next question: **What is the minimal generating set that the entire v1..v4 grammar collapses into?**

## The Minimal Set

The six op-families reduce to exactly **four** core operations. The minimal generating set $G$ is:

1. `mul k`
2. `add k`
3. `xshrxor [s_1, ..., s_n]`
4. `xrotxor [r_1, ..., r_n]`

### The Reductions (The Shrink)

Two ops from the earlier versions are completely redundant, subsumed by the later parallel-reuse ops.

#### 1. `xorshr s` reduces to `xshrxor [s]`
This was already explicit in the v3 widening logic (`ZetaIrV3.ofV2Op`).

- `xorshr s` denotes $z \mapsto z \oplus (z \gg s)$
- `xshrxor [s]` denotes $z \mapsto z \oplus (z \gg s)$
- **Proof:** Trivial equivalence.

#### 2. `rotl r` reduces to `xrotxor [0, r]`
This is the hidden collapse. A v2 `rotl r` replaces the accumulator with its rotation. A v3 `xrotxor` XORs rotations back into the accumulator.

- `rotl r` denotes $z \mapsto \text{rotl}(z, r)$
- `xrotxor [r_1, ..., r_n]` denotes $z \mapsto z \oplus \text{rotl}(z, r_1) \oplus \dots \oplus \text{rotl}(z, r_n)$
- If we set the list to `[0, r]`, the evaluation is:
  $z \mapsto z \oplus \text{rotl}(z, 0) \oplus \text{rotl}(z, r)$
- Since $\text{rotl}(z, 0) = z$, this is:
  $z \mapsto z \oplus z \oplus \text{rotl}(z, r)$
- Because $z \oplus z = 0$ in $\mathbb{F}_2$, the original accumulator cancels itself out, leaving:
  $z \mapsto \text{rotl}(z, r)$
- **Proof:** $\forall z, \quad z \oplus \text{rotl}(z, 0) \oplus \text{rotl}(z, r) = \text{rotl}(z, r)$.

### Irreducibility of the Minimal Set

Why can't we shrink the remaining four?

1. **`add k` is irreducible:** It is the only affine operation. Every other op in $G$ fixes 0 (maps $0 \mapsto 0$). `add k` maps $0 \mapsto k$.
2. **`mul k` is irreducible:** It is the only operation that propagates carries upward across bit boundaries. All XOR-based ops are linear over $\mathbb{F}_2$ (carryless).
3. **`xshrxor` vs `xrotxor`:** 
   - `xshrxor` destroys information (bits fall off the right edge), so it cannot express `xrotxor` (which is bijective/lossless).
   - `xrotxor` wraps bits, so it cannot express the zero-fill behavior of `xshrxor`.

## Conclusion

The 6-op grammar `v4` is secretly a 4-op grammar. `xorshr` and `rotl` were historical stepping stones that the parallel-reuse ops `xshrxor` and `xrotxor` obsoleted.

We do not need to delete `xorshr` or `rotl` from the frozen v1/v2 layouts (the freeze is permanent), but any future compiler, optimizer, or Lean proof target can soundly lower the entire IR into just these four primitives: `mul`, `add`, `xshrxor`, and `xrotxor`.
