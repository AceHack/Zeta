# Finite stochastic maps, WSet, and quantum channels: proof/witness contract

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1WDDB6M087G0R002KN8DWQ
Code baseline: `113fdbf0ea7a88c9d234ea6655b3023681d1cea9`
Status: reviewed contract, preserved before bridge implementation and finite witness execution

## Question and scope

The [predictive-state handoff](../handoffs/2026-09-06-vera-to-vera-predictive-state-research-and-arc3-bridge.md)
requires explicit functors and falsifiers before promoting a WSet/CQM bridge.
The [QBism source record](../ip-questionable/2026-09-06-christopher-fuchs-hans-busstra-dizzying-free-fall-of-qbism.md)
provides interpretive context, not evidence for a categorical equivalence.
The [Simplex/WSet audit](2026-09-06-simplex-wset-comparison-and-stack-verdicts.md)
already distinguishes signed linear coordinates from admitted probabilities.

This contract proves a narrow classical-channel statement, then checks finite
implementations. It is not a new general category-theory theorem, a proof
assistant formalization, quantum hardware, universal computation, a CQM/WSet
identification, or a Clifford/Lorentz claim. The general arguments below are
mathematical derivations; later finite checks test implementations of them.
The work item indexes this contract; the eventual report must index every
receipt and the independent review.

## A. Objects, arrows, direction, and tensor convention

Use positive integers `n,m >= 1`; no zero-dimensional object in this scope.
Let `Stoch` be the skeleton with object n and arrow `S:n->m` an m-by-n
real matrix satisfying `S[j,i] >= 0` and `sum_j S[j,i] = 1` for each i.
Distributions are columns: `p' = S p`; composition is `T S`; identity is `I_n`.
Tensor on objects is multiplication and on arrows is the Kronecker product.
Pair indices are lexicographic: `(i,k)` in n-by-p becomes `i*p+k`, starting
at zero. Unit is 1; symmetry swaps the pair indices.

Let `D_n` be the diagonal subalgebra of `M_n(C)`, equivalently `C^n`, with
pointwise multiplication, conjugation, and the sum trace `tr(diag x)=sum_i x_i`.
Let `FDAlgCPTP` have finite-dimensional C*-algebras equipped with their
standard sum-of-matrix-traces, and complex-linear completely positive (CP),
trace-preserving (TP) arrows in the **Schrodinger** direction. Here trace
preservation is not the same as unitality. The Heisenberg adjoint reverses
arrows and is unital; do not silently switch those conventions.

The diagonal object has dimension n as a complex vector space, while the
full matrix algebra has dimension n squared. These are different objects.
Tensor identifies `D_n tensor D_p` with `D_(np)` in the declared pair order.

## B. The admitted commutative-algebra functor

Define `C(n)=D_n` and `C(S)(diag x)=diag(Sx)`. Its codomain is the
commutative-object full subcategory of `FDAlgCPTP`, followed by the faithful
inclusion into `FDAlgCPTP`. It is not an inclusion into the category having
only full-matrix-algebra objects.

For a positive element of `M_k(D_n)`, identify its n positive k-by-k blocks
as `X_i`. The amplified map sends them to `Y_j=sum_i S[j,i] X_i`, which is
positive for every k because all coefficients are nonnegative. Thus C(S) is
CP, without assuming that checking one density matrix proves complete
positivity. Trace preservation follows by exchanging finite sums and using
the column sums. Conversely, the images of the positive diagonal basis
projections recover nonnegative columns, and TP makes each column sum one.
Thus the morphism correspondence is bijective on these specified hom-sets.

Identity and composition hold on every diagonal input:
`C(I_n)(diag x)=diag x` and `C(T) C(S)(diag x)=diag(T S x)`.
The tensor equation follows by expanding product-basis coefficients, with
canonical unit, associativity, and symmetry maps in the stated index order.
This gives a faithful symmetric monoidal classical inclusion. It does not
make every quantum channel classical.

