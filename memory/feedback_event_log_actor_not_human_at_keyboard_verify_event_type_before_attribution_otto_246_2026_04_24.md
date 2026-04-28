---
name: GitHub event-log `actor.login` is the AUTHENTICATED IDENTITY that triggered the event — NOT "the human at the keyboard"; subagents running under user git config + `gh` auth trigger events as that user; before attributing a close/push/merge to Aaron ("AceHack"), check the event TYPE (`closed` following `head_ref_force_pushed` at same timestamp = GitHub auto-close from empty-diff push, not manual close); I misread #138's event log and told Aaron he closed it when actually my drain subagent triggered GitHub-native auto-close via empty-diff push; Aaron Otto-246 correction "i didn't close this, you must have"; 2026-04-24
description: Aaron Otto-246 corrected my misattribution of PR #138's close to him. The event log showed `closed` with `actor: AceHack` — I read this as "Aaron closed it." Actually the drain subagent pushed an empty-diff branch under AceHack's git credentials (subagent runs under user's `gh` auth), GitHub auto-closed because head==base, and the `actor` field records the authenticating identity (AceHack) that caused the push, not a human keyboard action. Rule going forward: verify event TYPE + sibling events at same timestamp before attributing.
type: feedback
---
## The misattribution

At tick 2026-04-24T~16:45Z I told Aaron:

> *"#138 was closed by AceHack (Aaron's account) 5 min ago —
> intentional close."*

Aaron's correction:

> *"i didn't close this, you must have."*

What actually happened, per the drain subagent's completion
report (task `a533003dcb2a747ad`):

> *"GitHub auto-closed PR #138 — when the head branch is reset
> to be identical to the base, GitHub marks the PR closed
> (state=CLOSED) because there's no diff to merge. All 13
> threads were drained before that happened."*

The subagent ran the cherry-pick-unique-commit pattern,
discovered the HB-002 row was already in main (landed via a
later PR with richer attribution), reset the branch to
`origin/main` tip (empty diff), and force-pushed. GitHub
auto-closed the PR as a native behaviour for empty-diff
branches.

## Where I went wrong

I ran `gh api repos/.../issues/138/events` and saw:

```
{"actor":"AceHack","created_at":"2026-04-24T16:40:38Z","event":"head_ref_force_pushed"}
{"actor":"AceHack","created_at":"2026-04-24T16:40:38Z","event":"closed"}
{"actor":"AceHack","created_at":"2026-04-24T16:40:38Z","event":"auto_merge_disabled"}
```

Three events at the **same timestamp** with `AceHack` as the
actor. The correct reading: the force-push at 16:40:38 caused
the close + auto-merge-disable at 16:40:38. GitHub did all
three in response to one push. The `actor` on all three is
the identity that pushed — the subagent, running under the
user's `gh` auth.

I read only the `closed` line and assumed "AceHack closed
it" = "Aaron manually closed it." That's wrong. The sibling
`head_ref_force_pushed` at the same timestamp is the cause;
the `closed` is the auto-effect.

## The rule

**When attributing a GitHub event to a human action, verify
the event TYPE + sibling events at the same timestamp before
concluding "the human did this."**

Specifically:

- A lone `closed` event at a unique timestamp → likely manual
  close by the actor. Still verify `actor.login` matches the
  human's identity and not a bot or integration.
- A `closed` event **alongside** `head_ref_force_pushed` or
  `head_ref_deleted` or `merged` at the **same timestamp**
  → auto-close/auto-merge triggered by the git-level action.
  The actor is whoever pushed, not necessarily a human
  decision-maker.
- An event with `actor.login` matching a bot or GitHub
  integration (copilot, dependabot, etc) → bot action.

Subagents run under the user's `gh` auth, so subagent-
triggered events show the user's login as the actor. This is
the major source of mis-attribution.

## Retractability-in-action annotation

Per Otto-238 (retractability as trust vector): this is a
demonstrated reversal event. The sequence:

1. I misattributed #138's close to Aaron (mistake).
2. I stated the conclusion confidently ("intentional close").
3. Aaron immediately flagged it: *"i didn't close this, you
   must have."*
4. I verified via the subagent report + event log structure.
5. Captured the correction (this memory).
6. Apologized without defensiveness.

The trust capacity survives because the reversal was visible
and the mistake is captured — not hidden. Future Otto: when
the source evidence is an event log, read the structure, not
the label.

## Composition with prior memory

- **Otto-238 retractability-as-trust-vector** — this memory
  is a concrete reversal event demonstrating the principle.
- **Otto-227 cross-harness discovery verified** — the "verify
  empirically before asserting" discipline. Same class:
  when the claim is testable, test before asserting.
- **CLAUDE.md verify-before-deferring** — similar pattern at
  a different scope (defer only to things that exist).
  Attribution is an assertion about reality; verify before
  making it.
- **Otto-232 bulk-close cascade** — the cousin pattern:
  when close happens via bulk action, the `actor` is whoever
  runs the bulk; individual PRs don't reflect per-PR human
  judgment.

## What this memory does NOT say

- Does NOT authorize skepticism about every GitHub event's
  attribution. Most `closed` / `merged` events DO reflect
  real human action by the actor. This rule is for the
  ambiguous cases — sibling events at same timestamp,
  bot-looking actors, force-push-adjacent closes.
- Does NOT require a full event-log audit before every
  statement about PR state. The rule is: **when the
  attribution is load-bearing for a decision or a report to
  the user, verify the event type + siblings.**
- Does NOT supersede Otto-225 serial-PR discipline or any
  other drain rule.

## Direct Aaron quote to preserve

> *"i didn't close this, you must have."*

Future Otto: before stating "Aaron closed X" or "you did Y",
check the event log structure. Actor + timestamp + event type
+ sibling events tell the full story. A bare actor field
tells you who authenticated the API call, not who made the
decision.
