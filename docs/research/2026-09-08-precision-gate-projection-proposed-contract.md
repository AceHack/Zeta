# Proposed scalar projection source and comparison contract

Date: 2026-09-08 UTC
Operational status: research-grade
Status: proposed preregistration; independent review and registration pending
Author: Vera, OpenAI Codex using GPT-6 Astra
Session: codex/20260907-c7b2a403
Work item: 081M1Z63YMC087G0R003N5FH9X

## Purpose and prerequisites

Implement and compare one local Gaussian projection candidate with an
independently computed Decimal interval certificate. This is a proposed
finite numerical exercise, not a learning experiment, chronological benchmark,
state-of-the-art claim or mixed-schedule convergence result. No new solver,
case serialization, binary input table, output vector or run has been made
under this contract. The input literals below are prospective fixed subjects.

The mathematical [design](2026-09-08-precision-gate-scalar-projection-design.md)
at 3f90a67655524ba3e17d6cd3937a9482d1381a62 is accepted by the independent
[review](2026-09-08-scalar-projection-design-independent-review.md)
at ef41bb7fbc6da626c466210360260977bddb2d2d. The bracket contains zero;
it need not strictly straddle zero. The original design remains preserved.
This contract makes the review's interval, retry and retention obligations
concrete without treating the paper proof as an implemented certificate.

Do not implement or generate the new subjects until this complete contract
is independently reviewed, frozen in a separately identified registration
commit/ref and the source paths are co-claimed. Do not run the final comparison
until its implementation, helpers, tests and candidate/reference entrypoints
are reviewed and archived. A later correction preserves the original pin and
attempts; it does not silently replace a row or tolerance.

## Existing dependencies and proposed ownership

| Existing subject | Exact source identity |
| --- | --- |
| Scalar design | 13505 bytes; SHA256 291e4ce6de14084e377fe74a579eb7ab4b4f01d8b68d84c2e05e090f64f32d3c at 3f90a676. |
| Point-valued Python kernel reference | src/Interp.Python/zeta_interp/precision_gate_kernels_reference.py at 9e6be94a0ec2b153ba63e100463f91418ceed4fe; SHA256 91f71726c610364f5adf835fff08adb1353ab6f8ba9beaa6a68387cd55ac8258. |
| Generic integer IEEE helper | src/Interp.Python/zeta_interp/hidden_switch_compiled_ieee.py; 7559 bytes; SHA256 702a5e6e6bd330cb4d27dd3c3bddbbeba779ea8d6127249efd7e9ecbfa54d8c4. Only parse/format, exact_fraction and round_fraction are dependencies; no policy or experiment helper is used. |
| Native original objective | src/Bayesian/PrecisionGateKernels.fs at 7100eefea413c1dd34b899fd1b7ba639494568b7; SHA256 4004196cb0ade8527dfebf83fbb3e6e42bd36208e38affd09906787a84901c02. |
| Reused rounded coefficient | Exact archived reference vector input, 21985 bytes/SHA256 ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489; only the existing objective/stationary c string is reused. |

Proposed new surfaces, subject to the later co-claim: native owner has
src/Bayesian/PrecisionGateProjection.fs, its dedicated Bayesian test file,
the research replay entrypoint and all project/source-order wiring.
Independent Python owner has precision_gate_projection_intervals.py,
precision_gate_projection_reference.py and their dedicated Interp.Python
tests. The coordinator owns the fixed case serializer, whole-run envelopes,
artifact storage, native launch and final comparison ledger. Numerical
reference source must not be derived from the new native solver.

Before archival, the coordinator supplies a complete finite source binding
map: ProtocolSha256 plus repository-relative paths for all task source,
direct helpers, case/comparison adapters and changed build wiring, each with
its uppercase SHA256. No new source hash exists yet. Numeric receipts do not
choose their own expected map. Self-hashing outputs and claims of unspecified
transitive source closure are excluded.

## Target identity and exact rendering

The target is

~~~text
F(m,v)=t*((m-u)^2+v)/2-k*m+c*exp(m+v/2)-log(v)/2,
t,c>0; u,k finite; m finite and v>0.
~~~

Each valid wire case is exactly
{Schema,Id,Parameters,Profile}, Schema="zeta.precision-projection.input.v1".
Parameters has exactly T,U,K,C, all strings. The literals in the roster
below are the exact requested encodings, without numeric JSON substitution.
Only ASCII decimal syntax with optional leading minus, decimal fraction
and optional lowercase e exponent is allowed; no whitespace, leading plus,
NaN or Infinity. "-0" is allowed where explicitly listed.
Each literal is at most 128 ASCII characters, with exponent magnitude at
most 400, checked before integer conversion. Profile is exactly "default",
"native-one" or "reference-one". Default gives each solver its stated
256-attempt limit; the latter profiles reduce only the named solver to one
midpoint attempt. Profile never changes precision or arithmetic rules.

