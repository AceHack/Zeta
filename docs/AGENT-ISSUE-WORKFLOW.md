# Agent Issue Workflow — dual-track principle + adapter choices

This factory is designed to be reusable across projects. The
**issue-tracker choice is an adopter decision made at factory
setup**, not a factory requirement. The factory itself only
mandates the abstract **dual-track principle**; each adopter
picks which concrete tracker plays the "active-workflow" role.

Aaron 2026-04-22, setting scope:

> not everyone who uses this tool will use github issues a lot
> will use jira or just the git native, this factory should
> not force issues just use them if during the intial setup
> the user decides to

## The dual-track principle (factory-level, portable)

Every unit of factory work lives on two surfaces:

| Surface | Role | Decay risk |
|---|---|---|
| **Active workflow** — claims, discussion, labels, assignment, parallelization locks | Tells you what somebody is working on right now | High. Platform / org / auth changes. |
| **Durable git-history** — in-repo markdown (`docs/BACKLOG.md`, `docs/BUGS.md`, `docs/HUMAN-BACKLOG.md`, `docs/FACTORY-HYGIENE.md`, `docs/DEBT.md` for accidental debt, `docs/INTENTIONAL-DEBT.md` for declared shortcuts) | Tells you what the project ever did; mineable by `git log` / `git blame` / `git diff` across years | Zero while the repo exists. |

The durable-git-history surface is always **required** — it is
the factory's research substrate (Aaron 2026-04-22: *"we should
run both github tracking and issues for this project long term
becasue we want the git histroy too for reserach purposes"*).

The active-workflow surface is **one of three adapter choices**
picked at setup time:

## Adapter choices (adopter picks at setup)

### (1) GitHub Issues

- Pros: free, integrated with PRs, good label / milestone
  tooling, `gh` CLI scriptable, Claude Code `github` plugin
  provides MCP access.
- Requirements: repo on GitHub, Issues feature enabled,
  agents have `gh auth` or `GITHUB_PERSONAL_ACCESS_TOKEN`.
- This is **Zeta's current choice** — enabled 2026-04-22.
  See "Zeta-specific: GitHub Issues configuration" below.

### (2) Jira (or any ticketing SaaS — Linear, Asana, Shortcut)

- Pros: richer workflow states, cross-repo visibility,
  enterprise SSO.
- Requirements: agent access via MCP (Anthropic provides
  `claude.ai_Atlassian` MCP for Jira; others via Zapier /
  API tokens).
- Adapter template: clone the GitHub Issue templates under
  `.github/ISSUE_TEMPLATE/` to Jira issue types; the body
  structure (Summary / Category / Priority / Effort /
  Acceptance criteria / Dual-track / Claim discipline)
  transfers 1:1.

### (3) Git-native only

- Pros: zero external dependency, fully offline, perfect for
  private / air-gapped work.
- Requirements: none beyond git.
- In this mode the in-repo markdown files (`docs/BACKLOG.md`,
  `docs/BUGS.md`, `docs/HUMAN-BACKLOG.md`) are the durable
  backlog surface; "active workflow" state lives in commit
  messages and the row-level status indicators those rows
  carry (`[blocked on ...]`, `[done in SHA]`).
