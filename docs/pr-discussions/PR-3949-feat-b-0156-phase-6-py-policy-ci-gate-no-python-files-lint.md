---
pr_number: 3949
title: "feat(081KQGDBJ0008QG0R000A4EZS5): Phase 6 .py policy CI gate \u2014 no-python-files lint"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T21:59:09Z"
merged_at: "2026-05-16T22:02:07Z"
closed_at: "2026-05-16T22:02:07Z"
head_ref: "otto-cli/b0156-phase6-no-python-lint-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T23:29:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3949: feat(081KQGDBJ0008QG0R000A4EZS5): Phase 6 .py policy CI gate — no-python-files lint

## PR description

## Summary

Smallest safe slice of [081KQGDBJ0008QG0R000A4EZS5](../backlog/P1/081KQGDBJ0008QG0R000A4EZS5-typescript-standardization-non-install-scripts-aaron-2026-05-01.md) (TypeScript standardization). Closes Phase 6 — `.py` policy CI enforcement.

Substrate-drift discriminator at session start confirmed Phases 1-5 = DONE (all six named non-install `.sh` files already ported to `.ts` and deleted; `tools/profile.ts`, `tools/peer-call/amara.ts`, `tools/peer-call/ani.ts`, `tools/hygiene/{snapshot,check}-github-settings.ts`, `tools/hygiene/check-tick-history-shard-schema.ts` all exist). Phase 6 (`.py` policy enforcement) was the only outstanding acceptance bullet.

## What lands

- **`tools/lint/no-python-files.ts`** — TS+Bun lint (per Rule 0: no `.sh` outside install graph). Walks the tree, hard-excludes `references/upstreams`, `.venv`, `__pycache__`, `site-packages`, `tools/lean4/.lake`, `node_modules`, `bin/obj`. Reads `tools/lint/no-python-files.allowlist` for explicit exceptions. Exit 0 clean / 1 flagged / 2 allowlist-missing.
- **`tools/lint/no-python-files.allowlist`** — starts empty (current repo state: 0 `.py` files in our scope, matching the row's audit baseline). Legitimate exceptions land here with reason comments.
- **`tools/lint/no-python-files.test.ts`** — 9 `bun test` unit tests against synthetic trees (clean / flagged / allowlisted / each hard-exclude segment / `--list` mode / comment-line handling / missing-allowlist).
- **`.github/workflows/gate.yml`** — new `lint-no-python-files` job adjacent to `lint-no-empty-dirs`, same shape (3-min timeout, install toolchain, run lint). No untrusted input in `run:` lines.
- **Backlog row** — Phase 6 marked DONE; `last_updated: 2026-05-16`.
- **Tick shard** — `docs/hygiene-history/ticks/2026/05/16/2157Z.md`.

## Focused checks

| Check | Outcome |
|---|---|
| `bun test tools/lint/no-python-files.test.ts` | 9 pass / 0 fail / 15 expect() calls |
| `bun tools/lint/no-python-files.ts` (real repo) | `OK (0 allowlisted, 0 flagged)` — exit 0 |
| `bun tools/lint/no-empty-dirs.ts` (regression check after adding new files) | green |
| `js-yaml` parse of `.github/workflows/gate.yml` | 17 jobs, `lint-no-python-files` present |
| `git ls-tree HEAD \| wc -l` vs `origin/main` (broken-commit canary) | 53 vs 53, OK |

## Test plan

- [ ] CI gate.yml runs `lint-no-python-files` step — green on this PR (0 `.py` files in scope)
- [ ] No regression on existing `lint-no-empty-dirs` or other lint jobs
- [ ] Backlog index regen produced byte-identical `docs/BACKLOG.md` (verified locally; no diff)

## Composes with

- 081KQGDBJ0008QG0R000A4EZS5 acceptance criterion 4 (`.py` policy lint added to gate.yml)
- Rule 0 (TS over bash for non-install scripts) — implementation IS TS, not the inline `find` bash the row had drafted
- `no-empty-dirs.ts` template — same allowlist + hard-exclude + posix-rel + bun-test patterns

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T22:02:12Z)

## Pull request overview

Adds a Bun/TypeScript CI lint gate for 081KQGDBJ0008QG0R000A4EZS5 Phase 6 to prevent first-party `.py` files outside approved exclusions/allowlist.

