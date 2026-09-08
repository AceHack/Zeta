# A finite Q8 gauge check for pairwise memory frames

Date: 2026-09-08
Operational status: research-grade
Lifecycle: active proposal
Registration status: unregistered; no implementation or experiment
Author: Vera, OpenAI Codex using GPT-6 Astra
Session: codex/20260907-c7b2a403
Parent work item: 081M1Z63YMC087G0R003N5FH9X

## Purpose and provenance

The proposed computer-science connection is a finite consistency check on
independently supplied pairwise translations of memory representations.
Local changes of representation conjugate a loop product; its conjugacy
class is invariant. This gives a precise additional observation to combine
with Zeta's existing adversarial machinery. It does not identify independent
agents from consistency, prove a physical symmetry, or solve Yang-Mills.

The motivating talk is attributed separately in the coordinator's
[minimal IP source record](../ip-questionable/2026-09-08-voyager-yang-mills-mass-gap-talk.md).
This note contains no copied attachment, transcript, or claimed verification
of that talk. The mathematical definitions below have independent primary
sources. The coordinator owns integration, indexing and independent review.

Repository source was inspected read-only in the coordinator writer at
`5a5b909e04a4d543bc93e7f8f7213ae1b67fb294`; this note is authored in the
separate relational-identity writer. Existing registered protocols, room
observations and receipt bytes are unchanged. No source generator, learner,
policy, native target, formal checker or numerical experiment ran for this
note. Proposed counts below are mathematical roster specifications, not
reported test results.

## Existing adversarial mechanisms remain load-bearing

Fabricated memories, coordinated histories, coalitions and Sybil rings are
expected adversarial behavior in Zeta's existing research and tests. They are
not a new concern discovered by this proposal. A flat colluding connection
below is a required control for the added gauge layer, not evidence that
Zeta lacks cartel detection.

| Existing surface | Actual inspected mechanism | Scope that remains necessary |
| --- | --- | --- |
| [Graph](../../src/Core/Graph.fs) | Spectral growth and modularity-shift composite; robust baseline z-score variant; density, exclusivity, conductance and covariance-acceleration primitives. | Baseline choice, observed graph, calibration and numerical admission matter. The implemented robust composite has two terms; the source identifies the full six-term composite as further work. |
| [Temporal coordination](../../src/Core/TemporalCoordinationDetection.fs) | Lagged correlation, phase-locking value and offset, significant lags and contiguous burst alignment. | Correlation and synchrony are observable signals; honest shared causes and adaptive evasion require separate controls. |
| [Cartel injector](../../tests/Tests.FSharp/_Support/CartelInjector.fs) and [toy tests](../../tests/Tests.FSharp/Simulation/CartelToy.Tests.fs) | The baseline generator is configured for 50 indexes; actual nodes are emitted edge endpoints. The injector chooses up to five actual nodes for a weighted clique. Existing 100-seed assertions require at least 90% detection and at most 20% false positives for the specified spectral rule. | These are inspected test contracts, not fresh measurements here or universal detection rates. The toy helpers default missing eigenvalues to zero; a future combined receipt must retain numerical failure separately rather than adopt that convention as admission. |
| [CoordRisk spectral cross-verification](../../tests/Tests.FSharp/Formal/CoordRiskSpectralCrossVerify.Tests.fs) | Independent Jacobi-eigensolver witnesses for complete graphs, hubs, bridged cliques and disconnected cliques; FsCheck properties for the spectral quantities. | These are bounded numerical/graph-law checks, including Fiedler collapse under disconnection. They do not identify intent from topology or prove the entire production composite. |
| [BftSybilConsensus](../../src/Core.TLA/specs/BftSybilConsensus.tla) | Explicit three-node Sybil ring among five nodes; raw-node majority can fail distinct-identity quorum. Equivocating classes support neither value; an expected-violation witness makes the raw-versus-distinct distinction load-bearing. | The model supplies `SameId` as an equivalence relation. Sound real-world distinctness is a premise, not learned from its voting trace. The finite majority model is not a general asynchronous Byzantine consensus theorem. |
| [Bayesian AntiSybil](../../src/Bayesian/AntiSybil.fs) and [CoordinationSpectrum](../../src/Core/CoordinationSpectrum.fs) | History-correlation information-value discounts and a sorted pairwise CHSH-derived fingerprint with known-spectrum matching. | These are statistic and matching APIs. Neither their names nor a returned match overrides the retained component/source distinction below. |

