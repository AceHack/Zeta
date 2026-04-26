---
name: Fork-based PR workflow — LFG/Zeta is the home, AceHack/Zeta-fork is where Aaron develops with his paid Copilot
description: Aaron 2026-04-21 proposal — "this will be the home of the repo but the fork to my private account and that's how we submit PRs then I can get all the checks right?" Cost-aware dev flow after the LFG transfer: keep LFG/Zeta as the public contributor-facing home, fork it to Aaron's personal account so his paid Copilot + paid model usage runs on the fork where HE is billed, submit PRs from fork → LFG. Aaron's own follow-up objection "But we wont get the merge queu" is answered: merge queue + fork PRs ARE compatible on GitHub; the `merge_group:` trigger runs on the base repo with full permissions. Contributor path is identical.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# Fork-based PR workflow for the LFG repo

Aaron's 2026-04-21 proposal, in the round immediately after
the org-transfer landed:

1. *"how about this, this will be the home of the repo but
   the fork to my private account and that's how we submit
   PRs then I can get all the checks right?"*
2. *"But we wont get the merge queu"* — his own
   follow-up objection, to be addressed.

**Why:** Post-transfer, LFG/Zeta is a separate billing
surface. Paid Copilot + model inference costs flow to whoever
owns the account running the action. Aaron already has paid
Copilot on his personal account
(`github.com/AceHack`). If Aaron develops against a **personal
fork** of the LFG repo, his personal-account billing handles
the Copilot + model usage during his authoring flow. When
he's ready to land work, he opens a PR **fork -> LFG/Zeta**,
and LFG's rulesets / required checks / branch protections
enforce the gate. The LFG repo stays cost-thin: no seat
usage for Aaron's personal development, only for PR-time
checks that LFG is configured to run.

This matches the standard OSS maintainer pattern. It's the
flow every external contributor will use too — Aaron is
explicitly choosing to eat his own dogfood.

## The merge-queue concern

*"But we wont get the merge queu"* — Aaron's own counter.
Answer: **merge queue and fork-based PRs are compatible.**

- Merge queue runs on the **base repo** (LFG/Zeta), not the
  fork. When a PR is added to the queue, GitHub creates a
  temporary merge-ref on LFG/Zeta and fires `merge_group:`
  events against LFG/Zeta's workflows.
- Our `gate.yml` already has `merge_group:` in its `on:`
  triggers (landed PR #41). Checks at merge-queue time run
  on LFG/Zeta with full permissions and LFG/Zeta's secrets.
- Fork PRs do have a restriction on `pull_request:`-event
  access to secrets (GitHub's security posture — forks
  cannot steal secrets by opening a PR), but this is
  addressed by:
  - `pull_request:` checks that don't need secrets work
    unchanged (our `gate.yml` doesn't reference secrets).
  - Checks that DO need secrets fire on `merge_group:`
    instead, where the base repo's permissions govern.
- Required-status-check rules in the ruleset apply to the
  merge-queue-created merge commit, not the PR HEAD.

So the sequence is:

1. Aaron (or any contributor) opens PR from fork -> LFG/Zeta.
2. `pull_request:` checks run on the fork's HEAD SHA with
   base-repo workflows, no secrets.
3. Reviews / Copilot code review / whatever LFG-paid checks
   exist run on LFG/Zeta's dime.
4. Aaron enables auto-merge (or the merge queue after it's
   opted in).
5. When the PR reaches merge eligibility, merge queue adds
   it, runs `merge_group:` checks on a temp merge ref, and
   merges on success.

The only thing Aaron does NOT get is merge-queue
parallelism-across-concurrent-PRs **benefit** if we never
opt in to merge queue in the first place. HB-001 already
notes merge queue enable is "a separate opt-in step — not
executed yet." Nothing about fork-based PRs changes that.

## How to apply

### What Aaron does

1. Visit `https://github.com/Lucent-Financial-Group/Zeta`
   and click **Fork** -> choose personal account AceHack.
   This creates `AceHack/Zeta` as a fresh fork (the old
   user-owned repo is now a transfer redirect; the fork
   will be a distinct new repo).
2. On local clone, add the fork as a second remote:
   ```bash
   git remote rename origin upstream     # LFG/Zeta = upstream
   git remote add origin git@github.com:AceHack/Zeta.git   # personal fork = origin
   ```
   Now `git push` lands branches on the fork; `git fetch
   upstream` pulls LFG/Zeta's state.
3. PRs are opened fork -> LFG/Zeta via `gh pr create --repo
   Lucent-Financial-Group/Zeta --head AceHack:branch-name`
   (or the web UI equivalent).

### What agents do

- **Default remote-model for new clones post-fork.** Scripts
  that automate clone / setup should either detect the
  fork-based remote layout or accept a `--fork` flag. Do
  NOT assume `origin = LFG/Zeta` after the fork lands.
- **PR creation flows go fork -> LFG.** Any `gh pr create`
  in agent scripts must target `Lucent-Financial-Group/Zeta`
  explicitly, not rely on the default (which would target
  the push-remote's repo).
- **Agent-run commits push to the fork** by default. The
  exception is one-off settings-admin work that genuinely
  needs to be on the LFG repo directly (e.g. running the
  snapshot script against live data, emergency settings
  revert). Those are rare and should be explicit.
- **Respect LFG/Zeta's cost surface.** Copilot-fired checks
  on the PR bill LFG. Keep the set narrow — the "only
  Copilot features that buy a material review-quality
  outcome" rule from
  `project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  governs.

## Constraints to preserve

- **Fork-based flow does not retire HB-001's merge-queue
  opt-in.** Merge queue enable is a separate step; fork
  PRs work with or without it. Keep HB-001 open for the
  merge-queue toggle; close it only when merge queue is
  live AND a fork-based PR has been seen flowing through
  it cleanly.
- **Do not collapse the fork's settings to mirror LFG/
  Zeta.** The fork is Aaron's personal development surface;
  the `docs/GITHUB-SETTINGS.md` + drift detector are
  scoped to `Lucent-Financial-Group/Zeta` only. A separate
  snapshot of the fork would be noise.
- **Contributor docs need the fork flow documented.** When
  we write CONTRIBUTING.md (currently empty per the
  pre-v1 state), the fork-and-PR flow is the canonical
  contributor path, not a special AceHack-only flow.
- **Don't enable auto-fork-sync** on the AceHack fork
  without Aaron approving — auto-sync can overwrite
  in-flight fork branches. Manual `git fetch upstream &&
  git merge upstream/main` is safer for Aaron's personal
  cadence.

## Cross-references

- `project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  — why the fork-based flow exists (cost asymmetry between
  Aaron's personal account and the LFG org).
- `project_zeta_org_migration_to_lucent_financial_group.md`
  — the transfer that created the two billing surfaces.
- `feedback_merge_queue_structural_fix_for_parallel_pr_rebase_cost.md`
  — merge-queue motivation; HB-001 still tracks the
  enable-opt-in.
- `docs/HUMAN-BACKLOG.md` — HB-001 row.
- `docs/GITHUB-SETTINGS.md` — LFG-only declarative settings
  surface; do not extend to the fork.
- `project_lucent_financial_group_external_umbrella.md`
  — LFG umbrella framing.
