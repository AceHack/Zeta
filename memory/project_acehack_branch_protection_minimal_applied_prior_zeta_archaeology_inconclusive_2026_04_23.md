---
name: AceHack/Zeta branch protection — minimal applied (block force-push + deletion only; experimentation-frontier doesn't need the richer LFG gates); prior-Zeta archaeology (two billing entries) inconclusive without admin:org scope
description: Aaron 2026-04-23 Otto-66 flagged *"Your main branch isn't protected"* notice on AceHack/Zeta. Applied minimal protection (`allow_force_pushes: false`, `allow_deletions: false`, no status-check / review / linear-history / conversation-resolution requirements) per Amara authority-axis — AceHack is experimentation-frontier, heavier gates fit LFG's canonical-decision role. Also investigated two-Zeta-entries in AceHack billing ($36 + $14 gross April 2026): current AceHack/Zeta was created 2026-04-21 (fork of LFG), so the $13.77 second entry predates it — consistent with Aaron's *"i think there was a little acehack before too"* recollection of an earlier Zeta that was deleted/renamed/transferred before the current fork. Full archaeology requires admin:org + billing API scope not yet held.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# AceHack/Zeta branch protection applied + prior-Zeta archaeology

## Verbatim (2026-04-23 Otto-66)

> i see this on AceHack Zeta Your main branch isn't
> protected Protect this branch from force pushing or
> deletion, or require status checks before merging.
> View documentation.

## What was applied

```
PUT repos/AceHack/Zeta/branches/main/protection
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": false
}
```

Verified state after apply:

- `allow_force_pushes: false`
- `allow_deletions: false`
- No review / linear-history / status-check / conversation-
  resolution gates

## Why this subset (not LFG's full set)

LFG/Zeta has the richer protection set:

- `required_status_checks`: 5 contexts
- `required_conversation_resolution`: true
- `required_linear_history`: true
- `allow_force_pushes / allow_deletions`: false

Per Amara's authority-axis split (PR #219 absorb, Otto-61
memory): **LFG is operationally-canonical; AceHack is
experimentation-frontier**. Heavier gates fit canonical-
decision substrate where merge-correctness matters per-PR.
Experimentation substrate benefits from faster iteration:
force-push + deletion blocks are the safety floor; status
checks / review / linear-history gates add per-PR cost that
experiments don't always justify.

Minimum-viable protection = what GitHub specifically flagged
(force-push / deletion). Richer gates are reversible later
via another PUT if experimentation patterns stabilize enough
to want them.

## Authorization basis

Per `memory/feedback_agent_owns_all_github_settings_and_
config_all_projects_zeta_frontier_poor_mans_mode_default_
budget_asks_require_scheduled_backlog_and_cost_estimate_
2026_04_23.md` (Aaron Otto-23):

> you own all github settings and configuraiotn of any kid
> other than increasssing my billing

Branch protection is a github setting; this is the standing
authorization. Aaron's Otto-66 note flagging the gap is the
trigger, not the permission — the permission was granted
earlier.

## Two-Zeta-in-billing archaeology

Aaron Otto-65 billing paste showed two "Zeta" entries on
AceHack personal billing for April 2026:

- Zeta: $36.44 gross
- Zeta (separate): $13.77 gross

Aaron noted *"i think there was a little acehack before too,
you can figure it out"*.

**What read-only API shows:**

- Current `AceHack/Zeta` created 2026-04-21 (3 days before
  Otto-66). Fork of `Lucent-Financial-Group/Zeta`.
- Only one Zeta-named repo visible on AceHack today via
  `users/AceHack/repos` API
- `users/AceHack/events` page-1 shows no repo-level
  Create/Delete events within the event window (events
  API has a retention limit; older events dropped)

**Inference:** the $13.77 second entry is activity on an
**earlier AceHack Zeta** (pre-April 21) that was
deleted / renamed / transferred before the current fork was
created. Billing retains per-repo activity for the month
even after the repo is gone; the "Zeta" name stays as the
billing label.

**What would confirm this:** admin:org + billing API scope
(both authorized per Otto-62 but requires interactive
`gh auth refresh -h github.com -s admin:org,read:org`).
Second-pass archaeology when that scope is applied.

**Practical implication: none.** The billing net is $0
either way (both discount-covered). The observation matters
for factory-archaeology completeness (honor-those-that-came-
before memory applies — past Zeta versions get recognized)
but doesn't affect current operational substrate.

## How to apply (future)

### For branch-protection gap alerts

