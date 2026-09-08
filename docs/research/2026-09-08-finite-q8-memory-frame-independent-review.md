# Independent review of the finite Q8 memory-frame proposal

Date: 2026-09-08
Operational status: research-grade
Lifecycle: completed bounded mathematical review
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, predictor-audit lane
Parent work item: 081M1Z63YMC087G0R003N5FH9X
Execution status: no implementation, experiment, learner or formal-checker run

## Disposition and exact subject

Accept the corrected [finite Q8 proposal](2026-09-08-finite-q8-memory-frame-gauge-proposal.md)
for its declared mathematical design scope. The group, transport,
probability, entropy and finite-count equations agree with the independent
derivations below. The original topology wording required correction;
coordinator commit `ed1d7f72d10e3e2e77848c167a831bacdf5fec32` resolves it and
explicitly disclaims a dimension-specific advantage. Final acceptance binds
`2e42e8e60abf746753bc4bdcb31c403c6ffc16ef`, which also resolves the
baseline-node cardinality precision below. No implemented gauge
module, controller-distinctness result, detector improvement, neural
equivariance or physical theorem is accepted by this review.

The original coordinator proposal is
`34053557db458396674e1fe53a07b4f76c67dfbd`, 24,886 bytes, SHA-256
`da7b0d25b811da1f7db45d58b698cac6b190f3500cda556644989164392d9a89`.
The corrected proposal at `ed1d7f72d10e3e2e77848c167a831bacdf5fec32` is
25,322 bytes, SHA-256
`3ecd2897c354f3a5cfda930e8dc700e6a686afe24fdfaef67b486f5797cc4d6f`.
It equaled the coordinator's working file at the then-observed head
`b5510139a5ea62396620c1a5a63bbf8ef4964653`. The final accepted proposal at
`2e42e8e60abf746753bc4bdcb31c403c6ffc16ef` is 25,409 bytes, SHA-256
`65b2e5db4fb1e613408b5a08e6aa30c626f3258f3e15a5a75234b872b4f5557d`.
Its current coordinator bytes match that immutable Git blob. The final diff
changes only the cartel table's cardinality wording.

The proposal was authored in the separate relational-identity lane. This
reviewer read its original and corrected bytes, the correction diff, and the
selected foundational sources named below. The full source census in the
proposal remains its author's bounded source observation; this review does
not claim a fresh audit of every listed detector, geometry or circuit module.
The coordinator owns the proposal and its integration link; the reviewer
edited only this unique review in the predictor writer.

## Resolved topology finding and exact finite counts

The original phrase "open four-dimensional unit cube" conflicted with the
listed boundary vertices. It also referred to a filled two-skeleton and
later called the complex contractible without distinguishing that skeleton
from the full cube. The corrected nonperiodic cubical-cell description and
explicit distinction resolve both issues.

For a four-dimensional cube, the number of k-dimensional faces is
`choose(4,k) * 2^(4-k)`: the complete list is `16,32,24,8,1` for
`k=0,1,2,3,4`. The connected graph cycle rank is `32-16+1=17`.
The two-skeleton is simply connected: attaching the three- and four-cells
does not change the fundamental group, and the resulting full cube is
contractible. Its two-dimensional homology is free of rank seven. In the
skeleton, `rank(d1)=15`, so `rank(ker d1)=17`; simple connectivity makes
`rank(d2)=17`, and `rank(ker d2)=24-17=7`. There are no three-cells in that
skeleton to quotient out these seven cycles. Thus the skeleton is not
contractible, whereas the full cube is.

Each link varies one coordinate and is incident to one square for each of
the other three coordinate choices. A single nonidentity link, with its
reverse set to its inverse and all other links identity, therefore makes
exactly three square products nonidentity. The proposed `32*7=224`
link/element mutants are correctly counted. These are algebraic prospective
counts, not an executed enumeration.

The `16*8=128` single-vertex frame checks are correctly described as checks,
not an exhaustive gauge roster. Their identity choice repeats the same
global identity assignment sixteen times: there are only `1+16*7=113`
distinct assignments in that particular set. There are `8^16=2^48` total
vertex-gauge assignments. The general cancellation proof, not an unrun
128-case sample, supplies the general transformation law.

