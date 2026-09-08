# Precision-gated expert proposal: bounded independent scope review

Date: 2026-09-08 UTC
Operational status: research-grade
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

The [design/source report](2026-09-08-precision-gated-experts-design-and-source-audit.md)
is accepted at a7bef0779d531031290cf062e9c60b5e25cfeace for its stated
proposal scope. Its evidence is a236afd82c1ffe3d9a43ce383d462e8c4ce8e9b6.
The report is 20,947 bytes, SHA256
a061231cbca69264c9fc57ee0e797aa8e350a08effda31fb60d58fae701e1bda.
I checked that its attribution to the
[independent equation review](2026-09-08-precision-gated-experts-equation-review.md)
e07496b870ffea15f7a24235edae7414bbcf8f1d does not expand that review
into Julia-dispatch, quadrature, benchmark or implementation acceptance.
The copied signed review matches all 8,862 original bytes and SHA256
785ca289b0d4e36638753d659e6eb0b4cea7c2b9cf71aed75faee9849b3859ed.

The 46 manifested evidence files independently match their declared lengths
and SHA256 hashes at both evidence and final report cuts: 432,309 file bytes,
manifest 7,216 bytes with SHA256
56a6d90ca2157864707d477aea63b28b4547c4269a326ff8113c2d18c36823d5.
These are retained-byte checks through read-only Git. I did not execute the
preservation scripts, upstream source, arithmetic scripts or any learner.
This review does not independently certify every packaging-table census;
those remain the report author's source checks. The absent original model-header
observations remain explicitly attributed and unverified, and no model or
held-out data contents were accessed for this review.

The density-derived SoftDot/Normal/Gamma rules, shape/rate convention,
rank-deficient natural kernels, local-versus-global inference distinction and
fixed Exp/Log reference measures agree with e074. The report preserves the
conditional statement about selecting the source rules, rather than implying
observed dispatch. It does not reinterpret the source's precision-merging
heuristic as exact product moment matching.

I also independently differentiated the new real-target Gaussian objective
by elementary expectation identities. For t>0, v>0 and c>=0, its derivatives
with respect to m and v, the reduction through r=c exp(m+v/2), and

```text
g'(r) = 1/r + 1/t + 1/[2(t+r)^2] > 0
```

are correct for r>0. The c=0 stationary formulas also follow. This checks the
proposed scalar equations, not finite-precision bracketing, special functions,
termination or implementation accuracy. The separately stated positive-target
Gamma objective and derivatives retain their earlier independently derived
meaning.

I requested one explicit connection before implementation: the f_L forward
kernel Normal(log(gamma)) contains an extra gamma relative to LogNormal.
Therefore, combining it with Gamma(a,b) shifts the effective shape to a+1
when selecting that particular projection objective. The author added exactly
this orientation-dependent mapping in a7bef; the preceding a236 report and all
its evidence remain unchanged. A shared constraint set is insufficient to
choose the Jacobian or objective.

The mixed scheduler remains a design with explicit current-belief VMP sites,
BP cavities, family projection and replacement of prior site values. Repeating
a sweep is not described as a fresh observation. Typed family/domain refusal,
query-time frozen parameters, evidence provenance and counted inference work
remain implementation obligations. The homogeneous existing message interface
and its non-Result operators are acknowledged as adapter constraints. No
compiled API, exact global posterior, arbitrary-composition convergence or
learned benchmark result is asserted.

The report correctly separates numerical author observations from independent
certification. The original displayed arithmetic text and later captured
replays are distinct records; two agreeing Simpson grids do not bound
truncation/quadrature error. The source-derived split, objective and metric
controls remain prerequisites for a later experiment, with historical Zeta
results unchanged. Nothing in this acceptance reopens the paused runtime
investigation or authorizes new data/model execution.

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
