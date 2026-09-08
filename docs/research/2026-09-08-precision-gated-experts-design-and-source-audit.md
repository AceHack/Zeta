# Precision-gated experts: source audit and minimal factor-module design

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: source/design audit and synthetic arithmetic only; no learner implemented

## Scope and exact sources

Aaron's candidate is a compositional probabilistic graph containing learned
modules, with modules themselves composable. A stand-alone recurrent policy
does not define that candidate. This note specifies a small possible module
within the existing
[Bayesian-circuit contract](2026-09-03-bayesian-circuit-and-edge-module-contract.md),
without changing that contract or implementing a parallel learning framework.

The upstream source is
[BIASlab PrecisionGatedExperts](https://github.com/biaslab/PrecisionGatedExperts/tree/6c0a4832373b953dc6478aecb3ff1ec55934939d)
at exact commit `6c0a4832373b953dc6478aecb3ff1ec55934939d`. The paper is
[arXiv:2605.29467 version 1](https://arxiv.org/html/2605.29467v1), submitted
2026-05-28. The reviewed local interfaces are pinned to Zeta
`5a5b909e04a4d543bc93e7f8f7213ae1b67fb294`.

The [preserved independent equation review](precision-gated-experts-audit/2026-09-08/equation-review-at-e074.txt)
is source commit `e07496b870ffea15f7a24235edae7414bbcf8f1d`. It independently
derives the density rules and projection gradients below. It does not verify
actual Julia dispatch, the author's quadrature, or benchmark results.
Its canonical report is
`docs/research/2026-09-08-precision-gated-experts-equation-review.md`.

The [evidence index](precision-gated-experts-audit/2026-09-08/README.md)
retains immutable upstream source text, exact tree metadata, four local
source/contract pins, the signed review bytes, original numerical tool-text
transcriptions and separately captured preservation replays. Upstream MIT
license text is included. No upstream source was executed; no data CSV,
held-out prediction/result artifact or serialized model was downloaded or
deserialized in this preservation task. Paper performance tables are not
evidence for any claim here. The earlier compiled-runtime lane stays paused.

## Packaging, target, split and scoring findings

The identity/reference collaborator supplied an earlier chat-only census.
The source and tree claims in this table were then independently checked
against the preserved exact pin before writing this note. The historical
header observation is explicitly different: its original bytes are absent.

| Boundary | Source-grounded finding | Consequence for a new comparison |
| --- | --- | --- |
| Advertised data | README says five CSVs are included; the complete pinned tree has only `data/.data` under `data/` | Dataset identity and acquisition are still prerequisites; README is not a data receipt |
| Model inventory | Tree metadata lists 105 model blobs totaling 62,029,269 bytes | This is an inventory, not proof of loaded weights, compatible metadata or reproduced expert predictions |
| Historical header observation | The collaborator reported five ETTh1/h96 files with JLD2 headers rather than LFS pointers; no retained original header bytes/path-level transcript was supplied | Preserve this as an attributed, unverified historical observation; it is not new artifact admission and was not repeated |
| Advertised paths | README names `sessions/hierarchical/` and `sessions/dynamic/dynamic_ETTh1_96.yaml`; both are absent at this pin | Use actual pinned session paths; absence of that directory does not imply absence of hierarchical modeling |
| Actual hierarchy | `noisy_experts/univariate.jl:22-30` adds latent `pred` and separate noise precision `kappa` before the gated target factor | A genuine two-level model exists; do not reduce the repository to flat fusion |
| Target meaning | `utils.jl:85-99` forms a length-L input window ending at e and one target at e+H | H is a lead time to a point target, not an H-wide forecast vector |
| Split meaning | `utils.jl:102-121` splits the already-windowed sample axis; default ratios are 0.6/0.2/0.2 | Actual dataset length, horizon, model metadata and rounding determine rows; do not substitute README counts |
| Expert metadata | `model_specifier.jl:813-820` uses the first loaded expert's sequence length, horizon, split and scaler; the neural parser also reads the first expert's horizon | Filenames/config alone do not admit an actual experiment; all expert/scaler compatibility remains unverified without a separately allowed artifact step |
| Bayesian gate fit | `model_specifier.jl:507-523` prepares validation/test inputs, then fits on validation targets/features/predictions | A new protocol must name the expert-fit and gate-fit partitions separately |
| Neural fit/monitor | `neural_pipeline.jl:570-599`: `train_set=true` fits train and monitors validation; false fits validation and monitors train | False also hardcodes patience 1 and min_delta 1e-3; it is not merely an equivalent naming switch |
| Test preparation chronology | Both preparation paths compute test predictions/features before gate fitting | This order alone does not prove target leakage; a held-out protocol must isolate access and freeze decisions explicitly |
| Neural objective | `gating.jl:34-48` minimizes expert-weighted squared error | It is neither squared error of the blended mean nor Gaussian mixture negative log likelihood |
| Metric sign | `shared_pipeline.jl:87-106,119-141` and `neural_pipeline.jl:362-392,447-475` return mean logpdf in a field called `nll` | Preserve the original field/sign; a new negative-log-score needs explicit negation and its own name/contract |

Julia paths in the table are relative to upstream `src/`; other paths name
repository-root entries. The source inventory maps them to exact original bytes. The actual
`sessions/dynamic/vae/dynamic_ETTh1_96.yaml` sets five inference and three
prediction iterations, five model experts, two quantile experts and VAE
features. Its priors/config differ from the README example. The neural
ETTh1/96 session sets `train_set=false`. These are source/config observations,
not executed defaults or trained-model receipts.

Window overlap is not itself a leakage proof. There is a specific as-of
obligation: if the last training window index is n, its target time is
n+L-1+H; the first validation window's prediction origin is n+L. For H>1,
the last training label lies after that origin. A new as-of protocol must
purge/embargo late labels or use a later evaluation origin, and bind scaler
and feature training cutoffs. No current model was opened to determine its
actual training cutoff. The historical Zeta CFB source pin
`0e8383159982b451446f81674eb24b9712d6bd58` and its split/results remain unchanged.

For weights pi summing to one, the neural objective has the identity

```text
sum_i pi_i ||p_i-y||^2
  = ||sum_i pi_i p_i-y||^2 + sum_i pi_i ||p_i-sum_k pi_k p_k||^2.
```

It penalizes expert disagreement in addition to blended-mean error. With
p=(-1,1), pi=(1/2,1/2), y=0, those losses are 1 and 0 respectively. Gaussian
mixture likelihood instead contains a log-sum-exp over component densities.
For a standard normal observed at zero, mean logpdf is about -0.9189385332,
whereas negative logpdf is +0.9189385332. These are analytic sign/objective
falsifiers, not new model evaluations.

## Model and parameter posterior

The dynamic source declares, for expert i and example j, clamped features
x_j and expert prediction p_ij:

```text
w_i ~ Normal(m_i0,S_i0)
tau_i ~ Gamma(a_tau0,b_tau0)
beta_i ~ Gamma(a_beta0,b_beta0)
z_ij ~ Normal(w_i^T x_j, 1/tau_i)
gamma_ij ~ Gamma(alpha,beta_i), with alpha=1
z_ij ~ Log(gamma_ij)
f_ij = Normal(y_j; p_ij, 1/gamma_ij).
```

Gamma uses shape/rate throughout this note. The shared y has one Gaussian
factor per expert: the representation is a factor product, not a categorical
mixture selector. For fixed gamma, normalizing that product over y gives
mean sum(gamma_i p_i)/sum(gamma_i) and variance 1/sum(gamma_i). Replacing
gamma by its variational mean is an approximate predictive update, not exact
integration of the full parameter posterior. A globally normalized factor
model and a separately normalized conditional product must not be silently
interchanged during learning.

`dynamic/univariate.jl:24-47` declares q(w)q(z,gamma)q(tau)q(beta), Gaussian
and Gamma form constraints at the link, and freezes the learned w/tau/beta
marginals during prediction. The learned parameters are a Gaussian weight
posterior and Gamma precision/rate posteriors, not merely one vector of
softmax coefficients. The supplied expert models are not retrained by this
gate. `dynamic_exp/univariate.jl` is a separate source variant: it uses Exp
and omits the Gamma regularizer and beta parameter. It is not an alias for
the dynamic Log model.

## Density-derived local variational messages

At a mean-field factor, outgoing messages are exponentiated expected
log-factors under the current beliefs of the other variables. This is
different from a BP integral using incoming cavity messages.

For softdot Normal(z;w^T x,1/tau), write means m_z,m_w,m_x, variances v_z,
S_w,S_x, t=E[tau], M_x=S_x+m_x m_x^T and M_w=S_w+m_w m_w^T. Gaussian
messages are specified by precision Lambda and precision-weighted mean eta:

```text
to z: (Lambda,eta) = (t, t m_w^T m_x)
to w: (Lambda,eta) = (t M_x, t m_z m_x)
to x: (Lambda,eta) = (t M_w, t m_z m_w)

R = (m_z-m_w^T m_x)^2 + v_z + tr(S_w S_x)
    + m_x^T S_w m_x + m_w^T S_x m_w
to tau: Gamma(shape=3/2, rate=R/2).
```

A clamped feature has S_x=0 and produces a rank-one weight precision
increment. Preserve an improper/rank-deficient site kernel until combining
with the prior; do not invert it merely to manufacture a proper standalone
message. The pinned `low_rank_softdot/mean_field.jl` and `low_rank_normal.jl`
use natural rank-one increments in this special case.

For Normal(y;mu,1/gamma), under independent current beliefs:

```text
to y:  (Lambda,eta) = (E[gamma], E[gamma] E[mu])
to mu: (Lambda,eta) = (E[gamma], E[gamma] E[y])
to gamma: Gamma(3/2, E[(y-mu)^2]/2).
```

A structured q(y,mu) must include its covariance in the residual second
moment. For Gamma(gamma;alpha,beta) with clamped alpha:

```text
to gamma: Gamma(alpha,E[beta])
to beta:  Gamma(alpha+1,E[gamma]).

q(tau_i) = Gamma(a_tau0+n/2, b_tau0+sum_j R_ij/2)
q(beta_i) = Gamma(a_beta0+n alpha, b_beta0+sum_j E[gamma_ij]).
```

Weight posterior natural parameters similarly add the prior and each
current site's increments. Those sums replace the previous variational
site values; an extra sweep must not add the same observation again.
These operations are analytic local updates within stated factorization
assumptions. They do not establish exact global posterior inference.

## Exponential link: fix orientation before implementation

Under fixed Lebesgue reference measures the two factors differ:

```text
f_E(gamma,z) = delta(gamma-exp(z))
f_L(gamma,z) = delta(z-log(gamma)) = gamma f_E(gamma,z).
```

They share a constraint set, but not the same measure. Correct BP kernels:

| Factor | Gaussian incoming on z: outgoing toward gamma | Gamma(a,b) incoming on gamma: outgoing toward z |
| --- | --- | --- |
| f_E | Normal(log(gamma);m,v)/gamma | exp((a-1)z-b exp(z)) |
| f_L | Normal(log(gamma);m,v) | exp(a z-b exp(z)) |

For f_E and a<=1 the backward kernel is not a normalizable standalone
LogGamma distribution, although multiplying it by a Gaussian can produce a
proper belief. The current Exp and Log source rules use normalized
change-of-variable distributions in both directions. They therefore do not
both match BP for either one declared factor orientation. The independent
review confirms this source-semantic issue, conditional on selecting those
rules; no actual dispatch was run.

`log.jl:36-63` invokes iterative variational `project_to`, with 50 iterations,
tolerance 1e-6, Armijo initial step 1e-2 and bounded update norm 0.5. By
contrast, `exp.jl:85-105` merges separate message moments using Gaussian
precision formulas and clamps. That latter code is not an exact moment
match of the non-Gaussian product and is not the same local optimizer.

## Explicit local projection objectives

For a real target and Gaussian candidate, define

```text
rho(z) proportional to exp(-t(z-u)^2/2 + k z - c exp(z))
q(z) = Normal(m,v), t>0, v>0, c>=0
F(m,v) = t[(m-u)^2+v]/2 - k m + c exp(m+v/2) - log(v)/2 + constant.

dF/dm = t(m-u)-k+c exp(m+v/2)
2 dF/dv = -1/v+t+c exp(m+v/2).
```

For c>0, putting r=c exp(m+v/2) reduces stationarity to

```text
m = u+(k-r)/t; v=1/(t+r)
g(r) = log(r)-log(c)-u-(k-r)/t-1/[2(t+r)] = 0
g'(r) = 1/r+1/t+1/[2(t+r)^2] > 0, for r>0.
```

The monotone scalar equation is an implementable bounded bracketing
problem; numerical overflow, missing bracket or exhausted iterations must
return a typed failure. The c=0 case has m=u+k/t and v=1/t. This is an
author-derived objective/solver proposal, not an implemented convergence
test or a theorem about the global graph. The coefficient k must follow
the admitted link orientation; it cannot silently absorb a Jacobian error.

For the separately specified positive target
LogNormal(gamma;m0,v0) Gamma(gamma;a,b), and candidate Gamma(A,B), define
L=psi(A)-log(B). With positive A,B,v0,b:

```text
F(A,B) = -H(Gamma(A,B))
         + [psi1(A)+(L-m0)^2]/(2v0) + (2-a)L + b A/B + constant
dF/dA = -1+[A+1-a+(L-m0)/v0] psi1(A)+psi2(A)/(2v0)+b/B
dF/dB = [a-1-(L-m0)/v0]/B-b A/B^2.
```

These closed expectations/derivatives use digamma and higher polygamma
functions. They still require finite numerical optimization and validated
special-function accuracy. From F=-H+E[-ell] and grad H=-I eta, interior
stationarity is eta=-I^-1 grad E[-ell]. The independent review records the
opposite sign printed in paper equations 8/34 and missing/wrong Gamma
gradient terms in equation 35, alongside the softdot, Gamma and Normal
parameterization errors. The defining-density derivation, rather than the
printed catalog verbatim, is the proposed correctness boundary.

Gaussian q(z) and Gamma q(gamma) must not be described as simultaneously
exact pushforward marginals through gamma=exp(z). Their projection and
consistency assumptions are an additional approximation contract. An
alternative structured Gaussian/lognormal block would change the variational
family and must be named as such, not silently called a reproduction.

## Smallest useful F# module and port boundary

At local pin 5a5b909e04a4d543bc93e7f8f7213ae1b67fb294,
`src/Bayesian/Message.fs` exposes `IMessage<'M>` and Gaussian/Beta/Bernoulli,
but no Gamma family. `FactorGraph<'M>` is homogeneous in one message type;
`Factor.ComputeMessages` takes a map of variable-to-factor cavity messages.
`FactorGraph.passOnce` constructs those cavities by excluding the receiving
factor. `MultilayerBnn` supplies declared Gaussian inference paths. None of
these facts turns ordinary BP scheduling into VMP parameter learning.

Propose a small `PrecisionGateFactors` module, with a two-expert/one-scalar-
feature gate as the first integration. Its initial surface should contain:

1. Gaussian natural kernels reusing `Message.Gaussian`; Gamma kernels with
   `LogPower` and `Rate`, representing gamma^LogPower exp(-Rate gamma).
   Product/division add/subtract coefficients. Uniform is the improper
   unit kernel (0,0); proper Gamma requires shape=LogPower+1>0 and Rate>0.
2. Pure Result-returning scalar SoftDot, Normal and Gamma-rate rules, with
   full second moments and explicit fixed-observation ports.
3. Explicit real/positive exponential-link kernel types, proper-belief
   projections and the two objectives above. Preserve factor orientation,
   base measure and family in the module declaration.
4. A small mixed scheduler over existing message storage/algebra: current
   marginal beliefs for VMP rules, cavities for deterministic BP, explicit
   family projection at the affected beliefs, and replacement of each
   current site message. Typed domain checks must reject unlike-family
   products; an unchecked boxed heterogeneous graph is not an acceptable adapter.
5. A receipt distinguishing inference sweeps from training epochs, naming
   parameter version, evidence order, approximation, objective, residual,
   iteration limit and any typed failure. Query replay freezes parameters;
   it does not silently train or reabsorb evidence.

This is a design, not a compiled API or a completed general scheduler.
`IMessage` operators currently have no Result return, so a concrete adapter
must decide how to propagate domain errors rather than throw or hide them.
The existing BP pass should retain its existing meaning. Acyclic topology
alone never earns exactness for the nonlinear projected module. Multivariate
weights, latent feature modules and deeper routing can follow only after
the scalar density and schedule boundary is tested.

## Independent falsifiers and retained numerical checks

| Case | Expected discriminator | Observation status |
| --- | --- | --- |
| Bilinear uncertainty | m_w=2,v_w=3,m_x=4,v_x=5,m_z=7,v_z=2,t=2 gives R=86, Gamma rate 43, weight eta=56 and precision 42 | Author arithmetic and captured preservation replay |
| Gamma shape | alpha=2,E[gamma]=3 gives message Gamma(3,3); prior Gamma(5,7) combines to Gamma(7,10) | Analytic fixture proposal |
| Jacobian | Gamma(1,1) through f_E gives exp(-exp(z)), tending to one as z tends to negative infinity | Analytic fixture; extra exp(z) is a wrong-factor mutant |
| Gaussian projection | t=1,u=0,k=1,c=exp(-1/4) has m=0,v=1/2 | Central differences about 2.2e-11 and -1.2e-10, retained |
| Product moments | LN(0,1) times Gamma(1,1) has numerically estimated mean 0.6780661146015575 and variance 0.2991799146655089 | Same printed result on 12,000/24,000-step Simpson grids over z in [-12,6] |
| Heuristic mismatch | Separate-moment precision merge gives mean 1.1143973009255714 and variance 0.8236572375650502 for that pair | Direct transcription of source formula into independent scalar arithmetic; upstream code was not invoked |
| Site replacement | Repeating one unchanged site's sweep must not add evidence; distinct sites must accumulate | Future scheduler fixture |
| Noise composition | With fixed precisions, noisy-expert chain variance is 1/kappa+1/gamma | Future composition fixture |
| Split/objective/score | Explicit target index, as-of cutoff, disagreement term and log-score sign above | Analytic/source-derived controls; no dataset rows read |

The quadrature is deliberately uncertified: neither truncation nor Simpson
error has a formal bound here, and agreement of two grids is not a proof.
The simple product separates the heuristic from the actual-product target
numerically; it does not validate Gamma variational projection, the upstream
runtime or held-out calibration. The second script also retains one
evaluation of the Gamma objective gradient, not an optimizer or convergence
experiment.

Original stdout files were not saved during the first inline arithmetic
calls. `original-tool-observations.json` honestly labels the displayed tool
text transcriptions. `preserve-checks.py.txt` reran those two exact finite
scripts in closed child processes, saving new raw stdout/stderr and source
hashes. Both exited zero, stderr was empty, and both outputs matched the
original tool text exactly. The scripts are retained as research text, not
installed learner implementations or production tests.

## Admission and resource decision

This audit supports implementing and independently testing a finite local
factor module. It does not admit a direct comparison against published PGE
scores, actual model compatibility, complete upstream reproduction, a
globally exact posterior, convergence of arbitrary compositions, or improved
learning/resource performance. A later experiment must freeze corrected
factor semantics separately from a pinned-source replication, preserve
historical results unchanged, admit its actual data/model/split identities,
and account for all training and inference work.

The next useful investment is local mathematical fidelity and a small
learned compositional object with declared counterfactual controls. The
earlier runtime metadata investigation remains at its separately accepted
pause; no dump, target, registered stream or timing is reopened by this note.

```text
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
```
