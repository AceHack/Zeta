# Independent precision-gate reference review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: completed bounded API, mathematics and evidence review
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, predictor-audit lane
Work item: 081M1Z63YMC087G0R003N5FH9X

## Disposition and immutable chain

Accept the independent reference source and its fixed retained vectors for
the declared exact-rational/Decimal80 mathematical scope. I found no
material equation, API-domain or retained-evidence defect. This accepts
neither a binary64 execution emulator nor a native comparison result. The
coordinator's separate comparator must preserve the DTO and refusal
distinctions below.

The reviewed chain is:

- Plan `3888d9a6b3e443f42320ff838f939ae483ecd2c8`, fixing the ordered
  24-row roster before retained generation.
- Source `9e6be94a0ec2b153ba63e100463f91418ceed4fe`, implementing the
  reference and 77 focused test cases. Its report adds the agreed
  Gamma-rate ValueEncoding fields before the retained vector invocation.
- Evidence `138f55d46f02283be006a8f9b426b562c0875fc3`, preserving both
  validation attempts and the exact vector invocation.

I read the complete [reference module](../../src/Interp.Python/zeta_interp/precision_gate_kernels_reference.py),
[test file](../../src/Interp.Python/tests/test_precision_gate_kernels_reference.py),
[reference contract](2026-09-08-precision-gate-kernels-reference.md), capture
and archive-audit sources, and the
[native-comparison contract](2026-09-08-precision-gate-kernels-native-reference-replay.md)
at `ba40d4d0f3bdac59294ccb36fdb8131486c07a6a`. The earlier independent
[native review](2026-09-08-precision-gate-kernels-native-review.md),
`25aa0856a81e03de58d1164979a0601863992b9b`, remains a separate source result.

The exact final reference module is 20,245 bytes, SHA-256
`91f71726c610364f5adf835fff08adb1353ab6f8ba9beaa6a68387cd55ac8258`.
The test file is 16,999 bytes, SHA-256
`f8215daf5c189438b3e207ce6b2b675568f9b2894bea78e76c7e09fe0be88a58`.
Both current files and the retained final source copies equal their source
commit's blobs. I changed neither file and ran no project reference function,
native function, pytest collection, optimizer, learner or Q8 experiment.
The independent audit described below performs only retained-data checks and
its own small exact/Decimal calculations, with no project imports.

## Equations and independent discriminators

The reference expands the independent-marginal residual as

~~~text
E[z^2] - 2*E[z]*E[w]*E[x] + E[w^2]*E[x^2].
~~~

With `E[a^2]=Var(a)+E[a]^2`, this equals the native ADR's nonnegative
expansion. Exact Fraction arithmetic makes the alternative cancellation
form valid without claiming it is numerically preferable in binary64.
The local Gaussian and Gamma natural parameters follow the defining
expected log densities, as derived in the native review. Their means use
the other independent current marginal, their precisions use its second
moment, and the precision site has power one-half and half the residual.

The test's eight-point support has means `(1,1,4)` and variances `(4,1,1)`
for w,x,z. Its residual is `9+1+4+4+1=19`, independently of sampling.
For the fractional vector, the squared mean residual is one and the other
terms sum to `3/7+2/15+3/4+1/10`, giving `1013/420`. The Gaussian
sites `(PrecisionMean,Precision)` are exactly
`(-15/8,5/2)`, `(15/16,53/8)` and `(-5/16,35/24)` for z,w,x.
These fixtures discriminate omitted uncertainty terms and sign errors.

The independent Normal vector has residual `16+2+5=23`, so its precision
site rate is `23/2`. The Gamma-rate rule follows the beta-dependent log
density `alpha*log(beta)-beta*E[gamma]`, hence power alpha and standalone
shape alpha+1. Products and quotients operate on natural coefficients,
while proper moments require positive precision or positive Gamma shape
and rate. The neutral and signed-site tests keep those operations separate.

