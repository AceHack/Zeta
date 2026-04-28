---
name: Git-native is the abstraction; GitHub is the first concrete host; call out gh-specific commands / Pages / GHA as GitHub adapters so the factory stays pluggable to GitLab / other git hosts
description: Aaron 2026-04-23 *"i guess pages is github native, but our code can likely be git native only need git and not gh commands but gh commands are welcome we just need to call out gh becasue we want to be pluggable eventually to gitlab to, we are gitnative with our first host as github."* The factory's core substrate should work on any git host (git-native). GitHub-specific integrations (`gh` CLI, Pages, Actions, webhooks, API) are adapters; they are welcome but must be explicitly labeled as GitHub-specific so a GitLab / Gitea / Bitbucket adapter can slot in at the same seam.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Git-native core + GitHub adapter (plural-host pluggability)

## Verbatim (2026-04-23)

> i guess pages is github native, but our code can likely
> be git native only need git and not gh commands but gh
> commands are welcome we just need to call out gh becasue
> we want to be pluggable eventually to gitlab to, we are
> gitnative with our first host as github.

## The rule

The factory has **two distinct scopes** for host
dependencies:

1. **Git-native core** — anything that depends only on
   git (the DCVS itself). Works on any git host: GitHub,
   GitLab, Gitea, Bitbucket, Azure DevOps Repos, bare
   SSH remotes, local-only repos. This is the **factory
   substrate** — the scripts / docs / skills / hygiene
   rows / memory discipline / autonomous-loop tick that
   doesn't care who hosts the repo.

2. **GitHub-specific adapters** — anything that uses
   `gh` CLI, GitHub REST / GraphQL API, GitHub Actions,
   GitHub Pages, Copilot, CodeQL, Dependabot, or any
   other GitHub-hosted service. These are **adapters**
   against the git-native core; they are welcome but
   must be **explicitly labeled as GitHub-specific**.

The rule: **anything that uses `gh` / GHA / Pages / other
GitHub-specific surfaces must declare itself as a GitHub
adapter** so a sibling adapter for GitLab / Gitea /
Bitbucket can slot in at the same seam when the factory
eventually goes plural-host.

## Why plural-host matters

- **First host is GitHub** — today's concrete choice. Not
  the only host forever.
- **Adopter freedom** — factory-kit consumers may choose
  GitLab (common for enterprise on-prem / compliance),
  Gitea (self-hosted, lightweight), Bitbucket (Atlassian
  shops), Azure DevOps (Microsoft shops).
- **Composable with LFG soulfile inheritance** — the
  `LFG` org is a GitHub choice today. If LFG eventually
  moves to or replicates on another host, the factory
  needs to follow without a full rewrite.
- **Composable with the factory-technology-inventory**
  (`docs/FACTORY-TECHNOLOGY-INVENTORY.md` lands via PR
  #170) — the inventory's agent-harnesses row already
  tracks GitHub + bun + CLI. The git-host adapter
  distinction should surface as a new "Git host" row
  once activated.

## How to apply

### For scripts in `tools/`

- Scripts that only use `git` commands are git-native.
  No labelling needed.
- Scripts that use `gh` commands should either:
  - **Option A**: be namespaced as adapters (e.g.,
    `tools/github/**` or `tools/adapters/github/**`)
  - **Option B**: carry a header comment declaring
    them as GitHub adapters (if they live alongside
    git-native scripts for convenience).
- The post-setup-script-stack (FACTORY-HYGIENE row #49)
  bun+TS default doesn't change; what changes is the
  label "GitHub adapter" for scripts that bind to GH
  specifically.

### For docs

- Generic factory docs use git-native vocabulary
  ("branch", "PR", "merge", "rebase", "remote").
- GitHub-specific vocabulary ("`gh` CLI", "Actions",
  "Pages", "Copilot review", "CodeQL") only in docs that
  are explicitly about GitHub integration, and those
  docs should either live under a `docs/adapters/github/`
  tree (when that emerges) or carry a clear
  "GitHub-specific" header.

### For the Pages-UI (BACKLOG P2 row PR #172)

- **Pages itself is GitHub-native** by definition (GitHub
  Pages doesn't exist on GitLab). That's fine — it's an
  adapter.
- The **factory-state content feeding the UI** (PRs,
  ADRs, HUMAN-BACKLOG, CONTRIBUTOR-CONFLICTS,
  ROUND-HISTORY, hygiene-history, etc.) is git-native —
  it lives in the repo regardless of host.
- The **UI read-path** uses GitHub REST API + `gh` calls
  — GitHub adapter.
- The **UI write-path** (Phase 2) would be
  GitHub-specific (OAuth). A GitLab adapter would be a
  separate implementation; the spec stays the same.
- Refine the row to distinguish "git-native state" from
  "GitHub-adapter presentation."

### For hygiene rows + CI workflows

- `.github/workflows/*.yml` files are inherently
  GitHub-specific (they implement the adapter).
- The hygiene rows they enforce are git-native
  (build-and-test, markdownlint, semgrep, shellcheck,
  actionlint, CodeQL queries) — they describe what to
  check, GitHub Actions describes how to run it on
  GitHub.
- When a GitLab adapter comes, the rows stay;
  `.gitlab-ci.yml` files become the new adapter.

### For the autonomous-loop tick

- The loop itself is git-native (commits, branches,
  pushes — all standard git).
- Using `gh pr create` in tick-close is the GitHub
  adapter. A GitLab adapter would use `glab mr create`.
- Tick-history mentions of `gh` are GitHub-adapter
  work; mentions of `git` are git-native.

## What this is NOT

- **Not a mandate to retrofit all `gh` use right now.**
  Labelling happens opportunistically as scripts /
  docs are touched. Backlog-refactor hygiene (row #54)
  cadence catches drift over time.
- **Not a commitment to ship a GitLab adapter on any
  schedule.** First host is GitHub. Adapter scaffolding
  happens when an adopter asks, not preemptively.
- **Not a ban on GitHub-specific features.** Actions,
  Pages, Copilot, CodeQL are all welcome. Just label.
- **Not an over-engineering call.** Don't abstract
  everything behind a HostAdapter interface today. The
  rule is "name the GitHub-specific parts"; that alone
  is enough to identify the adapter seam for when a
  second host is added.
- **Not a change to any existing setting.** Current
  scripts, docs, and workflows stay as-is; future
  author-time decisions add the labels.

## Composes with

- `docs/FACTORY-TECHNOLOGY-INVENTORY.md` (PR #170 target;
  future row "Git host adapter: GitHub" at Adopt;
  GitLab / Gitea / Bitbucket at Assess with explicit
  "not yet implemented")
- `docs/AGENT-GITHUB-SURFACES.md` — already per-GitHub-
  surface inventory; naturally the GitHub adapter's
  inventory surface
- Pages-UI BACKLOG row PR #172 — refine with git-native-
  vs-GitHub-native distinction
- FACTORY-HYGIENE row #48 (cross-platform parity) —
  sibling discipline (OS + arch); git-host is the same
  shape (plural-host, label the adapter)
- `tools/setup/` — git-native setup base; any GitHub-
  specific setup steps (if any beyond `gh auth`) marked
  as adapter
- `feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`
  — `gh` usage within already-paid GitHub subscription
  is free work; adding a new git host would be paid
  (new service) if it's a paid tier
