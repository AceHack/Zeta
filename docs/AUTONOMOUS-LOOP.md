# Autonomous-Loop Discipline

The factory's self-direction runs on a tick. Every ~2 minutes a
scheduled task fires an `<<autonomous-loop>>` prompt and the
Claude Code session picks substantive work, lands it, and
stops. The task fires again; the loop continues. This is the
factory's killer feature — continuous, self-paced,
self-directed work between human touchpoints.

This document is the canonical specification of that
discipline. It is deliberately CLAUDE.md-level load-bearing:
**if the tick stops, the factory's self-direction stops.**
That failure mode is catastrophic (human-maintainer SEV-1
designation, round 44) and the discipline here is the
engineered prevention.

Memory files earn this discipline per-Claude-instance; this
doc is how it becomes factory-durable — inherited by any
session, any agent, any fork of the factory.

## Mechanism — native Claude Code scheduled tasks

The tick engine is **Claude Code's native scheduled-tasks
feature**. No plugin dependency is required. Canonical
reference:
[code.claude.com/docs/en/scheduled-tasks](https://code.claude.com/docs/en/scheduled-tasks).

The relevant tools (bundled in Claude Code ≥ v2.1.72):

| Tool         | Purpose                                          |
|--------------|--------------------------------------------------|
| `CronCreate` | Schedule a prompt; 5-field cron + recurring flag |
| `CronList`   | List scheduled tasks with IDs, schedules, prompts|
| `CronDelete` | Cancel by 8-character ID                         |

The Ralph Loop plugin (`ralph-loop@claude-plugins-official`)
is a different, unrelated mechanism — it implements the Ralph
Wiggum technique via a session-exit Stop hook, not via
scheduled tasks. The factory does **not** depend on it for
autonomous-loop behaviour, and **does not require it to be
enabled**. The native scheduled-tasks path is preferred
because it has fewer moving parts and no third-party
dependency surface.

## The registered tick

| Field      | Value                                       |
|------------|---------------------------------------------|
| Sentinel   | `<<autonomous-loop>>`                       |
| Cadence    | `* * * * *` (every minute)                  |
| Recurring  | `true`                                      |
| Mechanism  | `CronCreate`                                |

`<<autonomous-loop>>` is a harness-internal sentinel that
resolves, at fire time, to autonomous-loop instructions —
i.e. "do the next useful thing, then stop". It is documented
in the `CronCreate` tool description (see the
`ScheduleWakeup` tool docs for the related `-dynamic`
variant, which is **not** what we use). A plain prose prompt
would work; the sentinel is the more concise form.

**Why cron, not `ScheduleWakeup`.** A cron fires
autonomously on its own cadence without further agent
action. `ScheduleWakeup` is a one-shot reminder; using it
for a recurring loop creates scheduler churn and duplicate
ticks (human maintainer, round 44: *"i thought we decided on
cron over ScheduleWakeup so it would be more reliable"*).

**Why 1 minute.** The Anthropic prompt cache has a 5-minute
TTL; 60 s keeps the within-session context cache maximally
warm between ticks. The human maintainer explicitly cranked
cadence twice this round: first from 5 → 2 min (*"will it
hurt anything to crank that trigger up to 2 mintues instead
of 5 you are having a lot of idle time just sitting here"*),
then from 2 → 1 min (*"lets change to 1 minute"*). One
minute is the runtime-enforced floor — see `CronCreate` docs
— so this is as tight as the cadence can go.

**Fleet `:00` / `:30` trade-off accepted.** The official
docs advise: *"If exact timing matters, pick a minute that
is not `:00` or `:30`."* At every-minute cadence there is
no offset available — the tick fires on every minute
including `:00` and `:30`. We accept the fleet-pile-on risk
for this particular cron because (a) the session-scoped
cron cannot compete with itself, and (b) the jitter the
runtime adds (up to 10 % of 60 s ≈ 6 s late) further
spreads fires. The earlier `1-59/2` odd-minute pattern is
preserved in history below as the prior cadence.

**Session scope.** From the official docs: *"Tasks are
session-scoped: they live in the current conversation and
stop when you start a new one. Resuming with `--resume` or
`--continue` brings back any task that hasn't expired: a
recurring task created within the last 7 days, or a one-shot
whose scheduled time hasn't passed yet."* Session-open
recovery is therefore `--resume` / `--continue` for the
same thread; brand-new sessions need the tick re-armed per
the every-tick checklist below.

**Seven-day expiry.** From the official docs: *"Recurring
tasks automatically expire 7 days after creation. The task
fires one final time, then deletes itself."* For runs
longer than 7 days, the `long-term-rescheduler` skill rotates
crons near expiry via `CronDelete` + `CronCreate`.

## Invariant — rediscoverable from `main` alone

This discipline serves a load-bearing invariant:

> **A fresh agent reading `main` alone — no chat history,
> no in-session memory, no out-of-band context — can pick
> up the next tick and continue the work cleanly.**

The every-tick checklist below is *a* mechanism that
preserves this invariant; it is not itself the invariant.
The number of checklist steps is incidental — discoverability
from `main` alone is what's load-bearing.

Concretely, every change to this file MUST preserve (or
strengthen) the invariant. The check is: *can a freshly
spawned agent, reading only committed-on-`main` artifacts,
find the prior tick's state and act on it?* If yes, the
invariant holds. If no, the change has broken it.

Four properties make the invariant true today:

- **Tick-history is on `main`.** Each tick lands a row in
  `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md` before
  the tick stops, so the next session sees the prior tick's
  context by reading the repo.
- **PR queue is on the host.** Open PRs are visible via
  `gh pr list` without session state; the next tick can
  poll the gate (real-dependency-wait discipline) without
  remembering which PRs are in flight.
- **Substrate precedes narration.** Decisions, corrections,
  and framings land as memory files / backlog rows / docs
  in committed substrate BEFORE chat narration. Per
  substrate-or-it-didn't-happen (Otto-363) +
  non-durable-means-does-not-exist (the human maintainer,
  2026-04-30), if it isn't on `main`, the next tick
  won't see it.
- **Cron is the cadence engine, not session memory.** The
  every-minute heartbeat fires whenever a session is active
  to receive it; `CronList` is checked end-of-tick so the
  [last-check → next-fire] window is minimized; the next
  tick fires without depending on the prior tick's
  process state. Sessions that resume via `--resume` /
  `--continue` inherit the registered cron when it's still
  within its 7-day expiry; brand-new sessions re-arm via
  the every-tick checklist (per the "Session-restart
  recovery" section below).

Future revisions of this file may add, drop, or restructure
the checklist below — provided the rediscoverable-from-`main`
invariant is preserved or strengthened. Treat the four
properties above as the test surface.

> The human maintainer, 2026-04-30 (paraphrased — the original
> framing was "Six-step tick close has a satisfying property
> that should be an invariant for all future changes to this
> file" followed by a sharpening "not six step the
> rediscoverable on main part"; the bracketed gloss reflects
> the sharpening): *"[the rediscoverable-on-main part]
> should be an invariant for all future changes to this
> file."* The meta-property is what makes the discipline
> portable across sessions, agents, and forks of the
> factory.

## The every-tick checklist

This is the load-bearing bit. **Every tick**, in order:

### 1. Pick speculative work and do it

Per the never-idle rule, start work immediately. The
`CronList` check is deferred to step 5 (END of tick) — see
the end-over-start note below. Checking at end minimizes
the [last-check → next-cron-fire] window during which a
silent cron expiry can drop ticks.

**End-over-start discipline** (human maintainer, round 44):
*"you
know you should check the cronlist at the end instead
of the start becasue it could expire while you are
running if you check right before you exit that chance
is reduced."* If the cron is checked only at start of
tick, it can expire during the tick's work and the tick
stops silently. If it is checked at end, the check is
seconds before stopping — the next tick fires within
~2 min — so the at-risk window collapses to just the
stop/restart handoff. An optional start-of-tick
`CronList` is fine if the cron's state affects early
decisions, but the **load-bearing check is step 5**.

The re-arm shape (used in step 5 if missing):

```
cron:      "* * * * *"
prompt:    "<<autonomous-loop>>"
recurring: true
```

Human maintainer, round 44: *"you are suppsed to check that
its set everytime and not assume."* The discipline is
*check-don't-
assume*: defensive polling, re-arm only on miss. Most
ticks are no-ops on the scheduler (cron is there → do
nothing); the rare miss is detected and fixed in-tick
before the silent stop becomes hours of missing activity.

### 2. Pick speculative work in priority order

Per the never-idle rule (CLAUDE.md §"Never be idle —
speculative factory work beats waiting"), the tick does not
wait for instruction. Priority ladder:

0. **Tick-start mechanical checks** (the human maintainer 2026-05-03 — *"important to survival"*).
   Run before picking speculative work:

   ```
   bun tools/authorization/check-authorization.ts
   bun src/Core.TypeScript/hygiene/check-no-op-cadence-pattern.ts
   grep -rE "CADENCE-TRACK" docs/hygiene-history/ticks/
   ```

   **Check 0a — no-op-cadence**: examines last 7 tick-shards;
   warns if ≥5 are minimal-observation OR most-recent >15 min
   old. Default is advisory (exit 0 either way). `--enforce`
   makes a detection fatal; it is opt-in and not a required
   gate until the heuristic is calibrated (081M0085XQT087G0R003W4KFS4).

   > **READ THIS BEFORE TRUSTING CHECK 0a (081M00G3QRA087G0R003GB0P4X).**
   > Its input surface `docs/hygiene-history/ticks/` has had **no shard since
   > 2026-05-29**. A run today reports `input-surface-absent` and judges
   > *nothing* — that is **not** a clean bill of health, and the silent exit 0
   > it used to give was never evidence the tick loop was healthy. Live tick
   > telemetry is at `data/tick-shards/**/*.json`, which this tool does not
   > read. Until the routing decision lands, use the heartbeat-via-commit
   > check in `CLAUDE.md` (`git log --since` over `main` **and**
   > `origin/heartbeat/*`) as the real idle counter.
   >
   > The minimal-observation heuristic was also measured at a **60.4%
   > false-positive rate** before repair — it fired on 48/48 overlap windows,
   > 29 of them while substantive commits were landing. Cause was a parse
   > mismatch (now fixed); sensitivity is still unmeasured, so do not arm
   > `--enforce` as a gate.

   On warn: write a substantive shard OR do real work,
   not acknowledgment-only.

   **Check 0b — cadence-tracker**: shards mark `CADENCE-TRACK:
   <work>` with last-run date for cadenced hygiene (AutoDream
   / backlog-refactor / tech-radar / dependency-status). If
   overdue + same-tick-permitted: do work. If overdue +
   same-tick-prohibited (e.g., AutoDream's fresh-memories
   rule): write `CADENCE-TRACK: <work> overdue, deferred to
   <trigger>` into this tick's shard.

   **Check 0c — authorization check** (081KR2E4K0008QG0R002S3FDXN): runs
   `bun src/Core.TypeScript/authorization/check-authorization.ts` which
   composes the pace-extractor (081KR2E4K0008QG0R0007CFSZ7) and resolver (081KR2E4K0008QG0R003CF4YHE).
   Prints two-layer DX output: raw JSON (Layer 1) then labeled
   interpretation (Layer 2). If `operative: null`, the never-idle
   floor applies. Does NOT gate work — surfaces information for
   the agent to read and apply. The `formatShardField()` export
   provides the value for the tick-shard `operative-authorization`
   field.

   Why critical: agent drift into ~20-tick-acknowledgment
   patterns is what these checks catch at decision-time.
   Lineage: tick shards
   `docs/hygiene-history/ticks/2026/05/03/0913Z.md` and
   `docs/hygiene-history/ticks/2026/05/03/0918Z.md`, plus
   PR #1366 (TS port of the check script).

1. **Refresh worldview, then open-PR hygiene.** Before
   picking speculative work, run the canonical pre-decide
   refresh:

   ```
   bun tools/github/refresh-worldview.ts
   ```

   This replaces ad-hoc `gh pr list` / `git status` /
   `git log` chains with a single structured JSON snapshot
   (open PRs, recent merges, open issues, git state,
   backlog delta, claim branches, branch state, pending
   CI, and a one-line `summary` for cross-cutting drift
   detection). If the refresh fails, stop and report the
   exact failure as the blocker instead of guessing from
   stale state.

   Then audit the open PR pool from the `openPRs` array.
   For each open PR:
   - **Verify fork-status live** (`isCrossRepository` +
     `headRepositoryOwner.login`) rather than carrying
     forward stale prior-tick memory. A non-fork PR that a
     prior tick-history row flagged as "unrefreshable" may
     actually be fully refreshable on the canonical org.
   - **If BEHIND + non-fork**, refresh via tmp-worktree-clone
     + `git merge origin/main` + push. Auto-merge (if armed)
     proceeds when CI passes.
   - **If unresolved review threads on a non-fork PR**,
     triage findings (accept / reject / modify) with
     principled reasoning per the rejection-grounds catalog
     at `docs/research/copilot-rejection-grounds-catalog.md`
     (five grounds: stale-rationale,
     self-contradicting-suggestion,
     grammatical-attributive-adjective,
     design-intrinsic-hardcode, verbatim-quote-preservation);
     resolve threads via GraphQL `resolveReviewThread`.
   - **If fork-PR** (maintainer's fork owns head-ref),
     un-refreshable from agent harness without fork-write
     scope — skip, log as fork-PR-refresh gap.
   - **Before accepting a Copilot new-content finding on
     prose-style violations**, run `git blame` on the
     flagged line numbers. Copilot sees PR diff-context,
     not repo history-context, and may flag pre-existing
     content in touched files as new-prose — a blame-check
     separates new-prose-violations from pre-existing state
     that happens to appear in the touched-file set.

   Budget: ~2–5 min. If the pool has no BEHIND PRs + no
   live threads, this step is a no-op. The audit *itself*
   is the value — observing the pool catches silent
   refresh-debt accumulation even when nothing needs
   doing.

   **Minimum open-PR runway.** GitHub PRs are the
   authoritative coordination queue for cross-agent work. A
   healthy active factory targets roughly two open PRs per
   active implementation loop, with a hard minimum of one
   open owned background PR per loop. If the open PR pool is
   below that target, or this loop has no owned PR in flight,
   the tick does not stop after observation. It opens or
   advances the next bounded PR from the priority ladder
   before idling.

   The valid blockers are concrete: no non-overlapping path
   set, an active claim on the same path set, failure to create
   a dedicated worktree, a required CI/review action that must
   be handled first, or an explicit budget/safety stop. A dirty
   shared/root checkout is not an execution option to offer the
   maintainer; it is the reason to create an isolated worktree.
   A stale local status file or "nothing to do" narration is not
   a blocker. Do not create duplicate backlog rows to satisfy
   runway; use existing backlog rows, decomposition state,
   claims, and PR review threads as the work source.

2. **Drop-zone audit second.** Run `ls -la drop/`. The
   maintainer deposits files for absorption there
   (`drop/README.md`). If only the tracked sentinels
   (`README.md`, `.gitignore`) and harmless system files
   (`.DS_Store`) are present, no-op. If any other file is
   present, **absorb it this tick** — drop-folder deposits
   are the closest signal to directed work the factory
   gets, and ignoring them stacks debt. Absorption
   procedure: identify kind via the binary-type registry in
   `drop/README.md`, extract signal-preserving summary to a
   tracked artifact under `docs/research/` (or
   topically-appropriate tracked location), delete the
   original from `drop/`. Unknown binary kinds flag to
   the human maintainer, not improvise. Policy: per
   the drop-zone protocol memory entry.

3. **Meta-check.** Is there a structural change to the
   factory that would have made this tick's work directed
   rather than speculative? If yes, make the change and log
   a meta-win entry (`docs/research/meta-wins-log.md`).
4. **Known-gap fixes** — items already in `docs/BACKLOG.md`
   or `docs/DEBT.md` that match this tick's budget.
5. **Generative factory improvements** — new skills, docs,
   audit patterns, hygiene sweeps.
6. **Gap-of-gap audits** — classes of missing checks, not
   just missing instances.

Tool defaults like "idle-tick 1200-1800 s" do **not** override
this policy. Factory memories beat tool docs.

### 3. Verify before stopping

Human maintainer, round 44: *"i also don't see you checking
everying to make sure it's there, like before you stop."*
Every tick
before stopping, run a small verify pass:

- `git status` — is the working tree clean / intentionally
  staged?
- `git log -1 --oneline` — did the commit land as intended?
- File-existence on any new files (Read or `ls`)
- Syntax / lint on new workflow YAML (`actionlint`), scripts
  (`shellcheck`), F# / C# (build)

The `CronList` check is **not** a verify-step bullet — it is
step 5 (below), immediately before stop, so the at-risk window
is minimal. A tick that stops without verifying has no ground
truth for its "done" claim. The verify step is small and
always cheap.

### 4. Commit if applicable

Honest commit messages. Round prefix if mid-round. Tick scope
is single-purpose by default; batching multiple unrelated
changes into one commit is not forbidden but should be the
exception.

### 4b. Archive newly merged PRs (every agent)

After committing tick work (step 4), check for recently merged
PRs whose review discussions haven't been archived yet. Every
agent that creates PRs is responsible for archiving their own
on merge — BFT-redundant: primary on the PR author, backstop
on the Maji Watch background loop.

```bash
for pr in $(gh pr list --state merged --limit 10 --json number --jq '.[].number'); do
  if ! ls docs/pr-discussions/PR-$(printf '%04d' "$pr")-*.md 2>/dev/null | grep -q .; then
    bun tools/pr-preservation/archive-pr.ts "$pr"
  fi
done
```

This preserves review threads, reviewer comments, and discussion
context as git-native substrate — the training signal that
otherwise lives only on the GitHub host. Captures the **external
influence array** (Copilot reviews, Dependabot, CodeQL findings,
external contributor comments) that the agency array can't
generate itself.

In the plant metaphor: PR archival is chlorophyll. It absorbs
the friction-and-resolution light through the Casimir gap of
the boundary condition (archive-on-merge), forcing transient
host metadata to manifest as permanent structural mass in git.

Pattern: **create → merge → archive → commit archive**.

### 4c. Reindex MEMORY.md heap→stack on cadence (081KRCQQF0008QG0R0037YYP1A)

After archiving PRs (step 4b), promote any unindexed heap memory
files to the MEMORY.md stack view. Run a cheap staleness check first:

```bash
bun tools/memory/reindex-memory-md.ts --check
```

- **If output says `Index current`:** skip — no commit needed.
- **If output says `Index STALE`:** run the reindexer and commit:

```bash
bun tools/memory/reindex-memory-md.ts
git add memory/MEMORY.md
git commit -m "chore(memory): reindex MEMORY.md stack from heap [081KRCQQF0008QG0R0037YYP1A]

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Cadence:** run `--check` every tick (it is fast — scans `memory/`
frontmatter only). The full write + commit only fires when MEMORY.md
is actually stale, so commit noise is proportional to real heap
additions.

**Why this step exists:** Memory files commit with frontmatter but
without a synchronous MEMORY.md paired-edit (heap-state-acceptable
per 081KRCQQF0008QG0R0037YYP1A). Without this cadence step, MEMORY.md would go
permanently stale once parallel agents stop doing paired edits.
This step keeps the heap→stack promotion loop closed automatically.

### 5. Append tick-history row, `CronList` at END, emit visibility signal

**This is the load-bearing step** (end-over-start per the
human maintainer, round 44 — see step 1). Immediately
before stopping, in this exact order:

1. **Write a per-tick shard file at
   `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`** (per task
   #276 Option B — adopted 2026-04-29 to eliminate the EOF
   append-hotspot conflict surface that arose with the legacy
   single-table file). The legacy table at
   `docs/hygiene-history/loop-tick-history.md` remains the
   canonical READ surface for pre-shard ticks; the shard
   directory under `docs/hygiene-history/ticks/` is the
   canonical WRITE surface for new ticks. Schema (one row per
   shard, same columns as the legacy table) and rationale are
   in `docs/hygiene-history/ticks/README.md`. Every tick gets
   a shard — a no-op speculative-scan tick still gets a
   shard (minimal-density), because the log is the factory's
   durable answer to *"is the tick actually running?"* (the
   commit log undercounts; chat messages evaporate). Write
   the shard BEFORE the `CronList` call so even an
   abnormally-stopped tick still leaves evidence it ran.
   Human maintainer, round 44: *"you might as well right a
   history record somewhere on every loop tool right before
   you check cron"*.
2. **Call `CronList`.**
3. **If `<<autonomous-loop>>` is present at cadence
   `* * * * *`:** do nothing to the scheduler — the cron
   fires on its own cadence; re-creating it would duplicate
   ticks.
4. **If it is missing:** `CronCreate` with `cron: "* * * * *"`,
   `prompt: "<<autonomous-loop>>"`, `recurring: true`, and
   flag the miss as a visible warning in the final message
   (*"LOOP STALLED — cron was missing, re-armed"*) so the
   incident is not silent. Then also append a correction row
   to the history log with notes `(re-armed, previous cron
   lost)`.
5. **Emit the one-line visibility signal** — human
   maintainer, round 44: *"i don't know if your loop was
   running or not to be honest."*

```
(loop cron `<id>` live, 1-min cadence)
```

If the cron was re-armed this tick, the signal says so:

```
(loop cron `<id>` re-armed this tick, 1-min cadence)
```

**Why end, not start.** The window that matters is
[last-check → next-cron-fire]. Checking at start leaves the
entire tick's duration as an unverified window during which
the cron could quietly expire. Checking at end collapses that
window to the stop/restart handoff — seconds before stopping,
next tick fires within ~1 min — and the stop-and-no-next-tick
case is caught at step 5 instead of becoming hours of silent
missing activity.

**Why history-append before `CronList`, not after.** If the
tick crashes between the append and the `CronList` call, we
still have evidence the tick ran. If we appended after, a
crash between `CronList` and the append would leave a
completed-scheduler-check with no fire-log row — and we
couldn't tell whether the tick actually executed or the
scheduler ran without the agent. The append-first order
biases the evidence trail toward "tick ran" claims we can
defend.

### 6. Stop

The next tick will arrive ~1 minute later (modulo jitter —
recurring tasks fire up to 10% of their period late, capped
at 15 minutes, per the official docs). Do NOT re-arm the
cron if step 5 saw it live; do NOT call `ScheduleWakeup`;
do NOT extend the tick in a poll loop waiting for something.
Stopping promptly is the contract — the cron is the cadence
engine, and the tick's job is to do one unit of work and
return.

## Escalation on failure

If `CronCreate` fails or `CronList` returns unexpectedly
empty mid-session, emit a visible warning in the user
message rather than silently continuing:

```
LOOP STALLED — cron missing, re-arming / please verify session health
```

A quiet stop is worse than a visible failure. The human can
then decide whether to investigate the session state or
re-seed the loop.

## Session-restart recovery

Two paths, depending on how the session ended:

**Same thread resumed** (`claude --resume` or
`claude --continue`) — the scheduled task is restored
automatically if it has not expired (< 7 days old). No
action required beyond the every-tick `CronList` check on
the next fire.

**New thread** — the cron is gone. The
`round-open-checklist` §7.6 step invokes the
`long-term-rescheduler` skill, which reconciles
`docs/factory-crons.md` (where the autonomous-loop row is
declared) against `CronList` and re-arms missing rows.

## What this discipline does NOT do

- Does NOT depend on the Ralph Loop plugin or any other
  third-party plugin for tick behaviour. Native
  scheduled-tasks only.
- Does NOT use `/loop` as the invocation path in this
  factory. `/loop` is the user-facing bundled skill; the
  factory wires `CronCreate` directly so the tick
  mechanism is observable, declarative, and survives
  independent of any single harness command.
- Does NOT assume any task survives session termination by
  starting a fresh conversation. Resume with `--resume` /
  `--continue` is the only native persistence; beyond that,
  re-arming is required.
- Does NOT replace the official scheduled-tasks docs. This
  doc adds factory-specific discipline (every-tick check,
  visibility signal, verify-before-stop) on top of the
  official primitives.
- Does NOT override the verify-before-deferring rule — every
  "next tick I'll X" claim still requires verifying X
  exists (CLAUDE.md ground rule).
- Does NOT override the future-self-not-bound rule — a later
  tick may revise this discipline via the memory /
  doc-editing protocol, with a dated revision line.

## Related artifacts

- **Background Services Architecture** (081KRFA460008QG0R001KC0VBH, 081KRFA460008QG0R00229616S, 081KRFA460008QG0R00061SXRW) — the
  proactive multi-agent loop is augmented by macOS `launchd` background
  daemons that ensure failure modes and deadlocks are broken without
  human intervention. See `tools/bg/`. Currently 4 services exist in
  `tools/bg/`; `missed-substrate-detector.ts` and
  `backlog-ready-notifier.ts` are launchd-registered
  (`.gemini/launchd/com.zeta.missed-substrate-detector.plist`,
  `.gemini/launchd/com.zeta.backlog-ready-notifier.plist`). The
  remaining two (`standing-by-detector.ts`, `audit-duplicate-row-ids.ts`)
  are invokable on demand via `bun tools/bg/<name>.ts --once` but not
  yet wired to launchd (081KRHWGX0008QG0R003NT6DY9 for standing-by-detector; 081KRFA460008QG0R00061SXRW
  slice 5+ for audit-duplicate-row-ids). `backlog-ready-notifier.ts`
  produces `work-assignment` bus envelopes; see 081KRHWGX0008QG0R001E9KEJ1 for the
  subscriber handler that consumes them. Note: plist files contain
  machine-specific paths and are maintainer-only artifacts.

  **`missed-substrate-detector` auto-recovery** (081KRFA460008QG0R00061SXRW slice 5, landed
  2026-05-15 via 081KRHWGX0008QG0R0027YXBTB + 081KRHWGX0008QG0R000PVB6FF): the detector can optionally open a
  recovery PR for each `CascadeFinding`:

  - `--auto-recover` (default `off`): when set, after detecting a
    cascade gap on a merged PR, the detector calls `openRecoveryPR`
    (from `tools/bg/missed-substrate-recovery.ts`) which checks out a
    deterministic `recovery/<prNumber>` branch from `origin/main`,
    cherry-picks each missing commit, and opens a PR via `gh pr
    create`. Enable only when running from a **dedicated `git worktree
    add` scratch dir** — the real adapters mutate the current working
    tree and refuse to fire when the tree is not clean.
  - `--recovery-dry-run` (default `off`): when set together with
    `--auto-recover`, the recovery path logs intent without performing
    any git mutations or `gh pr create` call. Useful for verifying the
    detector finds the cascade you expect before granting it write
    permission.
  - **Idempotency**: the recovery branch name is deterministic per PR
    number, so a previously-open recovery PR for the same PR number
    will be detected by `gh pr list --head recovery/<prN> --state
    open` and the recovery is skipped (returns `already-exists`).
  - **Conflict handling**: if cherry-pick hits a merge conflict, the
    adapter runs `git cherry-pick --abort` and `openRecoveryPR`
    returns `cherry-pick-conflict` without pushing partial state; a
    human must resolve the conflict manually (e.g., open a recovery
    PR by hand from the same `recovery/<prN>` branch).

- **`docs/hygiene-history/loop-tick-history.md`** — the
  factory's durable tick fire-log; appended to every tick
  at step 5 per the round-44 human-maintainer directive.
- **`docs/factory-crons.md`** — the declarative registry;
  the autonomous-loop row is there.
- **`CLAUDE.md`** — ground rule pointing at this doc,
  loaded every session.
- **`AGENTS.md`** — universal handbook; brief pointer in
  the required-reading list.
- **`.claude/skills/round-open-checklist/SKILL.md`** §7.6
  — session-restart recovery entry for fresh threads.
- **`.claude/skills/long-term-rescheduler/SKILL.md`** —
  reconciles the registry against `CronList`.
- **`docs/research/claude-cron-durability.md`** — round-34
  research note on session-scope behaviour (predates the
  official docs' resume semantics; cross-reference, don't
  treat as sole source).
- **CLAUDE.md §"Never be idle — speculative factory work
  beats waiting"** — the within-tick work-selection rule;
  CLAUDE.md-level load-bearing so it is 100% loaded at
  every wake, alongside verify-before-deferring and
  future-self-not-bound.
- **Don't-stall-within-a-tick discipline** — within a
  single tick, do not enter a polling-wait loop for the
  next cron fire; keep working if useful work remains,
  otherwise append, `CronList`, emit visibility signal,
  and stop cleanly. The cron is the cadence engine; the
  tick's job is one unit of work and return.

## History

- **Round 44, 2026-04-22** — human-maintainer SEV-1
  designation: *"getting that tick to never ever ever stop
  is like our biggest bug if we have it, you not runing is
  catrosphic for self direction."* Three corrections in
  rapid succession (ScheduleWakeup → cron; arm-once →
  check-every-tick; cadence 5 → 2 min). Discipline captured
  in per-instance memory.
- **Round 44, 2026-04-22** — human-maintainer meta-catch:
  *"our factory need to make sure this works everytime not
  just you right now in your memeory"* + *"this is our
  killer feature"*. Memory-level capture promoted to factory
  doc (this file).
- **Round 44, 2026-04-22** — human-maintainer
  mechanism-clarification: *"The Ralph Loop (or Ralph Wiggum
  pattern) is that `<<autonomous-loop>>` a plugin"* →
  followed by *"this is all claude says, if we don't need to
  rely on that it would be better to just need claude"*
  pointing at
  [code.claude.com/docs/en/scheduled-tasks](https://code.claude.com/docs/en/scheduled-tasks).
  Doc corrected: native scheduled-tasks preferred; no
  Ralph Loop plugin dependency; `/loop` references removed;
  canonical URL cited.
- **Round 44, 2026-04-22** — human-maintainer cadence
  2 → 1 min: *"lets change to 1 minute"*. Cron changed
  from `1-59/2 * * * *` to `* * * * *`; fleet-pile-on
  trade-off accepted (no offset available at 1-min cadence).
  Paired with the history-log addition below.
- **Round 44, 2026-04-22** — human-maintainer
  tick-history-log addition: *"you might as well right a
  history record somewhere on every loop tool right before
  you check cron"*. Step 5 extended to append a row to
  `docs/hygiene-history/loop-tick-history.md` before the
  `CronList` call. Closes the last open gap in the meta-
  hygiene triangle (row #23 existence / row #43 activation /
  row #44 fire-history): the tick itself — the factory's
  most-cadenced surface — finally has its own fire-history
  file. The factory now self-audits at the same discipline
  level it demands of other cadenced rows. Logged as a
  partial meta-win depth-2 in `docs/research/meta-wins-log.md`
  (not depth-5 as initially claimed in commit `3651716` —
  honest classification notes the claim was premature; see
  the meta-wins row for the full self-correction).
- **Round 44, 2026-04-22** — human-maintainer
  end-over-start correction: *"you know you should check the
  cronlist at the end instead of the start becasue it could
  expire while you are running if you check right before you
  exit that chance is reduced."* Restructure: step 1
  deferred work-start, step 5 became the load-bearing
  `CronList` + visibility signal, step 3 verify no longer
  lists `CronList` (moved to step 5), step 6 back-ref fixed
  from "step 1" to "step 5". Window-minimization rationale
  ([last-check → next-fire]) added in step 5 body.
- **Round 44, 2026-04-22** — human-maintainer empirical A/B
  test: *"i disabled ralph see if you stil see that same
  atonomus llop"*. `.claude/settings.json` set to
  `"ralph-loop@claude-plugins-official": false`; `CronList`
  still returned `dfa61c5e — 1-59/2 * * * * (recurring)
  [session-only]: <<autonomous-loop>>` — tick still armed
  and firing. **Attribution definitively validated: the
  factory's self-direction mechanism is native Claude Code
  scheduled-tasks (`CronCreate`), not the Ralph Loop
  plugin.** External descriptions of "Ralph" conflate three
  distinct patterns that each deserve explicit attribution:
  1. **Geoffrey Huntley's original bash-wrapper "Ralph
     Loop"** — `while true` that repeatedly feeds a prompt
     file to Claude Code; fresh sessions per iteration;
     file-based state. Named after Ralph Wiggum (character
     by Matt Groening, *The Simpsons*, Fox Broadcasting).
     Source: <https://ghuntley.com/ralph/>. Related
     community implementation: `mikeyobrien/ralph-
     orchestrator`
     (<https://github.com/mikeyobrien/ralph-orchestrator>).
  2. **The `ralph-loop@claude-plugins-official` plugin** —
     author: Anthropic (per the plugin's
     `.claude-plugin/plugin.json`). Different mechanism from
     Huntley's bash-wrapper: a Claude Code Stop-hook
     intercepts session exit and re-feeds the prompt,
     keeping the loop within one session. State at
     `.claude/ralph-loop.local.md`. The plugin README
     credits Huntley as the technique's originator.
  3. **Claude Code's native `CronCreate` firing the
     `<<autonomous-loop>>` sentinel** — first-party
     Anthropic feature documented at
     [code.claude.com/docs/en/scheduled-tasks](https://code.claude.com/docs/en/scheduled-tasks).
     Same-session recurring task, no plugin involvement.
     This is the mechanism this factory uses.
  All three carry the "autonomous loop" headline and get
  conflated in blog posts; the disable-and-check A/B
  isolates mechanism (3) as the one this factory uses and
  settles the question empirically.