- Claims happen via the **git-native claim protocol** — the
  authoritative substrate specified in
  [`AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md): a
  per-claim file at `docs/claims/<slug>.md` plus
  `claim:` / `progress:` / `release:` commits on a
  `claim/<slug>` branch pushed to `origin`. Parallel
  agents discover live claims by listing remote claim
  branches (`git fetch origin &&
  git branch -r --list 'origin/claim/*'`) and reading
  the claim file directly from the remote ref
  (`git show origin/claim/<slug>:docs/claims/<slug>.md`);
  `ls docs/claims/` on `main` only shows merged-but-not-
  released claims, not active ones still in flight.
- Backlog row markers (`[in-progress 2026-04-22 by session X]`,
  `[blocked on ...]`, `[done in SHA]`) remain useful as
  **row-local annotations** on the durable backlog row, but
  they are not the locking mechanism — the claim file is.
  Adopters who want backlog-only claims (no separate
  `docs/claims/` directory) can document that divergence in
  their own ADR; in that simpler mode, claims happen via
  short status-marker commits visible to parallel agents
  running `git log docs/BACKLOG.md`.

### Choosing at setup

The canonical setup script under `tools/setup/` currently does
not prompt for this. Tracked at task #267-adjacent (factory-
adoption configuration prompts) — the planned prompt: "Which
issue tracker will this project use? [GitHub Issues / Jira /
git-native] — agent workflow defaults adapt." Until that lands,
Zeta's default is (1) and adopters copying the factory should
read this doc and choose consciously.

## The claim / lock protocol (adapter-neutral)

Parallel agents need a non-colliding way to signal "I'm
starting on this work." The full git-native protocol
specification lives in
[`docs/AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md) —
that doc is the standalone, linkable reference you hand to
an external agent (ChatGPT / Codex / Gemini / Deep Research)
along with the task URL. The table below summarises the
mechanism per adapter; the git-native row is the substrate
the other two adapters mirror.

