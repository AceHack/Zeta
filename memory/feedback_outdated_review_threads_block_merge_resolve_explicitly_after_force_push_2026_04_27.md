---
name: Outdated review threads block merge under `required_conversation_resolution`; force-push does NOT auto-resolve outdated threads — must resolve explicitly via GraphQL after every force-push round (operational lesson 2026-04-27)
description: Operational substrate lesson learned 2026-04-27 — three PRs (#57 #59 #62) sat BLOCKED for 90+ minutes despite all CI green, no failures, MERGEABLE, auto-merge armed, and zero unresolved-AND-current-revision threads. Root cause: GitHub `required_conversation_resolution` branch protection rule blocks merge on ANY unresolved thread, even threads marked `outdated=true`. Force-pushing a fix to address a thread does NOT auto-resolve the thread; it just marks the thread as outdated. The thread remains in `unresolved` state until explicitly resolved via GraphQL `resolveReviewThread` mutation. Refines Otto-355 (BLOCKED-with-green-CI investigate review threads first): the investigation must include outdated threads, not just current-revision threads. Composes with Otto-250 (PR reviews are training signals) — outdated threads still carry signal even after the underlying issue is fixed.
type: feedback
---

# Outdated review threads block merge — operational lesson

## Class name (Amara 2026-04-28T20:06Z)

**Outdated Review-Thread Merge Gate Residue** — Amara
formalized this pattern after seeing it pay out concretely on
PR #684 (chronological-order Copilot thread that remained
unresolved after the canonical-sort fix landed in commit
3d3ca6f).

### Definition

> A PR remains blocked because an unresolved review thread
> describes pre-fix state, even though the corrective commit
> has already landed.

### Control (Amara prescribed shape)

When you see this pattern, **reply with**:

- what changed
- fixing commit SHA
- why the thread is now outdated
- then resolve explicitly (GraphQL `resolveReviewThread`
  mutation, or "Resolve conversation" in the GH UI)

This preserves the review trace (the original objection
remains visible in the thread history) while unblocking the
merge gate. The reply IS the evidence; the resolve IS the
gate clearance.

### Composes with the counterweight taxonomy

- **Cheap prevention**: lint hook catches the issue before the
  thread is filed (e.g. `lint (tick-history order)` for
  Chronological Insertion Polarity Error).
- **Cadenced detect+repair**: when prevention misses, fix lands
  on a force-push; the new corrective commit IS the repair.
- **Defense-in-depth**: this class — the outdated-thread
  resolution discipline catches the merge-gate residue that
  remains AFTER prevention + cadenced repair both did their
  jobs.

The class earns its keep by closing the third layer of the
counterweight stack. Without it, prevention + repair both
succeed but the PR still fails to merge.

## The pattern

PR state showing as stuck:

- All CI checks SUCCESS
- No failures, no in-progress
- `mergeable: MERGEABLE`
- Auto-merge armed
- `reviewDecision: ""` (no required reviews)
- Zero unresolved threads when filtered by `isOutdated == false`
- But `mergeStateStatus: BLOCKED`
- Drift unchanged for 90+ minutes

## Root cause

GitHub `required_conversation_resolution: true` (set in branch protection) requires ALL conversations to be resolved before merge. "All" includes threads marked `outdated=true`.

Force-pushing a fix that addresses a thread MARKS the thread as outdated but does NOT resolve it. The thread remains `isResolved: false` until explicitly resolved.

**Diagnostic query** (catches the failure mode):

```graphql
query {
  repository(owner: "...", name: "...") {
    pullRequest(number: NN) {
      reviewThreads(first: 50) {
        nodes { isResolved isOutdated path }
      }
    }
  }
}
```

Filter for `isResolved == false` (regardless of `isOutdated`). All such threads block merge under `required_conversation_resolution`.

## Resolution mechanism

**For each unresolved thread (current OR outdated):**

```graphql
mutation {
  resolveReviewThread(input: {threadId: "<thread_id>"}) {
    thread { isResolved }
  }
}
```

This explicitly resolves the thread regardless of its outdated status.

**Bash one-liner** (per PR):

```bash
gh api graphql -f query="query { repository(owner: \"AceHack\", name: \"Zeta\") { pullRequest(number: $PR) { reviewThreads(first: 50) { nodes { id isResolved } } } } }" \
  | jq -r '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id' \
  | while read tid; do
      gh api graphql -f query="mutation { resolveReviewThread(input: {threadId: \"$tid\"}) { thread { isResolved } } }" > /dev/null
    done
```

## Refines Otto-355

Otto-355 says: **BLOCKED-with-green-CI means investigate review threads FIRST.**

This memory adds the missing piece: **the investigation must include OUTDATED threads, not just current-revision threads.**

The MEMORY.md row for Otto-355 (per CLAUDE.md wake-time discipline) should compose with this lesson.

## When this matters

- After force-pushing a fix for review-flagged content
- After multiple rebases on a PR (each rebase outdates the previous threads)
- When `required_conversation_resolution` is enabled (default for many factory branch protection setups)
- When auto-merge is armed but isn't firing for unexplained reasons

