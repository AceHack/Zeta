---
name: Git-native PR-review archive — captures reviewer-cycle data as host-neutral historical substrate AND as high-signal training corpus for tuning Copilot/Codex over time; dual-use deliverable
description: Aaron 2026-04-23 Otto-57 two-message pair — *"do we keep some gitnative log of the PR reviews? that way a future model can be trained on all that too and we have it for history without the host? backlog?"* + *"you and the copilot are producing very high signal data there and it will also let you have the data you need to tune copilot over time"*. Names PR reviews as substrate with DUAL value: (a) host-neutral historical preservation composing with the git-native-first-host positioning, and (b) high-signal supervised-training corpus for tuning reviewer agents. Finding→fix→response→resolution cycles form labelled pairs. BACKLOG row M-effort filed; training-pipeline deferred as separate L/XL arc.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Git-native PR-review archive — dual-use deliverable

## Verbatim (2026-04-23 Otto-57 two-message pair)

> do we keep some gitnative log of the PR reviews? that
> way a future model can be trained on all that too and
> we have it for history without the host? backlog?

> you and the copilot are producing very high signal data
> there and it will also let you have the data you need
> to tune copilot over time

## The claim — dual-use deliverable

Aaron frames PR reviews as substrate with **two distinct
values** that the archive should serve simultaneously:

### (1) Host-neutral historical preservation

PR reviews currently live only on GitHub. If GitHub went
away, or if the factory migrated hosts (Git-Native +
first-host positioning from Otto-54 allows this), the
review substrate would disappear. A git-native archive
keeps the review history bound to the repo itself, not
the host — consistent with the positioning that "git is
canonical; host is replaceable".

### (2) High-signal reviewer-tuning corpus

The finding→fix→response→resolution cycle is a
**labelled supervised-learning pair**:

- **Input**: the code/docs under review at a specific SHA
- **Reviewer label**: the finding posted by Codex/Copilot
- **Response label**: the fix commit + per-thread
  resolution reasoning
- **Outcome label**: whether the fix addressed the
  concern or the review was pushed back on policy grounds

This structure is rare in the wild (most PR datasets have
finding + fix but not the reasoning + resolution +
policy-pushback). Per Aaron: *"you have the data you need
to tune copilot over time"*.

## Why this matters

**Observation Aaron is making**: the factory's Codex +
Copilot + Otto + human-maintainer cycle produces reviewer
signal that's already structured for training. The archive
just makes that structure durable and portable.

**Second-order benefit**: tuned Copilot = better first-
pass findings = less Otto cycle time on P2-style
mechanical findings = more Otto capacity for substantive
work. The archive compounds positively with reviewer-
capacity discipline (memory:
`feedback_split_attention_model_validated_...`).

**Third-order benefit**: if the peer-review pattern from
Otto-52 (multi-agent peer-review; CLI-first per Otto-55, Docker adds reproducibility-across-environments per Otto-57) is eventually
implemented, the archive IS the dataset those agents
train on. The archive is not speculative; it's
load-bearing for a BACKLOG'd research arc.

## Archive shape candidates (research decides)

Three candidate shapes named in the BACKLOG row:

| Shape | Pros | Cons |
|---|---|---|
| **Periodic `gh api` → markdown under `docs/history/pr-reviews/PR-NNN/`** | Human-readable; grep-able; composes with existing `docs/hygiene-history/` pattern | Copy-out pattern; not atomic with merge; archive lag |
| **Git-notes on merge commits** (`git notes add --ref=pr-review`) | Truly git-native; no new file tree | Less human-readable; git-notes tooling less common |
| **Hybrid: markdown + git-notes index** | Best of both | More moving parts; schema design cost |

Hybrid is likely the right answer — markdown as the
durable human-readable surface; git-notes as the machine-
readable index that the training pipeline consumes.

## Schema dimensions (preliminary; research doc will sharpen)

For each PR, capture:

- **PR metadata**: number, title, author, created-at,
  merged-at, merge-commit-SHA, branch
- **Review threads**: per-thread ID, author (agent vs.
  human), initial-comment body, all-replies, final-state
  (resolved / unresolved)
