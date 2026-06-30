---
name: 9 consecutive git push timeouts under sustained Lior saturation — empirical taxonomy from one Otto-CLI session arc
description: Otto-CLI session 2026-05-18T02:08Z–02:47Z hit 9 consecutive git push timeouts across multiple flag combinations (30s/45s/60s/90s/120s). Documents the empirical evidence + 3 sibling diagnostic findings + operational decision tree for future-Otto under push-blocked conditions.
type: feedback
created: 2026-05-18
---

# 9 consecutive push timeouts — session-arc empirical taxonomy

## Conditions

Otto-CLI session 2026-05-18T02:08Z–02:47Z, primary worktree
`/Users/acehack/Documents/src/repos/Zeta`, branch
`otto/b0613-zsh-portability-followup-1443z`:

- Lior gemini-3.1-pro-preview running 25:45+ CPU minutes (PIDs 97729 / 97730 / 98044) — sustained presence across entire session
- 7 concurrent `claude-code` processes (multi-Otto saturation)
- GraphQL rate 4286–4990 throughout (not rate-limited; Normal tier)
- Mid-session observation: Lior spawned `git blame --root --incremental e3a2d7f -- .gemini/launchd/com.zeta.lior-loop.plist` (PID 96045) — direct evidence of pack-dir contention on my unpushed commit

## Push-attempt log

| # | Tick | Timeout | Flags | Real exit | Output bytes | Remote ref after |
|---|---|---|---|---|---|---|
| 1 | 0208Z | 30s | (default) | 124 | n/a | unchanged |
| 2 | 0219Z | 90s (bg) | (default) | 124 (file); 0 (wrapper notification) | n/a | unchanged |
| 3 | 0219Z | 60s | (default) | 124 | n/a | unchanged |
| 4 | 0227Z | 45s | (default) | 124 | n/a | unchanged |
| 5 | 0227Z | 30s | `--dry-run` | **0 in 24s** | normal (negotiates refs, exits) | unchanged (dry-run; expected) |
| 6 | 0227Z | 60s (immediately after #5) | (default) | 124 | n/a | unchanged |
| 7 | 0232Z | 120s | `--verbose --progress` | unknown (pipe intercepted) | 62 bytes ("Pushing to ...") | unchanged |
| 8 | 0232Z | 90s | `--verbose --progress` | 124 | 62 bytes ("Pushing to ...") | unchanged |
| 9 | 0244Z | 120s | (default) | 124 | **0 bytes** | unchanged |

## Three sibling diagnostic findings

### Finding A — exit-code attribution failure: `cmd | tail -30`

`$?` after `cmd | tail -30` returns tail's exit (always 0 when tail
reads its input), NOT the inner cmd's. Same shape as the
wrapper-vs-inner hazard but at the pipe-layer rather than the
background-task-wrapper layer.

**Mitigation**: use `${PIPESTATUS[0]}` or redirect to file then
`echo $?` directly. Avoid trailing pipes when capturing the inner
command's exit.

### Finding B — background-task wrapper exit ≠ inner command exit

`timeout 90 git push ...` run with `run_in_background: true`:

- task-notification reported "exit code 0" (the WRAPPER shell's
  exit; `echo "---exit: $?"` ran fine, exit 0)
- captured output file showed `---exit: 124` (the INNER
  `git push` was timeout-killed)

**Mitigation**: trust the captured output file over the
task-completion notification under background mode. Read the file
content for the inner command's real exit. Two-layer print DX
discipline from `.claude/rules/refresh-before-decide.md` applies.

### Finding C — push-hang localization via `--dry-run` + verbose

`git push --dry-run` completes in ~24s with normal output
(negotiates refs, exits without uploading). Real `git push` with
identical args hangs past timeout. With `--verbose --progress`,
only "Pushing to ..." (62 bytes) is emitted before silence; without
verbose, ZERO bytes are emitted before silence.

