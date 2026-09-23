---
id: 081M380V792087G0R001PR993V
type: task
state: backlog
priority: P2
slug: restore-crash-dumps-and-test-coverage-under-mtp-add-crashdum
title: "Restore crash dumps and test coverage under MTP: add CrashDump/HangDump and coverlet.MTP extensions after xunit.v3 4.x lands"
created: 2026-09-23T20:55:48.258Z
depends_on: [081M380V4M4087G0R003R4FM8X]
composes_with: []
---

# Restore crash dumps and test coverage under MTP: add CrashDump/HangDump and coverlet.MTP extensions after xunit.v3 4.x lands

Moving `dotnet test` to Microsoft.Testing.Platform mode (081M380V4M4087G0R003R4FM8X) dropped
two VSTest-only capabilities, deliberately and on the record:

1. **Crash naming.** `--blame-crash` wrote a `Sequence_*.xml` naming the test in flight when
   the host died, which `print-blame-sequences.ts` (removed with that change) surfaced in
   the gate log. Under MTP the equivalent is `Microsoft.Testing.Extensions.CrashDump` (`--crashdump`). The hang half is
   already replaced in `gate.yml` by xUnit's `--long-running 300` plus MTP's `--timeout 20m`.
2. **Coverage.** `profile.ts coverage` used `coverlet.msbuild` (`/p:CollectCoverage=true`),
   which hooks the VSTest target and never runs in MTP mode. The MTP form is `coverlet.MTP`
   (or `Microsoft.Testing.Extensions.CodeCoverage`); `profile.ts coverage` refuses with a
   pointer here until then.

**Why a follow-up and not the same PR:** every MTP extension package is versioned with MTP's
major. xunit.v3 3.2.2 pulls MTP 1.9.1; 4.x pulls MTP 2.x. Adding a 1.x extension on main
would load against MTP 2 after the bump, and changing any `packages.lock.json` on main would
make dependabot PR #17459 conflict. So: land the runner switch, land #17459, then add the
2.x extensions here.

## Done when

- `Microsoft.Testing.Extensions.CrashDump` (2.x, matching the resolved MTP) is referenced by
  every test project, the gate's Test step passes `--crashdump`, and a crash names the test
  (verify with a deliberately-crashing throwaway test, not by reading docs).
- A crash reporter in `gate.yml` surfaces the MTP crash output by name, gated on
  `steps.test.outcome` (never bare `failure()` — it needs `bun`).
- `fsharp-mutation-probe.ts` and anything else calling `dotnet test` stays on the MTP
  argument form.
- `profile.ts coverage` produces `coverage.cobertura.xml` again under MTP.
- All seven test projects' discovered counts are unchanged (8032 at the time of writing).
