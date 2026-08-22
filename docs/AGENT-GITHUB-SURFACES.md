# Agent GitHub-Surfaces Playbook — ten surfaces, one cadence

Umbrella playbook for the ten GitHub-side surfaces the factory
owns or monitors. Peer to
[`docs/AGENT-ISSUE-WORKFLOW.md`](AGENT-ISSUE-WORKFLOW.md) (which
covers the *abstract dual-track principle* and the three concrete
adapter choices for issues). This doc is the concrete
**GitHub-as-current-adapter** playbook: cadence, classification,
actions, and fire-history for every surface Aaron has named as
factory-owned.

Aaron 2026-04-22, seven directives in sequence (one round of
surface-assignment):

> we are going to need cadence for checking open PRs and taking
> whatever action necessary that is the best for the project,
> start classing differt types of PRs you run into and have to
> resovle and i'll see how you handled it, we can beef up our
> stuff over time. Also same with issues

> you own the wiki too https://github.com/AceHack/Zeta/wiki

> and discussions https://github.com/AceHack/Zeta/discussions

> we need skills for all this so you are not redicoverging ive
> added a lot of asks with out skill scalfolding

> you can own https://github.com/AceHack/Zeta/settings/copilot/coding_agent
> and all our settings on the project you can own ohhh you can
> own https://github.com/AceHack/Zeta/agents?author=AceHack you
> should research that one

> and https://github.com/AceHack/Zeta/security

> oh look at all the data !!! https://github.com/AceHack/Zeta/pulse
> might want to map it out for quick lookups and maybe it can
> help with some of our verifactions

> we should start experiting with https://github.com/AceHack/Zeta/settings/pages
> Jekyll seems like we could push the boundaries if needed,
> maybe static pages is enough? you can figure out what works
> good with bun. [research on backlog for that i mean]

The "we need skills" directive is the meta-rule: codify *once*
so future agents don't rediscover. Skill is at
[`.claude/skills/github-surface-triage/SKILL.md`](../.claude/skills/github-surface-triage/SKILL.md).

## The ten surfaces at a glance

| # | Surface | Shape | Factory posture | Skill ownership |
|---|---|---|---|---|
| 1 | Pull Requests | Seven-shape triage | Own + triage + merge | Kenji on round-cadence; all agents on on-touch |
| 2 | Issues | Four-shape triage | Own + triage + resolve | Kenji on round-cadence; all agents on on-touch |
| 3 | Wiki | Three-shape sync (drift / in-sync / orphaned) | Own + published-mirror of in-repo docs | Kenji on round-cadence; Daya on adopter UX |
| 4 | Discussions | Four-shape response (six categories) | Respond + convert-to-issue | Kenji on round-cadence; all agents on on-touch |
| 5 | Repo Settings (general) | ADR-gated declarative config | Own; audit-trail required | Kenji; Aaron sign-off for policy changes |
| 6 | Copilot coding-agent settings (sub-surface of 5) | ADR-gated | Own; scope matches `.github/copilot-instructions.md` | Kenji; Aaron sign-off |
| 7 | Agents tab (GitHub Agents, Jan-2026 feature) | Session dashboard — Copilot / Claude / Codex | Monitor; dispatch + observe | Kenji; session-level |
| 8 | Security (advisories / code-scanning / Dependabot) | Alert-triage + policy | Own + remediate | Mateo (security-researcher); Nazar (sec-ops); Aaron for policy |
| 9 | Pulse / Insights | Read-only data source | **Verification substrate** — DORA signals, velocity sanity-check | Kenji + alignment-observability (Sova) consume; no write |
| 10 | Pages (`/settings/pages`) | Research-gated; unpublished | Evaluate Jekyll vs. static-HTML vs. bun-built output before adopting | Kenji owns research row; Aaron sign-off to enable |

Surfaces 1-4 have full sections below. Surfaces 5-10 have
compact sections — they will be "beefed up" over rounds per
Aaron's standing clause.

## Cadence (all four surfaces)

