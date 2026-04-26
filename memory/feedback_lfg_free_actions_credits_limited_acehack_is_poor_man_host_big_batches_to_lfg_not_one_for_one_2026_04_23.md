---
name: LFG has limited free GitHub Actions credits — AceHack is the poor-man host for per-PR work; big-batched updates flow AceHack→LFG (not one-for-one); future decisions default to LFG but DELIVERED as batches
description: Aaron 2026-04-23 Otto-61 — *"don't forget LFG has a limited amount of free credits and then it's GitHub actions stop working unless we pay more money, ace is the poor man for the host github, this is one of the primary constraints for doing so much work against acehack instead of LFG, big batches should go from AceHack to LFG to conserve costs, not one for one with PRs from AceHack, LFG gets PRs that are large amunt of batched updates. Future decisions default to LFG"*. Critical operational constraint that REVISES my session-long default. I've been pushing ~20 PRs to LFG this session, burning credits. Going forward: active per-PR work on AceHack (remote: `acehack`); periodic consolidated batches to LFG (remote: `origin`). Decisions still default to LFG but via batched delivery, not per-PR.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# LFG credits are limited — AceHack is poor-man host; batch AceHack→LFG

## Verbatim (2026-04-23 Otto-61)

> don't forget LFG has a limited amount of free credits and
> then it's GitHub actions stop working unless we pay more
> money, ace is the poor man for the host github, this is
> one of the primary constraints for doing so much work
> against acehack instead of LFG, big batches should go
> from AceHack to LFG to conserve costs, not one for one
> with PRs from AceHack, LFG gets PRs that are large
> amunt of batched updates. Future decisions default to
> LFG;

## The constraint

**LFG (Lucent-Financial-Group/Zeta)** uses a limited free
GitHub Actions credit pool. Each PR / push that triggers
workflows consumes credits. When exhausted, CI stops
working until Aaron pays more.

**AceHack (AceHack/Zeta)** is the **poor-man host** — the
cost-optimized substrate where active per-PR work happens.

**The operational rule:**

- **Active per-PR work → AceHack** (`git push acehack`,
  `gh pr create --repo AceHack/Zeta`)
- **Big batched consolidations → LFG** (periodic
  AceHack→LFG sync via one big PR that carries many
  batched-up changes)
- **Decisions still default to LFG** (canonical, per
  Amara's operational-canonicity framing — PR #219
  absorb) but **delivered as batches**, not per-PR mirrors

## What I got wrong this session

**I've been pushing ~20 PRs to LFG as the default.** The
remote configuration makes `origin` = LFG, so
`git push -u origin <branch>` lands on LFG. All active
per-PR work this session (BACKLOG rows, Craft modules,
hygiene audits, Amara absorbs, etc.) landed on LFG
directly. This burned credits that should have been
conserved for batched decisions.

The mistake was operating under the framing "LFG is
canonical so LFG is where work happens", without holding
the cost-constraint layer. Amara's PR #219 absorb
correctly named LFG as *operationally-canonical* — but
canonical ≠ continuously-updated; it means decisions
LAND there, not that every iteration flows through there.

## How to apply going forward

### Default push target

Flip the mental model:

- `git push acehack <branch>` for active per-PR work
- `gh pr create --repo AceHack/Zeta ...` for PR creation
- `gh pr merge <n> --repo AceHack/Zeta` for merge
  operations

LFG operations are **reserved for batched consolidations**.

### Existing in-flight LFG PRs (as of Otto-61)

11+ PRs currently open on LFG from this session. Let
them land normally — the credits are already spent to
queue them; cancelling mid-flight wastes that spend.
What **stops** is opening NEW per-PR work on LFG.

### Batch AceHack → LFG periodically

When a meaningful batch of AceHack work stabilizes (by
round, by feature group, or by Aaron-directed milestone),
consolidate it into ONE LFG PR rather than mirroring
each AceHack PR. The LFG PR becomes a single merge-to-
main that lands many batched commits at once.

**Shape of a batch PR:**

