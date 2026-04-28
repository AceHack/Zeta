---
name: NEVER ignore flakes — per DST (Deterministic Simulation Testing) discipline, flakes are not "transient, retry" but active determinism violations; a flake means the DST isn't perfect and there's a real bug (race condition, undefined initialization order, environment dependency, etc); retry-and-move-on is the wrong pattern; fix the flake, capture the reproduction, add regression coverage; human maintainer Otto-248 after I (and multiple drain subagents) kept retrying the F# compiler SIGSEGV "flake" instead of investigating; 2026-04-24
description: Human maintainer Otto-248 critical discipline after I treated the dotnet 10.0.203 F# compiler SIGSEGV (exit 139) as a transient flake and retried without investigation for multiple sessions. Rule: every "flake" is a DST violation to be diagnosed and fixed. Retry-and-succeed is not resolution; it's masking.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Flakes are determinism violations. Fix them, don't retry.**

Direct human-maintainer quote (verbatim):

> *"never ignore flakes per DST they must be fixed,
> flakes just mean that your DST isnt perfect."*

## Why this matters

Zeta's philosophy is **Deterministic Simulation Testing
(DST)** — every run of the system with the same inputs
should produce the same outputs. The DST discipline is
inherited from the FoundationDB / TigerBeetle school:

- **If it fails sometimes and passes other times**, that IS
  the bug. Not "the test is flaky." The system is not
  deterministic in the region where the flake lives.
- **Retry-and-succeed is masking.** It hides the real defect
  (race, init order, environment assumption, timing
  dependency, non-determinism in inputs) behind a retry
  loop.
- **Retries also waste time and compute.** Every retry is
  evidence that the lower-level system failed to give a
  deterministic answer.

## The specific trigger — dotnet F# compiler SIGSEGV

Pattern observed across multiple sessions today (2026-04-24):

1. Run `dotnet build -c Release` cold (fresh shell / after
   reboot / first-in-session).
2. F# compiler exits with SIGSEGV (exit 139 = 128 + 11).
3. Retry.
4. Clean build: 0W/0E.

I (and multiple drain subagents in this session) adopted
the retry pattern silently. The human maintainer caught
it and surfaced the rule.

**Three crash reports from today** confirm this is a real
repeatable phenomenon, not a one-off:

- `~/Library/Logs/DiagnosticReports/dotnet-2026-04-24-133113.ips`
- `~/Library/Logs/DiagnosticReports/dotnet-2026-04-24-133536.ips`
- `~/Library/Logs/DiagnosticReports/dotnet-2026-04-24-134309.ips`

These are crash stack traces that will identify the
specific `libcoreclr.dylib` / FSharp.Core call that
segfaulted. Ignoring the signal was a discipline failure.

## What "fix the flake" means in practice

For a build-tool flake like the F# SIGSEGV:

1. **Reproduce deterministically.** What conditions cause
   the segfault? (fresh shell, specific project order,
   uncached state, specific `.NET` SDK patch version, etc.)
2. **Read the crash report / core dump.** macOS IPS files
   + stack traces tell you which library and which function.
3. **Check known-issues upstream.** `dotnet/fsharp`,
   `dotnet/runtime`, `dotnet/sdk` GitHub issues. File one
   if it doesn't exist.
4. **Propose mitigation.** Options:
   - Upstream fix (submit a report / patch)
   - Pin to a known-good SDK version (global.json)
   - Add a pre-build warmup step that deterministically
     triggers the crash on a no-op file first
   - Identify environmental trigger and eliminate it
5. **Regression guard.** Once fixed, add a DST-style
   property test or CI smoke that would fail if the flake
   returns.
6. **NEVER** land code that says "retry if this fails" as
   the permanent fix. That's masking.

For property-test flakes in Zeta-layer code (what DST is
really about):

1. **Capture the seed + inputs** that produced the flake.
2. **Minimize** to the smallest reproducing case.
3. **Fix the race / initialization issue.**
4. **Add the minimized case as a regression test.**

## Scope — what counts as a flake

- Test fails intermittently → flake
- Build tool fails intermittently (dotnet, fsc, nuget
  restore) → flake
- CI check fails intermittently → flake
- Network timeout that "sometimes works" → flake (retry
  is acceptable here, but root cause needs investigation)
- Non-determinism in output (time-dependent, hash-random,
  dict-order) → flake

Not flakes (genuinely external transience, acceptable to
retry):
- GitHub API rate limit (retry with backoff is protocol)
- Remote server 5xx on first hit, 200 on retry
- `gh api` transient network failure

The line: if the flake lives in **our** code or **our**
tool chain, it's a DST violation. If the flake lives in a
genuinely external transient system, retry IS the right
answer but we must distinguish.

## Composition with prior memory

- **DST discipline expert** (`.claude/skills/deterministic-simulation-theory-expert/`) — this memory is a behavioural companion to the capability skill. Skill says "what DST is"; memory says "what discipline to follow when DST is violated."
- **Otto-247 version-currency** — related verify-first
  discipline. Both say "don't accept surface symptoms;
  dig to ground truth."
- **CLAUDE.md verify-before-deferring** — same principle
  at a different scope.
- **Otto-227 cross-harness discovery verified** — same
  empirical-verification discipline.

## What this memory does NOT say

- Does NOT forbid retry mechanisms in production code.
  Retries with backoff are appropriate for genuinely-
  external transient systems. The rule targets *flakes in
  our own stack*.
- Does NOT require fixing every flake immediately. But it
  DOES require **capturing** the flake (crash dump, seed,
  reproducing command) and **filing** a BACKLOG row so
  the fix isn't silently lost.
- Does NOT override the human maintainer's other
  priorities. If a critical merge needs to ship and a
  flake is blocking, the ship can use retry-as-workaround
  — but the flake MUST be captured and scheduled for fix.

## Direct human-maintainer quote to preserve (verbatim)

> *"never ignore flakes per DST they must be fixed, flakes
> just mean that your DST isnt perfect."*

Future Otto: when a build, test, or tool fails and you're
tempted to "just retry," STOP. Capture the failure state
(exit code, stderr, crash dump paths, command that
reproduces). File a BACKLOG row. THEN you can retry to
unblock immediate work, but the flake is on the fix queue
— not the ignore queue.
