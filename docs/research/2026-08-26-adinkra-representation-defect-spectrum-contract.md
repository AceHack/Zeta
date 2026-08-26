# Adinkra representation-defect spectrum

**Author:** Manus AI (Lumen)
**Status:** Finite executable measurement contract; no physical or agent-level theorem.

## Key recommendation

Replace the binary label “homoiconic or not” with a **typed spectrum**. The uncoded cube, coded
quotient, and named colored residue expose enough structure for a rank-one regular-module
measurement. The current bivector/spinor route does not: `120 + 128 = 248` is a verified dimension
decomposition, not an operator-to-carrier isomorphism. Its correct value is **unmeasured**, not zero,
one, or sixteen.

## Common predicate

For a finite operator algebra `A` acting on carrier `M`, define

```text
δ_reg = dim(A) / dim(M)
```

only when both dimensions refer to the declared action. A rank-one regular module requires
`δ_reg = 1` together with an explicit cyclic generator witness. The existing TypeScript matrix
route computes `dim(A)` from signed edge operators, while the coset route computes `dim(M)` without
using those matrices. This separation makes disagreement possible.

Adinkra chromotopologies are cube quotients by doubly-even binary codes, and the corresponding
graphs encode Clifford/supersymmetry-generator actions.[1] [2] [3] These sources identify the
mathematical objects; they do not establish the repository’s defect measurements or any claim about
network agents.

## Finite spectrum at the repository’s N=8 seam

| Lane                                          |    Carrier `dim(M)` |                        Operator `dim(A)` |    `δ_reg` | Executable verdict                                     |
| --------------------------------------------- | ------------------: | ---------------------------------------: | ---------: | ------------------------------------------------------ |
| Uncoded eight-cube                            |                 256 |                                      256 |          1 | Full-color rank-one regularity measured.               |
| `[8,4,4]` coded quotient                      |                  16 |                                      256 |         16 | Faithful full-color action, not rank-one regular.      |
| Four-color residue on the coded carrier       |                  16 |                                       16 |          1 | Rank-one regular for 56 of 70 four-color subsets.      |
| `so(16) ⊕ Δ⁺₁₆` bivector/spinor decomposition | No declared carrier | No declared associative operator algebra | Unmeasured | Refuse a numerical score until the missing map exists. |

The coded result is not “almost” regular: its defect is the code index `|C| = 16`. The positive
residue is also not a canonical ontology. Exactly 56 four-color subsets work, 14 fail, and every
color occurs in 28 working subsets. The fourteen failures are exactly the supports of the fourteen
weight-four codewords. Selecting one successful subset is therefore a convention that must retain
its witness; the mathematics does not privilege particular colors.

## Non-quotient lane: what is known and what is missing

The standard spinorial construction supplies bivectors carrying `so(16)` and a chiral half-spinor;
the repository’s existing dimension checks yield `120 + 128 = 248`.[4] Bivectors realize `so(V)`
under the Clifford commutator, and even-dimensional spin representations split into half-spinors in
the appropriate signatures.[4]

Those facts show that this lane does **not** apply the `[8,4,4]` binary quotient. They do not make it
comparable under `δ_reg`. A future measured value requires all four witnesses:

| Missing witness          | Falsifiable completion criterion                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Finite basis and bracket | An implemented basis closes under a bracket satisfying antisymmetry and Jacobi controls.                            |
| Declared carrier         | The code names the module on which the candidate operator algebra acts.                                             |
| Explicit action          | Every generator has a deterministic operator on that carrier.                                                       |
| Rank/injectivity test    | Independent routes compute algebra dimension and carrier-orbit rank; a kernel or rank deficit falsifies regularity. |

Until then, `unmeasured` is a load-bearing third state. Treating `248` as both algebra and carrier
dimension would be a self-certifying choice of denominator.

## Independent routes

| Route                    | Reads                                                 | Does not read                                     | Expected output                                                          |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| TypeScript matrix route  | Signed permutation operators and finite-field ranks   | Code index as the answer                          | `dim(A)=256` for uncoded and coded full-color lanes.                     |
| TypeScript coset route   | Quotient representatives                              | Matrix ranks                                      | Carrier dimensions 256 and 16.                                           |
| TypeScript residue route | Orbit rank of each four-color subset                  | Codeword-support criterion                        | 56 working and 14 failing subsets.                                       |
| F# codeword route        | The sixteen generated codewords and support inclusion | TypeScript decoder and matrix-rank implementation | Defect 16; the same 56/14 census; eight balanced inclusion counts of 28. |
| Spinor refusal route     | Existing `120`, `128`, and `248` dimensions           | Any invented carrier map                          | `unmeasured` with an explicit missing-witness list.                      |

## Fault controls

The spectrum is falsified or narrowed by any of the following observations:

1. The two finite-field primes produce different full-lane ranks.
2. The uncoded full-color algebra and carrier dimensions differ.
3. The coded full-color defect differs from sixteen.
4. A weight-four codeword support is classified as a working residue.
5. A working subset remains free after replacement by a known failing support without changing the
   orbit calculation.
6. Any color has a different working-subset inclusion count, which would refute the current
   non-canonicity witness.
7. The bivector/spinor lane receives a numerical regularity value without all declared witnesses.

## Explicit non-claims

This contract does not identify Adinkras with agents, prove physical supersymmetry, establish an E8
theory of physics, infer consciousness or free will, or claim that error correction restores a
quotient pre-image. The coded transport lane may recover a serialized receipt while its full
operator representation remains non-regular. Recovery fidelity and representation regularity are
separate registers.

## Executable artifacts

- `src/Core.TypeScript/research/adinkra-ecc/representation-defect-spectrum.ts`
- `src/Core.TypeScript/research/adinkra-ecc/representation-defect-spectrum.test.ts`
- `src/Core/AdinkraCode.fs`
- `tests/Tests.FSharp/AdinkraCode.Tests.fs`

## References

[1]: https://arxiv.org/abs/0811.3410 "Doran et al., Adinkras for Clifford Algebras, and Worldline Supermultiplets"
[2]: https://arxiv.org/abs/0806.0050 "Doran et al., Topology Types of Adinkras and the Corresponding Representations"
[3]: https://arxiv.org/abs/2110.01665 "Iga, Adinkras: Graphs of Clifford Algebra Representations, Supersymmetry, and Codes"
[4]: https://arxiv.org/abs/0706.2829 "Figueroa-O'Farrill, A geometric construction of the exceptional Lie algebras F4 and E8"
