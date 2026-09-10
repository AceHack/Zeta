# Initial publication CI correction

Date: 2026-09-07

Operational status: research-grade validation record

Author: Vera, OpenAI Codex using GPT-6 Astra

Work item: 081M1XQM8E4087G0R0036P5RWY

## Observed failures

[PR #16925](https://github.com/Lucent-Financial-Group/Zeta/pull/16925)
initial head `c247403be5d6320b74903e5562b36f55d6884d6f` passed all sixteen
local quick checks, then failed three publication checks. Their full job
logs remain unchanged, including terminal escapes:

- [Attribution failure](ci-attribution-attempt-1.log), run `34122996417`,
  job `101745114329`: the visible PR description omitted the full trailer
  block even though the armed squash body contained it. The description
  was corrected; this first failed check remains failed.
- [Hygiene failure](ci-hygiene-attempt-1.log), run `34122996477`,
  job `101745114542`: the ambient-time audit rejected a ten-second
  `setTimeout` inside the timeout fixture's child source string.
- [Filesystem race failure](ci-races-attempt-1.log), same run,
  job `101745115219`: `lstatSync(path)` gated a later `copyFileSync(path)`.
  The inspected pathname could identify a different file by the copy open.

No job was rerun or cancelled to obtain a different outcome. The original
annotated archive remains at `c247403be5d6320b74903e5562b36f55d6884d6f`.

## Source correction and boundaries

Commit `91baf83d79c146367b8183c58732bb8f437eb55b` changes only the
TypeScript attempt helper and its tests. The timeout child now waits
without a wake-up timer using `Atomics.wait`; the tested capture watchdog
is the only mechanism that terminates it.

Source copying opens once, checks that descriptor with `fstatSync`, reads
that same descriptor, writes the captured bytes to an exclusive destination
and compares captured/copied hashes. A regression replaces the source
pathname after opening and requires the original descriptor's bytes;
reopening the pathname would return the substituted bytes and fail it.
Static symbolic links and directory inputs are refused. Existing output
bytes survive an attempted second exclusive write.

Available `O_NOFOLLOW` and `O_NONBLOCK` flags are used and their availability
is recorded in initial attempt metadata and each admitted source identity.
The primary [Node filesystem documentation](https://nodejs.org/api/fs.html#file-open-constants)
lists these optional flags separately from the Windows-supported set.
Absent flags preserve the existing Windows path rather than disabling
TypeScript TLC preparation on that platform. The actual local tests ran
on macOS; an empty-flags fixture checks the fallback flag construction,
not execution on Windows.

The source pathname is also observed for a static symbolic link after
opening, but never authorizes another source-path open. On platforms
without no-follow, this observation retains the stable writer-owned tree
assumption shared with the F# implementation. Neither implementation
claims hostile ancestor isolation, protection against all concurrent
namespace mutation, or an atomic snapshot against in-place file writes.
The fingerprints identify the actual captured/copied bytes. F# source and
its existing precheck are unchanged by this correction.

## Validation

- [CI-pinned Bun 1.3.13](ci-ts-pinned-1.3.13.log): 47 passed, zero failed,
  224 expectations across the three focused TLC TypeScript test files.
- [Installed Bun 1.3.14](ci-ts-1.3.14.log): the same 47/224 pass.
- [Strict TypeScript check](ci-typecheck-recovery.log): exit zero, no output.
- [Exact ambient-time audit](ci-ambient-recovery.log): 1,571 test files
  scanned; zero unregistered delay findings, no allowlist change.
- [Exact filesystem-race audit](ci-races-recovery.log): 2,701 TypeScript
  files scanned, zero new findings, unchanged 295-entry baseline.
- [Byte fingerprints](ci-correction-hashes.json) bind both corrected source
  files, every retained failure/recovery log and unchanged native inputs.

The earlier complete native gate remains evidence for its actual source
snapshot, not an execution of these later TypeScript bytes. Native helper,
runner, project and registry are byte-identical to the initial published
head. Required corrected-head CI remains separate publication evidence.

Independent reviewer Vera (`/root/protocol_review`, OpenAI Codex using
GPT-6 Astra) accepted `91baf83d79c146367b8183c58732bb8f437eb55b` after a
read-only review of the two corrected source blobs, all fourteen manifest
records, the four unchanged native files against `c247`, both 47/224 logs
and the exact audit outcomes. The reviewer found no material issue in the
descriptor, ownership, platform-boundary or watchdog correction. No test,
build, JVM, scientific run or source edit was performed in that review.

## Subsequent macOS fixture failure

The same initial `c247` head subsequently failed macOS job `101745193323`
in run `34122996477`. Exactly one F# case failed: `probe deadline covers
inherited pipes after the launcher exits` expected exit zero and observed
137. Its 500-ms watchdog began before launching Bun, so the intended
exited-launcher precondition was not established independently of startup
speed. The other 6,545 F# cases passed, with six existing skips. This is a
separate fixture finding; it does not change the earlier TypeScript
acceptance or identify a cause for historical TLC/JVM failures.

The [complete macOS failure log](ci-macos-attempt-1.log) is preserved.
The [bounded fixture correction and new native validation](ci-native-correction.md)
are recorded separately; the original combined native gate is not a
substitute for that validation.
