# A bounded scalar Gaussian projection step

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: unimplemented design; not a registration or experimental result
Author: Vera, OpenAI Codex using GPT-6 Astra
Session: codex/20260907-c7b2a403
Work item: 081M1Z63YMC087G0R003N5FH9X

## Proposed next boundary

The [kernel ADR](../DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md)
and [fixed native/reference comparison](2026-09-08-precision-gate-kernels-native-reference-replay.md)
provide a local objective and derivatives. The next bounded step can be a
one-dimensional bracketed solver with a separate independent Decimal
reference. This note derives that reduction and a finite implementation/test
contract for review. It changes no existing protocol, source, vector, error
threshold or retained observation. No solver, optimizer, random source,
training run or benchmark was executed to write it.

The conclusion is mathematical: the declared objective has exactly one global
minimizer for every finite real t,c>0 and finite real u,k. Numerical success on
all such parameters, or even all binary64 inputs, does not follow. Finite
resource and representability refusals must remain explicit.

## Objective, attainment and uniqueness

Fix target parameters t,c>0 and u,k in R. The candidate has m in R and
variance v>0. Let

~~~text
F(m,v) = t*((m-u)^2+v)/2 - k*m + c*exp(m+v/2) - log(v)/2,
r      = c*exp(m+v/2).
~~~

This is the existing Gaussian reverse-KL objective up to a candidate-independent
constant. It is not the exact non-Gaussian target density or an exact inference
message. With a=u+k/t, completing the square gives

~~~text
F(m,v) = t*(m-a)^2/2 + t*v/2 - log(v)/2
         + c*exp(m+v/2) - k*u - k^2/(2*t).
~~~

The exponential is nonnegative. The function t*v/2-log(v)/2 tends to positive
infinity at both v->0+ and v->infinity and has a finite lower bound.
Consequently each nonempty sublevel set confines m to a bounded interval and
v to a closed interval separated from zero. Continuity then gives attainment
at an interior point; strict convexity alone would not have supplied this
existence argument.

For any real perturbation (h,j), the Hessian quadratic form is

~~~text
(h,j)^T H (h,j) = t*h^2 + j^2/(2*v^2) + r*(h+j/2)^2.
~~~

