# LFG-only capabilities scout — what can we do on Lucent-Financial-Group that we can't on AceHack?

Scouting doc. Living inventory of capabilities available on
`Lucent-Financial-Group/Zeta` (Copilot Business + Teams plan)
that are **not** available on `AceHack/Zeta` (free personal
tier). Feeds the throttled LFG experiment backlog.

**Source:** `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`
(Aaron 2026-04-22).

**Policy context:**

- Day-to-day PRs target `AceHack/Zeta:main` (free CI, free
  Copilot) per `docs/UPSTREAM-RHYTHM.md`.
- LFG-only experiments are a **separate, throttled track** —
  not every round; cadence set per-experiment in its BACKLOG
  row.
- Budget cap on LFG is **$0** = hard stop. Experiments run
  inside free-tier allowance; they do not raise the cap.
- Agent has standing permission to change LFG settings **except**
  the $0 budget and Aaron's personal info.
- Enterprise-plan upgrade is offered *if* the LFG-only backlog
  grows to ≥10 meaningful items this scouting doc identifies.

## Verified plan state (2026-04-22)

From `gh api /orgs/Lucent-Financial-Group/copilot/billing`:

| Field | Value |
|---|---|
| `plan_type` | `business` |
| `seat_breakdown.total` | 1 |
| `seat_breakdown.active_this_cycle` | 1 |
| `public_code_suggestions` | `allow` |
| `ide_chat` | `enabled` |
| `cli` | `enabled` |
| `platform_chat` | `enabled` |

Plus whatever Aaron toggled on under "Copilot enhancements"
(internet search, coding agent, custom instructions, etc.) —
confirm via org Copilot settings page; `gh` does not surface
all toggles yet.

Actions billing endpoint requires `admin:org` scope; not
currently on the authenticated token. To monitor free-credit
burn, run `gh auth refresh -h github.com -s admin:org` first.

## Capability categories

### 1. Copilot Business — coding-agent capabilities

Business plan features **not** available on AceHack's free
tier:

| Capability | LFG-available | Experiment candidate |
|---|---|---|
| Copilot coding-agent on PRs (reviews, fixes) | yes | Compare coding-agent review against `harsh-critic` / `code-reviewer-zero-empathy` findings on a sample of PRs |
| Copilot chat with internet search | yes | Use Copilot to fetch live docs for a retraction-native algorithm; compare to our `WebFetch`-based scouting |
| Copilot custom instructions (org-level) | yes | Author a Copilot org instruction file that mirrors `AGENTS.md`; measure whether Copilot suggestions on LFG PRs reflect the instructions |
| Copilot code-review in IDE | yes | Probe: does IDE-level Copilot catch different issues than PR-level? |
| Copilot CLI | yes | `gh copilot suggest` / `gh copilot explain` on factory commands; evaluate useful-for-factory-work |
| Copilot extensions | yes | Install one narrow extension (e.g., security-scanner) against Zeta; measure signal |
| Public code suggestions filter | `allow` | Settings experiment: compare suggestion quality with allow vs. block; probably noise, but a one-pass check |

### 2. GitHub Teams plan — org features

Teams plan (base tier below Enterprise) vs free:

| Capability | LFG-available | Experiment candidate |
|---|---|---|
| Required reviewers from specific teams | yes | Protect `main` with team-membership requirement; does this change the review flow when contributors arrive? |
| Protected branches on private repos | yes | Moot (Zeta is public), but note for future private repos |
| GitHub Pages with private-repo sources | yes | Moot (Zeta is public); note |
| Draft PRs (free on public, paid on private) | yes | Moot (Zeta is public) |
| Code owners enforcement | yes | `CODEOWNERS` with team handles; can we dogfood a persona-team mapping? |
| Org-level Dependabot secret alerts | yes | Check if org-level rules catch anything repo-level misses |
| Org-level Actions policy | yes | Set org-level Actions allowlist; probe tighter than repo-level |

### 3. Actions runners — class and concurrency

Free-tier has 2000 Actions minutes/month on Linux-2x-core.
Paid (via plan minutes + overage) can access:

| Runner class | LFG-available | Experiment candidate |
|---|---|---|
| `ubuntu-latest` (2-core) | yes (identical to AceHack) | No experiment — same capability |
| `ubuntu-latest-4-core` / `8-core` | yes (larger runner classes billable) | Benchmark: does our test matrix benefit from parallelism? One-shot, measure then decide |
| `macos-14-xlarge` (Apple Silicon) | yes (paid tier) | Moot unless we need Apple-Silicon-specific bench |
| Concurrent-job limit | higher on paid | Unlikely to matter at our current PR volume |
| Self-hosted runners | yes (org-wide) | Not aligned with factory principles (capture-surface); **decline** |

### 4. Security features

