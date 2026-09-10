# CHSH repair validation

Operational status: research-grade
Lifecycle: active

The implementation is `a46143f6b`; the final integration is `66d0121ce`,
merging current `origin/main` at `0e3456d60`. This directory retains local
validation output; it does not itself prove GitHub checks or merge state.

| Command | Result | Retained output |
| --- | --- | --- |
| `dotnet build Zeta.sln -c Release --nologo` | Zero warnings, zero errors | [Repair build](repair-release-build.txt) |
| Focused CHSH, AntiSybil caveat and meter test filter | 55 passed, no skips | [Focused tests](repair-focused-tests.txt) |
| `dotnet test Zeta.sln -c Release --no-build --nologo` | 7,475 passed, six existing skips | [Full repair tests](repair-full-tests.txt) |
| `dotnet format --verify-no-changes` | Exit zero; F# explicitly skipped by tool | [Formatter output](repair-format.txt) |
| Integration Release solution build | Zero warnings, zero errors | [Integration build](integration-release-build.txt) |
| Integration full solution tests | 7,487 passed, 6 existing skips | [Integration tests](integration-full-tests.txt) |
| `bun run preflight:quick` | All 16 checks passed | [Quick preflight](integration-preflight.txt) |

Both complete native runs passed. The pre-push hook reruns all 16 quick checks
on the final committed documentation and work-item move. No local failure was
removed or hidden from these native validation runs.
