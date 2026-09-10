# Independent finite stochastic/CQM bridge review

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer agent
Work item: 081M1WDDB6M087G0R002KN8DWQ
Reviewed contract: `86205e52d65b2aa9dd43eff8c02a2bca9852f797`
Reviewed implementation: `52b43d3e3fdb2916fc17096e9f003a478ba85eb4`
Status: protocol, source, first receipts and final local validation accepted

## Scope and method

This review concerns the [preserved contract](2026-09-06-finite-stochastic-cqm-bridge-protocol.md),
its fourteen fixed witness groups, and their eventual native and independent
Fraction implementations. The reviewer read the primary mathematical sources
and the actual `WSet.apply`, `consolidate`, `tensor`, `discard`, and
`ProbabilitySemiring` source. The reviewer performed no witness execution,
build, benchmark, or test during this protocol pass.

The reviewer is a separate agent from the contributor who writes both witness
implementations. Separately written arithmetic and algorithms do not establish
independent authorship. This review establishes neither a general CQM/WSet
equivalence nor a Clifford, Lorentz, quantum-hardware, or operational promotion.

## Mathematical assessment

The specified classical functor is well-defined. Its objects are diagonal
C*-algebras, its arrows are complex-linear CP maps preserving the sum trace,
and its matrix convention is column-stochastic. The proof on positive blocks
of every amplification establishes CP; positivity on diagonal basis projections
and trace preservation establish the converse hom-set correspondence. Identity,
composition, and the specified tensor basis are compatible. This agrees with
the normalized classical subcategory in Coecke, Heunen and Kissinger,
[*Categories of Quantum and Classical Channels*](https://arxiv.org/abs/1305.3821),
Theorem 4.1 and Corollary 4.2. The normalization restriction does not retain the
unrestricted CP category's dagger-compact structure.

The full-matrix assignment E is CP and trace preserving for admitted stochastic
matrices, but E of the classical identity is dephasing. The coherent plus-state
counterexample therefore refutes identity preservation into ordinary QChan.
Composition and tensor compatibility cannot repair that object-identity failure.

The ordinary Karoubi construction changes the objects and their identities.
Its sandwich law and identity e are precisely those in Selinger,
[*Idempotents in dagger categories*](https://www.mathstat.dal.ca/~selinger/papers/papers/idem.pdf),
Definition 3.3. The contract does not incorrectly invoke the later dagger
Karoubi definition. On dephasing objects, the sandwiched swap is the correct
structural arrow: its inverse composes to dephasing, and it acts as the
permutation of diagonal basis states. It is not unrestricted quantum swap.
Diagonal extraction and inclusion split dephasing in the larger category with
commutative algebra objects.

The Choi factor order is explicitly input first. Its diagonal entries for E(S)
are S[j,i], so positivity is equivalent to their nonnegativity; the output
partial trace is identity exactly when the columns sum to one. Watrous,
[*The Theory of Quantum Information*](https://cs.uwaterloo.ca/~watrous/TQI/TQI.pdf),
Theorems 2.22 and 2.26, supports the CP and TP characterizations after the
declared factor swap. The same source distinguishes TP from a unital adjoint
and gives the non-CP transposition example. The contract's Bell partial
transpose has quadratic form -1 on the specified unnormalized antisymmetric
vector; the negative eigenvalue on its normalized version is -1/2.

The signed normalized example is a failure of positivity in the declared
standard cone. It does not rule out signed coordinates with a separately
specified decoder and transported cone. Transposition is a different refusal:
its positivity on arbitrary PSD inputs follows from the written factorization,
while its amplification fails positivity. Neither ordinary addition nor
transpose preserves all normalized stochastic arrows. General embedding versus
equivalence limits are consistent with Heunen, Kissinger and Selinger,
[*Completely positive projections and biproducts*](https://arxiv.org/abs/1308.4557).

## Interface and finite-evidence boundaries

- `WSet.apply` preserves the key type. The contract correctly uses one integer
  carrier with different admitted input/output ranges for rectangular maps.
  Its destination/source indexing must remain distinct from the existing
  row-vector convention of `ProbabilitySemiring.forwardStep`.
- Rational matrix units specify the complex-linear extension mathematically.
  They do not execute arbitrary complex inputs or independently establish a
  program's complex-linearity: conjugation agrees on real matrix units.
  Agreement of the declared complex-linear extensions follows from their
  complete matrix-unit images, not from sampled density matrices.
- Entrywise nonnegativity is sufficient for the finite Choi certificate only
  after verifying that the Choi matrix is diagonal. It is not a general PSD
  admission for arbitrary matrices.
- The existing rational operations use int64 products. Their general domain
  is not an overflow-safe implementation of all rational numbers. The research
  wrapper must preserve its operand/result guard, report refusals, and refuse
  the complete report after any out-of-bound operation.
- Finite witnesses exercise the registered cases. General amplification
  positivity, category coherence, and transpose positivity remain the stated
  mathematical arguments; no finite receipt exhausts those claims.

## Findings and disposition before execution

The contract has no blocking mathematical finding in the scope above. The
first draft native pass checked the destination/source multiplication, operator
key tensor reshuffle, input-first Choi construction, dephasing sandwich, and
rectangular value B A u = [7/18,11/18]. These calculations are consistent with
the written contract; this is source review, not a report of execution.

The contributor addressed the inherited arithmetic risk with a local operand
and result limit of 10^6. Admitted operands bound raw multiplication products
by 10^12 and raw addition numerators by 2 times 10^12 before calling the existing
int64 operations. A refusal substitutes zero internally and invalidates the
whole report. Individual equality flags may still coincide after such a
substitution; the review requested wording that identifies `Complete=false`
as the guarantee rather than asserting every individual equality must fail.

An initial citation-URL finding was retracted. Direct browser opening of the
Selinger PDF URLs failed, but following their links from the author's index
successfully resolved both original `/papers/papers/` URLs. That was a tool
access artifact, not a broken reference; no contract change is warranted.

The first runner/reference pass found these actionable evidence-admission gaps
before implementation archival or execution. The reviewed implementation
repairs each one:

- Plain `json.loads` accepted duplicate object keys. A later duplicate can hide
  a contradictory earlier value. The reference must refuse duplicate keys and
  nonfinite JSON constants before comparing typed fields.
- Native source-admission failures exited before writing a receipt, and the
  Python input read occurred outside its failure handler. An incomplete attempt
  must retain its failure stage and any input hashes or provenance already
  available, using exclusive output publication.
- The replay only checked arithmetic peaks against the general limit. Values
  of 1 for both reported peaks satisfied that check even though the declared
  rectangular calculation contains 11/18. At minimum, the admitted peaks must
  dominate every retained coefficient; any stronger claim of independently
  reproduced intermediate peaks needs a corresponding independent ledger.
- MVID admission checked string length rather than a canonical UUID. This is
  a fingerprint-schema failure; parsing the UUID closes it.
- Deriving the repository root from an executing file's directory did not bind
  the executing filename to the admitted source entry. A renamed copy in the
  same directory could inspect the canonical file's bytes while executing
  different bytes. Both runners must check their actual source path.

The source commit field currently denotes the resolved admitted archive
snapshot. That can identify the verified source bytes without requiring later
checkout commits to inherit the archive commit. The report must state this
meaning clearly rather than imply a different execution checkout ancestry.

## Source acceptance before archival

The reviewer read the final source at
`52b43d3e3fdb2916fc17096e9f003a478ba85eb4`, including the native witness and
runner, Fraction reference, both focused test files, project compile ordering,
and [implementation specification](2026-09-06-finite-stochastic-cqm-bridge-implementation.md).
The native sparse channel and Python dense superoperator implementations use
different representations; Python reshapes its superoperator for Choi and
constructs partial transpose from elementary tensor terms. Full ordered nested
case comparison prevents reported pass flags from replacing recomputation.
There are fourteen groups and 957 case records; some records compare several
matrices, so 957 is not a count of independent physical observations.

The repaired source refuses duplicate keys, nonfinite constants, malformed
scalar types, reordered or missing evidence, altered source manifests,
noncanonical MVIDs, and arithmetic peaks below retained coefficients. It binds
the executing filenames to the canonical admitted source entries. Its failure
paths preserve stages and available provenance/hashes and refuse existing
final or partial outputs. The focused tests cover each group through a corrupt
case, structural admission failures, staged CLI failures, output preservation,
and a renamed entrypoint. The native auxiliary fixture checks an invalid
Int64.MinValue operand and an over-ceiling normalized result without expanding
the fourteen scientific groups.

The arithmetic claim is correctly limited: the independent reference checks
retained coefficient lower bounds and the fixed guarded ceiling, not exact
native operation-order peaks. Native assembly SHA-256/MVID metadata records
the loaded binaries; it does not establish a source-to-binary theorem. These
limits, the admitted-snapshot meaning of `SourceCommit`, and the mathematical
complex-linear extension are explicit in the implementation specification.

The reviewer inspected the retained F# compiler exit-139 build log and the
subsequent serial affected-project Release build log, which ended with zero
warnings and errors. The contributor reports clean lane-local ruff and mypy
checks. No frozen witness or test was executed before this review; this
acceptance does not assert a passing experiment or a complete final build/test
gate. The recommendation is to archive the reviewed source, execute the fixed
roster, and retain the first native/replay receipts and full validation results.
The indexed results report must preserve those outcomes and the failed build
attempt, then request the separate final evidence review.

## First receipt and results review

The reviewer separately inspected the first
[native and Fraction receipts](finite-stochastic-cqm-bridge-validation/2026-09-06/README.md)
and [results report](2026-09-06-finite-stochastic-cqm-bridge-results.md).
This pass used raw-file hashing, parsed-record inspection, and git source-byte
comparison. It did not import or execute either scientific implementation,
rerun the experiment, or supply a third witness algorithm.

| Receipt | Independently computed SHA256 |
| --- | --- |
| Native | `CAA481CBB41956BC6FAE56A4ACECEFED14B300B51AEBEDB332E447B025683B64` |
| Fraction replay | `340733433B7689038B62512138DF0C039E53D1879225D105D51F72858BDC501F` |

The replay binds the exact native digest. Both receipts identify the same
eight source/protocol fingerprints and admitted archive commit
`ce7fcffd496d8dcdea55f99d9919519276b35bd9`. The reviewer resolved the archive,
checked contract ancestry, and compared all eight recorded fingerprints
against both the archived files and the working scientific source. All match.
The native receipt records loaded Core/Core.Abstractions SHA256 and canonical
MVID values; the Python receipt records its executing-source hash and runtime.
These are the evidence identities specified before execution, with the
source-to-binary and admitted-snapshot limits retained above.

The fourteen group counts are exactly 9, 27, 6, 81, 729, 81, 9, 9, 1, 1, 1,
1, 1 and 1: 957 records. Every retained left/right vector agrees and every
case/group pass flag is true. The reviewed replay source recomputes those
ordered records before asserting agreement; this read-only audit independently
checks their retained content and accounting, not another execution of that
recomputation.

The reviewer inspected the rectangular record and all five negative-control
bodies rather than treating their passing flags as positive quantum results:

- The rectangular routes all retain `[7/18,11/18]` or its diagonal matrix.
- The plus-state loses its off-diagonal entry by 1/2, and ordinary identity
  preservation is explicitly false.
- The signed normalized map retains output `[2,-1]`, a negative Choi
  coefficient, and identity output partial trace. It is not positive in the
  standard cone despite satisfying normalization.
- Bell partial transpose retains the negative quadratic value -1 on the
  registered unnormalized vector.
- The reset transpose is nonstochastic with column sums 2 and 0; the sum of
  identities has diagonal entries 2 and fails stochastic normalization.

The native arithmetic receipt has zero refusals, maximum absolute numerator
11, and maximum denominator 18. The independent retained-coefficient bounds
are also 11 and 18. This agreement is consistent with the output evidence;
it does not independently establish the native intermediate-operation ledger.
The result report makes that distinction and preserves the rational versus
mathematically complex-linear boundary.

No material scientific, admission, or results-interpretation finding remains.
The report correctly presents a bounded classical inclusion, the repaired
split-object identity, and explicit refusals of stronger identifications. It
does not promote generic signed WSet weights, CQM equivalence/universality,
Clifford/Lorentz structure, quantum hardware, or operational use. Finite
receipts do not replace the contract's general mathematical arguments.

## Final validation disposition

The reviewer inspected the full Python log: 198 tests passed with one existing
HookedTransformer deprecation warning. The first full .NET log retains a
failed BftConsensus TLC run that could not unpickle a pool-file value of kind
-98. That is a validation failure, separately preserved from the complete
scientific receipts; the log alone does not establish its cause. The
reviewer also inspected the unchanged isolated recovery log: exactly the
BftConsensus theory case passed in 2 minutes 55 seconds. The fresh full
Release build ended with zero warnings and errors in 53.03 seconds. The
subsequent complete solution log has seven passing suite rows totaling
7,515 passed, six skipped, and zero failed; its F# suite passed 6,525 tests
in 5 minutes 35 seconds. The tested integration includes refreshed main at
`5957b1ad8aa3ea9f4507b29221b2e8c63aa6103d`. The reviewer rechecked all eight
scientific source/protocol fingerprints after that integration: each still
matches the preserved receipt. No scientific receipt was replaced to obtain
the passing validation gate.

The final local validation and bounded evidence are accepted. The failed
compiler and first full-suite attempts, isolated recovery, successful full
build/tests, and exact first scientific receipts must remain separately
indexed in the contributor's validation record. The PR's publication checks
remain its own final integration evidence.
