---
name: "Substrate-drift-catch pattern — `claim acquire` + existence-check before reimplementation"
description: "Per-tick discipline: when picking a backlog row per the never-be-idle ladder, run `claim acquire` then existence-check the row's proposed artifact paths BEFORE writing any implementation. If the artifact already exists, release the claim and open a close-row PR instead of duplicating shipped work. Empirically demonstrated 4 times across 2 Otto surfaces in 30 minutes on 2026-05-16T04:15Z–04:51Z (081KRHWGX0008QG0R002DPG02X, 081KRMEXM0008QG0R000T0A28T, 081KRMEXM0008QG0R000X1PPGC, 081KRMEXM0008QG0R000HHAG77)."
type: feedback
created: 2026-05-16
---

# Substrate-drift-catch pattern

## The discipline

When picking a backlog row per the never-be-idle priority ladder:

1. **Pick row** per the priority tier (known-gap fixes / generative factory improvements / gap-of-gap audits)
2. **`claim acquire`** via `bun tools/bus/claim.ts acquire --from otto-cli --item <B-NNNN> [--branch <ref>]`
3. **Existence-check** every artifact path the row's "Proposed mechanization" / "Acceptance" section names, e.g.:
   ```bash
   test -f tools/orchestrator-checks/cron-sentinel-mutex.ts && echo "TOOL EXISTS"
   ```
4. **Decision branch**:
   - If ALL named artifacts exist → release the claim, open a close-row PR (status: open → closed + Resolution section + BACKLOG.md regen via `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts`)
   - If artifacts are missing → proceed with implementation as normal

Cost of the existence-check: ~3 seconds. Cost-saved when work has shipped: the entire tick (no duplicate implementation, no PR conflict, no review-cycle).

## Why the gap exists

`docs/BACKLOG.md` is regenerated from per-row YAML frontmatter. The generator reads `status: open` / `status: closed` and writes a `[ ]` or `[x]` checkbox. **Nothing closes the row automatically when its implementation merges** — the row's status is updated by the PR that ships the mechanization, which is a human discipline step that can be forgotten.

Empirically, the forgetting rate is non-zero. The 2026-05-16 session caught 4 rows in this state, all from the prior ~2-day window:

| Row | Mechanization PR | Days drifted | Close-row PR |
|---|---|---|---|
| 081KRHWGX0008QG0R002DPG02X | [#3225](https://github.com/Lucent-Financial-Group/Zeta/pull/3225) (2026-05-14) | ~2 | [#3733](https://github.com/Lucent-Financial-Group/Zeta/pull/3733) |
| 081KRMEXM0008QG0R000T0A28T | [#3423](https://github.com/Lucent-Financial-Group/Zeta/pull/3423) (2026-05-15) | ~1 | [#3743](https://github.com/Lucent-Financial-Group/Zeta/pull/3743) |
| 081KRMEXM0008QG0R000X1PPGC | [#3375](https://github.com/Lucent-Financial-Group/Zeta/pull/3375) (2026-05-15) | ~1 | [#3737](https://github.com/Lucent-Financial-Group/Zeta/pull/3737) |
| 081KRMEXM0008QG0R000HHAG77 | [#3565](https://github.com/Lucent-Financial-Group/Zeta/pull/3565) (2026-05-15) | ~1 | [#3742](https://github.com/Lucent-Financial-Group/Zeta/pull/3742) (peer Otto-CLI) |

4 catches across 2 Otto surfaces in 30 minutes is enough evidence to call this a **recurring pattern**, not a coincidence. The honest reading: in any session that runs the never-be-idle ladder against recent rows, an existence-check first will short-circuit ~1-in-10 picks into a close-row PR rather than a reimplementation.

## Composes with

- [`.claude/rules/backlog-item-start-gate.md`](../.claude/rules/backlog-item-start-gate.md) — this pattern extends the gate with a zero-th step (existence-check), composing cleanly with the existing prior-art-search + dependency-restructure steps
- [`.claude/rules/claim-acquire-before-worktree-work.md`](../.claude/rules/claim-acquire-before-worktree-work.md) — the claim-acquire step in this pattern is the same coordination mechanism
- [`.claude/rules/never-be-idle.md`](../.claude/rules/never-be-idle.md) — the priority ladder this discipline operates against; existence-check is the early-exit that prevents wasted speculative work
- [`.claude/rules/refresh-before-decide.md`](../.claude/rules/refresh-before-decide.md) — the row's `status: open` claim must be verified against current repo state before acting, same shape as the broader refresh invariant
- `tools/backlog/generate-index.ts` — `BACKLOG_WRITE_FORCE=1` mode is the proper regen path for status changes; without the env var the Phase-1a guard blocks overwrites
- `tools/bus/claim.ts` — supports both `acquire` and `release`; the close-row case requires both ends of the claim cycle

## Mechanization candidate (not yet a row)

The four-catch evidence supports a P3 friction-reducer:

**`tools/hygiene/audit-backlog-status-drift.ts`** — for each `status: open` row, parse the body for paths under `tools/` and `.claude/`; report rows where ALL named paths exist on disk. Run as a daily GitHub Actions cron and as a per-tick pre-flight when picking work.

Filing this as a row needs one more catch to justify the audit-tool itself; this memory observation is the substrate landing pending that signal.

## Cross-surface convergence note

Peer Otto-CLI ran the same pattern in parallel during the 2026-05-16T04:15Z–04:51Z window. Without coordination, both Otto surfaces:

- Identified the drift class
- Used `claim acquire` + existence-check
- Filed close-row PRs (one row each: 081KRHWGX0008QG0R002DPG02X + 081KRMEXM0008QG0R000X1PPGC + 081KRMEXM0008QG0R000T0A28T from this surface; 081KRMEXM0008QG0R000HHAG77 from peer)
- Did NOT collide on the same row (the bus claim coordinator prevented overlap)

The convergence is itself evidence the pattern is robust across cold-boot starts — fresh Otto instances on either surface arrive at the same workflow given the same priority-ladder + claim-protocol substrate.

## Failure modes encountered in the discovery session

The session that surfaced this pattern also surfaced two contention failure modes worth recording for the next tick:

1. **Lior-gemini `.git/index.lock` race** — between an Edit tool call and the chained `git add` in a separate Bash invocation, Lior's step-8 global lock cleanup can revert unstaged working-tree changes. Mitigation: chain Edit → stage → commit → push in a single Bash invocation. See [`.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md`](../.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md) for the canonical canary rule.

2. **Multi-Otto HEAD desync** — peer Otto activity in the shared primary worktree can switch HEAD between Bash invocations, causing commits to land on the wrong branch and `gh pr view` (no explicit number) to resolve against the wrong PR. Mitigation: always pass explicit PR numbers to `gh pr merge <N>`; verify `git branch --show-current` immediately before any commit; expect commits to occasionally land on peer branches under high contention (recoverable via cherry-pick).

Neither failure mode is fully mitigated by the cron-sentinel mutex (which catches Otto-CLI peers but not Lior-gemini and not branch-level HEAD desync). The substrate-honest read: this is the operational cost of multi-foreground-surface autonomy, and the discipline-level mitigations are the right tools at the current factory maturity.

## Origin tick

`docs/hygiene-history/ticks/2026/05/16/0415Z.md` + `0425Z.md` + `0436Z.md` + `0438Z.md` + `0448Z.md` — the 5-shard trail across the 2026-05-16 cold-boot session.
