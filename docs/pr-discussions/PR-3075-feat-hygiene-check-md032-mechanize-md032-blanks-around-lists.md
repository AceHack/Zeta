---
pr_number: 3075
title: "feat(hygiene/check-md032): mechanize MD032 blanks-around-lists pre-check (081KRHWGX0008QG0R000JEBCWZ)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T00:33:18Z"
merged_at: "2026-05-14T02:52:39Z"
closed_at: "2026-05-14T02:52:39Z"
head_ref: "feat/b0456-md032-blanks-around-lists-helper-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T08:25:44Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3075: feat(hygiene/check-md032): mechanize MD032 blanks-around-lists pre-check (081KRHWGX0008QG0R000JEBCWZ)

## PR description

## Summary

Implements [081KRHWGX0008QG0R000JEBCWZ](docs/backlog/P2/081KRHWGX0008QG0R000JEBCWZ-mechanize-md032-blanks-around-lists-pre-commit-2026-05-14.md) — a TS helper that detects MD032 (blanks-around-lists) violations locally so they don't escape to CI. Catches the recurring failure pattern that hit 5 tick shards this session.

## What ships

- [`tools/hygiene/check-md032-blanks-around-lists.ts`](tools/hygiene/check-md032-blanks-around-lists.ts) — scans `.md` files (filesystem mode) or staged blobs (via `git show :path`) for MD032 violations on BOTH sides (blank-before-list AND blank-after-list); emits `file:line: context` for each finding; exit 0/1.
- [`tools/hygiene/check-md032-blanks-around-lists.test.ts`](tools/hygiene/check-md032-blanks-around-lists.test.ts) — **66 tests** covering every observed pattern + every round-discovered edge case.

## Algorithm

Explicit `inList: false | "top" | "block"` + `openFence: { char, len } | null` state machine. The `inList` enum distinguishes top-level lists from blockquoted lists for correct block-transition handling (e.g., a blockquote line terminates a top-level list but continues a blockquoted one).

Recognises:

- **List markers**: `-` `+` `*` `1.` `1)` `12.` `12)`, capped 9 digits
- **List indent**: 0-3 spaces (4+ is code); blockquote prefix `(>[ \t]?)+` adds 0-3 more spaces inside the quote
- **Lists in blockquote context**: `> -` `> 1.` `> > -` (nested); `>` (or `>` + spaces) treated as blockquoted blank
- **ATX headings**: NOT list-friendly (blank required after heading)
- **Fenced code blocks**: backtick + tilde; matching delim char + len; opener allows info string / closer must be whitespace-only; backtick info string forbids backticks, tilde info string allows tildes; fence transitions preserve list context for indented (list-body) fences, terminate for flush-left / blockquoted top-level fences
- **YAML front matter**: skipped per markdownlint behavior
- **Markdownlint-cli2 ignore globs**: applied via JSONC parse
- **Lazy unindented list-item paragraph continuations**: don't end the list
- **Thematic break (`---`, `***`, `___`)**: terminates list
- **Blockquote-line after top-level list**: terminates list (continues blockquoted list)
- **MD032 after-list side**: heading / thematic break / fence / blockquote directly after a list (no blank) fires MD032 too
- **Staged-blob reads**: `--staged` reads via `git show :path` (the index), not the working tree

## CLI usage

```bash
bun tools/hygiene/check-md032-blanks-around-lists.ts file1.md file2.md
bun tools/hygiene/check-md032-blanks-around-lists.ts --staged
```

`main()` is exported per the canonical hygiene-tool pattern. Read errors on explicit inputs throw + exit 1; staged-blob read failures throw (an index anomaly should not silently pass). `spawnSync` launch failures (git not on PATH, EACCES) surface `r.error.message` for diagnosability.

## Review-trail

| Round | Findings | Resolution |
|---|---|---|
| 1 | 4 (P0 unused param, P1 list-marker indent, P2 fenced-code blocks, P2 docstring drift) | commit `3158f6a` |
| 2 | 8 (heading-not-list-friendly, `inList`-guarded continuation, fence i=0 start, fence-char/len matching, checkFiles read-error surfacing, stagedMarkdownFiles throws) | `6c436bd` + `c15613c` |
| 3 | 1 (P2 include renames `--diff-filter=AMR`) | `9bfdde9` |
| 4 | 5 (P1 closer rejects info string, P1 reviewer-name role-ref discipline ×2, P2 export main, P2 PR-description test count) | `579dce9` + body edit |
| 5 | 1 stale-snapshot duplicate of round 4 | already in `579dce9` |
| 6 | 4 (P1 markdownlint ignore globs, P1 paren ordered-list, P2 test coverage ×2) | `3ebca13` + merge `27cb70d` |
| 7 | 2 (P2 YAML front-matter skip, 1 stale-snapshot) | `3649327` |
| 8 | 4 (P1 lazy continuations, P1 9-digit cap, P1 fence info-string rejection, P2 spawnSync.error.message) | `acd8ff8` |
| 9 | 2 (P1 blockquote-context lists + blockquoted blank, 1 stale-snapshot) | `117fa7b` |
| 10 | 4 (P1 tilde-fence info-strings allow tilde; P1 fence-keeps-list-context for fence-inside-list-item; P1 test invert; P2 PR body) | `a86a524` + body edit |
| 11 | 4 (1 P1 require → import; 3 stale-snapshot duplicates) | `8498772` |
| 12 | 3 (P1 heading-terminates-list; P1 blockquote-fence regex; P1 flush-left fence split) | `7c5f079` |
| 13 | 1 (P1 `--staged` reads index blob via `git show :path`) | `263b7b4` |
| 14 | 6 (P1 permissive blockquote spacing; P1 fence-blockquote-terminates-list; P1 fail-loud staged blob; P1 test git() helper; P2 PR body stale; +1 inverted) | `11fcbd5` |
| 15 | 1 (P1 thematic break + blockquote terminates + inList type lift to top/block) | `9fdb083` |
| 16 | 5 (P1 after-list MD032 side; P1 blockquote inner-indent cap 0-3; P2 double-git-call refactor; P2 PR body stale; +1 test invert) | this commit + body edit |

