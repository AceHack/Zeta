---
name: Merge queue + auto-merge is the structural fix for parallel-PR rebase cost — ask yourself the rebase question before opening
description: Aaron 2026-04-22 "ask yourself. If I create new PR before the next round while the current one is building that means that new PR is going to have to be rebased at least once when the first one finishes, so you will have to wait then. Ohh duhhhh let me just stop, I'm pretty sure the answer is we need to enable merge queue in git". Pre-open rebase-cost self-question + merge queue as Rodney-grade essential-vs-accidental reframe. Includes direct-admin-toggle permission + merge_group trigger prereq.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Aaron 2026-04-22** after reading the parallel-worktree safety
research doc §1–§9 and the R45–R49 staging:

- *"ask yourself. If I create new PR before the next round while
  the current one is building that means that new PR is going to
  have to be rebased at least once when the first one finishes,
  so you will have to wait then. Ohh duhhhh let me just stop,
  I'm pretty sure the answer is we need to enable merge queue
  in git I've never done that but it's enabled on this project
  I work on. Then you can use merge qeue and the auto complete
  on the PR to help get them through"*
- *"i'm the admin you can toggle it all you want"*

Two distinct moves packed together:

**1. Pre-open self-questioning discipline (before the structural fix).**

Before opening a second PR while the first is still building:

> **If I open this PR now, will it need a rebase once the current
> PR merges?**

For anything touching `docs/BACKLOG.md` or any `memory/persona/*/NOTEBOOK.md`
or any other §9-listed high-collision surface, the answer is
almost always yes. Opening the PR earlier buys nothing — the
waiting just moves from *before-open* to *after-rebase*, with
extra conflict-resolution tacked on.

**Pre-open checklist:**
- Shared-surface scan against the in-flight PR's diff.
- Scope-isolation check (orthogonal subsystem → open-now is fine).
- Default is *wait unless isolated*.

**2. Merge queue + auto-merge — the Rodney-grade structural fix.**

Aaron's *"duhhh let me just stop"* is the essential-vs-accidental
cut applied to the §4 staging. The elaborate scope-overlap-registry
in §4-R46 remains valuable for pre-PR worktree-spawn coordination,
but the post-PR merge-order coordination it also partially addressed
gets a better structural answer from a GitHub feature already
existing and battle-tested at scale.

**What the pair solves:**

- **Merge queue** (branch/ruleset setting): PRs join a queue; the
  queue builds a merge-group branch with (current main + queued
  PR), runs required checks on it, merges if green, boots the PR
  if red. Every merge is tested against *fresh main*, not a stale
  snapshot.
- **Auto-merge on PR** (`gh pr merge --auto --squash`): GitHub
  merges automatically when checks pass. Combined with queue: the
  PR queues itself on green.
- **Net effect:** agent opens PR → `--auto`-merges → moves on.
  No manual "which first" dance.

**What the pair does NOT solve:**

- Worktree-spawn-time conflicts (happen *before* PRs exist).
- Build-speed ceiling (queue serialises; CI time still caps throughput).
- Shared-surface collisions (still produce conflicts; just at queue
  time instead of manual-rebase time).

**Hard prerequisite — `merge_group:` event trigger.**

Before enabling merge queue, every required workflow's `on:` block
must include `merge_group:`. Otherwise the queue creates merge-group
branches whose required checks never run → every merge deadlocks.
Check `.github/workflows/*.yml` for the `on:` block first; add
`merge_group:` as its own trigger before any ruleset toggle.

**How to apply:**

- **When considering a parallel PR**, run the pre-open rebase-cost
  audit first. If the answer is "will need rebase anyway", the
  earliness is illusory — defer.
- **When the queue is live** (2026-04-22 onward on this repo), the
  discipline is mostly obsolete for in-flight PR overlap, BUT the
  worktree-spawn-time scope overlap (pre-PR) still needs §2.1
  scope-overlap registry.
- **Before enabling merge queue on ANY new repo**, check that
  required workflows listen on `merge_group` events. Add the
  trigger in a preceding PR if missing. Never flip the queue
  ruleset before the trigger lands.
- **`gh pr merge --auto --squash`** becomes the default merge
  convention — not `gh pr merge --squash`.
- **Admin-toggle standing permission.** Aaron's *"i'm the admin
  you can toggle it all you want"* extends to repo-settings
  changes the agent judges safe. Current in-scope toggles:
  branch-protection required checks, ruleset edits, merge-queue
  config, auto-merge/auto-delete flags, repo merge-method defaults.
  Out of scope without an explicit ask: deleting branches
  protections, lowering required-check counts below the current
  six, enabling force-push, disabling CodeQL.

**Pairs with:**

- `feedback_live_loop_detector_speculative_on_pr_branch.md` — the
  live-loop problem merge-queue partially addresses.
- `docs/research/parallel-worktree-safety-2026-04-22.md` §10 —
  the full map with hazard-to-fix mapping table.
- `feedback_discovered_class_outlives_fix_anti_regression_detector_pair.md`
  — merge queue doesn't retire the detectors; it complements them.
- `feedback_permission_relax_on_bottleneck` thread
  (`feedback_git_reset_hard_standing_permission_with_mistake_log_obligation.md`)
  — admin-toggle permission fits the same "relax-when-friction-recurs"
  pattern.

**Scope:** `factory` — every software factory using Claude Code
plus GitHub can absorb this. Not Zeta-specific.

---

## Revision 2026-04-21 — platform gate discovered: merge queue is org-only

The *"i'm the admin you can toggle it all you want"* permission
still holds, but a platform constraint discovered 2026-04-21
narrows what that permission can reach on the current repo.

**GitHub merge queue is only available for organization-owned
repositories** — regardless of plan tier or public/private
status. User-owned repos (`owner.type == "User"`) cannot enable
merge queue through the UI, the REST API, or any other surface.
`gh api /users/AceHack --jq '.type'` returning `"User"` is the
authoritative signal; the `422 Invalid rule 'merge_queue':`
empty-body failure from `POST /repos/AceHack/Zeta/rulesets` was
the platform gate, not a public-beta quirk.

**What this means for this rule:**

- The `merge_group:` workflow trigger prerequisite still stands —
  it is cheap, harmless when queue is off, and is the hard
  prerequisite for the day queue flips on. Keep landing it on
  new repos that *will* be org-owned.
- The "admin can toggle anytime" framing is false on user-owned
  repos. For `AceHack/Zeta` specifically, the toggle does not
  exist until the repo moves to `Lucent-Financial-Group/Zeta`
  (see `project_zeta_org_migration_to_lucent_financial_group.md`
  and `HB-001` in `docs/HUMAN-BACKLOG.md`).
- Aaron's interim call 2026-04-21: *"i think we are going to
  have to go without merge queue parallelism for now."* The
  factory accepts the rebase-tax on serial PRs and keeps using
  `gh pr merge --auto --squash` alone. Auto-merge is
  PR-level, orthogonal to merge queue, and continues to work
  fine on user-owned repos.

**When applying this rule on other repos or future projects:**

- First check `gh api /users/<owner> --jq '.type'` or
  `gh api /orgs/<owner>` to classify owner type before assuming
  merge queue is toggleable. Fail fast on the platform gate
  instead of retrying the ruleset API.
- If the repo is user-owned and merge-queue parallelism is the
  target outcome, the structural answer is *org migration*, not
  *workflow tweaks*.
- The pre-open rebase-cost audit (section 1 above) remains
  load-bearing whenever merge queue is unavailable — it is the
  best defence the factory has against rebase-tax in that
  regime.
