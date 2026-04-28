---
name: GITNATIVE-STORE ALL GITHUB ARTIFACTS — extends gitnative-PR-preservation (Otto-250) to EVERY GitHub-hosted surface: branches (dead + alive), PRs (open/closed/merged), issues, discussions, wiki, projects, anything-else GitHub exposes; keep all in sync with the live GitHub state on a cadence; scope: LFG ONLY (no duplicates in forks — Otto-252 central-aggregator applies); this is factory hygiene — durable git-native storage of the whole "github as our first host experience" so we are not locked to the service + the corpus is complete (training signal per Otto-251); BACKLOG-class work, not immediate; Aaron Otto-261 2026-04-24 "hygen to keep these and branches and when on github PRs and issues up to date and cleaan, issues, disccusion, wiki, whatever is on github we want to store durably gitnative and keep in sync per first class gitnative and github our first host experience  live on lfg only, we don't need them in two places. backlog"
description: Aaron Otto-261 factory-discipline directive. Generalizes gitnative-PR-preservation (Otto-250) + LFG-aggregator (Otto-252) to the full GitHub artifact catalog. "First host experience" = GitHub as hosting layer; "first-class gitnative" = durable copy in git so we're not locked to the host. Save durable; file BACKLOG row.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Every durable GitHub-hosted artifact gets a durable
git-native mirror in the LFG repo, kept in sync on a
cadence. GitHub is the "first host experience" — the
service — but the data lives in git as first-class.**

Direct Aaron quote 2026-04-24:

> *"hygen to keep these and branches and when on github
> PRs and issues up to date and cleaan, issues,
> disccusion, wiki, whatever is on github we want to
> store durably gitnative and keep in sync per first
> class gitnative and github our first host experience
> live on lfg only, we don't need them in two places.
> backlog"*

## Scope — the GitHub artifact catalog

All of these land durably in LFG `docs/**` or
`forks/<fork>/**` tree on a sync cadence:

1. **Branches** — name, HEAD SHA, commit history,
   protection rules per branch. Dead branches AND live
   branches. Per Otto-257 clean-default smell, dead
   branches are audit inputs.
2. **PRs** — per Otto-250, already landing at
   `docs/pr-preservation/**`. Extends: ALL PRs, not
   just drain-relevant ones. Open, closed, merged.
3. **Issues** — title, body, labels, comments,
   assignees, state transitions. Land at
   `docs/issues/**`.
4. **Discussions** — category, title, body, comments,
   reactions, marked-answer. Land at
   `docs/discussions/**`.
