---
name: PR-review meta-classes — pre-push discipline + sibling-pattern audit + comment-claim verification + exit-code orthogonality + failure-DX + strong-typing
description: Five meta-classes extracted from the #1412/#1413 review cycle, plus Aaron's strong-typing guidance, that prevent recurring review-thread classes if applied at author-time. Aaron 2026-05-03 explicit ask: *"any classes to learn to code better next time via meta learning at PR?"*.
type: feedback
---

**Rule:** Six author-time disciplines that, if applied before push,
prevent the recurring review-thread classes observed across
multiple PRs this session. Capture lesson at the meta-PR-review
layer (per Aaron 2026-05-03 *"any classes to learn to code better
next time via meta learning at PR?"*).

## The six meta-classes

### 1. Pre-push lint discipline (`bun tsc --noEmit` + CodeQL)

**The bug class:** unused imports / typing errors / regex injection
land in the PR and get caught by CI on first run, costing a review
round-trip.

**The discipline:** run local lint before `git push`. At minimum:

```
bun tsc --noEmit              # catches unused imports + typing
# (CodeQL is GitHub-side; can't easily run locally, but
# regex-injection patterns can be self-audited via grep before push)
```

**Triggering case (this session):** #1412 + #1413 both had unused
imports caught by `lint (tsc tools)`. The CodeQL injection finding
on #1412 was a real P0 (regex-built-from-input).

### 2. Sibling-pattern audit before authoring

**The bug class:** porting code (e.g., F# → TS) without reading the
source pattern, then introducing a different (worse) shape.

**The discipline:** when porting, READ the source first. Note the
patterns it uses (PATH-scan, exit codes, error handling), then
match unless you have a reason to differ. Document any divergence
as an explicit improvement.

**Triggering case:** #1412 introduced `/usr/bin/env which` shell-out
when the F# `Tlc.Runner.Tests.fs` already used in-process PATH-scan.
Reviewer flagged the regression. The F# pattern was correct; the TS
port should have inherited it.

### 3. Verify-then-claim applied to comments

**The bug class:** a comment says "X matches Y" but doesn't —
documentation drifts from implementation.

**The discipline:** before pushing a comment that asserts a
relationship between artifacts, grep the related artifact to
confirm.

**Triggering case:** #1412 CATALOGUE comment said "matches F#
`Tlc.Runner.Tests.fs` registration" but at PR-creation snapshot,
F# didn't yet have `SpineAsyncProtocol`. The comment was stale by
one merge. Same discipline as the existing
`feedback_chat_is_assertion_channel_not_fact_channel_*` rule
applied to comment claims.

### 4. Exit-code orthogonality

**The bug class:** one exit code carries multiple semantics; CI /
callers can't distinguish failure modes.

**The discipline:** document the exit-code contract FIRST in the
header doc (one code = one semantic). Make the code match. Use
strong union types to enforce.

**Triggering case:** #1412 used exit 2 for both "toolchain not
ready" AND "unknown flag". Reviewer P0 finding. Fix: split into
2 (toolchain) + 3 (usage) with `ExitCode = 0 | 1 | 2 | 3` union
type.

### 5. DX-think on failure paths

**The bug class:** failure output isn't actionable; CI consumer or
dev has to re-invoke with different args to triage.

**The discipline:** failure UX is part of the contract. Print
enough context for the consumer to act:

- Which spec / file / step failed
- Tail of stdout/stderr (last N lines)
- Rerun command (e.g., `rerun with: bun ... <SpecName>`)

**Triggering case:** #1412 `--all` mode logged "FAIL: SpineX (exit
11)" but no stdout. CI triage required re-invoking with `--one`.
Fix: print last 30 lines of stdout per failure + stderr-tail.

### 6. Strong typing as assumption-verifier (Aaron 2026-05-03)

**Aaron's framing:** *"we want to be strongly typed to a large
degree in ts it verifies your assumptions more at lint time if
you doo."*

**The discipline:** prefer TypeScript union types over loose
`number` / `string`. Brand types where invariants matter. Default
to read-only / `readonly`. Avoid sentinel values (-1, "")
when union types can encode the failure case.

**Triggering case:** #1412 used `result.status ?? -1` (sentinel).
Better: model the absence as a union (`number | null`). Same for
spec-name validation — a branded "validated spec name" type would
have prevented the regex-injection class entirely (the type system
forces escaping at the boundary).

## Composes with

- `feedback_chat_is_assertion_channel_not_fact_channel_push_back_for_evidence_aaron_2026_05_03.md`
  — meta-class #3 is that rule applied to comments
- `feedback_actions_cache_paths_mutually_exclusive_with_git_ls_files_silent_clobber_class_aaron_2026_05_03.md`
  — meta-class #5 (DX-think) parallels the audit-with-self-
  diagnosing-output discipline from the cache-paths audit
- `verify-then-claim` discipline (the broader cluster these all
  serve)
- The .ts/.sh parity bug found in `generate-index.ts` (sibling-
  pattern audit would have caught the .ts adding a stray blank line
  the .sh didn't)

## Future-Otto reference

Before push, run:

1. `bun tsc --noEmit` (catches typing + unused imports)
2. Read related sibling files (F# version when porting; existing
   workflow when adding new one; etc.)
3. Grep for any "X matches Y" claims you wrote — verify
4. Document exit-code contract before writing the exit logic
5. Walk failure paths — does the output let CI / dev triage?
6. Type as tightly as the language allows (unions over numbers;
   branded types over strings; `readonly` over mutable)

## Reasoning lineage

Aaron 2026-05-03 ask: *"any classes to learn to code better next
time via meta learning at PR?"* — surfaced after the substantial
review feedback on #1412. Five lessons extracted from this
session's review-thread cycles + Aaron's strong-typing direction
documented as the sixth.

The carved sentence: *"Apply the review feedback at author-time
next time. Each review thread that closes is a meta-class to
internalize, not just a fix to land."*
