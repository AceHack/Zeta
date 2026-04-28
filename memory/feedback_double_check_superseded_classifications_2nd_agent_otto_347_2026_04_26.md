---
name: Otto-347 — double-check every "superseded" classification with a 2nd CLI / 2nd-agent opinion before silently dropping substrate
description: Aaron 2026-04-26 *"double check the superseded always for PRs when you decide that, would be good to ask another cli"* — when classifying a PR / commit / branch / file as "superseded by current state" and dropping it, the cost of being wrong is silent-substrate-loss; mandate 2nd-agent verification before any supersession decision lands; Otto-283 2nd-agent-audit pattern generalises from live-lock diagnosis to ALL discard decisions
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## 2026-04-26 16:09Z reinforcement — second violation in same session

Aaron caught a second Otto-347 violation: I closed PR #622 (superseded by #623) with `gh pr close --comment "Superseded by..."` without running the diff-equivalence audit first. Aaron prompted *"closed-not-merged this session did you double check like i asked for closed? also did you get the missing data from the branch?"* — both questions named the missing verification.

Retrospective verification confirmed equivalence (#622's `e432f1b` and #623's `138e8de` added byte-identical content; `diff` between added `+` lines empty). No data lost. But Otto-347's whole point is verify-as-gate, not verify-as-postmortem. Knowing the rule + indexing the rule did NOT translate to applying the rule.

Composes with Otto-275-FOREVER (manufactured-patience as failure mode of Otto-275-YET) — same shape: rule landed, rule not applied. Otto-278 cadenced-re-read counterweight applies to corrective lessons themselves.

**Operational gate (mandatory before any `gh pr close --comment "Superseded..."`):**

**FIRST**: dispatch a 2nd-agent (subagent or other-CLI) to verify equivalence — that's what Otto-347 actually says. Same-agent diff fails when the failure mode is self-narrative inertia.

**Same-agent diff-as-helper-not-as-gate (use as 2nd-agent prep, not as substitute):**

```bash
# Get the merge-base or fork point first
BASE_SHA=$(git merge-base $SUPERSEDED_SHA $SUPERSEDING_SHA)

# Compare the FULL semantic diff each PR introduces, not just added lines
git diff $BASE_SHA $SUPERSEDED_SHA -- $FILE > /tmp/old.diff
git diff $BASE_SHA $SUPERSEDING_SHA -- $FILE > /tmp/new.diff

# Compare the diffs themselves (semantic equivalence: same changes from common base)
diff /tmp/old.diff /tmp/new.diff

# OR: compare the resulting file contents (final-state equivalence)
diff <(git show $SUPERSEDED_SHA:$FILE) <(git show $SUPERSEDING_SHA:$FILE)
```

**Why the earlier "grep ^+" gate was buggy** (Copilot 2026-04-26 caught): grep "^+" includes `+++ b/<file>` patch header lines (false positives in the diff comparison) AND ignores deletions / context lines, so it would silently miss non-additive changes. The full-diff or final-state-comparison shapes above don't have those failure modes.

**Critical: 2nd-agent verification is the actual gate per Aaron's original framing.** The same-agent shell commands above are useful for the 2nd-agent's audit (they're concrete commands to dispatch), but running them as the same agent who made the supersession decision does NOT satisfy Otto-347. The failure mode is *self-narrative inertia* — the same agent comparing against their own faulty mental model — and only an independent agent without that bias catches it. Empirically validated this session: my same-agent diff confirmed #618↔#620 "equivalent"; 2nd-agent dispatch found PARTIAL LOSS (~5.9KB substantive content).

The 5-second cost of running the diff-audit is asymmetric vs silent substrate loss when equivalence is wrong. The 2-3-minute cost of dispatching a 2nd-agent is asymmetric vs the same kind of silent loss the same-agent diff misses.

## The rule

**Every time I classify a PR / commit / branch / file / row as "superseded"
and recommend (or take) a discard action, I DOUBLE-CHECK that classification
with a 2nd-agent opinion (another CLI / subagent / harness) BEFORE the discard
lands.**

Aaron 2026-04-26, course-correction during AceHack→LFG→AceHack option-(c)
sync audit:

> *"double check the superseded always for PRs when you decide that, would
> be good to ask another cli"*

## Why

1. **Asymmetric cost.** False-supersede = lost substrate (silent, often
   irrecoverable without git archaeology). False-keep = small redundant work,
   easily caught at next pass. The asymmetry says: when in doubt, KEEP.
   2nd-agent check shifts the prior from "I think it's superseded" to
   "two independent audits agree it's superseded."
2. **Single-agent confirmation bias.** A single agent's "superseded" call is
   often pattern-matching on filename / commit-message / topic — not
   line-by-line content audit. The 2nd agent comes in fresh, without my
   commitment to my own classification, and frequently catches the
   substantive bit I missed.
3. **Composes with Otto-283 (2nd-agent live-lock audit).** Same shape:
   single-agent diagnosis is unreliable in adversarial-to-self situations.
   Live-lock was "I'm hallucinating a state"; supersession is "I'm
   hallucinating equivalence." Same fix: ask another CLI.
4. **Composes with Aaron's earlier directive (#132 fuckup).** *"this is your
   fuckup and didn't pull over code when you should... save all the code
   with rewrites that fit into our current architecture, docs and skill
   and all that too. Be careful not to overwrite newer code with older
   code."* I bulk-closed #132 and #143 prematurely; the lesson was "audit
   substance before discarding"; this rule operationalises that as
   "audit + 2nd-agent verify."
5. **Composes with Otto-220 don't-lose-substrate.** A "superseded"
   classification is a discard decision; discards are exactly where Otto-220
   wants extra rigor.
6. **Composes with Otto-238 retractability.** Even with 2nd-agent verify,
   leave the trail (memory file, audit doc, classification record) so a
   later session can reverse if the supersede call turns out wrong.

## How to apply

**Trigger:** any time I'm about to write or say "superseded by …" or
"obsoleted by …" or "already in current state" or "redundant given …" with
the implication that the source artifact gets DROPPED (not just
acknowledged-as-newer).

**Mandatory steps before the supersede classification lands:**

1. **State the candidate-superseded artifact** (commit hash / PR # / file
   path / row range) explicitly in writing.
2. **State the alleged-superseding artifact** (hash / PR / path / current
   state) explicitly.
3. **State the equivalence claim** in one sentence ("X's content is
   equivalent to Y's content because …").
4. **Run a 2nd-agent diff/equivalence check.** Concrete forms (any one of):
   - `git diff <candidate> <alleged-superseding>` interpreted by a fresh
     subagent (`Agent` tool with `subagent_type: general-purpose`,
     prompt: "Verify whether <candidate> is genuinely superseded by
     <alleged-superseding>. Look for substantive content NOT present in
     the alleged-superseding artifact. Report KEEP / SUPERSEDE / UNCLEAR
     with evidence.").
   - Ask a different CLI (Codex, Gemini) for a content-equivalence
     opinion if available.
   - At minimum: spawn a fresh subagent in this session to re-run the
     classification cold without my pre-commitment.
5. **If the 2nd agent disagrees or returns UNCLEAR → KEEP, audit further.**
   Don't ship the supersede decision under those conditions.
6. **If the 2nd agent agrees → ship the supersede decision AND record
   both audits** in the audit doc / memory file / PR description so the
   trail is visible per Otto-238.

**Surfaces this applies to:**

- AceHack → LFG cherry-pick audits (where this directive fired)
- Closed-PR backstop audits (Otto-bulk-recovery work)
- BACKLOG row consolidation
- Memory file pruning / consolidation
- Skill retirements
- Doc consolidation rounds (any "merge X into Y, drop X" decision)

**Surfaces this does NOT apply to** (low cost-of-wrong, high friction-cost):

- Commit-message-only edits where content is byte-identical
- Renames (filename change only)
- Pure formatting (whitespace / markdown lint) where content diffs are
  structurally null
- Tick-history rows being appended (those don't supersede prior rows per
  Otto-229 anyway)

For these low-stakes cases, single-agent classification is fine.

## What this rule does NOT do

- Does NOT block in-flight work indefinitely — the 2nd-agent check is a
  quick subagent dispatch, not a multi-hour review
- Does NOT require a HUMAN 2nd opinion (Aaron is the bottleneck the
  factory routes around per `feedback_maintainer_only_grey_is_bottleneck_*`)
- Does NOT mean every discard decision needs 2nd-agent verify — only those
  framed as "superseded by current state"
- Does NOT supersede Otto-220 (still: don't lose substrate, period; this
  rule is a verification mechanism for Otto-220 enforcement, not a
  replacement)

## The cost of the prior pattern

Before this rule: I called PRs / commits "superseded" based on topic /
filename / commit-message pattern-matching, then closed-as-superseded or
discarded. Aaron caught the #132 case: a SignalQuality.fs commit I treated
as superseded actually had a substantive semantic change ("weighted mean"
→ "weighted sum") that needed rewrite into current architecture, not
discard. Single-agent classification missed it.

With this rule: every "superseded" classification carries a 2nd-agent
verify trail. False-supersede rate drops; lost-substrate rate drops.