ExpConstraint integrates `delta(gamma-exp(z))` against dgamma, yielding
`a*z-b*exp(z)` for Gamma log-power a and rate b. LogConstraint instead
integrates `delta(z-log(gamma))`, adding the reciprocal-derivative factor
`exp(z)` and hence one to the linear coefficient. The two orientation
fixtures differ by exactly one at z=1. The signed fixture is
`-1+exp(1/2)`. These are unnormalized kernels with a fixed factor measure,
not a generic normalized log-Gamma transform.

The objective uses `r=c*exp(m+v/2)` and

~~~text
F = t*((m-u)^2+v)/2 - k*m + r - log(v)/2
dF/dm = t*(m-u)-k+r
dF/dv = (t+r-1/v)/2.
~~~

Its source signs and terms agree with direct entropy/energy differentiation.
The test file separately computes the energy in Decimal100 using expanded
second moments and a directly multiplied exponential; it also checks
central differences at two points. These are useful numerical discriminators,
not rigorous interval enclosures. The stationary coefficient is itself a
rounded Decimal80 exponential, so the retained derivative `-1E-80` is
not silently replaced by exact zero.

## Public domains and numerical meaning

The algebraic API accepts exact int or Fraction values and rejects bool,
float, subclasses and malformed record fields. Exact record-type checks
prevent a dictionary that resembles a moments record from bypassing that
boundary. Signed kernel coefficients are legal sites; proper-belief
interpretation is a separate operation returning its own typed refusal.
Requested and represented Gamma shapes coincide in this exact reference.

The real exponential/objective operations construct a private Decimal
context with precision80, ROUND_HALF_EVEN, Emin=-999999 and Emax=999999,
trapping invalid operation, division by zero, overflow and underflow.
Inputs are rounded in that context; caller precision, flags and traps do
not become the calculation's ambient policy. The corresponding fixture
checks that the caller context is unchanged. Decimal remains finite
precision, not an exact transcendental representation or interval oracle.

The reference can retain an arbitrarily small positive rational where
native shape encoding or intermediate binary64 arithmetic must refuse.
Its exact zero-rate reverse kernel also simplifies the exponential term
away. Native conservative evaluation may refuse an otherwise removable
intermediate overflow. These declared differences are outside ordinary
cross-language value equality; they are not evidence of an algebra error.

`encode_value` is a bounded-depth structural encoder, not a proper-density
admission operation. Encoding an improper kernel is intentional, and its
metadata scalar support includes bool and int. Mathematical operations still
revalidate their own required types and domains. The cycle fixture reaches
the depth32 refusal rather than escaping through recursion. Arbitrarily
large object graphs/integers have no claimed hostile-input memory bound.
The Fraction integer-string conversion has its own typed encoding refusal;
that does not turn all downstream JSON serialization into a resource proof.

## Explicit native/reference mapping

Two output-shape differences are justified and must remain explicit:

| Reference | Native | Required comparison |
| --- | --- | --- |
| `GammaMoments.Shape` | `GammaMoments.RepresentedShape` | Compare the declared corresponding shape for the ordinary fixed row. |
| Normal sites omit a residual field | `NormalPrecisionMessages.ResidualSecondMoment` | Retain the extra native field and check it equals twice the precision-site rate; do not drop it. |

GammaRateVmp retains ToValue, ToRate and ValueEncoding in both namespaces.
ToValue must equal ValueEncoding.Kernel. No other field omission is justified
by the two mappings above.

Of the 17 successful reference rows, `shape/small` is deliberately a
separate native encoding observation. The reference retains exactly
`1/10^16`; native must expose requested binary64 shape, actual log-power
and its positive rounded-back shape, including their difference. An
absolute tolerance of `1e-12` would hide this difference completely, so the
coordinator correctly excludes that row from its 16 ordinary value matches.

The seven refused rows need semantic mappings rather than string equality:

