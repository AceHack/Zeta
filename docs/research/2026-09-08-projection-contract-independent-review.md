# Independent scalar projection numerical-contract review

Date: 2026-09-08 UTC
Operational status: research-grade
Status: bounded design accepted; implementation and numerical results unperformed
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

## Scope and disposition

This review reads the complete proposed contract at
ad6eab9892299cbc18c93e9597773e0b1485680c and its focused corrections.
It checks the mathematics, interval construction, fixed cases, source
bindings, comparison semantics and failure-record design. It executes no
solver, numerical reference, native objective, new case serializer, vector
generator or comparison harness. Reading and hashing existing source and
the previously archived coefficient are provenance checks only.

The original 32,995-byte contract has SHA256
ec3d4953516ac41b69cb75eb3998ebaef042729fccb14af8c5780d447a7a3eb7.
The first correction at 9a950c2dcf9fa0a260e7e2e20f72de242c92a611 has
37,601 bytes and SHA256
57b626190aaf5ccf33f978fd5fd45766146d2048000ab7a1a2fc77510d8ea402.
The [custody index](projection-contract-review/2026-09-08/README.md)
retains the inspected contract versions losslessly and records the existing
dependency identities. The prior [exact-real design review](2026-09-08-scalar-projection-design-independent-review.md)
remains a separate mathematical acceptance.

The final correction at 1bf71bbac7f6896216c7079abd4e99b7c79e2870 has
38,142 bytes and SHA256
537054779bf9e0bfa9271b5cc56116fbc80b16c4a2be9f1b5e3c022fe95a0f8e.
I accept this bounded design: the two material certificate-record findings
below are repaired by 9a950, and 1bf71 explicitly fixes the internal
stopping comparison. This acceptance covers only the stated design
boundary. Registration, source co-claims, implementation review, actual
process custody and the finite results remain separate requirements.

## Preserved findings and discriminators

The original exact CertifyNative key set contains the returned root and
the checked leaves, but no complete objective-interval call observation.
Consider an objective call that returns all three intervals, followed by a
mismatch at its first Value leaf. The two derivative intervals have already
been returned, yet the exact receipt has no required place to retain them.
An encoding failure after that call has the same problem. This contradicts
the prose promise to retain complete actual objective outcomes. This is a
design counterexample, not an executed or observed numerical failure.

Correction 9a950 adds a distinct Objective observation before comparison,
with returned, refused and raised alternatives and explicit admitted partial
fields. A first Value mismatch preserves both returned derivative intervals.
The full actual observation survives in memory if later encoding fails;
durable storage remains separately reported. Coordinates receives the same
complete-return treatment, so an early q mismatch cannot erase a returned R.

The original root context and its 4,096-entry transcendental ceiling do not
identify the additional interval arithmetic performed by CertifyNative.
Two implementations could choose different post-root precisions or retry
policies while emitting the original exact certificate shape. Correction
9a950 fixes the last successful root context, requires fresh conversion
from the original bits, prohibits an additional retry and retains that
context in the coordinate and objective observations. Its separate cap is
two coordinate exp entries plus two objective exp and two objective ln
entries. Actual singleton shortcuts and failed entries remain observable.

The correction also resolves an ambiguity in R's comparison target. It is
T times the independently enclosed exp(X). The rounded native RatioBits is
a comparison subject; it is not used to construct the expected R interval.
Those alternatives can differ once q has an allowed engineering error, so
this is a useful source-fixed choice rather than an implementation detail
to choose after seeing results.

A final precision clarification requires the reference's width comparison
against 1e-50 to use exact endpoint differences instead of a half-even
scalar subtraction that could round a width
just above the limit down to it. This does not change the real stopping
inequality. The native rounded-width stopping rule remains intentionally
diagnostic and separate. Correction 1bf71 explicitly converts the finite
Decimal endpoints to exact rationals and compares their difference with
1/10^50.

## Mathematical and arithmetic assessment

