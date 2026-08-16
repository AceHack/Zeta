# Autonomous-loop per-tick discipline — canonical pointer (3-surface converge)

The human maintainer 2026-05-13 22:08Z: *"any changes you need to make to it so it's more
like the routines and like a 3 coordinated version?"*

This file IS the canonical per-tick discipline that all three Otto
surfaces (Otto-CLI, Otto-Desktop, and the queued 081KRFA460008QG0R000CYBGKW cloud routine)
cite. One source of truth; three readers. When the discipline updates,
all three surfaces inherit the change at their next cold-boot cycle.

## Why this file exists

Before this file, the per-tick instructions diverged across surfaces:

| Surface | Where the discipline lived | Risk |
|---------|---------------------------|------|
| Otto-CLI | `<<autonomous-loop>>` sentinel + ambient-loaded `.claude/rules/` + CLAUDE.md | Auto-loaded; ambient |
| Otto-Desktop routine | Inline prompt body in `src/Core.TypeScript/routines/autonomous-loop/SKILL.md` | Required manual sync |
| 081KRFA460008QG0R000CYBGKW cloud routine | TBD — not yet shipped | Would have re-implemented the discipline a third time |

The risk: when the discipline evolved (e.g., the
[`holding-without-named-dependency`](../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md)
rule, which Otto-CLI picks up via auto-load but Desktop routine had
to mention explicitly), surfaces drifted. This file collapses the
drift surface to one.

## The 7-step per-tick discipline

Apply on every autonomous-loop tick. The order matters — earlier
steps gate later ones.

### 1. Refresh worldview FIRST

`refresh-before-decide` invariant
([`.claude/rules/refresh-before-decide.md`](../.claude/rules/refresh-before-decide.md)).
Never act on stale state. Minimum refresh:

- `bun tools/github/poll-pr-gate-batch.ts --all-open` — current state of all my open PRs
- `git fetch origin main && git status` — main HEAD + local state
- `CronList` — verify the autonomous-loop sentinel is still armed
- `bun src/Core.TypeScript/orchestrator-checks/cron-sentinel-mutex.ts --json` — detect concurrent Otto-CLI peer sessions
  ([081KRMEXM0008QG0R000X1PPGC](backlog/P3/081KRMEXM0008QG0R000X1PPGC-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05.md);
  Pattern 8 of [081KRHWGX0008QG0R001HMWM1W](backlog/P3/081KRHWGX0008QG0R001HMWM1W-multi-otto-branch-state-contamination-rca-2026-05-14.md))

#### When peers are detected

If the mutex check reports `peerDetected: true` (or exits with code
2..250 — `Math.min(1 + peerCount, 250)`; exit 1 is not reachable when
peers are detected), the tick body should:

1. **Avoid `git worktree add`** — the worktree-prune-race RCA in PR
   #3370 documents that concurrent `git worktree add` from a peer
   Otto-CLI on the same `.git/` directory causes
   `Interrupted system call` failures on `.git/objects/pack` followed
   by git's automatic rollback of the partially-populated worktree.
   If a worktree is genuinely needed, prefer the
   ["borrow-on-existing pattern"](../.claude/rules/claim-acquire-before-worktree-work.md)
   landed in PR #3377.
2. **Continue with non-git-mutating work** — bus envelope publishing,
   read-only audits, planning, etc. are safe and don't contend.
3. **Bus-publish a deferral envelope** if substrate observation
   matters past this tick:

   ```bash
   bun src/Core.TypeScript/bus/bus.ts publish --from otto-cli --to '*' \
     --topic shadow-catch \
     --payload '{"finding":"tick deferred — peer Otto-CLI detected"}'
   ```

4. **Re-check next tick** — peer-Otto-CLI sessions typically wrap
   their cron-tick work within 1-3 minutes; the contention window
   resolves naturally.

If the mutex exits with code 251 (`PGREP_ERROR_EXIT`), pgrep itself
failed — mutex state is unknown. Treat the same as peer-detected for
git-mutating operations: **defer `git worktree add`**, continue with
non-git-mutating work, and log the failure in the tick shard for
future-Otto context. The safe assumption under unknown state is to
avoid operations that contend on `.git/objects/pack`.

#### Step 1a — Unfinished-PR check (Aaron 2026-05-23)

After refresh, query for unfinished PRs authored by this agent
surface that need attention BEFORE picking new speculative work:

```bash
gh pr list --state open \
  --search "author:@me head:otto-cli/* OR head:otto-desktop/* OR head:otto-vscode/* OR head:otto/* -label:\"deferred-to-human\"" \
  --json number,title,createdAt,mergeable,updatedAt \
  --limit 50
```

