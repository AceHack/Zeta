# TLC retention validation - 2026-09-07

[Repair and boundaries](../../2026-09-07-tlc-attempt-retention.md).

All linked logs retain their exact local bytes. [Log fingerprints](log-hashes.json)
bind the files; [source fingerprints](source-hashes.json) bind the nine repair
files at `07e399929`. No real TLC catalog case was executed by the focused
commands below. The historical motivation logs are separate failed attempts preserved by
native source/evidence commit `31ee67f9b4ed68ce6d0b52d1bdeb223c48d57dbb`.
That later preservation commit is not a recorded execution HEAD. The logs
contain no prelaunch SourceCommit field. The earlier source review and
unchanged isolated command identify the relevant TLC runner/model/jar
context, without upgrading it to a complete execution provenance receipt.

## Focused commands

```bash
mise exec -- bun test src/Core.TypeScript/formal-verification/tlc-attempts.test.ts src/Core.TypeScript/formal-verification/tlc-invocation.test.ts src/Core.TypeScript/formal-verification/run-tlc.test.ts
mise exec -- bunx tsc --ignoreConfig --noEmit --skipLibCheck --module esnext --moduleResolution bundler --target esnext --types bun --strict src/Core.TypeScript/formal-verification/tlc-attempts.ts src/Core.TypeScript/formal-verification/tlc-attempts.test.ts src/Core.TypeScript/formal-verification/run-tlc.ts
mise exec -- dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release -m:1 -nr:false --filter 'FullyQualifiedName~TlcRunnerTests&DisplayName!~TLC checks the pinned model' --logger 'console;verbosity=normal'
mise exec bun@1.3.13 -- bun test src/Core.TypeScript/formal-verification/tlc-attempts.test.ts src/Core.TypeScript/formal-verification/tlc-invocation.test.ts src/Core.TypeScript/formal-verification/run-tlc.test.ts
mise exec bun@1.3.13 -- dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --no-build --no-restore --filter 'FullyQualifiedName~TlcRunnerTests&DisplayName!~TLC checks the pinned model' --logger 'console;verbosity=normal'
mise exec -- dotnet format --verify-no-changes --no-restore
mise exec -- actionlint .github/workflows/gate.yml
mise exec -- bun run preflight:quick
```

The fixture filter excludes every actual pinned model; it does not serve as
the full catalog gate. The no-build pinned-Bun run used the same native
assembly as F# attempt 5. The subsequent native source edit only qualifies
`TimeoutAction` metadata about orphan descendants; parent integration must
rebuild the final source before the full gate. No measurement semantics
changed between these checks.

## Retained outcomes

