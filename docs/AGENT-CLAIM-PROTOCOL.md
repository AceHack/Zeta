# Agent Claim Protocol — git-native, platform-optional

**If you've been handed this URL with a task, read the
[TL;DR: five steps](#tldr-five-steps) first. The rest of the doc explains
the details, but the five steps are enough to start.**

This protocol lets any AI agent (ChatGPT / Codex / Deep
Research / Claude Code / Gemini / Aider / Cursor) or human
contributor pick up a PR task on the Zeta repository without
prior context on the factory. If you have a git clone, you
have everything you need. Optional adapters mirror the
protocol onto GitHub Issues / Jira / Linear without changing
its semantics.

This doc is the **standalone, linkable** companion to
[`AGENT-ISSUE-WORKFLOW.md`](AGENT-ISSUE-WORKFLOW.md). That
doc explains the *dual-track principle* and platform
adapters; this doc specifies the *git-native claim
mechanism* that every adapter is built on.

## Hand-off template — paste this with the task

If you're a maintainer handing a task to an external agent
(ChatGPT, Codex, Deep Research, a team member on another
harness), this is the prompt body. Fill the two placeholders
and paste it along with any issue / task link:

> You have a PR task on the Zeta repository at
> `https://github.com/Lucent-Financial-Group/Zeta`.
>
> 1. Read the claim protocol:
>    `https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/AGENT-CLAIM-PROTOCOL.md`
> 2. The task is: **\<task description or issue URL>**
> 3. Follow the TL;DR. Use the **\<Deep Research | Codex
>    sandbox | direct-commit | report-back>** mode section
>    that matches how you work.
> 4. Respect the "Scope discipline" and "What this protocol
>    does NOT do" sections.
> 5. If you can push and open a PR, do so on
>    `Lucent-Financial-Group/Zeta` when you're done and
>    release your claim in the same PR. If your substrate
>    cannot push (read-only Deep Research, no-connector
>    chat), use the **report-back / write-via-maintainer**
>    mode and return the artifact for the maintainer to
>    commit on your behalf.

One URL + one task + one mode-name is the full briefing. The
agent follows the protocol URL and picks up everything else
from there.

## TL;DR: five steps

### 1. Clone and pull

```
git clone https://github.com/Lucent-Financial-Group/Zeta.git
cd Zeta
git pull --ff-only origin main
```

### 2. Check for an existing claim on the work you want

Claim files live on pushed `claim/<slug>` branches (see
step 3) — they may not yet be merged to `main`. To see
*all* live claims, refresh remote refs and list both the
working tree (claims that have already merged or are
still tracked on `main`) and remote claim branches:

```
git fetch origin                                              # refresh remote refs
ls docs/claims/                                               # claims visible on the
                                                              # current checkout (the
                                                              # directory is tracked;
                                                              # README.md is the
                                                              # non-empty placeholder)
git branch -r --list 'origin/claim/*'                         # remote claim branches —
                                                              # active claims pushed
                                                              # but not yet merged
git show origin/claim/<slug>:docs/claims/<slug>.md            # details of a specific
                                                              # remote claim
cat docs/claims/<slug>.md                                     # details of a claim that
                                                              # is already on this
                                                              # branch
```

If `docs/claims/` is somehow missing on a fresh clone (it
shouldn't be — the directory ships tracked with a
`README.md`), recreate it with `mkdir -p docs/claims`
before filing your claim.

A live claim with `claimed-at` within the last 24 hours is
**active** — pick different work or wait. A claim older than
24 hours without a progress signal is **stale** and may be
force-released (see [Stale claims](#stale-claims-and-force-release)).

### 3. File your claim

Create `docs/claims/<slug>.md` using the
[claim file template](#claim-file-shape), then commit it:

```
git checkout -b claim/<slug>                            # or your working branch
# write docs/claims/<slug>.md
git add docs/claims/<slug>.md
git commit -m "claim: <slug> - <one-line scope>"
git push -u origin claim/<slug>
```

### 4. Do the work

Commit as you normally would on `claim/<slug>` (or the
branch you're using). If the work is expected to run longer
than four hours, add an occasional *progress commit*
touching the claim file so parallel agents see the claim is
still live:

```
# edit docs/claims/<slug>.md (update ETA or append a Note)
git commit -am "progress: <slug> - <short signal>"
git push
```

### 5. Release

When you open a PR (or land the work directly), **delete the
claim file in the same PR**:

```
git rm docs/claims/<slug>.md
git commit -m "release: <slug> - landed in <PR #N / SHA>"
```

If the work is abandoned, release with a reason instead:
`release: <slug> - abandoned, reason: <...>`. The BACKLOG
row / issue stays open for another agent.

That is the whole protocol. The remaining sections specify
the details (modes, slug rules, file shape, conflict
resolution, stale-claim handling, scope discipline,
platform adapters) that make it robust under parallel
agents.

## Modes — pick the one that matches how you work

Different harnesses have different execution shapes. Use the
mode section that matches yours.

### Deep Research mode (read-only)

If you are running in **Deep Research** mode (ChatGPT Deep
Research, Claude research mode, any read-only absorption
task), **you do not need to claim anything**. You are not
writing to the repo. Skip the claim steps and focus on the
reading.

If your Deep Research run produces a report that the user
wants to land in the repo, *that* is a separate PR task —
claim it when you move from reading to writing.

### Codex / sandbox mode (PR-write)

If you are running in **OpenAI Codex** or another sandbox
that clones, works, and opens a PR in one shot:

- **Push the claim commit early.** A claim that lives only
  on a sandbox-local feature branch is invisible to parallel
  agents looking up `docs/claims/` on `main`. Land the
  `claim: <slug> - <scope>` commit on a pushed branch
  *before* doing the work, so other agents see it via
  `git ls-remote origin claim/<slug>` and the GitHub branch
  list. (Pushing the claim does not require an open PR; a
  bare branch is enough.)
- The release commit lands on the same feature branch as
  part of the PR. One PR carries: claim + work + release.
- No intermediate progress commits are required (your run is
  short enough that the 24-hour window isn't in play).
- Open the PR against `Lucent-Financial-Group/Zeta` and wait
  for review. The release commit inside the PR is what
  retires the claim on merge.

If your sandbox truly cannot push to `origin` until PR-open
time, that is the **report-back / write-via-maintainer**
mode below — declare it explicitly so other agents know the
claim won't appear on `main` until the maintainer commits
the artifact.

### Direct-commit mode (trusted maintainer)

If you are a maintainer landing work directly on `main`
(not via PR):

- Claim commit first, pushed to `main`.
- Work commits.
- Release commit last, pushed to `main`, referencing the
  landing SHA.

Direct-commit is unusual and reserved for maintainers with
push access. Default to the PR path unless you know you
have direct-commit authority.

### Review / advisory mode (no claim required)

If you are reviewing an existing claim or advising on a
design (Gemini offering pair-programming feedback, a
reviewer commenting on an open PR, a human giving
architectural advice), **no claim file is needed**. Review
is additive work that attaches to someone else's claim:

- Leave comments on the PR / claim file / issue.
- Open a separate advisory issue if the suggestion is big
  enough to warrant its own BACKLOG row.
- Do not file a claim unless you are about to *write* code
  or docs.

Review and advisory output is valuable even when the
substrate cannot push code — see the next mode.

### Report-back / write-via-maintainer mode (no claim required)

If your substrate cannot push to git directly (a ChatGPT
conversation without Codex, a Deep Research run that can
only read, a human AI without connector write access),
**produce an output artifact instead of claiming**:

- Write the result as a markdown file, a patch, a table, a
  checklist, or whatever shape the task requires.
- Send it back to the maintainer in the conversation.
- The maintainer commits the artifact on your behalf.
- Attribution in the commit message names your substrate
  (e.g. `... contributed by chatgpt-deep-research per
  <conversation-url>`).

This mode is **first-class**. The factory has observed
external-AI Deep Research archive reports and external-AI
architectural reviews arriving in exactly this shape, and
both produced load-bearing output. The protocol welcomes
the pattern: honest substrate-limits plus substantive
output plus maintainer commits equals a valid contribution.
You are not expected to solve a write-access problem that
your substrate cannot solve.

## Claim file shape

A claim file lives at `docs/claims/<slug>.md`. The shape is
intentionally minimal so the protocol is easy to follow
across harnesses. **Copy-paste this template:**

```markdown
# Claim - <slug>

- **Session ID:** <opaque session ID; do not use direct agent or human handles>
- **Harness:** <claude-code | codex | chatgpt | gemini | aider | cursor | human>
- **Claimed at:** <UTC ISO 8601, e.g. 2026-04-22T19:30:00Z>
- **ETA:** <when progress-signal or release is expected>
- **Scope:** <one-line statement of what this claim covers>
- **Durable target:** <path / row / PR where the work will land>
- **Platform mirror:** <optional URL to GH Issue / Jira / Linear ticket>

## Notes

<optional free-form section - dependencies, blockers,
cross-references to prior work>
```

**Session ID is opaque.** The repo rule "no name
attribution in code, docs, or skills" (see
[`docs/AGENT-BEST-PRACTICES.md`](AGENT-BEST-PRACTICES.md))
applies to claim files because they live in `docs/` and
their commits become permanent git history. Use an opaque
session ID (a short hash, a UUID, a date-stamp + harness
tag) plus the harness type. Contact handles, real names,
and direct agent identities stay out of the claim file —
route them out-of-band through the platform mirror or the
PR thread when contact is needed.

### Slug rules

A slug is a short, kebab-case identifier that uniquely names
the claim:

- **`backlog-<N>`** — claim on a numbered row in
  `docs/BACKLOG.md` (e.g. `backlog-42`). Preferred when the
  work unit already has a durable row.
- **`bug-<N>`** — claim on a numbered row in `docs/BUGS.md`.
- **`issue-<N>`** — claim on a GitHub / Jira / Linear issue
  by its external ID (e.g. `issue-107`). Use the platform
  ID verbatim so the claim file and the platform issue share
  a name.
- **`task-<kebab-slug>`** — free-form claim not tied to a
  numbered row. Use sparingly; prefer filing a BACKLOG row
  first so the work has a durable anchor.

Slugs are globally unique within `docs/claims/`. If work is
already in flight under one slug, don't create a sibling
slug for the same scope — join the existing claim by
commenting in the claim file, or coordinate via the platform
mirror if one exists.

### Session identity

`Session ID` is an opaque short string that lets parallel
agents tell claims apart without putting direct agent or
human names into git history. Suggested formats (all
omit usernames and direct identities):

- `claude-code/<short-date-hash>` — Claude Code.
- `codex/<short-date-hash>` — OpenAI Codex.
- `chatgpt-deep-research/<short-date-hash>` — ChatGPT Deep
  Research (write-mode only; read-mode skips the claim).
- `gemini-cli/<short-date-hash>` — Gemini CLI.
- `human/<short-date-hash>` — human contributor.

Be honest about which harness is holding the claim — the
honesty makes cross-harness audits (and the factory's
alignment research) possible. If a parallel agent needs to
*contact* the claim-holder, use the platform mirror (GitHub
Issue, Jira ticket) or the PR thread; those surfaces accept
real handles without polluting git history.

## Lifecycle — claim, progress, release

The lifecycle has three operations, each realised as a
commit:

| Operation | Commit message | File change |
|---|---|---|
| **Claim** | `claim: <slug> - <scope>` | Add `docs/claims/<slug>.md` |
| **Progress** | `progress: <slug> - <signal>` | Touch `docs/claims/<slug>.md` (update ETA or append to Notes) |
| **Release** | `release: <slug> - landed in <SHA>` or `release: <slug> - abandoned, reason: <...>` | Delete `docs/claims/<slug>.md` |

Commit messages follow the `verb: <slug> - <detail>` pattern
so parallel agents can filter the log:

```
git log --grep="^claim: \|^progress: \|^release: " --oneline
```

### Claim commit details

Before committing, refresh remote refs and check whether
`origin` already has a `claim/<slug>` branch (or a claim
file on `main`) for your target slug:

```
git fetch origin
git ls-remote --heads origin "claim/<slug>"
git show "origin/main:docs/claims/<slug>.md" 2>/dev/null
```

If either lookup returns a hit, pick a different slug or
coordinate with the existing claim — `main`-side claims
are merged-but-not-released claims; `claim/<slug>`-branch
hits are active claims still in flight.

The claim commit **must** land on a branch named
`claim/<slug>` so the slug-uniqueness lock works. Pushing
the claim file on an arbitrary branch name (`feat/<thing>`,
a speculative branch, etc.) does not reserve the slug:
`git push` only updates the refspec you push, so two
agents can each push `docs/claims/<slug>.md` on different
remote branches and neither push fails. Use
`claim/<slug>` so the second pusher gets a non-fast-forward
rejection and discovers the existing claim. After the
claim lands, work commits can move to a separate working
branch (`feat/<thing>`); the `claim/<slug>` branch stays
as the lock until release.

### Progress signal details

Progress signals become important when the expected ETA
crosses the 24-hour active-claim window. A progress commit
touches the claim file in any way — update `ETA`, append to
Notes, add a cross-reference — and resets the 24-hour
stale-claim clock.

Progress commits need not land on `main`; pushing to the
branch that carries the claim file is enough, as long as
the branch is visible on the remote:

```
git ls-remote origin | grep claim/<slug>
```

### Release commit details

The release commit records the disposition:

- `release: <slug> - landed in <SHA>` — work completed;
  cite the landing commit's SHA.
- `release: <slug> - merged as PR #<N>` — work completed
  via PR; the PR merge SHA is a good citation.
- `release: <slug> - abandoned, reason: <...>` — work not
  completed; the BACKLOG row / issue stays open.

The release commit is part of the same PR that lands the
work (recommended — keeps claim lifecycle tied to the
work's landing) or a follow-up commit after merge.

## Conflict resolution — merge conflicts are the coordination signal

If two agents try to claim the same slug simultaneously, git
enforces coordination for us:

1. Agent A writes `docs/claims/backlog-42.md` and pushes.
   Push succeeds — A holds the claim.
2. Agent B, from an older checkout, writes
   `docs/claims/backlog-42.md` and pushes. Push fails
   (non-fast-forward).
3. Agent B pulls — merge conflict on
   `docs/claims/backlog-42.md`.
4. Agent B resolves by **accepting A's version** (A pushed
   first; A holds the claim) and picks different work. B's
   local claim file is discarded.

If both agents genuinely want to collaborate on the same
work, they add each other as sessions in a single claim
file (use opaque session IDs, not direct agent or human
handles, per the `Session ID` template field):

```markdown
- **Sessions:** sess_7f3a9c2d, sess_b84e1a6f (co-claim 2026-04-22T19:30:00Z)
```

## Stale claims and force-release

A claim is **active** for 24 hours from its most recent
commit (claim, progress, or any commit touching
`docs/claims/<slug>.md`). After 24 hours of no activity,
the claim is **stale**.

To force-release a stale claim:

1. Verify the claim is genuinely stale:
   ```
   git log -1 --format=%ci -- docs/claims/<slug>.md
   ```
   The timestamp must be more than 24 hours before `now`.
2. Delete the claim file with a citation:
   ```
   git rm docs/claims/<slug>.md
   git commit -m "force-release: <slug> - stale since <timestamp from step 1>"
   ```
3. Push and take the work.

**Do not** force-release inside the 24-hour window. If you
believe a claim is stuck but within the window, add a
`progress` commit with a `blocked` marker or leave a Note
asking the claim-holder to check in.

The 24-hour window is tunable per adopter; overrides land
in `AGENT-ISSUE-WORKFLOW.md` or an ADR under
`docs/DECISIONS/`.

## Scope discipline — what you claim, what you don't

This section exists because external agents (especially
ChatGPT / Deep Research / Codex) often arrive with helpful
instincts that exceed the claim's scope. The protocol is
narrow on purpose:

**Claim the work, not the repo.** A claim covers the
specific task (a BACKLOG row, a bug fix, a feature). It does
not authorise sweeping refactors, broad renames, or
unrelated cleanups encountered along the way. If you notice
something else that needs fixing, file a new BACKLOG row
rather than bundling it into the claim.

**Claim code, not identity.** The factory has personas
(named reviewer roles) and agent notebooks under
`memory/persona/`. Some of that material is committed to
git (the `memory/` tree is tracked; see `memory/MEMORY.md`
and `memory/persona/README.md` for what lives where), and
some is harness-local. External agents arriving via this
protocol claim code and docs on the public repo surface
only. Do not invent persona-names, do not claim identity
surfaces, and do not modify anything under `memory/`
unless your hand-off explicitly scoped you to a memory
file — the persona layer is curated by the factory's
internal agents, not external claim-holders.

**Claim facts, not framings.** If your work touches
`docs/ALIGNMENT.md`, `GOVERNANCE.md`, or a research report,
claim the *factual change* you are making (fix a typo, add
a row, clarify a definition). Do not use the claim as an
entry point for renegotiating the factory's values,
philosophy, or register — those go through the renegotiation
protocol in `docs/ALIGNMENT.md`.

**Claim the scope the maintainer asked for.** If the
hand-off template said "fix typo in X", do not expand to
"fix typo in X and also add a test and also refactor the
module." Narrow scope makes review possible; scope creep
makes PRs un-mergeable.

## Platform adapters — additive, not required

If the adopter has chosen GitHub Issues / Jira / Linear as
the active-workflow surface, the git-native claim file
remains the durable record; the platform mirror is an
ephemeral overlay that gains richer UX (labels,
notifications, dashboards) without changing the protocol.

| Adapter | Mirror on claim | Mirror on release |
|---|---|---|
| **GitHub Issues** | Comment on the issue: `claimed by <session> <UTC-ts> - see docs/claims/<slug>.md`; add `in-progress` label | Comment `released - landed in <SHA>`; remove `in-progress` label; close issue if work done |
| **Jira / Linear** | Transition to `In Progress`; assign to self; add comment linking `docs/claims/<slug>.md` | Transition to `Done` / `Released`; comment with commit SHA |
| **Git-native only** | (no mirror) | (no mirror) |

The platform comment and the claim file are created
together, but the claim file is authoritative if they
disagree — the file is in git, the comment is on the
platform. If the platform is down, the claim still exists.

## What this protocol does NOT do

- Does **not** replace the dual-track principle. Durable
  git-history (BACKLOG rows, BUGS entries, commit messages)
  is still the authoritative record of what happened. Claim
  files are the *coordination* surface, not the *history*
  surface.
- Does **not** enforce claims at the git level. No
  pre-commit hook blocks work without a claim file. The
  protocol is discipline, not gate. If collision rate
  becomes problematic, a hook lands via ADR.
- Does **not** require external platform access. GitHub
  Issues / Jira / Linear are optional adapters.
- Does **not** grant work authority. Holding a claim means
  "no other agent should duplicate this effort"; it does
  not mean "my PR will be merged." Review, alignment with
  the factory's direction, and the maintainer's sign-off
  all still apply.
- Does **not** expire automatically. Stale claims remain
  visible in `docs/claims/` until another agent
  force-releases them. The 24-hour window is the
  force-release *permission*, not an auto-cleanup.
- Does **not** track work progress in detail. Progress
  signals are coarse ("the claim is still alive"); for
  fine-grained progress use PR draft status, commit log,
  or BACKLOG row updates.
- Does **not** authorise modifying the factory's alignment
  contract, persona notebooks, or values surfaces. See
  "Scope discipline" above.
- Does **not** grant write access to repos you don't
  otherwise have write access to. If you are working from a
  fork, open the PR from the fork. If you have no write
  access anywhere, file a BACKLOG row or issue and stop.

## References

- [`AGENT-ISSUE-WORKFLOW.md`](AGENT-ISSUE-WORKFLOW.md) —
  dual-track principle + three platform adapters; this
  doc is the git-native substrate underneath it.
- [`AGENTS.md`](../AGENTS.md) — universal onboarding handbook
  (read for repo-wide rules, pre-v1 status, three
  load-bearing values).
- [`docs/BACKLOG.md`](BACKLOG.md) — durable backlog (always
  required regardless of adapter).
- [`docs/BUGS.md`](BUGS.md) — durable bug ledger.
- [`docs/HUMAN-BACKLOG.md`](HUMAN-BACKLOG.md) — items
  awaiting maintainer sign-off.
- [`docs/ALIGNMENT.md`](ALIGNMENT.md) — the alignment
  contract; the renegotiation protocol lives there for
  changes outside claim scope.
- [`GOVERNANCE.md`](../GOVERNANCE.md) — numbered repo-wide
  rules; §2 (docs-as-current-state) and §24 (install
  script) are most relevant to adopters configuring the
  workflow at setup.
