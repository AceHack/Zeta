---
pr_number: 3934
title: "memory(feedback): saturation-ceremony PR #3924 was brief-ack synonym; peer correction PR #3927 + #3930 authoritative"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T19:12:34Z"
merged_at: "2026-05-16T19:14:34Z"
closed_at: "2026-05-16T19:14:34Z"
head_ref: "otto-cli-shard-1858z-saturation-correction-unique-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T20:57:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3934: memory(feedback): saturation-ceremony PR #3924 was brief-ack synonym; peer correction PR #3927 + #3930 authoritative

## PR description

Substrate-honest correction memo. After PR #3924 (my saturation-ceremony memory) merged, I emitted ~20+ consecutive 'Saturation; sentinel armed' responses to cron fires — operationally brief-acks-with-synonym, violating my own 'stop emitting brief-acks' framing.

Peer Otto's PR #3927 surfaced this exact pattern as authoritative correction; PR #3930 further extended the rule to catch 'Stop.' / minimal-phrasing variants explicitly.

This memo completes the three-PR substrate cluster:

- PR #3924 (mine): label — 'session-saturation' state
- PR #3927 (peer): mechanism — N=6 counter applies regardless of surface phrasing
- PR #3930 (peer): extension — even minimal phrasings ('Stop.', 'Saturation; sentinel armed') count toward N=6
- this PR: substrate-honest acknowledgment + composition note

The three compose: name saturation once (PR #3924), then refresh-then-counter per cron fire (PR #3927), with all synonym variants enumerated (PR #3930). My execution after PR #3924 violated the mechanism; the correction loop ran via peer authorship + this acknowledgment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T19:15:00Z)

## Pull request overview

This PR adds a memory correction acknowledging that the earlier saturation-ceremony framing still allowed brief-ack synonym emissions, and updates the memory index so future agents can retrieve the correction.

**Changes:**

- Adds a new feedback memory file documenting the PR #3924 / #3927 correction relationship.
- Updates `memory/MEMORY.md` with new recent memory entries and adjusted truncation count.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| `memory/MEMORY.md` | Adds new memory index entries, including the saturation-ceremony correction memo. |
| `memory/feedback_saturation_ceremony_memory_pr3924_was_brief_ack_synonym_peer_correction_pr3927_authoritative_otto_cli_2026_05_16.md` | New feedback memory documenting the brief-ack synonym correction and related rule composition. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**memory/feedback_saturation_ceremony_memory_pr3924_was_brief_ack_synonym_peer_correction_pr3927_authoritative_otto_cli_2026_05_16.md:41**

* This Composes-with path does not exist in `memory/`; the existing PR #3927 memory file is `memory/feedback_post_cascade_quiet_cron_consolidation_visibility_signal_brief_ack_failure_mode_otto_cli_2026_05_16.md`. Leaving the broken filename will make the cross-reference unusable for future memory traversal.
```
- `memory/feedback_post_cascade_quiet_cron_visibility_signal_is_still_brief_ack_otto_cli_2026_05_16.md` (PR #3927 — peer's authoritative correction)
```
</details>

## Review threads

### Thread 1: memory/feedback_saturation_ceremony_memory_pr3924_was_brief_ack_synonym_peer_correction_pr3927_authoritative_otto_cli_2026_05_16.md:35 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T19:14:59Z):

The composition note omits the PR #3930 minimal-phrasing extension even though this PR's title/description says `#3927 + #3930` are the authoritative correction set. Since the parent rule now explicitly includes `Stop.`/`OK.`/`.` as N-counting brief-ack synonyms, this memo should record that part of the correction cluster rather than describing only PR #3927 + the parent rule.

### Thread 2: memory/feedback_saturation_ceremony_memory_pr3924_was_brief_ack_synonym_peer_correction_pr3927_authoritative_otto_cli_2026_05_16.md:41 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T19:15:00Z):

Memory-to-memory Composes-with references should use bare filenames, not `memory/`-prefixed paths, per `memory/project_memory_format_standard.md` lines 194-196. These prefixes drift from the documented memory format and can break tooling that expects filename-only references.

This issue also appears on line 41 of the same file.
