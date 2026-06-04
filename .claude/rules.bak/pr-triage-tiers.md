# PR triage tiers — five-class disposition framework for unfinished-PR cleanup

Carved sentence:

> Every stale unfinished PR fits one of five disposition classes;
> close with substrate-honest comment when the substrate is
> recovered/redundant/superseded/re-derivable, park only when
> unique substantive substrate is at risk. Tag `deferred-to-human`
> on the rare cases that genuinely need maintainer attention so
> agent unfinished-PR scans can skip them.

## Operational content

When triaging an unfinished/stale/abandoned PR (especially during
the agent-start unfinished-PR-check per
[`docs/AUTONOMOUS-LOOP-PER-TICK.md`](../../docs/AUTONOMOUS-LOOP-PER-TICK.md)
Step 1 + per [`holding-without-named-dependency-is-standing-by-failure.md`](holding-without-named-dependency-is-standing-by-failure.md)),
classify into one of five tiers and apply the standard disposition.

### Tier 1 — Fully redundant (close as substrate-redundant)

**Signal**: every file the PR touches is byte-identical on `origin/main`.

**Reason it's safe to close**: substrate is already on main; PR adds nothing.

**Disposition template**:

```text
Closing as fully substrate-redundant: <file list>
byte-identical on origin/main. <N> days stale, <merge-state>.
Per `.claude/rules/blocked-green-ci-investigate-threads.md`
stale-armed-PR Pattern A.
```

### Tier 2 — Substrate-recoverable (close with regenerate path named)

**Signal**: some files missing on main, but those files are
**regeneratable via existing tooling** (e.g., PR-discussion
archives via `tools/pr-preservation/archive-pr.ts`; tick shards
that fall in a generated range).

**Disposition template**:

```text
Closing as substrate-recoverable: <N> of <M> files on main;
<missing-count> missing (<missing-list>) are <kind> for
already-merged source PRs and recoverable via fresh
`<regeneration-command>`. Per `.claude/rules/blocked-green-ci-investigate-threads.md`
stale-armed-PR Pattern A.
```

### Tier 3 — Substrate-superseded (close with alt-landing cross-reference)

**Signal**: missing files' intent landed on main under a
different ID, filename, or scheme (e.g., new top-level row →
subdecimal scheme; ID-collision with reassigned row;
filename-convention re-ordering).

**Disposition template**:

```text
Closing as substrate-superseded: <on-main-equivalent> shipped via
<alternate-path>. <Original-path> would now create
<collision/drift> with current main. Per `.claude/rules/blocked-green-ci-investigate-threads.md`
stale-armed-PR Pattern A.
```

### Tier 4 — Substrate-re-derivable (close with discipline-already-encoded note)

**Signal**: missing substrate is a small observation
(shadow-lesson, brief drift report) whose **operational lesson
is already encoded in canonical rule form** OR re-derivable from
observable evidence (commit history, broadcast bus archives,
adjacent shadow logs).

**Disposition template**:

```text
Closing as substrate-re-derivable: <file> is a brief
<observation-class> whose operational discipline is already
encoded at `.claude/rules/<rule>.md`. Branch HEAD preserved for
optional cherry-pick if specific phrasing matters. Per
`.claude/rules/blocked-green-ci-investigate-threads.md`
stale-armed-PR Pattern A.
```

### Tier 5 — Park for human (tag `deferred-to-human`, do not close)

**Signal**: missing substrate is **substantive AND unique AND
NOT regeneratable from observable evidence**. Examples: external-AI
conversation transcripts (one-time event), human-Aaron research
exchanges, novel cross-substrate synthesis, persona NOTEBOOK with
real content.

**Disposition**: do NOT close. Apply the `deferred-to-human`
label so future agent unfinished-PR scans skip the PR (per the
`deferred-to-human` label semantics: agents leave these alone).
Post a comment naming the substantive substrate at risk so the
maintainer can pick disposition (re-land via cherry-pick,
close-and-archive elsewhere, or restart fresh).

**Comment template**:

```text
Substrate at risk — pending maintainer disposition:

<N> files in this PR contain substantive unique substrate NOT
recoverable from observable evidence:
- <file 1>: <one-line description>
- <file 2>: <one-line description>

Options:
- (a) cherry-pick the substantive files into a fresh small PR
- (b) close + archive the substantive files elsewhere
- (c) restart the work fresh

Tagging `deferred-to-human` so agent unfinished-PR scans skip
this PR. Per `.claude/rules/pr-triage-tiers.md` Tier 5.
```

Then: `gh pr edit <N> --add-label "deferred-to-human"`.

## The `deferred-to-human` GitHub label

Created 2026-05-23 (color `#FBCA04`). Semantics:

- Agent applies it when classifying a PR as Tier 5
- Agent unfinished-PR scans filter `-label:"deferred-to-human"`
  to skip these
- Maintainer removes the label after disposition
- Empirically expected to be rare (most stale PRs are Tier 1-4);
  if `deferred-to-human` accumulates, the threshold for Tier 5
  has drifted and needs re-calibration

## When to apply this framework

Per [`docs/AUTONOMOUS-LOOP-PER-TICK.md`](../../docs/AUTONOMOUS-LOOP-PER-TICK.md)
Step 1 (unfinished-PR check sub-step): on every cold-boot AND on
each cron tick, scan unfinished PRs authored by this agent's
surface (`otto-cli/*`, `otto-desktop/*`, `otto-vscode/*`, `otto/*`
branch prefixes per [`.claude/rules/agent-roster-reference-card.md`](agent-roster-reference-card.md)),
filter out `deferred-to-human` labels, and triage in priority
order (oldest first per the established discipline).

## Empirical anchor — 2026-05-23 cleanup session

This rule codifies the framework evolved across 27 PR closes
during Otto-CLI's 2026-05-23 session (PR landing as part of QoL
bundle):

- Tier 1 closes: e.g., #3326, #3346, #3351, #3352, #3357, #3532,
  #3610 (single-file or all-files-on-main cases)
- Tier 2 closes: e.g., #3317, #3318, #3344, #3347, #3354, #3669,
  #3481 (PR-discussion preservation files for merged source PRs)
- Tier 3 closes: e.g., #3323, #3355, #3360, #3374, #3520, #3534
  (subdecimal-vs-top-level convergence; ID-collision)
- Tier 4 closes: e.g., #3353, #3543, #3599, #3341 (re-derivable
  shadow lessons; discipline-already-encoded)
- Tier 5 parks: #3340 (Aaron-Ani-Grok research conversations
  unique substrate); peer Otto picked up for cherry-pick

## Composes with

- [`.claude/rules/blocked-green-ci-investigate-threads.md`](blocked-green-ci-investigate-threads.md)
  (Pattern A/B/C reference; this rule is the per-tier extension)
- [`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](holding-without-named-dependency-is-standing-by-failure.md)
  (PR-triage IS counter-reset decomposition work per condition #3)
- [`.claude/rules/agent-roster-reference-card.md`](agent-roster-reference-card.md)
  (lane discipline — only triage PRs in your surface's lane)
- [`.claude/rules/claim-acquire-before-worktree-work.md`](claim-acquire-before-worktree-work.md)
  (when re-land via cherry-pick is chosen for Tier 5)
- [`docs/AUTONOMOUS-LOOP-PER-TICK.md`](../../docs/AUTONOMOUS-LOOP-PER-TICK.md)
  Step 1 (unfinished-PR-check sub-step)
- [`.claude/rules/refresh-world-model-poll-pr-gate.md`](refresh-world-model-poll-pr-gate.md)
  (rate-limit tiers affect how aggressively to scan)

## Full reasoning

The framework emerged empirically during a 2026-05-23 Otto-CLI
session cleaning up 125 → 90 open PRs. Tier 1-4 closes were
unambiguous via per-PR file inspection (substrate-on-main check
plus alt-filename search and content sampling). Tier 5 surfaced when
PR #3340 had 2 Aaron-Ani-Grok research conversations and PR #3543
had what looked like persona substrate (later content-inspected
to actually be re-derivable, so down-classified to Tier 4 after
inspection).

The `deferred-to-human` label is the Aaron 2026-05-23 design
extension: "yes we can add that tag in github deferred-to-human
also i should not have to see those often but yes some humans will
like this mode of operation". Tagging rather than closing
preserves substrate-at-risk while letting agent unfinished-PR
scans filter cleanly.