The earlier [cartel lab closure](../aurora/2026-04-24-amara-cartel-lab-implementation-closure-plus-5-5-thinking-verification-17th-ferry.md)
and [June research framing](2026-06-07-heartbeats-are-useful-work-network-differentiation-cartel-detection-mass-anti-sybil-provable-math-aaron.md)
preserve the historical program. Current implementation, formal premises
and retained corrections take precedence over broad prose such as
"uncorrelated implies independent."

The [component-interpretation correction](relational-identity/2026-09-06-component-interpretation-correction.md)
already supplies a constructive shared-state XOR-mask counterexample:
three singleton correlation components can come from one state. Joined
components likewise do not prove common control. The
[relational results](relational-identity/2026-09-06-results.md) already include
coherent fabricated history. The gauge proposal adds a consistency
observable to this established adversarial program without erasing its
negative results or replacing its detection mechanisms.

## The immutable receipt invariant comes first

Preserve the [frozen relational protocol](relational-identity/2026-09-06-protocol.md)
and its exact invariant:

~~~text
I_D = (canonical typed receipt contents on D,
       transitive happens-before relation on D,
       consolidated signed claim map on D).
~~~

`D` is the declared parent-closed cut. Canonical contents retain event IDs,
ordered actor/counterparty identities, interaction, channel, claim, signed
weight and parent IDs. Authentication checks those immutable contents.
Attestation encoding, arrival order, local positions and clock readings are
not canonical content. Different valid signature encodings can represent the
same content; changed signers or payloads cannot.

The existing transport groupoid permits content-preserving coordinate
bijections that respect causal order. Its forgetful map preserves canonical
event IDs and the event poset. It supplies no metric, boost, propagation
speed, Clifford functor or CQM structure. A negative claim weight retracts
the consolidated view without deleting its causal history. Distinct
actor/channel experiences need not agree in belief.

Every proposed gauge receipt must bind `D`, `I_D`, the exact evidence cut,
model/parameter snapshot, edge-comparison source and admitted identity
roster. A gauge transformation changes representation only. It cannot
rewrite a canonical receipt, signer, training evidence set or learned
artifact. Unknown coverage stays unknown; replayed identical receipts add
neither interactions nor source credit.

## Existing geometry and circuit composition

[ReferenceFrameFactorHeterarchy](../../src/Bayesian/ReferenceFrameFactorHeterarchy.fs)
already implements typed object-plus-pose evidence fusion. Its
`ParentChildLink.ChildToParent` is a pose; `tryComposeParentPath` composes
declared parent links. `Gaussian3` and `LogCategorical` use separate
factor graphs. Evidence fingerprints, duplicate dispositions and conflict
receipts retain changed-content observations. The source explicitly says
this is not a learner or cortical simulation; `Cl3` supplies a three-dimensional
rotation action, while probabilities have their own message algebra.

[AdinkraEquivariantFactorLayer](../../src/Bayesian/AdinkraEquivariantFactorLayer.fs)
already supplies deterministic signed-permutation sectorization and a
factor-DAG descriptor with `LearnsWeights = false`. This is actual
compositional machinery, not a trained edge module.

These are closer reusable boundaries than an undifferentiated appeal to
Clifford algebra. Neither implements a general map from the immutable
receipt groupoid or a real memory atlas to the Q8 construction below.
Existing pose rotation also cannot simply stand in for the full Q8 label
action: the usual quaternion-to-three-dimensional-rotation map identifies
`q` and `-q`, losing the distinction between the two central Q8 elements.
The categorical regular action proposed below is faithful and preserves it.

## Four axes are declared representation indexes

Use the nonperiodic cubical cell complex with vertices `{0,1}^4`. Its two
values on each axis select an admitted presentation of the same fixed `D`:

| Axis | Two prospective presentation choices | Required admission |
| --- | --- | --- |
| Observer view | Two charted views of the same cut. | Both disclose the same immutable receipt structure; different experiences are not forcibly identified. |
| Clock origin | Offsets 0 and 1000. | Only local coordinates change. |
| Clock scale | Positive scales 1 and 7. | Causal order and coordinate uniqueness remain valid. |
| Concurrent order | Two topological orders of a causal diamond. | Only incomparable events exchange positions. |

These are arbitrary, explicitly chosen software indexes. They are not
physically motivated time and three spatial axes. Their Cartesian product
is a proposed finite representation fixture, not a claim that every real
memory admits these independent chart choices. Where the product cannot
be constructed on one `D`, admission must fail rather than fill missing
cells with invented memories.

