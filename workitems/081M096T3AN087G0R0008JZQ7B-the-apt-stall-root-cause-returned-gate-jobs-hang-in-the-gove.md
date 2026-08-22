---
id: 081M096T3AN087G0R0008JZQ7B
type: bug
state: backlog
priority: P2
slug: the-apt-stall-root-cause-returned-gate-jobs-hang-in-the-gove
title: "the apt-stall root cause returned: gate jobs hang in the GOVERNANCE §24 toolchain install and rerun-cancelled-gate cannot converge on a deterministic hang"
created: 2026-08-18T01:12:11.861Z
depends_on: []
composes_with: []
---

# the apt-stall root cause returned: gate jobs hang in the GOVERNANCE §24 toolchain install and rerun-cancelled-gate cannot converge on a deterministic hang

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M096T3AN087G0R0008JZQ7B-*.md` glob. -->

## The finding, entailment-checked rather than inferred

Measured 2026-08-18 ~01:10Z against `origin/main` at `ba0ce62c4a`.

**9 of 9** cancelled jobs sampled across six recent `gate` runs died in the *same*
step, and the log names it:

```
##[error]The operation was canceled
  step: Install toolchain via three-way-parity script (GOVERNANCE §24)
```

That is the **same step** `rerun-cancelled-gate.yml`'s header documents as the
original root cause — *"a stalled apt mirror inside the toolchain install step,
fixed at the root in `tools/setup/linux.sh` in the same commit"* (12 of 14 hung
jobs, measured 2026-08-14). This is a regression of that fix, not a new failure.

## The chain

1. A job hangs inside the §24 toolchain install.
2. It runs to its `timeout-minutes` ceiling and GitHub reports the kill as
   **`cancelled`**, not `failure` — the inversion the header already names.
3. `gate (required)` aggregates that as red.
4. `rerun-cancelled-gate.yml` fires and retries — but the hang is **deterministic**,
   so the retry reproduces it. **The second line cannot converge on this.**

Observed on PR #11735: its only gate run was cancelled at 00:29:20, re-enqueued,
and cancelled again at 01:03:13. ~40 minutes of runner time, no progress.

Job durations from that run, matching the ceilings in `gate.yml`:

| job | duration | `timeout-minutes` |
|---|---|---|
| `lint (C#)` | 15m16s | 15 |
| `lint (Python)` | 15m15s | 15 |
| `cross-verify (trust-core oracles + ace suite)` | 12m15s | 12 |

## Why this is the tripwire, not noise

`rerun-cancelled-gate.yml` calls itself **"THE SECOND LINE, NOT THE FIX"** and says
in as many words: *"If the rerun rate rises, the root cause has returned and must be
fixed there — the log line below exists to make that visible rather than quietly
absorbed."* It has returned; this row is the row that stops it being absorbed.

The recovery workflow **working** is precisely what hid it: every affected PR
eventually goes green, so each instance reads as covered infra noise. Same shape as
`081M092W2E7087G0R000KDKHWS` — a mechanism that makes a problem *invisible* rather
than *absent*.

## Two corrections recorded, because the wrong versions were stated first

1. **A rate claim of "75%" and then "57% cancelled vs a 37% pre-fix baseline" was
   computed off a bad denominator** (cancellations counted against windows that
   included still-running runs). Do not cite those numbers. The job-level evidence
   above is the finding; the rate is not established.
2. **"A different place than the original apt-stall" was wrong** — it is the *same*
   step. That claim was made from job durations before the logs were read.

## Not attempted here, and why

The fix belongs at the root, in `tools/setup/linux.sh` — a script consumed three
ways (dev laptops, CI runners, devcontainer images) per GOVERNANCE §24. Raising
`timeout-minutes` would convert a hang into a slower hang and is the wrong lever.
Neither change was made autonomously: unprompted edits to the shared install script
or to the required `gate` ceilings are not the blast radius for an unattended loop.

## UPDATE 2026-08-18 ~02:45Z — the log arrived, and the mechanism is now exact

A job on PR #11746 **failed** rather than hanging, so its log survived. It names the
cause in the script's own words:

```
⚠ apt-get install exceeded 600s (attempt 1/3) —
  stalled archive mirror, not a package error.
E: dpkg was interrupted, you must manually run 'sudo dpkg --configure -a' to correct the problem.
⚠ apt-get install failed rc=100 (attempt 2/3)
E: dpkg was interrupted, you must manually run 'sudo dpkg --configure -a' to correct the problem.
⚠ apt-get install failed rc=100 (attempt 3/3)
✗ apt-get install did not succeed after 3 attempts (rc=100)
```

### Three things this pins down that the original entry could only infer

1. **The stalled archive mirror is confirmed, by the script itself.** `tools/setup/linux.sh`
   recognises rc=124 and prints exactly that. This is the same condition
   `rerun-cancelled-gate.yml` documents as fixed on 2026-08-14 — a genuine regression,
   not a new failure wearing its clothes.

2. **The retry loop is defeated by its own termination, so attempts 2 and 3 are
   decorative.** `timeout --signal=TERM --kill-after=30s` kills `apt-get` *mid-`dpkg`*,
   leaving the package database interrupted. Attempts 2 and 3 then fail **instantly**
   with `rc=100` against that broken state — they never reach the mirror at all. The
   loop's author reasoned carefully (see the comment block at `tools/setup/linux.sh:155`)
   that `timeout` converts a stall into an ordinary non-zero exit the retry can act on.
   That is right about the *exit*, and misses what the kill does to *dpkg*. **One stall
   costs all three attempts.**

3. **It explains the two presentations that made this hard to see.** A job that survives
   the 600s timeout and dies later at its `timeout-minutes` ceiling reports **cancelled**;
   a job that burns all three attempts inside the ceiling reports **failure**. Same root
   cause, two verdicts — which is why per-PR "cancelled-only, covered" classifications
   kept holding while something real sat underneath them.

### Proposed patch (NOT applied — this is the §24 three-way-parity script)

Recover the dpkg state between attempts, which is precisely what apt's own error
message instructs:

```sh
      if [ "$apt_install_rc" -eq 124 ]; then
        echo "⚠ apt-get install exceeded ${apt_timeout}s (attempt ${apt_attempt}/3) —" >&2
        echo "  stalled archive mirror, not a package error." >&2
        # A TERM/KILL mid-dpkg leaves the database interrupted, so the NEXT
        # attempt fails instantly with rc=100 and never reaches the mirror.
        # Without this the 3-attempt loop is a 1-attempt loop.
        $SUDO dpkg --configure -a || true
      else
```

Note the change is **additive recovery on a path that is currently deterministic
failure** — attempts 2 and 3 cannot get worse than guaranteed rc=100. Whether the
right lever is also a longer `ZETA_APT_TIMEOUT_SECONDS`, a mirror change, or caching
the toolchain is a separate call and is deliberately not proposed here.

Still not applied autonomously: `tools/setup/linux.sh` is consumed three ways per
GOVERNANCE §24 (dev laptops, CI runners, devcontainer images), and an unattended loop
is not the right actor for a change every host executes.
