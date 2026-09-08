# Precision-gated experts: bounded equation and rule review

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: material density/rule inconsistencies; comparison anchor retained

This is an independent derivation from the defining densities in
[arXiv 2605.29467 version one, Appendix A.5/A.6](https://arxiv.org/html/2605.29467v1#A5),
and a source-only check of the two named upstream rules at
6c0a4832373b953dc6478aecb3ff1ec55934939d. It is not an implementation,
benchmark or full-paper theorem review. No model, expert-prediction file,
training/test stream, numerical solver or native study was run. The collaborator's
reported scalar quadrature is not reproduced or admitted by this review.

The HTML and PDF text extraction both show the soft-dot backward-mean
expression discussed below. The web tool refused the three requested PDF
screenshots, so no visual-page verification is claimed. Formula locations
below identify sections/equations rather than depending only on HTML line numbers.
The derivations, not the paper's reported performance, support these findings.

## Soft-dot natural parameters and uncertainty terms

Use independent marginals for scalar z, vectors w and phi, and positive
precision tau. Let t = E[tau], with means m_z, m_w, m_phi and variances or
covariances v_z, S_w, S_phi. Define A = S_phi + m_phi m_phi^T and
b = m_z m_phi. Expanding the expected log-density of
N(z; w^T phi, tau^-1) gives the outgoing w kernel

```text
log message(w) = constant - (t/2) w^T A w + t b^T w.
precision = t A; precision-times-mean = t b.
mean = A^-1 b; covariance = (t A)^-1, when A is positive definite.
```

The mean printed after Eq. 23 uses t A b instead. The symmetric phi rule
has the same discrepancy. For t=2, m_phi=3, S_phi=1 and m_z=4, the correct
scalar mean is 6/5 and variance 1/20; the printed mean is 240. A singular A
need not define a normalized standalone Gaussian message. Natural-parameter
kernels and proper posterior admission must be distinguished explicitly.

The precision message follows directly from the log normalization of that
same normal density:

```text
message(tau) proportional to tau^(1/2) exp(-tau R/2)
R = (m_z - m_w^T m_phi)^2 + v_z
    + tr(S_w S_phi) + m_phi^T S_w m_phi + m_w^T S_phi m_w.
Gamma shape = 3/2; rate = R/2.
```

Eq. 24's expansion omits the last uncertain-feature contribution, and its
printed rate also omits division by two. For scalar means m_z=11, m_w=2,
m_phi=3 and variances v_z=13, S_w=5, S_phi=7, R=146 and the rate is 73.
The printed expression gives 118. A fixed-feature special case cannot justify
dropping S_phi while simultaneously claiming the general uncertain-input rule.
For the forward VMP message, omitted terms constant in z can be dropped;
the precision is E[tau], not a random unintegrated tau.

## Gamma and normal parameterization

The defining Gamma density in A.5 uses shape alpha and rate beta. Holding
alpha fixed, its beta-dependent kernel is

```text
message(beta) proportional to beta^alpha exp(-beta E[gamma]).
Gamma shape = alpha + 1; rate = E[gamma].
```

The printed final shape alpha disagrees with its preceding beta^alpha power.
This is an algebraic shape conversion error under the stated parameterization.

The Normal subsection similarly prints E[tau] in a variance position; the
variance obtained from its quadratic is 1/E[tau]. Under that subsection's
specific correlated q(y,mu), E[(y-mu)^2]=s_y^2, so its scalar tau message
has shape 3/2 and rate s_y^2/2. This does not justify that residual formula
for arbitrary independent y and mu marginals.

## Deterministic orientation is a model boundary

For the declared Exp factor f(gamma,z)=delta(gamma-exp(z)), direct integration
with respect to gamma gives

```text
message_to_z(z) = incoming_gamma(exp(z)).
```

There is no Jacobian: the delta argument has derivative one in the integration
variable gamma. For an incoming Gamma(a,b) using rate b, this kernel is
exp((a-1)z - b exp(z)). It is proportional to a normalized LogGamma with
scale 1/b and shape a-1 only when a>1. For a<=1 it is an improper standalone
kernel; multiplying by the other message can still yield a proper belief.
A typed API must state which of those objects it returns.

The paper's extra exp(z) factor instead describes the forward transformation
through delta(z-log(gamma)). The two delta factors differ by exp(z); they
share a constraint set but not the same density relative to the fixed base
measures. For the original Exp orientation, the forward message from a Normal
on z correctly has the LogNormal Jacobian 1/gamma.

Under the project's documented scale/shape convention, the pinned
[Exp rule](https://github.com/biaslab/PrecisionGatedExperts/blob/6c0a4832373b953dc6478aecb3ff1ec55934939d/src/exp.jl#L26)
returns the unshifted incoming shape in its reverse LogGamma message. Thus the
declared custom rule shares the density mismatch; it is not only a printed
formula issue. The
[Log rule](https://github.com/biaslab/PrecisionGatedExperts/blob/6c0a4832373b953dc6478aecb3ff1ec55934939d/src/log.jl#L21)
has the appropriate forward Gamma-to-log transformation for the Log orientation,
but its reverse Normal-to-positive rule returns LogNormal. For that fixed Log
factor, the reverse kernel is Normal(log(gamma)), without 1/gamma. Both files
use distribution transformations in both directions instead of consistently
preserving one specified factor measure. This is source semantics if those
rules are selected; no actual dispatch or upstream result is inferred.

The Exp marginal code additionally merges the separate message moments using
Gaussian precision formulas, with clamps. That is a separate approximation;
source comments alone do not establish exact moments of the non-Gaussian
product. No implementation-wide projection or numerical accuracy claim is
accepted here.

## Variational stationarity and Gamma projection

Let F(eta) = -H(q_eta) + E_q[-ell], with a constant base measure and Fisher
matrix I(eta). Differentiating exponential-family entropy gives

```text
grad H = -I eta;
grad F = I eta + grad E[-ell];
eta_star = -I(eta_star)^-1 grad E[-ell] at an interior stationary point.
```

Eqs. 8 and 34 have the opposite sign for their stated negative-log-density
energy convention. A one-step or iterative update must not silently change
the objective to accommodate that sign.

For the separately well-defined positive target
LogNormal(gamma;m0,v0) times Gamma(gamma;a,b), write the candidate
q=Gamma(A,B), with positive shape A, rate B, v0 and b. Set
L=psi(A)-log(B); psi1 and psi2 denote the next two polygamma functions.
Direct expectations and entropy give, up to a parameter-independent constant,

```text
F(A,B) = -H(Gamma(A,B))
         + [psi1(A) + (L-m0)^2]/(2 v0) + (2-a)L + b A/B.

dF/dA = -1 + [A+1-a+(L-m0)/v0] psi1(A)
        + psi2(A)/(2 v0) + b/B.
dF/dB = [a-1-(L-m0)/v0]/B - b A/B^2.
```

In natural coordinates eta=(A-1,-B), define c=2-a+(L-m0)/v0. The expected
energy gradient is

```text
grad_eta E[-ell] = (c psi1(A) + psi2(A)/(2 v0) + b/B,
                   c/B + b A/B^2).
```

Eq. 35 omits b/B from its first coordinate; its second coordinate has the
wrong sign and omits A in the b term. These derivatives agree with the
collaborator's independently supplied objective after deriving them directly.
They specify a possible local numerical objective, not an optimizer,
convergence proof, exact product moment match or global posterior guarantee.

## Bounded disposition

These findings leave compositional probabilistic modeling as a relevant
research candidate, but the printed update catalog cannot be used unchanged
as a correctness oracle. A faithful upstream replication and a derivation
from the declared factor densities are distinct scientific objects. Fixing
the latter must preserve the former's source/split/result identities rather
than silently relabeling a modified method as its reproduction.

Before implementation, freeze the factor orientation, base measure, parameter
convention, proper-density versus message-kernel return type, projection
objective, finite numerical limits and convergence/refusal semantics. Small
independent equation and density tests should distinguish the changes above.
The mixed schedule and global posterior remain approximate unless separately
proved. This review writes no upstream or Zeta implementation and authorizes
no benchmark or additional runtime investigation.

```text
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
```
