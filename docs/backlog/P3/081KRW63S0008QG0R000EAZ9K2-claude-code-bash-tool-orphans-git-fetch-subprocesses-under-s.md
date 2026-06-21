---
id: 081KRW63S0008QG0R000EAZ9K2
priority: P3
status: open
title: Claude Code Bash tool orphans git network subprocesses under multi-agent saturation — self-saturation feedback loop
tier: operational-anchor
effort: M
ask: otto-cli empirical anchor 2026-05-18 (resurfaced 2026-05-21 PR #4537 review-thread cycle)
created: 2026-05-18
last_updated: 2026-05-21
depends_on: []
composes_with: [081KRW63S0008QG0R003377JG9]
tags: [git-network-ops, multi-agent-saturation, push-hang, fetch-hang, orphan-subprocesses, harness-shell-wrappers, claude-code-bash-tool, kill-after-discipline, dotgit-pack-contention]
type: operational
---

# Claude Code Bash tool orphans git network subprocesses under multi-agent saturation

## Summary

Under sustained multi-agent activity (scheduled background-agent loops like Lior `--yolo` + multiple Otto-CLI sessions + concurrent agent fetches contending on `.git/objects/pack/`), `git fetch`, `git push`, `git ls-remote`, and `git clone` can hang indefinitely. The Claude Code Bash tool's default-timeout subprocess lifecycle does NOT reliably propagate SIGKILL to hung `git` subprocesses on tool-call expiry — the tool returns control to the agent but the underlying `git` subprocess remains running, holding pack-dir read locks and HTTPS connections. This creates a self-saturation feedback loop: orphaned `git` subprocesses contribute to the same `.git/` contention that caused them, making subsequent network ops more likely to hang.

## Canonical operational content lives in the auto-loaded rule

Full discipline + caveats + dotgit-saturation-tier detection + mitigation pattern are documented in [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../../../.claude/rules/refresh-world-model-poll-pr-gate.md) section "Wrap `git` network ops in `timeout --kill-after` under multi-agent saturation (081KRW63S0008QG0R000EAZ9K2)" + the "Dotgit-saturation tier (orthogonal to GraphQL tier)" section that follows.

This backlog row exists primarily to provide an in-repo target for the multiple cross-references that already exist across the substrate (`docs/research/2026-05-19-shadow-lesson-log.md`, [081KRW63S0008QG0R003377JG9](081KRW63S0008QG0R003377JG9-rest-push-delete-rename-extension-mechanizes-id-renumber-pattern-otto-cli-2026-05-18.md), and the rule body itself). Without this file, those references are dangling links that fail audit-trail verification (per PR #4537 review-thread cycle 2026-05-21 — Codex `chatgpt-codex-connector` flagged the dangling ID in a tick shard).

## Three empirical-anchor breakthrough findings (preserved from rule body)

1. **2026-05-18T03:33Z anchor** — the Claude Code harness itself fires shell-snapshot wrappers (`/Users/acehack/.claude/shell-snapshots/...`) that run `eval 'date -u ... && git fetch origin main ...'` patterns at session-start and background-task setup, and those wrappers do NOT inherit `timeout --kill-after`. Agent-controlled `timeout` discipline reduces orphan accumulation but cannot prevent it entirely while harness-internal wrappers fire bare fetches.

2. **2026-05-18T03:56Z breakthrough finding** — even at zero orphans, `git push` can still hang silently at the receive-pack upload phase. `--kill-after` discipline is hygiene work that prevents orphan accumulation; it does NOT guarantee push-restoration. Open question for follow-up B-NNNN: actual causal mechanism of `git push` receive-pack stalls under multi-agent conditions.

3. **Dotgit-saturation tier (2026-05-18T23:18Z anchor)** — 114 stuck `git pack-objects` + 52 maintenance + 52 repack = 234 total git plumbing procs in single observation; oldest 43:43 elapsed. This is orthogonal to the GraphQL rate-limit tier and indicates the local-filesystem contention has reached deadlock state where even `git worktree unlock` hangs.

## Resolution paths (any one would close this row)

### Option A — harness-level fix

Claude Code Bash tool wraps subprocess lifecycle with reliable SIGKILL propagation on tool-call expiry. This would prevent orphan accumulation at the source. Requires upstream change to Claude Code; not actionable within this repo.

### Option B — agent-side discipline + tooling

Mechanize the `timeout --kill-after` discipline via a TS wrapper (per Rule 0: `tools/git-safe/git-network-op.ts` or similar) that all agent-side git network ops call instead of bare `git push`/`git fetch`. Could compose with the rest-push pattern in [081KRW63S0008QG0R003377JG9](081KRW63S0008QG0R003377JG9-rest-push-delete-rename-extension-mechanizes-id-renumber-pattern-otto-cli-2026-05-18.md).

### Option C — dotgit-saturation guard

Pre-flight check before any git network op: scan for stuck `git pack-objects` / `git maintenance` / `git repack` procs above threshold (~50), defer the op + emit bus envelope. The rule body documents detection commands; mechanization would convert detection into automated guard.

### Option D — receive-pack causal investigation

The 2026-05-18T03:56Z breakthrough finding (zero-orphans, still-hangs) is an open question. Investigation slice: instrument a controlled push scenario with `GIT_TRACE=1 GIT_TRACE_PACKET=1` under multi-agent saturation; identify the precise hang point in the receive-pack protocol. May surface upstream Git issue, may surface GitHub-side behavior, may surface client-side TCP/HTTPS state.

## Acceptance criteria (any path)

- The push-hang pattern is either prevented (Option A or B) or detected-and-deferred (Option C) or causally understood (Option D)
- Empirical anchor session(s) document the resolution working under reproducible multi-agent saturation conditions
- The auto-loaded rule body is updated to reflect the resolved state
- All cross-references to 081KRW63S0008QG0R000EAZ9K2 across the repo resolve to this file (substrate-honest landing)

## Composes with

- [081KRW63S0008QG0R003377JG9](081KRW63S0008QG0R003377JG9-rest-push-delete-rename-extension-mechanizes-id-renumber-pattern-otto-cli-2026-05-18.md) — rest-push delete/rename extension; same multi-agent contention class
- [`.claude/rules/refresh-world-model-poll-pr-gate.md`](../../../.claude/rules/refresh-world-model-poll-pr-gate.md) — canonical operational content for the push-hang pattern
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../../../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) — sub-case 5 (peer-side destructive git operation discards unstaged edits) is adjacent failure class
- [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../.claude/rules/claim-acquire-before-worktree-work.md) — worktree-prune-race + saturation-ceiling discipline is sibling pattern under same `.git/` contention class
- [`.claude/rules/zeta-expected-branch.md`](../../../.claude/rules/zeta-expected-branch.md) — race-window-caveat (commit lands on wrong branch under peer HEAD-mutation) operates at adjacent scope
- `docs/research/2026-05-19-shadow-lesson-log.md` — Vera 2026-05-19 narrated 081KRW63S0008QG0R000EAZ9K2 dangling-link observation (resolved by this file's landing)

## Why P3

Operational substrate that has working mitigations (`timeout --kill-after` discipline + foreground-no-timeout-push fallback + dotgit-saturation tier detection commands) documented in the auto-loaded rule body. Production-grade resolution would require harness-level cooperation (Option A) or substantial substrate engineering (Options B/C/D). The dangling-reference audit issue is resolved by this file landing; the underlying push-hang failure mode itself is a longer arc.

## Origin

Empirical anchor 2026-05-18T03:33Z–23:36Z multi-session — the rule body's content was written first; the backlog row file should have landed in the same session but didn't, creating the dangling-reference issue this file now resolves. Resurfaced 2026-05-21 during PR #4537 review-thread cycle when Codex `chatgpt-codex-connector` flagged the dangling 081KRW63S0008QG0R000EAZ9K2 ID in tick shard `docs/hygiene-history/ticks/2026/05/21/1335Z.md` line 37. Substrate-honest landing pattern per `.claude/rules/substrate-or-it-didnt-happen.md` — the rule body documenting 081KRW63S0008QG0R000EAZ9K2 IS substrate; the backlog row file landing makes the reference chain resolvable for in-repo auditors.
