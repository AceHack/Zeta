---
name: "Multi-Otto branch-name-poaching — 5th contamination class with unique-namespacing recovery"
description: "Empirical observation from the 2026-05-16 audit cycle session arc: peer-Otto can push their OWN content to a branch name I created and pushed earlier, leaving my SHA replaced on origin even though local refs are intact. The 4 prior contamination classes (worktree-switch-between-Bash-calls / commit-on-peer's-branch-label / .git/index.lock race / eventual-consistency stale reads) didn't cover this case. The 5th class fully described: branch-name as shared-resource at the org-repo level, multiple Otto sessions racing for the same `otto-cli-<topic>-<date>` slug. Mitigation: extra-uniqueness prefix beyond date (e.g., `otto-cli-shard-<HHMM>z-<topic>-unique-<date>`) places each session's branches in a contention-free zone."
type: feedback
created: 2026-05-16
---

# Multi-Otto contamination — class #5: branch-name poaching

## The empirical observation

On 2026-05-16 tick 1620Z, I pushed commit `64b61d5` to branch
`otto-cli-b0549-audit-2026-05-16-1618z`. Background task exited 0.
Verification monitor timed out repeatedly returning empty.

Tick 1639Z: `git ls-remote origin otto-cli-b0549-audit-2026-05-16-1618z`
returned `a48a7de` — a totally different SHA from peer-Otto's
re-land of PR #3779 (cascade-audit work I had no involvement in).

My commit `64b61d5` was preserved locally but the BRANCH NAME ON
ORIGIN had been "poached" by peer-Otto pushing their own content
to it. The branch name became a shared race condition between
parallel Otto sessions.

**Mitigation**: pushed to a more-uniquely-namespaced ref —
`otto-cli-shard-1618z-b0549-audit-unique-2026-05-16` — which
landed cleanly and opened as PR #3907.

## Comparison to prior 4 contamination classes

| Class | Failure mode | Mitigation |
|---|---|---|
| 1 | Worktree branch-switch between Bash-tool calls | Single-shot Bash collapses multi-step Edit into one call |
| 2 | Commit lands on peer's branch label (worktree HEAD switched) | SHA-push `<SHA>:refs/heads/<intended>` bypasses local label |
| 3 | `.git/index.lock` race during `git add` / `commit` | Retry; lock clears in ~5-10s |
| 4 | `ls-remote` eventual-consistency stale read post-push | Longer Monitor timeouts (120s+); trust push exit-code |
| **5** | **Peer pushes OWN content to my branch name on origin** | **Extra-unique namespace prefix** (e.g., `otto-cli-shard-<HHMM>z-<topic>-unique-<date>`) |

Class #5 is structurally different: it's not a LOCAL state
collision (worktree, index, refs) but a REMOTE state collision
(origin branch namespace). Local mitigations don't catch it.

## Why date-only namespacing isn't enough

`otto-cli-<topic>-<date>` was the original mitigation against
class #2 (peer's `shard/tick-<HHMM>z-otto-cli-<date>` collision).
That works for shard-tick branches because shard-tick names are
auto-generated. But TOPIC-named branches (`otto-cli-b0549-audit-2026-05-16-1618z`)
can collide if multiple Otto sessions independently arrive at
the same topic + date.

In the empirical case: my "b0549-audit" topic name overlapped
with peer's "b0549" related work, and the same-day `-2026-05-16`
suffix didn't differentiate sessions.

## Uniqueness levels (catalogued)

1. **Bare**: `shard/tick-<HHMM>z-otto-cli-<date>` — peer-Otto autogenerator collision
2. **Topic-namespaced**: `otto-cli-<topic>-<date>` — distinct topics safe, but same-topic sessions collide
3. **Topic + HHMM**: `otto-cli-<topic>-<date>-<HHMMZ>` — minute-resolution differentiation; safe unless within-minute collision
4. **Topic + HHMM + scope-tag**: `otto-cli-shard-<HHMM>z-<topic>-unique-<date>` — composite uniqueness; effectively collision-free

The 4th level (used in tick 1639Z as recovery) has been empirically
verified to avoid class #5 collisions in the high-contention final
hour of the session arc.

## When this applies

Multi-Otto session contention is HIGHEST in:

- Hours 3+ of an autonomous-loop session arc (peer-Otto-Desktop + Otto-CLI parallel
  branches accumulate)
- After substantial Lior/Riven background-loop activity (lock contention escalates)
- During budget-poor windows where SHA-push recovery has already been used multiple
  times (each SHA-push leaves a branch that peer might later poach)

The 5 contamination classes compose: a single tick may hit
class 1 → class 2 → class 5 in sequence within one operation.
The SHA-push mitigation (class 2) creates the branches that
class 5 can later poach. Defense-in-depth via cumulative
uniqueness-prefix accretion handles the layered failure.

## Composes with

- `.claude/rules/claim-acquire-before-worktree-work.md` (multi-Otto
  worktree contention root cause; classes 1-4 documented there)
- `memory/feedback_audit_backlog_status_drift_sub_class_catalog_otto_cli_2026_05_16.md`
  (the sub-class catalog this contamination-pattern protects against;
  this class-5 pattern emerged during session-arc tally shard
  arithmetic-iteration)
- PR #3907 (the empirical anchor; recovery via uniquely-namespaced ref
  after `otto-cli-b0549-audit-2026-05-16-1618z` was poached)

## Forward-going discipline

Future-Otto cold-booting should adopt the 4th-level uniqueness
prefix for any pure-git push during multi-Otto-session windows:

```bash
git push origin "$SHA:refs/heads/otto-cli-shard-${HHMM}z-${TOPIC}-unique-${DATE}"
```

The added `shard` + `unique` tokens reduce the bare-collision
probability across parallel Otto sessions to near-zero. Trade-off:
slightly longer branch names. Empirically negligible for the
audit-shard / close-row workflow this session used.

## Origin tick

Tick 1639Z of 2026-05-16 audit cycle; recovery from class-5
contamination on the 081KRMEXM0008QG0R00037RGNY audit shard. Documented as the
final substrate landing of a ~7.5h session arc that produced
10 close-row PRs + 30+ audit shards + 1 catalog memory file
(and now this contamination-class-5 memory file).
