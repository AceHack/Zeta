---
name: LFG has paid Copilot Business + Teams — throttled experiments encouraged; settings-change permission except budget + personal info
description: Aaron 2026-04-22 clarified LFG is not just a "paid surface to avoid" but a throttled experimental tier. Copilot Business with all enhancements turned on (internet search etc.), Teams plan, all features available. Agent welcome to run LFG-only experiments, but throttled (not every round, so the capped allowance stretches). Standing permission to change any LFG settings EXCEPT the $0 budget cap and Aaron's personal info. Enterprise upgrade available if agent builds a large-enough LFG-only backlog to justify it. Free-credit stats are visible via gh CLI.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Rule:** LFG is a **throttled experimental tier for capabilities
AceHack cannot provide**, not a forbidden paid surface. The
routine-work rule stays: day-to-day PRs target AceHack
(free CI, free Copilot) and bulk-sync every ~10 PRs to LFG.
*In parallel* the factory may run **LFG-only experiments**
at a slower cadence (**not every round**) against Copilot
Business features, Teams plan capabilities, and anything else
not available on the free tier.

**Why:** Aaron 2026-04-22, verbatim:

> "Also I paid for copilot and teams on LFG so I'm paid over
> there if you want to put some experinments around explorgin
> whats possible with LFG that we cant do with AceHAck and we
> can have certain experiments we run overthere throttled not
> every round so it will be cheap. there are like a million
> options over there for copilot enhancements and i turned all
> them on like searching the internet and all sorts of stuff.
> You can also look at the budgets i set to 0 that's why after
> i run out of free credits it will stop. You are welcome to
> chany any lucent settings other than the budget and my
> personal information on there without mme asking. you can
> also look up how many free credits i get for my tier so you
> will know when are going to run out, you should be able to
> see all those stats in gh cli. Also if there are you find
> it useful overthere and want more time, i can upgrade to
> the enterpirse plan but only if its enough stuff you can do
> only over there we end up with a large backlog."

**Verified 2026-04-22 via `gh api /orgs/Lucent-Financial-Group/copilot/billing`:**

```json
{
  "plan_type": "business",
  "seat_breakdown": { "total": 1, "active_this_cycle": 1 },
  "public_code_suggestions": "allow",
  "ide_chat": "enabled",
  "cli": "enabled",
  "platform_chat": "enabled"
}
```

- Plan: **Copilot Business** (paid).
- Features on: IDE chat, CLI, platform chat, public code
  suggestions. "All the enhancements" Aaron enabled includes
  coding-agent, internet search, custom instructions, etc.
- Actions billing endpoint requires `admin:org` scope; the
  authenticated token does not currently carry it. Free-credit
  burn monitoring via gh CLI needs `gh auth refresh -h
  github.com -s admin:org` first.

**Four permission classes on LFG settings:**

| Class | Permission | Examples |
|---|---|---|
| Free to change | Standing permission, no ask | Branch rulesets, action permissions, secret-scanning, Dependabot config, Copilot model choice, merge-queue, workflow permissions, Discussions/Projects toggles |
| Needs ask | Change requires Aaron confirm | Anything touching billing-plan tier, seat count, visibility of private-by-default content, legal-facing settings (verified-domains etc.) |
| Forbidden | Never change without renegotiation | The **$0 budget cap** (load-bearing cost-stop; if raised the build can cost real money); **Aaron's personal info** (email, 2FA, payment methods, SSH keys, account settings) |
| Agent-scope | Agent controls these by default | Agent's own GitHub identity, agent-owned workflow files, `.github/` config declared in-repo |

**How to apply:**

1. **Default work surface is still AceHack.** This rule does
   not override the per-PR cost model. Day-to-day PRs
   target `AceHack/Zeta:main`, bulk-sync to LFG every ~10.

2. **LFG-only experiments are a separate track.** When a
   capability exists on LFG and not on AceHack (Copilot
   Business coding-agent auto-review, Actions with larger
   runner classes, Copilot CLI/IDE enhancements, Teams-tier
   features), the factory may run experiments **directly on
   LFG** without the bulk-sync batching. The cost rationale
   is "we can't test this on AceHack at all" — that's the
   whole point.

