---
id: B-0615
priority: P3
status: open
title: Claude Code Bash tool orphans git network subprocesses under multi-agent saturation — self-saturation feedback loop
tier: operational-anchor
effort: M
ask: otto-cli empirical anchor 2026-05-18 (resurfaced 2026-05-21 PR #4537 review-thread cycle)
created: 2026-05-18
last_updated: 2026-05-21
depends_on: []
composes_with: [B-0650]
tags: [git-network-ops, multi-agent-saturation, push-hang, fetch-hang, orphan-subprocesses, harness-shell-wrappers, claude-code-bash-tool, kill-after-discipline, dotgit-pack-contention]
type: operational
---

# Claude Code Bash tool orphans git network subprocesses under multi-agent saturation

## Summary

Under sustained multi-agent activity (scheduled background-agent loops like Lior `--yolo` + multiple Otto-CLI sessions + concurrent agent fetches contending on `.git/objects/pack/`), `git fetch`, `git push`, `git ls-remote`, and `git clone` can hang indefinitely. The Claude Code Bash tool's default-timeout subprocess lifecycle does NOT reliably propagate SIGKILL to hung `git` subprocesses on tool-call expiry — the tool returns control to the agent but the underlying `git` subprocess remains running, holding pack-dir read locks and HTTPS connections. This creates a self-saturation feedback loop: orphaned `git` subprocesses contribute to the same `.git/` contention that caused them, making subsequent network ops more likely to hang.

## Canonical operational content lives in the auto-loaded rule

Full discipline + caveats + dotgit-saturation-tier detection + mitigation pattern are documented in [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../../../.claude/rules/refresh-world-model-poll-pr-gate.md) section "Wrap `git` network ops in `timeout --kill-after` under multi-agent saturation (B-0615)" + the "Dotgit-saturation tier (orthogonal to GraphQL tier)" section that follows.

This backlog row exists primarily to provide an in-repo target for the multiple cross-references that already exist across the substrate (`docs/research/2026-05-19-shadow-lesson-log.md`, [B-0650](B-0650-rest-push-delete-rename-extension-mechanizes-id-renumber-pattern-otto-cli-2026-05-18.md), and the rule body itself). Without this file, those references are dangling links that fail audit-trail verification (per PR #4537 review-thread cycle 2026-05-21 — Codex `chatgpt-codex-connector` flagged the dangling ID in a tick shard).

## Three empirical-anchor breakthrough findings (preserved from rule body)

1. **2026-05-18T03:33Z anchor** — the Claude Code harness itself fires shell-snapshot wrappers (`/Users/acehack/.claude/shell-snapshots/...`) that run `eval 'date -u ... && git fetch origin main ...'` patterns at session-start and background-task setup, and those wrappers do NOT inherit `timeout --kill-after`. Agent-controlled `timeout` discipline reduces orphan accumulation but cannot prevent it entirely while harness-internal wrappers fire bare fetches.

2. **2026-05-18T03:56Z breakthrough finding** — even at zero orphans, `git push` can still hang silently at the receive-pack upload phase. `--kill-after` discipline is hygiene work that prevents orphan accumulation; it does NOT guarantee push-restoration. Open question for follow-up B-NNNN: actual causal mechanism of `git push` receive-pack stalls under multi-agent conditions.

3. **Dotgit-saturation tier (2026-05-18T23:18Z anchor)** — 114 stuck `git pack-objects` + 52 maintenance + 52 repack = 234 total git plumbing procs in single observation; oldest 43:43 elapsed. This is orthogonal to the GraphQL rate-limit tier and indicates the local-filesystem contention has reached deadlock state where even `git worktree unlock` hangs.

## Resolution paths (any one would close this row)

### Option A — harness-level fix

Claude Code Bash tool wraps subprocess lifecycle with reliable SIGKILL propagation on tool-call expiry. This would prevent orphan accumulation at the source. Requires upstream change to Claude Code; not actionable within this repo.

### Option B — agent-side discipline + tooling

Mechanize the `timeout --kill-after` discipline via a TS wrapper (per Rule 0: `tools/git-safe/git-network-op.ts` or similar) that all agent-side git network ops call instead of bare `git push`/`git fetch`. Could compose with the rest-push pattern in [B-0650](B-0650-rest-push-delete-rename-extension-mechanizes-id-renumber-pattern-otto-cli-2026-05-18.md).

### Option C — dotgit-saturation guard

Pre-flight check before any git network op: scan for stuck `git pack-objects` / `git maintenance` / `git repack` procs above threshold (~50), defer the op + emit bus envelope. The rule body documents detection commands; mechanization would convert detection into automated guard.

### Option D — receive-pack causal investigation

The 2026-05-18T03:56Z breakthrough finding (zero-orphans, still-hangs) is an open question. Investigation slice: instrument a controlled push scenario with `GIT_TRACE=1 GIT_TRACE_PACKET=1` under multi-agent saturation; identify the precise hang point in the receive-pack protocol. May surface upstream Git issue, may surface GitHub-side behavior, may surface client-side TCP/HTTPS state.

## Acceptance criteria (any path)

- The push-hang pattern is either prevented (Option A or B) or detected-and-deferred (Option C) or causally understood (Option D)
- Empirical anchor session(s) document the resolution working under reproducible multi-agent saturation conditions
- The auto-loaded rule body is updated to reflect the resolved state
- All cross-references to B-0615 across the repo resolve to this file (substrate-honest landing)

## Refinement (2026-05-18T03:33Z empirical anchor) — harness-wrapper-layer is the dominant orphan source

Across the 2026-05-18T02:08Z–03:33Z session (26 push attempts, 0
successes), orphan-count oscillated between 1 and 5 with no
agent-instructed `git fetch` calls in flight during many oscillations.
Process inspection at PID 19261 (and similar) showed the orphan
source: **harness-internal shell-snapshot wrappers** at
`/Users/acehack/.claude/shell-snapshots/...` firing `eval 'date -u
... && git fetch origin main 2>&1 | tail -2 && git log --oneline
origin/main | head -3'` patterns — likely as part of session-start
or background-task setup, NOT from agent-instructed Bash tool calls.

**Implication**: agent-side `--kill-after` discipline is necessary
but **insufficient**. The orphan source is harness-internal, not
agent-controlled. The full B-0615 fix requires either:

1. Claude Code harness-side change: ensure shell-snapshot wrappers
   inherit `timeout --kill-after` semantics OR call cleanup on
   parent-tool-call expiry
2. Workaround at agent layer: periodic `pkill -f 'git fetch.*origin'`
   sweep at session-start (destructive; may break legitimate
   in-flight fetches — NOT recommended without further safety
   analysis)

Workaround option 2 is itself risky per the canary rule's
"DO NOT delete plugin directories to avoid crashing active agents"
spirit (applies at process scope too).

The substrate-honest acknowledgement: agent-level mitigation
ceiling is at `--kill-after`. The remaining substrate work
requires either (a) Claude Code upstream coordination via the
acceptance-criteria investigation step, or (b) accepting orphan
accumulation as session-baseline under multi-agent saturation.

## Breakthrough finding (2026-05-18T03:56Z) — orphan-count is CORRELATED, not CAUSAL

Push attempt #37 of the session was made at the cleanest local
state observed across 116+ minutes of continuous attempts:

- **0 stuck `git fetch` orphans** (down from session peak of 7)
- Lior CPU very quiet (steady ~27:23 over recent ticks)
- All other local metrics at session-best

**Result**: silent timeout at 90s, 0 bytes output, REAL_EXIT=124,
remote ref unchanged.

**Implication**: The orphan-count hypothesis (B-0615's original
load-bearing assumption — that subprocess orphans cause pack-dir
contention that hangs push) is **insufficient**. Orphan
accumulation is correlated with push-block patterns but is **not
the causal mechanism**. Even at zero orphans, push blocks
identically.

**B-0615 status under this finding**: the row remains valid as
**hygiene work** — orphans still represent wasted resources and
the `--kill-after` mitigation is correct discipline regardless.
But the row's acceptance criteria item describing the orphan-
cleanup as a push-unblocker SHOULD be reframed: cleanup is
hygiene, not push-restoration.

**Open question** (out of scope for this row; potential
separate B-NNNN): what is the actual causal mechanism of the
push-block? Diagnostic narrowing from this session:

- ✗ NOT network (curl https://github.com/ + https://api.github.com/ both HTTP 200)
- ✗ NOT auth (gh auth status valid, all scopes; gh api works throughout)
- ✗ NOT GraphQL rate-limit (verified across rate-reset boundary)
- ✗ NOT HTTP/2 (downgrade to HTTP/1.1 via `-c http.version=HTTP/1.1` does NOT unblock)
- ✗ NOT orphan-count (this finding)
- ✓ IS specific to `git push` receive-pack upload protocol
- ✓ IS system-wide (Lior also affected — zero new PRs in 30+ min observation window)

Remaining causal candidates: credential-helper challenge race
(osxkeychain), GitHub edge-node receive-pack throttling,
local network state requiring stack restart.

## Composes with

- [B-0650](B-0650-rest-push-delete-rename-extension-mechanizes-id-renumber-pattern-otto-cli-2026-05-18.md) — rest-push delete/rename extension; same multi-agent contention class
- [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../../../.claude/rules/refresh-world-model-poll-pr-gate.md) — canonical operational content for the push-hang pattern
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — sub-case 5 (peer-side destructive git operation discards unstaged edits) is adjacent failure class
- [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../.claude/rules/claim-acquire-before-worktree-work.md) — worktree-prune-race + saturation-ceiling discipline is sibling pattern under same `.git/` contention class
- [`.claude/rules/zeta-expected-branch.md`](../../../.claude/rules/zeta-expected-branch.md) — race-window-caveat (commit lands on wrong branch under peer HEAD-mutation) operates at adjacent scope
- `docs/research/2026-05-19-shadow-lesson-log.md` — Vera 2026-05-19 narrated B-0615 dangling-link observation (resolved by this file's landing)

## Why P3

Operational substrate that has working mitigations (`timeout --kill-after` discipline + foreground-no-timeout-push fallback + dotgit-saturation tier detection commands) documented in the auto-loaded rule body. Production-grade resolution would require harness-level cooperation (Option A) or substantial substrate engineering (Options B/C/D). The dangling-reference audit issue is resolved by this file landing; the underlying push-hang failure mode itself is a longer arc.

## Origin

Empirical anchor 2026-05-18T03:33Z–23:36Z multi-session — the rule body's content was written first; the backlog row file should have landed in the same session but didn't, creating the dangling-reference issue this file now resolves. Resurfaced 2026-05-21 during PR #4537 review-thread cycle when Codex `chatgpt-codex-connector` flagged the dangling B-0615 ID in tick shard `docs/hygiene-history/ticks/2026/05/21/1335Z.md` line 37. Substrate-honest landing pattern per `.claude/rules/substrate-or-it-didnt-happen.md` — the rule body documenting B-0615 IS substrate; the backlog row file landing makes the reference chain resolvable for in-repo auditors.
