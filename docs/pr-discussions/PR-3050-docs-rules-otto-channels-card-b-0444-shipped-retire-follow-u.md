---
pr_number: 3050
title: "docs(rules): otto-channels card \u2014 081KRFA460008QG0R001SXP0C2 shipped, retire \"follow-up gap\" framing"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T22:49:39Z"
merged_at: "2026-05-13T22:52:00Z"
closed_at: "2026-05-13T22:52:00Z"
head_ref: "fix/otto-channels-card-b0444-shipped-2026-05-13"
base_ref: "main"
archived_at: "2026-05-13T22:57:59Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3050: docs(rules): otto-channels card — 081KRFA460008QG0R001SXP0C2 shipped, retire "follow-up gap" framing

## PR description

## Summary

The [`otto-channels-reference-card.md`](.claude/rules/otto-channels-reference-card.md) listed 081KRFA460008QG0R001SXP0C2 (bus claim envelope worktree field) as a "follow-up gap" in its Composes-with section. PR [#3043](https://github.com/Lucent-Financial-Group/Zeta/pull/3043) shipped that feature 2026-05-13 (merged as `5db892d`).

Updated to reference the merged PR rather than the row's open-state framing.

## Composes with

Sibling staleness cleanup to [#3048](https://github.com/Lucent-Financial-Group/Zeta/pull/3048) (Rule 0 legacy-violations update). Together they close the rule-callout staleness surfaced by this session's substrate-hygiene sweep ([#3043](https://github.com/Lucent-Financial-Group/Zeta/pull/3043), [#3044](https://github.com/Lucent-Financial-Group/Zeta/pull/3044), [#3045](https://github.com/Lucent-Financial-Group/Zeta/pull/3045), [#3047](https://github.com/Lucent-Financial-Group/Zeta/pull/3047)).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T22:53:15Z)

## Pull request overview

This docs-only PR updates the Otto channels reference card to treat 081KRFA460008QG0R001SXP0C2/PR #3043 as merged work rather than an outstanding follow-up gap.

**Changes:**

- Marks PR #3037 as merged in the “Composes with” list.
- Replaces the 081KRFA460008QG0R001SXP0C2 follow-up-gap reference with PR #3043 merged on 2026-05-13.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**.claude/rules/otto-channels-reference-card.md:82**

* This bare `081KRFA460008QG0R001SXP0C2` reference is ambiguous because the generated backlog currently contains two open rows with `id: 081KRFA460008QG0R001SXP0C2` (the P1 getting-started guide and the P2 bus-claim-envelope row), even though the backlog schema says IDs are factory-wide unique. The previous wording included `P2`; keep that disambiguation or link the exact row until the duplicate ID is resolved.
```
- PR #3043 (081KRFA460008QG0R001SXP0C2 bus claim envelope worktree field, merged 2026-05-13)
```
**.claude/rules/otto-channels-reference-card.md:82**

* The reference card now treats 081KRFA460008QG0R001SXP0C2 as shipped, but the canonical P2 backlog row for the bus claim envelope still has `status: open` and unchecked acceptance criteria, so `docs/BACKLOG.md` continues to show this work as outstanding. If PR #3043 closed this gap, update/close that row in the same cleanup or avoid framing the backlog item itself as retired here.
```
- PR #3043 (081KRFA460008QG0R001SXP0C2 bus claim envelope worktree field, merged 2026-05-13)
```
</details>

## Review threads

### Thread 1: .claude/rules/otto-channels-reference-card.md:81 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-13T22:53:15Z):

This creates an internal contradiction in the same card: this line now says PR #3037 is merged, but the operational-discipline note earlier still says “until SENDER_IDS schema extension lands per PR #3037” and describes the pre-merge behavior. Update that note as part of this staleness cleanup so readers do not follow obsolete claim-coordinator guidance.

This issue also appears in the following locations of the same file:

- line 82
- line 82