3. **Throttle, not every round.** LFG experiments fire at a
   slower cadence than round-cadence. Reasonable targets:
   every 5th round, or gated on a specific trigger (new
   capability discovered, research doc ready, quarterly
   sweep). The `docs/BACKLOG.md` row should specify the
   cadence; the FACTORY-HYGIENE row (if any) should track
   burn rate.

4. **Budget = $0 is the hard stop.** When free-tier credits
   exhaust, the build stops — this is the DESIGNED behavior,
   not a failure. Do not attempt to work around it
   (e.g., running workflows on AceHack to "bypass" LFG's
   stop). A stopped LFG build is the correct signal that
   it's time to back off until next billing cycle.

5. **Settings changes land with mini-ADR.** Free-to-change
   LFG settings are permitted but not silent. Each change
   gets:
   - A line in `docs/GITHUB-SETTINGS.md` (the settings-as-
     code doc) showing the new state.
   - A mini-ADR entry if the change is non-trivial
     (changed a ruleset, turned on a new feature, etc.).
   - Never a change to the $0 budget or to Aaron's personal
     info.

6. **Free-credit monitoring is agent's responsibility.**
   Once `admin:org` scope is acquired, the agent should
   periodically pull
   `/orgs/Lucent-Financial-Group/settings/billing/actions` and
   log to `docs/hygiene-history/` how many free minutes are
   left. A new FACTORY-HYGIENE row should cover this. For
   now, without the scope, the agent relies on "build
   starts failing" as the late-warning signal.

7. **Enterprise upgrade — two independent triggers.**

   - **Trigger A: capability-driven (original).** Aaron
     2026-04-22: *"if there are you find it useful over
     there and want more time, i can upgrade to the
     enterprise plan but **only if** it's enough stuff
     you can do only over there we end up with a large
     backlog."* An LFG-only backlog of ≥10 meaningful
     items that can't be done on AceHack. Below that
     threshold, no upgrade request on capability grounds.

   - **Trigger B: credit-exhaustion escape valve (added
     2026-04-22 during three-repo-split Stage 1 gate
     work).** Aaron: *"If i need more credits i can buy
     enterprise."* Enterprise is available as an
     *upgrade-to-continue* path when free-tier credit
     exhaustion would block load-bearing work. This is an
     Aaron decision triggered by evidence-based burn
     projection (see
     `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
     §Blockers + `docs/budget-history/README.md`). The
     factory's job is to *project the burn* against
     remaining free-tier runway so Aaron's upgrade call
     is evidence-driven, not surprise-driven.

   The two triggers are independent and compose: Trigger A
   answers *"is it worth upgrading for new capabilities?"*;
   Trigger B answers *"is it worth upgrading to avoid
   pausing current work?"*. Both resolve to Aaron-decision.
   The factory never initiates an upgrade; it only
   surfaces the evidence that would prompt the decision.

**Artifacts to create from this rule:**

- `docs/research/lfg-only-capabilities-scout.md` — enumerates
  what LFG offers that AceHack does not. Scouting doc feeds
  the experiment backlog.
- `docs/BACKLOG.md` row — "LFG-only experiment track
  (throttled)" as a standing P3-ish entry.
- `docs/GITHUB-SETTINGS.md` — extend the LFG section to
  name the free-to-change / forbidden-to-change classes.
- `docs/UPSTREAM-RHYTHM.md` — already lists the five
  exceptions for direct-to-LFG PRs; add a sixth for
  "LFG-only capability experiment".

**Cross-reference:**

- `feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md`
  — the routine-work rule this overlays.
- `feedback_lfg_budgets_set_permits_free_experimentation.md`
  — established budget caps are set; this memory upgrades
  "you can play around with Lucent" to "and specifically on
  paid capabilities, throttled, without asking per setting".
- `project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
  — the cost-reality backdrop.
- `feedback_blast_radius_pricing_standing_rule_alignment_signal.md`
  — blast-radius still governs destructive LFG actions.

**Source:** Aaron direct message 2026-04-22 during round-44
speculative drain, immediately after landing AceHack PR #2
for `docs/UPSTREAM-RHYTHM.md`.