For the stated objective, put r=c*exp(m+v/2). Its derivatives are

~~~text
F_m = t*(m-u)-k+r,
F_v = (t+r-1/v)/2.
~~~

Consequently stationarity gives v=1/(t+r), m=u+(k-r)/t and,
with x=log(r/t), the accepted scalar equation

~~~text
B=log(c)-log(t)+u+k/t, D=1/(2*t),
phi(x)=x+exp(x)-D/(1+exp(x))-B,
phi'(x)=1+exp(x)+D*exp(x)/(1+exp(x))^2 >= 1.
~~~

The proposed exact dyadic target has t,c>0, so these hypotheses apply.
Existence, uniqueness and the Hessian proof were independently established
in the preceding review; the numerical contract does not replace them with
an observed rounded sign.

Given B in [bL,bU] and D in [dL,dU], the proposed lower endpoint is no
larger than min(0,B-1), while its upper endpoint is no smaller than
log(max(1,B+D)). Directed subtraction, sum and logarithm therefore contain
the exact bracket. The reference additionally admits endpoint signs through
intervals. A precision rebase intersects the new bracket with the old
proved bracket instead of discarding earlier bounds.

At an exact represented point x, if phi(x) is in [A,C], monotonicity and
phi'>=1 give

~~~text
x-max(C,0) <= x_root <= x-min(A,0).
~~~

This formula also holds when the residual interval contains zero. Outward
rounding followed by intersection preserves enclosure. Exact rational
midpoint construction, strict represented-point membership, stagnation
handling and monotone precision retries address the earlier review's
specific concerns. A rounded zero is insufficient for reference acceptance.

The decreasing m1(x)=u+k/t-exp(x) and v(x)=1/[t*(1+exp(x))], together with
the increasing m2(x)=log(t)+x-log(c)-v(x)/2, justify the proposed M
intersection and V interval. Their endpoints must use the appropriate
outward evaluation bounds. Empty intersections and nonpositive variance
lower bounds refuse; they are not repaired by clipping.

