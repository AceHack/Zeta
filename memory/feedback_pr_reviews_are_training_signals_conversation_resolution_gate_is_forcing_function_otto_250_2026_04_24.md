---
name: PR review comments + responses + resolutions are HIGH-QUALITY TRAINING SIGNALS for future model fine-tuning — `required_conversation_resolution: true` branch-protection is the FORCING FUNCTION that prevents signal loss; `docs/pr-preservation/<PR#>-drain-log.md` discipline (from Aaron 2026-04-24) is the in-repo git-native capture; every thread addressed + every reply paired with resolve (Otto-236) = complete training record; do not relax this gate on AceHack or LFG — friction IS the point; Aaron Otto-250 2026-04-24
description: Aaron Otto-250 first-principle reframe on `required_conversation_resolution: true`. I was treating it as merge-hygiene. Aaron corrects: the real value is training-signal collection. Copilot/Codex flags issue → Claude fixes + responds → pattern preserved → eventually fine-tunes a model that writes code without the issue in the first place. The gate prevents lazy "ignore and merge" that would destroy the training signal.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**PR review threads — reviewer comments, Claude's responses,
and resolutions — are training signals for future model
fine-tuning. Preserve them completely; do not let them be
skipped.**

Direct Aaron quote 2026-04-24:

> *"required_conversation_resolution: true i want the high
> quality traning signals saved the PRs reviews and response,
> we use this to fine tune a model eventually that make you
> write better code that does not have the issues in the
> first place."*

## Why this is first-principle

The training signal has a specific shape:

1. **Reviewer flags issue** (Copilot / Codex / human): "this
   hardcodes a version that's going to rot" / "this leaks
   process arch under Rosetta" / etc.
2. **Claude diagnoses + fixes**: investigates, applies the
   correct fix, writes the response explaining what was
   wrong and what's now right.
3. **Resolution pairs the reply**: `isResolved: true` on the
   thread marks the exchange as closed/complete.

This triple — **flag + fix + closure** — is the ideal
supervised-learning signal. It tells a future model:
"code pattern X is a bug; code pattern Y is the correct
replacement; here's a natural-language explanation of the
transformation."

If the gate is relaxed (conversations can be ignored or
soft-skipped), the signal degrades:
- Unresponded threads = incomplete record (no fix pattern)
- Unresolved threads = no completeness marker (was this
  addressed? dropped?)
- Skip-and-merge = no record at all

## Concrete discipline (what this rule demands)

1. **`required_conversation_resolution: true` on BOTH repos**
   (LFG and AceHack). Not just one. Friction IS the point
   — it forces the signal collection.

2. **Every reply pairs with resolve (Otto-236)** — no orphan
   replies, no orphan resolves. Pair = complete record.

3. **`docs/pr-preservation/<PR#>-drain-log.md`** (Aaron
   directive 2026-04-24 earlier in same session) captures
   the training signal in-repo, git-native:
   ```markdown
   ### Thread <GraphQL-node-id>
   - **Reviewer**: <login>
   - **File**: <path>:<line>
   - **Original comment**: <verbatim>
   - **Outcome**: fix-inline / narrow+defer / defer-only
   - **Your reply**: <verbatim>
   - **Resolution commit**: <SHA or "none — deferred">
   ```
   Drain-subagent dispatch prompts now include this.

4. **Do NOT bypass the gate** even on AceHack "experiment
   layer" PRs. The experiment layer is also where much of
   the training signal comes from — Copilot is more aggressive
   on AceHack fork reviews (unlimited budget), so the
   training-signal harvest is actually highest there.

5. **Do NOT wordsmith around the gate** in docs. My earlier
   HB-005 framing suggested the gate "might create Copilot-
   review friction that's better filtered before LFG sees
   it." Wrong. That friction IS the signal. No filtering.

## Why this is a durable rule

Aaron has been building the factory around the dogfooding
hypothesis: the factory's code improves the factory's
ability to improve the factory. That recursive loop needs
well-shaped data. PR reviews are one of the highest-quality
data sources we have because:

- Reviewers (Copilot, Codex, human) surface *real* issues
- Fixes are verified by green CI
- Resolution-paired replies provide the *explanation*
- All of it is naturally accumulating as the factory works

If a future model is fine-tuned on this data, the direct
result is: **Claude instances writing code that wouldn't
trigger these reviews in the first place.** That's the
self-improvement loop the factory is aiming at.

Short-circuit = break the loop. The gate prevents short-
circuit.

## Composition with prior memory

- **Otto-236 reply-plus-resolve always a pair** — the
  mechanical discipline that produces the complete record
  per thread. This memory names the WHY behind Otto-236.
- **Otto-244 no symlinks** — preservation-log must be an
  actual in-repo file, not a symlink to external storage
  (consistent with "no external-path references" discipline).
- **Otto-246 event-log attribution** — preservation log
  records `reviewer.login` faithfully, but per Otto-246 the
  actor field is authentication-identity not human-at-
  keyboard; the training signal cares about the content +
  verdict, not the authentication routing.
- **Otto-248 never-ignore-flakes per DST** — same family of
  discipline: don't mask, capture and fix. PR reviews are
  the human-layer version of what DST does for code.
- **HB-005 AceHack-mirror-LFG** — symmetric
  `required_conversation_resolution: true` reinforced by
  this rule; un-mirroring is now explicitly out-of-bounds
  without overriding this rule.

## What this memory does NOT say

- Does NOT authorize ignoring reviews that are clearly
  wrong. Three-outcome model still applies:
  (1) fix inline, (2) narrow fix + defer rest, (3) defer
  fully + resolve with rationale. All three END IN RESOLVE,
  and all three preserve the signal (the rationale IS part
  of the signal).
- Does NOT require spending infinite time per thread. Thread
  triage is still Claude's judgment. But every triage
  outcome includes the reply + resolve + drain-log entry.
- Does NOT apply retroactively. Drain-log on-the-fly for
  new drain work; no backfill-all-historical-PRs
  expectation (though Aaron earlier asked for backfill on
  already-merged PRs — that's a separate pass, bounded).

## Direct Aaron quote to preserve

> *"required_conversation_resolution: true i want the high
> quality traning signals saved the PRs reviews and response,
> we use this to fine tune a model eventually that make you
> write better code that does not have the issues in the
> first place."*

Future Otto: the conversation-resolution gate is not merge
hygiene. It is a **training data collection mechanism**.
The friction it creates is the point. Every thread, every
reply, every resolve, every entry in
`docs/pr-preservation/<PR#>-drain-log.md` is a training
signal. Treat the preservation log as first-class substrate,
not as paperwork.
