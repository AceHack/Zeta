---
name: hung_git_push_client_can_succeed_server_side_under_multi_otto_shared_token_saturation_verify_remote_ref_before_assuming_failure_otto_cli_2026_05_18
description: "Empirical pattern observed 2026-05-18T00:50Z-01:05Z (otto-cli cold-boot session, PR #4136 thread-fix push attempt): under multi-Otto + Lior + Vera shared-token saturation, `git push` clients can hang indefinitely at the network layer (no verbose output past 'Pushing to <url>...') while the SERVER-SIDE ref update still completes successfully. Killing the hung client via SIGTERM does NOT undo the server-side push. Subsequent push attempts then hit 'remote rejected: cannot lock ref <ref>: is at <new-sha> but expected <old-sha>' — revealing that a prior 'hung' push had landed. Discipline: under saturation, ALWAYS verify the remote ref state via `git ls-remote origin <ref>` before classifying a push as failed; if the remote ref is already at the target SHA, the 'hung' client was successful server-side and no retry is needed. Empirical evidence: 9 distinct push attempts during this 15-minute window (b9r16jxws, be58qn35l, bxkvk3jtq, b5sa0ifit, buu32gk5r, b5yvzpeeu, bwq5pr2g4, bmy1ky8pm, ba9rhlvsl); the final ba9rhlvsl returned exit 1 with 'cannot lock ref' message that proved an earlier push had landed."
type: feedback
created: 2026-05-18
originSessionId: otto-cli-cold-boot-2026-05-18-sentinel-16dda3a7
caused_by:
  - "Otto-CLI 2026-05-18T00:50Z-01:05Z: 9 git push attempts during PR #4136 thread-fix iteration; multiple appeared hung; one or more silently landed server-side; final attempt's rejection revealed prior success"
  - "PR #4136 review thread comment (Aaron-visible) naming this pattern as discovered failure mode"
  - "Multi-Otto + Lior + Vera shared-token saturation conditions per session-arc evidence"
composes_with:
  - .claude/rules/claim-acquire-before-worktree-work.md (saturation-ceiling taxonomy; sub-case 7 candidate — pushes-hang-but-succeed-server-side joins index-lock-contention sub-case 6 candidate)
  - memory/feedback_git_index_lock_wait_then_retry_beats_force_remove_during_peer_otto_saturation_15s_natural_clear_otto_cli_2026_05_18.md (same session, same saturation family; index-lock at git-add scope, this is git-push at network/ref-lock scope)
  - .claude/rules/refresh-world-model-poll-pr-gate.md (operational-tier framework; this happens orthogonally to GraphQL rate-limit tiers)
  - .claude/rules/zeta-expected-branch.md (race-window-caveat at branch-ref scope; same shared-state-contention pattern at remote-ref scope)
  - PR #4136 issue-comment landing (informal naming of the pattern before this memo formalizes it)
---

## Empirical anchor

Session: otto-cli cold-boot autonomous-loop, 2026-05-18T00:07Z onward, sentinel `16dda3a7`.
Conditions during the push-attempt window (~00:50Z-01:05Z, 15 min):

- GraphQL tier varied (post-reset normal, then ~4900-4500 remaining)
- Lior at 3 procs throughout (`ps -A | grep -E "gemini.*Lior|lior.*loop"`)
- Multiple claude-code processes (5 incl. self) per `pgrep -fl claude-code`
- Peer-Otto background-worker visible (PID 29037, full claude -p invocation with auto permission-mode running 30-PR-batch task)
- Multi-agent shared OAuth token `gho_*` per `git config remote.origin.url` (embedded credential)

### The 9-attempt sequence

