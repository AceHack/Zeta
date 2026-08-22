---
id: 081KZZ3JHP1087G0R00027ARRR
type: bug
state: done
priority: P2
slug: bunfig-toml-test-timeout-is-silently-ignored-by-bun-1-3-14-s
title: "bunfig.toml test timeout is silently ignored by bun 1.3.14 so every test over 5s flakes"
created: 2026-08-14T03:03:14.369Z
completed: 2026-08-14T10:16:11.620Z
depends_on: []
composes_with: []
---

# bunfig.toml test timeout is silently ignored by bun 1.3.14 so every test over 5s flakes

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZZ3JHP1087G0R00027ARRR-*.md` glob. -->

## The defect

`bunfig.toml` declares:

```toml
[test]
timeout = 20000
```

**bun 1.3.14 ignores it. The real cap is 5000 ms.**

**CHECKED** with a controlled experiment — an isolated directory containing only that `bunfig.toml` and
a single test that sleeps 7 s:

```
✗ sleeps 7s — should pass if timeout=20000 is honoured [5002.06ms]
  ^ this test timed out after 5000ms.
```

Exactly the default cap, ignoring a setting four times larger sitting in the same directory.

## Why this is worse than a slow test

This is the session's recurring defect class moved into the **configuration** layer: **a setting that
reads as authoritative and does nothing.** Anyone reading `bunfig.toml` concludes slow tests are
protected to 20 s. They are protected to 5 s. Nothing reports the discrepancy — the setting is not
rejected, not warned about, just silently discarded.

The consequence is **load-dependent flake**, which is the worst shape: a test passes on an idle machine
and fails on a busy one, so it fails *in CI* and passes when the author investigates.

## Confirmed instances, both found today by accident

1. **`src/Core.TypeScript/hygiene/no-agent-gate-bypass.test.ts`** — measured **9.38 s (1 fail)** under load, **1.50 s
   (0 fail)** idle, on unmodified `origin/main`. It already uses `git ls-files` rather than a
   working-tree walk, so the tracked-set fix does not help it; it is simply a repo-wide scan that
   exceeds 5 s when the machine is busy. It **runs in CI** as of #10473.
2. **The SMT runner work (#10508)** — its author set a 10 s solver budget believing the bunfig value
   applied. The budget sat above bun's real cap, CI reported timeouts, and **those timeouts were hiding
   the `light-time` solver-version finding** until the cause was traced. A configuration lie delayed a
   real result.

Both were found sideways while chasing something else. **Nobody has looked for the rest**, and the
population is every test over ~5 s under load — which after #10473 is 884 test files' worth of surface.

## What to do

1. **Establish the truth.** Confirm against bun's current documentation and issue tracker whether
   `[test] timeout` is supported at all, was removed, or is a bug. The experiment above says what
   happens; it does not say why.
2. **Stop the file from lying.** Either the setting works or it should not sit there implying it does —
   at minimum a comment recording the measured cap and this work-item.
3. **Find the population.** A run that reports per-test durations identifies everything within, say, 2×
   of the cap. Those are the flakes-in-waiting.
4. **Per-test timeouts are the available mechanism** — bun's third argument to `test()` does work.
   Slow-by-nature tests should carry an explicit one rather than relying on a global that is not
   applied.

## Acceptance

- `bunfig.toml` no longer asserts a timeout that is not honoured.
- Every test measured within 2× of the real cap either carries an explicit per-test timeout or is made
  fast.
- A check that fails if a test's declared budget exceeds the effective cap — the honest version of what
  the config was pretending to do.