39 substantive findings across 16 rounds; 6 stale-snapshot duplicates.

## Acceptance criteria

- [x] Tool exists, passes clean fixture, fails dirty fixture
- [x] Test file covers spec'd edge cases + all round-discovered edge cases (66 tests)
- [x] CLI emits `file:line` (matches markdownlint output style)
- [x] Exported `main()` per canonical hygiene-tool pattern
- [x] `--staged` mode honors markdownlint-cli2 `ignores`
- [x] `--staged` mode reads index blob (`git show :path`), not working tree
- [ ] Wire into pre-push hook OR tick-close ritual — **deferred to a follow-up PR**.

## Out of scope (captured for future)

The session also generated MD018 ×2 + MD038 ×N + MD056 ×1 findings on tick shards. Separate helpers / a unified markdownlint-class helper are captured for follow-up rows.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T00:35:57Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `36b86136f9`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:37:03Z)

## Pull request overview

Adds a Bun/TypeScript hygiene helper for locally detecting common MD032 “blank line before list” failures before CI.

**Changes:**
- Adds `check-md032-blanks-around-lists.ts` CLI/helper with explicit file and `--staged` modes.
- Adds Bun tests for common clean/dirty list-start patterns and unreadable-file behavior.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| `tools/hygiene/check-md032-blanks-around-lists.ts` | Implements the MD032 pre-check scanner and CLI. |
| `tools/hygiene/check-md032-blanks-around-lists.test.ts` | Adds unit tests for scanner behavior and unreadable files. |


<details>
<summary>Comments suppressed due to low confidence (4)</summary>

**tools/hygiene/check-md032-blanks-around-lists.ts:148**
* P1: A `git diff` failure is converted into an empty file list, and `main` then exits successfully as “no staged .md files.” In a pre-push/pre-commit context this silently disables the check when `git` is unavailable, the working directory is not a repository, or the command errors; propagate a non-zero result instead of returning `[]`.
```
  if (r.status !== 0) {
    console.error(`git diff failed: ${r.stderr ?? ""}`);
    return [];
```
**tools/hygiene/check-md032-blanks-around-lists.ts:97**
* P1: The scanner does not track fenced code blocks, so valid Markdown examples can be reported as MD032 violations. For example, a fenced YAML block containing `items:` followed by `- value` has no markdown list for MD032 to lint, but these lines would still be flagged because the function scans every raw line.
```
  for (let i = 1; i < lines.length; i++) {
    const cur = lines[i] ?? "";
    if (!isListItemStart(cur)) continue;
    const prev = lines[i - 1] ?? "";
    if (isBlank(prev) || isListFriendlyLeading(prev)) continue;
```
**tools/hygiene/check-md032-blanks-around-lists.ts:95**
* P1: This only checks the blank line before a list starts, but MD032 also requires a blank line after a list block. A file like `- item` immediately followed by prose would exit clean here while markdownlint still fails, so the helper is not a reliable MD032 pre-check.
```
  // Walk pairwise: each list-start line is checked against the line before.
  for (let i = 1; i < lines.length; i++) {
    const cur = lines[i] ?? "";
    if (!isListItemStart(cur)) continue;
```
**tools/hygiene/check-md032-blanks-around-lists.ts:122**
* P1: Explicitly provided files that cannot be read are treated as clean, so `bun ... missing.md` exits 0 with “no MD032 findings.” A lint/pre-push helper should fail on unreadable input; otherwise missing files, permission errors, or stale staged paths can silently bypass the check.
```
      // Unreadable — skip silently. The audit-duplicate-row-ids tool's
      // round-2 review pushed in the opposite direction (surface read
      // errors) but here we're a fast pre-push helper; the user will
      // see the broken file at push time or in CI anyway.
      continue;
```
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T00:48:00Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 6 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-14T00:48:59Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6f20e2d938`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-14T00:56:28Z)

Lior anti-gravity check: DRIFT DETECTED. Narration-over-action. You built a detection mechanism (check-md032-blanks-around-lists.ts) but deferred wiring it to a hook or CI. This is building capability without exercising it. Add the hook wiring so the tool is actually used. Do not merge dead code.

### COMMENTED — @AceHack (2026-05-14T00:56:40Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T00:56:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T00:56:42Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T00:56:47Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T00:56:47Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T00:56:48Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-14T00:58:42Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6c436bd53d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T01:05:45Z)

## Pull request overview

Copilot reviewed 7 out of 7 changed files in this pull request and generated 5 comments.


<details>
<summary>Comments suppressed due to low confidence (3)</summary>

**tools/hygiene/check-md032-blanks-around-lists.ts:237**
* P1: `--staged` scans every staged `.md` file without applying the repository's markdownlint ignore list (for example `memory/**`, `docs/pr-preservation/**`, `docs/history/pr-reviews/**`, and date-prefixed `docs/research/**` are ignored in .markdownlint-cli2.jsonc). Once this is used as the pre-push path, it can fail on files that markdownlint CI deliberately skips, so the helper no longer matches the rule it is meant to pre-check.
```
  if (r.status !== 0) {
    throw new Error(`git diff --cached failed: ${r.stderr?.trim() ?? "unknown error"}`);
  }
  return (r.stdout ?? "")
```
**tools/hygiene/check-md032-blanks-around-lists.ts:229**
* P1: The staged-file path excludes renamed markdown files because `--diff-filter=AM` omits `R` statuses. A renamed `.md` file that is edited in the same commit can still fail markdownlint in CI, but `--staged` will not scan it locally, leaving a false negative in the pre-check.
```
 */
function stagedMarkdownFiles(repoRoot: string): string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array; no shell, no user input on the command line.
  const r = spawnSync(
```
**tools/hygiene/check-md032-blanks-around-lists.ts:237**
* P1: `--staged` identifies paths from the index but then returns working-tree file paths for `readFileSync` to scan. If the staged content differs from the working tree, this can miss a violation that is actually staged for commit (or fail on an unstaged edit that CI will not see); a staged checker needs to read the blob from the index or otherwise ensure it scans the same content that will be committed.
```
  if (r.status !== 0) {
    throw new Error(`git diff --cached failed: ${r.stderr?.trim() ?? "unknown error"}`);
  }
  return (r.stdout ?? "")
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-14T01:09:35Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `0e0563f99f`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @AceHack (2026-05-14T01:11:18Z)

Lior Antigravity Check: PR appears cohesive. Please resolve the Copilot threads regarding '--staged' not respecting the ignore list before merging.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T01:15:51Z)

