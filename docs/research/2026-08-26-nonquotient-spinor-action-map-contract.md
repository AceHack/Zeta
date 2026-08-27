# Non-Quotient Half-Spin Action-Map Contract

**Status:** bounded finite census specification. It is not an `E8` construction certificate, a regular-representation certificate, or a physical claim.

## 1. Target

The executable target is the standard complexified action

\[
\rho : \mathfrak{so}(16,\mathbb C) \otimes S^+ \longrightarrow S^+,
\]

realised on the even sector of the eight-mode exterior/Fock carrier. The carrier has `2^8 = 256` basis states and the even-parity sector has `128` states. The census must construct sixteen Clifford generators, restrict their bivector products to the even sector, and record the resulting `120` generator actions.

This is a declared complexified action model. It does **not** silently identify the chosen basis with the repository's real half-spin carrier. A real-form comparison requires a separately specified real structure.

## 2. Claims Capable of Failing

| Claim                                                 | Finite falsifier                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Clifford generators satisfy the declared relation     | Any basis vector and generator pair violates the anticommutator identity.            |
| The selected chiral carrier has dimension 128         | The parity census differs from `128 / 128`.                                          |
| Each bivector action preserves chirality              | Any even basis state maps outside the even sector.                                   |
| The 120 bivector actions are independent              | A nontrivial finite linear relation is found by the sparse-support pivot census.     |
| Their commutators close in the declared bivector span | A generator-pair commutator has no exact sparse representative in the measured span. |
| The checks are load-bearing                           | A sign/parity mutant survives all controls.                                          |

## 3. Explicit Refusals

The census must continue to report `unmeasured` for all of the following until separate executable witnesses exist:

1. The spinor–spinor bracket `Λ²S⁺ → so(16)` and its normalization.
2. The mixed Jacobi identity needed to join `so(16) ⊕ S⁺` into an `E8` Lie algebra.
3. Any regularity, homoiconicity, or representation-defect score for this non-quotient lane.
4. Any claim that this algebraic carrier represents agents, transport, physics, or a universal identity.

## 4. Independence

The TypeScript route must derive actions from fermionic creation and annihilation on basis masks. An independent F# route, if added, must derive the same finite action relation from a separate implementation, not import the TypeScript multiplication table. The pre-existing coded Adinkra census is a comparison lane, not evidence for this action.

## References

1. José Figueroa-O'Farrill, [_A geometric construction of the exceptional Lie algebras F4 and E8_](https://arxiv.org/html/0706.2829v1), 2007/2008.
2. Stefan Floerchinger, [_Real Clifford algebras and their spinors for relativistic fermions_](https://arxiv.org/html/1908.02235v1), 2019.
