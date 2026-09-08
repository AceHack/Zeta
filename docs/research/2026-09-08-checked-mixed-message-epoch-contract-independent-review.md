# Checked mixed-message module epochs: independent ADR and source-contract review

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade source/design review
Lifecycle: active
Disposition: accepted within the bounded proposed implementation contract
Work item: 081M1Z63YMC087G0R003N5FH9X

## Scope and identities

This pass reviews the proposed ADR and source contract as a bounded next
implementation step after the [accepted epoch proposal](2026-09-08-mixed-message-epoch-independent-review.md).
It does not approve an implementation, register an experiment, certify a learned
result or reopen the scalar and compiled investigations. No owner/root source,
tests or index were changed by this reviewer.

Reviewed owner commit: `84fa75bc537f0e32f3df7b6159d9ead3a66f0c3c`.
The [ADR](https://github.com/Lucent-Financial-Group/Zeta/blob/84fa75bc537f0e32f3df7b6159d9ead3a66f0c3c/docs/DECISIONS/2026-09-08-checked-mixed-message-module-epochs.md)
is 6,188 bytes, SHA256
`4A4EA4871B60EC476D09ABA0DD7D0BB12FB3E30FF8012CAFF883D6A35061F09D`.
The [source contract](https://github.com/Lucent-Financial-Group/Zeta/blob/84fa75bc537f0e32f3df7b6159d9ead3a66f0c3c/docs/research/2026-09-08-checked-mixed-message-module-epoch-source-contract.md)
is 53,198 bytes, SHA256
`4234015EE650FA7190CF3375C58654499F3BB9EC9C96E4BE21D2FC97A30EC979`.
Both equal the signed commit's Git blobs and the inspected owner files.
No remaining material mathematical, model, schema, budget or scheduler/bridge
blocker was found within this finite proposed implementation scope.

The initial locally snapshotted draft is retained in the evidence companion.
The ADR was 6,188 bytes, SHA256
`4A4EA4871B60EC476D09ABA0DD7D0BB12FB3E30FF8012CAFF883D6A35061F09D`;
the contract was 42,470 bytes, SHA256
`75C0E5AFBE1FB5B9BF3B040FF01313D89D5709354D67AE898A573205AB0636F4`.
These were working correction bytes, not represented as the original committed
`31b29e17e7d43a86bc02d88f217dd1cd442c3148` draft.

## Findings and repaired disposition

Three material ambiguities were reported to the owner and coordinator before
implementation:

1. **M4 order.** Disconnected `control/cancellation` sorts before
   `control/positive` under the contract's topological/ordinal schedule. That
   contradicts the required positive application followed by cancellation.
   The correction uses `control/0-positive` and `control/1-cancellation` with
   unchanged targets and scheduler rule.
2. **Training child forecasts.** The original exact training schedule contained
   only artifact/pass/row learner entries, but admitted child inputs without
   defining their generation/admission or charging their projection work in P.
   The correction admits completed immutable precomputed query receipts and
   charges their actual production to the prior/outer epochs. Training has no
   hidden child evaluation. Distinct target-hidden query rows must match the
   training row's feature/origin/horizon projection without reusing a full
   immutable row identity whose target value has changed.
3. **Query row.** A multirow cut and one-forward-per-node schedule did not select
   which row supplied the eight observation inputs. An explicit QueryRowId and
   target-null/availability admission remove that implicit choice.

Final 84fa75bc53 resolves all three. Compensating replay inherits the exact
query row from the retained original plan and refuses if it is no longer active.
Forecast bundles contain the full prior Plan/Result and exact producer-model
and ancestry preimages; source/process custody remains an independently
admitted caller premise. Distinct target-hidden row identities preserve the
immutable evidence rule. The compact bridge binding does not masquerade as
proof of remote execution. The same four-row composition control now exercises
actual child production, admission and parent use rather than schema mocks alone.

The final schema also makes SelectedVersions carry exact `{Version,Artifact}`
payloads, defines neural versus precision producer identities, and hashes an
ordinal neural-ancestry-cut list rather than calling several cuts one direct
cut. Every ancestor's label availability is checked. Committed State.Outputs
makes acknowledged forward means available to parents without an untracked
side channel. These finite definitions require no artifact loader or new
inference framework.

The owner's additional root-requested alias/clamped-feature/cap refinements
and author-found storage-ACK-before-apply and artifact-hash-cycle repairs are
separate from these three reviewer findings. Their draft history remains in
the source contract. This review does not turn a design repair into a passed
executable test.

## Independent mathematical check

There are 48 hidden weights, four hidden biases, four output weights and one
output bias: 57 parameters. Four artifacts carry 4*(57+16)=292 fitted scalars,
or 2,336 binary64 payload bytes before metadata. The row-major layout, fixed
initializer, two ordered passes and learning rate 1/1024 are unambiguous.

For `e=prediction-target`, the chain rule for half squared error gives

```text
gV[h] = e*H[h]; gd=e
delta[h] = e*V_old[h]*(1-H[h]^2)
gW[h,j] = delta[h]*x[j]; gb[h] = delta[h].
```

Every term uses the same old parameter vector. Updating V before computing
hidden gradients changes the derivative. Admitting all proposed replacements
before one vector swap and retaining the actual intermediate prefix is the
appropriate atomic boundary. Ordinary binary64 underflow is explicitly part
of this small NN's behavior; it does not change the checked precision kernel
underflow rules. System.Math.Tanh and ordered scalar operations do not establish
cross-hardware bit identity. The finite-difference check is a future
source-review/control obligation, not an observation from this review.

For each clamped child mean mu, the declared Normal factor contributes
`GammaKernel(1/2,((m-mu)^2+v)/2)` to precision and Gaussian natural parameters
`(Egamma*mu,Egamma)` to z. M2's residuals are respectively 12 and 2, and its
correct Gamma prior-plus-site is shape 5/2, rate 9. Other-variable VMP marginals
must not be replaced by BP cavities. The child variance is explicitly zero at
the receiving factor; storing a child uncertainty does not propagate it.

M3 is discriminating without a numerical experiment. At the stated target and
`m=-1/4,v=1/2`, `c*exp(m+v/2)=1`; both derivatives of

```text
F(m,v)=t*((m-u)^2+v)/2-k*m+c*exp(m+v/2)-log(v)/2
```

vanish. Its Hessian has entries `t+r,r/2,r/4+1/(2*v^2)`, with determinant
`t*r/4+(t+r)/(2*v^2)>0` for t,r,v positive. The Gaussian-family optimum is unique.
The projected natural pair is `(-1/2,2)` and the retained base `(3/2,1)`, so
the site is `(-2,1)`. Multiplying the belief as a site yields the wrong `(1,3)`.
Alpha=1/2 from the neutral unary instead yields combined `(1/2,3/2)`, hence
m=1/3,v=2/3; its mean gradient is `exp(2/3)-5/12`, not zero. A proper damped
result therefore does not inherit the undamped minimizer certificate.

This is Gaussian reverse-KL projection. The [VMP paper](https://www.jmlr.org/papers/v6/winn05a.html)
and [EP paper](https://tminka.github.io/papers/ep/minka-ep-uai.pdf) ground the
local-rule/projection distinction; neither supplies a global convergence or
likelihood guarantee for this finite mixed schedule. The displayed supervised
learner does not optimize the parameter-dependent normalized product-model
likelihood. Learned point weights are not Bayesian parameter posteriors.

## Existing-source reuse and application custody

The nine additional source identities all match committed and currently read
bytes at `15c634e096674c757f3656c0b8ff9aaa0b5cf203`: 110,222 bytes in total.
The earlier 24-file census remains covered by the prior independent review.
I reread relevant FactorGraph, checked-kernel, SoftScheduler/IntrCtx,
process-helper, reference API, encoder/store and project declarations. This is
finite source correspondence, not a complete runtime/dependency proof.

`SoftScheduler.Handler` uses `ISR<S,S>`, which accepts IntrCtx and returns
Task<Result<S,InterruptFeedback>>. One actual drive handler and one finite
TimerElapsed source fit its public API. Its Error result loses local state,
so the independently retained holder is load-bearing. The real M4 must show
the first committed block survives the second failure through this exact path.
Mock delegates cannot satisfy that integration control.

The separate checked family maps retain FactorGraph's receiving-factor
exclusion and replacement laws without passing unchecked mixed VMP semantics
through its cavity-only ComputeMessages API. Prior/contribution identity,
explicit aliases and dependency sets remain distinct from empirical independence.

A pre-apply checkpoint with an actual matching storage acknowledgment permits
the state swap; only an observed Commit advances the coordinator's known applied
prefix. A lost Commit leaves application unknown there, while the peer must
retain its actual swapped state. Page/storage failure stops further application;
no observer fabricates rollback or the result of a terminated peer. The actual
public native and certificate returns, including nested refusals and encoding
failures, must survive before interpretation or publication. The source-admitted
service remains a trust premise that JSON booleans cannot establish.

The inspected prepare_native and launch_native signatures match the proposed
reuse, including exactly three script-derived DLL references, one preparation
and unique attempt paths. certify_native already contains the nested reference
call; a second top-level reference call would be duplicate work. Keep received
prefix and unknown-total remote counters distinct after an abnormal close.

## Budgets, controls and finite exit

The contract separately caps topology, parameters, operations, actual entries,
wire bytes, storage bytes, artifact slots and elapsed time. External native
copies/input/binding/output files are conservatively reserved before creation
by D and A, then deducted from the existing Store's allowance. D is even, as
the Store API requires. The remaining final journal and terminal reserves must
stay unavailable to ordinary writes. Failed and unused reservations are not
refunded. A maximum resource count is a ceiling, not a promise that every
maximum configuration simultaneously fits all other limits.

Projection response and projection-bearing checkpoint caps accommodate the
retained public-return shape separately from small ordinary checkpoints. Every
repeated transport position is charged, even where content hashes repeat.
The source contract correctly qualifies bounded serialized output, checked
cooperative deadlines and actual cleanup observations; it does not promise
peak-memory, kernel cancellation or hard real-time bounds.

The eight existing control groups give a finite exit: contribution/exclusion,
rule roles, properness/site/damping, real prefix/bridge failure, actual learner,
structural aliases, compensation and termination/null comparisons. M6 keeps
all numerical bits and numeric work counts under a predeclared identity mapping;
process and protocol observations remain actual and need not compare equal.
M7 compensates actual applied revisions or replays the active cut; it cannot
invert SGD or refund work. M8 distinguishes small damped steps from a fixed point.

The added child/parent M5 composition uses the same four rows. Child fit on the
first two gives preprocessing mean -3/4 and population scale 1/4, so its last-two
query coordinates are 5 and 7, within 8. Latest child label time 3 precedes
origins 4 and 6. Parent labels 5 and 7 fit cut end 7. Two two-row/two-pass fits
add eight SGD attempts and eight old-vector forward entries; the two frozen
queries add two forwards. No projection is needed. These are derived planned
counts, not executed results or an extra data/solver sweep.

After passing that single implementation cycle, the proposed next step remains
one separately registered chronological learned comparison. Fix as-of features,
label availability, inner fitting, embargo, scoring, budgets and holdout before
fitting. Keep the unchanged-model flattening check separate from a topology
that changes the model. Individual/equal/flat/shallow/deeper controls and a
feasible pinned current published comparator address the actual research claim;
this tiny NN must not be relabeled SOTA. A failed control or negative result
does not authorize more prerequisites until a win appears. No full PGE/PNC
reconstruction is introduced here.

## Evidence and validation limits

The [evidence companion](mixed-message-epoch/2026-09-08/contract-independent-review/manifest.json)
retains 15 lossless gzip records: 161,006 original bytes and
63,522 stored bytes. Each stored identity and decompressed byte sequence
was independently rechecked against its retained local original. Records include
the actual initial working snapshots and findings, final two document copies,
owner commit metadata, original-to-final diff, the executed finite identity-audit
source/invocation, exit-0 result and empty diagnostics. The earlier inline
nine-source hash observation is retained separately from that final executed
script. No earlier failed numerical outcome was rerun or reclassified.

This reviewer ran only source/Git identity checks and documentation gates.
No module was imported to execute inference, no neural training/forward or
scalar/reference solver was called, no bridge peer was launched, and no data,
model artifact or old registered stream was opened. The owner must obtain
implementation source review and preserve the first executable outcomes before
claiming that the planned M1-M8 controls passed.