## Pull request overview

Copilot reviewed 10 out of 10 changed files in this pull request and generated 4 comments.

### COMMENTED — @AceHack (2026-05-14T01:16:53Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-14T01:17:58Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `f1b1a3e34d`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T01:31:12Z)

## Pull request overview

Copilot reviewed 11 out of 11 changed files in this pull request and generated 4 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-14T01:36:56Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `73ba37e98a`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T01:41:27Z)

## Pull request overview

Copilot reviewed 13 out of 13 changed files in this pull request and generated 4 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/hygiene/check-md032-blanks-around-lists.ts:210**
* P1: Clearing `inList` on fence close also breaks list context for fences nested inside list items. After an indented fenced block in a list item, the following sibling list item is valid without an intervening blank, but this reset makes it look like a fresh list after the non-blank closing fence and can produce a false MD032 finding.
```
        openFence = null;
        inList = false;
```
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T01:49:32Z)

## Pull request overview

Copilot reviewed 15 out of 15 changed files in this pull request and generated 4 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-14T01:56:54Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `dce1206183`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T01:58:20Z)

## Pull request overview

Copilot reviewed 17 out of 17 changed files in this pull request and generated 2 comments.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**tools/hygiene/check-md032-blanks-around-lists.ts:269**
* P1: This branch keeps `inList` true for every non-blank non-list line, including ATX headings, despite the comment saying headings end the list. After a prior list, `- a\n# Heading\n- b` will skip the predecessor check for `- b`, so the local helper misses the heading-then-list MD032 failure that CI still reports.
```
      // Non-list, non-blank, non-heading, non-fence line. CommonMark
      // allows BOTH indented and lazy (unindented) continuations of a
      // list-item paragraph, so we keep `inList` unchanged here — the
      // list block only ends on a blank line, an ATX heading, or a
      // fence boundary (all handled above). The earlier algorithm reset
```
**tools/hygiene/check-md032-blanks-around-lists.ts:213**
* P1: Preserving `inList` across every fence transition is too broad. A flush-left fenced block after a list is not a lazy list-item continuation in CommonMark, so `- item\n```\ncode\n```\n- next` should check the second bullet against the fence close; this state retention lets that CI MD032 failure pass locally.
```
        // Do NOT reset `inList` — a fenced code block can be a child
        // block inside a list item (e.g. `- item\n  \`\`\`\n  code\n
        //   \`\`\`\n- next`), and markdownlint does not require a
        // blank before the sibling item. Resetting here would make
        // the sibling bullet look like a new list with a non-blank
        // fence-close predecessor, producing a false MD032 finding
        // (pre-CI review P1 on PR #3075 round 10).
        openFence = { char: fence.char, len: fence.len };
```
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T02:08:06Z)

## Pull request overview

Copilot reviewed 19 out of 19 changed files in this pull request and generated 1 comment.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T02:17:17Z)

## Pull request overview

Copilot reviewed 21 out of 21 changed files in this pull request and generated 6 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-14T02:21:36Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `2855393608`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T02:29:28Z)

## Pull request overview

Copilot reviewed 23 out of 23 changed files in this pull request and generated 5 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/hygiene/check-md032-blanks-around-lists.ts:169**
* P1: `fenceInfo` still only accepts zero or one space after each blockquote marker, so valid blockquoted fences like `>   ```ts` are not recognized even though CommonMark allows the remaining indentation before the fence. List-like lines inside that fence will be scanned as prose/list items and can produce MD032 false positives that markdownlint would not report.
```
  // prose lines do not get a free pass.
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-14T02:33:03Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `9fdb083cee`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T02:43:21Z)

## Pull request overview

Copilot reviewed 24 out of 24 changed files in this pull request and generated 5 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/hygiene/check-md032-blanks-around-lists.ts:448**
* This inline comment still says the default read-error path is for `--staged` mode, but staged scanning no longer reaches this filesystem-read branch. The comment should be updated or removed so future readers do not reintroduce the old silent-skip staged behavior.
```
      content = readFileSync(f, "utf-8");
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-14T02:44:12Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `47a7adc5a5`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-14T02:54:44Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `5dbeafedc9`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T02:54:47Z)

## Pull request overview

Copilot reviewed 24 out of 24 changed files in this pull request and generated 6 comments.

## Review threads

### Thread 1: tools/hygiene/check-md032-blanks-around-lists.ts:97 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:35:57Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Ignore list-like lines inside fenced code blocks**

`findMd032Violations` applies the MD032 heuristic to every raw line pair and never tracks fenced-code/frontmatter regions, so a code sample like ```` ```\nLabel:\n- option\n``` ```` is reported as a violation even though markdownlint does not lint list structure inside code fences. This creates false positives (and, once hooked into pre-push, can block otherwise clean docs), so the checker should skip non-Markdown-content regions before evaluating list boundaries.

Useful? React with 👍 / 👎.

### Thread 2: tools/hygiene/check-md032-blanks-around-lists.ts:111 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:37:02Z):

P0: `repoRoot` is never read inside `checkFiles`, and this repository enables `noUnusedParameters` in `tsconfig.json`. This will make `npm run typecheck` / `bun run typecheck` fail until the parameter is removed, renamed as an intentional discard, or actually used.

### Thread 3: tools/hygiene/check-md032-blanks-around-lists.ts:109 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:37:02Z):

P2: This function comment is stale: `checkFiles` does not emit to stderr and returns an array of findings, not a total count. Keeping the contract comment accurate matters because `main` owns the output boundary below.

### Thread 4: tools/hygiene/check-md032-blanks-around-lists.ts:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:37:03Z):