| Adapter | Claim mechanism | Release mechanism | Lookup for parallel agent |
|---|---|---|---|
| GitHub Issues | Comment `claimed by session <id> <UTC-ts> — ETA <...>` + add `in-progress` label | Comment `releasing — landed in <SHA>` + remove label + close (if done) | `gh issue list --label in-progress` |
| Jira | Transition to `In Progress` state + assign to self + add comment | Transition to `Done` / `Released` + comment with commit | `jql: status = "In Progress"` |
| Git-native | Claim file at `docs/claims/<slug>.md` on a `claim/<slug>` branch pushed to `origin` (directory tracked on `main`, `README.md` placeholder); commit `claim: <slug> - <scope>` (see [`AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md) for the full shape) | Delete the claim file; commit `release: <slug> - landed in <SHA>` | `git fetch origin && git branch -r --list 'origin/claim/*'` (active claims) plus `ls docs/claims/` (claims merged to `main`) |
| Git-native (legacy row-marker variant) | Short commit touching the row: `BACKLOG: claim row #42 — session <id> <UTC-ts>` | Commit touching the row: `BACKLOG: release row #42 — landed in <SHA>` | `git log --grep="claim row" docs/BACKLOG.md` |

### Claim windows and stale-claim force-release

- A claim is considered **active** for 24 hours.
- After 24 hours of inactivity (no release, no
  progress-signal comment / commit), a claim is **stale**.
- Another agent may force-release a stale claim by leaving a
  comment / commit citing the stale claim's timestamp.
- Do not force-release inside the 24-hour window.

This window is set to **one working day**. If evidence shows
it's too tight (false force-releases) or too loose (long
zombie claims), revise via ADR.

## Dual-track rule — both surfaces for every item

Regardless of adapter, **every open item exists on both
surfaces** when the adopter chose adapter (1) or (2):

1. **Opening**: create the active-workflow item (GH Issue /
   Jira ticket) AND add or update the matching in-repo
   markdown row. Each references the other by URL / ID.
2. **Closing**: land the fix in a commit, update the markdown
   row (mark done / move to history section / strike through
   with reason), close the active-workflow item citing the
   commit SHA.

For adapter (3) git-native, the markdown row is the only
surface, so the rule collapses to "keep the markdown row
honest."

The commit that lands the fix IS the durable record. The
active-workflow close is ephemeral — the commit + markdown
row is what survives for research.

## Label / tag taxonomy (adapter-neutral)

Keep the set small. Add by ADR, not ad-hoc.

| Tag | Meaning |
|---|---|
| `bug` | Correctness / spec / invariant break |
| `backlog` | Any non-bug work unit |
| `human-ask` | Needs the project maintainer's sign-off |
| `hygiene` | `docs/FACTORY-HYGIENE.md` row work |
| `research` | Produces `docs/research/<slug>.md` |
| `skill` | Touches `.claude/skills/**` (or equivalent in other harnesses) |
| `P0` / `P1` / `P2` / `P3` | Priority tier |
| `S` / `M` / `L` | Effort estimate |
| `in-progress` | Currently claimed |
| `blocked` | Waiting on an external signal (add a comment naming the signal) |
| `factory-internal` | Scope limited to the factory; does not ship to project-under-construction |
| `shipped-scope` | Visible to adopters of any Zeta library |

Label sprawl is a hygiene gap. Before adding a new label,
ask: can this be a comment or a column in the markdown row?

## Zeta-specific: GitHub Issues configuration

This section applies only to the Zeta repo; adopters using
Jira or git-native can skip it.

- **Enabled 2026-04-22** by Aaron. Issues feature on, generic
  templates replaced with Zeta-specific ones under
  `.github/ISSUE_TEMPLATE/`.
- **Templates**:
  - `.github/ISSUE_TEMPLATE/bug_report.md` — correctness failures
  - `.github/ISSUE_TEMPLATE/backlog_item.md` — work units with
    category / priority / effort / acceptance criteria
  - `.github/ISSUE_TEMPLATE/human_ask.md` — decisions for Aaron
  - `.github/ISSUE_TEMPLATE/config.yml` — blank issues off,
    contact links to AGENTS.md / BACKLOG.md / BUGS.md /
    WONT-DO.md / this doc
- **Milestones ≈ rounds**: each round (round-42, round-43, ...)
  is a GitHub milestone. Assigning signals intent to close in
  that round; missed milestone → reschedule + note in the
  markdown row.
- **No bulk migration**: existing `docs/BACKLOG.md` rows are
  **not** migrated wholesale to GH Issues. Migration happens
  opportunistically on-touch — an agent picking up an existing
  row mirrors it into a GH Issue at that time.
- **Auth**: agents use `gh` CLI (already authenticated with
  `repo` scope on the build machine) or the `github` plugin's
  MCP (`GITHUB_PERSONAL_ACCESS_TOKEN`).

## What this workflow does NOT do

- Does **not** force GitHub Issues on adopters. The factory
  supports three adapters and adopters choose at setup.
- Does **not** migrate existing in-repo rows to an external
  tracker wholesale. Migration is on-touch only.
- Does **not** replace the in-repo durable markdown. The
  research-substrate requirement is absolute; only the
  active-workflow layer is adopter-configurable.
- Does **not** generate issues / tickets automatically from
  commits, PR reviews, or harsh-critic output. That is
  candidate future work — file an item rather than doing it
  silently.
- Does **not** enforce the claim protocol at the git level;
  it is discipline, not a pre-commit hook. If collisions
  become a pattern, a hook lands via ADR.

## References

- [`AGENT-CLAIM-PROTOCOL.md`](AGENT-CLAIM-PROTOCOL.md) —
  the standalone, linkable git-native claim specification
  (hand this URL to external agents along with the task)
- `AGENTS.md` — universal onboarding
- `CLAUDE.md` — Claude Code harness rules
- `docs/BACKLOG.md` — durable research backlog (always required)
- `docs/BUGS.md` — durable bug ledger (always required)
- `docs/HUMAN-BACKLOG.md` — items awaiting the project
  maintainer (always required)
- `docs/FACTORY-HYGIENE.md` — hygiene row catalogue
- `docs/DEBT.md` — accidental / unintentional tech-debt ledger
- `docs/INTENTIONAL-DEBT.md` — declared-shortcut ledger
  (per GOVERNANCE.md §11, the round-close read)
- `.github/ISSUE_TEMPLATE/` — Zeta-specific GH Issue
  templates (adapter (1) only)
- `tools/setup/` — where the setup-time adapter prompt will
  land once the BACKLOG row for it is scheduled
