# Inherited-pipe fixture correction and final native gate

Date: 2026-09-07

Operational status: research-grade validation record

Author: Vera, OpenAI Codex using GPT-6 Astra

Work item: 081M1XQM8E4087G0R0036P5RWY

## Failure and correction

The [initial CI record](ci-correction.md) retains the macOS assertion
failure at `c247403be5d6320b74903e5562b36f55d6884d6f`: the inherited-pipe
fixture expected launcher exit zero and observed 137. Its 500-ms watchdog
started before Bun launch, mixing a setup-speed assumption into the
intended test of a child retaining pipes after its launcher exited.

Correction `3149e2596fb12935ceb3c27568da7b16d405b548` factors the actual
process-start/drain/join/cancellation path into `captureProcessWithDeadline`.
The production wrapper opens its owned streams, constructs its single
timed cancellation source and delegates before starting the process.
The thirty-second metadata deadline, forty-millisecond live watchdog
fixture and model-checker timeout policy remain unchanged.

The revised fixture owns a real Process, streams and cancellation source
and runs that same helper. Its launcher atomically publishes an independent
child-PID file and prints the PID to exercise stream capture. The fixture
observes that readiness and the actual launcher exit zero, confirms the
child and incomplete capture are still live, then cancels. It requires
capture completion with launcher exit zero, cancellation reported and the
child still alive. There is no sub-500-ms latency claim. Bounded setup/join
waits are patience limits that fail rather than retries.

The child uses an untimed `Atomics.wait`. The separate production entry
fixture continues to test real timer-to-cancellation and live-process
termination. The two tests cover distinct parts of the composed mechanism.

Failures retain the unique fixture directory beneath
`TestResults/tlc-diagnostics/`, with invocation, separate PID ownership,
raw streams and the available failure stage. Fixture-owned launcher/child
cleanup is explicit; cancellation alone is not credited with isolating an
exited launcher's child. Successful cleanup joins capture before stream
disposal. A failed bounded join remains a recorded failure and does not
establish quiescence. The guarded failure-record writes and explicit
cleanup loop retain the primary assertion when their own operations fail;
cleanup-only errors explicitly fail.

## Independent review and focused evidence

Vera (`/root/protocol_review`, OpenAI Codex using GPT-6 Astra) independently
reviewed the source without executing it. The reviewer found that the
initial unguarded primary/cleanup diagnostic writes could mask an earlier
error. The final guarded source resolves this finding. The reviewer
accepted exact commit `3149e2596fb12935ceb3c27568da7b16d405b548`, including
the caller-owned lifetimes, observed-exit handshake, unchanged production
deadline, separate watchdog coverage and bounded-join limitation. The
reviewer also read the final 18-pass log; no build, test, JVM or experiment
was executed in the independent review. Root separately read and accepted
the same source shape and limits.

- [Earlier draft](ci-native-focused-attempt-1.log): 18 passed, 3.0600 seconds.
  The [captured pre-guard diff](ci-native-before-guard.patch) is relative to
  `91baf83d79c146367b8183c58732bb8f437eb55b`; this was a working draft,
  not the final source pin.
- [Final focused source](ci-native-focused-attempt-2.log): 18 passed,
  2.9341 seconds on CI-pinned Bun 1.3.13; inherited-pipe case 68 ms is an
  observed test duration, not a threshold claim.
- [Both failing hygiene test files](ci-hygiene-unit-recovery.log):
  61 passed, zero failed, 109 expectations on Bun 1.3.13.
- [Initial complete TS-hermetic CI log](ci-ts-hermetic-attempt-1.log.gz):
  exactly the same two live-tree ambient-time/race assertions failed.
  The complete compressed stream and its uncompressed hash are retained.
- [Earlier TS correction preflight](ci-ts-correction-preflight.log): all
  sixteen checks passed before the subsequent native correction.
- [Focused/raw-log fingerprints](ci-native-correction-hashes.json) preserve
  the source/attempt distinction and compressed/uncompressed identities.

## Final integrated gate

The correction was merged with main `3c442b282` as
`4b4d9a237b23e53a4b297af72eb2053f3c51c8b6`. Main added ZetaFs policy/source
tests and cluster changes after the earlier combined gate, so a fresh
mapped Release build and complete solution run are required on this
integration. The prelaunch record pins 103 selected inputs equal to
committed bytes. Pending edits are validation documentation only; no
registered experiment generation or timing occurs in this gate.

