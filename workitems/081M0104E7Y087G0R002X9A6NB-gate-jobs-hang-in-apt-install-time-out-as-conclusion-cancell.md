---
id: 081M0104E7Y087G0R002X9A6NB
type: bug
state: backlog
priority: P1
slug: gate-jobs-hang-in-apt-install-time-out-as-conclusion-cancell
title: "gate jobs hang in apt install, time out as conclusion=cancelled, and block auto-merge with nothing re-running them"
created: 2026-08-14T20:41:35.230Z
depends_on: []
composes_with: []
---

# gate jobs hang in apt install, time out as conclusion=cancelled, and block auto-merge with nothing re-running them

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0104E7Y087G0R002X9A6NB-*.md` glob. -->

**State:** root cause fixed + bounded recovery landed in the same PR. Priority raised
from the P2 default: this blocked the merge queue seven times in one day.

## Symptom

`gate (required)` — the only required check in the `CI Gate` ruleset (id `16134995`) —
concludes `failure`, so an auto-merge-armed PR never merges. Observed on #10674, #10637,
#10686, #10678, #10668, #10608, #10690. Each was cleared by hand with
`gh run rerun <id> --failed`.

`gh pr checks` renders a cancelled job as `fail`, so a job that **never executed** is
presented identically to one that executed and failed. An agent chased a red
`lint (§33 migration xrefs)` before opening the step list and finding
`Install toolchain: cancelled` / `Run audit: skipped`.

## Root cause (measured, not hypothesised)

Of 37 cancelled `gate` runs in a 2h18m window, 27 were **superseded** (a newer run on the
same branch — concurrency `cancel-in-progress` working as designed) and 10 were
**orphans** with no replacement. All 10 orphans were jobs killed by `timeout-minutes`:

| job | timeout | budget | observed | delta |
|---|---|---|---|---|
| lint (Rust) | 15 | 900s | 916s | +16s |
| lint (markdownlint) | 12 | 720s | 737s | +17s |
| lint (semgrep drift) | 20 | 1200s | 1215s | +15s |

10 of 10 matched their own declared timeout to within +15..+17s (the runner's graceful
shutdown window). 12 of the 14 hung jobs stalled in **`Install toolchain`**, inside
`apt-get install`: `azure.archive.ubuntu.com` decayed from 8083 kB/s to ~1.5 kB/s and
stopped mid-`pandoc` (26.9 MB) without closing the socket.

`Acquire::http::Timeout` does not catch this — it is an **inactivity** timer and a slow
trickle keeps resetting it. The existing 5-attempt retry wrapper in `gate.yml` does not
catch it either: it guards **failure**, and a hung `apt-get` never returns to be retried.

## Fix

1. **Root cause** — `tools/setup/linux.sh` bounds `apt-get install` with wall-clock
   `timeout` + 3 attempts. A stall becomes an ordinary non-zero exit, which the retry
   loops could always handle. Lands in linux.sh so all three parity legs get it
   (GOVERNANCE §24).
2. **Residual** — `.github/workflows/rerun-cancelled-gate.yml` re-runs a cancelled run
   once. Four guards: cancelled-only (never `failure`), `run_attempt == 1`,
   not-superseded, not-stale.

## Follow-ups (not in this PR)

- The 5-attempt retry wrapper is inline-duplicated across ~15 jobs in `gate.yml` and
  absent from the other ~49 `install.sh` call sites; none has a hang guard of its own.
  A composite action would fix both. `gate.yml` already flags the duplication.
- `push`-event runs on `main` share one concurrency group (`gate-refs/heads/main`) with
  `cancel-in-progress: false`. GitHub keeps at most ONE pending run per group, so rapid
  successive commits to `main` cancel each other's *pending* runs — 20 of the 37
  cancellations. The header comment says "main pushes queue so every main commit gets a
  record", and that intent is **not** what the current key delivers. Needs a maintainer
  decision: per-SHA group (a record per commit, more minutes) or accept and correct the
  comment.

