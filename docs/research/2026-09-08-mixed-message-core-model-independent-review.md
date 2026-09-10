# Mixed-message core: independent model and epoch review

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, peer owner/core reviewer
Operational status: research-grade independent source review
Lifecycle: active
Disposition: bounded core model, epoch and owner-control source accepted
Work item: 081M1Z63YMC087G0R003N5FH9X

This disposition binds `d7e8e3806afaecdaed8a4a1ff5244c899201c870`, following
the [learner/codec review](2026-09-08-mixed-message-core-initial-independent-review.md)
and [runtime failure review](2026-09-08-mixed-message-core-runtime-failure-review.md).
The final MixedMessageEpoch.fs is 167510 bytes, SHA256
`B75CEF997AF2D7D98BF7043039A63B94ED6E770C675EBAADBFC644A79DB57CB2`.
Its dedicated test is 67508 bytes, SHA256
`F13889BB9450F7BB0AF7F41E019841196512347414BC38DB797A5E041D25DB2B`.
The learner, learner test and both project files remain byte-identical to the
previous reviewed checkpoint. The reviewer read the new source/control diff,
the relevant complete admission, update and scheduler paths, and all new tests.
No core, learner, kernel, scheduler, native/reference service or named route was
executed by this review. The peer's separately reported zero-operation checks
are not numerical evidence for this disposition.

## Local mathematics and finite model

The declared node density remains the Gaussian prior times
`exp(k*z-c*exp(z))` and zero to two `Normal(z;mu_i,1/gamma_i)` factors and
Gamma priors, relative to the declared Lebesgue measures. Child means are
clamped plug-in values with variance zero, including outputs of precision
children. This is not uncertainty propagation through those edges, an
independence proof for repeated forecasts or a normalized neural likelihood.
The separate 57-parameter learner remains point-weight SGD, with the already
reviewed old-vector derivatives and atomic replacement.

For Gamma updates, the source uses the current z marginal, including its
unary site. With clamped mean mu, the site is log power 1/2 and rate
`((m-mu)^2+v)/2`. The fixed m=2, v=3, mu=-1 control therefore gives residual
12 and rate 6. Prior shape 2/rate 3 yields combined shape 5/2/rate 9.
The wrong cavity gives residual 2 and is independently discriminated. Input
and Gamma-prior pairing occurs before traversal sorting; a sole slot 1 stays
gamma/1 and normal/1. The corrected Details now separates the actual prior
encoding's requested/represented shape from the combined represented shape.
The retained small-shape control does not silently equate requested and
represented binary64 shape.

For a projected Gaussian (m,v), checked conversion produces natural
parameters `(m/v,1/v)`. The unary proposal subtracts the same Gaussian base
used by the projection. In the exact M3 control, projected `(-1/2,2)` minus
base `(3/2,1)` gives site `(-2,1)`; treating the projected belief as a site
would instead produce combined `(1,3)`. Natural coefficients are damped by
the explicit shared alpha expression. Because the prior is added once and
the Normal and unary sites are all replaced, real-arithmetic interpolation
of all sites gives `(1-alpha)*oldCombined + alpha*projected`; the actual
binary64 path retains its operation order and reconstruction differences.
Finite improper sites can occur inside a proper total. Checked moment
admission of the total remains required.

The M8 analytic fixture has t=1, u=3/2, k=-3/4, c=1 and projected
m=-1/4, v=1/2. Here exp(m+v/2)=1, so both objective derivatives vanish.
A tiny damped application remains far from stationary. A local certificate
therefore covers the undamped candidate and its exact dyadic target only;
it does not certify the damped/reconstructed belief or convergence of the
finite mixed schedule. The code labels this boundary explicitly.

## Epoch, history and API boundaries

The typed site maps provide keyed replacement and other-factor exclusion.
The implementation does not call FactorGraph or inherit unchecked Product
behavior by implication. Priors enter once; derived variable/model-factor
identities are checked independently of prior ownership. Explicit aliases
resolve to computational nodes and introduce no new factors. Declaring a
second Normal factor is a different model, even if it consumes the same
clamped mean; distinct IDs alone do not prove independent evidence.

The real SoftScheduler.drive route has one fixed handler/source and the exact
admitted finite operation roster. Each actual return is retained before later
admission or publication. A matching stored checkpoint acknowledgment precedes
state replacement; the actual Commit follows it. A later Commit failure retains
the already applied state. The previously reviewed receipt-task settlement,
unpublished-prefix, unavailable-remote-counter and bounded-diagnostic repairs
remain intact. Snapshot allowances preserve fixed prior-session work and
monotone global reservation prefixes; they neither reset work nor refund bytes.

