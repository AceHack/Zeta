---
name: No warnings anywhere — zero-tolerance INSIDE the system boundary; DST external-invariants exempt (Aaron 2026-05-02)
description: Aaron 2026-05-02 ~13:10Z framing — "we don't want any warnings of any kind anywhere." Then immediately scoped the rule via DST external-invariants framing — warnings caused by external infrastructure (GitHub Releases 502s during mise install) are OUTSIDE our system boundary and exempt. The rule covers warnings caused by OUR factory: our code, our config, our scripts, our tooling internal state. External transient failures (network, third-party service flakes) are not owned by us and their warnings are acceptable, even desired (they're honest signal that the external dep blipped).
type: feedback
caused_by: Aaron observing `mise WARN HTTP GET .../actionlint.../tar.gz attempt 1 failed (transient): 502 Bad Gateway` during PR #1200's semgrep job, asking "we don't want any warnings of any kind anywhere", then on reflection scoping the rule via DST external-invariants framing to exempt external infrastructure from the no-warnings policy.
---

The human maintainer 2026-05-02 ~13:10Z initial framing:

> *"we don't want any warnings"*

Scope clarification immediately after:

> *"of any kind anywhee"*

Specific exemplar pasted:

> *"2026-05-02T13:07:20.4965197Z mise WARN  HTTP GET"*

Then ~13:13Z, after Otto cataloged the warning surface, Aaron
applied the DST external-invariants framing as the scope-cut:

> *"mise WARN HTTP GET github.com/.../actionlint...tar.gz
> (the transient 502s during mise install). A then per DST
> exeternal invariants this is okay"*

The third message is the load-bearing scope rule. The first
two messages are the framing-input surface; the third
applies the actual scope-cut.

## The rule (corrected scope)

**Zero warnings INSIDE the system boundary.** External
infrastructure warnings are exempt per DST external-invariants
framing.

The system boundary is the surface we control:

- **Our code** (`src/**`, `tests/**`)
- **Our config** (`Directory.Build.props`, `tsconfig*.json`,
  `.config/dotnet-tools.json`, `package.json`, `bun.lock`,
  workflow files)
- **Our scripts** (`tools/**`, including `tools/setup/install.sh`)
- **Our tooling's internal state** (mise local cache state,
  bun install state, dotnet local-tool state — when the
  warning is about OUR cached state being wrong)
- **Our docs / lints / hooks** (markdownlint findings on our
  files, ASCII / invisible-char lints, archive-header check,
  pre-commit hooks)

Outside the system boundary (DST external-invariants exempt):

- **External network failures** — HTTP 4xx/5xx from
  github.com / api.github.com / dl.google.com / npm
  registries / nuget.org / mirrors.* / etc. These are
  transient blips in OTHERS' infrastructure.
- **External service degradation** — GitHub Actions
  scheduler delays, Azure runner provisioning slowness,
  CDN cache misses.
- **External rate limits** — when a tool is
  rate-limited by an upstream we don't own.
- **External version availability** — upstream tag /
  release temporarily missing during a publish window.

## Why DST external-invariants is the right scope-cut