5. **Wiki** — every page, every revision. Land at
   `docs/wiki/**` (mirror the wiki repo's structure).
6. **Projects** — project board state, column config,
   card positions, notes. Land at `docs/projects/**`.
7. **Releases** — tag, title, body, assets-list (NOT
   binary assets themselves unless small), author,
   published-at. Land at `docs/releases/**` OR
   native git tags suffice if well-annotated.
8. **Repo metadata + EVERYTHING in settings** — per
   Aaron 2026-04-24 "and settings snapshots like
   EVERYTHING incluing all envs if they got them and
   vars and secret names not values etc..." Scope is
   maximal. Includes (non-exhaustive — the actual API
   surface defines the scope, not this list):
   - Core settings: repo-level toggles (merge types,
     delete-on-merge, visibility, topics, description,
     homepage), default branch, licence, features
     (issues/wiki/projects on/off).
   - **Environments**: every GitHub Environment
     (`production`, `staging`, etc.) — protection
     rules, required reviewers, wait timer, deployment
     branch restrictions.
   - **Environment variables**: NAMES of all vars in
     each environment (values NOT captured — they
     may be sensitive even if not secret).
   - **Secret NAMES ONLY**: repo secrets, environment
     secrets, Dependabot secrets, Actions secrets,
     Codespaces secrets — NAMES captured, VALUES
     NEVER captured. The security boundary is
     absolute: secret values stay on GitHub, only
     the schema (what secrets exist by name) lands
     gitnative.
   - Rulesets: all rules + conditions + applies-to
     branches/tags.
   - Branch protection: per-branch rules.
   - Webhooks: URLs + events (not the secret
     signing values).
   - Labels + milestones + topics + tags.
   - Deploy keys: names + usage (not key material).
   - Autolink references, social preview image
     metadata (not binary).
   - Code security + scanning settings.
   - Funding.yml coverage.
   - Dependabot config.
   - GitHub Apps installed (names + permissions).
   - Collaborator + team permissions (names + roles
     only — same PII boundary as contributor
     attribution).
9. **Action workflow runs + artifacts past retention**
   — per Otto-250 extension, snapshot summaries
   before GC. Land at `docs/ci-history/**`.
10. **Insights + billing HISTORY snapshots** — per
    Aaron 2026-04-24 "and billing history snapshots":
    each snapshot is a NEW file under
    `docs/billing/YYYY-MM-DD.md`, NEVER overwrite the
    prior snapshot. The append-only time-series is
    itself the signal: monthly diff shows spend drift,
    Copilot/Actions/packages breakdowns over time,
    cost-per-feature post-attribution. Cadence: weekly
    minimum; daily during high-burn periods. Captures:
    Actions minutes used/remaining, Copilot seats,
    package storage, private bandwidth, LFS bandwidth,
    GHAS adoption cost, billing-plan status. Signal
    class: drift detection (sudden spike = leak or
    new-workflow-cost), trend (growing corpus cost
    projection), budget-discipline evidence per Aaron's
    $0-cap directive.

## Scope — LFG only

**Forks don't get their own copies.** Per Otto-252
central-aggregator: every fork's divergent signal
flows to LFG. Otto-261 extends: GitHub artifact
mirrors also live on LFG only.

Rule: `docs/**` holds the canonical (LFG) mirrors;
`forks/<fork>/**` holds each fork's mirror subtree
with SYMMETRIC naming (Otto-255). No duplication on
the fork repos themselves — they're review surfaces,
not aggregation points.

## Why gitnative + sync cadence

- **Retraction protection**: GitHub can change
  (rename orgs, deprecate features, retention GC,
  delete accounts). Git-native copy survives that.
- **Training corpus** (Otto-251): the whole repo is
  training data; gitnative copies mean the corpus is
  complete + self-contained.
- **Offline access**: reviewers/agents can read the
  corpus without hitting the API.
- **Diff-ability**: each sync produces a diff; the
  sync-history itself becomes signal.
- **Audit trail** (Otto-250): reviewer-reply-and-
  resolve flows preserved durably.
- **Clean-default smell** (Otto-257): sync catches
  drift between GitHub state and local state.

## Sync cadence design (backlog-owed)

Per-artifact-type cadence:

- **Branches**: every tick — cheap (`gh api /repos/L/Z/branches`)
- **PRs**: every tick for active, daily for closed-archive
- **Issues**: every tick for active, daily for closed
- **Discussions**: daily
- **Wiki**: hourly (wiki is a git repo itself — clone + merge)
- **Projects**: hourly
- **Releases**: per-release-event (webhook or poll)
- **Repo metadata + rulesets**: per-change (via
  `docs/GITHUB-SETTINGS.md` hygiene cadence)
- **CI history**: daily snapshot of prior 24h run
  summaries before retention GC
- **Billing**: weekly snapshot

Each artifact's sync tool goes in `tools/sync/` —
one script per artifact type. Dispatched from
FACTORY-HYGIENE.md as a cadenced job.

## Composition with prior memory

- **Otto-250** PR reviews are training signals —
  Otto-261 generalizes to ALL artifact classes.
- **Otto-251** entire repo is training corpus —
  Otto-261 makes the corpus complete (every
  artifact landed).
- **Otto-252** LFG as central aggregator —
  Otto-261 specifies the scope: LFG stores all,
  forks don't duplicate.
- **Otto-253** AceHack-touch-timing — applies:
  no AceHack-side artifact mirrors even during
  drain. All flow TO LFG.
- **Otto-254** roll-forward — sync is forward-
  rolling: each tick appends new state, doesn't
  rewrite history.
- **Otto-255** symmetry in naming — each artifact
  type gets the SAME folder name under `docs/`
  and under `forks/<fork>/` (e.g.
  `docs/pr-preservation/` ↔ `forks/AceHack/
  pr-preservation/`).
- **Otto-256** first-names-in-history-files —
  applies: artifact mirrors ARE history files,
  first names preserved.
- **Otto-257** clean-default smell detection —
  uses the synced state as ground truth for
  drift detection.
- **Otto-258** auto-format on PR — artifact
  mirrors get same lint + format discipline.
- **Otto-259** verify-before-destructive — sync
  engine never deletes artifacts; only appends
  + marks closed. Deletion requires Otto-259 gate.

## Iterative refinement — enhancement-backlog pattern

Aaron 2026-04-24 companion directive:

> *"we can backlog, we probably won't get this 100%
> full coverage aera first go so we should refine
> this skill/enhancement backlog"*

Translation: **don't design for 100% GitHub-API
coverage in the first PR.** The gitnative-sync skill
lands incrementally. Coverage expands via a dedicated
enhancement-backlog.

Mechanism:

- **`docs/gitnative-sync-enhancement-backlog.md`** —
  per-artifact-class rows (one per GitHub API
  endpoint or feature area). Each row: artifact
  name, estimated effort, current coverage status
  (not-started / partial / complete / drifted),
  last-verified-date, blocker notes.
- **Cadence**: every N rounds, the skill reviews
  the backlog, picks the highest-priority gap, lands
  one additional artifact's sync. Progress is
  incremental; complete coverage is the asymptote,
  not the entry condition.
- **New artifact class discovered?** (GitHub ships
  new feature, we notice an under-covered API area,
  Aaron flags a gap) → new row on the enhancement
  backlog, not a drop-everything scramble.
- **Drift-detection**: a synced artifact that hasn't
  been verified in > N rounds is flagged as
  possibly-drifted; next sweep re-syncs + tests.
- **Retirement**: if GitHub deprecates an artifact
  type, the backlog row gets marked retired with a
  reference to the replacement.

**Why this design wins**:

- Signals forward progress without requiring
  totality upfront.
- Each landed artifact is training-signal (Otto-251);
  partial coverage is still valuable.
- Discovery-driven; new GitHub features slot in
  without a grand re-architecture.
- Budget-friendly: one M-sized PR per round, not
  one L-sized PR that never lands.

## What to land (backlog-owed, sized)

Per queue-saturation, I do NOT open new PRs this
round. When drain clears, a consolidated BACKLOG
row (with Otto-257/258/259/260 + Otto-261) lands
one PR:

- **P1 BACKLOG row** — "Gitnative sync of all
  GitHub artifacts (branches, PRs, issues,
  discussions, wiki, projects, releases, repo
  metadata, CI history, billing) to LFG
  `docs/**` + `forks/<fork>/**` on tiered
  cadences. Tool surface: `tools/sync/
  <artifact>.sh`. Effort: L (total); M per
  artifact; phased rollout: PRs + issues first
  (highest signal), then discussions + wiki,
  then metadata."

- **Phase 1** (first subagent work after drain
  clears): sync-issues tool — `gh api
  /repos/Lucent-Financial-Group/Zeta/issues` →
  `docs/issues/<N>.md` with frontmatter. Builds
  on the existing PR-preservation format for
  symmetry.

## Direct Aaron quote to preserve

> *"hygen to keep these and branches and when on
> github PRs and issues up to date and cleaan,
> issues, disccusion, wiki, whatever is on github
> we want to store durably gitnative and keep in
> sync per first class gitnative and github our
> first host experience  live on lfg only, we don't
> need them in two places. backlog"*

Future Otto: gitnative-storage is not a one-off
(the PR-preservation pattern); it's the default
for EVERY GitHub-surfaced artifact. When a new
artifact class surfaces on GitHub (labels, wikis,
new-feature-2027), default is "mirror it
gitnative on LFG." Forks never duplicate. Full
coverage is the asymptote, not the entry
condition — land incrementally via enhancement-
backlog. Secret VALUES never land; secret NAMES
do. Environment vars: NAMES yes, VALUES no.
When in doubt about a new field: if it's metadata,
mirror it; if it's secret material, just mirror
its name + last-rotated timestamp if exposed.