| Fixed row | Reference Code / Field | Actual native payload available |
| --- | --- | --- |
| gamma/improper | ImproperGamma / kernel.Rate | ImproperBelief with family Gamma; no field is carried. |
| gaussian/linear-improper | ImproperGaussian / kernel.Precision | ImproperBelief with family Gaussian; no field is carried. |
| invalid/negative-variance | InvalidMoments / w.Variance | InvalidInput with field Weight.Variance. |
| invalid/nonpositive-gamma | InvalidDomain / mean_beta | InvalidInput with field MeanBeta. |
| invalid/proper-gaussian | ImproperGaussian / kernel.Precision | ImproperBelief with family Gaussian; no field is carried. |
| invalid/objective-variance | InvalidDomain / v | InvalidInput with field Candidate.Variance. |
| shape/nonpositive | InvalidDomain / alpha | InvalidInput with field Shape in gamma-from-shape admission. |

The comparator may document the fixed reference field associated with an
improper native family, but cannot label that field as an observed native
payload. Field mappings are operation-specific; for example, alpha in the
separate Gamma VMP function would have a different native locator. Error
prose is retained but need not be equal across languages. No native failure
was invoked by this review; the right column follows the already reviewed
native source.

## Independent evidence audit

The [review audit source](precision-gate-kernels-reference-review/2026-09-08/audit.py),
[raw result](precision-gate-kernels-reference-review/2026-09-08/audit-result.json),
[argv/process record](precision-gate-kernels-reference-review/2026-09-08/audit-process.json)
and [empty stderr](precision-gate-kernels-reference-review/2026-09-08/audit-stderr.txt)
are retained under a [four-file manifest](precision-gate-kernels-reference-review/2026-09-08/manifest.json).
The audit imports neither project module nor native code. Its only child
invocations are Git reads; its arithmetic checks use literal independent
rational expectations and Decimal100 equations on the existing five
transcendental rows.

All 34 archive pairs agree in stored and decompressed length/hash and in
current-versus-committed gzip bytes: 187,829 raw bytes and 43,193 stored
bytes. Twenty-nine also match separately retained local raw files. The
original plan matches its immutable Git blob. The other four raw preimages
are the executed capture harness and three later formatter records,
preserved directly as gzip; they have no separately retained uncompressed
local originals. This review does not invent such originals. The readable
harness has the disclosed formatting changes and was not the executed
preimage.

Both final source pins match the archived copies. Ten mathematical helper
ASTs are unchanged between the initial and final reference source; the
retained union-narrowing and formatting repair did not change those bodies.
The initial recorded checks have exits `[0,1,0,1]` for pytest, mypy, Ruff
and format; the final checks have `[0,0,0,0]`. The retained logs report
76 tests in 4.43s and then 77 in 4.28s. These are author test observations,
not reruns by this reviewer, performance measurements or full-suite gates.

The exact vector is 21,985 bytes, SHA-256
`ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489`.
It equals the retained stdout and the Value inside the complete actual
Success return. The source and return metadata identities agree; both
runtime-closure and native-comparison admission flags remain false.

The independent audit checks all 24 ordered rows: twelve exact rational
success outputs, seven typed refusals and five Decimal success rows with
nine numeric leaves. The latter use precision100 and independently arranged
equations, with declared absolute tolerance `2e-77`. Maximum observed
absolute difference is `7.7598532332560474534E-80`. This comparison shares
Python's Decimal library with the reference and is not a certified enclosure
or independent transcendental-library implementation. The audit exited zero
with empty stderr. No reference vector was regenerated or altered.

## Remaining boundary

This result accepts the independent mathematical reference and its fixed
evidence. It does not accept an as-yet-unreviewed comparator implementation,
native replay outcome, mixed scheduler, optimization method or learned
parameter artifact. The proposed scalar projection solver is a subsequent
design decision. Current evidence and the two native test recommendations
remain preserved as separate scopes.

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