Python documents half-even correct rounding for Decimal exp/ln and
context-relative next_minus/next_plus neighbors. This supports the stated
adjacent-value enclosure construction when all results and required
neighbors are admitted. Explicit contexts and operation-local signal
handling remain source-review obligations; changing a context's rounding
mode alone does not direct exp or ln. [Decimal documentation](https://docs.python.org/3/library/decimal.html#decimal.Decimal.exp)

The frozen native source order is a candidate procedure with ordinary
binary64 signs. Its finite-range and conservative underflow failures can
prevent a mathematically valid stress target from producing a candidate.
Its m2 reconstruction and mandatory unchanged original-objective call
remain actual separate operations. The objective's successful return does
not follow merely from phi or from the reconstructed coordinates.

The post-root original-objective interval expressions in 9a950 match the
defining density and the derivatives above. Squaring a crossing-zero
interval includes zero. Sharing E is mathematically valid and supports the
declared separate exp/ln entry bound. The objective is checked at the exact
decoded candidate moments; its gradients are not required to equal zero.

## Target identity, controls and comparison scope

The first six constructed centers and the wide-variance center satisfy
v=1/(t+r), m=-v/2, c=r and k=t*(m-u)+r. Hence their exponential argument
is exactly zero and no new transcendental coefficient generation is
required. Their listed dyadic parameter values and moments agree with
those identities. This is algebraic checking, not solver execution.

The IEEE helper's inspected bytes match 7,559 bytes and SHA256
702a5e6e6bd330cb4d27dd3c3bddbbeba779ea8d6127249efd7e9ecbfa54d8c4.
The existing point-reference blob at 9e6be94a matches 20,245 bytes and
SHA256 91f71726c610364f5adf835fff08adb1353ab6f8ba9beaa6a68387cd55ac8258.
The native objective was read at its exact 7100eefe source pin, including
its finite-input and conservative arithmetic-failure paths. Its formulas
and actual error variants agree with the proposal.

The reused 21,985-byte existing reference vector file matches SHA256
ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489.
The proposed Cstar string occurs exactly at its $.Rows[16].Input.c field.
This verifies reuse of existing bytes; it does not endorse a new vector
or imply that its nominal center survives binary64 rounding.

The independent rational-to-bits check, exact decoded dyadic target,
conversion delta and separately preserved zero sign prevent nominal
decimal values from silently replacing the actual native target. Input
grammar and finite-bit admission must precede numeric root work. The
general .NET parser accepts a broader syntax and can return infinities on
overflow, so using it alone is not the proposed wire boundary. [Double.Parse documentation](https://learn.microsoft.com/en-us/dotnet/api/system.double.parse?view=net-10.0)

The base roster has 12 core, four stress, one native-limit and four domain
rows: 21 cases and 63 calls. One reference-limit case, six two-call wire
cases and twelve certificate cases produce exactly 40 IDs and 88 top-level
calls: 27 native, 28 root and 33 certificate calls. Root calls nested inside
CertifyNative remain separately counted. Missing native baseline evidence
leaves dependent mutants incomplete; it does not authorize a fabricated
candidate. The outer control ID remains distinct from the bound input ID.

For the one-midpoint target, exact B=0, D=1/2 and midpoint x=-1/2. The bound
1/2<exp(-1/2)<2/3 makes phi(x)<0, so native bisection leaves width 1/2.
Writing q=exp(-1/2), the exact residual cone's upper endpoint is
-q+1/[2*(1+q)], strictly between -11/30 and -1/6. Its distance from
x therefore exceeds 2/15. The variance image width exceeds 1/60:
its exponential numerator difference exceeds (1/2)*(2/15)=1/15,
and its denominator product is less than four. An outward residual
enclosure at that point cannot narrow this exact cone. This algebraic
margin explains the intended one-step control; it is not an observation
of a future represented midpoint. If the optional ln(1) singleton shortcut
is omitted, source tests must also retain the actual outward initial
bracket and represented point, and verify the required IterationLimit
instead of assuming their encodings are exactly [-1,0] and -1/2.

Strict positivity of t,c,q,R,v is checked before engineering tolerances;
an absolute tolerance cannot admit zero or a negative member of those
families. Non-strict native x/bracket containment is correct because the
last evaluated point can become an updated endpoint. These native bounds
are structural observations, not certified root bounds.

Using the maximum distance to both independent interval endpoints, with
exact rational tolerances, gives the stated engineering acceptance region
without rounding the tolerance upward. It establishes proximity of these
encoded moments and leaf values; it does not prove native trajectory
correctness, correct rounding of System.Math or a global inference theorem.
Some mutants can be rejected by earlier shape checks, so a refusal alone
must not be reported as evidence that every later numeric check executed.

## Resource and execution limits

The distinct midpoint attempts, evaluation retries, precision preparations,
bracket admissions and trace rows are separate ceilings. The stated 534
reference trace-row cap is conservative for its listed bounded stage
classes; it is not a promise to fill 534 rows. Counters are charged before
entry, including failed entries. A precision increase recomputes the same
exact target rather than upgrading an old rounded target.

The 2 MiB result ceiling and 256 MiB combined raw/stored reservation,
including the final journal reserve, are refusal limits. They do not prove
that 88 simultaneously maximal results, or a maximal native receipt hex
embedded into a certificate, can all fit. That combination can legitimately
refuse retention and leave the finite run incomplete. No peak-memory or
operating-system storage-quota guarantee follows from these byte limits.

All 12 core certificates are required for component viability; a legitimate
arithmetic refusal is still a failed core viability criterion. Stress
outcomes remain separately reported, with no exclusion or performance
aggregation. Full passage admits only the finite local Gaussian projection
component. Graph application, site propriety, evidence cuts, mixed scheduling,
learning and global convergence remain outside this review.

~~~text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
~~~
