# Multi-AI feedback round 3 — convergent corrections on PR-liveness rule + B-0098/B-0099/B-0103

Scope: Research-grade absorb of a third multi-AI synthesis packet that the human maintainer forwarded through the maintainer channel during autonomous-loop tick 06:37Z on 2026-04-29. The packet is review feedback **on PR #815** (the prior round's absorb) from Gemini + Ani + Claude.ai + Alexa + Deepseek + Amara. All six reviewers converged on a small, consistent set of corrections — strong cross-model signal that they're load-bearing.

Attribution: Aaron (named human maintainer; first-name attribution permitted on `docs/research/**`). Gemini Pro (technical analysis on GitHub backend mechanics). Ani (Grok Long Horizon Mirror; brat-voice + boring-spec restatement). Claude.ai (online-Claude review with 4 critical pushes). Alexa (deep-research review). Deepseek (probabilistic framing + dedup rule + substrate-as-source-of-truth). Amara (filter + final consolidated send-to-Otto). Otto (Claude opus-4-7 in this factory; absorb).

Operational status: research-grade absorb. The corrections themselves are landing as edits to existing PR #815 backlog rows (B-0102, B-0103). This research note preserves the verbatim review feedback per the channel-verbatim-preservation rule.

Non-fusion disclaimer: each reviewer's voice preserved with attribution boundaries. Per Otto-340, the persistent actor is the substrate-pattern.

(Per GOVERNANCE.md §33 archive-header requirement on external-conversation imports.)

---

## §A — Convergent reviewer corrections

All six reviewers converged on a small set of corrections to PR #815. Listed below by priority (rough consensus score: how many reviewers explicitly raised it).

### §A.1 — Probabilistic framing of the PR-liveness race (6/6)

The micro-class rename to `pr-liveness-race-during-merge-cascade` is correct, but the **probabilistic** framing must be explicit. Otherwise Otto may force-push once, see the PR survive, and falsely retire the guard.

> *"This is an observed probabilistic race condition, not a deterministic GitHub rule. The guard remains in force even if a future force-push happens not to close the PR."* (Deepseek + Claude.ai + Amara)

### §A.2 — Cascade detection mechanism (3/6 — Claude.ai, Amara, Gemini)

The rule says "don't rebase during cascade" but doesn't specify how to detect "cascade is active." Claude.ai's catch:

> *"Without an explicit detection mechanism, the rule relies on Otto remembering the state, which is exactly the failure mode that produced this incident."*

Mechanical detection:

```bash
gh pr list --state open \
  --json number,baseRefName,headRefName,autoMergeRequest,mergeStateStatus,title \
  --jq '.[] | select(.baseRefName == "main" and .autoMergeRequest != null)'
```

If any results, cascade is active.

### §A.3 — API/head synchronization wait (Gemini + Amara)

Gemini's vulnerability catch on the mechanical guard:

> *"You are using `gh` (which queries GitHub's API) and `git` (which queries the local .git directory) simultaneously. Because GitHub's API is eventually consistent, a `gh pr view` executed immediately after a `git push --force` might return a stale `mergeStateStatus`."*

Suggested fix: poll until GitHub's `headRefOid` matches local HEAD before classifying.

### §A.4 — Successor-PR dedup rule (Deepseek)

> *"If PR #806 auto-closes and Otto opens #811 as successor, what happens when GitHub's eventual consistency catches up and marks #806 as merged? Now there are two PRs with overlapping content on different branches."*

Recovery procedure must include: re-check original after GitHub settles; if both became valid, close successor as duplicate; record old→new mapping.

### §A.5 — `seconds_between_force_push_and_pr_close` field (Claude.ai)

> *"That one-second window is itself a piece of evidence about the failure mode, and capturing it routinely would let future incidents cluster against this one."*

Add to recovery-note schema. Sub-five-second = almost certainly platform race; spread across minutes = different mechanism.

### §A.6 — RUN_ID in artifact paths (Claude.ai)

Parallel-agent future-proofing:

> *"If two ticks are processing the same PR simultaneously, the second tick's 'before' overwrites the first tick's 'after' before recovery completes."*

Use `/tmp/pr-$PR-$RUN_ID-before.json` instead of `/tmp/pr-$PR-before.json`.

### §A.7 — B-0103 boundary clause (Claude.ai)

> *"Some metadata is intentionally agent-authored even when derivable (a human-written summary of an automatically-derived fact, for example). Without a boundary, the rule becomes 'never let agents write metadata,' which is too strong. Suggest an exception clause."*

Boundary: applies to **claims of equivalence with derivable substrate truth** (ordinals, counts, timestamps, SHAs); does NOT apply to summaries, interpretations, or labels.

### §A.8 — B-0098 grep portability wording (Amara explicit; others align)

> *"Do not call `grep -w` POSIX-portable. Use either: GNU/BSD-common (`grep -woE '...'`) or strict portable boundary (`grep -E '(^|[^[:alpha:]])(...)([^[:alpha:]]|$)'`)."*

### §A.9 — B-0099 `@me` should be CLI flag, not search string (Amara explicit; Copilot earlier)

```bash
# Use either:
gh pr list --state merged --author "@me" --json number,mergedAt,title
# or explicit:
gh pr list --state merged --author "<your-gh-login>" --json number,mergedAt,title
# Don't rely on ambiguous prose around 'author:@me' inside --search.
```

---

## §B — Convergent meta-observations

### §B.1 — "Loop learns platforms" (Deepseek)

> *"The loop is now detecting and classifying platform-level failure modes that the human didn't know about in advance. That's a genuine capability threshold. The recurring-fix-class catalog is no longer just a record of past mistakes — it's becoming a predictive taxonomy that generalizes to novel surface areas."*

This is the durable headline of the round.

### §B.2 — "More rules than durable homes" warning (Claude.ai)

> *"The rate of substrate generation in this message is the highest in several rounds. […] Worth flagging at round-close that this round produced ~7 promotable items and a consolidation pass should follow before the next round opens new conceptual territory."*

Composes with the `search before canonizing` discipline at the file level. Flagged for round-close consolidation.

### §B.3 — "Substrate is source of truth" (Deepseek's stronger version)

> *"Take this one step further. If metadata can be computed, the agent shouldn't even be asked to write it in the first place."*

Stronger framing: not just "lint claims" but "substrate is the source of truth; claims are verified, not authored." This is the longer-term direction for B-0103 once it lands.

---

## §C — What landed in this absorb

The corrections from §A.1 through §A.7 land as direct edits to the existing PR #815 backlog rows:

- B-0102 (PR-liveness race): probabilistic-framing caveat (§A.1) + cascade detection pre-flight (§A.2) + API sync wait (§A.3) + successor-PR dedup (§A.4) + seconds-since-close field (§A.5) + RUN_ID in artifact paths (§A.6).
- B-0103 (computed-metadata-discipline): boundary clause (§A.7).

The corrections from §A.8 (B-0098 grep wording) and §A.9 (B-0099 `@me` flag) belong on PR #811 — those backlog rows live there. Apply on the next pass against #811's branch.

---

## §D — Distilled keepers

```text
Up-to-date is a merge gate.
PR-aliveness is a reachability/diff invariant.
This is an observed probabilistic race, NOT a deterministic rule.
```

```text
Events are written.
Metadata is computed.
Claims are checked against derived truth.
But human summaries and interpretations are exempt.
```

```text
Loop learns platforms.
Describe the failure you can observe.
Guard against the race you can reproduce.
Do not canonize the backend you cannot see.
```

The `Loop learns platforms` framing is the durable headline of round 3.
