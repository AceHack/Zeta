---
id: 081KSV2WD0008QG0R002A3QJ5Q
priority: P2
status: open
title: Bounded retries at the DST boundary — transient network/DNS failures (mise toolchain install) must not fail CI
tier: ci-reliability
ask: Aaron 2026-05-30
created: 2026-05-30
last_updated: 2026-05-30
decomposition: leaf
composes_with:
  - tools/setup/
  - .github/workflows/
  - docs/backlog/P3/081KRW63S0008QG0R000EAZ9K2-claude-code-bash-tool-orphans-git-fetch-subprocesses-under-saturation-self-saturation-feedback-loop-2026-05-18.md
tags: [ci, dst, retries, mise, flake, network, dns, toolchain, reliability]
type: bug
---

# 081KSV2WD0008QG0R002A3QJ5Q — Bounded retries at the DST boundary

## The principle (Aaron 2026-05-30)

> *"mise ERROR Failed to install dotnet@10.0.203: dns error: Temporary failure in name
> resolution — there are the boundary where DST does not hold and bounded retries are
> warrented we should fix or backlog the fix"*

Deterministic Simulation Testing (DST) holds **inside** the simulation boundary —
everything is seed-reproducible and deterministic. **Network / DNS / external-fetch is
OUTSIDE that boundary** — the real-world non-deterministic edge where DST does NOT hold.
At that boundary the correct reliability primitive is **bounded retries with backoff**,
not deterministic replay. Determinism-inside; bounded-retry-at-the-edge.

## Empirical anchor

2026-05-30, PR #6134 `lint (semgrep)` (a **required** check) failed at the
"Install toolchain via three-way-parity script (GOVERNANCE §24)" step:

```
mise WARN  HTTP GET https://dot.net/v1/dotnet-install.sh attempt 2 failed (transient) ... retrying
mise WARN  HTTP GET https://dot.net/v1/dotnet-install.sh attempt 3 failed (transient) ... retrying
mise ERROR Failed to install core:dotnet@10.0.203: error sending request for url
  (https://dot.net/v1/dotnet-install.sh): client error (Connect): dns error: failed to
  lookup address information: Temporary failure in name resolution
```

mise retried 3× over ~4s, then gave up → the required `semgrep` check failed → a
**docs-only PR was blocked** by a transient DNS blip. A manual `gh run rerun --failed`
cleared it (confirming transient). The flake-tax: required checks intermittently fail on
transient network/DNS and block unrelated PRs.

## Fix candidates

| # | Fix | Notes |
|---|---|---|
| a | **Bounded-retry-with-exponential-backoff wrapper around the install script's network fetches** (dotnet-install.sh + other external GETs in the three-way-parity script) | The canonical DST-boundary fix; longer/backed-off retries than mise's tight 3×/~4s |
| b | Increase mise's network retry count + backoff | 3×/~4s is too tight to ride out a DNS blip; bump via mise config/env |
| c | GitHub Actions step-level retry on the toolchain-install step | e.g. a shell retry loop (Rule-0-compliant TS/bash-in-setup) or a retry action |
| d | Cache / pre-warm the toolchain (cache dotnet) | takes the fetch off the hot path so it isn't a per-run failure surface |

Prefer **(a) + (d)**: a bounded-retry helper at the network-fetch boundary of the
install script, plus caching to reduce how often the fetch happens at all.

## Acceptance

1. Transient network/DNS failures during toolchain install are absorbed by bounded
   retries (with backoff) and do **not** fail the job.
2. The DST-boundary principle is documented where the install/network code lives
   (DST inside the boundary; bounded-retries at the external-I/O edge).
3. Caching reduces toolchain-fetch frequency on CI.

## Why P2

CI-reliability flake-tax. Re-run clears it, so it is not hard-blocking, but intermittent
**required-check** failures on transient DNS waste cycles and block unrelated PRs
(including docs-only ones). Worth fixing to remove the flake-tax; raise to P1 if it
starts blocking time-sensitive merges frequently.

## Composes with

- The always-active **DST** discipline (`dv2-data-split-discipline-activated` + the
  DST substrate) — this row names its boundary.
- **Exceptions-as-signals / signal-based reliability** (the force-push-with-lease
  assumption-validation substrate) — bounded-retry is the signal-based primitive at the
  network edge.
- **081KRW63S0008QG0R000EAZ9K2** (git-network-ops timeout/retry under saturation) — sibling at the
  git-network boundary; same "external-I/O needs bounded-retry, not determinism" shape.
- `refresh-before-decide` — the refresh that fetches external state is itself a
  boundary-crossing that warrants bounded-retry.