Compensation now checks an increasing operation/sequence/revision chain,
successful admission, returned source family and successful source outcome
before treating a revision as applied. Neural output bits/sequence must agree
with the retained returned forward; block Inputs and Proposal must agree with
the retained BlockAttempt. Exact checkpoint/prefix identities and the current
last state are bound before direct restoration or separately charged replay.
Inverse SGD and unapplied proposals refuse. These are structural checks on
supplied retained history under the admitted caller/custody premise; passive
JSON and matching hashes do not authenticate an external invocation.

The conservative withdrawal rule at exact 87bc6b28 applies before numerical
entry: selected learned artifacts, retained weights and inherited training
child evidence refuse for a supplied current cut containing retractions.
The active/retracted sets must be disjoint. Cold-start active-row fitting with
ParentVersion as publication history remains possible; it is not warm-start
reuse. The [separate invocation review](2026-09-08-mixed-message-invocation-independent-review.md)
binds that clarification and its missing-ancestry limitation. Selective reuse
or global revocation would need a new reviewed ancestry mechanism.

Public-API review follows the repository's public-api-designer blueprint,
with AGENTS.md's pre-v1/no-consumer rule taking precedence over its older
compatibility framing. The outside-assembly research peer needs the concrete
plan, service, recorder, result and codec types. Admitted handles and mutable
sequence/task state stay private; exposed collections use immutable lists/maps.
The source-return holder preserves actual values through a closed encoding
catalog, rather than dispatching a type named by input. Ordinary admission and
publication failures use Result values. A null/fabricated private handle is
outside admitted execution and cannot manufacture an epoch receipt. The
same-process repeated invocation is an exact receipt lookup, with an explicit
sequential-caller scope rather than a concurrency guarantee. Internal control
seams are not a new generic plugin surface. No public DTO signature changed
in the final model repair.

## Actual owner evidence and independent audit

The two compensation size repairs remove descriptive duplicates only. The
complete Compensate operation remains in Operation/Inputs and its actual
BlockAttempt. The complete ProjectionRequest remains in the actual service
primitive Inputs, with the complete returned response retained separately;
Details carries the uniquely associated RequestId. The original 83794-byte,
71862-byte and 69101-byte refused results remain recorded. The original larger
pure-site fixture, not just its smaller metadata variant, later completes at
65395 bytes under the unchanged checkpoint cap. Larger histories may still
refuse. The synthetic service carrier in this local fixture is deliberately
not admissible native/process/certificate evidence at the real bridge boundary.

The [independent audit](mixed-message-epoch/2026-09-08/core-model-independent-review/manifest.json)
verifies all 283 control, 35 repair and five owner-audit records against their
gzip identities, decompressed bytes, local originals and immutable Git bytes.
The counts are respectively 8388142/1442392, 820904/117039 and 4584/1819
original/stored bytes. Both final six-file rosters match d7e8. The initial
283-record archive deliberately retains its earlier BBC5502A test; that one
historical comparison differs from the final F13889BB test and was not rewritten.
The test-only repair replaces a redundant self-comparison with actual returned
original/permuted PlanSha256 associations. Final owner evidence reports 71
passes, zero failed/skipped tests and all 16 quick checks passing, with the
first failed gate and every earlier failed attempt retained separately.

Independent parsing reproduces equal M6 flat/nested numerical state and
observations, equal nonempty mixed-site primitive returns, the M7 replay's
numerical equality with its explicit one-sequence provenance offset, and pure
site restoration without a new projection. Recomputing only the loss sums
from the 12 retained actual forward values gives 1.2499836430788507 for the
initializer, 1.2475864407910346 for the fitted weights, and
1.2523833896361443 for the reversed-label fit. This is retained-value arithmetic,
not an independent learner replay or held-out performance result. Each actual
fit records eight SGD entries/eight nested forwards; the 12 later isolated
transforms/forwards are separate from epoch counters.

No remaining material implementation blocker was established within this
source/model/API scope. Source-admitted actual service execution, named M4,
four-session M5, the separately registered frozen query and integrated full
validation remain outstanding assembled obligations. Successful finite sweeps
do not establish global inference convergence, and these controls do not
establish a competitive learned predictor. The next scientific exit remains
the already proposed finite chronological learned comparison after those
specific integration checks, without requiring full PGE reproduction.

The reviewer's own [documentation gate](mixed-message-epoch/2026-09-08/core-model-independent-review/gate/manifest.json)
passed all 16 quick checks for these two unique review reports and their
independent evidence companions. It is separate from the owner's 71-test
control run and does not rerun that numerical workload.
