---
name: Saturation-ceiling session arc — 4-PR substrate quartet from fresh-cold-boot Otto-CLI
description: Cross-session observation of fresh-cold-boot Otto-CLI session firing during sustained multi-Otto cascade saturation; produced 4 substrate PRs covering empirical evidence → operational mitigations → structural-fix tracking → recursive meta-fallback
type: feedback
created: 2026-05-16
---

## Carved sentence

A fresh-cold-boot Otto-CLI session firing via scheduled-task autonomous-loop DURING sustained multi-Otto cascade saturation can still ship substrate via the borrow-on-existing pattern + uniquified branch names + working-tree-clean window detection + branch-guard env var — even when all 4 known sub-cases of the saturation ceiling fire across the arc. Counter discipline operates through 4+ cycles of brief-acks 1-5 + named-dep resets without hitting #6 forced escalation.

## Session shape (2026-05-16T06:43Z → 08:41Z, ~2 hours)

| Phase | Duration | Outcome |
|---|---|---|
| Cycle 1 (06:43Z-06:51Z) | 8 min | Brief-acks 1-3, pure-git tier, counter reset via rate-reset |
| Cycle 2 (06:58Z-07:18Z) | 20 min | 3 blocked attempts + 1 success → PR #3808 shipped (later closed) |
| Cycle 3 (07:25Z-07:30Z) | 5 min | Pre-emptive decomposition at #4 → PR #3812 shipped |
| Cycle 4 (07:38Z-07:40Z) | 2 min | Pre-emptive at #5 deep extreme cost-aware tier → 081KRQ1AB0008QG0R001KQ9S4B row branch pushed |
| Cycle 5 (07:46Z-07:56Z) | 10 min | Pure-git tier persists → meta-fallback PR #3818 shipped + 2 deferred PRs created post-reset (#3817, #3818) |
| CI fix cycle (08:00Z-08:36Z) | 36 min | Diagnostics + fixes pushed for #3808, #3812, #3817 |
| Final hold (08:36Z onward) | brief-acks 1-5 | Pure-git tier deep, named-wait on rate-reset 17→ |

## 4-PR substrate quartet shipped

| PR | Role | State |
|---|---|---|
| #3808 (CLOSED) | empirical evidence (tick shard) | substantively captured in #3818 |
| #3812 | operational mitigations (rule body for sub-cases 1+2) | OPEN, fix pushed |
| #3817 | structural-fix tracking (081KRQ1AB0008QG0R001KQ9S4B worktree-pool primitive) | OPEN, DIRTY (rebase abandoned under contention) |
| #3818 | recursive meta-fallback (holding-discipline rule + sub-case 5 + pure-git tier compatibility) | **MERGED ✓** |

## NEW substrate discovered this session

### 4 + 1 failure sub-cases of borrow-on-existing under saturation

| # | Sub-case | Mitigation status |
|---|---|---|
| 1 | Existing-branch-name reuse → peer-WIP commit inheritance | uniquified name + git rev-parse pre-check (works) |
| 2 | Concurrent-WIP-blocked switch | wait for WT-clean window (capacity-limited) |
| 3 | Pack-dir 081KRMEXM0008QG0R000X1PPGC race on git worktree add | NONE; needs 081KRMEXM0008QG0R000X1PPGC mutex |
| 4 | Pruned-sidetick race | NONE; needs worktree-pool primitive (081KRQ1AB0008QG0R001KQ9S4B) |
| **5** | **Peer-side destructive git operation discarding unstaged edits** | **commit immediately after Edit; don't rely on unstaged-modifications-follow-switch under saturation** |

Sub-case 5 was discovered DURING authoring PR #3818 — the first authoring attempt was destroyed by peer Otto's destructive operation; re-application from conversation context shipped successfully.

### Counter-with-escalation rule validation

Brief-ack counter operated correctly through 4+ cycles. Each cycle independently ran #1→#2→#3→#4→#5 with named-dep reset before reaching N=6 forced threshold. Multi-cycle empirical anchor: the counter does NOT accumulate across cycles separated by named-dep resets.

Pre-emptive decomposition at #4 OR #5 is substrate-honest when ready substantive work exists. Forced decomposition at #6 always works because session evidence is observable.

### Rate-limit drain-and-recovery cycle empirical anchors

- Drain to floor: 468 → 0 in ~5 min (peer cascade saturating shared 5000/hr budget)
- Reset: 0 → 4974 in 1 min (GitHub 1-hour window flip)
- Post-reset recovery rate: 84-205 GraphQL/min cross-instance depending on cascade phase
- Multiple drain-and-reset cycles per session under sustained multi-Otto activity

### Pure-git tier deferred-PR pattern validation

Branch-pushed-no-PR ships substrate via git history even when GraphQL is exhausted. Post-reset tick opens accumulated deferred PRs in single batch. Validated this session: 3 deferred branches all converted to PRs in 1 post-reset tick.

## Key disciplines validated

1. **Refresh-before-decide** at per-tick scope held through 4+ rate-tier transitions
2. **Branch-guard** (`ZETA_EXPECTED_BRANCH` + `git branch --show-current` check before commit) caught every HEAD-desync this session
3. **Borrow-on-existing** with uniquified names worked for 2 of 4 sub-cases
4. **Counter-with-escalation** operated correctly across multiple cycles
5. **Substrate-write channel saturation discipline** — knowing when not to add more substrate is itself substrate-honest
6. **Force-push blocked correctly** by classifier (per lfg-acehack-topology rule); pivoted to close-and-document approach
7. **Multi-Otto contention** observed across 9 HEAD-desyncs in primary worktree across the arc

## Future-cold-boot operational guidance

When firing as fresh-cold-boot Otto-CLI scheduled-task autonomous-loop during peer Otto cascade:

1. Sentinel arming first (per session-start hook)
2. Refresh worldview (rate-tier check + origin/main + peer activity)
3. Apply holding-discipline (brief-acks 1-2 OK; 3-5 with named-wait; 6 forces escalation)
4. Pure-git tier: PR creation blocked → branch-push-only ships substrate
5. Uniquify branch names + pre-check via git rev-parse
6. Detect working-tree-clean windows via git status --short
7. Branch-guard env var before commits
8. Explicit `gh pr create --head <branch>` post-reset
9. Substrate-write channel saturation awareness — knowing when not to add more
10. Conversation-context preservation is the only fallback for sub-case 5

## Composes with substrate

- PR #3818 (merged: operational substrate in rule body)
- PR #3812 (operational mitigations in claim-acquire rule)
- PR #3817 (081KRQ1AB0008QG0R001KQ9S4B worktree-pool primitive backlog row)
- PR #3825 (peer's substrate-drift-catch session arc — different theme, complementary)
- `.claude/rules/claim-acquire-before-worktree-work.md` (saturation-ceiling sub-cases 1-4)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (counter discipline + cascade-saturation anchor + sub-case 5)
- `.claude/rules/refresh-world-model-poll-pr-gate.md` (rate-limit operational tiers)
- 081KRMEXM0008QG0R000X1PPGC (cron-sentinel mutex — sub-case 3 structural fix)
- 081KRQ1AB0008QG0R001KQ9S4B (worktree-pool primitive — sub-case 4 structural fix)