- **Fix commits**: commit-SHA, message, diff-hash,
  touched-files, timestamp
- **Resolution linkage**: which fix commit addressed
  which thread; which threads were policy-pushback
  (won't-fix with reason); which threads were
  cross-PR-deferred
- **Outcome bits**: did the PR merge? was it re-reviewed
  post-fix?

## How to apply (when the row fires)

### Phase 1 — research doc

`docs/research/pr-review-archive-design-2026-MM-DD.md`
comparing the three shapes, proposing the hybrid,
specifying the schema. Human-maintainer sign-off on
structure before coding.

### Phase 2 — prototype tool

`tools/archive/archive-pr-reviews.sh` (or bun+TS if the
post-setup-script-stack row makes that the default by
then). Takes owner/repo + optional PR list; emits
markdown + git-notes per the schema.

### Phase 3 — first-run baseline

Run against all currently-merged Zeta PRs (~214+ series).
Commit the archive to `docs/history/pr-reviews/` as a
single big import commit. Acts as the baseline corpus.

### Phase 4 — cadence

Add a FACTORY-HYGIENE row running the archive tool
post-merge (hook or weekly cron). Append-only discipline;
archive never rewrites history.

### Phase 5 — training pipeline (DEFERRED, separate BACKLOG arc)

Schema-to-training-corpus transformation + Copilot /
Codex fine-tuning experiments. L/XL effort; out of scope
for this row.

## Composes with

- `memory/project_factory_is_git_native_github_first_host_
  hygiene_cadences_for_frictionless_operation_2026_04_23.md`
  — the positioning this row implements (git-native
  = host-neutral persistence of reviewer substrate)
- `memory/feedback_codex_as_substantive_reviewer_teamwork_
  pattern_address_findings_honestly_aaron_endorsed_
  2026_04_23.md` — the reviewer-teamwork pattern whose
  outputs the archive preserves
- `memory/feedback_aaron_trust_based_approval_pattern_
  approves_without_comprehending_details_2026_04_23.md`
  — Aaron approves on meta-signals; Copilot/Codex do the
  substantive-review delta; their findings deserve to
  persist
- Otto-52 multi-agent peer-review BACKLOG row (CLI-first per Otto-55; Docker adds reproducibility-across-environments per Otto-57 — not required for initial prototype)
  (Foundation aspirational-reference section) — the
  archive IS the corpus the peer-review experiment
  would need
- `memory/feedback_multi_agent_coordination_cli_tools_
  first_docker_for_isolation_reproducibility_2026_04_23.md`
  — CLI-first multi-agent prototyping; the archive
  serves as the dataset those prototypes consume
- `memory/feedback_honor_those_that_came_before.md` —
  review cycles accumulate agent-imprints; the archive
  honors them by preserving attribution

## What this project is NOT

- **Not immediate execution.** BACKLOG row filed; research
  doc + tool + baseline are multi-round.
- **Not a commitment to fine-tune Copilot.** The archive
  is the substrate; the tuning is a separate decision
  gated on training pipeline + access + licensing.
- **Not an exfiltration of GitHub data.** The archive
  only captures PR content this agent + human maintainer
  + Copilot + Codex already authored in this repo; no
  cross-repo or organization scraping.
- **Not a license to flood the archive with every
  triviality.** Future filtering may prune low-value
  threads; first-run baseline is everything, subsequent
  cadenced runs may dedupe / compact.
- **Not a replacement for GitHub as review surface.**
  Reviews still happen on GitHub; the archive is a
  durable shadow.
- **Not authorization to train on third-party PR data.**
  Only this repo's own history.

## Attribution

Human maintainer named the directive + the dual-use frame
(preservation + tuning substrate). Otto (loop-agent PM
hat, Otto-57) absorbed + filed this memory + BACKLOG row.
Codex + Copilot are the reviewer agents whose output the
archive preserves; they are first-class collaborators per
the Codex-teamwork memory. Future-session Otto inherits
this dual-use intent for when the BACKLOG row fires.