**Round-close primary.** Every round-close runs a four-surface
sweep. Same cadence as round-management, `docs/ROUND-HISTORY.md`
capture, upstream-sync (FACTORY-HYGIENE row #15).

**Opportunistic on-touch.** Any tick that touches a surface
(PR comment, issue label, wiki edit, discussion reply) logs one
row to the surface's fire-history. Not exhaustive — the
round-close catches what on-touch missed.

**Fire-history surfaces** (append-only, FACTORY-HYGIENE row #47
compliance):

- PRs -> `docs/hygiene-history/pr-triage-history.md`
- Issues -> `docs/hygiene-history/issue-triage-history.md`
- Wiki -> `docs/hygiene-history/wiki-history.md`
- Discussions -> `docs/hygiene-history/discussions-history.md`

## Surface 1 — Pull Requests

### The seven shapes (PR classification)

Every open PR fits one of seven shapes. When multiple match,
higher-in-list wins (severity-then-specificity order).

1. **Merge-ready.** CI green, no blocking findings, mergeable.
   -> Squash-merge (or rebase if preserved history matters);
   update durable history; log.

2. **Has review findings (actionable).** Reviewer (human /
   Copilot / harsh-critic) left P0 / P1 / P2 findings.
   -> Classify each finding: P0 = block-merge; P1 = should-fix
   unless cost-of-delay argument recorded; P2 = follow-up
   BACKLOG row. Reply to every finding — silent-drop is trust
   failure.

3. **BEHIND-main.** Mergeable in isolation but base-branch
   advanced (`mergeStateStatus: BEHIND`).
   -> Rebase onto main for small PRs (< 10 commits) or merge
   main into branch for large ones. Defer to author if branch
   is active work-surface.

4. **Awaiting-human.** PR on an Aaron-scoped decision
   (public-API break, architectural cleave, melt-precedent,
   naming, research direction).
   -> File `docs/HUMAN-BACKLOG.md` row + optional `human-ask`
   label. Do not merge, do not close. Comment with the pending
   decision and cost-of-delay.

5. **Experimental / deliberate-interrupt.** PR exists to test
   a hypothesis; merge decision hinges on experiment results,
   not diff quality.
   -> Record outcomes in PR thread and
   `docs/research/<slug>.md`. Merge or close per test plan.

6. **Large-surface (split-before-merge).** > 50 commits,
   > 10k added LoC, or > 3 orthogonal concerns.
   -> Split into topic-scoped PRs. If infeasible, merge with
   extra reviewer pass + split-waiver in PR description.

7. **Stale / abandoned.** No activity > 14 days, author gone.
   -> Post revive-or-close comment. Wait 7 days. Close with
   superseding-link summary, or reassign via `good-first-issue`.

### Open PR state (as of 2026-04-22)

- **#31** (round-41 -> main) — `behind-main` +
  `has-review-findings` + `awaiting-human`. Copilot left 8
  findings. Superset-subset relationship with #32
  (round-42-speculative descends from round-41). Aaron decides:
  merge #31 as smaller slice, or close in favour of #32.
- **#32** (round-42-speculative -> main) — `experimental` +
  `behind-main` + `has-review-findings` + `large-surface`
  (100 commits / +19756 LoC). Testing Copilot PR-review
  self-audit / self-repair / big-picture capability. 7
  findings triaged. Merge decision hinges on experiment result,
  not diff.

## Surface 2 — Issues

### The four shapes (issue classification)

1. **Triaged-already.** Labelled, claimed, in-progress.
   Nothing to do.
2. **Needs-triage.** New, unlabelled, no claim.
   -> Apply labels (category, priority), decide claim vs park,
   mirror to durable-history row if adopted.
3. **Stale-claim.** `in-progress` claim > 24 hours per
   `docs/AGENT-ISSUE-WORKFLOW.md` claim protocol.
   -> Release or extend claim with new ETA.
4. **Superseded / closable.** Duplicate or landed elsewhere.
   -> Close with superseding-link comment.

### Open issue state (as of 2026-04-22)

Zero open issues.

## Surface 3 — Wiki

### Factory position

Aaron 2026-04-22: *"you own the wiki too"*.

The wiki is a **published-surface mirror** of selected in-repo
docs. It is factory-owned, factory-authored, and factory-synced.
**Authoritative text lives in the repo** (`docs/` and
root-level `.md` files) — the wiki is a rendered / distilled
view.

This rule is explicit because wiki drift is the most common
failure mode of GitHub-wiki usage: two authors, two sources of
truth, eventual contradiction. Zeta sidesteps it by declaring
the repo as the single source of truth and treating the wiki
as a publish target.

### The three wiki pages (proposed seed set)

The wiki starts empty (confirmed 2026-04-22 — clone returned
"Repository not found" which on GitHub means wiki is enabled
but has no pages yet). On first sync, seed three pages mapped
from in-repo docs:

1. **Home** — distilled `AGENTS.md` + `docs/VISION.md` landing
   page. Pointer to repo for full detail.
2. **Getting Started (Human Contributors)** — distilled
   `CONTRIBUTING.md` + `docs/CONTRIBUTOR-PERSONAS.md`.
3. **Getting Started (AI Agents)** — distilled `AGENTS.md`
   §§ "How AI agents should treat this codebase" + build/test
   gate + pointer to `CLAUDE.md` and the
   `.github/copilot-instructions.md` reviewer contract.

Each page ends with a **freshness footer**: *"Last synced from
repo commit `<SHA>` on `<date>`."* This is the drift-detector.
A wiki page whose footer SHA is behind main by > 20 commits
triggers a sync. The "20" is a guess; tune after observation.

### The three wiki shapes

1. **In-sync.** Footer SHA behind main by <= 20 commits. No
   action.
2. **Drifted.** Footer SHA behind by > 20 commits **or** the
   source repo doc has changed since last sync.
   -> Re-render from current repo source. Update footer SHA.
3. **Orphaned.** Wiki page has no corresponding repo source.
   -> Delete with a "moved to repo: `<path>`" redirect, or
   rewrite as a distilled view of the new canonical source.

### Wiki action log

Every wiki edit logs to
`docs/hygiene-history/wiki-history.md` with:
date / agent / page / shape / action / source-commit-SHA.

### Adapter note

Wiki is a GitHub-specific surface. Adopters on GitLab use its
Wiki feature (same git-backed mechanics); adopters on other
platforms pick a mirror target (Confluence / Notion / static
site). The *discipline* (source-of-truth in repo, drift
detector in footer, fire-history surface) is adapter-agnostic.

## Surface 4 — Discussions

### Factory position

Aaron 2026-04-22: *"and discussions"* — same ownership as the
other three surfaces.

Discussions is a **community-ingress** surface distinct from
issues:

- **Issues** = confirmed, actionable work item.
- **Discussions** = open-ended conversation, question, idea,
  announcement, poll, show-and-tell.

The factory **responds to** discussions more than it authors
them. A discussion may become an issue (if it surfaces a bug
or feature request); an issue should not become a discussion
(that would hide work under conversation).

### The six categories + four shapes

GitHub's default six categories are enabled on this repo
(confirmed 2026-04-22 via GraphQL):

- **Announcements** (maintainer-only posting)
- **General**
- **Ideas**
- **Polls**
- **Q&A**
- **Show and tell**

Every open discussion fits one of four shapes:

1. **Needs-response.** Q&A question unanswered; Idea without
   factory acknowledgement. SLA: respond within 48 hours of
   surfacing (round-cadence plus opportunistic).
   -> Reply. If it's actionable, file an issue and link.
2. **Tracked-already.** Discussion has been linked to an
   existing issue / BACKLOG row / ADR.
   -> No action. Log check to fire-history.
3. **Convert-to-issue.** Discussion has crystallized into an
   actionable work item.
   -> Open issue, link both ways, optionally lock the
   discussion with "tracked in #N" comment.
4. **Close / archive.** Discussion is resolved, obsolete, or
   off-topic.
   -> Close with closing-comment summary. GitHub preserves the
   thread.

### Discussions action log

Every discussion reply / conversion logs to
`docs/hygiene-history/discussions-history.md` with:
date / agent / discussion / category / shape / action / link.

### Agent-posted discussions

Agents **may** author discussions (Announcements, Ideas, Polls)
when the content suits the conversational shape and isn't yet
concrete enough for an issue. Convention:

- Announcements: round-close summary, major release, policy
  change. One per 5-10 rounds max.
- Ideas: speculative direction, research hypothesis, community
  sensing. Must link to the `docs/research/<slug>.md` note.
- Polls: community signal on a melt-precedent decision Aaron
  has opened to broader input.

Q&A and Show-and-tell are **human-initiated only** by default
— an agent authoring a Q&A question of itself is a red flag
(the agent should file a `human-ask` instead).

### Open discussion state (as of 2026-04-22)

Zero open discussions.

## Surface 5 — Repo Settings (general)

Factory position: **declarative + ADR-gated**. Every policy
change to the repo settings (branch protection, merge
requirements, action permissions, default branch, visibility,
features enabled/disabled) is a decision that should leave a
git trail somewhere in `docs/DECISIONS/`.

The `gh api repos/<owner>/<name>` endpoint returns the full
settings payload; the factory snapshots this to
`docs/github-repo-settings-snapshot.md` (new durable surface,
seeded on the next round-close; the snapshot is the read).
Diffs in the snapshot across rounds become ADR candidates.

Fire-history: settings changes co-logged to
`docs/hygiene-history/wiki-history.md` section "repo-config" or
their own file — decision deferred to next round.

**Aaron sign-off required** for: visibility change, default
branch change, disabling Issues/Discussions/Wiki, branch
protection changes on `main`, action permissions tightening.
Mirror to `docs/HUMAN-BACKLOG.md` as `settings-change` row.

## Surface 6 — Copilot coding-agent settings

Sub-surface of 5. Dedicated URL
(`/settings/copilot/coding_agent`) because Copilot coding-agent
is configured independently from Copilot-in-VS-Code and
Copilot-PR-review. Settings here govern: which branches the
`@copilot` autonomous PR author can push to, which labels
trigger it, which reviewers it requests, which tools it has
access to.

Scope must match
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md)
(the reviewer-robot contract) — if settings grant a capability
the instructions forbid, the instructions are the source of
truth and settings get narrowed.

