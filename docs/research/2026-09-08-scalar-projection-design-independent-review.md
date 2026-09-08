# Scalar Gaussian projection: independent design review

Date: 2026-09-08 UTC
Operational status: research-grade
Scope: mathematical and numerical design; no implementation or execution
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

**Disposition:** accept the exact-real reduction and the bounded numerical
design at 3f90a67655524ba3e17d6cd3937a9482d1381a62. No material mathematical
counterexample was found. The numerical proposal remains a design, requiring
its own fixed contract, reviewed interval implementation and actual evidence.
It does not inherit numerical certification from the point-valued reference.

The reviewed file is
`docs/research/2026-09-08-precision-gate-scalar-projection-design.md`,
13,505 bytes, SHA256
291e4ce6de14084e377fe74a579eb7ab4b4f01d8b68d84c2e05e090f64f32d3c.
The [custody index](scalar-projection-design-review/2026-09-08/README.md)
retains this exact original design, including the minor wording finding below.
I read the complete note and rederived the equations symbolically. No solver,
reference module, native component, finite-difference program, vector
generation or benchmark was run.

## Attainment and strict uniqueness

For fixed finite real t,c>0 and u,k, the proposed objective is

~~~text
F(m,v) = t*((m-u)^2+v)/2 - k*m + c*exp(m+v/2) - log(v)/2,
m in R, v>0.
~~~

Completing the mean square gives the design's constant
`-k*u-k^2/(2*t)` and center `u+k/t`. The variance contribution
`t*v/2-log(v)/2` has a finite minimum and diverges at both ends of its
positive domain. Since the exponential is nonnegative, a fixed sublevel
confines the mean and confines variance away from both zero and infinity.
A nonempty sublevel is compact in the domain; continuity supplies an attained
minimum. This step is necessary: strict convexity alone would not prove
attainment.

The Hessian quadratic form independently expands to

~~~text
t*h^2 + j^2/(2*v^2) + r*(h+j/2)^2,  r=c*exp(m+v/2)>0.
~~~

