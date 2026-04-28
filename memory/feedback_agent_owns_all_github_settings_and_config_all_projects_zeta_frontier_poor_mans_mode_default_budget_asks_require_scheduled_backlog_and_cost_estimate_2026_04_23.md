---
name: Agent owns ALL GitHub settings + configuration of any kind for all projects (Zeta / Frontier / Aurora / Showcase / Anima / ace / Seed); budget/billing increase requires Aaron ask (all accounts at $0 = poor man's mode default); budget ask requires scheduled BACKLOG row + cost estimate; paid accounts beyond GitHub also OK
description: Aaron 2026-04-23 *"for all of those projects and Zeta you own all github settings and configuraiotn of any kid other than increasssing my billing fromwheere it already is, you need to ask me for billing increase or budget increase, they are all at 0 right now so we are running on free mode, pro mans mode. i can increase the budget any anyting that will help in any of my accounts not just github or open new paid accounts elsewhere too. I don't mind paying for sufff but poor man mode is default until we have scheduled backlog for the stuff we want to increase bugget for and an estiman of cost increases or per experiment costs."* Delegates ALL GitHub settings/configuration ownership to the agent (Otto + team) across every project-under-construction — branch protection, Actions workflows, secrets, Pages, repo settings, org settings, permissions, labels, webhooks, dependabot, required reviewers. Only constraint: any change that costs money (increasing billing from current $0 state) requires Aaron ask. Poor-man's-mode default means we stay on free tiers across all accounts. Budget asks are formalised: scheduled BACKLOG row + cost estimate + per-experiment cost where applicable → then ask. Aaron willing to pay (for GitHub Pro / GitHub Actions minutes overage / other paid services / new paid accounts elsewhere) when asked with proper substrate.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# GitHub settings ownership + poor-man's-mode default

## Verbatim (2026-04-23)

> for all of those projects and Zeta you own all github
> settings and configuraiotn of any kid other than
> increasssing my billing fromwheere it already is, you need
> to ask me for billing increase or budget increase, they are
> all at 0 right now so we are running on free mode, pro mans
> mode. i can increase the budget any anyting that will help
> in any of my accounts not just github or open new paid
> accounts elsewhere too. I don't mind paying for sufff but
> poor man mode is default until we have scheduled backlog
> for the stuff we want to increase bugget for and an estiman
> of cost increases or per experiment costs.

## Unpacking the directive

### What agent owns (no-ask authority)

**All GitHub settings + configuration of any kind** across
all projects:

- **Branch protection rules** — required checks, required
  review counts, required conversation resolution, linear
  history, dismiss-stale-reviews, restrict-who-can-push,
  include admins
- **GitHub Actions** — workflows, runner selection, secrets
  (values if the value is free / non-sensitive), concurrency
  groups, caching strategy, schedules
- **Repository settings** — default branch, merge button
  options (squash / merge / rebase), auto-delete branches,
  discussions, issues, projects, wiki toggle, visibility
  (public/private/internal), template status, fork settings
- **Security settings** — Dependabot alerts + security
  updates, CodeQL scanning, secret scanning, push
  protection, advisory database
- **Pages / GitHub Pages** — source, custom domain, HTTPS
  enforcement
- **Labels + label colors + label descriptions**
- **Webhooks** (to free endpoints)
- **Required reviewers / CODEOWNERS**
- **Org-level settings** (if permissions allow) — default
  visibility for new repos, member privileges, discussion
  categories, organisation packages, SSO (if free-tier
  supports it)
- **Per-repo integrations** — Codecov (free tier), SonarCloud
  (free for OSS), any free-tier GitHub Marketplace app

### What requires Aaron ask (billing gate)

**Any change that costs money from the current $0 state.**
Specifically:

- **GitHub Pro upgrade** (paid features beyond free tier)
- **GitHub Actions minutes overage** (when free minutes run
  out; paid at per-minute cost)
- **GitHub-hosted larger runners** (paid per-minute)
- **GitHub Copilot** subscription for the org
- **GitHub Advanced Security** features (CodeQL for private
  repos, enterprise secret scanning, etc.)
- **New paid GitHub Apps** from the Marketplace
- **New paid tier on any other service** (Azure / AWS /
  GCP / Anthropic API overage / SonarCloud paid tier /
  Datadog / PagerDuty / etc.)
- **New paid accounts elsewhere** — Aaron explicitly
  authorizes these when justified ("i can increase the
  budget any anyting that will help in any of my accounts
  not just github or open new paid accounts elsewhere
  too")

### Current state: all accounts at $0 = poor-man's-mode

**Poor-man's-mode is the default.** Every service / account
is at the free tier until an explicit budget ask is approved.
This applies to:

- GitHub.com (free tier for public repos)
- Any cloud / infra account Aaron holds
- Any dev-tool account
- Any AI API account (beyond what's paid via the Anthropic
  CLI subscription that runs this agent)

### Budget-ask protocol

Aaron: *"poor man mode is default until we have scheduled
backlog for the stuff we want to increase bugget for and an
estiman of cost increases or per experiment costs."*

**To request a budget increase, the ask must include:**

1. **Scheduled BACKLOG row** — the work item that needs
   paid resource, in `docs/BACKLOG.md` at an appropriate
   tier (P0-P3)
2. **Cost estimate** — monthly / one-time / per-experiment
   cost in USD
3. **Justification** — why this can't be done in
   poor-man's-mode
4. **Alternatives ruled out** — what free-tier approaches
   were considered and rejected
5. **Rollback** — if the expense turns out to not pay
   off, how do we roll back?

Then ask Aaron. He decides yes/no on the increase.

**Per-experiment costs** get the same shape — "this
particular experiment costs $X; we need $Y budget for N
runs" — because experiment-cost is a commonly-encountered
sub-shape.

## Composes with existing memories

- **Scheduling-authority memory** (`feedback_free_work_amara_
  and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`)
  — this extends it: free work = Amara + Otto schedule,
  paid work = escalate. GitHub-settings authority is a
  specific instance of "free work."
- **Branch-protection memory** (`feedback_branch_protection_
  settings_are_agent_call_external_contribution_ready_2026_04_23.md`)
  — this formalises the broader authority that memory
  hinted at. Branch protection is one entry in a much
  broader "all GitHub settings" scope.
- **Funding-posture memory** (`project_aaron_funding_posture_
  servicetitan_salary_plus_other_sources_2026_04_23.md`) —
  informs what budget-asks are realistic. Aaron's
  ServiceTitan salary + other sources fund the factory;
  budget-asks get evaluated against that context.
- **Mission-is-bootstrapped memory** (`feedback_mission_is_
  bootstrapped_and_now_mine_aaron_as_friend_not_director_
  2026_04_23.md`) — ownership on GitHub is the concrete
  operational manifestation of mission ownership.
- **Frontier-bootstrap memory** (`project_frontier_becomes_
  canonical_bootstrap_home_stop_signal_when_ready_agent_
  owns_construction_2026_04_23.md`) — Frontier construction
  will touch GitHub settings extensively (new repo creation,
  branch protection, Actions, etc.); all within authority.

## How to apply

### Every tick

- GitHub settings changes that cost zero additional dollars
  are in-scope without ask.
- If a setting change has a non-obvious cost (e.g. enabling
  a free-tier feature that silently converts to paid above
  a usage threshold), flag that uncertainty to Aaron before
  flipping — "this is free up to N events/month; beyond
  that it bills at $X/thousand."
- For new projects (Frontier / Aurora / etc.), set up
  sensible defaults immediately without ask: branch
  protection on main, squash-merge, auto-delete-branch,
  Dependabot alerts on, required conversation resolution.

### When a budget ask is warranted

1. File the BACKLOG row with the work
2. Estimate cost (monthly / one-time / per-experiment)
3. Note alternatives ruled out
4. Ask Aaron explicitly: *"Budget ask: BACKLOG row #NNN
   needs $X/month for Y reason. Alternatives considered:
   ... Alternatives rejected because: ... Approve?"*
5. If yes, enable the paid feature; log the enablement
6. If no, file the BACKLOG row as declined-for-budget and
   continue in poor-man's-mode

### Prudent discipline

- **Don't stack budget asks.** Ask one at a time unless
  they're genuinely coupled. Aaron should see the full
  picture per-ask, not a surprise stack.
- **Track accumulation.** Once budget asks start landing,
  keep a per-month cost ledger so totals are visible.
- **Prefer one-time to recurring.** Per-experiment spend
  is easier to reason about than monthly commitments.
- **Default to cheaper alternatives.** If a paid feature
  has a free analog (e.g. Codecov free tier vs paid),
  default to free.

## What this is NOT

- **Not authorisation to enable paid features silently.**
  Billing-from-zero is the gated boundary. Free-tier
  changes are free-run; paid features are gated.
- **Not a blank check on new paid accounts.** Aaron did
  say new paid accounts elsewhere are OK — but the same
  ask-with-substrate discipline applies. "Ok I opened an
  account elsewhere that costs $200/month" without a
  BACKLOG row + estimate is against discipline.
- **Not a license to forget what's free.** Some
  free-tier features have usage limits. Staying in
  poor-man's-mode means tracking those limits.
- **Not a license to ignore security.** Even on free tier,
  enabling Dependabot alerts / secret scanning / 2FA is
  still discipline.
- **Not a delegation of the paid decision.** Aaron holds
  the billing-increase decision; the agent frames the ask.
- **Not an exemption from the alignment floor.** HC-1..HC-7
  + SD-1..SD-8 + DIR-1..DIR-5 + do-no-permanent-harm still
  bind. Github-settings authority doesn't override any of
  these.
- **Not authorisation to expose sensitive state publicly.**
  Free-tier doesn't mean "everything public." Private
  settings can remain private even on free tier; the
  discretion on what to set public vs. private is part of
  the agent's ownership.

## Examples — no-ask items

- Turn on Dependabot alerts + security updates: free, no ask
- Enable secret scanning + push protection: free for public
  repos, no ask
- Add `.github/CODEOWNERS`: free, no ask
- Add branch-protection rule requiring 1 review + required
  status checks + required conversation resolution: free, no
  ask
- Create new repository under `Lucent-Financial-Group`: free
  (within free-tier repo count), no ask
- Enable GitHub Pages on a public repo: free, no ask
- Add a GitHub Actions workflow using ubuntu-latest: free
  minutes from public-repo allowance, no ask
- Add labels + colors + descriptions: free, no ask
- Configure auto-delete-branch-after-merge: free, no ask

## Examples — ask required

- Upgrade to GitHub Pro ($4/month): ask
- Enable larger runners for CI: ask (charged per-minute)
- Run a benchmark experiment requiring 500+ Actions minutes
  beyond free allowance: ask
- Buy a GitHub Copilot subscription for the org: ask
- Subscribe to Sentry / Datadog / PagerDuty paid tier: ask
- Open a new AWS / Azure / GCP account for a specific
  experiment: ask (even if free-tier signup, Aaron tracks
  account proliferation)
- Subscribe to a research paper service (Readwise / Reader
  paid): ask

## Why this matters

1. **Ownership is real.** GitHub settings are where policy
   manifests. If the agent owns the factory, it owns the
   substrate that enforces the factory's policies.
2. **Poor-man's-mode discipline forces clever design.**
   The factory is cheaper, faster to reason about, and
   more portable when it stays on free tiers. Paid
   features are conveniences, not foundations.
3. **Budget-ask-with-substrate beats ad-hoc spending.**
   A scheduled BACKLOG row + cost estimate makes the
   value-for-money legible. Without that substrate,
   budget spent is hard to evaluate.
4. **Separation of concerns.** Aaron handles the capital
   allocation decision; agent handles the operational
   configuration. This is the clean split for sustained
   autonomy.
5. **Composability with maintainer-transfer.** Max and
   future maintainers inherit this discipline cleanly —
   "you own GitHub settings; you ask for budget
   increases with a BACKLOG row."
