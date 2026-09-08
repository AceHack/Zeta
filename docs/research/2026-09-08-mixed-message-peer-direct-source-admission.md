# Mixed-message peer: source and Start admission progress

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra, peer implementation owner
Operational status: research-grade implementation development
Lifecycle: active
Status: incomplete feature branch; no complete peer or named control acceptance
Work item: 081M1Z63YMC087G0R003N5FH9X

This extends the [transport foundation](2026-09-08-mixed-message-peer-transport-foundation.md)
in the single owned
[peer script](../../src/Research.FSharp/MixedMessageEpochReplay.fsx).
The script now calls the pinned core codecs and preliminary admission, but
still has no main or runEpoch invocation. Ready, projection/ACK/Commit,
EpochReturn and Terminal integration remain pending. This progress must not
be promoted as an implemented M4/M5 route.

## Direct observations before Ready

`observeDirectSources` takes the independently admitted flat binding map and
observes four fixed files in order: the executing script, actual loaded Core,
Core.Abstractions and Bayesian assemblies. Source-fixed FSI/Type locations
select those paths; no supplied path chooses a file to load or read. Require
the exact expected repository location and byte hash. The existing bounded
same-descriptor reader retains each complete actual hash before a later
stability/cleanup/hash refusal. Each locator and its expected identity are
retained before the next fallible access. A failure stops later file reads.

The bridge owner clarified the maximum flat map: up to 128 SourceFiles,
including both scripts, plus three DLL paths and ProtocolSha256, hence 132
entries. Local executable roles remain outside that admitted map. The map must
also fit 64 KiB canonical bytes. The peer checks that size before file reads,
using the exact ASCII key-escape/hash-string length, and does not expand JSON
to measure it. The independent coordinator still admits the full manifest and
all source files; these four local observations do not replace that premise.

Assembly names/locations and matching current file bytes are finite metadata
observations. They are not evidence of every loaded dependency, the original
in-memory image bytes, hostile namespace isolation or full runtime closure.
The declared macOS descriptor and stable writer-tree limitations remain those
of the existing foundation. The checks request metadata and file operations;
they do not request a numerical operation or prove absence of all runtime
initialization behavior.

## Retained development observations

The [evidence manifest](mixed-message-epoch/2026-09-08/peer-direct-source-admission/manifest.json)
preserves both source snapshots, harnesses, complete raw outputs and outcomes.
An initial harness preparation asserted the wrong existing final spelling
(`run ()` instead of `run()`) and stopped before any child launch. Its actual
preparation refusal is retained; it was not a compiler or numerical failure.

The first actual development invocation passed 38 checks with empty stderr.
It added actual source/assembly observations, mismatched/missing bindings,
and malformed/empty/null/oversized roster refusals to the previous 30 checks.
The initial map ceiling was 128. The bridge owner supplied the precise 132
calculation before source pinning. A separate corrected invocation passed 40
checks with empty stderr, adding the 132-entry admission and oversized
canonical map refusal. No historical row was replaced or rerun under its old
name. Both invocations loaded the declaration-only script with the three
explicit DLL references; neither called runEpoch, a learner, a kernel, a
projection service or any named control.

The corrected snapshot is 34,921 bytes, SHA-256
`6A04162C83DCA2BCE7799316A4FD0AC50EF21E82447D1CB16D071DB12C00A927`.
Its observed direct DLL identities were Core 9,268,224 bytes, Core.Abstractions
46,592 bytes and Bayesian 1,175,040 bytes; exact hashes and actual assembly
names/paths remain in the complete stdout records. These are development
images, not a frozen final implementation closure. FSI compilation and the
40 checks establish this source slice only. The documentation/source quick
gate also passed all 16 checks. The final complete source review, full gates,
immutable assembled archive and separately authorized real controls remain
required.

## Failed publication sequence boundary

The core owns each attempted operational allocation, including a callback
whose frame never emits. Its private admitted handle exposes the next sequence
after the actual core return. The coordinator's settled refusal behavior is to
retain an admitted complete EpochReturn before sequence association, then
reject a gap as a separate transport/publication refusal. If result identity
or schema cannot be admitted, retain raw candidate bytes with that distinction.
Do not alter the original EpochResult failure, reconstruct a missing checkpoint
or accept arbitrary gaps. Successful and forecast closure still require
contiguous emitted operation sequences. This is an implementation obligation,
not a claim that the foundation already implements the final exchange.

## Passive Start envelope follow-up

`tryReadStart` recognizes only the exact amended eight-key Start envelope,
fixed schema, bounded ASCII session ID, uppercase hashes and object payloads.
It checks the finite flat string/hash map, rejects the local @host/@python
roles, and returns owned passive Plan/BudgetSnapshot trees. It does not admit
their numerical/scheduler semantics or verify their canonical correspondence;
those remain the owning core codec/admission steps before Ready. Parsing an
empty object fixture is therefore not admission of an empty epoch plan.

The [separate Start development archive](mixed-message-epoch/2026-09-08/peer-start-envelope-development/manifest.json)
retains two actual invocations. The first new harness failed compilation on
an extra closing parenthesis, before its checks ran. Its child completion is
exit 1; the inherited capture wrapper printed that value but itself returned
0. Both observations remain distinct. The corrected separately named harness
also propagates the child exit after retention. It passed 53 combined checks
with empty stderr: the previous 40 plus 12 passive Start controls and the
direct-map host-role refusal. No source bytes changed between those two
invocations, and no failed row was replaced by the later result.