The gate completed successfully at 13:20:08 UTC. The
[prelaunch input record](ci-full-gate-attempt-1.json) and
[complete result/hash inventory](ci-full-gate-results.json) bind this
writer's actual integration, distinct from the earlier larger root gate.

- [Mapped Release build](ci-full-build-attempt-1.log): exit zero,
  zero warnings/errors, 105.43 seconds.
- [Complete solution](ci-full-tests-attempt-1.log): 7,539 passed,
  six existing skips, zero failed across seven projects; all 52 pinned
  TLC cases and 18 runner metadata/synthetic cases passed.
- Complete compressed TRX files:
  [Bayesian](ci-final-Bayesian.Tests.trx.gz),
  [Core mediator](ci-final-Core.CSharp.Mediator.Tests.trx.gz),
  [Core C#](ci-final-Core.CSharp.Tests.trx.gz),
  [C#](ci-final-Tests.CSharp.trx.gz),
  [type provider](ci-final-Tests.CSharp.TypeProvider.trx.gz),
  [F#](ci-final-Tests.FSharp.trx.gz),
  [F# Git](ci-final-Tests.FSharp.Git.trx.gz). Their compressed and
  uncompressed fingerprints and complete parsed counts are in the result
  inventory. The F# project contributed 6,549 passes and six skips;
  the other projects contributed 990 passes.
- BftConsensus passed in 4 minutes 54.28585 seconds. The actual live
  [invocation](ci-final-bft-invocation.json) and
  [runtime](ci-final-bft-runtime.json) identify its owned input workspace
  and Java/C1 policy. These are live snapshots; the final outcome comes
  from TRX, not an inference from the snapshots.
- All 103 selected prelaunch input hashes remained identical. No
  unexpected attempt directory remained. This is selected input/source
  evidence, not a complete source-to-binary dependency proof.
- [Final formatter](ci-final-format.log): exit zero for supported C#/VB
  scope, with workspace-loading warnings and unsupported-F# notices
  retained; no claim that this command formatted F#.
- [Final local preflight](ci-final-preflight.log): all sixteen checks
  passed on the corrected integration and indexed validation files.

```bash
mise exec bun@1.3.13 -- dotnet build Zeta.sln -c Release -p:ContinuousIntegrationBuild=true -m:1 -nr:false
mise exec bun@1.3.13 -- dotnet test Zeta.sln -c Release --no-build --blame-crash --blame-hang-timeout 15m --logger 'trx;LogFilePrefix=tlc-retention-ci-final'
mise exec bun@1.3.13 -- dotnet format --verify-no-changes --no-restore
```

All initial CI failures remain failed. They are not erased by this local
recovery. Corrected-head CI is still an independent publication signal.
The original `c247` archive is unchanged; the supplemental immutable tag
`archive/validation/081M1XQM8E4087G0R0036P5RWY-tlc-attempt-retention-ci-correction`
will preserve this correction/evidence history before squash deletion.

## Final independent evidence acceptance

The same independent reviewer accepted the retained evidence after reading
all 103 current/committed input hashes, the four corrected source files
against their two source pins, all twelve project/log fingerprints and
all seven decompressed TRX files. The reviewer independently parsed 7,545
individual outcomes: 7,539 passed and six not executed. The 52 unique TLC
IDs equal the registry's gate tier (53 entries in the complete catalog);
the other 18 runner cases passed. All 89 source/copied input identities
in the BftConsensus snapshot match current bytes. Jar, registry, runner
DLL/source and Java fingerprints were unchanged at inspection.

The reviewer confirmed the actual C1 flag, one worker, original 4,665,495
distinct-state assertion and unchanged F# model timeout. The precise
BftConsensus TRX duration is `00:04:54.2858498`. Build and formatter
observations, six explicit skips, empty current diagnostic directory and
live-snapshot limitations were also checked. No algorithm, test, build,
Java process or experiment was rerun. The reviewed result inventory SHA-256
is `F6C395F7A2EDC71847B0492D9F5E533061D871381FF44C02EAAB36F71CAC071C`.
No material source/evidence finding remains; remote corrected-head CI
remains its own signal.