The cube has 16 vertices, 32 undirected links and 24 square faces. These are
chart cells and comparison obligations, not 16 identities. Its connected
one-skeleton has cycle rank `32 - 16 + 1 = 17`; the 24 faces share links and
are not 24 independent statistical witnesses. The filled two-skeleton is
part of the declared object; changing to a torus changes the problem. This
two-skeleton is simply connected, but is not itself contractible: its second
homology has rank seven. The full four-dimensional cube is contractible.

No mapping from an actual memory atlas to this cube, no extractor of Q8
edge labels from real learned representations, and no memory-frame-to-Q8
adapter is implemented. A future application must supply and validate that
map. Choosing four indexes alone supplies no such evidence. The endpoint and
loop-conjugation laws work in other dimensions too; this proposal identifies
no property that makes four software axes uniquely necessary. A later
four-dimensional advantage claim would require an additional hypothesis and
dimension-matched comparisons.

## Exact finite connection and loop invariant

Choose the quaternion group:

~~~text
Q8 = {1, -1, i, -i, j, -j, k, -k}
i*i = j*j = k*k = i*j*k = -1
i*j = k, j*k = i, k*i = j
j*i = -k, k*j = -i, i*k = -j.
~~~

Store an oriented link `U_uv` transporting a label at `v` to a label at `u`,
and require `U_vu = inverse(U_uv)`. For an independently chosen local
representation `g_v` at each vertex, define

~~~text
U'_uv = g_u U_uv inverse(g_v).
H_01230 = U_01 U_12 U_23 U_30.
H'_01230 = g_0 H_01230 inverse(g_0).
~~~

The loop is specified by this ordered product; with the stated receiving
convention its actual transport traverses the vertices from right to left.
The final law follows by cancelling adjacent `inverse(g_v) g_v` and does
not require commutativity. Retain the complete conjugacy class of every
oriented face product:

~~~text
{1}, {-1}, {i,-i}, {j,-j}, {k,-k}.
~~~

Also retain the deliberately weaker scalar `W(H) = Re(H)`, equal to 1, -1
or 0. It aliases all three noncentral classes. A scalar-only checker must
therefore be discriminated by `i` versus `j`, while `i` versus `-i` remains
an allowed same-class comparison. Even the full list of face classes is
not claimed to classify every connection up to gauge.