The native boundary parses each literal once, invariant-culture nearest-even
binary64, and records all 64 bits as 16 uppercase hexadecimal characters.
The independent reference parses the decimal as an exact rational, uses the
reviewed integer round_fraction operation once and requires the same bits;
it preserves the sign of a rendered "-0" separately from rational zero.
No numerator/denominator separately rounded through binary64 is permitted.

The certificate's target is then the exact independently decoded binary64
dyadic tuple. It is not the nominal decimal tuple and not a symbolic
exponential coefficient. Retain RequestedParameters, TargetBits and exact
DyadicTarget together. Parameter conversion error is reported as an exact
rational difference, including zero sign as a bit observation. No parameter
is changed when reference precision increases.

Rationals use canonical string {Num,Den}: coprime, positive denominator and
zero 0/1. Decimal interval endpoints use exact finite Decimal strings
accompanied by precision and exponent-context identity. They are values,
not instructions for dynamic type construction. No receipt uses a JSON float
for a certified rational or interval endpoint.

## Fixed base roster: 21 cases

Each row produces three top-level calls in order: NativeSolve,
ReferenceRoot and CertifyNative. CertifyNative returns NoCandidate for an
admitted native refusal; that is neither a numerical certificate nor a
missing evidence substitute. Source/input admission still applies.

The core rows are a viability challenge, not a prediction that native
arithmetic will succeed. Passing the core requires 12 actual candidates with
12 certificates. A numerical refusal remains a legitimate typed outcome
and a failed core viability criterion; it is never omitted from the roster.

| Id | T | U | K | C | Class/profile |
| --- | --- | --- | --- | --- | --- |
| core/center | 1 | 0 | 0.75 | 1 | Core/default. |
| core/displaced | 2 | -1 | 3.75 | 2 | Core/default. |
| core/small-ratio | 0.9375 | 0 | -0.40625 | 0.0625 | Core/default. |
| core/large-ratio | 0.0625 | 0 | 0.90625 | 0.9375 | Core/default. |
| core/small-scale | 0.03125 | 0 | -0.21875 | 0.03125 | Core/default. |
| core/large-scale | 16 | 0 | 15.75 | 16 | Core/default. |
| core/rounded-center | 1 | 0 | 1 | Cstar below | Core/default; actual rendered coefficient. |
| core/unconstructed | 1 | 0 | 0 | 1 | Core/default. |
| core/positive-forcing | 1 | 800 | 0 | 1 | Core/default; no exp(800) initialization. |
| core/negative-forcing | 1 | -20 | 0 | 1 | Core/default. |
| core/signed-zero | 1 | -0 | 0 | 1 | Core/default; same real target as unconstructed, distinct input bits. |
| core/wide-variance | 0.0009765625 | 0 | -0.2490234375 | 0.0009765625 | Core/default. |
| stress/native-exp-range | 1 | -1000 | 0 | 1 | Stress/default. |
| stress/parameter-range | 5e-324 | 0 | 1 | 1 | Stress/default; rounded positive subnormal t. |
| stress/reference-exp-range | 1 | -1e308 | 0 | 1 | Stress/default. |
| stress/cancellation | 1e-300 | 0 | 0 | 1 | Stress/default; severe m+v/2 cancellation. |
| limit/native-midpoints | Same as core/unconstructed | Same | Same | Same | Native/native-one; reference default limit. |
| domain/t-zero | 0 | 0 | 0 | 1 | Domain/default. |
| domain/t-negative | -1 | 0 | 0 | 1 | Domain/default. |
| domain/c-zero | 1 | 0 | 0 | 0 | Domain/default. |
| domain/c-negative | 1 | 0 | 0 | -1 | Domain/default. |

Cstar is exactly the already archived string:

~~~text
0.77880078307140486824517026697832064729677229042614147424131736626824561205351924
~~~

The first six centers use c=r and m=-v/2, so their exponential argument is
exactly zero. Their exact (m,v) are respectively (-1/4,1/2),(-1/8,1/4),
(-1/2,1),(-1/2,1),(-8,16),(-1/64,1/32). The wide-variance center is
(-256,512). These dyadic identities require no new exponential generation.
Cstar is different: its rendered value and its later binary64 rounding are
both retained; m=0,v=1/2 is not asserted to remain an exact center.

