# GitHub Actions workflow injection — safe patterns

**Purpose:** keep every `.github/workflows/*.yml` file in this
repo secure-by-default against workflow-injection attacks, so
new workflow authors (human or agent) don't have to rediscover
the pattern every time. This doc is the **pre-write checklist**
and the authoritative reference for reviewer gates on CI YAML.

**Primary source:** GitHub Security Lab, *How to catch GitHub
Actions workflow injections before attackers do*
(<https://github.blog/security/vulnerability-research/how-to-catch-github-actions-workflow-injections-before-attackers-do/>).
Audit against the blog's current revision on the same cadence as
the rest of the harness-surface audit (FACTORY-HYGIENE #38).

## Threat model in one sentence

Any `${{ ... }}` expression expanded directly into a `run:` shell
script can execute attacker-controlled strings if the value
originates from an untrusted context (PR title, issue body, branch
name, commit message, …). The expression is expanded as raw text
*before* the shell runs, so embedded backticks / `$( )` /
newlines-plus-command are evaluated as shell even if the field
looks like plain data.

## The one rule you cannot break

> **Never inline `${{ ... }}` for attacker-controllable data
> inside a `run:` block. Bind it to an `env:` entry and read the
> resulting shell variable (`"$VAR"`, always quoted) instead.**

This is the only rule that is load-bearing for injection
prevention. Everything else on this page is defence in depth.

## Untrusted context — treat as attacker-controlled

| Context | Notes |
|---|---|
| `github.event.issue.title` / `.body` | Comes from any GitHub user. |
| `github.event.pull_request.title` / `.body` | Comes from the PR author (often a forker). |
| `github.event.pull_request.head_ref`, `github.head_ref` | Branch name on the PR's head. Forks control it. |
| `github.event.pull_request.base_ref` | Less risky but still user-influenced via PR retargeting. |
| `github.event.head_commit.message` | Commit message. Author-controlled. |
| `github.event.commits[*].message` | Same, for push events. |
| `github.event.comment.body` | Issue / PR / review comments. |
| `github.event.review.body` | PR review body. |
| `github.event.pull_request.head.label`, `.repo.html_url` | Fork-controlled strings. |
| `github.event.workflow_run.head_branch` | Cross-workflow triggers inherit the same risk. |
| Tag names (`github.ref` on `push` tag events) | Tag authors may be external. |
| `workflow_dispatch` / `workflow_call` inputs | Trusted only if the caller is trusted *and* inputs are typed+validated. |

Anything reaching a `run:` from these contexts without the
env-block buffer is an injection sink.

## Trusted context — safe to inline

- `github.workflow`, `github.run_id`, `github.run_number`
- `github.repository`, `github.repository_owner`
- `github.sha`, `github.ref` (for branch refs on push-to-branch),
  `github.event.pull_request.number`
- `github.event.pull_request.base.sha`,
  `github.event.pull_request.head.sha` (SHAs are 40-hex, injection-proof)
- `runner.*`, `matrix.*`, `hashFiles(...)`, `env.*` (when `env` was
  set from a trusted literal), `secrets.*`

"Trusted" here means GitHub sets the value, not a user.

## Pre-write checklist

Before committing any new workflow or editing an existing one, walk
this list. Every item is reviewer-visible; CI enforcement catches
most but not all.

- [ ] **Trigger choice.** `pull_request` (default) grants no secrets
      and write-permissions to fork PRs. `pull_request_target` runs
      with repo-owner secrets on forked PRs — use **only** when
      genuinely required and with extra scrutiny of every
      interpolation.
- [ ] **Permissions minimized.** Workflow-level `permissions:
      contents: read`. Per-job elevations only where needed
      (`pull-requests: write` for comment posters,
      `security-events: write` for SARIF uploaders, …). No
      `write-all`.
- [ ] **Env-block buffer for every untrusted value.** Any
      `github.event.*` value read in a `run:` step appears only as
      an `env:` entry on that step, then as `"$VAR"` in the shell.
      Never `${{ github.event.* }}` inline.
- [ ] **Actions SHA-pinned.** Every `uses:` pins a full 40-char
      commit SHA with a trailing `# vX.Y.Z` comment for humans.
      Mutable tags (`@main`, `@v1`, `@latest`) are forbidden — they
      are a supply-chain vector.
- [ ] **Runners pinned.** `ubuntu-22.04` / `macos-14` — never
      `-latest`.
- [ ] **Concurrency group.** Declared at workflow level;
      `cancel-in-progress: true` for PR events (never for main
      pushes — every main commit deserves a record).
- [ ] **Timeout set.** Every job declares a `timeout-minutes`. A
      stuck job is a cost and availability risk.
- [ ] **Header comment block.** Starts with a one-paragraph purpose
      + a `SECURITY NOTE` section enumerating *which* contexts the
      workflow reads and *where* they are consumed. This is the
      reviewer's first stop.
- [ ] **No secrets in `run:` strings.** `secrets.*` is fine in
      `env:` blocks; never interpolated into a shell command.
- [ ] **Linters will catch the rest.** Do not rely on that — author
      correctly, then let lint confirm.

## Factory tooling that enforces this

Three layers; each covers a different failure mode. None catches
everything — **the pre-write checklist is the primary defence**;
the linters are the safety net.

1. **`actionlint`** (`lint-workflows` job in `gate.yml`). Fires on
   every PR. Catches unknown context refs, invalid runner labels,
   shellcheck-style issues on `run:` blocks, and several well-known
   injection patterns (e.g. `${{ github.head_ref }}` inside `run:`).
   Hard-fails the build. Highest-signal layer for most authoring
   mistakes.
2. **CodeQL `actions` language** (`codeql.yml` matrix includes
   `language: actions`, build-mode `none`). GitHub's late-2024
   taint-tracking query for workflow injection runs here. Runs on
   PRs-to-main and on a weekly schedule — **not every push to
   feature branches**. Findings surface under Security → Code
   scanning; triaged per GOVERNANCE.md §22. The most semantically
   precise of the three, but also the slowest feedback loop.
3. **Semgrep** (`lint (semgrep)` job). Fires on every PR via
   `.semgrep.yml`. Two GitHub-Actions rules:
     - `gha-action-mutable-tag` — catches `uses: foo@v1` / `@main`
       instead of a 40-char SHA (supply-chain vector).
     - `gha-untrusted-in-run-line` — catches single-line
       `run: ... ${{ github.<unsafe-path> }} ...` forms for the
       attacker-controlled context list enumerated above (PR
       titles, issue bodies, branch refs, commit messages, etc.).
       Runs ahead of CodeQL, so injection is caught at PR time even
       when CodeQL is on its weekly cadence. Multi-line `run: |`
       blocks are left to actionlint's YAML-aware parser.

If all three pass, the workflow is compliant with the
author-checkable slice of this document — the env-block buffer and
permission-minimization items remain on the author and reviewer.
When any fail, **fix the code, never the lint**.

## Do / don't — minimal pair

### Unsafe

```yaml
- name: Log PR title
  run: echo "Processing PR ${{ github.event.pull_request.title }}"
```

A PR with title `` `rm -rf ~` `` executes the embedded command.

### Safe

```yaml
- name: Log PR title
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: |
    echo "Processing PR $PR_TITLE"
```

The expansion now happens inside the shell, which treats
`$PR_TITLE` as a plain string. Always quote the variable (`"$PR_TITLE"`)
in non-trivial uses.

## Why this doc exists in-repo, not just as a link

- **Offline readable** by every agent and reviewer, including ones
  without web-fetch.
- **Factory-specific cross-refs** — points at our actual lint jobs,
  our actual CodeQL config, our actual SHA-pinning convention. The
  blog is generic; this is ours.
- **Cadenced audit target** — FACTORY-HYGIENE row 40 cadences a
  re-read against the blog's current revision so drift is caught.
- **Reviewer citation** — a CI YAML review can reject with "violates
  §Pre-write checklist item N" rather than handwaving.

## Related

- `docs/security/SUPPLY-CHAIN-SAFE-PATTERNS.md` — sibling
  checklist for the third-party-ingress class. The SHA-pinning
  rule for `uses:` pins appears in both docs; the supply-chain
  doc is the authoritative reference when a pin is being **added
  or bumped** (evaluating the dependency itself), while this doc
  is authoritative when a workflow is being **authored or edited**
  (evaluating the shell commands inside).
- `docs/security/INCIDENT-PLAYBOOK.md` Playbook A — the reactive
  counterpart when a third-party action we pinned is discovered
  to have been compromised.

## Scope

Factory-wide. Applies to every workflow in `.github/workflows/`,
including future workflows for factory-reuse projects that inherit
this CI shape. Inherits automatically via the factory CI discipline
(`docs/research/ci-workflow-design.md`, FACTORY-HYGIENE row 40).
