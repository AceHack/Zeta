---
pr_number: 4031
title: "memo(audit): in-repo rules cite user-scope-only memory files \u2014 5 dangling refs, cold-boot invisible"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T02:59:50Z"
merged_at: "2026-05-17T03:02:15Z"
closed_at: "2026-05-17T03:02:15Z"
head_ref: "memo/audit-rule-to-memory-refs-dangling-user-scope-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T03:47:04Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4031: memo(audit): in-repo rules cite user-scope-only memory files — 5 dangling refs, cold-boot invisible

## PR description

## Summary

Pure-git tier audit (zero GraphQL) found 5 in-repo `.claude/rules/*.md` files citing `memory/feedback_*.md` paths that exist only at user-scope (`~/.claude/projects/.../memory/`), not in-repo. Cold-boot agents on fresh checkouts (different machine, new contributor, CI agent without user-scope memory) follow these citations and find nothing.

**The 5 dangling refs**:

- `holding-without-named-dependency-is-standing-by-failure.md` → `feedback_classifier_caught_otto_in_standing_by_*_2026_05_15.md`
- `persistence-choice-architecture-for-zeta-ais.md` → `feedback_aaron_zeta_is_memory_preservation_specialist_first_*_2026_05_15.md`
- `codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` → `feedback_codeql_no_source_seen_*_2026_05_15.md`
- `shadow-star-shorthand-autocomplete-marker.md` → `feedback_aaron_shadow_star_shorthand_*_2026_05_15.md`
- `premise-flagged-unverified-stays-unverified-downstream.md` → `feedback_aaron_we_are_the_ones_cooking_it_youtube_*_2026_05_16.md`

**Two architectural options**:

- **A** — promote user-scope memos to in-repo (constitutional memos warrant this; cost varies by size + PII)
- **B** — citation-form disclosure ("user-scope only; see CURRENT-aaron.md for projection") (cheaper, honest about two-tier architecture)

Recommendation: **B for most + A for constitutional**. Not P0 — Aaron's Otto-CLI continues correct via auto-load. Drift is in cold-boot fallback path only.

Substrate-honest pre-empt at brief-ack #4 per the empirical anchor in `holding-without-named-dependency-is-standing-by-failure.md`.

## Test plan

- [x] `git ls-remote origin memo/audit-rule-to-memory-refs-... → 173e666c...`
- [x] Local audit confirmed 5 USER-SCOPE-ONLY refs via `ls $HOME/.claude/projects/.../memory/`
- [ ] CodeQL pass on docs-only PR

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T03:03:25Z)

## Pull request overview

Adds a new memory entry capturing an Otto-CLI audit finding that several in-repo `.claude/rules/*.md` documents cite `memory/feedback_*.md` paths that only exist in user-scope memory, making those citations non-resolving for cold-boot agents on fresh checkouts.

**Changes:**

- Adds a new `memory/feedback_*.md` file documenting the 5 dangling rule→memory references and their cold-boot impact.
- Records proposed remediation options (promote memos in-repo vs citation-form disclosure) and a repeatable grep-based audit method.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md:27**

* P1: This hard-codes a specific user-scope directory (with a local username) into a repo-committed memory. Replace with a generic `$HOME/.claude/projects/<x>/memory/`-style path so the audit instructions are reproducible on other machines.
```

All 5 verified as `USER-SCOPE-ONLY` by an `ls` check against `$HOME/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`.

```
**memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md:60**

* P1: In the suggested audit script, `USER_MEM` is set to a workstation-specific path segment (`-Users-acehack-...`). Use a portable placeholder like `$HOME/.claude/projects/<project>/memory` (or `~/.claude/projects/<x>/memory`) so the snippet can be copy/pasted by contributors and CI agents.
```
# Verify each at user-scope:
USER_MEM="$HOME/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory"
for f in <list-of-dangling-files>; do
  [ -f "$USER_MEM/$f" ] && echo "USER-SCOPE-ONLY: $f" || echo "NOT-FOUND-EITHER: $f"
done
```
</details>

## Review threads

### Thread 1: memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md:4 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T03:03:24Z):

P0: Frontmatter `type:` does not match the filename prefix. This file is named `feedback_...` so `type:` must be `feedback` (enforced as an error by the memory schema validator).

### Thread 2: memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md:14 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T03:03:24Z):

P0: The memory schema validator requires literal body markers `Why:` and `How to apply:`. The current formatting uses `**Why**:` / `**How to apply**:` (colon outside the bold), which does not contain those substrings and will be flagged as missing required sections. Put the colon inside the bold (e.g., `**Why:**`) or add plain `Why:` / `How to apply:` markers.

### Thread 3: memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md:12 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T03:03:25Z):

P1: This embeds a machine-specific user-scope path (includes a local username and workstation directory slug). For portability and privacy, prefer the generic form already used elsewhere (`~/.claude/projects/<x>/memory/`) or `$HOME/.claude/projects/<project>/memory/` rather than a concrete `-Users-...` path.

This issue also appears in the following locations of the same file:

- line 25
- line 56

### Thread 4: memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md:52 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T03:03:25Z):

P2: The audit snippet uses `while read f; do ...` without `-r` / `IFS=`. Using `while IFS= read -r f` avoids accidental backslash-escape handling and is the safer pattern for shell snippets that read arbitrary paths.

### Thread 5: memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md:63 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T03:03:25Z):

P2: This sentence is internally inconsistent/unclear: "took ~3 GraphQL (zero — pure local grep)" reads like both 3 and 0 GraphQL calls. Reword to something unambiguous (e.g., explicitly "0 GraphQL calls" / "pure-git" only).