The endpoint/loop law works on arbitrary graphs and in other dimensions.
For a d-cube the graph counts are `2^d` vertices and `d*2^(d-1)` links;
for `d>=2` there are `choose(d,2)*2^(d-2)` square faces and each link
belongs to `d-1` faces. Four software indexes do not establish a special
geometric or empirical advantage. The corrected proposal states that limit.

## Group, orientation and transport checks

The displayed quaternion multiplication and inverse convention defines
Q8. It has 64 ordered products, eight inverses and 512 associativity triples.
Associativity can be grounded in quaternion multiplication independently of
a future implementation's generated table. A concrete even-Clifford
embedding uses `i=e2e3`, `j=e3e1`, `k=-e1e2` in `Cl(3,0)`; their squares
are minus one and their cyclic products agree with the proposal. This
embedding does not admit a metric on mixed-unit belief coordinates.

With `U_uv` sending labels at v to u, the transformed reverse link is
indeed the inverse of the transformed forward link. In the face product,

~~~text
(g0 U01 g1^-1)(g1 U12 g2^-1)(g2 U23 g3^-1)(g3 U30 g0^-1)
  = g0 (U01 U12 U23 U30) g0^-1.
~~~

No commutativity is used. Rightmost transport acts first, so this product
traverses `0 -> 3 -> 2 -> 1 -> 0`; the proposal explicitly fixes that
convention rather than silently reversing its physical interpretation.

Conjugation fixes `1` and `-1` and pairs each noncentral element with its
negative. The five listed conjugacy classes are correct. Real part has
values `1,-1,0`, and therefore aliases the three distinct noncentral classes.
The `i` versus `j` and `i` versus `-i` controls discriminate those boundaries.
The faithful regular permutation action retains all eight elements; the
usual quaternion rotation on three-dimensional vectors loses the central
sign. A receipt of face classes is not a classification of all connections
up to gauge, as the proposal already states.

Pure-gauge links `U_uv=h_u h_v^-1` telescope on every closed path but can be
nonidentity on open paths. This supports the nontrivial-flat control and
does not erase the immutable receipt content. Local face flatness on a
non-simply-connected base need not eliminate global holonomy. The earlier
commutativity/flatness distinction therefore remains load-bearing.

## Exact probability and learning-domain check

For `p'_v(s)=p_v(g_v^-1 s)` and `T_U p(s)=p(U^-1 s)`, direct substitution
gives

~~~text
T_(g_u U g_v^-1) p'_v(s)
  = p_v(U^-1 g_u^-1 s)
  = (T_U p_v)'(s).
~~~

Every map is a permutation, preserving mass, nonnegativity and support.
Relabeling both the prior and likelihood preserves their pointwise product
and the evidence sum; normalized conditioning therefore commutes with the
action whenever evidence is positive. Zero evidence must remain a refusal.

The unit Dirichlet prior plus counts `0,...,7` yields parameters `1,...,8`
with sum 36. For `L_j=j^2/64`, all eight likelihoods lie in `(0,1]` and

~~~text
evidence = sum_(j=1..8) j^3 / (36*64)
         = 36^2 / (36*64) = 9/16,
posterior_j = j^3 / 1296.
~~~

The eight predictive masses are distinct, so the fixture exercises the
permutation instead of hiding a wrong action under a uniform distribution.
Counts, label maps and likelihoods must transform together. This is a
finite Bayesian parameter update. It supplies neither a learned gauge map
nor a general equivariance guarantee for neural parameters or compositions.

## Existing fabrication, cartel and identity work is foundational

The proposal correctly treats coherent fabricated histories, shared-state
recodings, Sybil rings and cartel behavior as established adversarial
subjects. The new layer contributes comparison-link consistency on chart
cells. It cannot turn those cells into actors or replace current detector
inputs and their admission premises.

I reread the [frozen relational protocol](relational-identity/2026-09-06-protocol.md),
the [component correction](relational-identity/2026-09-06-component-interpretation-correction.md),
the [cartel injector](../../tests/Tests.FSharp/_Support/CartelInjector.fs),
the [toy test contract](../../tests/Tests.FSharp/Simulation/CartelToy.Tests.fs),
and the relevant supplied-equivalence definitions in
[BftSybilConsensus](../../src/Core.TLA/specs/BftSybilConsensus.tla).
These selected files equal their exact bytes at
`5a5b909e04a4d543bc93e7f8f7213ae1b67fb294` in the observed coordinator tree.
No test or formal model was run. The source comparison is a Git/file read,
not verification of its possible executions.