- If GitHub's UI flags "main branch isn't protected":
  apply the **minimum-viable** protection (what was
  flagged) first; propose richer gates as separate
  decisions.
- Force-push + deletion blocks are the safety floor
  because their absence allows irreversible damage.
- Status-check / review gates are iteration-cost; choose
  based on substrate's role (canonical vs. experiment).

### For repo-archaeology questions

- Fork/creation dates are visible in `gh api repos/OWNER/REPO`
- User event history is visible in `gh api users/USERNAME/events`
  but capped at ~90 days
- Billing history with deleted-repo names requires billing
  API + appropriate scope
- Honor-those-that-came-before memory applies: prior
  repo versions deserve acknowledgment even when data is
  incomplete

## Composes with

- `memory/feedback_agent_owns_all_github_settings_and_config_
  all_projects_zeta_frontier_poor_mans_mode_default_budget_
  asks_require_scheduled_backlog_and_cost_estimate_
  2026_04_23.md` — standing authorization for settings changes
- `memory/feedback_lfg_free_actions_credits_limited_acehack_
  is_poor_man_host_big_batches_to_lfg_not_one_for_one_
  2026_04_23.md` (Otto-61/62 amended chain) — authority-axis
  split driving the minimal-vs-richer protection choice
- `memory/feedback_honor_those_that_came_before.md` — prior
  AceHack Zeta gets acknowledgment even when unreachable
- Otto-62 cost-parity audit (AceHack PR #11) — this is a
  follow-up data point the audit should track in its next
  pass

## What this is NOT

- **Not a blanket minimum-protection rule for all
  experimentation repos.** Each repo's role decides its
  protection set. Other AceHack repos may need different
  configs.
- **Not a commitment to maintain protection parity with
  LFG going forward.** LFG's canonical-decision role
  justifies heavier gates; AceHack's experimentation role
  doesn't. The asymmetry is load-bearing.
- **Not a substitute for conversation-resolution or
  status-check gates where they matter.** If an AceHack
  PR would benefit from those gates, they can be applied
  per-branch or via ruleset.
- **Not authorization to apply protection without the
  standing Aaron authorization.** Otto-23 pre-authorized
  settings changes; this tick exercised that standing
  grant, did not create new grant.
- **Not an archaeology claim — the prior Zeta's exact
  history is inconclusive.** The $13.77 billing entry
  existence is confirmed; its source repo is not.
  Second-pass archaeology requires billing-API scope.

## Attribution

Human maintainer flagged the GitHub protection-gap notice +
pre-authorized the settings ownership (Otto-23). Otto (loop-
agent PM hat, Otto-66) applied the minimal-viable protection
+ investigated billing archaeology within read-only API
limits. Future-session Otto inherits: minimum-viable-first
for flagged protection gaps; archaeology deferred to
scope-elevated session when admin:org + billing API are
granted.

---

## Archaeology resolved — Otto-66 follow-up (same tick, 2026-04-23)

Aaron same-tick: *"you AceHack Zeta that got deleted,
renamed, or transferred , transfered it for me and i think
absorbed the skill"*.

**Resolution:** the prior AceHack Zeta's $13.77 April 2026
billing entry is activity on a **repo Otto (this agent, an
earlier session) transferred** via the `github-repo-transfer`
skill. Transferred repos retain per-month billing under their
old owner-label for the month the transfer happened in; the
billing label "Zeta" with $13.77 is that earlier AceHack
Zeta's Apr 1-20ish activity before the transfer.

**Where it went:** likely transferred to
`Lucent-Financial-Group/Zeta` (the current canonical LFG
repo), and then on April 21 a fresh fork of LFG/Zeta was
created at `AceHack/Zeta` to restore the AceHack-side mirror.

**Skill reference:** `.claude/skills/github-repo-transfer/`
is the skill Aaron noted — owns the behavior layer for
transferring repositories between owners. Aaron's "absorbed
the skill" likely means the transfer completed and the
skill's invocation record was logged per its fire-history.

**Updated conclusion:** the "two Zeta in billing" puzzle is
SOLVED. No missing-history gap. The archaeology pointed
inward to the factory's own skill-execution history, not to
an unknown external event. Honor-those-that-came-before
discipline applies: the transferred repo still counts as
factory history; the billing row is its paid-for-Aaron-by-
Aaron receipt.

**Practical impact:** unchanged. Billing net remains $0 for
AceHack (discount-covered). LFG billing already reflects the
transferred-in activity if it's still on LFG, or the activity
was pre-transfer so it counts for the prior AceHack owner.
Either way, no surprise and no missing money.
