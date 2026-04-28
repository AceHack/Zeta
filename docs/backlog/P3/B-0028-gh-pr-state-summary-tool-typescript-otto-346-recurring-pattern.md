---
id: B-0028
priority: P3
status: open
title: Extract `tools/git/pr-state-summary.ts` (TypeScript) — gh-CLI-plus-JSON-parse pattern that I keep writing inline (Otto-346 application; per B-0015 P2 priority, target is TypeScript not Python or bash)
tier: hygiene-tooling
effort: S
ask: Aaron 2026-04-26 catch — *"also more dymanic python smell"* — pointed at my inline `python3 -c "import json,sys..."` to parse `gh pr view --json` output. Same Otto-346 pattern (recurring dynamic Python = signal of missing substrate primitive); per Aaron's prior TS-migration priority bump (B-0015 P2), the proper home is TypeScript via Bun, not Python, not bash.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [feedback_otto_346_dependency_symbiosis_is_human_anchoring_via_upstream_contribution_good_citizenship_dont_blaze_past_2026_04_26.md, feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md, B-0015, B-0027, tools/hygiene/sort-tick-history-canonical.py, tools/hygiene/fix-markdown-md032-md026.py]
tags: [otto-346, recurring-pattern, missing-primitive, tooling-extraction, gh-cli, json-parsing, typescript, ts-migration, B-0015-sibling]
---

# B-0028 — extract gh-PR-state-summary tool (TypeScript)

## Origin — Aaron 2026-04-26 catch

Aaron caught me using inline Python AGAIN this session, in the same tick where I was acknowledging a prior Otto-346 violation:

> *"also more dymanic python smell"*

Pointing at this pattern in my bash:

```bash
gh pr view 534 --repo Lucent-Financial-Group/Zeta --json statusCheckRollup,mergeStateStatus 2>&1 | python3 -c "
import json,sys
d=json.load(sys.stdin)
fails=[c for c in d['statusCheckRollup'] if c.get('conclusion')=='FAILURE']
print(f'#534: merge={d[\"mergeStateStatus\"]}, {len(fails)} failures')
for c in fails:
    print(f'  - {c.get(\"name\")}')"
```

This is the SAME Otto-346 pattern I named earlier this session and shipped two tools for (PR #541 sort-tick-history-canonical.py, PR #542 fix-markdown-md032-md026.py). The discipline keeps slipping per-instance even though I named the principle.

## What the tool would do

**Problem class**: parse `gh` CLI JSON output to extract specific PR fields (status checks, merge state, review state, branch protection, etc.). I keep writing inline `python3 -c` heredocs to do this.

**Tool behavior** (proposed):

- `tools/git/pr-state-summary.ts <pr-number>` — concise summary of one PR
- `tools/git/pr-state-summary.ts --all` — all open PRs in queue
- `tools/git/pr-state-summary.ts <pr> --failures` — list only failing CI checks
- `tools/git/pr-state-summary.ts <pr> --threads` — review thread state
- TypeScript via Bun; uses `gh` CLI under the hood + native fetch as fallback

**Composition with sibling tools**:

- `tools/hygiene/sort-tick-history-canonical.py` (PR #541) — sibling extraction (Python interim)
- `tools/hygiene/fix-markdown-md032-md026.py` (PR #542) — sibling extraction (Python interim)
- This is the THIRD recurring-pattern extraction this session; the cumulative count IS the signal that B-0015 (P2 TS migration) needs to actually start shipping

## Why TypeScript, not Python

Per Aaron's 2026-04-26 priority bump on B-0015 (P3 → P2):

> *"we need to move the typescript migration of our scripts to higher priority so you will stop trying to write python and shell code lol ... our post install code"*

Tools in `tools/git/` and `tools/hygiene/` are POST-install (run after Bun is available). Per the TS-migration plan:

- POST-install scripts target = TypeScript via Bun
- PRE-install scripts (`tools/setup/install.sh`) = shell + PowerShell (stay)

This tool is POST-install (developer machine + CI runner already have Bun). TypeScript is the right target.

## First-migration candidate suitability

**Strong candidate for first POST-install bun+TS migration** (sibling to B-0027, alternative to B-0015's batch-resolve-pr-threads.sh):

Pros:

- Small (~80-150 lines TS)
- Pure logic (gh CLI input → parsed output)
- High recurrence (I keep needing it)
- Establishes precedent for TS sibling-migration guardrail unblock
- Composes with #541 and #542 patterns (same architectural shape)

Vs B-0015 (batch-resolve-pr-threads.sh, 390 lines bash with discipline already encoded): bigger but discipline-preserving translation.

Vs B-0027 (markdown-table-cell-count fix tool, not yet built): similar size, but B-0028 is *immediately useful* for the live drain-cadence Aaron + I are operating in, while B-0027 is reactive-only.

**Recommendation**: B-0028 might be the right first POST-install TS migration because:

1. Smallest scope
2. Highest recurrence rate (I use this daily during drain operations)
3. Establishes precedent quickly
4. Unblocks sibling-migration guardrail for follow-on tools

## Effort sizing

- **Build the tool**: S (under a day). gh CLI passthrough + JSON typing.
- **Tests**: S. Verify parity against current inline-Python output.
- **Use during drain**: replace inline Python uses with `bun run tools/git/pr-state-summary.ts ...`

## Meta-observation captured for substrate

**This is the THIRD instance** of Otto-346 (recurring dynamic = missing primitive) catching me this session:

1. PR #541 — sort-tick-history-canonical (extracted)
2. PR #542 — fix-markdown-md032-md026 (extracted)
3. **B-0028 (this row)** — gh-pr-state-summary (owed)

The pattern Aaron is catching is real and recurring. Per Otto-341 + Otto-346 honest application: each new instance is a fresh test of the discipline. The *cumulative count* of these catches IS data — three instances of the same pattern in one session is enough signal to move the TS-migration priority from "queued" to "actively starting first sibling."

## What this DOES NOT do

- Does NOT mandate immediate TS implementation — sibling-migration guardrail still applies
- Does NOT replace `gh` CLI — wraps it for ergonomic JSON parsing
- Does NOT auto-run during ticks — invoked explicitly during drain / debug operations
- Does NOT promise complete coverage of `gh` API — only the recurring-use-case patterns

## Composes with

- **B-0015** (TS-migration P2; this row's TS target follows from that priority)
- **B-0027** (markdown-table-cell-count tool; sibling extraction owed from same pattern)
- **Otto-346** (recurring-pattern absorption; this is the THIRD instance this session)
- **Otto-341** (mechanism over discipline; tools absorb the recurring pattern)
- **Otto-345** (Linus → git → tools-as-substrate; sibling lineage one layer down)
- **`tools/hygiene/sort-tick-history-canonical.py`** (PR #541) — sibling Python tool, awaiting TS rewrite
- **`tools/hygiene/fix-markdown-md032-md026.py`** (PR #542) — sibling Python tool, awaiting TS rewrite

## Owed work cluster

The cumulative TS-migration owed-work this session has reached:

- B-0015 batch-resolve-pr-threads.sh → TS (P2)
- B-0027 markdown-table-cell-count tool → TS (P3)
- B-0028 gh-pr-state-summary tool → TS (P3, this row)
- Plus eventual rewrites of #541 sort-tick-history-canonical.py + #542 fix-markdown-md032-md026.py

That's a five-tool batch for the post-install TS migration. When the first one lands, the sibling-migration guardrail unblocks the rest. Per Aaron 2026-04-26 priority bump, the TS migration moving from "queued" to "actively starting first sibling" is the right structural unblock.