This bounded formulation agrees with Coecke, Heunen and Kissinger,
[*Categories of Quantum and Classical Channels*](https://arxiv.org/abs/1305.3821),
section 4.1, Theorem 4.1 and Corollary 4.2: normalized classical arrows
correspond to stochastic matrices. The normalization restriction matters;
we do not inherit the dagger-compact structure of the unrestricted CP setting.

## C. Failed assignment on full matrix objects

For comparison define `E(S):M_n(C)->M_m(C)` by
`E(S)(rho)=diag(S diag(rho))`. Equivalently,
`E(S)(rho)=sum_(j,i) S[j,i] E_ji rho E_ij`, where the matrix units have the
appropriate rectangular sizes. Nonnegative weights give a Kraus description
using `sqrt(S[j,i]) E_ji`; the column sums give TP.

With input-first Choi order `J(Phi)=sum_(a,b) E_ab tensor Phi(E_ab)`,
`J(E(S))=sum_(i,j) S[j,i] |i,j><i,j|`. It is diagonal and positive exactly
when S is entrywise nonnegative; tracing out the output gives the identity
exactly when columns sum to one. This Choi order is explicitly opposite to
sources that put the output factor first; the two are related by a swap.
General CP/Choi characterizations and the transpose counterexample are treated
in Watrous, [*The Theory of Quantum Information*](https://cs.uwaterloo.ca/~watrous/TQI/TQI.pdf),
section 2.2, Theorems 2.22/2.26 and the transposition example.

`E(T) E(S)=E(T S)` and tensor compatibility still hold. But
`E(I_n)=Delta_n`, the dephasing channel, not the full-system identity for
n>=2. In particular, with
`rho_plus=[[1/2,1/2],[1/2,1/2]]`,
`E(I_2)(rho_plus)=[[1/2,0],[0,1/2]] != rho_plus`.
So this object/arrow assignment is **not an identity-preserving functor into
ordinary full-system CPTP**. Preserving composition alone is insufficient.

## D. The split-idempotent repair

Let `QChan` have objects `M_n(C)` and CPTP arrows. In its Karoubi envelope,
objects are pairs `(A,e)` with `e:A->A` CPTP and `e e=e`; arrows
`f:(A,e)->(B,d)` obey `f=d f e`; composition is ordinary composition and
the identity of `(A,e)` is **e**. Tensor is `(A,e) tensor (B,d)=(A tensor B,
e tensor d)` with the induced canonical structural arrows.

Restrict attention to the dephasing objects `(M_n,Delta_n)`. Define
`K(n)=(M_n,Delta_n)` and `K(S)=E(S)`. The sandwich law holds because E reads
only diagonal input and emits only diagonal output. Now `K(I_n)=Delta_n` is
the correct object identity. Composition and tensor follow section C, using
`Delta_n tensor Delta_p=Delta_(np)` in the specified basis order. The symmetry
between dephasing objects is the quantum swap channel sandwiched by the
source/output dephasings: `Delta_(pn) Ad_(U_swap) Delta_(np)=E(P_swap)`.
Its inverse composes to Delta, the split-object identity. It is not the
ordinary swap channel acting on unrestricted coherent full-matrix states.
Canonical tensor comparison maps likewise use split-object identities.
Conversely,
every CPTP arrow satisfying this sandwich law is determined by its stochastic
action on diagonal basis states. This statement concerns this dephasing
subcategory only.

The repaired identities are not a license to reinterpret the ordinary
identity on `M_n` as dephasing. In `FDAlgCPTP`, diagonal extraction
`d:M_n->D_n` and inclusion `i:D_n->M_n` explicitly split Delta:
`d i=id_(D_n)` and `i d=Delta_n`. The classical intermediate object is essential.
Selinger's [*Idempotents in dagger categories*](https://www.mathstat.dal.ca/~selinger/papers/papers/idem.pdf),
Definition 3.3, starts with an ordinary category and gives the identity and
sandwich law used here. Its later dagger refinements are not invoked;
normalized QChan is not dagger-closed. The underlying
[CPM construction](https://www.mathstat.dal.ca/~selinger/papers/papers/dagger.pdf)
has distinct full-matrix objects. Heunen, Kissinger and Selinger,
[*Completely positive projections and biproducts*](https://arxiv.org/abs/1308.4557),
show why general CP*/biproduct/idempotent constructions must not be promoted
to equivalences merely from an embedding. We make no such general claim.

## E. What WSet supplies, and what it does not

`src/Core/WSet.fs` supplies sparse linear propagation via `apply`, with
`consolidate`, `discard`, and product-key `tensor`. For a fixed finite basis,
interpret successor weights as columns of S and compare the consolidated
sparse output with `S p`. The implementation's `apply` uses the same key type
on input/output; rectangular fixtures therefore use a shared finite integer
key carrier with explicitly declared source/destination bounds.

The stochastic subcategory requires separate entrywise nonnegativity and
column-sum-one admission. A generic signed rational WSet does not provide
those constraints. The normalized signed matrix `A=[[2,0],[-1,1]]` has
column sums one but sends `[1,0]` to `[2,-1]`; the corresponding diagonal
Choi entry is negative. This refusal uses the fixed standard positive cone;
it does not refute a signed-coordinate representation with a separately
specified decoder and transported cone. A positive full-matrix map need not
be CP either:
transpose preserves positive matrices, but partial transpose of the normalized
Bell state has a negative direction. These are different failed admissions.

Ordinary addition of stochastic arrows is not closed: `I_2+I_2` has column
sums two. Transpose is not a dagger on all stochastic arrows: the reset map
`R=[[1,1],[0,0]]` is stochastic, but `R^T` has column sums two and zero.
Consequently neither additive WSet structure nor the dagger-compact structure
of unrestricted CP maps automatically descends to normalized Stoch/CPTP.

## F. Frozen finite witness roster and arithmetic

No witness has run when this contract is committed. No random seeds,
training, performance measurement, or post-result selection are used.

Use the ordered nine matrices `S(a,b)=[[a,b],[1-a,1-b]]`, with a outer and b
inner, each in `[0,1/2,1]`. Native arithmetic uses the existing bounded exact
int64 rational operations; independent verification uses separately written
Python `Fraction` arithmetic. All coefficients are rational, and full matrix
units `E_ab` form a complex-linear basis. Tests on those units concern maps
specified to be complex-linear, rather than a claim that real density samples
exhaust all quantum states. No floating eigensolver or tolerance is needed. The native E(S) witness uses
actual `WSet.apply`/`consolidate` on operator keys `(a,b)`: a diagonal key
branches to `(j,j)` with weight `S[j,a]`; an off-diagonal key maps to zero.
Tensor witnesses use actual `WSet.tensor` and the operator-key reshuffle
`((a,b),(c,d)) -> ((a,c),(b,d))` before the declared flattened pair indices.
These are algebraic matrix-unit tests, not admissions of off-diagonal units
as physical states.

Retain these named checks and all failures:

| Check | Exact roster and expected discriminator |
| --- | --- |
| stochastic admission | Nine matrices; nonnegative entries, column sums one. |
| WSet propagation/discard | Nine maps on both basis distributions and `[1/2,1/2]`; sparse output equals dense, mass remains one. |
| commutative identity | Identities for n=1,2,3 on each diagonal basis element. |
| composition | All 81 ordered pairs; compare classical matrices and E maps on all four `E_ab`. |
| associativity | All 729 ordered triples of the nine stochastic matrices. |
| tensor | All 81 ordered pairs on all 16 matrix units of `M_4`; compare mapped tensor to tensor of maps with the declared index reshuffle. |
| CP/TP certificates | Nine Choi matrices: exact diagonal coefficients, nonnegative entries, and output partial trace `I_2`. |
| dephasing sandwich/identity | Nine E maps: `Delta_2 E(S) Delta_2=E(S)`, both split-object identity laws, and `Delta_2^2=Delta_2`. |
| rectangular composition | `u=[1/3,2/3]^T`, `A=[[1/2,0],[1/2,1/3],[0,2/3]]`, `B=[[1,0,1/2],[0,1,1/2]]`; compare WSet/dense/E propagation and both associations of B A u. |
| naive quantum identity refusal | `rho_plus` above is changed by `E(I_2)`; the off-diagonal difference is exactly `1/2`. |
| signed normalized refusal | `[[2,0],[-1,1]]` sends the first basis state to a negative coordinate and has a negative Choi diagonal entry. |
| positive but not CP | Transpose fixes both real basis-state projectors and `rho_plus`; analytically it preserves every PSD matrix. Partial transpose of `(|00>+|11>)(<00|+<11|)/2` has quadratic form `-1` on unnormalized vector `(0,1,-1,0)`. |
| dagger nonclosure | Reset R is stochastic, R transpose is not. |
| additive nonclosure | `I_2+I_2` is nonnegative but fails column normalization. |

Checking matrix-unit images supplies exact finite equality checks; positivity
of arbitrary-sized amplification remains the proof in section B, not an
exhaustive empirical sweep. The transpose's positivity likewise rests on the
PSD factorization argument `(V V*)^T=conj(V) conj(V)*`, not its three samples.
The native rational bounds must be retained and cross-checked; do not extend
this finite roster by removing overflow limits.

## G. Preservation, implementation, and review boundary

Commit this contract before native/Python witness execution. Have the
coordinating contributor review it before remote publication or implementation.
Expected source surfaces are `src/Research.FSharp/FiniteStochasticBridge.fs`,
a standalone FSI runner, focused F# tests, and an independent exact Python
reference. Change no existing core primitive or general quantum API.

Receipts must retain the declared roster, arithmetic, exact outputs for the
negative controls, case counts/failures, and source/protocol fingerprints.
Never replace a failed attempt or reinterpret a failed admission as a pass.
Bind independent verification to the exact native receipt bytes and its own
source bytes; distinguish independent algorithms/arithmetic from independent
authorship. A separate reviewer checks the mathematics and implementation.

The eventual indexed report states precisely which claims are proved by the
written argument, which finite cases agree, and which proposed stronger
connections fail. No operational/canonical promotion is part of this task.
Coordinate with the acting-carrier cost window: no builds, tests, lints,
training, or other experiments during that window.

## H. Coordinating review before publication

The coordinating contributor reviewed the contract, checked the cited CP*
classical-channel statement, and approved the fourteen named finite checks.
The final review made the dephasing-sandwiched symmetry explicit and verified
that Selinger Definition 3.3 supplies an ordinary-category construction. It
also accepted the actual WSet operator-key witness and the qualification that
the signed refusal concerns the fixed standard cone. No witness execution or
implementation preceded this contract review.