It is strictly positive for every nonzero perturbation because t>0 and v>0.
Thus F is strictly convex on the convex domain R x (0,infinity), and its
attained minimizer is unique. This uses the standard Hessian/convexity
criterion; the displayed decomposition and attainment argument are the
present derivation, not a claim that a library solver already proves them.
See Boyd and Vandenberghe, [Convex Optimization, sections 3.1 and 4.2](https://www.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf).

The gradient is

~~~text
dF/dm = t*(m-u)-k+r,
dF/dv = (t+r-1/v)/2.
~~~

At the unique stationary point,

~~~text
m = u+(k-r)/t,    v = 1/(t+r),    r>0.
~~~

Substitution into r=c*exp(m+v/2) gives exactly

~~~text
g(r)  = log(r)-log(c)-u-(k-r)/t-1/(2*(t+r)),
g'(r) = 1/r + 1/t + 1/(2*(t+r)^2) > 0.
~~~

Its limits at zero and infinity are negative and positive infinity.
Therefore there is exactly one positive root. Every stationary point induces
that root, and every positive root reconstructs a stationary point of the
original objective. Neither a boundary variance nor an additional stationary
branch is being discarded.

## A logarithmic root and an explicit bracket

For a numerical design, use a dimensionless logarithmic coordinate:

~~~text
x = log(r/t),    q = exp(x) = r/t,
B = log(c)-log(t)+u+k/t,    D = 1/(2*t),
phi(x) = x+exp(x)-D/(1+exp(x))-B.
~~~

The derivative is

~~~text
phi'(x) = 1+exp(x)+D*exp(x)/(1+exp(x))^2 >= 1.
~~~

An exact-real finite bracket needs no exploratory expansion loop:

~~~text
L = min(0, B-1),
U = log(max(1, B+D)).
~~~

In fact phi(L)<0<phi(U). If B>=1, L=0 and
phi(L)=1-D/2-B<0. Otherwise L=B-1<0 and exp(L)<1, so
phi(L)=-1+exp(L)-D/(1+exp(L))<0.
For S=B+D<=1, U=0 and phi(U)=1-B-D/2>=D/2>0.
For S>1, U=log(S) and phi(U)=log(S)+D-D/(1+S)>0.
Both endpoints are finite real numbers for the admitted mathematical domain.

The bracket always contains zero in x; it is deliberately conservative and
is not asserted to have a uniformly small width. Positive trial exponentials
are bounded by max(1,B+D), rather than by exp(u+k/t). Very negative L can
still cause exp(L) to underflow in a finite arithmetic implementation.
Likewise B,D or B+D can exceed a chosen numerical range. None of these
numerical cases licenses replacing a positive r by zero or returning an
unchecked midpoint as a minimum.

Use log(c)-log(t), not a precomputed ratio c/t that can overflow or underflow.
Even this rewrite does not certify rounded subtraction, k/t or cancellation.
Any finite native implementation must either admit its actual evaluated
expressions with a stated error method or return a typed range refusal.

## Proposed bounded numerical contract

Start with bracket-preserving bisection; omit Newton acceleration from the
first implementation so the source and failure accounting remain small.
Bisection depends on valid endpoint signs, not merely on a smooth-looking
function. See [NIST DLMF 3.8(iii)](https://dlmf.nist.gov/3.8#iii).
The proposed first implementation should:

1. Validate t,c>0, finite u,k, positive tolerances and a finite iteration
   budget before arithmetic. Preserve the exact supplied parameter encoding.
2. Derive an outward enclosure of B,D and a containing bracket. Verify
   endpoint signs under the chosen arithmetic admission method.
3. Evaluate a finite midpoint with an explicit sign/error enclosure and
   preserve the previous bracket until a new containing bracket is justified.
4. Stop only when the requested output enclosures meet their criteria.
   An iteration cap, an unrepresentable midpoint or an unresolved sign is
   an explicit failure/status with the best retained bracket.
5. Independently evaluate the existing objective/derivatives at the returned
   candidate, preserving any actual numerical refusal. A solver's own
   reported residual must not stand in for that evaluation.

Concrete implementation bounds proposed for a later reviewed contract are
256 midpoint iterations, an 80/160/320-digit Decimal precision ladder and at
most 257 retained bracket states. These are implementation resource bounds,
not accuracy, throughput or experimental claims. The reviewed contract must
fix the requested moment tolerances and count precision retries separately.
They have not been selected using outputs. This note does not register them
or promise that every finite input succeeds within them.

A mathematically rigorous Decimal sign path needs more than changing a
context to ROUND_FLOOR or ROUND_CEILING. Python documents exp and ln as
correctly rounded in ROUND_HALF_EVEN. For admitted finite results, widen
each such endpoint result to its adjacent Decimal values; monotonicity then
allows outward transcendental enclosures. Combine those with directed basic
arithmetic, exact-input conversion enclosures and explicit overflow/underflow
admission. This interval machinery would be new reviewed source, not an
existing guarantee of the point-valued 80-digit reference.
See the official [Decimal exp/ln and neighboring-value documentation](https://docs.python.org/3/library/decimal.html).

A rounded zero residual is not a proof that the root was found. If a
validated interval phi(x) lies in [A,C], phi'>=1 gives the containing interval

~~~text
x* in [x-max(C,0), x-min(A,0)].
~~~

It can be intersected with the previous bracket, including when [A,C]
straddles zero. With no justified contraction or adequate enclosure, increase
precision only within the fixed ladder, then refuse. No unsound sign choice
is needed to make progress. A native Math.Exp/Math.Log calculation does not
automatically acquire the Decimal enclosure claim; the initial native
candidate and independent certificate check should remain separate scopes.

## Reconstruction and stopping criteria

At the exact root, two expressions for the mean coincide:

~~~text
m1(x) = u+k/t-exp(x),
v(x)  = 1/(t*(1+exp(x))),
m2(x) = log(t)+x-log(c)-v(x)/2,
m2(x)-m1(x) = phi(x).
~~~

m1 and v are decreasing; m2 is increasing. Therefore a valid root bracket
[L,U] supplies a containing mean interval by intersecting
[m1(U),m1(L)] with [m2(L),m2(U)], and a variance interval [v(U),v(L)].
All images and intersections must be outward rounded. A disjoint result is
a numerical/certificate failure, not a reason to pick the preferred formula.
This also catches a sign or factor-of-two error that a self-reported scalar
residual could conceal.

The m2 expression avoids subtracting two large nearly equal values in m1.
In exact arithmetic, taking candidate m=m2(x), v=v(x) makes its exponential
term equal t*exp(x), gives dF/dv=0 and dF/dm=t*phi(x). Thus small x residual
alone is not a uniform mean-gradient or moment-error certificate when t or
other scales vary. The independent original objective check remains useful.
No rounded implementation should replace that check with these identities.

One can evaluate log(v) as -log(t)-log(1+exp(x)), with a reviewed stable
softplus expression, to avoid an overflowing denominator product. This is
an optional arithmetic refinement with its own source admission. It is not
permission to change a zero/overflow result into a plausible positive value.
Require finite proper output moments and any fields required by the
downstream Gaussian representation; retain failures of PrecisionMean or
Precision conversion separately if those are not representable.

The proposed receipt distinguishes target parameters, candidate moments,
root bracket, moment enclosures, actual objective/derivative outcomes,
iteration/precision counts and arithmetic/source identities. Failures retain
the first failure and completed iteration prefix. Candidate production,
independent certificate agreement and application to a factor graph are
three separate events. No successful serialization proves any of them ran.

## Prospective fixed falsifiers

Before generating later retained observations, freeze a small case roster
and its exact parameter encodings. These proposed cases do not draw data:

| Case family | Fixed subject or intervention | What must fail if implemented incorrectly |
| --- | --- | --- |
| Stationary center | t=1,r=1,m=u=0; v=1/2,k=1,c=exp(-1/4). | A missing variance half-factor or wrong derivative cannot share the stationary point. |
| Displaced center | t=2,r=1,m=1,u=-1; v=1/3,k=5,c=exp(-7/6). | Mean-location and linear-site signs are independently exercised. |
| Small r/t | t=1,r=1/16,m=2,u=0; v=16/17,k=33/16,c=exp(-42/17)/16. | Solving only on x>=0 or clamping a small positive precision fails. |
| Large r/t | t=1,r=16,m=-2,u=0; v=1/17,k=14,c=16*exp(67/34). | Solving only on x<=0 or dropping the exponential response fails. |
| Small t | t=1/16,r=1,m=u=0; v=16/17,k=1,c=exp(-8/17). | Treating D as constant or confusing r with r/t fails. |
| Large t | t=16,r=1,m=u=0; v=1/17,k=1,c=exp(-1/34). | Reciprocal precision/variance scaling errors fail. |
| Ordinary nonconstructed | t=c=1,u=k=0. | Compare independent original gradients and bracket images; no fabricated exact root is supplied. |
| Large positive log forcing | t=c=1,u=800,k=0. | An implementation that first forms exp(u+k/t) must refuse or overflow; the log-coordinate route should be assessed independently. |
| Very small exponential | t=c=1,u=-1000,k=0. | Native underflow must be a named representability refusal or a separately verified log-only result, never silent r=0. |
| Invalid domain | t=0,t<0,c=0,c<0 and nonfinite inputs as separate named cases. | Refuse before logs/root work; do not apply an unregistered c=0 limit branch. |
| Mechanical limit | Deliberately insufficient iteration/precision budgets and an unrepresentable midpoint. | Preserve a failure with bracket/prefix, never report convergence from exhaustion. |
| Checker mutants | Omit 1/[2(t+r)], reverse the sign of r/t, swap bracket endpoints, fabricate a zero sign, or omit the original-gradient call. | Independent equation, enclosure or call-evidence checks must discriminate each. |

The first six rows are analytic constructions, not generated numbers.
If c is later rendered as a finite Decimal or binary64 value, the exact
symbolic center is generally no longer exactly stationary for that rounded
target. Preserve the actual coefficient and compute the independent reference
for that target; do not silently use the symbolic center as an exact oracle.
Derivative finite differences and Hessian checks should be evaluated
independently of the solver's root formula.

## Integration limits

A unique optimum in this two-parameter Gaussian family is still an
approximation to the nonlinear tilted target. It does not prove that a mixed
VMP/EP schedule converges, that successive local updates improve one global
objective, or that a product/quotient site is proper. Keep frozen cavities,
iteration/epoch boundaries, damping and rollback receipts outside this
initial scalar solver until a separate schedule contract exists.

This is a feasible next numerical component, not a learned DAG, benchmark,
physics equivalence or general-purpose optimizer result. An independent
Decimal reference and native candidate can be built only after the bounded
source contract and ownership are established; no implementation is present
in this note.

Signed: Vera, OpenAI Codex using GPT-6 Astra.

## Independent review and next admission boundary

The [independent design review](2026-09-08-scalar-projection-design-independent-review.md)
accepts the exact-real reduction, attainment and unique Gaussian-family
minimum. It preserves the original 3f90a676 design and corrects one wording
point here: the initial bracket contains zero; one endpoint can be zero.
This does not change its strict endpoint function signs or formulas.
A fixed numerical source contract and reviewed bounded implementation remain
necessary before any solver result or interval certificate is reported.
