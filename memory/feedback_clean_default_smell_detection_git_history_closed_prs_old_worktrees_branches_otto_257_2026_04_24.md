---
name: CLEAN-DEFAULT SMELL DETECTION — any drift from "keep things clean" default is a SMELL that should trigger "what did I forget?" reflex; explicit smell classes are recovery-candidates (not noise-to-ignore): (1) content in git history that isn't on main, (2) closed PRs with non-merged content, (3) old locked worktrees (`.claude/worktrees/agent-*`), (4) old unmerged branches (local or remote); because factory default IS clean, any debris = unfinished work that fell through the cracks; applies at TWO scopes — git-native (worktrees, branches, git history) AND github-host (closed PRs, issues, comments on the service); whole recovery framework belongs in BACKLOG as a standing cadence item; Aaron Otto-257 2026-04-24 "these recovery git history, closed prs, old worktrees, old branches, they should all be smells that make you think, what did i forget, i don't remember that there cause our default is to keep things clean. so if you find any of those it's likely unfinihsed work. Also you should absorbe this entire gitnatiave and seperate github host recovery processes backlog"
description: Aaron Otto-257 general factory discipline. Prior recovery work (closed-PR audit in #378/#329/#320/#314/#313/#334; 80+ locked worktrees noticed this session) was treated as one-off salvage; Otto-257 promotes it to standing-smell detection. Save short + durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Factory default is "keep things clean."** Therefore any
drift from clean is a smell. The reflex on seeing drift
is *"what did I forget?"* — not *"that's just how it is."*

Direct Aaron quote 2026-04-24:

> *"these recovery git history, closed prs, old
> worktrees, old branches, they should all be smells
> that make you think, what did i forget, i don't
> remember that there cause our default is to keep
> things clean. so if you find any of those it's likely
> unfinihsed work. Also you should absorbe this entire
> gitnatiave and seperate github host recovery processes
> backlog"*

## Smell classes (non-exhaustive)

**Git-native recovery surface** (local to the repo):

1. **Commits in git history not on main** — `git log
   --all --source --remotes --not main` shows commits on
   feature branches that never landed. Each one is a
   recovery candidate.
2. **Closed PRs with unmerged content** — `gh pr list
   --state closed` + cross-reference "merged_at: null"
   means CLOSED-not-MERGED. Content is in git history
   but not in main. Recovery-candidate unless explicitly
   superseded.
3. **Old locked worktrees** — `.claude/worktrees/agent-*`
   with commits-ahead-of-main or uncommitted changes.
   Each subagent left one behind; the branches are
   drift that should have landed or been pruned.
4. **Old unmerged branches** — local or remote branches
   with no associated open PR and no merge to main.
   Either lost work or dead weight; either way, the
   drift-from-clean default needs explanation.
5. **Uncommitted changes on any working tree** — an
   agent exited without committing. Content may be
   useful; content may be noise; either way the
   "leave it dirty" state is drift.

**GitHub-host recovery surface** (service-layer):

1. **Closed issues with open content-questions** —
   issue comments capture context that may not have
   landed in code/docs.
2. **Closed PR threads with unresolved debates** —
   thread content may never have been persisted
   anywhere else.
3. **PR review comments on merged PRs** — valuable
   training signal per Otto-250/251; preserved via
   `docs/pr-preservation/**` (canonical) + per
   Otto-252 symmetric `forks/<fork>/pr-preservation/**`
   for fork reviews.
4. **GitHub Actions artifacts past retention** — logs
   that got garbage-collected; if unique signal, it
   needed snapshotting.
5. **Slack/email/external-chat context** — not
   persisted to git; lives only on the service. Same
   smell pattern at a different scope.

## The reflex ("what did I forget?")

When I encounter ANY of the above:

1. **Stop the reflex** to treat it as background noise.
2. **Ask**: "what content is here that isn't on main
   / in the canonical corpus?"
3. **Audit**: diff the debris-source against main /
   canonical. Is there unique content?
4. **Triage**:
   - **Landed** (duplicate of main) → safe to prune.
   - **Obsolete** (content explicitly superseded by
     later work) → prune with cleanup commit explaining.
   - **Unfinished** (unique content, not superseded) →
     RECOVER per Otto-254 roll-forward (new PR
     re-landing the content, citing the debris source).

## Composition with prior memory

- **Otto-232** bulk-close-as-superseded — Otto-257
  doesn't contradict: when N>5 PRs meet three-signal
  criteria (shared hot file + append-only + historical),
  bulk-close is still right. Otto-257 says: bulk-closing
  is ITSELF a smell that warrants re-auditing the closed
  cluster later; don't assume all bulk-closes were clean.
- **Otto-234** don't over-correct after cascade-realization
  — Otto-257 gives the positive mirror: actively AUDIT
  the over-correction surface to recover lost subsets.
- **Otto-238** retractability-as-trust-vector — recovery
  work IS the retractability discipline applied to
  historical drift. Every recovered-and-relanded piece
  of content is a trust deposit.
- **Otto-250** PR reviews are training signals —
  Otto-257's github-host-recovery surface is explicit:
  PR reviews ARE content that can fall off the canonical
  corpus if not preserved.
- **Otto-251** entire repo is training corpus — Otto-257
  extends: any drift-from-canonical is drift-from-corpus;
  the recovery framework IS the mechanism to keep the
  corpus complete.
- **Otto-252** LFG as central aggregator — Otto-257
  makes the aggregation comprehensive: git-native AND
  github-host scopes both flow to LFG; both are
  recoverable from drift surfaces.
- **Otto-254** roll-forward — Otto-257's recovery
  actions ARE forward-rolls (new PR, new commit,
  new memory).

## What to land (backlog-owed, NOT yet landed)

Per Aaron's "absorb this entire ... recovery processes
backlog" directive:

- **P1 BACKLOG row** — "Clean-default smell audit (standing
  cadence). Scope: git-native + github-host recovery
  surfaces. Cadence: every 5-10 rounds plus on-demand
  when a specific smell-class is observed. Produces:
  findings report classifying each debris-item into
  landed / obsolete / unfinished, with recovery PRs
  filed for unfinished items. Effort: S per round at
  steady state; L for the first comprehensive sweep."
- **Standing tool** — `tools/hygiene/recovery-audit.sh`
  that enumerates git-native smell classes from the list
  above and emits a newline-separated report. (Future
  PR; not authorized this round by queue-saturation.)

## Direct Aaron quote to preserve

> *"these recovery git history, closed prs, old
> worktrees, old branches, they should all be smells
> that make you think, what did i forget, i don't
> remember that there cause our default is to keep
> things clean. so if you find any of those it's likely
> unfinihsed work. Also you should absorbe this entire
> gitnatiave and seperate github host recovery processes
> backlog"*

Future Otto: when you see a closed-not-merged PR, an
old worktree, an orphan branch, a closed issue with
unresolved thread, a comment-thread on a merged PR
that wasn't captured — the reflex is "what did I
forget?" Debris is not noise; debris is training data
about what fell through the cracks. Every audit run
makes the corpus more complete.
