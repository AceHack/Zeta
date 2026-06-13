# tools/bg/ — Background services

Background services that mechanize substrate-engineering disciplines.

## Architectural claim (substrate-honest)

The architectural direction from PR #2998 was to make the foreground
loop **OPTIONAL** by moving substrate-engineering work to durable
background services. As of 2026-05-13, what has shipped is the
**first reactive loops** for three failure-mode services:

- detect → publish bus envelope

Subscriber agents that react to those envelopes are **not yet
shipped** (slice 5+). The current delivered surface does **NOT**
make the foreground optional — these services **nudge**. They do
not open PRs, claim backlog rows, perform decomposition, or land
substrate on their own. The "foreground optional" framing is
**aspirational + directionally correct**, not yet operationally
achieved.

Per the adversarial-review pass on 2026-05-13 (PRs #3022, #3024 +
associated PR-thread record): the gap between "nudges via bus"
and "foreground loop is now optional" is large. Documented here
so future readers don't overclaim.

## Current services (as of 2026-05-13)

| Service | File | Slice status | Detection signal | Bus topic |
|---------|------|--------------|------------------|-----------|
| Standing-by detector | `standing-by-detector.ts` | 1+2+3+4 live | commit-history (HEAD) + PR-activity (repo) via `gh`/`git` | `infinite-backlog-nudge` |
| Backlog-ready notifier | `backlog-ready-notifier.ts` | 1+2+3+4+5a+6 live (5.2 pending B-0460) | backlog-row scan (status + deps satisfied) | `work-assignment` |
| Missed-substrate detector | `missed-substrate-detector.ts` | 1+2+3+4+5 live | merged-PR fetch via `gh`; real branch-vs-squash compare via `gh pr view --json headRefOid` + `git log <headRefOid>..origin/<branch>` (slice 3 landed 2026-05-13); auto-recovery via `--auto-recover` / `--recovery-dry-run` flags (slice 5 landed 2026-05-15) | `missed-substrate-cascade` |
| Missed-substrate recovery (helper) | `missed-substrate-recovery.ts` | core function + adapter contract shipped 2026-05-15 (B-0503); wired into detector via `REAL_RECOVERY_ADAPTERS` (B-0504) | n/a (invoked by detector when `--auto-recover` set) | n/a (opens recovery PR directly via `gh pr create`) |

Per-service slice ordering (each service decomposes into 6 slices):

- Slice 1: skeleton + no-op poll loop
- Slice 2: real detection signal #1
- Slice 3: real detection signal #2 (or comparator for B-0442)
- Slice 4: bus-publish wiring
- Slice 5: agent-side subscription / queue-state detection
- Slice 6: cron registration + integration tests

## Composition

All services compose with:

- **B-0400 bus protocol** (`tools/bus/`) — transport via `/tmp/zeta-bus/` JSON files
- **Existing background infrastructure** — `com.zeta.claude-loop` launchd + cron heartbeat

## Adapter pattern

Every service uses **adapter injection** so unit tests are deterministic:

- `now()` — clock
- `lastCommitIso()` / `lastPrActivityIso()` / `scanBacklog()` / `fetchRecentMergedPRs()` — real-side-effect functions
- `publishNudge()` / `publishAssignment()` / `publishCascade()` — bus IO

Tests inject fake adapters; production uses `REAL_ADAPTERS`. The
production code path is exercised via the CLI entry-point only.

## Failure-mode handling (substrate-honest)

- **Bus publish failures** caught + surfaced in structured `lastPublishError` field (per the adversarial-review P1 catch on PR #3017); daemon loop survives transient bus IO errors
- **`gh`-unavailable** surfaced explicitly as `fetchStatus: "gh-error"`; cannot be silently treated as "no PRs found"
- **`git`-unavailable** surfaced as `lastCommitAt: null`; cannot be silently treated as "no commits ever"
- **Daemon mode** (`runDaemon`) never accumulates results — no memory growth in long-running mode

## Running

```bash
# One-shot mode (cron-driven; recommended)
bun tools/bg/standing-by-detector.ts --once
bun tools/bg/backlog-ready-notifier.ts --once
bun tools/bg/missed-substrate-detector.ts --once

# Daemon mode (standalone; runs forever)
bun tools/bg/standing-by-detector.ts --poll-min 5 --idle-min 15

# Dry-run (no bus publish)
bun tools/bg/standing-by-detector.ts --once --no-publish

# Send envelopes to a specific agent (default broadcast "*")
bun tools/bg/backlog-ready-notifier.ts --once --to vera
```

## What's still pending

- **Slice 5 for all three** — subscriber agents that react to bus envelopes (e.g., auto-claim a `work-assignment`)
- **Slice 6 for all three** — launchd / cron registration + integration tests

(B-0442 slice 3 landed 2026-05-13: real `headRefOid` vs current-branch-HEAD compare with rebase-guard via `git merge-base --is-ancestor`. The cascade detector now operationally detects the Otto-section-missed-PR-#2980-by-3-min failure class when the branch still exists on origin.)

When all of those land, the architectural claim "foreground loop is
optional" approaches operational truth. Today the claim is
"first reactive loops closed; nudges land; subscribers don't yet
exist."
