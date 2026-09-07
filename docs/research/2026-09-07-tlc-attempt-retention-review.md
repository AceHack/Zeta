# TLC attempt retention: independent source review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XQM8E4087G0R0036P5RWY
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Delegated review identity: `codex/tlc-attempt-retention-review-20260907`
Artifact status: accepted source review; combined catalog validation remains separate

## Scope and source chronology

This review covers the separate failure-retention/startup-retry repair in
the TypeScript TLC CLI and F# TLC test runner. It does not review or approve
a model, a new JVM compiler policy, the hidden-switch experiment's results,
or a change to the registry's expected exits, state counts or model tiers.
The C1/platform-policy decision is separate work.

The first complete implementation reviewed was committed as
`2e69017ff2c8bf2294adbd7f3ea6b02980fd204c`. Its nine-file scope comprises
`run-tlc.ts`, `tlc-attempts.ts`, `tlc-attempts.test.ts`, the optional crash
path in `tlc-invocation.ts`, `Tlc.Attempts.fs`, `Tlc.Runner.Tests.fs`, the
F# project link, `registry/tlc-retry-fixtures.json` and the diagnostic
artifact step in `.github/workflows/gate.yml`.

The final capture/drain follow-up is
`07e399929be52669f8ae9cf374690cb1dba4d5a0`. The reviewer accepts this
source within the stated scope: no material retention, retry or metadata
probe finding remains. The [implementation report](2026-09-07-tlc-attempt-retention.md)
and [validation inventory](tlc-attempt-retention-validation/2026-09-07/README.md)
retain the author-run checks and their limits.

The reviewer read the actual source and fixtures without editing those
files, launching Java/TLC, running a build or test suite, generating a
registered hidden-switch stream, or performing a timing measurement.
The implementation author and reviewer are separate delegated instances
of Vera using the same model family; this is source-path and reviewer
separation, not external social replication.

## Findings and dispositions

### 1. Process metadata must veto text-only retry

The initial retry predicates admitted a startup string without consulting
the actual process signal/error result. A process could print a startup
marker, then die by signal or timeout without spelling that event in its
output, and receive a retry.

The TypeScript loop now requires ordinary exit `1`, no signal, no process
error, remaining retry budget and explicit pre-TLC startup evidence.
Checker banners, progress, answers, fatal output and in-run OOM markers
veto retry. F# requires ordinary exit `1` and the same textual boundary;
launch/I/O exceptions leave retained failure evidence without entering its
retry loop. F# observes Unix signal termination through a non-startup exit
code, rather than a separate Node-style signal field. The shared synthetic
roster exercises metadata-only fatal, killed, timed-out and other-exit
cases as well as mixed startup/checker output. TypeScript also normalizes
Bun's absent launch-failure status/signal fields to explicit JSON nulls.

### 2. The identity probe needs attempt-owned crash and output paths

The initial `java -version` probe lacked an owned working directory and
crash path. A probe crash could therefore place `hs_err` outside the
attempt that would be retained and uploaded.

Both probes now use the private workspace and a separate
`version_hs_err_pid%p.log` path. Invocation metadata is written before the
probe starts. Version stdout and stderr are captured directly into owned
files; their hashes and the actual version argv are recorded. A failed
probe leaves its partial files and runner-failure stage intact. The TLC
process uses its own crash path and output files.

### 3. Complete CI upload must include hidden files