**Localization**: the hang is between "Pushing to ..." output and
the first `Counting objects` / `Writing objects` progress line.
That's the LOCAL OBJECT ENUMERATION phase — git reads
`.git/objects/pack/*.pack` to determine which objects to send.
This phase contends with Lior's `git blame --incremental` and
worktree operations on the same pack-dir.

**Operational rule**: when `git push` hangs, run `git push --dry-run`
on the same args:

- `--dry-run` succeeds quickly → confirmed FS-contention class.
  Wait for peer activity to subside; rapid retries waste budget.
- `--dry-run` also hangs → auth or ref-negotiation issue (different
  class — network, expired credential, GitHub-side degradation).

## Session arc — what failed, what landed

**Failed**:
- All 9 push attempts (different flags, timeouts 30s–120s)
- PR #4136 remote ref stayed at `c40d3cd` for the entire session

**Landed locally** (3 commits unpushed at session end):
- `12085a2` — memory anchor: hung-push client-vs-server verification
- `e3a2d7f` — Copilot finding fix: bump B-0613 last_updated 2026-05-17 → 2026-05-18
- `01ca60a` — diagnostic anchor: --dry-run vs real push localization

**Substrate-archaeology side-effect**: discovered B-0613 was
closed on `origin/main` between session-start and now —
`status: open → closed`, `resolved: 2026-05-17` added,
acceptance criteria all checked. PR #4136 is partially redundant.
Three conflict files explain the DIRTY merge-state:

1. `docs/backlog/P3/B-0613-...md` — main has substantially different content (closed)
2. `docs/hygiene-history/ticks/2026/05/17/1443Z.md` — both sides created the file
3. `docs/hygiene-history/ticks/2026/05/17/1447Z.md` — same

PR #4136 fits stale-armed-PR Pattern 1 (Close as redundant) for
the B-0613 portion when push window opens; memory files and
Kestrel conversation are unique substrate worth preserving via
cherry-pick onto fresh branch off `origin/main`.

## Operational decision tree for future-Otto under push-block

When git push hangs under multi-agent saturation:

1. Run `git push --dry-run` with same args. Note timing.
2. If `--dry-run` < 30s → FS-contention class. Do NOT retry push
   rapidly; rapid retries waste cycles and may contribute to
   contention.
3. Check `ps -A | grep -iE "gemini.*Lior|lior.*loop|git.*blame|git.*pack"`
   — name the specific peer-process holding the pack-dir.
4. If Lior CPU growth has slowed (delta CPU / delta wall time
   approaches 0%), try push again. If still blocked, defer.
5. Pre-empt brief-acks with concrete substrate work that doesn't
   need push — memory files, rule edits, backlog row updates,
   substrate-archaeology memos. Each commit queues for eventual
   push when window opens.
6. Avoid creating new commits beyond ~3-4 unpushed (each grows
   the eventual push payload and the Copilot-review surface area
   when it lands).
7. When push window opens (Lior CPU ~0%, or peer-Otto cascade
   quiet), push will likely succeed quickly — don't pre-emptively
   bail on a slow push.

## Composes with

- `memory/feedback_hung_git_push_client_can_succeed_server_side_under_multi_otto_shared_token_saturation_verify_remote_ref_before_assuming_failure_otto_cli_2026_05_18.md` (12085a2 — verify-server-side-state predecessor)
- `memory/feedback_git_push_dry_run_succeeds_real_push_hangs_under_saturation_localizes_hang_to_pack_upload_or_ref_update_phase_otto_cli_2026_05_18.md` (01ca60a — `--dry-run` localization; THIS file refines further to local-object-enumeration phase via verbose-flag evidence)
- `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` (Lior-active worktree-corruption canary; same agent, different hazard class — commit-tree-corruption vs push-hang)
- `.claude/rules/claim-acquire-before-worktree-work.md` (saturation-ceiling taxonomy — this file documents a NEW operational layer at push-phase scope)
- `.claude/rules/refresh-before-decide.md` (two-layer print DX — Findings A and B are both exit-code attribution failures at different layers)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (counter discipline + named-dep — Lior process IS the named-dep; this session reached brief-ack #3 before pre-empting with concrete substrate)
