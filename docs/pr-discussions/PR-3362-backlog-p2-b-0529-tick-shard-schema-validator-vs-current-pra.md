---
pr_number: 3362
title: "backlog(P2): 081KRMEXM0008QG0R002HBY56V \u2014 tick-shard schema validator vs current practice drift"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T05:20:55Z"
merged_at: "2026-05-15T05:22:16Z"
closed_at: "2026-05-15T05:22:16Z"
head_ref: "b-0529/tick-shard-schema-drift-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-22T23:12:20Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3362: backlog(P2): 081KRMEXM0008QG0R002HBY56V — tick-shard schema validator vs current practice drift

## PR description

## Summary

Files 081KRMEXM0008QG0R002HBY56V P2 row documenting the substrate-wide drift between the documented 6-col pipe-row tick-shard schema and the H1-rich-body practice that the May 2026 cohort adopted. Surfaced via Codex P1 review on [PR #3359](https://github.com/Lucent-Financial-Group/Zeta/pull/3359).

**Recommendation**: hybrid (Option 3) — keep machine-parseable pipe-row first line + H1-rich body. Three sub-tasks sequenced:

1. Backfill May 2026 shards with pipe-row headers (one-shot script)
2. Update `docs/hygiene-history/ticks/README.md` "Shard file schema" section
3. Wire validator to CI's gate.yml (non-required → required after sweep)

P2 priority because the validator is NOT wired to CI — drift is invisible at gate-time today.

## Test plan

- [x] `bun x markdownlint-cli2 docs/backlog/P2/081KRMEXM0008QG0R002HBY56V-*.md` → 0 violations
- [x] Frontmatter matches 081KRHWGX0008QG0R00264BDSB row template
- [x] ID allocation discipline followed (on-disk top 081KRHWGX0008QG0R00264BDSB; in-flight PRs claim 081KRHWGX0008QG0R0015EE8VE only; 081KRMEXM0008QG0R000T0A28T left free for Lior's potential 081KRHWGX0008QG0R0015EE8VE rename per advisory; this row takes 081KRMEXM0008QG0R002HBY56V)
- [ ] CI required checks pass on PR
- [ ] Auto-merge fires after CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T05:24:04Z)

## Pull request overview

Adds a new P2 backlog row (081KRMEXM0008QG0R002HBY56V) to document and track the drift between the tick-shard schema validator’s “pipe-row first line” expectation and the May 2026 practice of H1-rich shard bodies, including options and a recommended hybrid approach.

**Changes:**
- Introduces backlog item **081KRMEXM0008QG0R002HBY56V** describing the validator/practice mismatch and its operational implications.
- Captures concrete reproduction output and proposes a sequenced remediation plan (backfill → docs update → CI wiring).

## Review threads

### Thread 1: docs/backlog/P2/081KRMEXM0008QG0R002HBY56V-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md:27 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:24:04Z):

The documented pipe-row schema snippet has an extra leading pipe (`|| ...`). The actual schema in docs/hygiene-history/ticks/README.md (and the validator’s COL1 regex) expects the row to start with a single `|` followed by a space, so this example is misleading.

### Thread 2: docs/backlog/P2/081KRMEXM0008QG0R002HBY56V-tick-shard-schema-validator-vs-practice-drift-2026-05-15.md:23 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T05:24:04Z):

The description says the validator enforces the filename’s `HHMMZ`, but `check-tick-history-shard-schema.ts` also accepts `HHMMZ-<hex>.md` and `HHMMSSZ-<hex>.md` (and it only checks the hour+minute portion). Consider updating this wording to match the actual accepted filename patterns so readers don’t infer a stricter constraint than the tool enforces.
