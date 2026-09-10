# Mixed-message core: initial independent source review

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, peer owner/core reviewer
Operational status: research-grade independent source review
Lifecycle: active
Disposition: bounded learner/codec checkpoint reviewed; runtime findings open
Work item: 081M1Z63YMC087G0R003N5FH9X

This review binds the learner/declaration/codec checkpoint
`b097d56eccc630046cd3bf618a362b01edeba329` and separately identifies the
uncommitted runtime draft below. It does not accept a completed epoch,
assembled peer/bridge, named M4/M5 route or learned comparison. The reviewer
did not edit the core owner's source or execute its learner, scheduler, tests
or projection service. Separate peer development uses actual compiled codecs
and preliminary admission on synthetic data; those calls are reported in the
[peer progress record](2026-09-08-mixed-message-peer-direct-source-admission.md).

## Learner and local density boundary

The [learner](../../src/Bayesian/BoundedModuleLearner.fs) implements the fixed
12-4-1 point-weight model in section 3 of the
[source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md).
With hidden activations `h_i=tanh(b_i+sum_j W_ij*x_j)`, prediction
`y=d+sum_i V_i*h_i` and residual `e=y-target`, the half-square loss gives
`dL/dV_i=e*h_i`, `dL/dd=e`, `delta_i=e*V_i*(1-h_i*h_i)`,
`dL/dW_ij=delta_i*x_j` and `dL/db_i=delta_i`. The source uses the same old
57-vector for every derivative and divides each gradient by 1024 before
replacement. The scalar order starts each sum with its bias. No updated output
weight leaks into a hidden derivative.

The caller receives immutable proposals. A late replacement refusal retains
the actual forward, loss, full gradient and already reached replacement
prefix, without committing that partial vector. The dense twelve-coordinate
fixture distinguishes all 57 gradient entries, including child coordinates
and presence bits; central-difference checks supply a separate discriminator.
This reviewer derived the formulas independently and read the tests, without
replaying their numerical outcomes.

Preprocessing fits only the supplied training rows, uses population variance
with denominator N and replaces an exactly zero standard deviation with 1.
Raw training features have the 64 bound. Queries use the stored scaler, admit
finite raw values, and refuse processed values beyond 8. The contract does
not impose the training raw bound on queries. Scaler, ports, source bindings,
training lineage and exact weights enter the artifact version. This is a
point-weight SGD component, not a Bayesian parameter posterior or a claim of
full PGE inference. Prior
[PGE density findings](2026-09-08-precision-gated-experts-equation-review.md)
remain separate from this implementation contract.

## Codec findings and checkpoint disposition

Two early draft issues were reported independently: source-tree construction
outside public Result catches, and eager list/tree expansion before the output
allowance. The owner repaired these with source thunks, lazy traversal and a
bounded prewalk. A follow-through read found the full-result encoder still
bypassed the thunk and Terminal traversed its ledger before rejecting zero
allowance. The two actual failing entrypoint controls and subsequent repair
remain in the owner's separate archives.

At b097, the relevant public encoder boundaries cover source construction,
measurement and emission. Nonpositive allowance refuses before traversal;
the full-result publication failure retains the actual result. The closed
source-return catalog retains actual values before encoding and does not
instantiate a CLR type named by input. The richer epoch codec follows the
independently reviewed [minimal UTF8 convention](2026-09-08-mixed-message-epoch-identity-codec-independent-review.md).
The learner artifact's restricted ASCII identifiers/paths do not trigger the
default writer's plus/HTML escape mismatch.

This is a bounded disposition on the inspected learner and codec boundaries.
Private admitted handles, immutable exposed collections, typed failures and
the minimal outside-assembly research surface remain part of the final
public-API review. AGENTS.md's pre-v1/no-consumer rule governs that review;
no generic plugin or compatibility layer is justified here. Preliminary
admission is not substituted for the unfinished applied runtime.

## Independent custody check

The [review evidence](mixed-message-epoch/2026-09-08/core-initial-independent-review/manifest.json)
retains this reviewer's draft snapshots and exact audit script/output.
All 110 checkpoint and 36 repair records match their stored gzip identities,
decompressed identities and actual local originals. All six final repair
source pins match immutable b097. The earlier checkpoint manifest remains
bound to its earlier source bytes where they differ. No original was changed
to match a later file.

The retained owner logs distinguish the first learner test-compile failure,
17 passes, separate 26/28/1 passes, two individual failed zero-allowance tests,
the final 31-pass run, and the failed/corrected quick gates. There was no
single invented 29-test run. This audit reads existing evidence; it does not
reproduce those tests or establish source/process execution from hashes alone.

## Runtime draft findings

The separately retained runtime draft is 155,611 bytes, SHA-256
`38DC4E07237DD84F14CB1664BAD5FE528192828C167FB7789A503A942DDD018A`.
It was uncommitted when inspected. These are source findings, with no runtime
failure induced or observed by this reviewer:

1. `runEpoch` retains a TaskCompletionSource receipt, completes it only on a
   normal `runOwned` return, and ignores the finishing task. An uncaught
   owned-chain fault/cancellation could leave every receipt lookup pending.
   The owner accepted propagation of the actual abnormal completion without
   inventing an EpochResult, plus an explicit ordinary caller boundary.
2. Checkpoint identity/encoding occurs before the callback's guarded
   publication path. If that step fails, the already allocated observation
   remains in the ledger but can be absent from `Unpublished`. The owner
   accepted exactly-once unpublished tracking across that earlier boundary.
3. A service error/raise returns before remote-count observation, leaving
   initial zero totals marked complete. A missing wire certificate similarly
   leaves certificate/nested totals complete even though the actual call may
   have preceded a lost or publication-refused return. Retain known counts
   and mark unavailable totals incomplete; missing data does not prove zero
   work. This finding is pending its repaired source and discriminating test.

The first read confirms the intended stored-ACK-before-state-swap order and
an actual Commit callback after application. Full source review must still
bind the repaired runtime pin, the source-owned snapshot admission helper,
complete proposal/remote correspondence and all declared controls. Actual
two-node and four-session routes remain closed until assembled review and
custody. No source, dataset, numerical contract or control roster is expanded
by this preliminary report.

The independent review's own quick gate passed all 16 checks. Its exact
invocation/stdout/stderr/completion records are included in the evidence
manifest, separately from the core owner's development gates.