- Title names the batch scope (e.g., "batch: Otto-54/57/58
  BACKLOG directives + CI + FACTORY-HYGIENE rows")
- Body enumerates the included AceHack PRs with their
  commit SHAs + short summaries
- Cherry-picks or merges the batch into a fresh branch
  from LFG main
- One CI fire for the whole batch instead of N fires for
  N PRs

### Cost-saving operational shape

| Operation | AceHack (poor-man, default) | LFG (canonical, batched) |
|---|---|---|
| Per-PR iteration | ✓ | ✗ — only batches |
| Codex/Copilot per-PR reviews | ✓ | ✓ (at batch time) |
| Auto-merge armed on open | ✓ | ✗ — deliberate batches |
| BACKLOG rows, memory, research | ✓ | batched periodically |
| Decision records (ADRs) | land on AceHack first, then batch | final home on LFG |
| Production releases (NuGet) | — | ✓ (final surface) |

### What this revises in prior memories

- `project_lfg_is_demo_facing_acehack_is_cost_cutting_
  internal_2026_04_23.md` — earlier framing
  ("demo-facing" vs "cost-cutting"). Aaron's current
  framing is sharper: LFG is operationally-canonical +
  credit-limited; AceHack is cost-optimized per-PR
  substrate. Both characterizations compose; the cost-
  constraint layer is the one I missed.
- `docs/aurora/2026-04-23-amara-decision-proxy-technical-
  review.md` PR #219 — absorb named
  "operationally-canonical / experimentation-frontier"
  axis; this memory adds the "credit-limited / poor-
  man-host" axis.
- `project_factory_is_git_native_github_first_host_
  hygiene_cadences_for_frictionless_operation_
  2026_04_23.md` — first-host-positioning is unchanged;
  the cost-constraint is intra-GitHub (across two repos
  on the same host), not inter-host.

## Composes with

- Aaron's Otto-23 directive *"poor man mode is default"*
  in `feedback_agent_owns_all_github_settings_...` —
  same frame, explicit now about LFG-vs-AceHack
- The 11+ in-flight LFG PRs this session — they land
  normally; future work pivots
- CURRENT-aaron.md freshness audit (PR #212 / Otto-54
  row) — this memory is high-priority for the next
  refresh
- `feedback_honor_those_that_came_before.md` — retired
  personas and retired substrate preserve imprint; the
  AceHack→LFG batch shape preserves the AceHack
  history-in-batch, honoring the per-PR substrate on
  its way to LFG

## What this constraint is NOT

- **Not a rejection of LFG.** LFG stays the canonical
  decision home. The change is delivery mechanism, not
  authority.
- **Not authorization to close in-flight LFG PRs.** The
  credits are already spent to queue them; let them
  land normally.
- **Not permission to skip CI on AceHack.** AceHack has
  its own CI (possibly fewer checks, possibly different
  limits). Active-PR-work on AceHack still runs its CI;
  this is a cost-per-host question, not a skip-CI
  license.
- **Not a commitment to stop all LFG pushes.** Periodic
  batches still land there. The rule is *"no per-PR
  mirrors; consolidate first"*.
- **Not a change to auto-merge discipline.** Arm auto-
  merge on AceHack PRs; arm it on the batch LFG PR at
  batch time.
- **Not a rename or rescope of either repo.** Same
  repos, same roles; the delivery shape changes.

## Attribution

Human maintainer named the constraint + the operational
rule + the "ace is the poor-man host" framing. Otto
(loop-agent PM hat, Otto-61) absorbed + filed this memory.
CURRENT-aaron.md queued for refresh incorporating this
distillation. Future-session Otto inherits: push to
`acehack` remote by default; consolidate to `origin`
(LFG) periodically as batches.

## Otto-61 verification notes (2026-04-23)

After Aaron's clarification *"just not sure how much that
will cost"* + *"LFG is public but it does not have
unlimited it seems"*, ran a fact-finding pass:

**What I could verify:**

- Both `Lucent-Financial-Group/Zeta` and `AceHack/Zeta`
  are PUBLIC repos.
- `gate.yml` already carries cost-aware config: the
  matrix expression runs macOS-14 ONLY on AceHack, never
  on LFG (line encodes
  `github.repository == 'Lucent-Financial-Group/Zeta' &&
  '["ubuntu-22.04"]' || '["ubuntu-22.04","macos-14"]'`).
  This is a deliberate existing cost-avoidance for the
  macOS runner's 10x multiplier that applies even on
  public repos.
- LFG has ~30 recent workflow runs visible via
  `gh api repos/.../actions/runs`.
- LFG has 0 artifacts stored.

**What I could NOT verify:**

- Actual Actions minute usage (org billing API
  `orgs/.../settings/billing/actions` returned 410 moved
  + requires `admin:org` scope I don't have).
- Plan tier (Free / Team / Enterprise) of
  `Lucent-Financial-Group` org.
- Advanced Security features enabled (paid even on
  public repos — CodeQL default-setup advanced, private
  vulnerability reporting extras, secret scanning
  push-protection billing).
- Large-runner tier assignments.

**Implications:**

GitHub's documented billing for public-repo Linux
Actions is "free, unlimited" on standard runners. Aaron's
observation that LFG has a credit cap is authoritative
against documentation, meaning:

- Either the Lucent-Financial-Group org has a custom
  billing configuration that caps public-repo usage
  (unusual but possible)
- OR some feature in use is not in the free tier (most
  likely: Advanced Security components, or Pages with
  Actions-driven deploys)
- OR Aaron is budgeting against *eventual* cap if the
  current usage pattern continues (AceHack→LFG batching
  prevents the cap from becoming binding)

**Respect-the-directive regardless:** the operational
rule stands — push to AceHack, batch to LFG — whether
or not I can verify the specific cost mechanism. Aaron's
observation is load-bearing; my verification-gaps don't
override it.

**Cost-tracking backlog candidate:** set up a recurring
audit that pulls LFG workflow-run counts + computes
estimated burn rate. If admin:org scope is later granted,
extend with actual billing numbers. Otherwise proxy
by run-count + per-run duration. File as BACKLOG row
from AceHack (not LFG) in a future tick.

---

## REVISION — Otto-61 follow-up (2026-04-23): Aaron's mutual-teaching correction

Aaron after seeing the Otto-61 verification findings:

> oh if there is unlimited for public repo then lets go wild
> but still track minutes usage and all that stuff, you
> should take amaras suggestions about the acehack lfg
> split, you guys taught me something

**What this revises above:**

1. **"Go wild" for public-repo Linux Actions.** Both LFG and
   AceHack are public; Linux runners on standard tiers are
   free with no minute cap. The session pattern of active
   per-PR work against LFG is therefore **not cost-burning**
   and does not need to pivot.

2. **Track usage anyway.** Aaron explicitly wants ongoing
   visibility into minute consumption despite the unlimited
   tier — defensive hygiene against future tier changes or
   paid-feature adoption creeping the floor. Candidate
   BACKLOG row: tool that pulls `gh api repos/.../actions/
   runs` + duration metadata + emits a per-round usage
   report. File against AceHack (per the split below) or
   LFG (per the active-work default — now reinstated).

3. **The AceHack/LFG split is Amara's authority-axis, not
   cost-driven.** Per Amara (PR #219 absorb):
   - **LFG = operationally-canonical** — decisions LIVE
     here, canonical authority, the repo that external
     collaborators see as source-of-truth.
   - **AceHack = experimentation-frontier** — prototypes,
     speculative work, experiments live here before
     graduating to LFG.
   - Decisions land on LFG; experiments live on AceHack;
     both persist independently of cost.

4. **"You guys taught me something"** — mutual-teaching
   signal. Aaron had modeled LFG as credit-limited based
   on his prior experience / billing intuition;
   verification found the public-repo unlimited tier
   applies; Aaron updated his mental model. This composes
   with the bidirectional-alignment Craft discipline
   (`project_craft_secret_purpose_agent_continuity_via_
   human_maintainer_bootstrap_...`) — alignment is
   two-way, and verification-based correction is one
   concrete mechanism.

**What this memory RETAINS:**

- The original *"push to correct substrate"* rule, but
  with the correct discriminator: authority/purpose, not
  cost.
- The defensive usage-tracking directive (Aaron still
  wants visibility).
- The broader Amara operational-canonicity framing.

**What this memory RETRACTS:**

- The cost-driven default-to-AceHack pivot. Session
  default stays as it was: active per-PR work on LFG via
  `origin` remote is fine.
- The specific claim that LFG burns limited credits per
  PR. On current verified evidence (public repos, Linux
  only in LFG's gate.yml matrix), no per-PR cost is
  measured.

**Go-forward operational rule (final):**

| Surface | AceHack (origin: `acehack`) | LFG (origin: `origin`) |
|---|---|---|
| Experiments / prototypes / speculative research | ✓ primary home | — |
| Decisions + shipped substrate + canonical | — stages here first | ✓ final home |
| Active per-PR iteration | ✓ for experimentation branches | ✓ for canonical work |
| Cost awareness | Linux free on both (public) | Linux free (public); track anyway |
| macOS-14 matrix runs | ✓ (per `gate.yml`) | ✗ (per existing cost-aware config) |

The gate.yml macOS-on-AceHack-only split stays — that's
genuine cost-avoidance for 10x runner multiplier. Linux-
only LFG runs are the free-tier sweet spot.

**Retraction attribution:** Aaron corrected my Otto-61
memory the same tick, after seeing the verification
findings. This revision preserves the original constraint-
as-understood so future-session Otto can trace the
correction chain; the overall memory now reads as
"constraint claimed → verified → corrected → final rule".

---

## Cost-parity findings — Otto-61 follow-up 2

Aaron's second correction: *"Wait LFG does not have
unlimited copilot right? I think acehack does, we should
parity check for costs and see if there is really anyting
AceHack gets us for free that would limit us on LFG."*

**Observed from read-only API:**

| Feature | LFG (Org, Team plan) | AceHack (User, fork of LFG) |
|---|---|---|
| Repo visibility | Public | Public |
| Linux Actions minutes | Free unlimited | Free unlimited |
| macOS-14 runner | Avoided via `gate.yml` matrix | Used via `gate.yml` matrix (10x cost applies if non-free tier) |
| secret_scanning | Enabled | Enabled |
| secret_scanning_push_protection | Enabled | Enabled |
| secret_scanning_ai_detection | Disabled (paid) | Not exposed (disabled) |
| secret_scanning_validity_checks | Disabled (paid) | Disabled |
| dependabot_security_updates | Enabled | Disabled (free on public if enabled) |
| Plan tier | Team (2 seats filled) | User-account (tier not visible via read-only API) |
| Copilot PR reviewer active | ✓ observed in 20+ PRs this session | Not observed (no AceHack PRs this session) |

**Likely monthly cost structure on LFG:**

1. Team plan base: ~$4/seat × 2 seats = $8/month flat
2. Possibly Copilot Business add-on (~$19/seat) if enabled
3. Advanced Security paid features (ai_detection, validity,
   delegated bypass) — currently disabled so no cost here

**AceHack as personal account:**

- Cost visibility requires Aaron's personal billing page
  (not exposed via GitHub API without owner session)
- If Aaron has Copilot Pro personally (~$10/month), AceHack
  inherits free Copilot PR reviews + Chat
- Free-tier for public repos covers Linux Actions unlimited

**What I could NOT verify without admin:org scope:**

- Actual Copilot seat allocation on LFG (Business vs none)
- Whether Copilot PR reviewer is paid or part of Pro+ free
- Org billing / invoice / projected burn rate

**Parity answer (honest):**

- Linux Actions: **parity** (both unlimited free)
- macOS runner: **LFG avoided, AceHack accepted** — existing
  gate.yml config already optimal
- Dependabot updates: LFG enabled, AceHack disabled — both
  are free on public repos; AceHack could enable with no cost
- Advanced Security paid features: neither enabled; parity
- **Copilot: cannot verify without admin:org**
- **Team plan fee: LFG has it ($8/month flat regardless of
  Actions usage); AceHack does not**

**"Does AceHack get us something free that would limit LFG?"**
Probably not — LFG's Team plan and Copilot give MORE
capability than AceHack's user-account, not less. But I can't
prove it without billing access.

**BACKLOG candidate (file against AceHack per Amara split):**
`parity-audit-tool` that periodically dumps both repos'
security/analysis + workflow counts + (if admin:org granted)
Copilot seat status and Actions minute usage. Output as a
per-round audit in `docs/hygiene-history/acehack-lfg-parity-
YYYY-MM-DD.md`. M effort.