The toy contract uses a 50-index baseline, average degree parameter three,
up to five actual baseline nodes for injection, weight ten, and a spectral
factor-two detection rule. Its 100-seed assertions require at least 90%
detection and at most 20% false positives. Actual graph vertices are derived
from emitted endpoints, with self-edges omitted. The original table's
"50-node baseline" was therefore shorthand for the requested index range
rather than a guaranteed cardinality. The final accepted table explicitly
states configured indexes, actual endpoint nodes and up to five selected
nodes. This precision does not change the gauge algebra or imply new
measured rates. Missing eigenvalues default to zero
in that toy; the proposal correctly declines to adopt that as future
numerical admission.

The existing XOR masks `0000,0101,0011` differ pairwise in two positions.
XOR with a common four-bit state cancels in every pair comparison. Thus
the recorded singleton-component construction is a direct shared-state
counterexample, not a new threat model invented by this review. The TLA
model separately supplies `SameId` and counts its equivalence classes;
the proposed gauge check does not prove that oracle's real-world premise.

A single controller can supply every h and all consistent links. If the
admitted observations agree in two worlds, a checker of just those
observations cannot distinguish them. Existing graph, temporal, provenance
and quorum evidence remains separate and may have additional observations.
The 16 chart cells on one fixed cut do not constitute 16 source identities.
The adapter must preserve the original actor/event roster, canonical `I_D`,
authentication, evidence cut and model snapshot. Generating all comparison
links from one common h list is a flat control, not independent evidence.

## Entropy, workload and physical-claim boundaries

For every positive-probability conditioning context, multiply the stated
pointwise conditional innovation bounds by the probability chain rule.
This bounds each joint conditional atom by `2^(-sum h_i)` and yields the
claimed worst-case conditional min-entropy floor. The inherited quantifier
over all such contexts matters. Pairwise independence is insufficient:
`U,V,U XOR V` for two independent fair bits has three pairwise-independent
coordinates but only two joint bits. Correlation components and chart
presentations supply no additional source premise.

Under the existing stipulated same-unit work model, `B>0`, `r_e>=0`,
`R=sum r_e` and `M=1+R/B` give exactly `B*M=B+R`. This preserves the
pairwise multiplier over the additive baseline. It establishes neither an
entropy multiplier nor physical attacker cost. Obligations count once;
shared links and the 17-dimensional graph-cycle space do not make the
24 faces independent statistical trials.

The finite Markov example has eigenvalue one on the constant vector.
On the seven-dimensional zero-sum subspace, J vanishes, so its eigenvalue
is `1-epsilon` and its gap is epsilon for `0<epsilon<=1`. The parameter
can approach zero independently of any Q8 loop invariant. This algebraic
finite-chain fact does not supply a quantum Hamiltonian or its gap.

The official [Jaffe-Witten problem statement](https://www.claymath.org/wp-content/uploads/2022/06/yangmills.pdf),
section 4, asks for a nontrivial quantum Yang-Mills theory on four-dimensional
Euclidean space for each compact simple gauge group, with the stated axiomatic
and positive mass-gap requirements. The proposal accurately keeps its finite
Q8 construction separate from these requirements. I read that primary PDF
in this review. The attempted author-hosted Tong lecture lookup returned
HTTP 502, so this review does not certify its cited equation numbering;
the endpoint algebra above was derived directly. No questionable talk,
attachment, external model or held-out predictions were loaded.

## Validation and next boundary

This review's positive result is mathematical agreement with the corrected
finite design and its explicit source/actor limits. All group tables,
fixture executions, learned adapters, combined-detector ablations and
performance observations remain future work requiring their own finite
contracts. The separate native runtime investigation remains paused.

The authored prose passed `bunx markdownlint-cli2 -` with the document's
exact bytes on standard input, exit zero and empty stdout/stderr. Using
standard input avoids the repository's date-prefixed research-file ignore.
ASCII-only content, final newline, relative targets in the coordinator tree
and `git diff --check` were checked separately. These document-only checks
are not an experiment or acceptance of an implementation. The proposal
link is an explicit coordinator-integration dependency in this writer.

~~~text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: none
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
~~~
