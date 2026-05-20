---
pr_number: 4073
title: "backlog(B-0156): close as substrate-drift \u2014 all 6 acceptance criteria met"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T13:01:56Z"
merged_at: "2026-05-17T13:04:07Z"
closed_at: "2026-05-17T13:04:07Z"
head_ref: "backlog/b0156-substrate-drift-close-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T13:26:53Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4073: backlog(B-0156): close as substrate-drift — all 6 acceptance criteria met

## PR description

## Summary

Closes [B-0156](docs/backlog/P1/B-0156-typescript-standardization-non-install-scripts-aaron-2026-05-01.md) as **substrate-drift** per the discriminator at step 0 of [`.claude/rules/backlog-item-start-gate.md`](../blob/main/.claude/rules/backlog-item-start-gate.md): row stayed `status: open` while every named artifact had landed and every acceptance bullet had a corresponding merged PR.

Smallest safe slice on an implementation tick — the substrate-honest move on a drifted row is `status` flip + Resolution section + BACKLOG.md regen, not authoring more work.

## Evidence — every acceptance bullet → merged PR

1. **Six non-install `.sh` files ported then deleted.** Phase 1-2: `snapshot-github-settings.sh`, `check-github-settings-drift.sh`, `check-tick-history-shard-schema.sh` (last via #1986). Phase 3-4: `tools/profile.sh` (#1962 under B-0140), `tools/peer-call/amara.sh` + `tools/peer-call/ani.sh` (subsequent ports). Self-test `find tools -name '*.sh' …` now returns only install-graph files under `tools/setup/`.
2. **Each TS sibling has a `bun test`.** `tools/profile.test.ts` + `tools/peer-call/smoke.test.ts` (covers all 8 peer-call wrappers including amara/ani).
3. **Phase 5 sweep complete.** `.sh` originals deleted (recoverable via `git log --diff-filter=D` per `tools/hygiene/LOST-FILES-LOCATIONS.md`).
4. **Phase 6 `.py` policy lint.** `lint-no-python-files` job at `.github/workflows/gate.yml:877` running `bun tools/lint/no-python-files.ts`. Allowlist + 9-test unit suite present.
5. **`package.json` clean.** `grep -E '\.(sh|py)' package.json` returns no matches.
6. **No regression.** All migration PRs merged green; no follow-up regression rows filed.

## Focused checks

- `find tools -name '*.sh' … (filter to non-install)` → 0 files
- `bun tools/lint/no-python-files.ts` → `OK (0 allowlisted, 0 flagged)`
- `git diff docs/BACKLOG.md` → single-line flip `[ ]` → `[x]` on B-0156
- `git ls-tree HEAD | wc -l` = `git ls-tree origin/main | wc -l` = 53 (CodeQL broken-commit canary clean)
- Branch guard before commit: `git branch --show-current` = `backlog/b0156-substrate-drift-close-2026-05-17` ✓

## Test plan

- [x] Verify CI gate.yml `lint-no-python-files` job still passes
- [x] Verify backlog index regenerates without diff churn beyond the B-0156 status flip
- [x] CodeQL canary: ls-tree count preserved
- [x] No `.sh` files survive outside `tools/setup/` install graph

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T13:03:43Z)

## Pull request overview

Closes backlog item **B-0156** as **substrate-drift** by flipping the row to `status: closed`, updating `last_updated`, and adding a Resolution section that maps each acceptance criterion to already-landed evidence; updates the generated backlog index to reflect the closure.

**Changes:**
- Mark `docs/backlog/P1/B-0156-...` as `closed` and add a dated Resolution section documenting the substrate-drift basis and evidence.
- Regenerate `docs/BACKLOG.md` to flip B-0156 from `[ ]` to `[x]`.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/B-0156-typescript-standardization-non-install-scripts-aaron-2026-05-01.md | Flip `status` to `closed`, bump `last_updated`, and add a Resolution section documenting the substrate-drift close with evidence. |
| docs/BACKLOG.md | Update the index entry for B-0156 to show it as closed. |