That peer source is 39,137 bytes, SHA-256
`7DBC3D22A00B8C590F0806C80AEFD8808C2FF4C771C2FEFDE0B576D1EAAEB722`.
The earlier 34,921-byte source above remains its own completed development
slice. The new quick gate passed all 16 checks; neither that gate nor these
fixtures establish a callable complete peer, a runEpoch invocation or actual
M4/M5 outcomes. Complete source integration/review remains pending.

## Actual compiled codec/admission follow-up

The exact core checkpoint `b097d56eccc630046cd3bf618a362b01edeba329`
was imported as `243e4689ba1380e5b00e241d295426d2b25c7b07`. Its six source,
test and project files were compared byte-for-byte before use. The local
Bayesian Release build completed with zero warnings/errors. This is the
learner/declaration/codec checkpoint; its runtime remains unfinished.

`admitStart` observes the four actual direct files before calling their core
codecs. It retains each actual budget/plan decode, canonical plan encoding,
compact forecast admission and private plan admission return before later
judgment. It checks the exact plan/source map and canonical plan hash. Raised
exceptions have a separate bounded observation. Compact forecasts explicitly
depend on the selected coordinator's complete prior bundle/closure admission;
the peer does not turn matching hashes into remote execution evidence.

The [core admission development archive](mixed-message-epoch/2026-09-08/peer-core-admission-development/manifest.json)
retains the exact source, harness, invocation, outputs and build/import records.
The first invocation passed all 61 checks with empty stderr: the previous 53
plus eight checks of actual compiled codecs/preliminary admission using a
synthetic zero-operation plan. These cover complete admission, source refusal
before core calls, actual budget and plan errors, retained canonical bytes on
hash mismatch, binding mismatch before encoding, late private-admission
failure and null input. No scheduler, learner, kernel, projection, M4 or M5
operation was invoked.

The raw harness's final `Scope` string incorrectly retained the narrower old
description, "deterministic transport, passive JSON and actual direct-file
metadata only". Its exact bytes are unchanged. The invocation's scope and
this paragraph correct that label: actual zero-operation core codec/admission
calls occurred. The synthetic BudgetSnapshot and trusted compact-forecast
context are fixture inputs, not observations of a real coordinator session.

This peer source is 45,352 bytes, SHA-256
`957F2D5337811959930A6F1C1B720B1ED72E2EDB5FEB1C23B5F62F0124CE82D8`.
Its actual admission returns remain in a closed in-memory union if later
checks or publication fail. They are not generic type-dispatched wire data.
The source slice still awaits complete peer integration and independent
source review; the named actual controls remain closed.
The separate quick gate passed all 16 checks. The archive contains 18 exact
records, 100,029 original bytes and 23,944 gzip bytes, including the actual
build, import and quick-gate outcomes.

## Fixed framing and passive response correspondence

The next source slice adds the six closed outgoing kinds, exact payload keys
and canonical envelope construction. It reserves both the envelope and LF
before complete allocation, invokes the pinned core's minimal UTF8 codec and
retains that actual return before the final frame copy. The peer does not
reconstruct numerical results or instantiate a type named by data. Ordinary
checkpoints retain their 64 KiB cap; the later actual callback must identify a
projection-bearing checkpoint before using the separate 16 MiB allowance.

ACK and projection-response admission retain the raw frame, passive parse and
actual compiled decoder return before session/sequence/source/hash checks.
An ACK binds the complete sent bytes including LF and the actual selected
Store's six-field identity descriptor. A valid storage refusal remains a
refusal; successful passive decoding does not confer storage or application.
The peer does not open the descriptor's file. The response layer checks the
outstanding request identities and fixed failure grammar; complete
Native/Certificate admission remains the core's source-owned responsibility.
Likewise decoded snapshots still require advancement admission before the
callback updates its latest observed budget. These are pending integration
obligations, not completed callback behavior.

The [framing and response archive](mixed-message-epoch/2026-09-08/peer-response-codec-development/manifest.json)
preserves the first 12 passing framing checks, then an actual ACK-source
compile failure (`ResultBuilder` was qualified at the namespace rather than
its `ResultComputation` module). A separately named correction run passed all
27 framing/ACK/response checks with empty stderr. Fixtures supply synthetic
frames and invoke actual codecs; they do not invoke storage, scheduler,
learner, kernel, projection or named controls. The first compile failure
remains unchanged, rather than being represented as a failed numerical call.

An author source read before that ACK compile found a separate draft mistake:
it required gzip, borrowing an archive convention. The selected
`hidden_switch_compiled_record_store._artifact` actually emits `identity`
with equal original/stored byte counts and hashes. The bridge owner confirmed
it forwards that actual descriptor unchanged. The unexecuted draft and finding
are retained; the corrected fixture discriminates an invented gzip descriptor.

The corrected source is 62,223 bytes, SHA-256
`A167B6F42792AE82A601516CD58F6724CE15B13B8BB975AAB74468D7A5221F8A`.
It still has no main, actual Ready exchange or runEpoch invocation. The
complete callback/loop, assembled source review and actual controls remain
pending. Normal artifact/source gates cannot substitute for those premises.
The quick gate passed all 16 checks. The response invocations inherited the
capture helper's framing/canonical-codec scope label; their complete fixture
source and stdout summary explicitly record the additional ACK/response
decoder calls. Those original labels are retained without alteration.
