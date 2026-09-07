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

## Remaining integration evidence

The parent coordinates the fresh mapped full build and full solution/catalog
gate on C1-policy plus these exact repair bytes and hidden-switch source.
Those results will be indexed separately when complete. This record does not
call a synthetic-only filter a successful model check.