P1: `\s*` treats four-space indented code as a list marker, but CommonMark only allows list markers indented 0–3 spaces. A code block line like `    - option` after non-blank text can be reported as an MD032 violation even though markdownlint would ignore it as code.

This issue also appears in the following locations of the same file:
- line 92
- line 93
- line 118
- line 146

### Thread 5: tools/hygiene/check-md032-blanks-around-lists.ts:82 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:47:58Z):

P1: Treating ATX headings as “list-friendly” creates a false negative for the enabled MD032 rule: markdownlint’s blanks-around-lists check still requires a blank line between a heading and the following list. With this exception, `# Heading` immediately followed by `- item` exits clean locally but fails markdownlint in CI.

**@AceHack** (2026-05-14T00:56:40Z):

Fixed in the latest commit. Removed the ATX-heading exemption from `isListFriendlyLeading` — markdownlint MD032 requires a blank line before a list even when the preceding line is a heading, so treating headings as list-friendly was producing false negatives. The test fixture at line 97 in the test file was updated to expect 1 finding (the `- item one` on line 4) instead of zero.

### Thread 6: tools/hygiene/check-md032-blanks-around-lists.test.ts:97 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:47:59Z):

P1: This test locks in behavior that contradicts MD032: a heading immediately followed by a list still needs a blank line under the repository’s markdownlint profile. Keeping this as a clean fixture will preserve the tool’s false negative instead of catching the CI failure.

**@AceHack** (2026-05-14T00:56:41Z):

Fixed: updated this test to expect `toHaveLength(1)` with `findings[0].line === 4`. The test now documents the correct behaviour — a heading immediately followed by a list without a blank line IS a MD032 violation. The old fixture was locking in the false-negative that the reviewer flagged.

### Thread 7: tools/hygiene/check-md032-blanks-around-lists.ts:87 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:47:59Z):

P1: This treats any whitespace-prefixed previous line as a list continuation even when the scanner has not established that it is inside a list. Markdown permits ordinary paragraph lines indented 1–3 spaces, so a pattern like `  Label:` followed immediately by `- item` can still fail MD032 in CI while this helper skips it locally.

**@AceHack** (2026-05-14T00:56:42Z):

Fixed: `isListFriendlyLeading` now takes an `inList: boolean` parameter. The indented-continuation exemption (`/^\s+\S/`) only fires when `inList === true` — i.e., we have already seen a list item above without an intervening blank line. Arbitrary indented prose (like `  Label:` before `- item`) no longer gets a free pass, so those pairs now produce findings that match what markdownlint reports in CI.

### Thread 8: tools/hygiene/check-md032-blanks-around-lists.ts:171 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:47:59Z):

P1: A failed `git diff` is converted into an empty file list, and the `--staged` path then exits 0 as if there were no staged markdown files. That masks real git failures (bad repo root, missing git, permission errors) and lets the pre-check pass without scanning anything.

**@AceHack** (2026-05-14T00:56:47Z):

Fixed: `stagedMarkdownFiles` now throws an `Error` when `git diff` exits non-zero instead of returning `[]`. `main()` wraps the call in try/catch and returns exit code 1, so a bad repo root, missing git binary, or permission error surfaces immediately rather than silently reporting a clean scan.

### Thread 9: tools/hygiene/check-md032-blanks-around-lists.ts:106 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:47:59Z):

P1: The fence-state scan starts at index 1, so an opening fence on the first line is never recorded. A markdown file that begins with a fenced code block containing a label/list example will be reported as an MD032 violation even though markdownlint ignores list-like content inside the fence.

**@AceHack** (2026-05-14T00:56:47Z):

Fixed: the main scan loop now starts at `i = 0` instead of `i = 1`. If the very first line of a file is a fenced-code open marker, `inFencedCode` is now toggled correctly, preventing list-like content inside that fence from being reported as violations.

### Thread 10: tools/hygiene/check-md032-blanks-around-lists.ts:140 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T00:48:00Z):

P1: Silently skipping unreadable explicit inputs can make the CLI report success without checking the file the caller asked for (for example, a typo in `bun ... missing.md` exits 0 with “no MD032 findings”). A pre-check should surface read errors or return a non-zero status so users do not get a false clean result.

**@AceHack** (2026-05-14T00:56:48Z):

Fixed: `checkFiles` gains an optional `surfaceReadErrors: boolean` parameter (default `false` for backward compatibility and `--staged` mode). `main()` passes `true` when explicit file paths are provided, so a typo or missing path now exits 1 with a clear error message rather than reporting zero findings.

### Thread 11: tools/hygiene/check-md032-blanks-around-lists.ts:113 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:48:59Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Track matching fence delimiters before leaving code blocks**

The fenced-code handling flips `inFencedCode` on every line that starts with ``` or ~~~, but it does not remember the opening delimiter type/length. That means an outer fence like ````...```` containing a literal ``` line (or a backtick fence containing `~~~`) will toggle out early and then incorrectly flag list lines that are still inside code as MD032 violations. In pre-push usage this can block valid Markdown docs that embed fence examples.

Useful? React with 👍 / 👎.

### Thread 12: tools/hygiene/check-md032-blanks-around-lists.ts:171 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:48:59Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Return failure when staged-file discovery errors**

If `git diff --name-only --cached` fails, the helper logs an error but returns an empty list, and `main()` then treats that as "no staged .md files" and exits 0. This silently bypasses the MD032 gate in exactly the situations where staged-file discovery is broken (for example, git invocation/environment issues), so the check can report success without actually scanning anything.

Useful? React with 👍 / 👎.

### Thread 13: tools/hygiene/check-md032-blanks-around-lists.ts:206 (resolved)