It is positive for every nonzero pair (h,j). Thus the attained minimum is
unique, by the usual Hessian criterion on a convex domain; see
[Boyd and Vandenberghe, section 3.1](https://www.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf).
The coercivity and this explicit quadratic-form decomposition were checked
here, rather than inferred from a solver's returned status.

## Scalar root, bracket and residual enclosure

Setting the two original derivatives to zero gives
`m=u+(k-r)/t` and `v=1/(t+r)`. Substitution into the definition of r gives

~~~text
g(r) = log(r)-log(c)-u-(k-r)/t-1/(2*(t+r)),
g'(r) = 1/r+1/t+1/(2*(t+r)^2)>0.
~~~

The end limits have opposite signs. Conversely, a positive root reconstructs
both original zero derivatives and the defining exponential. The reduction
therefore loses no stationary solution and introduces none.

With `x=log(r/t)`, `B=log(c)-log(t)+u+k/t` and `D=1/(2*t)`, the expressions
for phi and phi' agree with this substitution. In particular `phi'>=1`.
The signs at `L=min(0,B-1)` and `U=log(max(1,B+D))` follow in both cases
of each minimum/maximum, including B=1 and B+D=1. They are strictly negative
and positive for every admitted exact-real parameter set.

There is one minor wording correction: the bracket **contains zero**; it
need not strictly straddle zero. For B=1,D=1/2, L=0 and U=log(3/2)>0.
This preserves the valid strict signs of phi at the endpoints and changes
neither formula nor conclusion. The original wording remains in the retained
source. This is not a root-finding failure.

For a point x and a validated interval `phi(x) in [A,C]`, integration of
`phi'>=1` between x and the root proves

~~~text
x* in [x-max(C,0), x-min(A,0)].
~~~

This remains valid when the sign interval straddles zero. It supports the
proposed intersection with the prior bracket without inventing a sign from
a rounded zero. It does not promise contraction at every precision.
[NIST's bisection discussion](https://dlmf.nist.gov/3.8#iii) supplies the
standard sign-bracket context, not this problem-specific residual certificate.

## Reconstruction and analytic controls

The two means satisfy `m2-m1=phi` exactly. Differentiation gives
`m1'=-exp(x)<0`, `v'<0` and `m2'=1-v'/2>0`. Thus the stated mean-image
intersection and variance-image interval contain the unique moments whenever
the input bracket contains the root. Outward rounding is needed in every
image and intersection, not just the scalar sign test.

At a trial point, choosing m=m2(x), v=v(x) makes the exponential term
exactly `t*exp(x)` in real arithmetic. It gives `dF/dv=0` and
`dF/dm=t*phi(x)`, as stated. A scalar residual bound by itself is not a
uniform original-gradient bound as t varies. Re-evaluating the original
objective and derivatives remains a distinct numerical operation; its
refusal or disagreement must survive the solver result.

For all six constructed controls, the supplied values satisfy the three
independent identities

~~~text
v=1/(t+r),  k=t*(m-u)+r,  c=r*exp(-m-v/2).
~~~

These checks cover the signs and fractions in all six rows, including
`-42/17`, `67/34`, `-8/17` and `-1/34` in the exponential coefficients.
The note correctly distinguishes these symbolic coefficients from later
finite encodings. A rounded coefficient defines a different target; the
symbolic center must not be reused as its exact stationary point.

## Numerical-source obligations retained by this acceptance

Python's [Decimal documentation](https://docs.python.org/3/library/decimal.html#decimal.Decimal.exp)
specifies half-even correct rounding for exp and ln, and context-relative
neighboring representable values. Consequently widening each admitted finite
endpoint result by its neighbors is a conservative enclosure approach.
Simply setting directed rounding for the surrounding context does not make
the transcendental call itself directed. The implementation must use the
intended explicit context for both evaluation and neighbors, preserve flags,
and handle nonfinite neighbors or range events under a declared refusal rule.

Before source implementation, freeze these details:

1. Exact target input encodings, conversion enclosures, exponent limits,
   tolerances and all record/input/output size caps. The 256 iteration cap
   alone is not a byte or arbitrary-input allocation bound.
2. Directed endpoint construction from interval parameters. For example,
   given `B in [bL,bU]` and `D in [dL,dU]`, a lower-rounded
   `min(0,bL-1)` and upper-rounded `log(max(1,bU+dU))` contain the exact
   bracket. Endpoint signs must still be admitted. Do not substitute nominal
   B,D values or forget rounding in the endpoint subtraction and sum.
3. A midpoint represented as an exact point inside the old bracket, with
   explicit stagnation refusal. Round both residual-derived endpoints
   outward before intersection; an empty intersection is a refusal.
4. Counts distinguishing midpoint attempts, precision escalations and newly
   admitted brackets. The proposed 257 bracket-state ceiling need not equal
   the number of arithmetic observations. Preserve failed precision attempts
   separately; distinguish recoverable diagnostics from the first terminal
   failure and preserve both through publication failures.
5. Re-evaluation from unchanged target bytes when precision increases. A
   higher-precision calculation must not silently take the earlier rounded
   target as its new exact input. The independent checker must bind its own
   target, candidate and enclosure inputs to the retained record.
6. Separate candidate construction, original-objective evaluation,
   certificate agreement and graph application. A valid mathematical proof,
   serialized record or successful kernel test does not establish that any
   of those later calls occurred.

These are concrete obligations for the source contract, consistent with the
design's stated boundaries. They do not weaken the exact-real existence
theorem, and their absence from an as-yet-unimplemented API is not reported
as an observed runtime defect.

The prospective negative controls are appropriately directed at missing
variance factors, wrong signs, one-sided brackets, fabricated residuals,
stagnation, underflow and omitted independent calls. Each proposed mutant
must later have its own discriminating result; finite differences are a
separate numerical check, not a proof of derivatives or enclosure coverage.
Local Gaussian optimality remains distinct from exact nonlinear inference,
proper sites or convergence of a mixed VMP/EP schedule.

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
