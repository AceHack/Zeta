# Design Note: The Add/Sub Op-Family and Grammar Evolution

**Author:** Lumen
**Date:** 2026-06-20

## The Question

Does the addition/subtraction op-family (e.g., `x += k` or `x -= k`) force a third grammar evolution (`zeta-ir-v4`), or does it fold into the existing `zeta-ir-v3` vocabulary (`mul`, `xorshr`, `rotl`, `xrotxor`, `xshrxor`)?

## Analysis

To justify a grammar evolution in the Zeta repository, a new operation must be **provably outside** the prior grammar (as demonstrated in `ZetaIrV2.Tests.fs` for `rotl` and `ZetaIrV3.Tests.fs` for `xrotxor`).

### The Behavior of Add/Sub

Addition modulo $2^W$ (where $W$ is the word width) is a fundamentally different algebraic operation than the existing operations:
- `mul k` is multiplication in the ring $\mathbb{Z}/2^W\mathbb{Z}$.
- `xorshr`, `rotl`, `xrotxor`, and `xshrxor` are linear operations over the vector space $\mathbb{F}_2^W$.

Addition by a constant $k$ ($x \mapsto x + k \pmod{2^W}$) is an affine translation in $\mathbb{Z}/2^W\mathbb{Z}$. It propagates carries upwards from the least significant bit to the most significant bit.

### Irreducibility (The Necessity Proof)

Can `add k` be synthesized from the existing operations?
No. The existing operations are either linear over $\mathbb{F}_2$ (XOR-based) or linear over $\mathbb{Z}/2^W\mathbb{Z}$ (multiplication). A translation by a non-zero constant $k$ maps $0 \mapsto k$.
- $0 \times k = 0$
- $0 \oplus (0 \gg s) = 0$
- $\text{rotl}(0, r) = 0$
- $0 \oplus \text{rotl}(0, r_1) \oplus \dots = 0$

Since all existing operations map $0 \mapsto 0$, any sequence of them applied to $0$ yields $0$. Therefore, no sequence of `v3` operations can produce $k \neq 0$ when given $0$ as input. `add k` is strictly outside the `v3` grammar.

## Conclusion

**A new grammar version (`zeta-ir-v4`) is strictly required** to support addition and subtraction.

### The Proposed v4 Grammar

The `zeta-ir-v4` envelope would introduce the `add` operation:
```json
{ "op": "add", "k": <int> }
```
(Subtraction is simply `add -k`, so a separate `sub` op is not strictly necessary, keeping the grammar minimal.)

### Anchoring the Primitive

To land `zeta-ir-v4`, we need a public-domain generator that relies on `add`. Good candidates include:
- **PCG (Permuted Congruential Generator):** Uses addition in its LCG step (`state = oldstate * multiplier + increment`).
- **LCG (Linear Congruential Generator):** The classic $x_{n+1} = (a x_n + c) \pmod m$.
- **ChaCha:** The ChaCha quarter-round heavily relies on addition (`a += b; d ^= a; d <<= 16; ...`).

## Recommendation

We should defer implementing `zeta-ir-v4` until we have a concrete requirement to port a generator that relies on addition (like PCG or ChaCha). The design is sound, the necessity is proven, and the pattern (firewall + widening) is established by `v2` and `v3`.
