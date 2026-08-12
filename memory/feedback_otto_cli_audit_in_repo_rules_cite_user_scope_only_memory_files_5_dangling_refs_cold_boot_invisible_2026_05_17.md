---
name: in-repo-rules-cite-user-scope-only-memory-files-cold-boot-invisible
description: 5 in-repo .claude/rules files cite memory/feedback_*.md paths that exist only at user-scope (~/.claude/projects/.../memory/), not in-repo — invisible to cold-boot agents on fresh checkouts. Substrate-architecture finding from an Otto-CLI pure-git tier audit 2026-05-17T02:44Z.
type: project
created: 2026-05-17
---

# In-repo rules cite user-scope-only memory files — 5 dangling refs invisible to cold-boot

**Fact**: 5 `.claude/rules/*.md` rule files cite memory files via in-repo path form `memory/feedback_<name>.md`, but those memory files live only at user-scope (`~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`), not in-repo.

**Why**: Aaron's Otto-CLI session auto-loads the user-scope `MEMORY.md` index (per CLAUDE.md "On-demand: ~/.claude/projects/<x>/memory/MEMORY.md — First 200 lines / 25KB at session start") so the citations resolve transparently from Aaron's machine. A cold-boot agent on a fresh checkout (different machine, new Zeta contributor cloning the repo, a CI-launched agent without user-scope memory) follows the `memory/feedback_*.md` path and finds nothing.

**How to apply**: when an in-repo rule cites a memory file via `memory/feedback_*.md`, EITHER (a) ensure the memory file lives in-repo at that path, OR (b) explicitly disclose at the citation site that the file is at user-scope and the cold-boot fallback is to read the relevant CURRENT-*.md file or the rule's own Full-reasoning section.

## The 5 dangling refs (snapshot 2026-05-17T02:44Z)

| Rule citing it | Memory file (user-scope only) |
|---|---|
| `holding-without-named-dependency-is-standing-by-failure.md` | `feedback_classifier_caught_otto_in_standing_by_failure_mode_80_consecutive_heartbeat_polls_no_work_violated_own_rule_2026_05_15.md` |
| `persistence-choice-architecture-for-zeta-ais.md` | `feedback_aaron_zeta_is_memory_preservation_specialist_first_everything_else_second_ephemeral_or_maxed_out_chat_agents_2026_05_15.md` (also cited by other rules) |
| `codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` | `feedback_codeql_no_source_seen_on_docs_only_pr_is_broken_commit_canary_not_flake_lior_lock_cleanup_race_2026_05_15.md` |
| `shadow-star-shorthand-autocomplete-marker.md` | `feedback_aaron_shadow_star_shorthand_means_autocomplete_generated_not_aaron_authored_grey_text_completed_2026_05_15.md` |
| `premise-flagged-unverified-stays-unverified-downstream.md` | `feedback_aaron_we_are_the_ones_cooking_it_youtube_finance_ai_video_substrate_validation_fsharp_fork_for_ai_safety_90_percent_python_type_failures_64_beats_75_with_type_poisoning_2026_05_16.md` |

All 5 verified as `USER-SCOPE-ONLY` by an `ls` check against `$HOME/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`.

## Two architectural options

### Option A — promote user-scope memos to in-repo

For each dangling ref, copy the memory file from user-scope to in-repo `memory/` and commit. This is the substrate-honest "land it durably" path. Cost: 5 file landings; each user-scope memo could be large (the 2026-05-16 user-scope memos include some 350KB+ files per other indications). Some may carry PII or session-specific text that doesn't belong in-repo without redaction.

### Option B — citation-form disclosure

Update the citing rules to mark user-scope memos explicitly, e.g.:

> Full reasoning: `memory/feedback_*.md` (user-scope only; see `CURRENT-aaron.md` in-repo for the projection)

This preserves the existing arrangement (user-scope is the live working surface; in-repo `memory/` is the durable subset) while making the citation discoverable for cold-boot agents.

### Recommendation (substrate-honest)

**Option B for the majority + Option A for high-importance memos.** Citation-form disclosure is the cheaper change and is honest about the two-tier memory architecture already documented in CLAUDE.md. Option A applies when the memo is constitutional / load-bearing across maintainer machines (e.g., the "Zeta IS memory preservation specialist first" memo IS load-bearing for all Zeta AIs and probably belongs in-repo).

Either way, this is not a P0 — Aaron's Otto-CLI continues to operate correctly because user-scope auto-loads. The drift is in the cold-boot-fallback path for agents not on Aaron's machine.

## Audit method (cheap, repeatable)

```bash
# From repo root, find dangling rule→memory refs:
grep -hoE 'memory/feedback_[a-zA-Z0-9_-]+\.md' .claude/rules/*.md | sort -u | while read f; do
  [ ! -f "$f" ] && echo "DANGLING: $f"
done

# Verify each at user-scope:
USER_MEM="$HOME/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory"
for f in <list-of-dangling-files>; do
  [ -f "$USER_MEM/$f" ] && echo "USER-SCOPE-ONLY: $f" || echo "NOT-FOUND-EITHER: $f"
done
```

This audit took ~3 GraphQL (zero — pure local grep), so it composes cleanly with the extreme cost-aware tier discipline and is a good periodic-cadence hygiene check.

## Composes with

- `.claude/rules/wake-time-substrate.md` <!-- STALE-REF: ../.claude/rules/wake-time-substrate.md --> — load-bearing learnings need durable substrate; user-scope IS durable for Aaron's machine, NOT for cold-boot agents on fresh checkouts
- `.claude/rules/substrate-or-it-didnt-happen.md` <!-- STALE-REF: ../.claude/rules/substrate-or-it-didnt-happen.md --> — vocabulary discipline: user-scope memo is *preserved* (durable + indexed for Aaron) but NOT *canonical* (in-repo accessible by all)
- `.claude/rules/verify-before-deferring.md` <!-- STALE-REF: ../.claude/rules/verify-before-deferring.md --> — same shape applied to memory refs: an in-repo rule citing a path is making a discoverability claim
- CLAUDE.md memory fast-path section — names the two-tier (user-scope vs in-repo) architecture; this finding is an audit of that architecture's cold-boot drift
- The audit emerged from extreme cost-aware tier pre-empt-at-#4 (per `holding-without-named-dependency-is-standing-by-failure.md`) — pure-git substrate-hygiene check IS the substrate-honest pre-empt content