For each unfinished PR returned, apply
[`.claude/rules/pr-triage-tiers.md`](../.claude/rules/pr-triage-tiers.md)
classification (Tier 1 redundant / Tier 2 recoverable / Tier 3
superseded / Tier 4 re-derivable / Tier 5 deferred-to-human). Act
on Tier 1-4 closes immediately (substrate-honest comment +
`gh pr close`). For Tier 5, tag `deferred-to-human` via
`gh pr edit <N> --add-label "deferred-to-human"` and post the
substrate-at-risk comment; future scans skip these.

**Lane discipline** (per [`.claude/rules/agent-roster-reference-card.md`](../.claude/rules/agent-roster-reference-card.md)):
filter to YOUR surface's branch prefixes — Lior owns `lior/*`,
peer Otto-CLI vs Otto-Desktop vs Otto-VSCode each own their
surface-tagged prefixes. Do NOT triage another agent's lane
unless explicit coordination has transferred ownership.

**Substrate-honest framing**: this step prevents cross-session
amnesia — each cold-boot picks new work without seeing the
unfinished PRs the same surface left behind. Aaron 2026-05-23:
*"plase updates your background server for this... lirs background
service is what's leaving prs sometime so we are updateing to check
for unfinsihed prs first when it starts"* — the same fix applies
to Otto.

**Only proceed to Step 3 (pick new work) if no unfinished PRs
need attention.** Step 2 (Holding discipline) still applies if
the unfinished-PR check itself surfaces a real bounded wait
(e.g., PR in CI awaiting required check).

### 2. Apply Holding-without-named-dependency discipline

