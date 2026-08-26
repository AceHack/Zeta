---
id: 081M0YX5AJ2087G0R003MXF9NW
type: bug
state: backlog
priority: P2
slug: the-hermetic-typescript-tier-is-not-hermetic-github-adapter
title: "the hermetic TypeScript tier is not hermetic: github-adapter.test.ts spawns gh and hits the network"
created: 2026-08-26T11:26:51.458Z
depends_on: []
composes_with: []
---

# the hermetic TypeScript tier is not hermetic: github-adapter.test.ts spawns gh and hits the network

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0YX5AJ2087G0R003MXF9NW-*.md` glob. -->

## Measured on origin/main

`test (TS hermetic)` entered the `gate (required)` floor on 2026-08-25. The floor
amendment's stated justification, in `gate.yml`'s own words, is that the suite
**"is dependency-closed and reproducible"**. At least one test in it is neither.

`src/Core.TypeScript/forge-host/github/github-adapter.test.ts`:

    test("resolveThreadsBatch maintains arithmetic invariant", async () => {
      const adapter = new GitHubAdapter("org", "repo");
      // This will fail (no gh available in test) but the batch logic is testable
      // by mocking -- for now verify the structure
      ...
      const result = await adapter.resolveThreadsBatch(threads);

and `src/Core.TypeScript/forge-host/github/github-adapter.ts:1` imports
`spawnSync` from `node:child_process`, using it as
`spawnSync("gh", ["api", ...], { timeout: 30000 })` throughout.

**The comment's premise is false in CI.** `gh` IS preinstalled on GitHub-hosted
runners. So the call does not fail fast on ENOENT -- it launches `gh`, which
makes a live HTTPS request to `api.github.com` for the repository `org/repo`.

## The observed failure

Run 32962272863, job `test (TS hermetic)`, on a **markdown-only** pull request
(#15595 changed one `docs/research/*.md` file and nothing else):

    killed 1 dangling process
    (fail) GitHubAdapter > resolveThreadsBatch maintains arithmetic invariant [7129.69ms]
      ^ this test timed out after 5000ms.

1 failed out of 18,337. The job is in the required floor, so `gate (required)`
went red with it and the PR was blocked.

Note the two independent tells that this is a network call and not an ENOENT:
the **7.1 s** duration (an absent binary fails in milliseconds), and the
**dangling process** the runner had to kill.

## Why it matters beyond one flaky test

The tier is *named* hermetic and was *promoted to blocking* on that basis. A
network-dependent test inside it means the floor's newest member can go red for
reasons that have nothing to do with the tree being tested -- the same class as
the wall-clock ratio assertion in `build-and-test`
(`ColumnLinearOps.Tests.fs`, measured 12.7% failure rate on that leg). Two of the
floor's members are non-deterministic; neither was intended to be.

## Not a vacuity complaint -- the test was already fixed once

The test carries its own note that it *used* to assert only inside `if (result.ok)`
and therefore "ran ZERO assertions and passed by not checking anything". That fix
was correct. It just did not address the fact that reaching the assertion at all
requires a network round-trip.

## Suggested direction (not a decision)

Inject the process runner so the adapter can be exercised without `gh` -- the
assertion being made ("the failure path is a classified ForgeError, never a
thrown exception, never `not-supported`") does not need a real GitHub. Failing
that, move the test out of the hermetic tier so the tier's name and the floor's
justification stay true.

## Provenance

Found by the shadow tick 2026-08-26 while landing the containerized-job-runtime
work, on a PR that could not have caused it. Reported, not fixed: this is not my
file and the fix is a mocking change with its own design choices.