The diagnostic should be: "Is `mergeStateStatus: BLOCKED` despite green CI + 0 unresolved-current threads?" → check for outdated unresolved threads.

## Compositional class — Blocked-GreenCI Review-Thread Punchlist (Amara 2026-04-28T20:34Z)

**Class name:** **Blocked-GreenCI Review-Thread Punchlist**.

Amara formalized the compositional class after seeing
Otto-355 (BLOCKED-with-green-CI investigate threads first)
combined with Outdated Review-Thread Merge Gate Residue compose
into a deterministic 5-minute unblock path on PRs #688/#690
this arc.

### Definition

> A PR shows green CI but remains blocked because unresolved
> review threads, not failing checks, are the active merge
> gate.

### Control (Amara prescribed)

When a PR is BLOCKED with green CI:

1. **List unresolved review threads** (filter
   `isResolved == false`, including outdated ones — see
   class above for why outdated still blocks).
2. **Classify each thread** as:
   - **real** — finding describes current code state and
     needs a fix.
   - **outdated** — finding describes pre-fix state; the
     fix landed in commit X.
   - **phantom-stale** — Copilot-cache miss; finding
     references diff context that no longer exists.
3. **Fix real findings** with targeted commits.
4. **Reply with evidence** (commit SHA / "see commit X" /
   "addressed in PR Y") for outdated and phantom-stale
   threads.
5. **Resolve explicitly** via GraphQL `resolveReviewThread`
   or the GitHub UI "Resolve conversation" button.

### Worked example (this arc)

PRs #688 + #690 each had multiple unresolved threads after
green CI. Applied the 5-step control:

- PR #688: 2 threads (line-marker `+` finding + stale
  section-range finding) → both real → targeted fix
  commit `3a969cb` → explicit resolve of both threads.
- PR #690: 3 threads (bold-name newline split + ambiguous
  classification-labels phrasing + ambiguous
  `gh run list []` index summary) → all real → targeted
  fix commit `be9a88a` → explicit resolve of all three.

Net cost: ~5 minutes per PR; deterministic; no
"mysterious BLOCKED" investigation needed.

### SD-9 calibration on Copilot's findings

In this arc, Copilot calibrated well as a P2 reviewer: all
addressed findings were real wording/markdown cleanup, with
no observed false positives. Treat this as **local
calibration evidence, not global proof**.

Current local pattern (small sample, not generalized):

- P1 findings tend toward correctness bugs.
- P2 findings tend toward wording/cleanup.
- Copilot-cache phantom-stale class still exists but was
  less common in this arc.

Tiny blade: don't let "low false-positive rate this arc"
become "Copilot is reliable now." Class-Count Validity
Drift discipline applies.

### Generalizes to

Any PR with `required_conversation_resolution: true` branch
protection rule + green CI + non-empty unresolved threads.
Not specific to Copilot — applies to any reviewer (human,
agent, automated tool).

### What this is NOT

- NOT a license to skip the diagnostic. If the PR is
  BLOCKED and the unresolved-thread count is zero, the
  block is something else (CODEOWNERS, branch protection
  rule, draft state, etc).
- NOT a replacement for actually fixing real findings.
  Reply-and-resolve only applies to outdated /
  phantom-stale; real findings need real fixes.

## What this memory does NOT mean

- Does NOT mean disable `required_conversation_resolution`. The setting is correct — it forces engagement with reviewer feedback.
- Does NOT mean ignore reviewer comments. The fix flow is: receive feedback → fix on a force-push → EXPLICITLY resolve thread (the resolution step was the missing discipline).
- Does NOT mean force-push less often. Force-push is the right tool for review-fix; the missing piece was post-push thread resolution.

## Operational rule (going forward)

**After every force-push that addresses review feedback:**

1. Verify the fix is on the remote branch (not just local)
2. Run the diagnostic query above
3. Resolve all unresolved threads (including outdated ones)
4. Verify auto-merge fires within ~5 min after resolution

If auto-merge doesn't fire within 5 min after thread resolution, escalate (re-arm auto-merge, check for other blockers).

## Composes with

- **Otto-355** (BLOCKED-with-green-CI investigate threads first) — refined by this memory
- **Otto-250** (PR reviews are training signals; conversation-resolution gate is forcing function) — the gate is the FORCING function; this memory captures the gate's full mechanics
- **Otto-329** (force-push discipline) — this memory adds the post-force-push thread-resolution step
- **`feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23.md`** — branch protection IS within agent decision; understanding `required_conversation_resolution` is part of that
- **AceHack-LFG drift-closure work** — this lesson directly enabled #57 + #62 to land after 90+ min stuck

## Cost-of-discovery

Three PRs stuck for 90+ minutes due to this misunderstanding. Capturing this lesson means future-Otto wakes pay zero discovery cost. Direct cost-amortization per Amara's "stability is velocity amortized" framing.
