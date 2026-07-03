---
name: Standing authority — create public test git repos on AceHack + LFG, full admin, hourly billing tracking (Aaron 2026-04-29)
description: Aaron 2026-04-29 grants standing authority to create test git repositories on AceHack and Lucent-Financial-Group GitHub orgs at any time to test git/GitHub/CI features, with full admin authority on those test repos to change settings. Two binding constraints — keep test repos PUBLIC so standard GitHub-hosted Actions usage stays on the no-charge path (private repos consume billed Actions minutes/storage and other paid SKUs; the constraint avoids that mechanism, not "repo creation itself"), and billing must be tracked HOURLY (per the existing budget-cadence work). The authority is standing (no per-creation Aaron sign-off needed) but bounded (public-only, billing-visible). Composes with Otto-365 "basically never ask" for invariant maintenance, branch-protection-settings-are-agent-call (delegated authority pattern), task #315 (hourly budget cadence), task #287 (cost visibility).
type: feedback
---

# Standing authority — create public test git repos, full admin, hourly billing tracking

## Source

Aaron 2026-04-29 (chat, mid-tick on PR #857/#858 doctrine work):

> *"you have standing authority at any time to create git repos on acehack and lfg to test any features of git they just have to be public cause that's free, private costs money, you can also have full admin to change any settings or whatever just track the billing every hour"*

Aaron 2026-04-29 (immediate clarification, same tick):

> *"try not to cost if you do no big deal just notice, not noticing and stopping costs until we talk is the barrier, a mistaken accident spend is fine if you are auditing billing and catch the costs that way"*

This second message reframes the cost constraint: the barrier is **not noticing**, not **spending**. Audit-and-catch is the safety mechanism; pre-perfect cost-zero is not the bar. A mistaken accidental spend caught by the hourly billing audit is acceptable. A spend that goes unnoticed long enough to require an Aaron-conversation-to-stop-it is the failure mode.

## The rule (load-bearing)

**Standing authority granted to the autonomous agent (the factory agent — harness-agnostic; this rule applies to whatever harness is running the factory now or in the future) to:**

1. **Create new git repositories** on `AceHack` and `Lucent-Financial-Group` GitHub orgs at any time, no per-creation Aaron sign-off required.
2. **Use the new repos as test surfaces** for any git / GitHub / CI / Actions / branch-protection / ruleset / SARIF / fork-workflow / multi-remote / mirror-sync feature being investigated or designed.
3. **Exercise full admin** on those test repos — change any settings (branch protection, rulesets, secrets, Actions permissions, code-scanning config, etc.) without asking.

**Two binding constraints (non-negotiable):**

1. **Public repositories only.** On public repos, standard GitHub-hosted Actions runners + storage are on the no-charge tier; private repos consume billed Actions minutes / storage / artifact retention and are eligible for paid SKUs (Advanced Security, Codespaces, larger runners, etc.). The constraint avoids that *billing mechanism*, not "repo creation itself." **Never create a private repo** under this standing authority. Composes with `feedback_standard_github_runners_free_for_public_repos_stop_drifting_otto_249_2026_04_24.md` (the canonical "public = free / private = billed minutes" rule) and `feedback_aaron_full_github_access_authorization_all_acehack_lfg_only_restriction_no_spending_increase_2026_04_23.md` (visibility public↔private affects billing boundaries).
2. **Billing tracked hourly — and the audit must be ACTIVE before any new test repo is created** (precondition, not promise). The hourly budget cadence (task #315 + task #287 cost-visibility lane) must keep visibility on whatever resources these test repos consume. Per Amara 2026-04-29: *"If the hourly billing audit is not active and covering the target org/account/repo, do not create new test repos."* Billing-visibility is the load-bearing safety latch that makes "create freely" safe; it is not optional.

**Paid-feature exclusion list** (per Amara 2026-04-29 risk-boundary correction):

Public repos and standard GitHub-hosted Actions runners are free, but several adjacent features ARE billable. The standing authority covers public test repos and repository-level settings needed to test git / GitHub behaviour. It does **NOT** include:

- private repo creation
- larger runners (always charged regardless of public/private status)
- paid marketplace apps
- paid GitHub Advanced Security / paid security features
- paid storage-heavy package / artifact experiments
- Codespaces paid usage
- paid LFS / storage experiments
- adding external collaborators with paid-seat implications
- org-wide billing / security changes unrelated to the test repo

**Exception path:** any paid-feature use is allowed only if (a) explicitly needed for the test, AND (b) the hourly billing audit is active *before* creation, AND (c) the cost is consciously chosen and visible — i.e., the audit-precondition rule still holds.

**What the hourly billing audit must cover** (per Amara 2026-04-29 + [GitHub Actions billing docs](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions) — Actions storage charges accrue hourly, and budgets/alerts are the native spending-control surface):

- LFG org (existing scope)
- AceHack account / org (extended scope)
- newly created test repos (auto-included from creation moment)
- Actions minutes / runners
- artifact / cache / package storage
- any enabled paid SKU / budget alert

**Carved blade** (Amara): *"Public repo is the default cost-control surface. Paid feature enablement is still an authority boundary."*

**Authority lifetime:**

- Standing — no expiration, no per-tick re-confirmation needed.
- Revocable — Aaron can rescind by saying so; revocation triggers cleanup tick (delete or transfer test repos appropriately).
- Self-limiting — if hourly billing tracking shows resource consumption Aaron flags as too expensive, agent throttles or reverts test-repo creation cadence without escalation.

**Failure-mode definition (load-bearing):**

The failure mode is **not "spending money."** The failure mode is **"spending money that goes unnoticed until Aaron has to come tell me to stop."** Aaron 2026-04-29: *"not noticing and stopping costs until we talk is the barrier."*

Concretely:

- **OK**: cost shows up in the next hourly audit, agent notices, agent decides whether to clean up / revert / keep going. No Aaron interrupt needed.
- **OK**: a mistaken accidental spend (created a repo with too-expensive Actions, mis-configured a workflow, etc.) caught by the audit tick after the fact.
- **NOT OK**: cost accumulating silently because the audit isn't running, isn't covering the new test repos, or isn't being read by the agent.

This means **audit-coverage is more load-bearing than spend-zero**. Don't try to be perfect-zero-cost; do make sure every test repo created falls under the hourly billing surface from the moment of creation. If the audit is broken, fix the audit BEFORE creating new test repos.

**Why** (per Aaron's framing):

- "Public cause that's free" — the cost-control mechanism is GitHub's pricing model, not a per-creation gate.
- "Full admin to change any settings or whatever" — without admin, half the git/GitHub features can't be tested (branch protection, rulesets, SARIF upload, code-scanning config, secret-scanning, etc. all require admin).
- "Just track the billing every hour" — the safety latch is observability, not pre-approval. Aaron sees the cost, agent acts within the budget envelope.

**How to apply:**

When a test surface is needed for any git/GitHub/CI feature:

1. **Create the repo as public.** Use `gh repo create AceHack/<name> --public` or `gh repo create Lucent-Financial-Group/<name> --public`. Naming convention: prefix with `test-` or `sandbox-` so the repo's purpose is unambiguous (e.g., `test-codeql-no-source-baseline`, `sandbox-fork-sync-protocol`).
2. **Configure as needed** — branch protection, rulesets, Actions, etc.
3. **Exercise the test scenario** (force-push experiment, multi-remote setup, CodeQL config drift, fork-PR permissions, etc.).
4. **Ensure hourly billing tracking covers it BEFORE creating the repo** (audit-precondition). The current budget telemetry does NOT yet meet the precondition: `.github/workflows/budget-snapshot-cadence.yml` is on a **weekly** cron (`23 16 * * 0` — Sunday only, per the `* 0` day-of-week field) and `tools/budget/snapshot-burn.sh` hard-codes only `repos=("Lucent-Financial-Group/Zeta")`. Until task #315 (bump weekly → hourly cadence) lands AND `snapshot-burn.sh` is extended to cover AceHack + the new test repo's full path, the audit-precondition is not satisfied and the standing authority cannot be exercised. The blocking work is small but discrete: (a) change the cron expression to hourly; (b) parameterise the repo list to include AceHack/* and the target test repo; (c) verify the first hourly run actually emits a snapshot. Do not create test repos before all three conditions hold.
5. **Clean up when finished** — `gh repo delete <repo> --yes` or transfer to archive. Don't leave indefinitely-stale test repos consuming resources.
6. **Log the test in `docs/research/` or a memory file** if the test produced doctrine-relevant findings (per Otto-363 substrate-or-it-didn't-happen — chat-only test results are weather).

## Operational composition

This authority composes with several existing rules:

- **Otto-365 "basically never ask" for invariant maintenance** — creating test repos to investigate / verify a structural problem IS invariant maintenance, not authority decision. The authority grant makes this explicit.
- **Branch-protection-settings-are-agent-call** (`feedback_branch_protection_settings_are_agent_call_external_contribution_ready_2026_04_23.md`) — already delegated branch-protection authority on Zeta. This grant extends to test repos created under this rule.
- **Task #315 hourly budget cadence** — the safety latch. If hourly tracking isn't running, the authority's bounding constraint (cost visibility) isn't operational. Test-repo creation should not outpace billing visibility.
- **Task #287 cost visibility** — the parent lane that #315 implements. Aaron explicitly tied billing tracking to the authority grant.
- **AceHack mirror-not-peer doctrine** (`feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`) — AceHack/Zeta is a mirror, but **AceHack as an ORG can host test repos**. The mirror-vs-active distinction applies to `AceHack/Zeta` specifically, not to other repos under the AceHack org. Test repos under AceHack are fine.
- **Earlier org-admin scoping + visibility constraint** — Aaron's 2026-04-28 rule scoped org-admin authority to LFG only and required visibility before any shared-production change. This new grant explicitly extends authority to AceHack for the narrow purpose of test-repo creation + admin, balanced by the billing-visibility constraint. The visibility-constraint rule (don't change shared-production things Aaron can't see) still applies — TEST repos are by definition not shared-production, and billing is the visibility surface (both legs of "Aaron sees what's happening" hold by construction).

## What this does NOT permit

- ❌ **Private repos.** They cost money. The authority is bounded by GitHub's free-public pricing. If a feature can only be tested on a private repo, escalate to Aaron.
- ❌ **Indefinitely-running cost streams.** The hourly billing tracker is the early-warning system. If a test repo accumulates Actions minutes faster than expected, throttle/clean up.
- ❌ **Production-affecting changes** to existing canonical repos (`Lucent-Financial-Group/Zeta`, `AceHack/Zeta`) under this authority. The authority is narrowly to TEST repos. Production-canonical repos still respect their existing protection / review / merge constraints.
- ❌ **Skipping the cleanup tick.** Don't leave test repos lying around. Delete or archive when the test is done. Especially if the test repo accumulated misconfigurations during experimentation.
- ❌ **Bypassing visibility-constraint rule** (Aaron 2026-04-28). Test repos are inherently visible (Aaron can see them in his orgs), and billing is the cost-visibility surface — both legs of "Aaron sees what's happening" hold by construction. Don't construe this authority as license to make hidden changes elsewhere.

## Authoritative references (verified upstream 2026-04-29 per Otto-364)

- **GitHub free-public pricing** — [GitHub plans pricing page](https://github.com/pricing) confirms public repositories are free on Free, Pro, Team, and Enterprise plans for unlimited collaborators.
- **`gh repo create`** — [GitHub CLI repo create docs](https://cli.github.com/manual/gh_repo_create) confirm the `--public` flag and the create-with-template / create-with-settings options.
- **`gh repo delete`** — [GitHub CLI repo delete docs](https://cli.github.com/manual/gh_repo_delete) confirm `--yes` flag for non-interactive deletion (for cleanup ticks).
- **GitHub Actions billing** — [GitHub Actions billing docs](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions) confirm Actions minutes are FREE on public repos for any plan (only private repos consume the included-minutes quota, which is what makes "public only" the cost-control gate).

## Carved blade

> *Standing authority. Public only. Full admin. Billing tracked.*

> *The cost gate is GitHub's pricing model, not Aaron's inbox. The visibility gate is hourly billing.*

> *The barrier is "not noticing." A mistaken accident spend caught by the audit is fine. A silent spend that requires Aaron to come stop it is the failure mode.*

> *Audit-coverage is more load-bearing than spend-zero.*

## Trigger memory

Aaron 2026-04-29: *"you have standing authority at any time to create git repos on acehack and lfg to test any features of git they just have to be public cause that's free, private costs money, you can also have full admin to change any settings or whatever just track the billing every hour"*

Context: this grant arrived mid-tick during the AceHack mirror-not-peer doctrine work (PR #858) + the codeql structural fix work (PR #857). Both lanes had been investigating git / GitHub / CI features against the production Zeta repos; Aaron's grant makes it possible to investigate against dedicated test surfaces instead, which is faster, safer, and doesn't risk perturbing the canonical repos.

## First likely application

The fork-PR guard / `--force-with-lease` semantics on AceHack mirror-sync (PR #858) deserve a real test exercise — create `AceHack/test-mirror-sync-2026-04-29` (public), set up the LFG/AceHack mirror flow on a tiny corpus, verify the `--force-with-lease` safety latch behaves as documented under each scenario (clean sync / unexpected drift / known-corrupted state). That test would empirically validate the doctrine before the operational sync execution lands.

This first application is **deferred**, not bundled with this doctrine substrate. Land the authority grant first, then exercise it on a discrete tick after this PR merges.