| Record | Outcome |
| --- | --- |
| [TS attempt 1](ts-focused-attempt-1.log), [2](ts-focused-attempt-2.log) | Earlier 38-case fixture roster passed |
| [TS attempt 3](ts-focused-attempt-3.log) | 44 passed, 1 failed: Bun omitted launch-failure status instead of null |
| [TS attempt 4](ts-focused-attempt-4.log), [final](ts-focused-final.log) | 45 passed, 202 expectations after explicit null normalization |
| [Typecheck attempt 1](ts-typecheck-attempt-1.log) | Explicit-file invocation required `--ignoreConfig` |
| [Typecheck attempt 2](ts-typecheck-attempt-2.log), [3](ts-typecheck-attempt-3.log) | Error-code typing and readonly assertion issues retained |
| [Typecheck attempt 4](ts-typecheck-attempt-4.log), [final](ts-typecheck-final.log) | Passed, empty output |
| [F# attempt 1](fsharp-focused-attempt-1.log) | Type inference/overload errors before tests; repaired explicit annotations |
| [F# attempt 2](fsharp-focused-attempt-2.log) | 15 passed, 3.0725 seconds |
| [F# attempt 3](fsharp-focused-attempt-3.log) | Compiler MSB6006 exit 139; no source diagnostic or executed test |
| [F# attempt 4](fsharp-focused-attempt-4.log) | One unchanged retry: 17 passed, 2.8578 seconds |
| [F# attempt 5](fsharp-focused-attempt-5.log) | Complete-capture repair: 18 passed, 3.4419 seconds |
| [Pinned Bun TS](ts-pinned-1.3.13.log) | Bun 1.3.13: 45 passed, 202 expectations |
| [Pinned Bun F#](fsharp-pinned-1.3.13.log) | Bun 1.3.13 fixture children: 18 passed, 3.4596 seconds |
| [Formatter](format.log) | Exit 0 for supported C#/VB scope; workspace-loading warning and unsupported-F# notices retained |
| [Actionlint](actionlint.log) | Exit 0, empty output |
| [Derived artifact](derived-format.log) | Build graph already current |
| [Source preflight](preflight-source.log) | All 16 quick checks passed for source `2e69017ff` |
| [Reviewed preflight](preflight-reviewed.log) | All 16 quick checks passed for source `07e399929` and draft documentation |
| [Original full failure](motivation-native-tests-full-attempt-1.log) | Hidden-switch full gate failed at BftConsensus fingerprint recovery |
| [Original isolated failure](motivation-native-tlc-isolated-attempt-1.log) | Unchanged isolated BftConsensus SIGBUS; no cause inferred |

The original full gate and isolated failure remain failed. Compiler attempt 3
also remains failed; one unchanged recovery does not identify its cause.
The separate policy owner reported no quick/push/Java/.NET workload during
11:19-11:21 UTC; a 0.4-second Python archive/hash step at 11:20:19 is recorded
without causal attribution or a claim to know all host activity.

## Combined gate

The parent ran the fresh complete gate at
`457bdf094f368eb9e6f2b359b72e5677fd015eb3`. This repair author copied the
exact evidence bytes and independently parsed the seven TRX files. The
[source/input prelaunch record](root-final-gate-attempt-1.json) and
[result inventory](root-final-gate-results.json) bind that larger C1-policy,
retention and hidden-switch integration, not this smaller writer's HEAD.

- [Full build](root-final-build-attempt-1.log): exit 0, zero warnings/errors,
  101.75 seconds.
- [Full solution](root-final-tests-attempt-1.log): 7,552 passed, six existing
  skipped rows, zero failures; 52 pinned TLC, 18 TLC metadata/synthetic and
  16 additional hidden-switch cases passed.
- [Compressed and uncompressed byte fingerprints](combined-gate-hashes.json)
  bind all fifteen copied records, including the seven complete TRX files:
  [Bayesian](root-final-Bayesian.Tests.trx.gz),
  [Mediator](root-final-Core.CSharp.Mediator.Tests.trx.gz),
  [Core C#](root-final-Core.CSharp.Tests.trx.gz),
  [C#](root-final-Tests.CSharp.trx.gz),
  [type provider](root-final-Tests.CSharp.TypeProvider.trx.gz),
  [F#](root-final-Tests.FSharp.trx.gz),
  [F# Git](root-final-Tests.FSharp.Git.trx.gz).
- [Active BftConsensus observation](root-final-bft-observation.json),
  [invocation](root-final-bft-invocation-live.json) and
  [runtime](root-final-bft-runtime-live.json) retain the actual owned
  workspace/copy/runtime facts. These were live metadata snapshots;
  final outcome comes from the completed test result, not those snapshots.
- [Known team activity](root-final-team-activity.json) retains the existing
  quick-lint overlap at build start and the limits of host observation.
- [Publication hook](claim-push.log): all sixteen quick checks passed and
  remote claim head `8367117f1ff8c4fec2a837b24d4bc080d5c75b75` was verified.

```bash
dotnet build Zeta.sln -c Release -p:ContinuousIntegrationBuild=true -m:1 -nr:false
dotnet test Zeta.sln -c Release --no-build --blame-crash --blame-hang-timeout 15m --logger 'trx;LogFilePrefix=hidden-switch-final-1'
```

No prelaunch native input or scientific source changed during the gate.
No unexpected diagnostic directory remained. The native dependency/capture
behavior is covered in that full catalog execution, including the new
private workspace and inherited-pipe boundary. The six existing skips
remain explicit. Earlier failed TLC and compiler attempts remain failed;
this fresh combined gate does not retroactively turn them green.

The original review pins are preserved on the repair claim branch. An
immutable supplemental archive will retain the final source/evidence head
before squash-merge branch deletion. Its exact tag proof will be added at
publication, after the C1 policy is integrated from main.