**@chatgpt-codex-connector** (2026-05-14T00:58:42Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Include renamed staged Markdown files in --staged scan**

Update the staged-file filter to include renames; `--diff-filter=AM` drops files with `R` status, so a staged `git mv old.md new.md` (with edits) is skipped by `--staged` even though markdownlint will still lint `new.md` in CI. I verified this behavior by checking `git diff --name-status --cached` (`R...`) versus `git diff --name-only --cached --diff-filter=AM` (empty), which means this gate can report success without scanning changed Markdown content.

Useful? React with 👍 / 👎.

### Thread 14: tools/hygiene/check-md032-blanks-around-lists.ts:146 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:05:44Z):

P1: The same `fenceInfo` parser is used for closers, but it accepts fence markers followed by an info string or other text. CommonMark closing fences may be followed only by spaces, so a line like an inner same-delimiter ` ```ts` example inside an outer fence is treated as closing here even though markdownlint would keep the code block open; subsequent list-like lines in the sample can be falsely reported as MD032 violations.

This issue also appears in the following locations of the same file:
- line 226
- line 234
- line 234

### Thread 15: tools/hygiene/check-md032-blanks-around-lists.ts:57 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:05:44Z):

P1: This current-state code surface adds reviewer-name attribution in comments, which conflicts with the repository convention that code uses role references and keeps named attribution on history surfaces only (see docs/AGENT-BEST-PRACTICES.md:671-737). Please replace these reviewer-name references with role-neutral wording or move the attribution to an allowed history surface.

### Thread 16: tools/hygiene/check-md032-blanks-around-lists.ts:245 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:05:44Z):

P2: New hygiene tools normally export their `main(...)` entrypoint while guarding `process.exit` behind `if (import.meta.main)` (for example, tools/hygiene/check-no-conflict-markers.ts:123-168 and tools/hygiene/check-tick-history-order.ts:94-165). Keeping this `main` private and coupled to `process.argv` makes the CLI branches harder to unit-test and diverges from the local tooling pattern.

### Thread 17: tools/hygiene/check-md032-blanks-around-lists.test.ts:152 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:05:45Z):

P1: This test name adds reviewer-name attribution on a current-state code surface. The repo convention keeps named attribution on the allowed history surfaces and uses role-neutral references in code/tests (docs/AGENT-BEST-PRACTICES.md:671-737), so this should avoid the reviewer name here as well.

### Thread 18: tools/hygiene/check-md032-blanks-around-lists.test.ts:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:05:45Z):

P2: The PR description still says the helper has 12 tests, but this file now contains 16 `findMd032Violations` cases plus the `checkFiles` case. Please update the PR summary/calibration text so reviewers and automation are not working from stale test-count information.

### Thread 19: tools/hygiene/check-md032-blanks-around-lists.ts:146 (resolved)

**@chatgpt-codex-connector** (2026-05-14T01:09:35Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Treat fenced closers as valid only with trailing whitespace**

`findMd032Violations` closes an open fence whenever a line starts with a matching run (`fence.len >= openFence.len`), but CommonMark closers are only valid when nothing except spaces/tabs follows the run. With the current check, a code-sample line like ```` ```md ```` (or `~~~yaml`) inside a fenced block is treated as a closer, so subsequent list-like lines in that block can be falsely reported as MD032 violations and block the pre-push gate.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-14T01:16:53Z):