Stress rows require all three actual returned outcomes but have no
predeclared success guarantee. Classify InputRefusal, CandidateNumericalRefusal,
ReferenceNumericalRefusal, ReferenceResourceRefusal, CertificateRefusal or
Certified separately. The current original objective may conservatively
refuse nonzero multiplication/exponential underflow. Mathematical validity
does not override that boundary. No stress refusal is presented as an
optimizer defect without checking the declared arithmetic contract.

All four domain rows must have native and reference DomainRefusal before
root work, and CertifyNative must return NoCandidate. The one-midpoint
native row must return IterationLimit. For its exact target B=0,D=1/2,
the initial bracket is [-1,0] and first midpoint is -1/2. The elementary
bound 1/2<exp(-1/2)<2/3 places its residual strictly below zero; one native
update leaves width 1/2, far above the stopping bound. An unexpected early
success fails this control; it is not rewritten as the expected refusal.

## Native candidate algorithm and finite arithmetic

The initial native implementation is ordinary binary64 arithmetic with
System.Math transcendentals. It generates candidates, not certified intervals.
Record the runtime/library identities separately; no correctly-rounded
System.Math theorem or JIT/source-to-binary proof is assumed.

Freeze the source order:

~~~text
lt=log(t); lc=log(c); a=u+k/t;
B=(lc-lt)+a; D=(1/t)/2;
L=min(0,B-1); U=log(max(1,B+D));
phi(x): q=exp(x); d=1+q; p=((x+q)-D/d)-B.
~~~

Check finite operands/results and the existing conservative nonzero
multiply/divide-to-zero and positive-exp-to-zero rules at each named
operation. Exact zeros/cancellations remain allowed. No clipping, zero
replacement, unbounded bracket search or alternative optimizer is permitted.
Evaluate both initial endpoint residuals; a failure to observe L<U and
phi(L)<=0<=phi(U) returns NoRoundedBracket.

The default maximum is 256 midpoint attempts. At each attempt, form
x=L+(U-L)/2 and require a finite strictly interior point. Evaluate phi once.
A rounded zero permits a candidate with Stop="rounded-zero", never a claim
of exact stationarity. Otherwise replace the endpoint selected by the
rounded sign. Stop with Stop="rounded-width" only when
U-L <= 2^-48*(1+max(abs(L),abs(U))). Use the last evaluated x and q.
Exhaustion or an unrepresentable interior point returns a typed failure
with the complete prior bracket and actual call prefix.

Reconstruct R=t*q, v=(1/t)/(1+q) and m=((lt+x)-lc)-v/2 in that order.
Require finite positive R,q,v and finite m. Then actually call the unchanged
native tryProjectionObjective on the unchanged target and these moments.
Only its successful return permits Candidate. Preserve its exact typed
failure and the reconstructed partial candidate otherwise. The objective
does not inherit a zero gradient from the solver's phi or reconstruction.

Native counters are Starts, PhiEntries, MidpointAttempts, BracketUpdates,
LogEntries, ExpEntries and ObjectiveEntries. Increment each at its actual
entry boundary; ObjectiveEntries is zero or one, and the logarithm/exp
counts cover the solver only, not hidden arithmetic inside the objective.
Record failed entries as well as returned ones. Native bracket states are
at most 257 including the initial state. Its floating bracket and signs
are diagnostic evidence, not certificate premises.

## Independent interval arithmetic and root contract

The new interval reference rederives phi and its moment images; it never
imports the native candidate algorithm or uses its signs to select a root.
It may reuse the existing point reference only as a separate test comparator,
not as an interval enclosure implementation.

Use explicit Decimal contexts at precisions 80, 160, 320, fixed Emin=-999999,
Emax=999999 and clamp=0. The precision index is global and nondecreasing
within a call. Basic interval operations round every lower/upper endpoint
down/up. Division requires a denominator interval excluding zero.
Convert exact dyadic inputs outward from their integer ratios anew at
each precision; never treat an earlier rounded endpoint as the exact target.