The pinned upload action defaults to excluding hidden files, so selecting
the whole directory alone did not select every retained file. This was
verified against the exact upstream
[action definition](https://github.com/actions/upload-artifact/blob/043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/action.yml).
The owned diagnostic-root upload now explicitly enables
`include-hidden-files: true`.

The workflow requests seven days of retention. It is not indefinite
preservation or a guarantee that a killed runner, failed upload, exhausted
disk or unavailable artifact service will preserve bytes. Local unexpected
attempts have no automatic size cap or purge; the byte inventory is
accounting, not a quota or a claim that storage cannot fill.

### 4. New working-tree inputs cannot disappear from the private copy

The original collector used only tracked paths. A new unstaged model,
configuration or helper could be omitted when the runner moved execution
away from the original specs directory.

The collector now admits tracked and ordinary untracked `.tla`/`.cfg`
files, reads current working-tree bytes, requires the selected module and
configuration, and explicitly refuses ignored non-generated local inputs.
Nested or quoted source paths are refused instead of being flattened into
different inputs. Generated `MC*.tla` and `_TTrace_` files remain outside
the source universe; symlinks and invalid source basenames are refused at
copy admission.

Both language fixtures now create a real temporary git repository, stage
an initial model/config, alter the model without staging, add a new
untracked selected module/config and helper, and run the actual collector
and copy path. They check the copied changed/helper bytes, exclude a
foreign generated trace, and require an explicit ignored-helper refusal.
`SourceCommit` is explicitly checkout context; the copied byte hashes,
not a claim of a clean HEAD, identify the admitted inputs.

### 5. The probe deadline must include redirected-output draining

Review of the first complete source found a remaining F# edge: a timed
`WaitForExit` bounded the direct process, but the following pipe-copy
awaits had no deadline. A launcher could exit while a descendant retained
the redirected pipe, leaving the probe blocked on EOF beyond the stated
deadline. This was an inspection-derived finding; the reviewer did not
execute the suggested synthetic witness.

The follow-up applies one cancellation deadline to the exit task and both
pipe-copy tasks. `WhenAll` observes those tasks before stream disposal;
timeout cancellation retains partial files and reports `TimedOut=true`.
If the direct process remains alive, the runner requests a tree kill.
The production metadata explicitly does not claim isolation of descendants
whose launcher has already exited.

The new synthetic fixture makes a Bun launcher exit after spawning a
child with inherited output pipes. It checks exit zero together with a
capture timeout, verifies that the child is still alive, and separately
cleans that fixture-owned child PID. That cleanup is not production runner
behavior. The guarantee is bounded managed probe capture, not hard
real-time scheduling or general process isolation. The F# model process
continues to use `None` with no deadline; only the identity probe uses the
new thirty-second deadline.

## Ownership and classification checks

Each attempt gets a fresh private directory, copied input workspace,
state directory, raw stdout/stderr files and crash-report destinations.
Preparation metadata precedes source admission. Copy or identity failures
retain an explicit stage and the partial directory. Input copies and
diagnostic writes refuse overwrite.

Raw process output is written to files before semantic classification;
the old buffered-output limit no longer truncates retained TLC streams.
The TypeScript `finally` block and F# scoped stream ownership dispose the
first stream if opening the second fails. Synthetic capture fixtures
exercise success, missing executables, timeout and second-open failure.

Cleanup occurs only after the expected semantic outcome passes the full
verdict checks: pinned banner, exit, clean/expected-violation distinction,
required violation detail and any exhaustive state-count pin. It deletes
only that attempt. An earlier unexpected attempt, its full stream
sentinels, crash file, state bytes and source helpers survive a later
expected cleanup. Foreign traces in the original specs directory are not
deleted. These are bounded filesystem and classification checks, not a
claim of tamper resistance against another process with the same write
permissions.

## Evidence read by the reviewer

The reviewer verified all nine entries in the
[source manifest](tlc-attempt-retention-validation/2026-09-07/source-hashes.json)
against their committed bytes at `07e399929`, and all twenty-three then
retained entries in the
[log manifest](tlc-attempt-retention-validation/2026-09-07/log-hashes.json)
against their exact file bytes. The source/fixture reading and hash checks
were this reviewer's work. The following executions belong to the
implementation author and were not rerun by this reviewer:

- The complete-capture repair's F# focused run passed 18 cases in 3.4419
  seconds. The pinned Bun 1.3.13 no-build repetition passed 18 cases in
  3.4596 seconds using the same native assembly.
- The pinned Bun 1.3.13 TypeScript run passed 45 tests with 202 expectations.
  Strict TypeScript checking produced an empty successful output log.
- The original nine-file implementation passed all sixteen quick checks.
  Actionlint's log is empty. The formatter exited zero for its supported
  C#/VB scope and retained workspace-loading warnings and unsupported-F#
  notices; it is not evidence that `dotnet format` formatted F# projects.

The final `TimeoutAction` wording qualification followed the focused native
build; the parent must rebuild final integrated source before its full
gate. The focused filter excludes every actual pinned TLC model. Passing
it is not a full-catalog result and does not validate the separate C1
policy or the combined hidden-switch tree.

The initiating internal TLC failure, subsequent unchanged isolated JVM
failure and unrelated compiler exit remain failures. A later focused
recovery does not establish their cause or turn the original gate green.
Full catalog/solution validation and any coordinated JVM-policy change
must retain their own source identity and evidence.