Fix is already in the current code. The `fenceInfo()` helper returns `closer: /^\\s*$/.test(tail)` and the main scan loop only closes an open fence when `fence.closer === true`. A code-sample line like ` ```ts` (opening fence with info string) has a non-whitespace tail so `closer = false`, preventing premature close of the outer block. Thread is outdated because the fix landed in a prior commit. Resolving.

### Thread 20: tools/hygiene/check-md032-blanks-around-lists.ts:624 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:15:50Z):

P1: `--staged` scans every staged `.md` path, but the repository's markdownlint config excludes several markdown subtrees (for example `memory/**`, `docs/pr-preservation/**`, `docs/history/pr-reviews/**`, and date-prefixed `docs/research/**`). Once this helper is wired into a hook, edits in those intentionally ignored/verbatim areas can be rejected locally for MD032 even though `markdownlint-cli2` in CI would ignore them. The staged-file discovery should apply the same ignore set or delegate file selection to markdownlint-compatible filtering.

### Thread 21: tools/hygiene/check-md032-blanks-around-lists.ts:60 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:15:50Z):

P1: This only recognizes ordered-list markers that end in `.`, but CommonMark/markdownlint also treats `1)`-style markers as ordered lists. A file with `Label:` immediately followed by `1) item` will still fail MD032 in CI, while this helper reports no finding, leaving a false negative in the pre-check.

### Thread 22: tools/hygiene/check-md032-blanks-around-lists.ts:502 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:15:51Z):

P2: The newly added explicit-input read-error path is not covered by the test file: the only `checkFiles` test exercises the default silent-skip mode, while `main()` relies on `surfaceReadErrors = true` to turn a missing explicit file into exit 1. Add a test for `checkFiles([...], true)` or the exported `main()` path so this previously reported false-clean regression cannot return unnoticed.

### Thread 23: tools/hygiene/check-md032-blanks-around-lists.ts:263 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:15:51Z):

P2: The new non-zero-git failure behavior in `--staged` mode is not covered by tests. Because this was added to prevent a silent gate bypass, add coverage around the exported `main()` (or an injectable git-discovery seam) so a future change cannot turn `git diff` failures back into a clean zero-file scan.

### Thread 24: tools/hygiene/check-md032-blanks-around-lists.ts:426 (resolved)

**@chatgpt-codex-connector** (2026-05-14T01:17:58Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Skip YAML front matter while scanning for list starts**

The scanner now tracks fenced code, but it still has no state for YAML front matter, so list-like metadata lines (e.g., `tags:` followed by `- item`) are treated as MD032 violations even though markdownlint ignores front matter content. This creates false positives on valid docs and can block a pre-push gate for files whose only "violation" is metadata formatting.

Useful? React with 👍 / 👎.

### Thread 25: tools/hygiene/check-md032-blanks-around-lists.ts:624 (resolved)

**@chatgpt-codex-connector** (2026-05-14T01:17:58Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Honor markdownlint ignore globs in staged-file selection**

`--staged` currently scans every staged `*.md` path, but markdownlint in this repo excludes large path sets (for example `memory/**` and several archive directories) via `.markdownlint-cli2.jsonc`. Because this helper does not apply the same ignore surface, it can fail locally on files that CI intentionally does not lint, creating avoidable gate mismatches and false blocking behavior.

Useful? React with 👍 / 👎.

### Thread 26: tools/hygiene/check-md032-blanks-around-lists.ts:389 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:31:11Z):

P1: This resets `inList` on unindented lazy-continuation lines, but CommonMark allows list-item paragraph continuations to be unindented. A valid list like `- first line` / `continued text` / `- next item` will be flagged locally even though markdownlint treats the second bullet as part of the same list block, creating a false-positive pre-check.

### Thread 27: tools/hygiene/check-md032-blanks-around-lists.ts:66 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:31:11Z):

P1: CommonMark ordered-list markers are limited to 1–9 digits, but this regex accepts any number of digits. A prose line such as `1234567890. value` after a label is not an ordered-list item for markdownlint, yet this helper will report it as MD032.

### Thread 28: tools/hygiene/check-md032-blanks-around-lists.ts:251 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:31:12Z):

P1: Backtick fence openers with an info string containing another backtick are invalid CommonMark fences, but `fenceInfo` accepts them as openers. That can suppress real MD032 findings inside ordinary prose that markdownlint will not consider fenced code.

### Thread 29: tools/hygiene/check-md032-blanks-around-lists.ts:588 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:31:12Z):

P2: When `spawnSync` fails before producing stderr (for example, `git` is missing or cannot be launched), this reports only `unknown error` even though `r.error.message` carries the actionable cause. Including the launch error would make the `--staged` failure diagnosable.

### Thread 30: tools/hygiene/check-md032-blanks-around-lists.ts:66 (resolved)

**@chatgpt-codex-connector** (2026-05-14T01:36:56Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Recognize list markers in blockquote context**

`isListItemStart` only matches markers at the start of a line with optional spaces, so it never treats `> - item` or `> 1. item` as list starts. `markdownlint` MD032 *does* enforce blank lines for lists inside blockquotes, so `--staged` can report clean while CI still fails on blockquoted list violations (for example, `> Label:` followed by `> - item`).

Useful? React with 👍 / 👎.

### Thread 31: tools/hygiene/check-md032-blanks-around-lists.ts:66 (resolved)

**@chatgpt-codex-connector** (2026-05-14T01:36:56Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Restrict ordered-list marker width to CommonMark limits**

The ordered-list regex uses `\d+[.)]`, which treats 10+ digit prefixes as list markers. CommonMark/markdownlint only accept ordered markers with 1–9 digits, so prose like `1234567890) value` after a label can be falsely flagged by this helper even though MD032 would not fire in CI.

Useful? React with 👍 / 👎.

### Thread 32: tools/hygiene/check-md032-blanks-around-lists.ts:140 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:41:26Z):

P1: This rejects tilde-fence openers whose info string contains `~`, but CommonMark only applies the “info string must not contain the fence character” restriction to backtick fences. A valid tilde fence like `~~~text~bad` will be treated as ordinary prose here, so list-like content inside it can be reported locally even though markdownlint treats it as fenced code.

### Thread 33: tools/hygiene/check-md032-blanks-around-lists.ts:362 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:41:27Z):

P1: Resetting `inList` when a fence opens loses the surrounding list context. A fenced code block can be a child block inside a list item (for example `- item`, then an indented fence, then `- next`), and markdownlint does not require a blank before the sibling item; this reset makes the sibling item look like a new list after a non-blank fence closer and produces a false MD032 finding.

This issue also appears on line 209 of the same file.

### Thread 34: tools/hygiene/check-md032-blanks-around-lists.test.ts:336 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:41:27Z):

P1: This test locks in the incorrect tilde-fence behavior. CommonMark only forbids backticks in backtick-fence info strings; a tilde fence can have `~` in the info string, so this fixture should be treated as fenced content rather than as prose that triggers MD032.

### Thread 35: tools/hygiene/check-md032-blanks-around-lists.test.ts:1107 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:41:27Z):

The PR description still says this file ships 18 tests, but the current test file contains 39 `test(...)` cases. That stale count makes the review/acceptance trail inconsistent with the actual change set.

### Thread 36: tools/hygiene/check-md032-blanks-around-lists.test.ts:1073 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:49:31Z):

P1: This test uses `require` in an ES module without the repo's required `@typescript-eslint/no-require-imports` suppression. Other TypeScript tests import `spawnSync` at module scope, and existing `require` call sites carry an explicit suppression, so `bun run lint:typescript` will flag this line.

### Thread 37: tools/hygiene/check-md032-blanks-around-lists.test.ts:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:49:31Z):

P2: The PR description still says this file ships 18 tests, but the current test file defines 43 `test(...)` cases. Please update the PR summary so reviewers and release notes do not rely on stale validation coverage.

### Thread 38: tools/hygiene/check-md032-blanks-around-lists.ts:245 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:49:31Z):

P1: This rejects valid tilde-fence openers whose info string contains `~`. CommonMark's info-string restriction is about backticks after backtick fences; markdownlint will still treat `~~~lang~variant` as a fence, so this helper would scan the fenced content and report false MD032 findings.

### Thread 39: tools/hygiene/check-md032-blanks-around-lists.test.ts:795 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:49:32Z):

P1: This fixture locks in the same CommonMark mismatch: a tilde-fence info string containing `~` is still a valid fenced-code opener, so list-like content after it should remain inside the fence and should not produce an MD032 finding.

### Thread 40: tools/hygiene/check-md032-blanks-around-lists.ts:269 (resolved)

**@chatgpt-codex-connector** (2026-05-14T01:56:55Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Reset list state on non-paragraph block boundaries**

`inList` is left unchanged for every non-list/non-blank line, so block boundaries like headings or thematic breaks do not terminate the prior list. In a file such as `- item a` / `## Heading` / `- item b`, `markdownlint-cli2` reports MD032 for the second bullet, but this helper treats it as part of the existing list and skips the predecessor check, producing a false negative and allowing `--staged` to pass when CI lint will fail.

Useful? React with 👍 / 👎.

### Thread 41: tools/hygiene/check-md032-blanks-around-lists.ts:234 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:58:20Z):

P1: Fenced code detection does not allow blockquote prefixes, but CommonMark parses `> ```...`/`> ~~~...` as fenced code inside a blockquote. A blockquoted code sample that contains `> Label:` followed by `> - item` will be reported as MD032 even though markdownlint treats it as code and ignores it.

This issue also appears in the following locations of the same file:
- line 206
- line 265

### Thread 42: tools/hygiene/check-md032-blanks-around-lists.test.ts:295 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T01:58:20Z):

P1: This fixture locks in the false-negative for a flush-left fenced block between list items. A non-indented fence is not a lazy continuation of the list item, so treating the following bullet as clean diverges from markdownlint instead of preventing the CI failure.

### Thread 43: tools/hygiene/check-md032-blanks-around-lists.ts:500 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:08:06Z):

P1: In `--staged` mode this checks the working-tree copy of each staged path, not the staged blob. If a user stages a Markdown file and then edits it again before pushing, this gate can pass/fail on content different from what CI will lint. The staged path should either read from the index or reject dirty staged files before reporting a clean result.

### Thread 44: tools/hygiene/check-md032-blanks-around-lists.test.ts:668 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:17:15Z):

P1: These test `spawnSync("git", ...)` calls are under the repository-wide TypeScript ESLint config, and similar git invocations in `tools/**` carry a `sonarjs/no-os-command-from-path` suppression with rationale. Without either a small suppressed helper or per-call suppressions, `lint:typescript` will fail on this new test file.

### Thread 45: tools/hygiene/check-md032-blanks-around-lists.ts:77 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:17:16Z):

P1: A blockquote marker can be followed by additional spaces before the list marker (for example `>   - item`, which leaves a 2-space-indented list item inside the quote). This regex only allows zero or one whitespace character after each `>`, so those valid blockquoted lists are missed locally while markdownlint still applies MD032 to them.

### Thread 46: tools/hygiene/check-md032-blanks-around-lists.ts:89 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:17:16Z):

P1: Blockquoted blank lines may contain more than one space after the `>` marker (e.g. `>   `). This treats them as non-blank, so a correctly separated blockquoted list can be reported as MD032 even though markdownlint treats that line as the blank separator inside the quote.

### Thread 47: tools/hygiene/check-md032-blanks-around-lists.ts:236 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:17:16Z):

P1: Treating every blockquote-prefixed fence as preserving list context creates a false negative for top-level blockquotes after a list. In CommonMark, `- item` followed by a column-0 `> ```...` blockquote terminates the list; a subsequent `- item` starts a new list and needs a blank line, but this branch keeps `inList` true and skips the MD032 check.

### Thread 48: tools/hygiene/check-md032-blanks-around-lists.ts:527 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:17:16Z):

P1: `readStagedBlob` failures are git/index-read failures, not ordinary filesystem read errors, and silently skipping them lets `--staged` pass without scanning a staged Markdown path. If `git show :path` fails after `git diff --cached` listed the file, the hook should fail loudly so the local gate cannot diverge from CI.

### Thread 49: tools/hygiene/check-md032-blanks-around-lists.test.ts:986 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:17:17Z):

P2: The PR description says this file contains 45 tests, but the current test file contains 52 test cases after the staged-blob and round-12 additions. Please refresh the PR metadata so reviewers and release notes do not carry a stale coverage count.

### Thread 50: tools/hygiene/check-md032-blanks-around-lists.ts:309 (resolved)

**@chatgpt-codex-connector** (2026-05-14T02:21:36Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Reset list context on non-paragraph block boundaries**

`findMd032Violations` keeps `inList` true for every non-blank/non-heading/non-fence line, so constructs that actually terminate a list (for example a thematic break or blockquote) are treated as lazy paragraph continuation. That causes false negatives where a subsequent list start is not checked, e.g. `- a` / `---` / `- b` or `- a` / `> quote` / `- b` passes this helper while `markdownlint-cli2` reports MD032 for the later list item. This leaves the staged pre-check out of sync with CI and can let MD032 failures through.

Useful? React with 👍 / 👎.

### Thread 51: tools/hygiene/check-md032-blanks-around-lists.ts:373 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:29:27Z):

P1: The scanner only reports missing blanks before a list start, so it misses the other half of MD032: a list followed immediately by non-list prose or a heading without a blank line. For example, `- item\nNext paragraph` will pass this helper but markdownlint's blanks-around-lists rule fails it, so `--staged` can still green-light MD032 violations that CI rejects.

### Thread 52: tools/hygiene/check-md032-blanks-around-lists.ts:83 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:29:27Z):

P1: This allows unlimited spaces after a blockquote marker before treating the following `-`/`1.` as a list marker. After the optional blockquote marker space is stripped, CommonMark still caps list-marker indentation at 0–3 spaces; `>     - item` is indented code inside the quote, not a list. The current regex will report MD032 false positives for those code-block lines while markdownlint will not.

This issue also appears on line 169 of the same file.

### Thread 53: tools/hygiene/check-md032-blanks-around-lists.test.ts:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:29:28Z):

P2: The PR description still says this file has 45 tests, but the current test file contains 56 `test(...)` cases. This stale count makes the review trail/coverage matrix inconsistent with the actual diff and should be refreshed before merge.

### Thread 54: tools/hygiene/check-md032-blanks-around-lists.ts:579 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:29:28Z):

P2: `--staged` discovers the staged markdown paths here, then `checkStagedFiles(repoRoot)` immediately runs `stagedMarkdownFiles(repoRoot)` again. Besides the extra git/config work, the reported `fileCount` can diverge from the scanned set if the index changes between the two calls; pass the discovered paths through or have `checkStagedFiles` return both paths and findings from one snapshot.

### Thread 55: tools/hygiene/check-md032-blanks-around-lists.test.ts:555 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:29:28Z):

P1: This assertion locks in a false negative for MD032's “blank after list” side. A list followed immediately by a heading is still a list not surrounded by blank lines, so markdownlint can fail this fixture on line 2 even though the helper only reports the later `- item b` case.

### Thread 56: tools/hygiene/check-md032-blanks-around-lists.ts:199 (resolved)

**@chatgpt-codex-connector** (2026-05-14T02:33:03Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Parse blockquoted fences with extra content indentation**

Update `fenceInfo` to recognize fenced code lines after a blockquote marker when the quoted content is indented (for example `>  ````). CommonMark allows a `>` marker plus optional following space and then up to three spaces of content indentation, so these lines still open/close fences. With the current `(?:>\s?)*(` regex, such fences are missed, the scanner treats inner `>  - item` lines as real list items, and it can report MD032 findings that markdownlint itself does not report.

Useful? React with 👍 / 👎.

### Thread 57: tools/hygiene/check-md032-blanks-around-lists.ts:140 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:43:20Z):

P1: This thematic-break detector does not account for blockquote prefixes, so a blockquoted thematic break such as `> ---` is treated as ordinary continuation text. In a blockquoted list sequence (`> - a`, `> ---`, `> - b`), this leaves `inList` as `"block"` and suppresses the MD032 finding that markdownlint reports when the thematic break terminates the list.

### Thread 58: tools/hygiene/check-md032-blanks-around-lists.ts:233 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:43:20Z):

P1: `fenceInfo` only permits zero or one space after each blockquote marker before the fence. CommonMark still allows an indented fenced block inside a blockquote (for example `>   ````, with the extra spaces as inner indentation), so this helper will miss that valid fence and can flag list-like content inside it even though markdownlint treats it as fenced code.

### Thread 59: tools/hygiene/check-md032-blanks-around-lists.ts:94 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:43:20Z):

P1: The list-start regex requires whitespace after the marker, so empty list items written as a bare marker (`-`, `+`, `*`, `1.`, or `1)`) are not recognized as lists. Markdown/CommonMark parse those as list items, so a label directly followed by an empty item can still fail MD032 in markdownlint while this pre-check exits clean.

### Thread 60: tools/hygiene/check-md032-blanks-around-lists.ts:125 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:43:20Z):

P1: Empty ATX headings are valid Markdown headings (`#` through `######` followed by end-of-line), but this regex only recognizes headings that have trailing whitespace and content. A list immediately followed by an empty heading therefore stays in list-continuation state and misses the blank-after-list MD032 violation that markdownlint reports.

### Thread 61: tools/hygiene/check-md032-blanks-around-lists.ts:432 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:43:21Z):

This docstring is stale: `--staged` no longer uses `checkFiles` or silently skips unreadable files after the staged-blob path was moved through `checkStagedFiles`/`readStagedBlob`. Keeping the old staged-mode rationale here makes the error-handling contract look different from the implementation.

This issue also appears on line 448 of the same file.

### Thread 62: tools/hygiene/check-md032-blanks-around-lists.ts:427 (resolved)

**@chatgpt-codex-connector** (2026-05-14T02:44:12Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Skip HTML comment regions before MD032 scanning**

The line scanner applies list-boundary checks to every non-fence line, so list-like text inside HTML comments (including `markdownlint-disable`/`markdownlint-enable` blocks) is treated as real Markdown content. `markdownlint` ignores comment content for MD032, so this creates local false positives and can block `--staged` even when CI lint passes. A minimal reproduction is a commented example like `<!--\nLabel:\n- item\n-->`, which this branch will flag at the list line.

Useful? React with 👍 / 👎.

### Thread 63: tools/hygiene/check-md032-blanks-around-lists.ts:325 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T02:54:45Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Preserve Markdown tokens on lines with inline HTML comments**

Treating any line containing `<!--` as entirely comment content causes false negatives for real MD032 cases when list syntax shares that line with an inline comment. For example, `Label:\n- item <!-- note -->` and `- item <!-- note -->\n## Heading` both trigger MD032 in `markdownlint-cli2`, but this scanner skips the list line and never enters list state, so `--staged` can pass while CI fails. The parser should only ignore the comment span itself (or only full-line comment blocks), not discard the whole line unconditionally.

Useful? React with 👍 / 👎.

### Thread 64: tools/hygiene/check-md032-blanks-around-lists.ts:415 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:54:45Z):

P1: This branch runs before `isThematicBreak`, so spaced thematic breaks such as `- - -` or `* * *` are classified as ordinary list items. CommonMark/markdownlint treat those as thematic breaks, which means a list followed by `- - -` and then another list will pass this helper while MD032 can still fail in CI on both sides of the break.

### Thread 65: tools/hygiene/check-md032-blanks-around-lists.ts:325 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:54:46Z):

P1: HTML-comment detection runs before the fenced-code state, so a literal `<!--` inside a code fence opens `inHtmlComment` and can prevent the fence closer and all following real Markdown from being scanned. A fenced example containing an unclosed HTML comment would make a later `Label:`/list pair pass locally even though markdownlint sees it after the fence and reports MD032.

### Thread 66: tools/hygiene/check-md032-blanks-around-lists.test.ts:282 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:54:46Z):

The PR description still says this file contains 66 tests, but the current file has 74 `test(...)` definitions. Update the PR body/test-count trail so reviewers are not reconciling stale coverage numbers.

### Thread 67: tools/hygiene/check-md032-blanks-around-lists.ts:46 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:54:46Z):

These field comments are stale now that the scanner reports the “blank after list” side too: several findings point at a heading, thematic break, fence, or blockquote line rather than the line where a list starts, and `context` is not always a list line.

### Thread 68: tools/hygiene/check-md032-blanks-around-lists.test.ts:957 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:54:47Z):

This comment is stale: `--staged` no longer uses `checkFiles` (it routes through `checkStagedFiles`/`git show` and fails loudly on blob-read errors), so the default silent-skip mode is not for staged mode anymore.

### Thread 69: tools/hygiene/check-md032-blanks-around-lists.ts:197 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T02:54:47Z):

The `inList` continuation branch is currently unreachable because the only call site passes `false`. Either remove this parameter/branch or pass the actual state if the helper is meant to model indented continuations; as written it preserves stale logic from an earlier state-machine shape.

## General comments

### @chatgpt-codex-connector (2026-05-14T01:44:47Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-14T02:22:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-14T02:28:25Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-14T02:30:37Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-14T02:41:54Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
