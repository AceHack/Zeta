---
name: Elizabeth-canonical-spelling overrides §33 history-preservation for sister-name (Aaron 2026-04-28)
description: Aaron 2026-04-28T18:42Z carve-out — when GOVERNANCE.md §33 history-surface verbatim-preservation discipline collides with the canonical spelling of Aaron's sister Elizabeth Ryan Stainback, the canonical spelling wins. Reason: my recurring confusion when reading "older spelling" as her name (despite Aaron's prior corrections) costs more than the §33 verbatim-preservation gains. Future-Otto sees "older-spelling" anywhere in the repo (including history surfaces like docs/hygiene-history/loop-tick-history.md) → fix to "Elizabeth" / "elizabeth". The exception is name-specific and does not generalize.
type: feedback
---

# Elizabeth-canonical-spelling overrides §33 history-preservation

## The rule (Aaron verbatim 2026-04-28T18:42Z)

> *"elisabeth this one causes you a lot of confusion, you keep thinkin
> her name is that, maybe we should make an exception here
> elisabeth -> elizabth"*

> **Meta-marker**: this verbatim quote contains the ONE permitted set
> of older-spelling tokens in this file. They are preserved per the
> signal-in-signal-out DSP discipline (verbatim quotes carry Aaron's
> original framing; sanitizing them loses signal). The rule the quote
> establishes — replace older-spelling tokens repo-wide — applies to
> all OTHER occurrences. The apparent self-reference (a rule about
> word X must reference X to define X) is a known meta-class of
> substrate-policy that resolves via this marker pattern.

## What this overrides

GOVERNANCE.md §33 establishes history-surface preservation:
historical narrative belongs in `docs/ROUND-HISTORY.md`,
`docs/hygiene-history/loop-tick-history.md`, ADRs under
`docs/DECISIONS/`, and similar surfaces. The discipline says
those surfaces preserve original wording even when later
corrected, so the time-travel-back-to-row-as-written invariant
holds.

## What the exception is

The sister-name spelling. Aaron has corrected my "older spelling"
misreading multiple times (00:42Z + 18:14Z + 18:42Z within the
same 2026-04-28 session). Each time I see "older spelling" in any
substrate I read, my model pattern-matches it as her canonical
name and re-introduces the misspelling somewhere else. This is
a recurring confusion source.

Aaron's carve-out: for THIS specific name, the §33 verbatim-
preservation yields. Replace every "older spelling" / "older-spelling"
with "Elizabeth" / "elizabeth" repo-wide, including history
surfaces, including in-prose tick-history rows, including
backtick-wrapped file-path references that describe pre-rename
filenames.

## What this exception does NOT do

- **Does not generalize.** §33 still applies to every other
  history-surface preservation case. This is a name-specific
  carve-out, motivated specifically by the agent-confusion
  cost.
- **Does not erase the rename history.** The fact that files
  were renamed `_the older-spelling_*` → `_elizabeth_*` is preserved
  in commit messages and git log. Updating in-prose mentions
  in tick-history doesn't lose that lineage.
- **Does not apply to other people's names.** This is for
  Elizabeth Ryan Stainback specifically.

## The discipline going forward

Whenever Otto encounters "older-spelling" (case-insensitive) in any
file in the repo (memory/, docs/, .claude/, src/, tools/,
anywhere), the right action is **replace with "elizabeth"**
preserving capitalization (the older spelling → Elizabeth, lowercase →
lowercase).

The §33 history-surface argument is **explicitly waived for
this specific token**.

## Why it matters

The recurring-confusion cost compounds: every time Otto reads
"older spelling" in a history surface, the wrong-spelling activates
in working memory, and Otto then re-introduces the misspelling
in NEW substrate (commit messages, new memory entries, prose
fixes). The fix loops back: Aaron corrects, Otto fixes, then
the next time Otto reads tick-history he re-confuses, etc.

Aaron's carve-out breaks the loop: by removing the source of
the confusion (the lingering "older-spelling" tokens in already-
landed substrate), Otto stops being primed by them.

## Composes with

- `feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`
  — discipline 1 (history preservation): the §33 invariant is
  generally load-bearing. This memory documents the ONE
  specific carve-out where it yields.
- `memory/user_sister_elizabeth.md` — the canonical disclosure
  of her full name (Elizabeth Ryan Stainback).
- `memory/feedback_trust_guarded_with_elizabeth_vigilance.md`
  — trust-scales binding.
- The PR-#658-supersede-by-#676 audit (in PR #658 close
  comment) treated §33 as binding for the 2 tick-history
  matches; THIS memory + the same-tick PR override that
  reading. The supersede was correct on PR #658's content
  (it was destructive); the §33 reasoning in the close
  comment is now superseded BY this carve-out.