**Changes:**

- Adds `no-python-files` lint tool, allowlist, and Bun tests.
- Wires the lint into `gate.yml`.
- Updates backlog/tick documentation for the completed phase.

### Reviewed changes

Copilot reviewed 6 out of 6 changed files in this pull request and generated 6 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `tools/lint/no-python-files.ts` | Implements the `.py` file scanner and policy enforcement. |
| `tools/lint/no-python-files.test.ts` | Adds unit tests for lint outcomes and exclusions. |
| `tools/lint/no-python-files.allowlist` | Documents the explicit allowed `.py` path list. |
| `.github/workflows/gate.yml` | Adds the CI job that runs the new lint. |
| `docs/backlog/P1/081KQGDBJ0008QG0R000A4EZS5-typescript-standardization-non-install-scripts-aaron-2026-05-01.md` | Marks Phase 6 complete and updates status details. |
| `docs/hygiene-history/ticks/2026/05/16/2157Z.md` | Records the implementation tick for this phase. |
</details>


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/lint/no-python-files.ts:62**

* This second `spawnSync("git", ...)` has the same SonarJS issue as the `repoRoot()` call: TypeScript tools in this repo suppress `sonarjs/no-os-command-from-path` with a short rationale when intentionally invoking `git` from PATH. Without that, the new tool is likely to break the TypeScript lint gate.
```
  const result = spawnSync("git", ["check-ignore", "--stdin"], {
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-16T22:02:32Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `72ab8dc69c`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: tools/lint/no-python-files.ts:52 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T22:02:11Z):

This `spawnSync("git", ...)` call will trip the repo's SonarJS `sonarjs/no-os-command-from-path` rule. Existing TypeScript tools that shell out to `git` document the intentional PATH lookup with an eslint-disable comment (for example, `tools/lint/no-empty-dirs.ts` does this before its matching `repoRoot()` call), so this new lint likely fails `npm run lint:typescript` unless the suppression/rationale is added.

This issue also appears on line 62 of the same file.

### Thread 2: tools/lint/no-python-files.test.ts:15 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T22:02:11Z):

The test helper also invokes `git` via `spawnSync` without the repo-standard `sonarjs/no-os-command-from-path` suppression/rationale. Because tests are included in `eslint .`, this new test file can fail the TypeScript lint job even though the Bun tests pass.

### Thread 3: tools/lint/no-python-files.ts:203 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T22:02:11Z):

This user-facing lint message carries a human-maintainer name/date attribution. Outside the repo's history surfaces, the established convention is to use role references instead of direct names, so keep the policy reference but remove or role-phrase the attribution here.

### Thread 4: tools/lint/no-python-files.ts:230 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T22:02:12Z):

Filtering candidates through `git check-ignore` creates a bypass for committed `.py` files that are force-added under an ignored path (for example a checked-in file under `drop/` or `coverage/` would be present in CI but removed from `filtered`). This gate is described as enforcing committed `.py` policy, so it should either enumerate tracked files or distinguish tracked ignored files from untracked ignored scratch before suppressing them.

### Thread 5: tools/lint/no-python-files.allowlist:14 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T22:02:12Z):

This allowlist documentation overstates the hard exclude: the script hard-excludes only `tools/lean4/.lake` by prefix, not every `.lake` directory. A contributor could rely on this comment and assume another `.lake` tree does not need an allowlist entry, so either name the exact prefix here or add `.lake` as a segment hard-exclude.

### Thread 6: .github/workflows/gate.yml:884 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T22:02:12Z):

This workflow comment also says `.lake` is hard-excluded, but the script only hard-excludes `tools/lean4/.lake`. Please keep the CI comment aligned with the actual exclusion scope so reviewers know which paths the gate really skips.

### Thread 7: tools/lint/no-python-files.ts:120 (unresolved)

**@chatgpt-codex-connector** (2026-05-16T22:02:32Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Detect Python extensions case-insensitively**

`findPythonFiles()` only flags names ending with lowercase `.py`, so a committed file like `scripts/tool.PY` or `tool.Py` is treated as non-Python and the new CI job passes even though policy intent is to block Python files. This creates a straightforward bypass of the enforcement introduced in this commit; normalize the filename case (or use a case-insensitive suffix check) before testing the extension.

Useful? React with 👍 / 👎.