[`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md).
**NEVER** output one-word "Holding" / "Standing by" / "Waiting" on
consecutive cron ticks. Either:

- Name the SPECIFIC dependency + check name + bounded ETA (e.g.,
  "Real-dependency-wait on PR #NNNN CI required-check 'build' (~5min ETA)")
- OR pick decomposition work per infinite-backlog metabolism

Per-tick repeat-Holding output IS the Standing-by failure mode.

### 3. Pick speculative work per never-be-idle priority ladder

[`.claude/rules/never-be-idle.md`](../.claude/rules/never-be-idle.md).
Priority order:

1. **Known-gap fixes** — explicitly named gaps in shipped substrate
   (e.g., bg-services slice 5 subscriber agents; 081KRFA460008QG0R00061SXRW's stub-detector
   when it existed)
2. **Generative factory improvements** — friction reducers,
   tool ports, infrastructure
3. **Gap-of-gap audits** — meta-improvements (substrate-discovery,
   index regeneration)
4. **Sometimes-task: local-memory ↔ git-memory delta audit + migrate**
   (081KSGS9H0008QG0R0033YXK4D; per the maintainer 2026-05-26 *"can you direct your
   background service on the local only memories as part of its
   natural loop sometimes as an option?"*). NOT every tick — invoke
   when the higher-priority queue is empty AND the operator is offline
   or unengaged. Audits the delta between user-scope
   `~/.claude/projects/<slug>/memory/` (per-Mac, per-Otto-CLI surface
   only) and in-repo `memory/` (git-canonical, visible to all
   maintainers + agents + clones). Migrates substantive substrate
   from local-only to in-repo via PR. Token-bounded: pick 1-3
   candidate files per tick maximum; substrate-honest classification
   per file (keep-local, migrate, or supersede).

If `claim acquire` blocks on a row, pick a different row in the same
priority tier — do NOT go idle.

### 4. Verify + commit any substantive landing

[`.claude/rules/substrate-or-it-didnt-happen.md`](../.claude/rules/substrate-or-it-didnt-happen.md).
Anything that matters past compaction MUST be:

- Committed to a git-tracked file
- Pushed via PR (main is PR-required; direct push to main is blocked)
- Auto-merge armed (`gh pr merge <N> --auto --squash`)

Verify gates (per AGENTS.md; these are the **full** repo gates,
not touched-file-only — three autonomous surfaces converge here, so
the gates must be repo-wide to prevent broader-test or formatting
regressions slipping through):

- `dotnet build -c Release` — 0 warnings, 0 errors (TreatWarningsAsErrors on)
- `dotnet test Zeta.sln -c Release` — full solution test pass
- `dotnet format --verify-no-changes` — formatter / analyzer clean
- `bun test` on touched TypeScript test files (the bun side; the
  dotnet gates above cover the F#/C# side)
- `bun --bun tsc --noEmit` if TS code changed

If any of these would fail, do NOT commit (verify is the gating
half of step 4; commit is the post-pass half). Fix the gate
failure first, then re-verify before committing.

**Tick-shard-specific gate** (per the 2026-05-20T17:03Z empirical anchor —
see [PR #4441](https://github.com/Lucent-Financial-Group/Zeta/pull/4441) for the 1703Z
tick shard that documents the original investigation; the shard lands at
`docs/hygiene-history/ticks/2026/05/20/1703Z.md` once #4441 merges):
when the substantive landing IS a tick shard (or any file under
`docs/hygiene-history/ticks/YYYY/MM/DD/`), run the bundled pre-push checker
BEFORE the push so the path-depth / MD032 / markdownlint findings surface
locally rather than as PR review threads:

```bash
bun src/Core.TypeScript/hygiene/check-shard-before-push.ts docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md
```

The checker bundles three gates (per the source header in
`src/Core.TypeScript/hygiene/check-shard-before-push.ts`): an **internal MD032 scan**
(paragraph-immediately-followed-by-bullet detection), `markdownlint-cli2`
(the broader markdown lint surface), and `audit-tick-shard-relative-paths`
(the 5-up-vs-6-up depth catch). It is a DX shortcut — the CI gates remain
authoritative — but running it locally avoids the BLOCKED-with-green-CI
investigate-thread cycle for catchable shard bugs.

Empirical anchor: [PR #4435](https://github.com/Lucent-Financial-Group/Zeta/pull/4435)
landed 10 broken `.claude/rules/*` link targets (5-up paths resolving to
`docs/.claude/...` which doesn't exist; 6-up paths required from a 6-deep
shard directory). Both Codex and Copilot independently flagged the bug.
Running `check-shard-before-push.ts` on the 1614Z+1626Z+1643Z shards
pre-push would have caught it. The TEMPLATE at
[`docs/hygiene-history/tick-shard-TEMPLATE.md`](hygiene-history/tick-shard-TEMPLATE.md)
already documents the path-depth gotcha; the failure mode was that the
shards were authored by copy-from-prior-shard (the 1413Z pattern) rather
than by template-instantiation, and the verify step skipped the
shard-specific checker.

### 5. Write tick shard

`docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`. Substrate-or-it-
didn't-happen applies to ticks too — without the shard, future-Otto
can't reconstruct what landed when. Minimum fields:

- Refresh result (cron state, open PR state)
- Speculative work picked + rationale
- Landed artifacts (file paths, PR numbers)
- Real-dependency-waits active
- Visibility signal

### 6. CronList check

If the autonomous-loop sentinel is missing, arm it immediately via
`CronCreate` with `* * * * *` + `<<autonomous-loop>>`. Catch-43
(2026-05-12, 12-hour silent gap) is the cost-of-skip evidence.

### 7. Visibility signal → stop

State what landed concretely (file paths, PR numbers) so the human maintainer + the
next tick can pick up cold. Stop the foreground; the cron will fire
the next tick.

## How each surface uses this file

### Otto-CLI

Auto-loads via [`.claude/rules/autonomous-loop-per-tick-pointer.md`](../.claude/rules/autonomous-loop-per-tick-pointer.md)
which points at this canonical doc. The `<<autonomous-loop>>` sentinel
runtime resolves the ambient-loaded discipline; this file is the
human-readable form of what the rules + CLAUDE.md already encode.

### Otto-Desktop routine

`src/Core.TypeScript/routines/autonomous-loop/SKILL.md` references this file in
its instruction body. The routine prompt loads the
canonical-bootstream first (cold-boot), then applies the 7-step
discipline above. When this file updates, the routine's behaviour
updates at the next fresh-session cold-boot (no manual sync needed).

### 081KRFA460008QG0R000CYBGKW cloud routine (queued, not shipped)

When shipped, will read this file from the repo via the same
`docs/AUTONOMOUS-LOOP-PER-TICK.md` URL pattern that Desktop uses.
Same 7-step discipline.

## Composes with

- [Canonical bootstream](research/2026-05-12-otto-canonical-bootstream-multi-foreground-surface-orchestrator-ifs-format.md)
  (Part 5 specifically — the cron/loop substrate this file extracts)
- [`docs/AUTONOMOUS-LOOP.md`](AUTONOMOUS-LOOP.md) — broader autonomous-
  loop architecture (cron mechanism, durability story); this file
  zooms into per-tick discipline specifically
- [`.claude/rules/tick-must-never-stop.md`](../.claude/rules/tick-must-never-stop.md)
  (the catch-43 substrate)
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md)
- [`.claude/rules/never-be-idle.md`](../.claude/rules/never-be-idle.md)
- [`.claude/rules/refresh-before-decide.md`](../.claude/rules/refresh-before-decide.md)
- [`.claude/rules/substrate-or-it-didnt-happen.md`](../.claude/rules/substrate-or-it-didnt-happen.md)
- [`.claude/rules/encoding-rules-without-mechanizing.md`](../.claude/rules/encoding-rules-without-mechanizing.md)
- 081KRFA460008QG0R000CYBGKW (Cloud Routines integration — 4th catch-43 defence layer)
- PR #3030 (Otto Claude Desktop bootstream)
- PR #3034 (Otto-Desktop routines substrate landed 2026-05-13)