Classification is same three-shape as wiki drift: **aligned**,
**drifted** (settings grant more than instructions allow, or
vice versa), **orphaned** (settings reference a removed
workflow / branch / label).

## Surface 7 — Agents tab

Introduced by GitHub 2026-01-26 ([changelog](https://github.blog/changelog/2026-01-26-introducing-the-agents-tab-in-your-repository/));
see also the [Visual Studio Magazine hands-on](https://visualstudiomagazine.com/Articles/2026/01/29/Hands-On-New-GitHub-Agents-Tab-for-Repo-Level-Copilot-Coding-Agent-Workflows.aspx)
and [GitHub Docs Copilot features page](https://docs.github.com/en/copilot/get-started/features).

**What it is.** A repository-level dashboard for agent
sessions — Copilot coding agent plus third-party agents
(Claude, OpenAI Codex). You dispatch tasks, monitor progress,
and navigate to resulting PRs from one page. Calls itself
"mission control" for agent work.

**Factory posture.** *Watch before adopt.* Adoption lands via
ADR once the factory has observed how Agents-tab sessions
interact with the round-cadence loop and the `autonomous-loop`
cron. Key open questions:

1. Can an Agents-tab session replace the local `<<autonomous-loop>>`
   cron, or do the two coexist cleanly?
2. Does the Agents-tab dispatch surface leak into tick-history
   attribution (i.e., is a session-dispatched commit
   distinguishable from a tick-driven commit in `git log`)?
3. How do claim-locks in `docs/AGENT-ISSUE-WORKFLOW.md`
   interact with Agents-tab parallelism?

Parked as `docs/research/agents-tab-evaluation-2026-04-22.md`
candidate. Queue BACKLOG P2 row for the evaluation itself.

## Surface 8 — Security

Four sub-surfaces:

1. **Advisories** — `/security/advisories`. Factory can file
   advisories for its own vulnerabilities. Mateo
   (security-researcher) owns.
2. **Dependabot alerts** — `/security/dependabot`. Currently 0
   open (verified 2026-04-22). Dependabot auto-PRs land on
   PR surface 1 and triage per the seven-shape taxonomy.
3. **Code scanning alerts** — `/security/code-scanning`.
   Currently 12 open. Nazar (security-ops) + Mateo on
   round-cadence.
4. **Secret scanning** — `/security/secret-scanning`. Aaron
   sign-off required for any dismissal — a dismissal-without-
   investigation is the highest-severity failure on this
   surface.

Classification: same P0 / P1 / P2 / dismiss shape as review
findings on PRs, with a P0-secret override that blocks all
factory work until rotated.

Fire-history: `docs/hygiene-history/security-triage-history.md`
(new, to be created on first triage fire).

## Surface 9 — Pulse / Insights (verification substrate)

Aaron's note: *"might want to map it out for quick lookups and
maybe it can help with some of our verifactions"*.

Pulse is the most **quantitative** GitHub surface. Read-only,
factory-wide, machine-accessible via:

- `gh api repos/<owner>/<name>/stats/participation` — weekly
  commit counts, 52 weeks
- `gh api repos/<owner>/<name>/stats/commit_activity` — daily
  for last year
- `gh api repos/<owner>/<name>/stats/contributors` — per-author
  adds/deletes/commits
- `gh api repos/<owner>/<name>/stats/code_frequency` —
  adds/deletes per week
- `gh api repos/<owner>/<name>/contributors` — contributor
  list

**Verification uses** (feeds in-repo claims against independent
GitHub-side data):

- **DORA deploy-frequency** — weekly commit counts on `main`
  cross-check the claimed round cadence.
- **Velocity sanity-check** — tick-history row count vs. pulse
  commit count catches pulse drops when the loop silently
  stopped.
- **Attribution hygiene** — contributor stats surface
  co-authors; mismatch vs. stated co-author trail is a
  hygiene signal.
- **Rounds-per-month** — pulse weekly counts are the ground
  truth for round-delivery claims in `docs/FACTORY-RESUME.md`.

Classification: not "shapes" — this surface is read, not
triaged. Factory position is **snapshot-per-round-close** into
`docs/hygiene-history/pulse-snapshot.md` (new, to be created).
Each snapshot is a short dated block of the five gh-api
outputs above, so `git log` diffs give velocity deltas for
free.

Sova (alignment-observability) consumes pulse data as an
independent-from-in-repo-claims signal — one of the few such
signals available.

## Surface 10 — Pages (research-gated)

Aaron 2026-04-22: *"we should start experiting with
[/settings/pages] Jekyll seems like we could push the
boundaries if needed, maybe static pages is enough? you can
figure out what works good with bun."* Follow-up clarification:
*"like research on backlog for that i mean"* — scope is
**research, not implementation**.

**Current state.** Pages is unpublished (`gh api
repos/<owner>/<repo>/pages` returns 404). No `gh-pages`
branch, no `docs/` publish source configured.

**Two deploy models on offer from GitHub:**

1. **GitHub Pages Jekyll (by GitHub Actions).** Jekyll site
   with Pages dependencies preinstalled. Ruby toolchain; large
   theme / plugin ecosystem; GitHub-managed build.
2. **Static HTML (by GitHub Actions).** Deploys static files
   with no build step. Any HTML / CSS / JS pipeline is free to
   produce the publish directory.

**Factory constraint to reconcile.** The UI canonical is
**bun + TypeScript** (memory
`project_ui_canonical_reference_bun_ts_backend_cutting_edge_asymmetry`).
A Jekyll path forces a Ruby toolchain alongside bun — a
cross-ecosystem seam the factory otherwise avoids. Static
HTML + bun-built output keeps the stack single-ecosystem at
the cost of writing a small build step ourselves.

**Three adoption paths to evaluate** (not yet decided):

- **A. Static-only, no build.** Hand-authored HTML in a
  `docs/` publish directory. Cheapest; boundary with the
  in-repo docs at `docs/**` is awkward (same directory name,
  different semantics). Works for a trivially small site.
- **B. Static HTML with a bun-built publish directory.**
  Bun + TypeScript + a small site generator (Eleventy on
  bun, or Astro, or a hand-written bun script). Matches the
  UI canonical stack. Cost: a build workflow and an opinion
  about which generator.
- **C. Jekyll.** Accept the Ruby seam for the theme
  ecosystem and GitHub-managed build. Lowest authoring
  cost per page; highest ecosystem drift risk.

**Deferred to BACKLOG.** Row landed this round
(`P2 — Factory setup / adopter choices`, Pages-deploy
research). Owner: Kenji (round-close); deliverable is a
short decision doc under `docs/research/pages-deploy-
evaluation-YYYY-MM-DD.md` with an ADR recommendation.
**Adoption gated on Aaron sign-off** — Pages enablement
is a policy-shaped settings change (Surface 5 rule).

**Classification shapes** (for the day Pages is adopted):

1. **Unpublished.** No Pages deployment — current state.
2. **Published-in-sync.** Deploy source SHA tracks `main`
   within ~20 commits (same threshold as wiki drift).
3. **Published-drifted.** Deploy source SHA behind by >20
   commits; content no longer reflects current repo.
4. **Deploy-broken.** Workflow failing; site serving stale
   or 404.

**Fire-history.** `docs/hygiene-history/pages-history.md` —
seeded on first publish, not before (no empty-surface logs).

**Factory posture: watch before adopt.** Same as Agents tab
(Surface 7). Pages and Agents are the two surfaces where
waiting for fire-evidence costs us less than reverting a
premature adoption.

## Round-close mechanical procedure

One sweep per round-close covers all ten surfaces. The
[`github-surface-triage`](../.claude/skills/github-surface-triage/SKILL.md)
skill encodes the steps — this section is the human-readable
version:

1. **PRs** — `gh pr list --state open --json number,title,author,labels,isDraft,mergeable,mergeStateStatus,createdAt`
2. **Issues** — `gh issue list --state open --json number,title,author,labels,createdAt`
3. **Discussions** — `gh api graphql -f query='{ repository(owner:"<owner>", name:"<name>") { discussions(first:50, states:OPEN) { nodes { number title category { name } } } } }'`
4. **Wiki** — read the published surface, check each page's
   footer SHA against `git rev-parse HEAD`.
5. **Repo Settings** — `gh api repos/<owner>/<name>` + diff
   against last snapshot.
6. **Copilot coding-agent settings** — sub-read of 5; cross-
   check against `.github/copilot-instructions.md`.
7. **Agents tab** — manual for now (no stable API); ADR-gated
   adoption pending.
8. **Security** — `gh api repos/<owner>/<name>/code-scanning/alerts`,
   `/dependabot/alerts`, `/secret-scanning/alerts`.
9. **Pulse** — five `gh api .../stats/*` calls + append to
   `docs/hygiene-history/pulse-snapshot.md`.
10. **Pages** — `gh api repos/<owner>/<repo>/pages` (404
    means unpublished, current state). Adoption blocked on
    ADR; no action until decision lands.

For each surface, classify, act, log. Surface findings up to
`docs/HUMAN-BACKLOG.md` where Aaron sign-off needed.

## Ownership

**Architect (Kenji)** runs the round-cadence sweep. **Every
agent** logs on-touch.

The skill at
[`.claude/skills/github-surface-triage/SKILL.md`](../.claude/skills/github-surface-triage/SKILL.md)
operationalizes this doc so future agents don't rediscover the
classification. Skill invocation at round-close and
opportunistically on any tick that interacts with a GitHub
surface.

## Adapter neutrality

This doc uses GitHub as the concrete adapter because Zeta is on
GitHub. Adopters on other platforms map the four surfaces:

| GitHub | GitLab | Gitea | Bitbucket |
|---|---|---|---|
| Pull Requests | Merge Requests | Pull Requests | Pull Requests |
| Issues | Issues | Issues | Issues |
| Wiki | Wiki | Wiki | Wiki |
| Discussions | — (use Matrix / Discourse) | — (use Matrix) | — (use Jira Service Desk) |

The classification taxonomies (seven PR shapes / four issue
shapes / three wiki shapes / four discussion shapes) are
platform-agnostic.

## Beef-up clause

Aaron 2026-04-22: *"we can beef up our stuff over time"*. The
taxonomies are declared **non-final**. First 5-10 rounds of
fire-history feed a taxonomy-revision pass. New shapes get
appended; ambiguous shapes get split; obsolete shapes get
retired (with a row-history-preserved note, not deletion).

## References

- [`docs/AGENT-ISSUE-WORKFLOW.md`](AGENT-ISSUE-WORKFLOW.md) —
  abstract dual-track principle + three adapter choices
- [`docs/HUMAN-BACKLOG.md`](HUMAN-BACKLOG.md) — mirror rows for
  Aaron-scoped decisions across all four surfaces
- [`docs/FACTORY-HYGIENE.md`](FACTORY-HYGIENE.md) — row #48
  (ten-surface triage cadence) + row #47 (fire-history for
  every cadenced surface)
- [`docs/hygiene-history/pr-triage-history.md`](hygiene-history/pr-triage-history.md)
- [`docs/hygiene-history/issue-triage-history.md`](hygiene-history/issue-triage-history.md)
- [`docs/hygiene-history/wiki-history.md`](hygiene-history/wiki-history.md)
- [`docs/hygiene-history/discussions-history.md`](hygiene-history/discussions-history.md)
- `docs/hygiene-history/security-triage-history.md` (to be seeded on first triage)
- `docs/hygiene-history/pulse-snapshot.md` (to be seeded on first round-close)
- `docs/hygiene-history/pages-history.md` (to be seeded on first Pages publish — gated on ADR)
- `docs/github-repo-settings-snapshot.md` (to be seeded on first round-close)
- [`.claude/skills/github-surface-triage/SKILL.md`](../.claude/skills/github-surface-triage/SKILL.md) —
  executable procedure
- `.github/copilot-instructions.md` — reviewer-robot scope
  (factory-managed PR-reviewer input)
- [`docs/CONTRIBUTOR-PERSONAS.md`](CONTRIBUTOR-PERSONAS.md) —
  who we expect to land on each surface
