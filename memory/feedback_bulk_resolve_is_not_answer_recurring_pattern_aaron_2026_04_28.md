---
name: Bulk-resolve is not the same as answer — recurring failure pattern under volume pressure
description: When faced with many review threads at once, the temptation is to batch-resolve with templated "acknowledged + deferred to follow-up phase" replies. That FORM looks like answers but is NOT. A real answer is either (a) a substantive code/doc fix that resolves the technical concern, OR (b) a deferral with concrete tracking (per-row backlog file, ADR, follow-up issue). A deferral note in a closed thread is NOT tracking — it scatters the concern into recoverable-but-untracked review history. Aaron 2026-04-28 caught me doing this on PR #72 (45 threads — ~20 had substantive fixes, ~25 had deferral notes with NO concrete tracking until pushback). Aaron 2026-04-28 explicit: *"bulk-resolve what is buld resolve does it actually answer the questions? or does it just close them? have they been answered?"* + *"you've made this mistake before"*. The structural fix is: when bulk-resolving, EVERY deferral that doesn't have a concrete tracking destination requires a per-row backlog file BEFORE the thread closes. Composes with Otto-275-FOREVER (knowing-rule != applying-rule) + structural-fix-beats-process-discipline (closing threads is process; concrete tracking is structural).
type: feedback
---

# Bulk-resolve is not the same as answer

**Rule:** when bulk-resolving review threads, every closure
must fall into one of three categories:

1. **Substantive answer** — code or doc fix landed in a
   commit that addresses the technical concern. Reviewer
   reads the commit and the answer is there.
2. **Already-addressed-in-current-text** — the concern was
   already addressed by a prior commit that the reviewer
   may not have seen. Closure cites the verifying observation
   ("current text says X; reviewer's suggestion is X; already
   in form").
3. **Deferral with concrete tracking** — the concern is
   real but out-of-scope for this PR. Closure cites a
   newly-filed per-row backlog file / ADR / follow-up issue
   by ID. Tracking destination must exist BEFORE the thread
   closes.

**The forbidden fourth category** that this rule guards
against: deferral with note BUT no concrete tracking
destination. The reply text says "filing under v0 build-out
phase" but no backlog row, ADR, or issue is actually filed.
The closed thread becomes the only place the concern lives.
Future-self looking at the open backlog won't find it; only
a deep PR-thread archeology pass would surface it.

**Why** (Aaron 2026-04-28):

> *"bulk-resolve what is buld resolve does it actually
> answer the questions? or does it just close them? have
> they been answered?"*

> *"you've made this mistake before"*

Recurring pattern signature:

- Trigger: many threads at once (#72 had 45)
- Failure mode: under volume pressure, the templated
  "deferral note + close" shortcut feels efficient
- Form: ~50% of closures land as form-3 deferrals with no
  tracking destination
- Effect: looks-like-answered, isn't-actually-answered;
  reviewer's substantive concerns get lost in closed-thread
  archeology

**How to apply:**

1. **Inventory pass** — before any reply-and-resolve loop,
   categorise each thread into the three valid forms above
   PLUS the forbidden fourth.
2. **Forbidden fourth → upgrade to form 3** — for every
   thread that would otherwise close as "deferred with
   note," file a concrete tracking destination FIRST. Each
   tracking destination can aggregate multiple threads if
   they're in the same theme (e.g., wallet v0 build-out
   spec-logic punch list with 21 items aggregating 15
   review threads).
3. **Reply citation discipline** — every form-3 closure
   reply MUST cite the tracking destination by file path
   or issue number. "Filing under <PR/issue>" is acceptable;
   "filing under the v0 build-out phase" is NOT
   (no destination named).
4. **No bulk-resolve without inventory** — if the inventory
   wasn't done, don't run the bulk-resolve script. The
   inventory pass is the discipline.

**Diagnostic tell:** if a reply contains the phrase
"deferred to <phase>" or "filing under <vague-bucket>"
without a concrete file path / row ID / issue number, that
IS the failure mode. Reframe before commit.

**Concrete proof-of-failure:** PR #72 2026-04-28. Of 45
review threads bulk-resolved:

- ~20 were form 1 (substantive fix)
- ~5 were form 2 (already-addressed)
- ~5 were form 3 PR-metadata fixes (PR body refresh)
- ~15 were form 4 (deferral with note, NO tracking) until
  Aaron's pushback prompted the structural fix:
  `docs/backlog/P0/B-0062-wallet-v0-build-out-spec-logic-
  punch-list-from-pr-72-deferrals.md` aggregating all 15
  into a 21-item concrete punch list.

**Composes with:**

- `feedback_otto_275_forever_*` (knowing-rule != applying-
  rule) — bulk-resolve under pressure is the failure mode
  for the "every deferral needs tracking" rule.
- `feedback_structural_fix_beats_process_discipline_*`
  (Aaron 2026-04-28) — closing threads is process; concrete
  tracking is structural. Land structural first.
- `feedback_aaron_terse_directives_high_leverage_*` —
  Aaron's two short messages here ("does it actually
  answer?" + "you've made this mistake before") are
  high-leverage; treat as such.

**Does NOT mean:**

- Does NOT mean every thread needs a code fix. Form 2
  (already-addressed) and form 3 (concrete tracking) are
  legitimate.
- Does NOT mean defer-with-tracking is a shortcut. The
  tracking destination must be SUBSTANTIVE — a real per-row
  backlog file with done-criteria, not just a placeholder
  TODO.
- Does NOT mean don't bulk-resolve. Bulk-resolve is fine
  when each closure has been categorised and the form-4
  failure mode has been caught.