Per the existing DST discipline (`docs/FOUNDATIONDB-DST.md`
and the factory's deterministic-simulation-testing principle), the
factory's correctness is defined relative to **invariants we
control**. External systems are MODEL inputs, not factory
state. We model their failure modes (transient errors,
rate limits, network partitions) and our code handles them
gracefully — but the FAILURES THEMSELVES are outside the
factory.

The mise WARN HTTP GET line is honest signal that an
external invariant (GitHub Releases availability) failed.
Eliminating that warning would require:

- **Either** lying (suppressing the warning)
- **Or** removing our dependency on the external (vendor the
  binary into our repo, which has its own costs:
  binary-blob storage, version-bump labor, security-audit
  surface area).

Suppressing is the wrong fix per the no-warnings principle.
Vendoring is a real fix but imposes costs that may not be
worth paying just to silence a transient warning. The DST
framing names this trade-off honestly: external warnings
are OK because they're not our system's invariant
violations.

## What stays in scope (warnings to eliminate)

The rule still bites on:

- **F# / dotnet build warnings** — already 0 via
  `TreatWarningsAsErrors=true`. Preserve.
- **Lint findings on our files** — markdownlint, semgrep,
  shellcheck, actionlint, tsc tools, eslint findings ABOUT
  files we wrote. If our markdown has bad list numbering,
  we fix it.
- **Code Scanning alerts on our code** — 13 csharp alerts
  currently open (081KQ8P5D0008QG0R002RYXE89 P0). Our code, in scope.
- **Pre-commit hook warnings** — paired-edit check, ASCII
  lint, invisible-char lint, hook-side warnings.
- **Our tool execution warnings about OUR state** —
  `dotnet pack` warnings about our project files;
  `bun install` warnings about our package.json.
- **Workflow-internal warnings** — when a workflow step
  emits a warning about OUR config being wrong (e.g., a
  deprecated action input WE pass).

## Specific exemplar — the mise WARN HTTP GET case

The 2026-05-02 13:07Z PR #1200 semgrep job warning:

```
mise WARN  HTTP GET https://github.com/rhysd/actionlint/
releases/download/v1.7.12/actionlint_1.7.12_linux_amd64
.tar.gz attempt 1 failed (transient): HTTP status server
error (502 Bad Gateway) for url (...); retrying in
175.191269ms
mise WARN  HTTP GET ... attempt 2 failed (transient): 502
mise WARN  HTTP GET ... attempt 3 failed (transient): 502
mise ERROR Failed to install ...
```

**Verdict per the corrected rule: exempt.** The 502s are
GitHub Releases infrastructure failure. The warning is
honest external-invariant-violation signal. Mise is
correctly retrying, correctly emitting WARN per attempt,
correctly emitting ERROR after exhausting retries. The
behavior is right.

The right response to a hit:

1. **Verify it's transient** — rerun the job. If it
   succeeds, the 502 was real and the system handled it.
2. **DO NOT suppress the warning.** The warning is honest
   signal about external state.
3. **DO consider if our retry-budget is too narrow.** If
   3 retries with sub-second backoff isn't enough during
   GitHub Releases incidents, that's a tunable in mise's
   config — adjust upward, but the warnings WILL still
   appear during actual outages.
4. **DO consider a bounded-retry mechanism for transient
   CI flakes** — the right shape is a wrapper that retries
   longer with exponential backoff, NOT suppression. (No
   backlog row filed yet for this; reference removed
   pending row creation.)

## What's still in scope (and what isn't from this session)

In scope for elimination (per the no-warnings rule):

- 13 csharp Code Scanning alerts (081KQ8P5D0008QG0R002RYXE89 P0)
- Any markdownlint findings on our docs (caught + fixed
  during this session on PRs #1199, #1200)
- Any tsc-tools failures on our scripts (multiple PRs in
  the queue have non-required `lint (tsc tools)` failures
  — needs triage)

Out of scope per DST external-invariants:

- mise transient HTTP 5xx warnings during install
- Action-runner provisioning delays
- GitHub-side rate limits
- Upstream registry transient unavailability

## Composes with

- **DST discipline** — the framing this rule uses for the
  scope-cut. External invariants are model inputs, not
  factory state.
- **081KQ8P5D0008QG0R002RYXE89 (P0)** — csharp Code Scanning alerts (in scope)
- **A future bounded-retry-for-transient-CI-flakes row** —
  unfiled at the moment; mechanizes graceful handling of
  external invariants by extending retry budgets and
  timeouts so transient external invariants resolve within
  a single bounded attempt window — the warnings never
  appear because the retry mechanism handles the transient
  before WARN-level emission. Where bounding-the-retry
  isn't enough, the mechanism is to REPLACE the dependency
  (vendor, mirror, or swap the upstream) so the warning
  source is removed at root. Suppression of already-emitted
  warnings remains forbidden regardless.
- **`Directory.Build.props` `TreatWarningsAsErrors`** —
  the in-scope F#/dotnet enforcement.
- **`memory/feedback_external_dependency_download_retries_durable_fix_not_ephemeral_rerun_aaron_2026_04_29.md`**
  — durable-retry / rerun-vs-fix rule (Aaron 2026-04-29).
  Reruns are the right immediate response to
  external-invariant transients; durable fixes go into the
  retry mechanism itself, not into per-incident
  ceremony.

## What this rule does NOT require

- Does NOT require eliminating external-infrastructure
  warnings. They're honest signal.
- Does NOT permit suppression of in-scope warnings.
  Suppression is a lie regardless of warning class.
- Does NOT cover warnings emitted before the factory's
  process tree (e.g., a developer's local shell rc file
  printing a warning during `git pull`).
- Does NOT require fixing all in-scope warnings in the
  same tick this rule lands. Substrate landing first;
  warning-elimination passes are queued backlog work.

## Self-encoding test

This memory file's body must not produce any in-scope
warning under the lints that actually apply to memory/
files (ASCII lint and invisible-char lint per BP-10).
markdownlint is intentionally NOT applied to memory/**
(per `.markdownlint-cli2.jsonc` ignores list); external
lints (e.g., a CDN-hosted lint that fails to download)
are also exempt.

## Provenance

- Aaron 2026-05-02 ~13:10Z initial framing: *"we don't
  want any warnings"*.
- Aaron 2026-05-02 ~13:11Z scope clarification: *"of any
  kind anywhee"*.
- Aaron 2026-05-02 ~13:12Z exemplar: pasted the literal
  mise WARN HTTP GET line.
- Aaron 2026-05-02 ~13:13Z scope-cut: *"per DST exeternal
  invariants this is okay"* — narrowed the rule to
  in-system-boundary only.
- Origin context: investigation of PR #1200 CI
  failure surfaced the mise transient warnings; the
  maintainer's initial framing escalated to absolute zero,
  then a reflective scope-cut applied the DST framing to
  exempt external invariants. Then the maintainer flagged
  Otto's "directive" framing throughout this file as itself
  a violation of the no-directives autonomy rule
  (Otto-357) — reframed in-place to "framing" / "input" /
  "scope-cut" / "observation" language in subsequent edit.
- Carved candidate (subject to maintainer grading):
  *"Zero warnings inside the system boundary. External
  infrastructure warnings are honest signal — eliminate
  the dependency or accept the warning, but never
  suppress the message."*