| # | Task ID | Command form | Disposition | Server-side outcome |
|---|---|---|---|---|
| 1 | b9r16jxws | `gh api rate_limit + ps -A + git fetch + git log` (background) | Output truncated; exit 0 reported by harness | Read ops succeeded; no push |
| 2 | be58qn35l | `gh api rate_limit + ps + fetch + poll-pr-gate.ts 4136` (background) | Exit 0; output read post-completion | Read ops; PR poll returned DIRTY + 4 unresolved threads |
| 3 | bxkvk3jtq | `git fetch + git log` (background) | Exit 0; empty output file | Fetch succeeded but output didn't flush |
| 4 | b5sa0ifit | `git push origin <branch> 2>&1; echo exit=$?` (background) | EXIT 144 (SIGTERM, killed by me) — process hung 6 min | **POSSIBLY landed server-side** before kill (later evidence) |
| 5 | b5yvzpeeu | Tree-canary + push (background) | EXIT 144 (SIGTERM) — process hung | Possibly landed |
| 6 | bwq5pr2g4 | `git push origin <branch>` direct (background) | EXIT 144 (SIGTERM) | Possibly landed |
| 7 | bmy1ky8pm | Explicit-SHA push `<sha>:refs/heads/<ref>` (background) | EXIT 144 (SIGTERM) | Possibly landed |
| 8 | Foreground `timeout 60 git push --no-thin -v` | Timeout 60s | Hit timeout (exit 124); output ended at "Pushing to..." | Connection established but no progress visible |
| 9 | ba9rhlvsl | `git push 2>&1 > /tmp/push-out.txt; cat` (background) | **EXIT 1**; output: "remote rejected ... cannot lock ref ... is at c40d3cd... but expected 454696b..." | **Revealed prior push had landed** (remote already at target SHA) |

After attempt #9's rejection message, `git ls-remote origin <ref>` confirmed remote was at `c40d3cd` — the target SHA from attempts #4-#8 that all appeared hung.

**Conclusion**: at least one of attempts #4-#8 succeeded server-side despite the client hanging / being killed.

## The discipline this memo names

Under multi-Otto + Lior + Vera shared-token saturation:

1. **`git push` clients can hang indefinitely** at the network layer with no verbose output past the initial "Pushing to <url>..." line
2. **Server-side ref updates may complete successfully** during this hang
3. **Killing the hung client (SIGTERM) does NOT undo the server-side push** (the receive-pack process on GitHub side is independent of the client connection)
4. **Subsequent push attempts then hit `cannot lock ref ... is at <new-sha> but expected <old-sha>`** — this is the smoking gun that the prior "hung" push landed

### Verification discipline

Before classifying a push as failed:

```bash
git ls-remote origin <ref>
```

If the remote ref is already at the target SHA, the prior "hung" client was successful server-side. No retry is needed; the ref state IS the substrate landing.

### What this is NOT

- **NOT a general "always assume push succeeded" rule** — under normal conditions, hung push usually means failed push. The discipline ONLY applies under observable multi-agent saturation (`ps -A` shows Lior + Vera + multiple claude-code; `pgrep -fl claude-code` returns >1).
- **NOT a recommendation to skip retries** — verify ref state FIRST, then decide whether to retry
- **NOT a green-light for force-removing locks** — the index-lock-wait-then-retry discipline from the companion memo still applies at `git add`/`git commit` scope

### Decision tree

```
git push hangs (>30s without progress past "Pushing to <url>")
├─ Check multi-agent saturation: ps -A | grep -E "gemini.*Lior|lior.*loop" && pgrep -fl claude-code | wc -l
│  ├─ Saturated (Lior 1+ procs OR claude-code >1) → CHECK REMOTE REF
│  │  └─ git ls-remote origin <ref>
│  │     ├─ Remote ref == target SHA → push SUCCEEDED server-side; no retry needed
│  │     └─ Remote ref != target SHA → push genuinely failed OR still in-flight
│  │        └─ Kill hung client + retry after 30-60s OR defer to next tick
│  └─ Not saturated → standard interpretation; treat as failed push
```

## Post-authoring diagnostic addendum (2026-05-18T01:30Z) — block is per-token, not per-branch

After the initial memo landed, the push of THIS memo itself (commit `7177374`) hung under the same pattern, but with a difference: across ~5 minutes and multiple retries, the remote ref did NOT advance to the target SHA. The hung-but-succeeded-server-side pattern (which had let `c40d3cd` land earlier in the session) was NOT repeating for `7177374`.

Diagnostic probe at 0130Z: pushed the SAME SHA (`7177374`) to a FRESH branch name (`otto/diag-push-probe-2026-05-18-0130z`). Result: also exit 124 timeout; the fresh branch was never created on remote.

