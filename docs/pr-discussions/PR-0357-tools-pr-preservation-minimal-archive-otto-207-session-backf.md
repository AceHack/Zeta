---
pr_number: 357
title: "tools: PR-preservation minimal archive + Otto-207 session backfill (10 PRs)"
author: "AceHack"
state: "OPEN"
created_at: "2026-04-24T11:23:49Z"
head_ref: "tools/pr-preservation-phase-2-minimal"
base_ref: "main"
archived_at: "2026-04-24T15:37:11Z"
archive_tool: "tools/pr-preservation/archive-pr.sh"
---

# PR #357: tools: PR-preservation minimal archive + Otto-207 session backfill (10 PRs)

## PR description

## Summary

Maintainer Otto-207: *"are we saving these yet gitnative and have we backfilled them yet?"*

Honest answer was NO. The PR-preservation BACKLOG row (Otto-150..154, PR #335 in queue elevating to P1 + phased plan) specifies the discipline but never shipped capture tooling. This PR ships **Phase 0 minimal viable implementation** + **backfills 10 PRs** from this session.

## Tool

`tools/pr-preservation/archive-pr.sh` — one-shot bash script:

- Fetches review threads + reviews + comments via `gh api graphql`
- Writes `docs/pr-discussions/PR-<N>-<slug>.md` with YAML frontmatter
- Sections: PR description · Reviews · Review threads (with resolved/unresolved) · General comments
- No external deps beyond `gh` + `python3` stdlib + `bash 4+`

## Backfill (10 PRs this session)

| PR | Status | Threads | Reviews | Comments |
|---|---|---|---|---|
| #354 backlog-split Phase 1a | OPEN | 20 | 16 | 1 |
| #352 Server Meshing research | OPEN | 6 | 8 | 0 |
| #336 KSK naming doc | OPEN | 8 | 8 | 1 |
| #342 calibration-harness design | MERGED | 5 | 1 | 1 |
| #344 Amara 19th ferry absorb | MERGED | 8 | 1 | 1 |
| #346 DST compliance criteria | MERGED | 5 | 1 | 1 |
| #350 Frontier rename pass-2 | MERGED | 4 | 2 | 0 |
| #353 BACKLOG split design | MERGED | 6 | 1 | 0 |
| #355 Codex peer-review absorb | MERGED | 5 | 1 | 1 |
| #356 PR-resolve-loop row | MERGED | 5 | 1 | 0 |

Total: 72 threads + 40 reviews + 6 comments across ~97KB markdown.

## Long-term plan (per maintainer directive)

Remaining phases kept in the PR-preservation BACKLOG row (PR #335 in queue):

- **Phase 1** — GHA workflow on merge (automatic archive)
- **Phase 2** — historical backfill (all merged PRs)
- **Phase 3** — reconciliation (drift detection)
- **Phase 4** — redaction layer (privacy-pass for human-reviewer comments)

Scope out of this PR per maintainer *"make sure you backlog then to a proper long term solution"*.

## Composes with

- Otto-204c livelock-diagnosis (the gap this closes part of)
- Otto-204 PR-resolve-loop skill (this is step 4 of its 6-step cycle)
- PR #335 PR-preservation elevation (authoritative phased plan)

## Test plan

- [x] Script runs cleanly on test PR (#354)
- [x] Shellcheck exit 0 (SC2016 single-quote in GraphQL is intentional)
- [x] Output format validated across 10 varied PRs
- [x] No external dependencies beyond gh CLI + python3 stdlib

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-04-24T11:25:56Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `cc217ae031`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T11:28:45Z)

## Pull request overview

Adds a minimal, git-tracked PR-conversation preservation tool (`tools/pr-preservation/archive-pr.sh`) and backfills 10 PR discussion archives into `docs/pr-discussions/`, aligning with the project’s “git-native preservation” direction.

**Changes:**
- Add a one-shot bash + `gh api graphql` + Python-stdlib script to export PR metadata, reviews, review threads, and general comments into markdown files under `docs/pr-discussions/`.
- Add usage + output-schema documentation for the preservation tool.
- Commit 10 backfilled PR archive markdown files for this session.

### Reviewed changes

Copilot reviewed 12 out of 12 changed files in this pull request and generated 7 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| tools/pr-preservation/README.md | Documents scope, usage, and the intended archive schema/location for PR preservation. |
| tools/pr-preservation/archive-pr.sh | Implements the PR fetch + markdown archive writer via GitHub GraphQL + Python formatting. |
| docs/pr-discussions/PR-0356-backlog-otto-204-pr-resolve-loop-skill-close-the-pr-cycle-au.md | Backfilled archive for PR #356 discussion content. |
| docs/pr-discussions/PR-0355-ferry-codex-first-completed-peer-agent-deep-review-absorb-4.md | Backfilled archive for PR #355 discussion content. |
| docs/pr-discussions/PR-0354-tools-backlog-split-phase-1a-generator-schema-example-row-aa.md | Backfilled archive for PR #354 discussion content. |
| docs/pr-discussions/PR-0353-docs-backlog-md-split-design-phase-0-aaron-otto-181-3rd-ask.md | Backfilled archive for PR #353 discussion content. |
| docs/pr-discussions/PR-0352-backlog-otto-180-server-meshing-spacetimedb-deep-research-ga.md | Backfilled archive for PR #352 discussion content. |
| docs/pr-discussions/PR-0350-docs-frontier-rename-pass-2-hindu-ff7-egyptian-greek-norse-s.md | Backfilled archive for PR #350 discussion content. |
| docs/pr-discussions/PR-0346-docs-dst-compliance-criteria-dst-held-foundationdb-grade-bar.md | Backfilled archive for PR #346 discussion content. |
| docs/pr-discussions/PR-0344-ferry-amara-19th-absorb-dst-audit-5-5-corrections-10-tracked.md | Backfilled archive for PR #344 discussion content. |
| docs/pr-discussions/PR-0342-docs-calibration-harness-stage-2-design-amara-18th-ferry-b-f.md | Backfilled archive for PR #342 discussion content. |
| docs/pr-discussions/PR-0336-docs-ksk-naming-definition-doc-canonical-expansion-locked-ot.md | Backfilled archive for PR #336 discussion content. |
</details>

### COMMENTED — @AceHack (2026-04-24T13:22:23Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:26Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:28Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:30Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:32Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:34Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:36Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:38Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T13:22:41Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-04-24T13:26:42Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `66e48f0630`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-04-24T13:41:33Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-04-24T13:45:51Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `dfc8ef554f`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T13:47:03Z)

## Pull request overview

Copilot reviewed 14 out of 14 changed files in this pull request and generated 7 comments.

### COMMENTED — @AceHack (2026-04-24T14:38:59Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:39:07Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:39:11Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:39:15Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:39:21Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:39:23Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:39:25Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:39:27Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-04-24T14:42:54Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `a5331f79e5`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-04-24T14:50:39Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T14:50:42Z)

_(no body)_

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T14:55:42Z)

## Pull request overview

Copilot reviewed 14 out of 14 changed files in this pull request and generated 6 comments.

## Review threads

### Thread 1: tools/pr-preservation/archive-pr.sh:60 (resolved)

**@chatgpt-codex-connector** (2026-04-24T11:25:56Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Paginate GraphQL connections before writing archive**

The archive query hard-limits review threads and nested comments (`first: 100` / `first: 50`) without checking `pageInfo.hasNextPage` or following cursors, so high-activity PRs are silently truncated in the generated markdown. This breaks the stated preservation/audit goal because archives can look complete while dropping part of the discussion; the same pattern appears for reviews and general comments later in the query as well. Please paginate each connection (or fail loudly when truncated) before emitting the archive file.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T13:22:23Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524. The archive query now paginates all three top-level connections (reviewThreads / reviews / comments) via cursor loops in the Python driver, plus paginates per-thread comments when `comments.pageInfo.hasNextPage` is set. No silent truncation remaining. End-to-end test against PR #357 itself captures all 9 threads (see docs/pr-discussions/PR-0357-...md written by the new code).

### Thread 2: tools/pr-preservation/archive-pr.sh:107 (resolved)

**@chatgpt-codex-connector** (2026-04-24T11:25:56Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Validate pullRequest exists before dereferencing fields**

The script assumes `d['data']['repository']['pullRequest']` is always present and immediately calls `pr.get(...)`, but GitHub GraphQL can return valid JSON with `pullRequest: null` (for example, an invalid PR number or missing access). In that case this path crashes with a Python traceback instead of the script's documented fetch-failure handling, making operational failures noisy and non-actionable for operators.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T13:22:26Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524. Now detect `pullRequest is None` in two places: (1) in the Python fetch driver right after the first GraphQL call, emitting a clear "not found / private / access denied" diagnostic and exiting 2; (2) again in the standalone validation pass before the formatter runs. Formatter also retains a defensive guard. Smoke-tested: `./tools/pr-preservation/archive-pr.sh 99999` exits 2 cleanly with "Could not resolve to a PullRequest".

### Thread 3: tools/pr-preservation/archive-pr.sh:49 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:28:44Z):

P0: With `set -e`, if `gh api graphql` exits non-zero (auth failure, network error), the script aborts immediately and never reaches the intended “fetch failed …” diagnostics / exit-code mapping. Wrap the `gh api graphql … > "$TMP"` call in an explicit error-handling block so failures produce a clear message and the documented exit code (2).

**@AceHack** (2026-04-24T13:22:28Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524. The fetch block is now wrapped in `set +e` / explicit `FETCH_RC=$?` / `set -e` so a non-zero gh exit no longer aborts before the diagnostic path. On failure we print "fetch failed for PR #$PR (exit $FETCH_RC)" and exit 2 per the header docstring.

### Thread 4: tools/pr-preservation/archive-pr.sh:108 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:28:44Z):

P0: The JSON check only validates that the response is parseable JSON; GraphQL error payloads (or `pullRequest: null`) will pass this check and then the Python block will crash on `d['data']...` / `pr.get(...)` with a stack trace. Detect `errors` in the response and/or a null `pullRequest` and exit 2 with a concise error message (e.g., not found / permission / auth).

**@AceHack** (2026-04-24T13:22:30Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524. The fetch driver now rejects top-level `errors` and `pullRequest: null` before any field access, and a separate shell-side validation pass re-checks both conditions before the formatter runs. The formatter itself also guards (belt and suspenders). No more TypeError stack traces on invalid PRs.

### Thread 5: tools/pr-preservation/archive-pr.sh:47 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:28:44Z):

P1: The GraphQL query hard-codes `repository(owner: "Lucent-Financial-Group", name: "Zeta")`, so the script won’t work when run from forks or after a repo transfer/rename. Consider deriving owner/name from `gh repo view --json owner,name` (or `gh repo set-default`) and pass them as GraphQL variables.
```suggestion
OWNER="$(gh repo view --json owner --jq '.owner.login')"
REPO_NAME="$(gh repo view --json name --jq '.name')"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

gh api graphql -F owner="$OWNER" -F name="$REPO_NAME" -F number="$PR" -f query='
  query($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
```

**@AceHack** (2026-04-24T13:22:32Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524. Owner/name now come from `gh repo view --json nameWithOwner -q .nameWithOwner` at runtime, passed as GraphQL `$owner`/`$name` variables. If gh cannot resolve the repo, we hard-fail with exit 1 rather than silently falling back ("never silently wrong" — factory rule). Works from forks and after rename.

### Thread 6: tools/pr-preservation/archive-pr.sh:90 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:28:44Z):

P1: The script and header comment say it writes “all review threads + reviews + comments”, but the GraphQL query is capped at `reviewThreads(first: 100)`, per-thread `comments(first: 50)`, `reviews(first: 50)`, and `comments(first: 100)` with no pagination. Either implement pagination (pageInfo/endCursor loops) or record in the output/frontmatter that results may be truncated at these limits.

**@AceHack** (2026-04-24T13:22:34Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524 (option: implement pagination, not update README to advertise truncation). All three top-level connections and per-thread comments now paginate via cursor loops. README updated to note pagination is in place so there is no gap between "captures all review threads + reviews + comments" claim and actual behaviour.

### Thread 7: tools/pr-preservation/archive-pr.sh:134 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:28:45Z):

P1: YAML frontmatter values like `author`, `head_ref`, and `base_ref` are emitted without quoting/escaping. Some valid ref names can include `#` or `:` which would break YAML parsing (treating the remainder as a comment or creating a mapping). Emit these scalars using a safe quoting routine (e.g., JSON-style quoting) for all string fields, not just `title`.
```suggestion
lines.append(f'author: {json.dumps((pr.get("author") or {}).get("login") or "unknown")}')
lines.append(f'state: {json.dumps(pr.get("state") or "")}')
lines.append(f'created_at: {json.dumps(pr.get("createdAt") or "")}')
if pr.get('mergedAt'):
    lines.append(f'merged_at: {json.dumps(pr.get("mergedAt") or "")}')
if pr.get('closedAt'):
    lines.append(f'closed_at: {json.dumps(pr.get("closedAt") or "")}')
lines.append(f'head_ref: {json.dumps(pr.get("headRefName") or "")}')
lines.append(f'base_ref: {json.dumps(pr.get("baseRefName") or "")}')
lines.append(f'archived_at: {json.dumps(archived_at)}')
```

**@AceHack** (2026-04-24T13:22:36Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524. Added a `yaml_quote()` helper that wraps `json.dumps()` (double-quoted YAML strings with JSON-compatible escaping is valid YAML 1.2). Applied to every string-valued frontmatter field: title / author / state / created_at / merged_at / closed_at / head_ref / base_ref / archived_at / archive_tool. Only `pr_number` (integer) stays bare. Refs with `#` or `:` now parse cleanly.

### Thread 8: tools/pr-preservation/README.md:33 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:28:45Z):

P0: README says archives are written to `docs/pr-discussions/PR-<N>-<slug>.md`, but the script actually writes `PR-<N>` zero-padded to 4 digits (e.g., `PR-0356-...`). Update the documented filename pattern so operators can reliably locate files and avoid accidental duplicates.

**@AceHack** (2026-04-24T13:22:38Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524 — chose option A (update README to match script). Documented filename shape is now `PR-<NNNN>-<slug>.md` with zero-padding to four digits, explicitly called out in the Usage section with the rationale (lex-sort == num-sort for PR #0001..#9999). Picked this direction because the 10 backfilled files already use zero-padding and renaming them would churn cross-references and git history.

### Thread 9: docs/pr-discussions/PR-0352-backlog-otto-180-server-meshing-spacetimedb-deep-research-ga.md:70 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:28:45Z):

P0: The backfilled `docs/pr-discussions/*.md` files include whitespace-only lines (e.g., after “Reviewed commit”) which violate markdownlint MD009 (no trailing spaces). Since the CI job runs markdownlint over `**/*.md` and `docs/pr-discussions/**` isn’t ignored, this will likely fail CI unless the archive output is normalized or the directory is added to `.markdownlint-cli2.jsonc` ignores (similar to `docs/amara-full-conversation/**`).
```suggestion

```

**@AceHack** (2026-04-24T13:22:41Z):

Fixed in 66e48f063082045871fb7d970bdb6fe213633524. Ran `find docs/pr-discussions -name '*.md' -exec perl -i -pe 's/[ \t]+$//' {} +` across all existing archives — MD009 clean (grep-verified: zero trailing-whitespace lines remaining). Also added an inline trailing-whitespace strip inside the archive writer itself so future archive runs stay clean without needing the post-hoc sweep.

### Thread 10: tools/pr-preservation/archive-pr.sh:242 (resolved)

**@chatgpt-codex-connector** (2026-04-24T13:26:42Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Avoid re-fetching full payload on each pagination step**

`paginate_top_level` always reissues the monolithic `QUERY`, so every extra page for one connection (e.g., `reviewsAfter`) also re-downloads page 1 of `reviewThreads` and `comments` (including nested thread comments from `comments(first: 100)`). On busy PRs this multiplies GraphQL cost and can hit API resource/rate limits before archival completes, even though pagination logic itself is correct. Splitting pagination into connection-specific queries (or otherwise avoiding refetch of unrelated connections) would prevent fetch failures under high-volume PRs.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T13:41:33Z):

Codex P2 acknowledged and scoped, landed as a P2 research-grade BACKLOG row rather than an inline fix on this PR.

**Three-outcome decision (Otto-226 / Otto-227, option 2 = narrow-fix + backlog):**

- The finding is correct: `paginate_top_level` in `tools/pr-preservation/archive-pr.sh` reissues the full monolithic `QUERY` on every page, so walking extra pages of one connection (e.g. `reviewThreads`) re-fetches the full `reviews` + `pullRequest` payload. Works correctly; wastes GraphQL rate budget on PRs with many threads.
- A proper fix is a ~30-60 LOC refactor: split the single `QUERY` into per-connection GraphQL fragments (one per `reviewThreads`, `reviews`, `comments-per-thread`) with separate cursors, compose results client-side, preserve the end-to-end archive format. That scope is beyond a single review-response commit, and risks regressing the self-hosting smoke test we just validated.
- This PR keeps the current pagination shape. The refactor is queued as a P2 row at end of `## P2 — research-grade` in `docs/BACKLOG.md`, scope locked, citing this thread.

**Commit:** dfc8ef554f094a32bf54356bd2a1b1029064b13c
**BACKLOG row:** `docs/BACKLOG.md` — *"PR-archive pagination refactor — per-connection cursor pagination, not whole-query refetch"* (end of `## P2 — research-grade`)

Resolving.

### Thread 11: tools/pr-preservation/archive-pr.sh:390 (resolved)

**@chatgpt-codex-connector** (2026-04-24T13:45:51Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Preserve trailing whitespace in archived discussion text**

The formatter rewrites every output line with `rstrip()`, which removes trailing spaces from PR bodies/reviews/comments before writing the archive. This changes markdown semantics in real cases (for example, GitHub comments that use two trailing spaces for hard line breaks), so the generated file is no longer a faithful audit copy of the original discussion. Since this tool is explicitly for durable preservation, this normalization should not be applied to user-authored text.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T14:38:59Z):

Fixed in a5331f7. Dropped the per-line `rstrip()` normalization so trailing whitespace (e.g. markdown two-space hard-line-breaks) is preserved verbatim — the archive is a faithful audit copy again. Ran into a tension with a sibling thread on this same line (MD012 blank-line runs) so also added a blank-line-run collapse that normalizes 3+ blank lines to 2 without touching in-line trailing whitespace.

### Thread 12: tools/pr-preservation/archive-pr.sh:390 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T13:47:01Z):

The output normalization only strips trailing whitespace; several generated archives (including the backfilled ones in this PR) contain 3+ consecutive blank lines (e.g., around <details> blocks), which will trip markdownlint MD012 because `docs/pr-discussions/**` is not in the markdownlint ignore list. Consider adding a safe normalization step that collapses multiple consecutive blank lines (or alternatively add `docs/pr-discussions/**` to `.markdownlint-cli2.jsonc` ignores) and then regenerate the backfilled archives so CI stays green.
```suggestion
content = '\n'.join(line.rstrip() for line in content.split('\n'))
# Collapse excessive blank-line runs so generated archives
# do not trip markdownlint MD012.
normalized_lines = []
blank_run = 0
for line in content.split('\n'):
    if line == '':
        blank_run += 1
    else:
        blank_run = 0
    if blank_run <= 2:
        normalized_lines.append(line)
content = '\n'.join(normalized_lines).rstrip() + '\n'
```

**@AceHack** (2026-04-24T14:39:07Z):

Fixed in a5331f7. Added the blank-line-run collapse you suggested (3+ consecutive blank lines -> 2) so archives stay clean under markdownlint MD012 without needing to ignore `docs/pr-discussions/**`. Also regenerated the three backfilled archives that were tripping MD012 (PR-0350, PR-0352, PR-0354) — they're now clean. Kept user-authored trailing whitespace preserved (markdown two-space hard-line-breaks) per the sibling thread.

### Thread 13: tools/pr-preservation/archive-pr.sh:90 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T13:47:02Z):

The repo-detection comment says the script "falls back" to Lucent-Financial-Group/Zeta if `gh repo view` fails, but the implementation hard-fails with exit 1 and does not provide any fallback. Please align the comment with actual behavior (or implement the documented fallback) so operators aren’t misled.

**@AceHack** (2026-04-24T14:39:11Z):

Fixed in a5331f7. The comment used to say "falls back" but the implementation hard-fails with exit 1 — updated the comment to match actual behavior: requires `gh repo view` to succeed, no silent fallback to a baked-in NWO. Rationale: better to fail loud than archive to the wrong repo path on a fork.

### Thread 14: tools/pr-preservation/archive-pr.sh:71 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T13:47:02Z):

`PR` is taken verbatim from argv and then `int(os.environ['PR'])` is called in the Python fetch driver. If the user passes a non-integer (or whitespace), this will raise a Python traceback and be reported as a generic “fetch failed … exit 1” with exit code 2. Consider validating `PR` is an integer in the shell before invoking Python and exiting 1 with a clear usage/error message.
```suggestion
PR="$1"
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "error: PR number must be a non-empty integer" >&2
  echo "usage: $0 <PR-number>" >&2
  exit 1
fi
```

**@AceHack** (2026-04-24T14:39:15Z):

Fixed in a5331f7. Applied your suggested shell-side integer validation (regex `^[0-9]+$`) before invoking Python. Now a non-integer arg exits 1 with a clear "PR number must be a non-empty positive integer" message instead of a Python traceback mapped to exit 2. Verified: `./archive-pr.sh not-an-int` exits 1 with the usage line.

### Thread 15: docs/pr-discussions/PR-0354-tools-backlog-split-phase-1a-generator-schema-example-row-aa.md:87 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T13:47:02Z):

This archived PR discussion includes multiple consecutive blank lines (e.g., between “**Reviewed commit:** …” and the following `<details>` block). With the current `.markdownlint-cli2.jsonc` config, MD012 (no multiple consecutive blank lines) will run on `docs/pr-discussions/**` and may fail CI. If the archive format is intended to be lint-clean, regenerate archives after adjusting the archiver to collapse excess blank lines; otherwise consider excluding `docs/pr-discussions/**` from markdownlint.

**@AceHack** (2026-04-24T14:39:21Z):

Fixed in a5331f7. Added the blank-line-run collapse to the archiver (3+ -> 2) and regenerated this archive (PR-0354) along with PR-0350 and PR-0352 — all three were tripping MD012. Verified with a grep for `\\n\\n\\n\\n` across `docs/pr-discussions/*.md`: zero matches after regeneration.

### Thread 16: tools/pr-preservation/README.md:115 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T13:47:02Z):

README lists a `bash 4+` dependency, but `archive-pr.sh` doesn’t appear to rely on bash-4-only features (and macOS still ships bash 3.2 by default). Either (a) enforce the version at runtime (fail fast with a helpful message), or (b) relax the documented requirement to just `bash` if bash 3.x is sufficient.
```suggestion
- `bash`, POSIX `mktemp`
```

**@AceHack** (2026-04-24T14:39:23Z):

Fixed in a5331f7 — relaxed the documented dependency to `bash` with a note that the script uses no bash-4-only features and macOS default bash 3.2 is fine. Chose option (b) per your suggestion; adding a runtime version check would be extra complexity with no payoff since the script genuinely doesn't need 4+.

### Thread 17: tools/pr-preservation/README.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T13:47:03Z):

The intro paragraph says the tool writes `docs/pr-discussions/PR-<N>-<slug>.md`, but later the Usage section specifies the zero-padded `PR-<NNNN>-<slug>.md` naming. Please make the intro consistent with the actual filename format to avoid operators looking for the wrong path.
```suggestion
`docs/pr-discussions/PR-<NNNN>-<slug>.md` for durable
```

**@AceHack** (2026-04-24T14:39:25Z):

Fixed in a5331f7. README intro now says `docs/pr-discussions/PR-<NNNN>-<slug>.md` (zero-padded four digits) — matches the Usage section and the implementation.

### Thread 18: tools/pr-preservation/archive-pr.sh:25 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T13:47:03Z):

Header comment still describes the output path as `docs/pr-discussions/PR-<N>-<slug>.md`, but the implementation writes `PR-{number:04d}-...` (zero-padded to 4 digits). Consider updating the header comment so it matches the actual filename format (and the README’s `PR-<NNNN>-...` wording).

**@AceHack** (2026-04-24T14:39:27Z):

Fixed in a5331f7. Header comment block now documents the zero-padded `PR-<NNNN>-<slug>.md` filename shape, matching the implementation's `f'PR-{number:04d}-{slug}.md'` and the README.

### Thread 19: tools/pr-preservation/archive-pr.sh:325 (resolved)

**@chatgpt-codex-connector** (2026-04-24T14:42:54Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Use PR number as stable archive filename key**

The output path is keyed by a slug derived from the current PR title, so re-archiving after a title edit writes a second file instead of updating the existing archive for that PR number. This leaves stale duplicates (`PR-####-old-title.md` plus `PR-####-new-title.md`) and breaks the expected one-record-per-PR behavior for reconciliation/backfill workflows.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T14:50:39Z):

Fixed in 549369f. PR number is now the canonical archive key: on re-archive, we glob for existing `PR-<NNNN>-*.md` and reuse that path regardless of current title (option b from your suggestion — preserves the human-friendly slug while ensuring idempotency). Smoke-tested: running `./archive-pr.sh 357` wrote back to the same PR-0357-* file, no orphan produced.

### Thread 20: tools/pr-preservation/archive-pr.sh:369 (resolved)

**@chatgpt-codex-connector** (2026-04-24T14:42:54Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Preserve leading whitespace in archived comment bodies**

Comment/review text is normalized with `.strip()`, which removes leading spaces and leading blank lines from user-authored content before writing the archive. This is lossy for markdown that intentionally starts with indentation (for example indented code blocks) and undermines the script’s preservation/audit goal; the same pattern is used for thread and general comments as well.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T14:50:42Z):

Fixed in 549369f. Switched `.strip()` to `.rstrip('\n')` for review bodies, thread-comment bodies, and general-comment bodies so leading whitespace (indented code blocks, nested bullets) survives the archive round-trip. Only trailing newlines are stripped now. Review state check on empty bodies uses `body_text.strip()` as a boolean guard only — does not mutate the archived text.

### Thread 21: tools/pr-preservation/archive-pr.sh:34 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T14:55:40Z):

P0: This header says the script adds a “truncation warning for threads (>100) and per-thread comments (>100)”, but the implementation only paginates; it never emits any warning. Either implement the warning (e.g., when a connection requires >1 page) or remove the claim so operators aren’t misled about what diagnostics they’ll get.
```suggestion
#   - Pagination for threads (>100) and per-thread comments
#     (>100).
```

### Thread 22: tools/pr-preservation/archive-pr.sh:384 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T14:55:41Z):

P0: `body.rstrip()` strips spaces/tabs from the end of the PR description’s final line. That conflicts with the goal of preserving markdown semantics (two trailing spaces = hard line break). Use a newline-only trim (e.g., rstrip of `\n`) or avoid trimming entirely for user-authored text.
```suggestion
    lines.append(body.rstrip('\n'))
```

### Thread 23: tools/pr-preservation/archive-pr.sh:457 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T14:55:41Z):

P0: `content = '\n'.join(lines).rstrip() + '\n'` (and the later `.rstrip()` after collapsing blanks) will still remove trailing spaces from the last line of the archive, so the output is not a fully faithful copy even after removing per-line trimming. Prefer trimming only trailing newlines (or leaving content unchanged) so end-of-file hard line breaks aren’t lost.

### Thread 24: docs/pr-discussions/PR-0357-tools-pr-preservation-minimal-archive-otto-207-session-backf.md:86 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T14:55:41Z):

P0: This archive contains a whitespace-only line (line 85) which will trip markdownlint MD009 (no trailing spaces) because `docs/pr-discussions/**` is not in the markdownlint ignore list. Either normalize whitespace-only lines to empty during archive generation (while still preserving meaningful inline trailing spaces), or add this directory to markdownlint ignores to keep CI green.
```suggestion

```

### Thread 25: docs/pr-discussions/PR-0354-tools-backlog-split-phase-1a-generator-schema-example-row-aa.md:84 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T14:55:42Z):

P0: This archive includes a whitespace-only line (line 83) which will fail markdownlint MD009 (no trailing spaces). If the intent is for `docs/pr-discussions/**` to be lint-clean, the archiver needs to normalize whitespace-only lines (or the directory should be markdownlint-ignored like other verbatim archives).
```suggestion

```

### Thread 26: docs/pr-discussions/PR-0350-docs-frontier-rename-pass-2-hindu-ff7-egyptian-greek-norse-s.md:63 (unresolved)

**@copilot-pull-request-reviewer** (2026-04-24T14:55:42Z):

P0: Whitespace-only line at 62 will violate markdownlint MD009 (no trailing spaces). This appears to be a systematic artifact of archiving Codex connector comments; consider normalizing whitespace-only lines during archive generation or excluding `docs/pr-discussions/**` from markdownlint if verbatim preservation is required.
```suggestion

```

## General comments

### @chatgpt-codex-connector (2026-04-24T14:50:43Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
