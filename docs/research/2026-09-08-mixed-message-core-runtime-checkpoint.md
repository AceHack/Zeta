# Checked mixed-message core: runtime checkpoint

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade source development
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X

## Import scope

This extends the immutable [learner/codec checkpoint](2026-09-08-mixed-message-core-implementation-checkpoint.md)
at `b097d56eccc630046cd3bf618a362b01edeba329` with a callable epoch runtime.
It is an implementation checkpoint for peer wiring and independent review,
not final acceptance of all eight control groups. The accepted
[source contract](2026-09-08-checked-mixed-message-module-epoch-source-contract.md),
[transport amendment](2026-09-08-mixed-message-epoch-transport-amendment.md) and
[identity/codec conventions](2026-09-08-mixed-message-epoch-identity-codec-conventions.md)
remain unchanged. No named actual M4, composed four-session M5, registered nested
query, native process or interval-certificate invocation ran in this writer.

The concrete compiled additions are
`runEpoch(admitted, service, recorder) -> Task<EpochResult>`,
`tryAdmitBudgetSnapshot(previous, next, allowSame) -> Result<unit,Failure>` and
`trySelectArtifacts(current, expectedParents, completed)`.
The existing public DTO/codec shapes, tuple recorder/service interfaces and
single protocol sequence remain fixed. A newly received snapshot must advance;
an exact previously observed local snapshot may repeat. No globals or ambient
identity supply a session, service, source manifest or remaining budget.

## Actual reuse and retained execution

The implementation invokes `SoftScheduler.drive` and checked
`PrecisionGateKernels` operations. Its independently held state, observations
and original failures survive the scheduler's actual `Error` return. It does
not invoke `FactorGraph`: the typed site ledger implements the relevant
other-factor exclusion and replacement laws in its own representation. Matching
those laws does not import broader guarantees or establish conditional
independence between graph nodes.

Each operation retains its actual learner or block return before proposal
admission, sequence allocation and publication. Blocks retain the closed
catalog of actual primitive/service calls. A checkpoint acknowledgment precedes
application; the following Commit callback may fail after the immutable state
was applied. That applied prefix remains the last committed state. The complete
actual result remains available if final encoding refuses. These memory
observations are separate from a durable recorder acknowledgment.

The Gaussian block constructs its local target from checked natural parameters.
The service response remains an explicitly injected source/custody premise.
The new unary site is the checked quotient of the projected Gaussian belief by
the exact Gaussian base. Damping separately checks the combined proper belief;
the original interval certificate applies to the undamped proposal. Child means
are declared clamped plug-in inputs. No optimizer, generic RPC framework,
implicit child training call, source-to-machine proof or convergence claim is
introduced.

The first `runEpoch` invocation installs ownership before any callback enters.
Overlapping and completed lookups return that exact original task, without new
callbacks, clock reads or numerical work. Ordinary callback exceptions and
cancellation become refused epoch results with the actual retained prefix.
An unexpected fault/cancellation outside the constructible result boundary now
settles the original task with that actual abnormal outcome; it does not invent
an EpochResult or scheduler invocation. A null private handle is CLR misuse
outside admitted execution and produces a prompt argument-task failure. This
is the registered sequential-caller scope, not a general thread-safety claim.

## Development checks and corrections

The first runtime test attempts stopped during compilation: record/overload
annotations, tuple separators and strict F# indentation. After those fixes,
37 focused tests passed in 195 ms. Their new runtime assertions exercise an
actual two-step learner schedule, checkpoint refusal before application,
Commit refusal after application, and original in-flight/completed task reuse.
The recorder is a synthetic local callback control. No real Store/process
custody is claimed by those tests.

The independent peer identified three runtime defects in the earlier draft:

1. A faulted/cancelled owned chain left the cached completion task pending.
   The two discriminators actually timed out after 500 ms before repair.
2. Checkpoint identity encoding could fail before recording the already
   retained observation as unpublished. The finite 64-KiB control actually
   observed an empty unpublished list before repair, with no callback entry.
3. A lost service response or absent certificate left remote totals falsely
   marked complete. Both synthetic service controls actually failed before
   repair. Available counts now remain lower bounds; unknown totals are marked
   incomplete without erasing an earlier observed count.

Those six regressions failed in one retained run. After repair, 44 focused
checks passed in 208 ms. Remote completeness is local knowledge of the supplied
source-carrier prefix. Exact comparison with coordinator totals is justified
when both are complete; an incomplete observed count is only a lower bound
against an independently complete total. Distinct incomplete prefixes are
retained separately. JSON claims alone do not establish execution.

The peer then identified unbounded exception messages in core Failure values.
Two initial tests observed 2048 ASCII bytes and 2400 emoji UTF8 bytes. A third
control initially used a compiler-normalized literal; after constructing an
actual isolated surrogate at runtime it also failed strict UTF8 encoding.
A fourth discriminator reproduced propagation of a malformed returned Failure.
The corrected core diagnostics retain a scalar-aligned UTF8 prefix of at most
1024 bytes, replacing invalid code units with U+FFFD. Exception observations
separately bound type/message to 256/512 UTF8 bytes. Closed Failure admission
checks codes, stages and the optional 256-character ASCII field. An invalid
returned Failure stays unchanged in its actual Call; a separate bounded core
failure reports that admission problem, and encoding does not silently rewrite
the original nested result. The final combined run passed all 48 tests in
206 ms after one retained record-annotation compiler correction.

The nonnumerical Gamma golden also passed: the full nonempty GammaSites and
GammaBlock call tree matches the bridge's 1235-byte canonical fixture, SHA256
`7EC5B37CA1D3998375A50432765E7241E1FD0F9108BB2F72CE04602CBB7C6009`.
Its initial direct internal-access compile failure and the corrected existing
friend-module route are retained. Two metadata-only probes confirmed the
assembly names/friend declaration; neither invoked a numerical operation.
The closed friend seams used for publication/completion controls are internal
only and do not add a public or wire-selected implementation.

## Source custody and remaining controls

The [runtime manifest](mixed-message-epoch-implementation/2026-09-08/core-runtime-checkpoint-1/manifest.json)
binds the six owned source/project files and 216 complete compressed originals:
4594192 raw bytes and 1112344 stored bytes. These include actual build/test
stdout, stderr, argv/time/exit records and source copies made before each
command; intermediate drafts and both metadata observations; the independent
Gamma golden; and b097's complete quick/push/live-remote proof. Draft fragments
are historical inputs, not substituted for the final module. The original
110- and 36-record archives are unchanged.

These are development test logs and exact source custody, not serialized
scientific receipts for the registered final workload. No test was repeated
solely to collect every arithmetic return. Remaining local controls cover M1
evidence/site laws, M2/M3 checked mixed blocks, M6 explicit alias equivalence,
M7 compensating history admission and M8 bounded damping/label controls.
The peer/bridge owners and root retain the real M4/M5 and nested-query gates.
The complete source review, repository gate and assembled execution remain
separate obligations. Only the epoch module and its dedicated test changed
beyond b097; shared indices and derived build-graph wiring remain root-owned.

The normal quick gate passed all 16 executed checks on these unchanged six
source/project files. Its complete command and before/after identities are
retained in the [gate manifest](mixed-message-epoch-implementation/2026-09-08/core-runtime-gate-1/manifest.json).
All 216 runtime and five gate records were locally checked against stored,
decompressed and original bytes before commit. Normal push/live-ref proof
follows separately and does not substitute for final runtime acceptance.