| Capability | LFG-available | Experiment candidate |
|---|---|---|
| CodeQL default-setup | yes, on both | Not LFG-only |
| Advanced Security (SAST, secret scanning with push protection) | yes on private repos (paid); on public repos free | Zeta is public, so free. **Not LFG-only.** |
| Dependabot security updates | yes on both | Not LFG-only |
| Secret scanning for partner tokens | yes | Not LFG-only (also on public) |
| Custom-pattern secret scanning | yes (GHAS-paid feature on private; public is free) | Zeta public so free. Not LFG-only. |

**Finding:** Most security features are free on public repos.
LFG does not add much on this axis unless Zeta goes private.

### 5. Organization capabilities

| Capability | LFG-available | Experiment candidate |
|---|---|---|
| Merge queue | yes (org repos) | **HB-001** — this is the headline LFG-only capability; currently blocked pending org config |
| Org Insights / Audit Log | yes | Probe: does the audit log give us factory-hygiene signal worth a dashboard? |
| Rulesets at org level | yes | Move ruleset from repo-level to org-level; cleaner multi-repo story |
| Discussions | yes (also on personal) | Not LFG-only |
| Projects (classic/new) | yes (also on personal) | Not LFG-only |

## Experiment backlog — proposed throttled cadence

Ranked. "Cadence" = how often this experiment fires.

| # | Experiment | Capability class | Cadence | Cost class |
|---|---|---|---|---|
| 1 | Merge queue enablement | Org-level | **one-shot** (follow-up to HB-001 org-migration, now Resolved) | free (enable) |
| 2 | Copilot coding-agent review vs `harsh-critic` on sample PRs | Copilot Business | every 5 rounds | ~50 Actions min/run + Copilot seat-usage |
| 3 | Copilot org-level custom-instructions mirror of AGENTS.md | Copilot Business | one-shot author, observe 10 PRs | free (config) + seat-usage |
| 4 | Larger-runner benchmark (4-core vs 2-core for test matrix) | Actions runners | one-shot, then decide | ~20 Actions min @ 2x billing rate |
| 5 | Org-level Actions allowlist vs repo-level | Teams plan | one-shot, observe 30d | free (config) |
| 6 | CODEOWNERS-per-persona-team experiment | Teams plan | one-shot | free (config) |
| 7 | Audit-log dashboard scouting | Teams plan | every 10 rounds | free (read-only API) |
| 8 | `gh copilot suggest/explain` usefulness on factory commands | Copilot CLI | every 5 rounds, 3-command sample | seat-usage |
| 9 | Copilot IDE review on local branches (AceHack) | Copilot Business | ongoing low-throttle | seat-usage |
| 10 | Copilot chat internet-search for 1 doc-gap per round | Copilot Business | every 3 rounds | seat-usage |

**Count: 10.** This hits the Enterprise-upgrade trigger Aaron
named ("only if enough stuff you can do only over there we end
up with a large backlog"). Before any upgrade request, each
experiment needs:

- A `docs/BACKLOG.md` row with the cadence and success signal.
- A throttle mechanism (scheduled workflow, round-cadence
  check, manual-trigger gate).
- An exit signal — how do we know the experiment is done and
  the capability is either adopted or abandoned?

## Items explicitly NOT in scope

- **Self-hosted runners** — capture-surface risk; factory
  principles prefer hosted. **Declined** even though LFG-
  available.
- **Raising the $0 budget** — load-bearing cost-stop. Never
  touched without explicit Aaron renegotiation.
- **Changing Aaron's personal info** — forbidden class per
  the memory.
- **Migrating Zeta to private** — would unlock more GHAS on
  private, but destroys the open-source dogfood story.
  Declined.

## Cadence of this scout

Re-read every 10 rounds. Update when:

- New LFG setting or Copilot feature becomes available.
- An experiment lands and the capability is adopted — strike
  the row, record in `docs/ROUND-HISTORY.md`.
- Free-credit burn rate changes materially (once we can
  monitor it).

## Open questions

1. **How many free-tier Actions minutes does LFG's Business
   plan allocate per month?** Need `admin:org` scope to query.
   Until then, we infer from "build stopped running" as the
   exhaust signal.
2. **Do Copilot Business seat actions count against Actions
   minutes separately?** Docs are unclear; empirical via burn
   rate.
3. **Is the coding-agent's workflow-time billed against the
   org, the repo, or the user seat?** Check docs; pragma
   matters for throttle design.

## References

- `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`
- `memory/project_lfg_org_cost_reality_copilot_models_paid_contributor_tradeoff.md`
- `memory/feedback_fork_pr_cost_model_prs_land_on_acehack_sync_to_lfg_in_bulk.md`
- `docs/UPSTREAM-RHYTHM.md`
- `docs/HUMAN-BACKLOG.md` HB-001 (org-migration to LFG, Resolved 2026-04-21; merge-queue enable is a separate follow-up)
- `docs/GITHUB-SETTINGS.md` (settings-as-code surface)
