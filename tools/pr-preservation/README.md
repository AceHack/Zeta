# tools/pr-preservation/ — git-native PR conversation archive

Minimal implementation (Otto-207) of the PR-preservation
BACKLOG directive (Otto-150..154, PR #335). Fetches a PR's
review threads, reviews, and general comments via
`gh api graphql` and writes them to
`docs/pr-discussions/PR-<NNNN>-<slug>.md` for durable
audit-trail storage outside of GitHub.

## Scope of this Phase-0 / minimal tool

- **In scope:** one-shot local script; operator runs it
  manually against a PR number; output is a single
  markdown file with YAML frontmatter + sectioned
  content (reviews / threads / comments).
- **Out of scope:** GHA workflow (automatic on every
  merge); historical backfill of all PRs ever; edit-
  after-archive reconciliation; redaction layer for
  privacy-sensitive comments.

The out-of-scope items are tracked in the PR-preservation
BACKLOG row (originally PR #335 Otto-150..154; updated
this tick with Phase-0-shipped state + remaining phases).

## Usage

```bash
tools/pr-preservation/archive-pr.sh <PR-number>
```

Writes `docs/pr-discussions/PR-<NNNN>-<slug>.md` — the PR
number is zero-padded to four digits (e.g. `PR-0357-...`)
so archives sort lexicographically in the same order as
they sort numerically up to PR #9999. Re-running
overwrites the file with current PR state.

The archive tool paginates all three connections
(`reviewThreads`, `reviews`, `comments`) plus per-thread
comments, so PRs with more than 100 threads or threads
with more than 100 comments are captured in full rather
than silently truncated.

## Output schema

Each archive file has YAML frontmatter:

```yaml
pr_number: 354
title: "..."
author: <github-login>
state: OPEN | MERGED | CLOSED
created_at: ISO-8601
merged_at: ISO-8601 (if merged)
closed_at: ISO-8601 (if closed)
head_ref: <branch-name>
base_ref: main
archived_at: ISO-8601 (when this archive was written)
archive_tool: tools/pr-preservation/archive-pr.sh
```

Followed by markdown sections:

- `## PR description` — original PR body
- `## Reviews` — top-level approvals / requests-changes /
  comment-reviews per author
- `## Review threads` — inline code-comment threads with
  resolved/unresolved status + full comment chain
- `## General comments` — non-review PR comments

## Backfill status (Otto-207)

Backfilled 10 PRs from this session:

- PR #354 (backlog-split Phase 1a)
- PR #352 (Server Meshing + SpacetimeDB research row)
- PR #336 (KSK naming definition doc)
- PR #342 (calibration-harness Stage-2 design) — merged
- PR #344 (Amara 19th ferry absorb) — merged
- PR #346 (DST compliance criteria) — merged
- PR #350 (Frontier rename pass-2) — merged
- PR #353 (BACKLOG split Phase 0 design) — merged
- PR #355 (Codex first peer-agent deep-review absorb) —
  merged
- PR #356 (PR-resolve-loop skill row) — merged

Future backfill waves lift this list to "all merged PRs
through <date>" then progressively older.

## Long-term plan

Tracked on the PR-preservation BACKLOG row. Phases:

- **Phase 0 (this tool):** shipped. Operator-run one-shot.
- **Phase 1 — GHA workflow on merge:** automatic archive
  on every PR merge. Deferred pending maintainer sign-off
  on privacy/redaction policy.
- **Phase 2 — historical backfill:** walk all merged PRs
  chronologically and archive; land as a series of batch
  PRs to keep each archive-PR reviewable.
- **Phase 3 — reconciliation:** when a thread is edited
  after archive, detect drift and re-archive; GHA cron
  weekly.
- **Phase 4 — redaction layer:** agent-review comments
  (Copilot, Codex, Claude Code personas, github-actions)
  archive verbatim; human-reviewer comments get a
  privacy-pass step. Scope open. Terminology per
  `GOVERNANCE.md` §3 ("Contributors are agents, not
  bots") — Copilot and Codex are agents with agency
  and accountability, not bots. `CLAUDE.md` carries
  a session-bootstrap pointer at the same rule.

## Dependencies

- `gh` CLI authenticated
- `python3` (stdlib only)
- `bash`, POSIX `mktemp` (the script uses no bash-4-only
  features; macOS default `bash` 3.2 is fine)

No external Python packages; no `yq` required.

## Cross-references

- PR-preservation BACKLOG row (PR #335, Otto-150..154) —
  the phased plan this tool begins to execute.
- Otto-171 queue-saturation memory — adjacent discipline
  (active PR management).
- Otto-204 PR-resolve-loop BACKLOG row (PR #356 merged) —
  this archive tool is step 4 of that skill's 6-step
  cycle.
- Otto-204c livelock-diagnosis memory — the failure mode
  that made this preservation gap visible.