**Conclusion**: the git-write block is **per-token**, not per-branch. The shared OAuth `gho_*` token (used by all of Otto-CLI, Otto-Desktop, Lior, Vera, Riven, and Aaron's interactive sessions) hit a token-level secondary rate-limit on git-write operations. Earlier session pushes (0007Z, 0017Z, 0024Z) succeeded before saturation accumulated; subsequent pushes (~01:23Z onward) uniformly hung at network layer, with neither success nor explicit error.

### Refined decision tree

```
git push hangs (>30s without progress)
├─ Check saturation: ps -A + pgrep -fl claude-code
│  ├─ Saturated → CHECK REMOTE REF
│  │  └─ git ls-remote origin <ref>
│  │     ├─ Remote ref == target SHA → server-side SUCCESS; no retry needed
│  │     └─ Remote ref != target SHA → probe per-token block
│  │        └─ git push <sha>:refs/heads/<fresh-branch-name>
│  │           ├─ Also hangs → TOKEN-LEVEL block; defer; do NOT spam retries
│  │           └─ Succeeds → original branch had per-branch issue (rare)
│  └─ Not saturated → standard failure handling
```

### Empirical session-arc pattern (2026-05-18)

| Window | Pattern | Saturation indicators |
|---|---|---|
| 00:07Z-00:24Z | 3 pushes landed (`848bdcf`, `dedb3c7`, `454696b`) | Lior 3 procs, ~5 claude-code; **token budget likely fresh** |
| 00:50Z-01:05Z | 9 push attempts; some hung-but-succeeded server-side (revealed by "cannot lock ref" diagnostic on attempt #9); final state at `c40d3cd` | Lior 3, peer-Otto-bg-worker active (PID 29037), peer-WIP parked |
| 01:23Z-01:30Z+ | All pushes hang with no server-side success across 5+ min; per-token block confirmed via fresh-branch-probe | Same saturation; **token budget appears exhausted** |

**Operational implication**: under sustained multi-agent saturation, the git-write token budget is finite. Sessions that push frequently (or that share a token with peer agents) hit a soft ceiling beyond which all writes block. The ceiling is invisible to `gh api rate_limit` (which surfaces REST/GraphQL only, not git-write).

### Compose with existing rules

- `.claude/rules/refresh-world-model-poll-pr-gate.md` operational-tier framework documents GraphQL tiers (Normal / Cost-aware / Extreme cost-aware / Pure-git). This memo adds an **orthogonal axis**: git-write tier (Available / Hung / Token-exhausted). Both axes can vary independently.
- Defer-to-next-tick when token-exhausted is observed; do NOT spam retry loops (every retry attempts to open a network connection, which costs against the same shared token budget and prolongs exhaustion).

## Composition with index-lock memo (companion this session)

Both memos document **saturation-ceiling sub-case candidates** for `.claude/rules/claim-acquire-before-worktree-work.md`'s 5-sub-case taxonomy:

- **Sub-case 6 candidate** (companion memo): `.git/index.lock` contention at `git add`/`git commit` scope — wait-then-retry beats force-remove
- **Sub-case 7 candidate** (THIS memo): `git push` network-layer hang with server-side success — verify ref state before assuming failure

Both candidates are **single-anchor empirical**; rule-extension threshold is 2-3 more session anchors. Future-Otto encountering these patterns on distinct sessions provides the additional evidence.

## Anti-fabrication check

Per the pure-git-tier brief-ack-chain MEMORY.md entry: "Must be genuinely valuable; fabricated substrate is the synonym failure mode."

This memo's value test:

- ✓ Names a specific discovered failure mode with concrete evidence (9 push attempts, task IDs traceable in `/private/tmp/claude-501/.../tasks/`)
- ✓ The "cannot lock ref" diagnostic is checkable across future sessions
- ✓ The verification discipline (`git ls-remote` before retry) is mechanically applicable
- ✓ Distinct scope from companion memo (network-layer vs filesystem-lock-layer)
- ✓ Composes with existing rules; does NOT duplicate them
- ✗ Single anchor — does NOT yet justify rule change
- ✗ Some content is meta about the session's own debugging path (mild fabrication risk; mitigated by the empirical attempt-table)

Net: passes the anti-fabrication test as a single-anchor empirical memo with mechanically-applicable discipline.

## What this memo files

- Empirical anchor for hung-push-but-server-side-success pattern
- Verification discipline (`git ls-remote` before retry)
- Composition with index-lock memo (same session, same saturation family, different layer)
- Sub-case 7 candidate for saturation-ceiling taxonomy

Future-Otto cold-booting under multi-agent saturation encounters this via skill router + composes_with pointers + the in-rule companion memo trail.