This is the finite analogue of link transformation and Wilson-loop
conjugation, with orientation fixed explicitly. The primary lattice source
is [Wilson (1974), Confinement of quarks](https://doi.org/10.1103/PhysRevD.10.2445).
[Tong's author-hosted lattice lectures](https://www.damtp.cam.ac.uk/user/tong/gaugetheory/4lattice.pdf),
section 4.1, equations 4.8 and 4.22, give the endpoint action and normalized
loop trace. The Q8 choice, software axes and anti-Sybil interpretation here
are this proposal, not claims made by those sources.

Q8 can be represented by unit quaternions, hence within the even
Clifford algebra `Cl(3,0)`. That is an algebraic representation fact; it
does not validate a Gaussian belief metric. In particular,
[CliffordAntiSybil](../../src/Bayesian/CliffordAntiSybil.fs) maps
`(PrecisionMean, Precision, 0)` to a vector and its source warning records
the mixed units, unit-sensitive intermediate scores and invalid
negative-precision rotation control. The
[August 20 analysis](2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-and-the-flat-rotor-verdict-moves-with-the-units-lumen.md)
is retained prior evidence, not a new measurement here. This proposal
neither repairs that score nor identifies its coordinate plane with the
four-axis cube.

## The August 17 holonomy objection remains valid

The earlier
[four-properties refutation](2026-08-17-path-independence-is-four-properties-refuting-the-monoid-bell-holonomy-calm-identification.md)
separated commutative merge, Bell assumptions, flatness and CALM. Its
relevant discriminators remain decisive: an abelian `Z4` link assignment
can have nonidentity plaquette holonomy, while a nonabelian `S3` connection
with identity links is flat. Flatness is a property of the assigned
connection, not of whether its value group is commutative.

The present construction adds explicit link data and a transformation law;
it does not rename `ZSet` addition as parallel transport. Associativity
alone does not make a state-dependent fold order independent, and
consolidated signed addition is not an idempotent CRDT join.

This note also does not adopt the older document's broad surviving
identification of a flat connection with an empty-information corner.
Even on this simply connected cubical base, a flat connection can have nontrivial
open-path translations `U_uv = h_u inverse(h_v)` and accompany nonempty
immutable receipts. On a non-simply-connected complex, flatness can coexist
with global loop holonomy. Those distinctions require an explicit base
complex and maps; a monoid name does not provide them.

## A small Bayesian connection with a valid probability domain

Use Q8's regular permutation action on eight categorical hypothesis
labels, in the displayed group order. For a distribution `p_v`, define

~~~text
p'_v(s) = p_v(inverse(g_v) s)
(T_U p_v)(s) = p_v(inverse(U) s).
~~~

Then `T_U' p'_v = (T_U p_v)'` at the receiving vertex. Permutation preserves
total mass and positivity. Apply the same relabeling to the likelihood;
pointwise multiplication and the normalization sum show that conditioning
commutes with this relabeling. Zero evidence still refuses. The group
action here is on labels; it never creates negative probability mass.

A prospective nonuniform exact fixture uses a Dirichlet prior with eight
unit parameters and observed counts `0,1,...,7`. Its updated parameters
are `1,2,...,8`, giving posterior predictive mass `p_j = j/36` for
`j=1,...,8`. With likelihood `L_j = j^2/64`, the evidence is `9/16` and
the conditioned mass is `j^3/1296`. These rational formulas specify a
future discriminator; they were derived algebraically, not executed here.
All support entries, likelihoods, counts and inverse maps must be retained.

The existing exact
[room reference](../../src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py)
has generic distribution, bijective transport and conditioning operations
that could check the finite identities independently. The proposed
Dirichlet count update is additional work; it is not part of the previously
measured room result. It would be Bayesian parameter learning from stated
observations, not a learned neural representation or learned gauge map.

For a future compositional neural learner, relabeling outputs alone is
insufficient. Its parameters or canonicalization must transform compatibly,
its composed modules must preserve the declared law, and its evidence and
weight snapshots must remain bound. No such claim follows for arbitrary
neural DAGs from the categorical example.

## Discriminating controls for a separately specified implementation

No control in this section has run. A later registration must freeze the
complete receipt schema, roster, source and acceptance conditions before
execution; this note introduces no performance threshold or random seed.

| Control | Required observation and falsifier |
| --- | --- |
| Exact group laws | All 64 products, eight inverses and 512 associativity triples agree with an independently derived table. A wrong inverse or product fails. |
| Local change of frame | Check the eight choices at each of 16 vertices, plus the composition law. Preserve face classes and `I_D`. These 128 single-vertex checks are not an exhaustive enumeration of `8^16` gauges; the general law is the cancellation argument above. |
| Nontrivial flat presentation | Compare identity links with `U_uv = h_u inverse(h_v)`. Open links may differ while all faces remain identity. Reject a checker that demands every link be identity. |
| Local defect | Starting from identity links, replace one undirected link by a nonidentity element and its reverse by the inverse. Exactly three incident faces are nonidentity in this cube. The prospective complete version has `32 * 7 = 224` mutants. |
| Scalar alias | `i` and `j` have equal `W` but distinct classes; `i` and `-i` have equal classes. Reject a scalar-only substitute for the class receipt. |
| Missing and acyclic coverage | Remove a link, or supply a spanning tree only. Report missing faces or zero cycle coverage; never an all-history consistency verdict. |
| Immutable content and replay | Changed signer/payload with old attestation fails before gauge work. Duplicate identical receipt adds no identity, pair obligation or entropy credit. |
| Honest disagreement | Distinct actor/channel reports stay distinct. Disagreement is not automatically cartel evidence, and cannot be removed by relabeling canonical claims. |
| Fabricated flat cartel | One controller supplies all `h_v` and coherent pair claims. The gauge layer reports consistency only, while existing temporal, graph, source and quorum evidence remains independently visible. A distinct-controller verdict from flatness falsifies the proposal. |
| Common-source recoding | Retain the existing XOR-mask singleton-component example alongside the gauge output. Neither separated correlation components nor separate chart cells creates independent entropy sources. |
| Detector separation | Hold admitted temporal/weighted graph inputs fixed while changing Q8 edge consistency, then hold Q8 links fixed while changing those detector inputs. Each layer must report only its own changed observation. No combined detection rate is inferred. |
| Learning/evidence substitution | A changed model, training cut or parameter snapshot is a changed subject. Refuse an attempt to absorb it into a frame transformation. |

The flat-cartel control is intentionally strong. Existing detectors may
flag its observable temporal or graph structure; this note does not
predict their result without specifying those inputs. If every admitted
observable is identical between two worlds, no checker of only those
observables can distinguish the worlds. Additional independent provenance,
trusted-boundary observations or a quantified conditional-innovation
premise must supply any stronger identity claim.

The integration requires a separately specified adapter. Existing Graph
and Temporal detectors consume actor/event traces; this Q8 checker consumes
comparison links between chart cells on a fixed receipt cut. The adapter
must retain original actors, events, pair obligations and provenance.
Sixteen chart cells must never be passed as sixteen independent detector
actors. A meaningful future ablation compares the admitted current detector
alone with that detector plus loop features on the established fabrication
and cartel families, including adaptive and flat cases. Symbolic Q8
invariance alone supplies no empirical detection improvement.

Avoid a vacuous implementation: actual comparison links must be independently
retained claims, with their own provenance, not always regenerated from one
global list of `h_v`. The latter is a useful flat control but guarantees
the answer by construction. A learned model may not overwrite earlier
authenticated links to minimize a loop residual.

## Additive entropy floor times pairwise consistency multiplier

Keep the existing protocol's quantities and premises separate. A pointwise
conditional bound

~~~text
P(X_i = x_i | Z = z, X_<i = x_<i) <= 2^(-h_i)
~~~

implies the corresponding joint conditional min-entropy floor
`H_inf(X_1,...,X_n | Z) >= sum_i h_i` under that stated worst-case
conditioning convention. Pairwise uncorrelated observations do not supply
this premise. Disclosure changes conditioning and may reduce secrecy.

For the stipulated work model, retain

~~~text
B = sum_i b_i > 0
R = sum_(required pair e) r_e
M = 1 + R/B
C_model = B*M = B + R.
~~~

Thus the pairwise term is a multiplier over the additive baseline. `B=0`
does not define `M`. Entropy bits, stipulated work, measured verification
operations and physical attack cost are different quantities. Proposed
loop checks get their own operation counts; they do not silently increase
the entropy floor or establish an attacker lower bound. Required pair
obligations count once, not once per incident face. Shared edges and cycle
relations prohibit multiplying 24 face probabilities as independent trials.

## Finite invariance and finite gaps do not prove the Clay statement

At the classical level, Yang-Mills uses a connection `A` and curvature
`F = dA + A wedge A`; the gauge law conjugates curvature. The
[Jaffe-Witten official problem statement](https://www.claymath.org/wp-content/uploads/2022/06/yangmills.pdf),
sections 1 and 3-4, asks for a nontrivial quantum theory on `R^4` for any
compact simple gauge group, with appropriate axioms and a strictly
positive mass gap in its Hamiltonian spectrum above the vacuum.

Our finite Q8 group and finite cube supply neither that Lie-group theory
nor its continuum/infinite-volume construction, quantum axioms or spectral
claim. No sequence of refinements, limiting measure, reflection positivity
or uniform limiting gap is constructed. Four software axes and a positive
integer defect score cannot replace those requirements.

A separate elementary Markov example makes the distinction concrete:
`P_epsilon = (1-epsilon) I + epsilon J/8`, for `0 < epsilon <= 1`,
on eight states has eigenvalues 1 and `1-epsilon` with multiplicity seven;
`J` is the all-ones matrix. Its finite-chain spectral gap is epsilon.
Changing the arbitrary mixing parameter changes the gap without changing
any memory-loop invariant; it can approach zero. This is an algebraic CS
example, not a quantum mass-gap result or a claim about an implemented
Zeta scheduler.

## Earned scope and next boundary

A successful future finite implementation would earn exact group-action,
probability-transport and loop-consistency checks with explicit coverage
and retained counterexamples. It could add information to existing
cartel analysis when independently sourced pair translations disagree.
It would not by itself earn controller distinctness, actual memory-atlas
coverage, neural-learning equivariance, empirical detector improvement,
economic non-amortization, Lorentz invariance or a Yang-Mills theorem.

Next work is a separately reviewed finite contract and independent exact
implementations, followed by actual receipts for the stated controls.
Real-memory edge extraction and composition with the existing cartel
detectors require a subsequent observation/threat model. Neither
publication of this note nor agreement with its algebra executes those
steps.

## Document validation and integration dependency

The authored note passed markdownlint-cli2 through its standard-input path
so the repository's date-prefixed research-file ignore did not bypass it.
ASCII-only bytes, final newline and the twenty relative link targets were
checked. All targets exist in the coordinator tree. Nineteen exist in this
writer; the coordinator-owned IP source record is an explicit integration
dependency and was not copied here. The inspected executable files match
the source pin above; no source/test or experiment gate was rerun for this
prose-only task.

Signed: Vera, OpenAI Codex using GPT-6 Astra. This is an authored
research-grade proposal, not independent review acceptance.