For exp and ln, evaluate each admitted endpoint with the explicit context,
then widen its half-even result with that context's next_minus/next_plus.
Use monotonicity to select interval endpoints. Python's exp/ln do not become
directed merely because the context rounding mode was changed. Exact exp(0)=1
and ln(1)=0 may use their explicit mathematical singleton cases.
Nonfinite endpoints/neighbors, invalid operations, inexact underflow or a
lost required positive lower bound cause ReferenceNumericalRefusal.
No positive scalar is silently changed to zero. See the official
[Decimal documentation](https://docs.python.org/3/library/decimal.html).

Given B in[bL,bU], D in[dL,dU], first derive outward endpoints
L=down(min(0,bL-1)), U=up(log(max(1,up(bU+dU)))).
Admit the initial endpoint signs by interval evaluation before using the
bracket. At a precision increase, rederive this containing bracket and its
signs from original bits, then intersect it with any previously admitted
root bracket. Empty intersection is a certificate-construction failure.
It is not permission to discard inconvenient old bounds.

A midpoint is the exact rational (L+U)/2 rounded once to the current
Decimal context using ROUND_HALF_EVEN. The resulting finite Decimal is
treated as an exact evaluation point and must be strictly inside the
current endpoints; its construction and membership are checked.
For phi(x) in[A,C], round the endpoints of
[x-max(C,0),x-min(A,0)] outward and intersect with the old bracket.
This uses the proven phi'>=1 and remains valid across a sign-uncertain
residual. Rounded zero alone never accepts a root.

Recoverable conditions are unresolved initial signs, midpoint stagnation
or no justified contraction before the target enclosure is reached.
Escalate only to the next fixed precision. Preserve the diagnostic and
re-evaluate from original bits; do not restart counters. Exhausted precision,
iteration budget, a range/domain error or empty intersection is a terminal
typed outcome. Preserve the first terminal failure separately from the
recoverable diagnostics.

Default limits: 256 distinct midpoint attempts, at most 2 precision
escalations, 3 parameter preparations, 6 initial-endpoint phi evaluations,
258 midpoint phi evaluations including retries, and 259 admitted bracket
states including at most 2 precision-rebase intersections. A repeated
midpoint at higher precision is an evaluation retry, not an extra free
iteration. Counts and trace rows must obey these separate limits.

After every admitted bracket, reconstruct outward

~~~text
m1(x)=u+k/t-exp(x);
v(x)=1/(t*(1+exp(x)));
m2(x)=log(t)+x-log(c)-v(x)/2.
M = [m1(U),m1(L)] intersect [m2(L),m2(U)];
V = [v(U),v(L)].
~~~

Require nonempty finite M and V with V.lower>0. Stop ReferenceRoot only
when widths of both M and V are <=1e-50. Otherwise keep refining within
the fixed budgets. This absolute internal enclosure target is not a claim
that all scaled stress rows can meet it. ReferenceRoot may refuse with its
best proved bracket and moments rather than return false success.

## Certificate checks and exact public outcomes

Each native receipt has exactly Schema,CaseId,InputSha256,Bindings,Outcome,
Counters,Trace. Schema="zeta.precision-projection.native.v1". The coordinator
provides independently expected InputSha256 and Bindings; no self-supplied
map is accepted as its own expectation. Trace records actual source stages
and typed call returns; they are not executable instructions.

Outcome is exactly one of:

~~~text
{Kind:"candidate", Value:{
  TargetBits:{T,U,K,C}, LogRatioBits, RatioBits, RBits, MeanBits, VarianceBits,
  Bracket:{LowerBits,UpperBits}, Stop,
  OriginalObjective:{ValueBits,DerivativeMeanBits,DerivativeVarianceBits}
}}
{Kind:"refused", Failure, Partial}
~~~

All Bits fields are 16 uppercase hexadecimal characters. Partial contains
the admitted target, last bracket, any reconstructed candidate and any
actual objective outcome, each explicitly null when not reached. No
producer-selected runtime type names are instantiated.

ReferenceRoot returns RootEnclosure or Refused, with exact target identity,
arithmetic contexts, admitted root/moment intervals, all counters and its
bounded diagnostic/terminal prefix. CertifyNative returns exactly
Certified, NoCandidate or Refused. Neither NoCandidate nor a typed
ReferenceRoot refusal counts as a successful certificate.

For a candidate, CertifyNative must independently:

1. Validate exact nested fields/types, finite bit patterns, all bindings,
   exact decimal-to-bit conversion and the unchanged target. Independently
   require t,c and candidate q,R,v strictly positive; absolute tolerance
   cannot admit a nonpositive value in a positive family. Check native
   bracket order and non-strict containment L<=x<=U structurally, without
   claiming it contains the mathematical root. A last updated endpoint may
   equal x under the candidate algorithm.
2. Actually rerun ReferenceRoot from the unchanged dyadic target. It cannot
   accept a supplied root certificate, cached success flag or native trace
   as the numerical proof.
3. Require the candidate mean and variance to be within
   1e-12+1e-12*abs(candidate value) of every point of the corresponding
   independent M,V enclosures. Interval construction is outward; final
   endpoint distances and tolerances are compared as exact rationals.
4. Check q=exp(x) and R=t*q at the candidate x against the complete encoded
   native fields with the same absolute/relative engineering bound.
5. Independently interval-evaluate the original F and both original partial
   derivatives at the exact candidate m,v and exact dyadic target. Check
   all three native OriginalObjective fields against those intervals with
   1e-12+1e-12*max(abs(interval endpoints)). Preserve actual native and
   reference objective refusals. Do not infer these results from phi.

For steps 3 through 5 the maximum distance to either interval endpoint must
fit the bound, not just distance to its midpoint. This deliberately combines
a rigorous reference enclosure with a finite engineering tolerance for
the binary64 candidate. It is not a correctly-rounded optimizer theorem.
Native gradients are compared at the actual candidate; they are not
arbitrarily required to be exactly zero.

Post-root certification uses exactly the last context of the successfully
returned ReferenceRoot. There is no independent retry or precision increase.
Freshly convert the original dyadic target and candidate bits outward into
that context; do not reuse a native decimal approximation or a producer
interval. Apply the same fixed exponent bounds, adjacent exp/ln widening,
finite/positive/domain and underflow-refusal rules as the root reference.
Failure to prepare or evaluate these intervals is a certificate refusal,
retaining the actual root and any completed subsequent observations.

After the mean/variance checks, the coordinate call computes Q=exp(X) and
R=T*Q, where uppercase variables here denote independently prepared
intervals. Thus R_ref uses T*ExpInterval(X), not the decoded native
RatioBits value. The native q/R fields are comparison subjects only.
Its complete two-field result is retained before the q/R checks.
The original-objective call computes and shares Delta=M-U and
E=C*exp(M+V/2), then evaluates
F=T*(Delta^2+V)/2-K*M+E-ln(V)/2,
DerivativeMean=T*Delta-K+E and
DerivativeVariance=T/2+E/2-1/(2*V).
These are the original objective and partials, not stationarity identities.
Interval squaring encloses the true square, including zero when its input
crosses zero. The coordinate call uses at most two actual endpoint exp
entries; the objective call uses at most two exp and two ln entries.
Their combined six-entry ceiling is distinct from ReferenceRoot's budget.
Mathematical singleton cases can avoid actual transcendental entry.

Certified retains the original input/candidate bytes, recomputed
RootEnclosure, all checked leaf bounds and actual objective outcomes.
It states TargetScope="exact-native-dyadic",
NativeTrajectoryCertified=false and GraphApplicationPerformed=false.
Nominal-decimal drift remains a separate exact field, even for a certificate.
Schema/counter admission cannot prove physical invocation; the reviewed
entrypoints, process custody and actual records provide that separate premise.

### Nested records and failure prefixes

The following are exact key sets, including explicit nulls for unreached
work. An interval I is {Lower,Upper}, ordered finite Decimal strings.
A context is {Precision,Emin,Emax,Clamp,TranscendentalRounding}; the last
field is "ROUND_HALF_EVEN-plus-adjacent-widening". Starts is one after
entry to the corresponding public numeric service. Integer counters are
nonnegative integers excluding bool. Wire refusals have zero numeric Starts.

TargetSnapshot is {RequestedParameters,TargetBits,DyadicTarget,ConversionDelta},
each inner map exactly T,U,K,C. ConversionDelta is the exact dyadic value
minus the requested rational. Signed zero is retained in TargetBits.

Failure is {Code,Stage,Field,Message,OriginalKernelFailure}. Field is a
member path or null; Message is at most 1024 characters. Stage is one of
input, parameters, left-endpoint, right-endpoint, midpoint, reconstruction,
objective, certificate or encoding. Codes are Wire, Domain, NumericalRange,
NumericalUnderflow, NoRoundedBracket, IterationLimit, ResolutionLimit,
SignIndeterminate, EmptyIntersection, ObjectiveRefusal, TargetMismatch,
SourceMismatch, CandidateShape, NoRootEnclosure, NotCloseToMinimum,
InconsistentCoordinate, ObjectiveMismatch, ResultTooLarge or Unexpected.
Unexpected is a retained abnormal result and never an expected-refusal pass.
OriginalKernelFailure is null except for an actual existing kernel refusal;
there it is {Kind,Field,Detail}, preserving InvalidInput or NumericalFailure
and its actual field/detail strings, or ImproperBelief with its actual
family in Field and null Detail. No rewritten diagnostic replaces that
original returned error.

Native Partial is exactly {Target,Parameters,Bracket,Candidate,OriginalObjective}.
Target is null or TargetSnapshot. Parameters is null or
{LogTBits,LogCBits,ABits,BBits,DBits}, with unreached members null. Bracket
is null or {LowerBits,UpperBits}. Candidate is null or the candidate Value
key set above with each unreached member null. OriginalObjective is null,
{Kind:"returned",Value:{ValueBits,DerivativeMeanBits,DerivativeVarianceBits}},
or {Kind:"refused",Failure:OriginalKernelFailure}. Partial retains a returned
objective even when a later packaging step fails. Input-boundary failures
may have Target=null; they must not invent an admitted target snapshot.

Each Native Trace row is {Sequence,Stage,Attempt,PointBits,PhiBits,LowerBits,
UpperBits,Failure}. Sequence starts at one; Attempt is zero outside midpoint
work. Unused values are null. One row observes each completed or failed
input/parameter/endpoint/midpoint/reconstruction/objective stage, at most
262 rows: input, parameters, two endpoints, 256 midpoints, reconstruction,
objective. A thrown stage is retained as Unexpected with its prior prefix.
BracketUpdates is at most 256 and the initial plus updated bracket-state
count at most 257. The state sequence is represented by these bounded rows,
not by an additional unbounded log. Arithmetic-entry counters count failed
entries too; stage rows do not pretend to be one row per primitive operation.

The ReferenceRoot receipt is exactly {Schema,CaseId,InputSha256,Bindings,
Target,Contexts,Outcome,Counters,Trace}, with
Schema="zeta.precision-projection.reference.v1". Target is null or the
TargetSnapshot; Contexts lists only the actually entered precision levels.
Outcome is {Kind:"enclosure",Value:{LogRatio:I,Mean:I,Variance:I}} or
{Kind:"refused",Failure,Partial:{LogRatio,Mean,Variance}}, with each partial
interval null when not yet admitted. Counters are exactly Starts,
ParameterPreparations, EndpointEvaluations, MidpointAttempts,
MidpointEvaluations, PrecisionEscalations, BracketAdmissions,
MomentEvaluations and TranscendentalEntries. MomentEvaluations is at most
259 and TranscendentalEntries at most 4096, each charged before the actual
entry and never reset on a retry. These are additional implementation
resource ceilings, not mathematical convergence claims.

Each Reference Trace row is {Sequence,Stage,Precision,Attempt,Point,Parameters,
Phi,Before,After,M1,M2,Mean,Variance,Failure,Recoverable}. Point is a finite
Decimal string or null; Phi, Before, After, M1, M2, Mean and Variance are
I or null. Parameters is null or {A:I,B:I,D:I,LogT:I,LogC:I,Initial:I}.
Stage is input, parameters, left-endpoint, right-endpoint, midpoint, moments,
precision-retry or terminal. Precision is an actually entered context
precision, or null before numeric entry. Attempt is zero outside midpoint
work. Recoverable is true only for an actual precision-retry diagnostic;
all other rows use false. A terminal failure has its separate first-failure
Outcome and does not erase earlier recoverable diagnostics. The maximum is
534 rows, covering the bounded preparations, 264 possible phi evaluations,
259 moment evaluations, two retries, input and terminal records. At most
259 admitted bracket states are encoded through Before/After, without
duplicating an unbounded state sequence. Retrying the same point at higher
precision remains an actual separately recorded evaluation.

The CertifyNative receipt is exactly {Schema,CaseId,InputSha256,Bindings,
Target,NativeRaw,Reference,CertificateContext,Coordinates,Objective,Outcome,
LeafChecks,Counters}, with
Schema="zeta.precision-projection.certificate.v1". NativeRaw is exactly
{BytesHex,Bytes,Sha256}, binding every byte of the supplied native receipt.
Target is null or TargetSnapshot. Reference is null or the complete actual
ReferenceRoot return, retained before subsequent objective work or failure.
CertificateContext is null until a successful root return supplies its last
context, then that exact context identity. Coordinates is null before its
call, or exactly {Kind:"returned",Context,Value:{Ratio:I,R:I}},
{Kind:"refused",Context,Failure,Partial:{Ratio,R}}, or
{Kind:"raised",Context,Failure,Partial:{Ratio,R}}. Each partial member is
I or null. Context must equal CertificateContext. Its complete actual
observation is retained before the first coordinate leaf is compared.
Objective is null before its call, or exactly one of
{Kind:"returned",Context,Value:{Value:I,DerivativeMean:I,DerivativeVariance:I}},
{Kind:"refused",Context,Failure,Partial:{Value,DerivativeMean,DerivativeVariance}},
or {Kind:"raised",Context,Failure,Partial:{Value,DerivativeMean,DerivativeVariance}}.
Context must equal CertificateContext.
Every Partial member is I or null, retaining only actual admitted partial
work, with null when none is available. Refused records an actual normal
typed refusal; raised records an unexpected thrown call with Code=Unexpected.
Both count as one entered ObjectiveInterval call, but a raised call is not
a returned operation. Append this complete observation before any objective
leaf comparison or later encoding. A first-field mismatch must retain both
returned derivative intervals even though neither was compared. If encoding
fails, keep the full actual observation in memory and identify separately
what was durably retained; no fabricated successful observation replaces it.
Outcome is {Kind:"certified",TargetScope:"exact-native-dyadic",
NativeTrajectoryCertified:false,GraphApplicationPerformed:false},
{Kind:"no-candidate",NativeFailure:Failure}, or {Kind:"refused",Failure}.
Each LeafChecks row is {Field,NativeBits,ReferenceInterval,Tolerance,Passed}.
Tolerance is a canonical rational {Num,Den}; Passed is a bool. This avoids
acceptance through an upward-rounded tolerance. Finite Decimal interval
endpoints and binary64 candidate values are converted exactly for the final
distance comparison. The seven ordered numeric checks are MeanBits, VarianceBits, RatioBits, RBits, then the three
OriginalObjective fields in their stated order. Counters are Starts,
ReferenceRootCalls, CertificatePreparations, CoordinateIntervalCalls,
ObjectiveIntervalCalls, CertificateTranscendentalEntries and LeafChecks.
The three nested call counts and CertificatePreparations are each zero or
one; CertificateTranscendentalEntries is at most six and LeafChecks at most
seven. Entries are charged immediately before actual work, including failed
entries; refused and raised coordinate/objective observations remain distinct.
Retain the
first mismatched field and all prior actual returns/checks; never imply
success from a valid prefix. Schema/binding checks precede numeric checks
and cannot be bypassed by supplying a no-candidate outcome.

## Additional finite controls and call counts

One reference-only control, limit/reference-midpoints, uses the
core/unconstructed target with Profile="reference-one" and must return
IterationLimit. Its first residual-cone update has nonzero width and its
moment images remain far wider than 1e-50. Preserve any unexpected result
as a failed control; do not rerun with a larger budget to make it pass.

Six wire controls start from the exact core/unconstructed input and change
only the named part. Each executes the real native wire boundary and the
real reference wire boundary once: wire/t-boolean (T=true),
wire/u-NaN (U="NaN"), wire/u-infinity (U="Infinity"),
wire/missing-c (remove C), wire/duplicate-t (two T keys in raw JSON),
wire/unknown-field (add Unexpected=0). Each must return a typed wire
refusal with zero root/objective entries; a crash or missing result is not
an expected refusal.
The outer row ID identifies the control; the numeric input's Id remains
core/unconstructed. The same distinction applies to certificate mutations:
the outer control ID never substitutes for the bound numeric subject ID.

Twelve certificate controls use the actual certified core/unconstructed
candidate and its original independently expected input/binding map.
Each runs CertifyNative once on a fresh single mutation:

| Id | Mutation |
| --- | --- |
| cert/mean | Replace MeanBits with the encoding of 1024. |
| cert/variance-zero | Replace VarianceBits with positive zero. |
| cert/log-ratio | Add 1 to its decoded LogRatioBits value and re-encode once. |
| cert/ratio | Add 1 to its decoded RatioBits value and re-encode once. |
| cert/r | Add 1 to its decoded RBits value and re-encode once. |
| cert/objective | Add 1 to OriginalObjective.ValueBits and re-encode once. |
| cert/mean-gradient | Add 1 to OriginalObjective.DerivativeMeanBits and re-encode once. |
| cert/variance-gradient | Add 1 to OriginalObjective.DerivativeVarianceBits and re-encode once. |
| cert/target-zero-sign | Change TargetBits.U from positive to negative zero. |
| cert/source-binding | Replace ProtocolSha256 with 64 zero characters. |
| cert/missing-objective | Remove OriginalObjective. |
| cert/reversed-bracket | Exchange native LowerBits and UpperBits. |

All twelve must refuse with a named mismatched member or certificate stage.
No producer-selected mutation code is evaluated. If the actual core baseline
is absent or uncertified, these controls remain unexecuted/incomplete; a
hand-constructed fake baseline cannot substitute for native evidence.

The complete finite roster is 40 case IDs and 88 top-level calls:
21 base cases x 3 calls = 63, one reference-limit call, six wire cases x 2 = 12,
and twelve certificate calls. Preparation, internal ReferenceRoot calls
inside CertifyNative, encoding and archival are separately counted helpers,
not extra top-level case calls. Every invocation and actual returned result
is retained before later comparisons can fail. A process launch failure,
timeout, crash or missing result is not a completed call. Stop on an
unexpected terminal infrastructure failure with the full observed prefix;
do not fabricate the remaining outcomes.

Before archival, dedicated source tests must also discriminate interval
rounding defects, not merely replay the same formulas: exact Fraction
containment for signed addition/multiplication/division; exp(0)/ln(1)
identities; a 320-digit enclosure excluded by an incorrectly unwidened
80-digit exp/ln point; wrong-sign or omitted-half phi; empty intersections;
sign uncertainty; midpoint stagnation; retries versus terminal failure;
candidate q/R strict positivity including signed-zero refusals;
and complete objective-call return preservation when its first leaf fails
or encoding later fails, plus actual typed-refusal/raised partial prefixes;
coordinate return preservation after a first coordinate mismatch; and
post-root context identity/entry-budget refusal. These are
separate implementation tests, not additional claimed native corpus rows.

## Retention, execution and decision

Use strict UTF-8/JSON with duplicate-key and nonfinite-constant refusal,
exact key/type admission and bool/int distinctions. Per input limit 64 KiB,
per complete public result 2 MiB, and aggregate raw-plus-stored retention
limit 256 MiB including an 8 MiB combined raw-plus-stored final journal reserve
and a final artifact slot are proposed implementation ceilings. An identity
journal can therefore use at most 4 MiB raw and 4 MiB stored. The artifact
limit is 512 including that reserved slot. Reuse the reviewed exclusive
recorder; do not overwrite original attempts or reclaim a failed-write reservation.
The coordinator must preserve a full actual return in memory when encoding
fails and say which parts were durably retained. These are not peak-memory,
hostile-interpreter or storage-quota guarantees.

For reference traces the full 259 bracket states, at most 2 retry diagnostics
and one terminal failure are distinct from up to 264 phi evaluations.
Every event identifies precision, attempted point, interval result or typed
failure and actual counters. Enforce all limits before expansion or writing;
exceeding them is an explicit resource refusal, never record truncation
presented as a complete result.

Archive exact registration/source maps, original case bytes, requested and
native target identities, comparator source, complete actual outcomes and
all failures. Copy directly used native assemblies before the finite run;
compare their retained bytes with producer observations and after-run bytes.
Retain actual interpreter/runtime/entrypoint identities and admit their
declared finite scopes. No claim of full transitive runtime closure or
source-to-machine proof follows from these observations.

The preliminary component is admitted only if all 12 core cases are actually
certified, both one-midpoint controls return IterationLimit, all four
domain rows refuse at the proper boundary, all six wire
controls and twelve certificate mutants refuse, and the complete ordered
40-case/88-call evidence is present with source/byte admission. Report every
stress and budget result separately; no exclusion of failures or
performance aggregation is allowed. A failure triggers an explained
fix-forward source/contract amendment and a separately retained attempt.

Even full passage earns only a tested local Gaussian projection component
and the stated finite certificate checks. It does not establish a global
inference objective, mixed VMP/EP convergence, proper quotient sites,
learning, generalization or performance. A later schedule contract must
separately fix cavities/evidence cuts, epoch/iteration boundaries, damping,
application receipts and rollback before this component changes a graph.

## Draft review correction history

The first proposed contract at ad6eab9892299cbc18c93e9597773e0b1485680c
remains preserved. Its CertifyNative key set retained the root result and
checked leaves but omitted a complete objective-call observation. The
independent reviewer found that a mismatch at the objective's first field
could therefore lose its two already returned derivative intervals. The
focused correction adds Objective before any leaf comparison, with distinct
returned/refused/raised observations and explicit partial/encoding limits.
The reviewer also identified that post-root coordinate/objective arithmetic
had no specified context or separate entry budget. The correction fixes
the last successful root context, no extra retries, independent six-entry
transcendental accounting, and complete context-bearing Coordinates and
Objective observations before their respective comparisons.
This is a design correction; no solver or vector was executed to discover it.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
