---
name: TRUNK-BASED DEVELOPMENT — only `main` is long-lived; everything else is a SHORT-LIVED branch (hours to days, merged-or-pruned within ~1-3 days at most); we do NOT keep every branch; dead branches + abandoned branches + unmerged-past-their-time branches get pruned without regret; TBD violation threshold (proposed): branch age > 7 days + not actively being merged = prune-or-roll-forward-recover; composes with Otto-257 clean-default smell (drift triggers audit) + Otto-259 verify-before-destructive (sample-check before bulk delete) + Otto-254 roll-forward (recover via new short-lived branch, don't resurrect the stale one); resolves the 19 LOST branches problem — each gets triaged: unique-valuable-content → roll-forward recover on fresh branch / already-obsolete → prune; Aaron Otto-262 2026-04-24 "we can cleanup branches we only need main and short lives branches that dont violate trunkbased development, we don't want to keep every branch"
description: Aaron Otto-262 branch-hygiene directive. Sharpens the "keep things clean" default (Otto-257) with a named branch-lifecycle policy — TBD. Changes the LOST-branch recovery calculus: NOT "preserve forever," but "roll-forward-recover OR prune fast." Save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Only `main` is long-lived. All other branches are
SHORT-LIVED — they exist to carry one unit of
in-flight work, merge, and die.**

Direct Aaron quote 2026-04-24:

> *"we can cleanup branches we only need main and short
> lives branches that dont violate trunkbased
> development, we don't want to keep every branch"*

## The composition triad — why TBD specifically

Aaron 2026-04-24 addendum:

> *"all this is post drain but we talked about this
> already and github flow if we are hosted on github
> and branch deploy for our ops setup if we are on
> github host but also git native everyting first
> that's why trunkbased."*

Three patterns compose:

1. **Trunk-based development (TBD)** — short-lived
   branches, main is the only long-lived trunk.
   *This memory.*
2. **GitHub Flow** — the natural workflow for
   GitHub-hosted repos: branch from main → push →
   PR → auto-merge → auto-delete-head-branch. The
   PR is the review + deploy unit. Composes with TBD
   because GitHub Flow ASSUMES branches are short-
   lived.
3. **Branch deploys** — ops pattern for GitHub-hosted
   projects: each branch can be deployed to a
   preview/staging environment (via GitHub
   Environments + Actions per-branch deployment
   rules). Validates the change before merge.
   Composes with TBD + GitHub Flow.

**The root principle — gitnative-first (Otto-261)
IMPLIES TBD.** If every artifact must live in git
durably, then one canonical trunk is where the
corpus aggregates. Long-lived branches fragment the
canonical view — "which branch is the source of
truth for X?" becomes a live question. TBD
eliminates that question by design: main is the
canonical, everything else is in-flight toward main
or toward the waste bin.

Said differently: you don't get to be "gitnative
everything" AND "forever branches" at the same time.
Otto-261 (gitnative) and Otto-262 (TBD) are two
sides of the same discipline: one canonical store,
short-lived workspaces converging on it.

## The policy

**Acceptable branch lifecycle** (TBD-conformant):

1. Branch `feat/X` born from main.
2. Commits pushed within hours.
3. PR opened within the same day.
4. Merged (squash) or pruned within ~1-3 days total.
5. Auto-delete-head-branches setting removes it on
   merge.

**TBD-violating branch states** (get audited +
resolved):

- **Age > 7 days, not actively merging** — drift.
  Either force-drain (close threads, rebase, merge)
  or prune.
- **No associated PR** — drift. If content is unique
  + valuable, file roll-forward PR from fresh branch;
  else prune.
- **PR closed-not-merged, branch still exists** —
  drift. Per Otto-257, decide: unique-content-worth-
  recovery → fresh roll-forward branch, OR
  superseded-on-main → prune.
- **Open PR with age > 14 days** — structural
  problem (review debt, test fragility, too large,
  etc.) — requires root-cause fix or scope-split.

## Applies to the 19 LOST recovery set

Per Otto-257's re-audit, 14 LOST-CLOSED-NOT-MERGED
+ 5 LOST-ORPHAN branches hold unmerged content.
Otto-262 says: don't preserve them as branches.
Decision tree per branch:

1. **Is the content unique + valuable?** (Per
   Otto-257 smell triage.)
2. **If YES** → roll-forward per Otto-254: file
   NEW short-lived branch from current main with
   the recovered content applied, open PR, merge,
   delete. The OLD branch gets pruned once its
   content is preserved via the new PR (or via
   git-native PR preservation per Otto-250).
3. **If NO** → prune. The branch was drift, not
   lost work.
4. **Either way, the old branch dies** — only main
   + the new short-lived recovery branch survive.

## Composition with prior memory

- **Otto-250** PR reviews are training signals —
  TBD says the PR itself is the surviving record;
  the branch is disposable once PR is archived.
- **Otto-251** entire repo is training corpus —
  TBD keeps the corpus signal-dense: no stale-
  branch noise.
- **Otto-254** roll-forward default — Otto-262
  operationalizes: when recovering LOST content,
  forward-roll to NEW short-lived branch, don't
  resurrect the dead one (old branch stays
  dead; new branch carries).
- **Otto-257** clean-default smell — Otto-262 adds
  a named threshold: branch age > 7 days is a
  hard smell signal.
- **Otto-258** auto-format on PR — removes format-
  drift as an excuse to leave a branch open longer.
- **Otto-259** verify-before-destructive — applies
  on bulk-prune: sample-check each branch for
  unique-content before delete. Doesn't override
  Otto-262; prevents accidental loss WITHIN
  Otto-262's prune policy.
- **Otto-260** F#/C# markdown preservation —
  unchanged; branch lifecycle is orthogonal to
  content rules.
- **Otto-261** gitnative-store all GitHub artifacts
  — the sync preserves PR content (so branch
  pruning doesn't lose signal); composes
  perfectly with Otto-262.

## Factory-level implementation (backlog-owed)

Phase 1 — one-time sweep:
- Execute Otto-257 smell audit on existing 19 LOST
  branches. For each: triage (recover vs prune).
- Recover candidates → new short-lived branches
  via Otto-254 roll-forward.
- Prune candidates → delete locally + remote +
  worktree.

Phase 2 — standing hygiene:
- `tools/hygiene/tbd-branch-audit.sh` — weekly
  cron / FACTORY-HYGIENE row. Lists branches
  by age; flags > 7d with no active merge signal.
- Per-branch decision routed to archive-or-fix
  BACKLOG row.

Phase 3 — default automation:
- Auto-delete-head-branches: already on (verify).
- Auto-merge armed at PR open: already on (verify).
- Branch-age notification on PR dashboard: future.

## What TBD does NOT say

- Does NOT forbid experimental branches (spike,
  research, proof-of-concept). Those just get
  explicitly LABELED as experimental + either
  merged-to-main-behind-flag OR pruned when done.
- Does NOT require nuking a branch with active
  review in progress, even past 7 days. The
  *signal* fires at 7 days to PROMPT review of
  whether the branch is structurally-stuck vs
  just in late-cycle review. Review-as-a-process
  can legitimately take > 1 week for a large PR.
- Does NOT apply to protected main / release
  branches on other repos where a release
  branch is load-bearing (Zeta has none of those
  — pre-v1, main-only).
- Does NOT license bypassing Otto-259 verify-
  before-destructive. Bulk-prune a TBD-violating
  branch still requires the gate's sample check.

## The 19 LOST triage — applied form

(For task #264 execution, post-drain.)

**P0**: `pr144` (36 commits) — probably large review-
response batch on the FactoryDemo demo PR. Audit:
is any of the 36 commits content still in-flight?
Decision: per-commit triage, likely roll-forward as
one or two small short-lived branches targeting
current main, not 36-commit recovery.

**P1**: `worktree-agent-aa4dbc7cedbd9eb3e`
(28 commits) — Otto-99 tick-close content.
Otto-99 tick-history row is needed; if not already
on main via a later tick-close merge, roll-forward
on new short-lived branch.

**P2**: 12 `history/otto-NN-tick-close` branches
(1-32 commits each) — tick-history rows. If the
tick-history file on main already has these rows,
these branches are supersession-drift (prune). If
not, batch-recover in one short-lived branch that
lands ALL missing tick rows per Otto-229
append-only.

**P3**: #314, #313 BACKLOG rows (1 commit each) +
single-commit orphan branches. Quick audit, batch-
recover or prune.

## Direct Aaron quote to preserve

> *"we can cleanup branches we only need main and
> short lives branches that dont violate trunkbased
> development, we don't want to keep every branch"*

Future Otto: the default for any branch in the
repo is "will this merge within ~3 days?" If no,
that branch is suspect. Don't hoard branches.
Recover or prune — not preserve.
