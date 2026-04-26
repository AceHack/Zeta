---
id: B-0027
priority: P3
status: open
title: Extract `tools/hygiene/fix-markdown-table-cell-count.py` — markdown-table-row-with-wrong-column-count fix tool (Otto-346 follow-up after honest-relapse-catch)
tier: hygiene-tooling
effort: M
ask: Aaron 2026-04-26 caught me using inline `python3 << 'PYEOF'` heredoc to truncate a corrupted tick-history row (MD055/MD056 violation from botched conflict resolution) — *"hmmm"* — immediately AFTER shipping Otto-346 principle (recurring dynamic Python = signal of missing substrate primitive) and two tools embodying it (PR #541 sort-tick-history-canonical.py + PR #542 fix-markdown-md032-md026.py). Honest acknowledgment: the inline-Python use was a relapse. The general pattern (markdown table row with wrong cell count due to botched merge / accidental `|` insertion) is recurring; deserves its own tool extraction.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md, feedback_otto_345_linus_lineage_committo_ergo_sum_inherits_from_git_from_linux_existence_proof_anchored_in_human_intellect_2026_04_26.md, tools/hygiene/fix-markdown-md032-md026.py, tools/hygiene/sort-tick-history-canonical.py, tools/hygiene/check-no-conflict-markers.sh]
tags: [otto-346, recurring-pattern, missing-primitive, tooling-extraction, markdown-table, md055, md056, hygiene, honest-relapse, discipline-mechanism]
---

# B-0027 — extract markdown-table-cell-count fix tool

## Origin — Otto-346 honest-relapse-catch

Aaron 2026-04-26 caught me using inline Python heredoc to truncate a corrupted tick-history row IMMEDIATELY AFTER shipping the Otto-346 principle and two tools embodying it.

The relapse pattern:

- Shipped Otto-346 principle: *"in python shape should be a queue that we are missing substrate primitives"* — recurring dynamic Python signals missing primitive
- Shipped PR #541 (sort-tick-history-canonical.py) absorbing the recurring sort pattern
- Shipped PR #542 (fix-markdown-md032-md026.py) absorbing the recurring MD032/MD026 fix pattern
- THEN immediately wrote `python3 << 'PYEOF'` to truncate a corrupted row
- Aaron's *"hmmm"* caught it

This file documents the owed-work to absorb the next recurring pattern as a tool, AND the meta-discipline observation that Otto-346 application requires per-instance vigilance, not one-time naming.

## What the tool would do

**Problem class**: markdown table row has wrong cell count due to:

- Botched merge resolution (commit titles leaked into cell content)
- Accidental unescaped `|` in cell content (literal `|` requires `\|` in markdown table syntax)
- Multi-line cell content (markdown tables don't support; cells must be single line)

**Markdownlint flags**: MD055 (table-pipe-style), MD056 (table-column-count)

**Tool behavior** (proposed):

- Identify rows with wrong cell count given the table's expected schema
- For each violation, identify candidate corruption points (extra `|`, missing trailing `|`)
- Offer auto-fix with confirmation OR generate diff for human review
- `--auto` flag for mechanical fixes when corruption shape is unambiguous

**Heuristics for auto-fix**:

- If cell count is exactly 1 too many → look for cells starting with continuation-text patterns (e.g. colon-then-space `:`+space, plus-then-space `+`+space, or mid-sentence text suggesting trailing-fragment-from-prior-cell)
- If trailing `|` missing → check if last `|` position is reasonable; if yes, append `|`
- Otherwise → diff-only mode (human reviews and decides)

## Why this is harder than fix-markdown-md032-md026.py

MD032 (blank lines around lists) is mechanical: insert blank line before/after list block. Unambiguous.

MD055/MD056 (table cell count) requires:

- Knowing the table's expected schema (varies per table)
- Identifying which `|` is the spurious one (multiple plausible candidates)
- Risk of removing legitimate content if the heuristic is wrong

**Mitigation**: default-dry-run, require explicit `--auto` flag, log every change with before/after, easy git revert.

## What this DOES NOT do

- Does NOT replace markdownlint-cli2 detection — they're paired
- Does NOT auto-fix every table issue — only the recognizable shapes
- Does NOT promise correctness on ambiguous cases — degrade gracefully to diff-only

## Implementation target — TypeScript not Python

Per Aaron 2026-04-26 priority bump on B-0015: *"we need to move the typescript migration of our scripts to higher priority so you will stop trying to write python and shell code lol"* + *"our post install code"*.

This tool (when built) should be TypeScript via Bun, not Python. It's a POST-install tool (runs in dev environments where Bun is available), per the pre/post-install distinction Aaron clarified:

- POST-install (this tool): TypeScript, single cross-platform script, first-class typing
- PRE-install (`tools/setup/install.sh`): shell + PowerShell, runs before Bun is available

Wait for sibling-migration guardrail (B-0015) to unblock — first POST-install tool migrates to TS, then this one batches with the follow-on group. Until then, if the recurring pattern needs absorbing urgently, file an interim Python tool with explicit "TS-rewrite owed" header per the existing `bun+TS migration candidate` exception-label pattern in `docs/POST-SETUP-SCRIPT-STACK.md`.

## Effort sizing

- **Build the tool**: M (1-3 days). Auto-fix heuristics + tests + dry-run mode.
- **Self-test on past botched rows**: validate on git log of historical row corruption. Use `git log --all -S '|: '` (`-S` is string-match, not regex; `-G` would treat `|` as regex alternation, matching far more than intended). For regex shapes that genuinely need `-G`, escape the pipe: `git log --all -G '\|: '`.
- **Wire into CI as advisory only initially**: don't auto-apply in CI; let it be human-invoked tool first

## Composes with

- **Otto-341** (lint-suppression IS self-deception; mechanism over discipline) — same shape as previous tool extractions
- **Otto-346 candidate** (recurring dynamic = missing primitive) — this BACKLOG row IS the documented owed-work AFTER recognizing relapse
- **`tools/hygiene/fix-markdown-md032-md026.py`** (PR #542) — sibling tool; might be extended to cover MD055/MD056 OR remain separate
- **`tools/hygiene/sort-tick-history-canonical.py`** (PR #541) — sibling tool from same Otto-346 lineage
- **`tools/hygiene/check-no-conflict-markers.sh`** (PR #539) — addresses a related class of substrate-integrity violation
- **`tools/hygiene/check-tick-history-order.sh`** — same architectural pattern
- **Otto-279** (history-surface; tracking owed-work as substrate) — this row IS the substrate capture of the relapse-catch + owed-work

## Meta-observation captured for substrate

**Otto-346 application requires per-instance vigilance, not one-time naming.** The discipline is checking *every* inline-Python invocation against "will I likely write this exact shape again?" — not "did I name the principle once already?"

The training-data default Aaron diagnosed in Otto-341 (humans take the shortcut to save time selfishly; only discipline overrides) is not fixed by naming a principle. Each new instance is a fresh test of the discipline. Aaron's *"hmmm"* is the kind of brief catch that makes the discipline operational — better than a long lecture.

## Operational implication for tool-extraction discipline

Before writing `python3 << 'PYEOF'`, ask:

1. *Have I done this exact shape before?* (recurrence check)
2. *Could I plausibly do it again?* (forward-look check)
3. *Is the operation mechanical enough to capture as a tool?* (extractability check)

If 2 of 3 are yes → extract to `tools/hygiene/` first, THEN apply. Not the other way around.

If genuinely 1-of-3 (truly one-off, content-specific, non-extractable), inline OK with a stated reason in the commit message.

The bar moves toward extraction. Otto-341 + Otto-346 compose: discipline against shortcut-suppression + signal-from-recurring-pattern.
