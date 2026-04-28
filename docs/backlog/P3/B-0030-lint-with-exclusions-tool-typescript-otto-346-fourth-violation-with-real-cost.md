---
id: B-0030
priority: P3
status: open
title: Extract `tools/hygiene/lint-md-with-exclusions.ts` (TypeScript) — markdownlint-with-repo-aware-exclusions tool; Otto-346 violation #4 this session, this one with real cost (~60s instead of ~3s)
tier: hygiene-tooling
effort: S
ask: Aaron 2026-04-26 — *"this is like the python smell but with python and this one had a real cost it forgot to ignore upstram so it took like a minute to run instead of a few seconds, if it was cononalized in code like in ../scratch it would never forget to exclude directoris like our references"*. The bash pipeline `markdownlint-cli2 "**/*.md" | grep -E 'MD[0-9]{3}'` I composed inline lacked proper repo-aware exclusions for vendored / mirrored directories, ran ~60s instead of expected ~3s. Same Otto-346 pattern (recurring inline composition = missing substrate primitive). Per B-0015 P2 priority bump: target is TypeScript via Bun, not bash and not Python.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [feedback_otto_346_dependency_symbiosis_is_human_anchoring_via_upstream_contribution_good_citizenship_dont_blaze_past_2026_04_26.md, B-0015, B-0027, B-0028, B-0031, tools/hygiene/fix-markdown-md032-md026.py]
tags: [otto-346, recurring-pattern, missing-primitive, tooling-extraction, markdownlint, repo-aware-exclusions, real-cost, typescript, ts-migration]
---

# B-0030 — extract markdownlint-with-repo-aware-exclusions tool

## Origin — Aaron 2026-04-26 catch with cost-evidence

Aaron 2026-04-26 caught the pattern AND named the cost:

> *"this is like the python smell but with python and this one had a real cost it forgot to ignore upstram so it took like a minute to run instead of a few seconds, if it was cononalized in code like in ../scratch it would never forget to exclude directoris like our references (not upstream that's proabalby a bad name i randomly chose, we should rectify to avoid wars/confusion becasue im using upstream incorrectly)"*

This is **Otto-346 violation #4** this session:

1. PR #541 — sort-tick-history-canonical.py (Python tool extracted)
2. PR #542 — fix-markdown-md032-md026.py (Python tool extracted)
3. B-0028 — gh-pr-state-summary tool (TS target; awaiting first-migration unblock)
4. **B-0030 (this row)** — lint-with-exclusions tool (TS target)

The differentiating factor: **this one had measurable cost**. Slow run (~60s) when properly-bounded would be ~3s. That's a 20x cost penalty per invocation, multiplied by every time I run the inline pipeline.

## What the tool would do

**Problem class**: ad-hoc invocations of markdownlint (or other lint tools) on `**/*.md` patterns lack ergonomic defaults for repo-specific exclusions. Each inline use forgets:

- `references/` directory (vendored / mirrored upstream code we don't own)
- `tools/lean4/.lake/packages/` (Lean dependencies)
- Other generated / vendored / archive directories

**Tool behavior** (proposed):

- `tools/hygiene/lint-md-with-exclusions.ts [paths...]` — wrap markdownlint-cli2 with repo-aware default exclusions
- `--strict` — fail on any violation (default)
- `--summary` — print only error counts per file, not full output
- `--target <pattern>` — override default scope to specific paths
- TypeScript via Bun; reads exclusion config from `.markdownlint-cli2.jsonc` and applies before invocation

**Cost reduction**: from ~60s with missed exclusions → ~3s with canonical exclusions. 20x speedup is real productivity.

## Composition with sibling tools

- `tools/hygiene/fix-markdown-md032-md026.py` (PR #542) — sibling: applies fix; this one detects with proper exclusions
- B-0028 (`gh-pr-state-summary.ts`) — sibling extraction from same Otto-346 pattern; both target TS
- `tools/hygiene/check-tick-history-order.sh` + `check-no-conflict-markers.sh` — sibling architectural shape (shell now; eventual TS rewrite per B-0015)

The cumulative `tools/hygiene/` post-install batch awaiting TS migration:

- B-0027 (markdown-table-cell-count fix tool — owed-build, TS target)
- B-0028 (gh-pr-state-summary — owed-build, TS target)
- B-0030 (this row — lint-with-exclusions — owed-build, TS target)
- + eventual rewrites of #541, #542

## Why TypeScript

Per Aaron's prior priority bump on B-0015 (P3 → P2):

> *"we need to move the typescript migration of our scripts to higher priority so you will stop trying to write python and shell code lol"*

POST-install scripts target TypeScript via Bun. This is post-install (developer + CI machines have Bun).

## Effort sizing

- **Build the tool**: S (under a day). Wrap `markdownlint-cli2` with config-aware exclusion defaults.
- **Read existing `.markdownlint-cli2.jsonc`** for current exclusion patterns; compose with directory-aware logic.
- **Verify cost reduction**: measure before/after run-time on full repo.

## Composes with

- **B-0015** (TS-migration P2 priority — first-migration unblock applies)
- **B-0027** (markdown-table-cell-count tool — sibling extraction)
- **B-0028** (gh-pr-state-summary — sibling extraction)
- **B-0031** (references/ directory rename — paired concern from same Aaron observation)
- **Otto-346** (recurring-pattern absorption; this is the FOURTH instance this session)
- **Otto-341** (mechanism over discipline; tools absorb the pattern)
- **`tools/hygiene/fix-markdown-md032-md026.py`** (PR #542) — sibling Python tool

## Meta-observation captured for substrate

**Otto-346 violation #4 this session — the cumulative count IS the signal**:

| # | Pattern | Outcome |
|---|---|---|
| 1 | Inline Python sort | PR #541 (Python interim) |
| 2 | Inline Python markdown-fix | PR #542 (Python interim) |
| 3 | Inline Python gh-JSON-parse | B-0028 (TS owed) |
| 4 | **Bash markdownlint+grep** | **B-0030 (TS owed; this row)** |

Four instances in one session is enough signal to *actually start the first sibling-migration*, not just queue more. The discipline is collapsing under repeated catches; the structural answer is the TS-tool that ships first and unblocks the rest.

## What this DOES NOT do

- Does NOT replace `markdownlint-cli2` — wraps it with repo-aware defaults
- Does NOT auto-run on every commit — invoked explicitly when needed
- Does NOT promise complete coverage of every lint scenario — only the recurring-use-case patterns

## Owed work cluster after this row

The post-install TS-migration batch:

- B-0015 batch-resolve-pr-threads.sh → TS (P2)
- B-0027 markdown-table-cell-count tool → TS (P3)
- B-0028 gh-pr-state-summary tool → TS (P3)
- B-0030 lint-with-exclusions tool → TS (P3, this row)
- Rewrites of #541, #542

Five-tool cluster. **First-migration unblock should happen now, not later** — the Otto-346 violations are accumulating proof that the queue is no longer queue but blocker.
