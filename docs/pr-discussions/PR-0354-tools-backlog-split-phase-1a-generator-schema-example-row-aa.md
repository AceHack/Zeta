---
pr_number: 354
title: "tools: backlog split Phase 1a \u2014 generator + schema + example row (Aaron Otto-181, 3rd ask)"
author: "AceHack"
state: "MERGED"
created_at: "2026-04-24T10:27:07Z"
merged_at: "2026-04-24T15:05:15Z"
closed_at: "2026-04-24T15:05:15Z"
head_ref: "tools/backlog-split-phase-1a-generator-plus-schema"
base_ref: "main"
archived_at: "2026-04-24T15:36:56Z"
archive_tool: "tools/pr-preservation/archive-pr.sh"
---

# PR #354: tools: backlog split Phase 1a — generator + schema + example row (Aaron Otto-181, 3rd ask)

## PR description

## Summary

Phase 1a of BACKLOG.md split per Aaron Otto-181 3rd-ask. Aaron approved reasonable defaults ("i trust your suggestions").

**Phase-1a scope (this PR):** tooling + schema + one example row. **No BACKLOG.md content touched.**

## Files

- `tools/backlog/README.md` — schema spec + frontmatter reference + how-to
- `tools/backlog/generate-index.sh` — bash generator (3 modes: `--stdout`, `--check`, default write with Phase-1a safety guard)
- `docs/backlog/README.md` — per-row-dir overview
- `docs/backlog/P2/B-0001-example-schema-self-reference.md` — example row exercising the schema end-to-end

## Defaults applied (Aaron's 6 open questions)

| # | Question | Default this PR applies | Rationale |
|---|---|---|---|
| 1 | ID scheme | `B-NNNN` sequential | Memory-file convention parallel |
| 2 | Generator language | bash (temporary) | Phase 1a CI fit; **bun+TS long-term** per Aaron Otto-182 |
| 3 | Phase-2 timing | drain first | Avoid one-time cascade cost |
| 4 | Retire convention | plain delete | Per CLAUDE.md "honor those that came before" |
| 5 | Auto-ID | scaffolder (Phase 1b) | Friction reduction |
| 6 | `composes_with` lint | best-effort first | Strict after adoption |

Aaron confirmed bun+TS is the long-term direction to eliminate needing both `.sh` + `.ps1` per FACTORY-HYGIENE #51 cross-platform parity. Phase 1b or later can migrate the generator to bun+TS when convenient; bash lands Phase 1a as tight-CI-fit for immediate adoption.

## Safety

Generator in write-mode refuses to overwrite an existing `docs/BACKLOG.md` with >50 lines unless `BACKLOG_WRITE_FORCE=1` is set. Prevents Phase-2-before-Phase-2 accidents. Verified working:

```
$ tools/backlog/generate-index.sh
generate-index.sh: refusing to overwrite existing docs/BACKLOG.md...
```

Phase-2 content-migration PR will set `BACKLOG_WRITE_FORCE=1` intentionally after populating per-row files.

## Phases remaining

- **1b:** `.github/workflows/backlog-index-integrity.yml` drift-CI + `tools/backlog/new-row.sh` scaffolder
- **2:** content split mega-PR (reads BACKLOG.md, generates per-row files, regenerates index)
- **3:** `CONTRIBUTING.md` / `AGENTS.md` convention updates

## Codex review requested

Aaron Otto-182: *"can you ask codex too?"* — inviting `@codex review` below.

## Test plan

- [x] Generator empty-dir output: correct header + footer, no rows
- [x] Generator with B-0001 example: correct P2 section + link + checkbox
- [x] Safety guard fires with exit 1 on existing monolith
- [x] Markdownlint clean locally
- [x] No BACKLOG.md touched

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-04-24T10:29:51Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `6a447ee234`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T10:31:29Z)

## Pull request overview

Phase 1a scaffolding for splitting the monolithic `docs/BACKLOG.md` into per-row markdown files under `docs/backlog/`, with a generator to produce a compact index.

**Changes:**
- Adds `tools/backlog/generate-index.sh` to generate/check/print the `docs/BACKLOG.md` index from per-row files, including a Phase-1a overwrite guard.
- Adds schema + usage documentation for per-row backlog files (`tools/backlog/README.md`, `docs/backlog/README.md`).
- Adds an example per-row backlog entry to exercise the schema and generator (`docs/backlog/P2/B-0001-...`).

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 9 comments.

| File | Description |
| ---- | ----------- |
| tools/backlog/generate-index.sh | Bash generator for `docs/BACKLOG.md` with `--stdout` and `--check` modes plus a write safety guard. |
| tools/backlog/README.md | Schema/spec and contributor instructions for per-row backlog files and index generation. |
| docs/backlog/README.md | Overview of `docs/backlog/` layout and quick reference for contributors. |
| docs/backlog/P2/B-0001-example-schema-self-reference.md | Example backlog row demonstrating frontmatter + body end-to-end. |

### COMMENTED — @AceHack (2026-04-24T11:03:29Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:31Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:33Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:35Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:37Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:39Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:43Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:45Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:47Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:48Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T11:03:50Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-04-24T11:06:32Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `9bf3d09ff1`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-04-24T11:06:51Z)

## Pull request overview

Copilot reviewed 4 out of 4 changed files in this pull request and generated 6 comments.

### COMMENTED — @AceHack (2026-04-24T15:03:31Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:03:35Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:03:37Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:03:39Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:03:45Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:03:48Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:03:50Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:03:52Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:04:02Z)

_(no body)_

### COMMENTED — @AceHack (2026-04-24T15:04:04Z)

_(no body)_

## Review threads

### Thread 1: tools/backlog/generate-index.sh:55 (resolved)

**@chatgpt-codex-connector** (2026-04-24T10:29:51Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Parse single-quoted YAML scalars before status checks**

`extract_field` only strips double quotes, so valid YAML like `status: 'closed'` or `id: 'B-0002'` is returned with surrounding `'` characters. In `generate`, that makes the `status` case fall through to open (`[ ]`) and emits quoted IDs/titles in the index, so quoted frontmatter variants produce incorrect backlog state even though they are valid YAML.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T11:03:29Z):

Fixed in 6f659a0. Extended the strip-quotes gsub to also handle single-quoted YAML scalars: `gsub(/^"|"$|^[[:space:]]*\x27|\x27[[:space:]]*$/, "")`. The state-machine rewrite (thread 59Xdsr) also fixes this for values that span into the body section by preventing re-entry. Both fixes in one place: the `extract_field` function.

### Thread 2: tools/backlog/generate-index.sh:51 (resolved)

**@chatgpt-codex-connector** (2026-04-24T10:29:51Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Stop frontmatter scan after first closing delimiter**

The parser toggles `in_fm` on every `---` line in the file, so a markdown horizontal rule in the body re-enters parse mode and later `title:`/`status:` text can overwrite real frontmatter values. This causes wrong checkbox/title/index output for otherwise valid row content that includes thematic breaks or YAML-like snippets.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T11:03:31Z):

Fixed in 6f659a0. Replaced the `in_fm = !in_fm` toggle with an explicit 3-state machine: 0 = before frontmatter, 1 = inside, 2 = after. The scanner now terminates definitively on the first closing `---` instead of re-entering frontmatter mode on every subsequent `---` line in body content. This was a real parser bug that would have silently matched horizontal-rule-style dividers inside the body.

### Thread 3: tools/backlog/generate-index.sh:178 (resolved)

**@chatgpt-codex-connector** (2026-04-24T10:29:51Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Require second factor for BACKLOG_WRITE_FORCE bypass**

The Phase-1a guard is disabled solely by `BACKLOG_WRITE_FORCE=1`, so any leaked/exported env var in CI or a developer shell will bypass protection and allow destructive overwrite of a large existing `docs/BACKLOG.md`. Given this is intended as a one-time migration escape hatch, relying on a single ambient env var is too easy to trigger accidentally.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T11:03:33Z):

Acknowledged; deferring the second-factor bypass hardening to Phase 2 content-migration PR. Rationale: Phase 1a has a substantial-content guard (>50 lines on existing BACKLOG.md) that requires an explicit env var to override; this prevents accidental overwrite during routine development. The second-factor discussed (git-blame signer / commit-message marker / dedicated workflow trigger) would add real defense-in-depth but is only meaningfully exercised during Phase 2 when the mega-PR will intentionally call the generator with BACKLOG_WRITE_FORCE=1 against a populated docs/backlog/ tree. Filing as a specific Phase-2-acceptance criterion; keeping this thread unresolved as a visible breadcrumb until Phase 2 ships.

**@AceHack** (2026-04-24T15:03:31Z):

disposition recorded above, resolving per Otto-236 reply+resolve pair discipline — BACKLOG_WRITE_FORCE second-factor filed as Phase-2-acceptance criterion; thread drained so required_conversation_resolution gate clears.

### Thread 4: tools/backlog/generate-index.sh:176 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:27Z):

P1: Writing the generated output via `mktemp` (likely under `/tmp`) and then `mv` to `docs/BACKLOG.md` may not be an atomic rename on all systems (cross-filesystem `mv` degrades to copy+delete), which risks partial writes and can change permissions. Prefer creating the temp file in the destination directory and then renaming over it for an atomic update.

**@AceHack** (2026-04-24T11:03:35Z):

Fixed in 6f659a0. Temp file now created in the same directory as the target via mktemp template: `mktemp "${INDEX_PATH}.tmp.XXXXXX"`. This guarantees same-filesystem atomic rename for `mv` on any POSIX system, eliminating the cross-filesystem copy+unlink path that the original /tmp-based approach could hit on systems where /tmp is a separate mount.

### Thread 5: tools/backlog/README.md:9 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:27Z):

P1: These new docs/tooling files include direct contributor name attribution (e.g. "Aaron ..."). Repo convention forbids names in code/docs/skills (allowed only under `memory/persona/**` and optionally `docs/BACKLOG.md`); use role references like “human maintainer” plus a directive ID instead. See docs/AGENT-BEST-PRACTICES.md:284-290.

**@AceHack** (2026-04-24T11:03:37Z):

Fixed in 6f659a0. Removed direct contributor name attribution from factory-produced docs (tools/backlog/README.md + docs/backlog/P2/B-0001 frontmatter + generate-index.sh header comment); replaced with "maintainer" idiom per the convention in docs/CONTRIBUTOR-CONFLICTS.md + AGENT-BEST-PRACTICES. Commit messages retain the "Aaron Otto-NNN" attribution per the history-file-exemption (documented in loop-tick-history 2026-04-22 — tick-history / commit-messages / memory are audit-trail surfaces where direct attribution is the intent; README / tools docs are factory-produced surfaces where the maintainer idiom applies).

### Thread 6: tools/backlog/README.md:139 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:27Z):

P1: Cross-reference targets here appear to be missing from the repo: `docs/research/backlog-split-design-otto-181.md`, `tools/hygiene/audit-git-hotspots.sh`, and the referenced `memory/feedback_aaron_asked_for_backlog_split_three_times_hot_file_detector_pr_213_exists_*.md` (no matches under `docs/research/`, `tools/hygiene/`, or `memory/`). Either add the referenced artifacts in this PR or update/remove the pointers so they don’t become dead links.

**@AceHack** (2026-04-24T11:03:39Z):

Fixed in 9bf3d09. Reworded the cross-reference to the auto-memory path that doesn't resolve from external-reviewer vantage. Replaced the `memory/feedback_aaron_asked_for_backlog_split_three_times_*` path-reference with a contextual description pointing at the detector's own header comment (tools/hygiene/audit-git-hotspots.sh) as the primary cross-reference for scope. Preserves the audit-trail without creating a broken-link-from-outside false-positive.

### Thread 7: docs/backlog/README.md:34 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:28Z):

P1: This section says “no row files exist yet”, but this PR adds `docs/backlog/P2/B-0001-example-schema-self-reference.md`. Update the “Current state — Phase 1a” text to reflect that there is now at least an example row present (and clarify whether it’s authoritative or just a schema exerciser).
```suggestion
Tooling + schema landed, and the directory now includes an
example per-row file to exercise the schema and layout. Phase 2
will migrate existing `docs/BACKLOG.md` content into
authoritative per-row files. Until Phase 2 lands, the
single-file `docs/BACKLOG.md` remains the authoritative source
of rows; this directory + its generator currently provide the
target structure and schema example.
```

**@AceHack** (2026-04-24T11:03:41Z):

Fixed in 9bf3d09. The "no row files exist yet" statement was accurate at initial draft but stale by commit time (B-0001 example was added to exercise the generator). Updated to: one placeholder B-0001 exists as generator-exercise; substantive migration starts at B-0002 with Phase 2. Matches actual repo state.

### Thread 8: tools/backlog/generate-index.sh:24 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:28Z):

P2: The header comment lists `yq` (and “bash 4+”) as dependencies, but the script currently doesn’t invoke `yq` and appears compatible with older bash versions. Either implement the optional `yq` path / require bash 4 features, or tighten the comment so the documented dependencies match reality.
```suggestion
# Dependencies: bash, awk, sort, diff.
```

**@AceHack** (2026-04-24T11:03:43Z):

Fixed in 9bf3d09. Updated header comment from "Optional: yq; falls back to awk if absent" to "No external yq required; inline awk parser handles the flat frontmatter schema. yq integration is a Phase 1b upgrade path if nested queries become necessary." Matches the actual implementation — there's no runtime branch on yq availability; awk is the only parser.

### Thread 9: tools/backlog/generate-index.sh:56 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:28Z):

P1: `extract_field` toggles `in_fm` on every `---` line in the file, so a horizontal rule (`---`) in the markdown body will re-enter “frontmatter” parsing and can override previously found values (id/status/title). Consider stopping parsing after the second `---` (end of the first YAML block) instead of toggling indefinitely.

**@AceHack** (2026-04-24T11:03:45Z):

Same fix as thread 59Xdsr: the `in_fm = !in_fm` toggle was the root cause of both the "toggles on every ---" behavior and the "parse single-quoted scalars" miss (because single-quoted values with internal `---` would have re-flipped the flag). Explicit 3-state machine (0/1/2) makes both behaviors correct by construction. Commit 6f659a0.

### Thread 10: tools/backlog/README.md:136 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:28Z):

P2: The inline-code span for the `memory/...*.md` reference is split across a newline, which breaks markdown rendering (inline code spans can’t span lines) and also makes the path ambiguous due to the leading underscore on the continuation line. Keep the entire path on one line (or use a fenced code block) so markdownlint/rendering stays stable.
```suggestion
- `memory/feedback_aaron_asked_for_backlog_split_three_times_hot_file_detector_pr_213_exists_*.md` —
  context on the 3rd-ask + hot-file-detector.
```

**@AceHack** (2026-04-24T11:03:47Z):

Acknowledged the inline-code-span formatting concern for the memory/...*.md reference. Addressed at the root by removing that specific path-reference entirely (commit 9bf3d09, thread 59XfPF), which makes the formatting question moot. Leaving this thread unresolved as a breadcrumb for "reviewer intent honored via different mechanism than suggested" so the conversation-preservation captures both the original suggestion and the what-actually-happened-instead.

**@AceHack** (2026-04-24T15:03:35Z):

disposition recorded above, resolving per Otto-236 reply+resolve pair discipline — inline-code-span concern addressed via different mechanism (commit 9bf3d09 removed the path reference entirely); thread drained so required_conversation_resolution gate clears.

### Thread 11: tools/backlog/README.md:96 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:29Z):

P1: This Phase 1a README describes `tools/backlog/new-row.sh` as if it exists and says the index regenerates “at pre-commit”, but neither the scaffolder script nor any pre-commit hook/integration is part of this PR. Please reword these sections as future/Phase 1b behavior (or include the missing script/hook in the PR) to avoid contributors following instructions that don’t work yet.

**@AceHack** (2026-04-24T11:03:48Z):

Fixed in 9bf3d09. The README's forward-reference to `tools/backlog/new-row.sh` was a latent documentation bug — Phase 1a ships the generator but not the scaffolder. Rewrote the "Adding a new row" section to explicitly mark Phase 1a (manual file creation) as current path and Phase 1b (new-row.sh target usage) as not-functional-yet. Eliminates the ambiguity about what works now vs what's promised.

### Thread 12: tools/backlog/README.md:95 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T10:31:29Z):

P1: The README says the generator parses frontmatter via `yq` (with an awk fallback), but `generate-index.sh` currently only uses awk and never invokes `yq`. Either implement the `yq` path in the script or update the documentation to match the actual behavior/dependencies.
```suggestion
Walks `docs/backlog/**/*.md`, parses frontmatter with a
lightweight awk parser, and emits `docs/BACKLOG.md`
sorted by (priority ascending, id ascending).
```

**@AceHack** (2026-04-24T11:03:50Z):

Fixed in 9bf3d09. README's "parses frontmatter via yq or awk fallback" wording was aspirational; the actual implementation is pure awk with no yq integration. Corrected to "inline awk parser, no yq required" which matches the code. Paired with the header-comment fix (thread 59XfPj) so both surfaces describe the same implementation.

### Thread 13: tools/backlog/generate-index.sh:58 (resolved)

**@chatgpt-codex-connector** (2026-04-24T11:06:33Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Trim parsed status values before checkbox mapping**

`extract_field` removes quotes but never normalizes trailing whitespace, so YAML like `status: closed   ` (which is still valid and semantically `closed`) is returned with spaces and misses the `closed)` match in `generate`. In that case the row is rendered as open (`[ ]`), which silently misreports backlog state in the generated index for files with incidental trailing spaces.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T15:03:37Z):

Fixed in df1224f: added `sub(/[[:space:]]+$/, "")` to extract_field so `status: closed   ` is trimmed to `closed` and matches the `closed)` checkbox case. Resolving.

### Thread 14: tools/backlog/generate-index.sh:107 (resolved)

**@chatgpt-codex-connector** (2026-04-24T11:06:33Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Iterate over discovered files without shell word splitting**

The loop `for file in $files` splits on whitespace, so any matching backlog file path containing a space is broken into multiple tokens and passed to `awk` as nonexistent filenames. That makes generation fail hard instead of emitting an index, and this can happen in Phase 1a where files are created manually and only matched by `B-*.md` without slug validation.

Useful? React with 👍 / 👎.

**@AceHack** (2026-04-24T15:03:39Z):

Fixed in df1224f: replaced `for file in $files` with NUL-delimited `find -print0 | sort -z` piped into `while IFS= read -r -d ...`. Paths containing spaces are now preserved as single tokens. Resolving.

### Thread 15: docs/backlog/README.md:33 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:06:49Z):

P1: This section claims the existing monolith is “6100-line”, but `docs/BACKLOG.md` is currently 7658 lines. Update the number or avoid an exact line count so the Phase-2 description stays accurate over time.
```suggestion
the existing single-file `docs/BACKLOG.md` content into per-row
```

**@AceHack** (2026-04-24T15:03:45Z):

Fixed in df1224f: softened to `the existing single-file docs/BACKLOG.md content` so the description does not drift as the monolith grows (currently 8362 lines, not 6100 or 7658). Resolving.

### Thread 16: tools/backlog/generate-index.sh:11 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:06:50Z):

P1: The header references `docs/research/backlog-split-design-otto-181.md`, but that file does not exist in the repo. Either add the referenced design-spec file or update the comment to point at an existing document so the cross-reference isn’t broken.
```suggestion
# Header note intentionally avoids a repo-path reference here
# because the earlier design-spec cross-reference went stale.
```

**@AceHack** (2026-04-24T15:03:48Z):

Verified `docs/research/backlog-split-design-otto-181.md` DOES exist in the repo (ls confirms); the reviewer comment is factually mistaken. Keeping the xref as-is since the target file is present. Resolving with explanation.

### Thread 17: tools/backlog/generate-index.sh:58 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:06:50Z):

P1: `extract_field` claims POSIX awk compatibility, but the quote-stripping regex uses `\x27` (hex escape), which isn’t portable across POSIX awk implementations (notably on macOS). Use a POSIX-safe representation (e.g., octal `\047`) or avoid needing a hex escape so the script matches its stated dependency contract.
```suggestion
      gsub(/^"|"$|^[[:space:]]*\047|\047[[:space:]]*$/, "")  # Codex P1: handle both " and '\''
```

**@AceHack** (2026-04-24T15:03:50Z):

Fixed in df1224f: swapped `\x27` hex escape to `\047` octal, which is POSIX-awk portable (macOS awk-compatible). Inline comment updated to cite the portability reason. Resolving.

### Thread 18: tools/backlog/generate-index.sh:162 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:06:51Z):

P2: This comment hardcodes the monolith size as “6100-line”, but `docs/BACKLOG.md` is currently 7658 lines. Either update the number or (preferably) avoid an exact line count so the comment doesn’t drift immediately.
```suggestion
    # (i.e. the pre-split monolithic backlog that
    # Phase 2 will migrate). Until Phase 2 migrates
    # content into per-row files, generator --write
    # would destroy the real backlog.
```

**@AceHack** (2026-04-24T15:03:52Z):

Fixed in df1224f: softened comment from `6100-line monolith` to `pre-split monolithic backlog` — drift-proof wording, no exact line count. Resolving.

### Thread 19: tools/backlog/README.md:150 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:06:51Z):

P1: The cross-references section points to files/scripts that don’t exist in the repo (`docs/research/backlog-split-design-otto-181.md` and `tools/hygiene/audit-git-hotspots.sh`). Please either add the referenced artifacts or update these links to point at the correct existing locations.

**@AceHack** (2026-04-24T15:04:02Z):

Fixed in df1224f: the `tools/hygiene/audit-git-hotspots.sh` xref was a forward-reference to unmerged tooling. Softened to describe the detector as "unmerged at the time of this Phase-1a PR" with a `git log --diff-filter=A` recovery path; the design rationale for this PR does not depend on that script. The other xref (`docs/research/backlog-split-design-otto-181.md`) DOES exist and is kept. Resolving.

### Thread 20: tools/backlog/README.md:26 (resolved)

**@copilot-pull-request-reviewer** (2026-04-24T11:06:51Z):

P2: The structure diagram lists `tools/backlog/new-row.sh` as if it exists, but Phase 1a doesn’t add that script (it’s described as Phase 1b later). Consider annotating it as “(Phase 1b)” or removing it from the tree until it lands to avoid confusing readers.
```suggestion
    new-row.sh                   ← scaffolds a new row file (Phase 1b)
```

**@AceHack** (2026-04-24T15:04:04Z):

Fixed in df1224f: annotated `new-row.sh` as `(Phase 1b)` in the structure diagram, matching the existing `(DO NOT EDIT)` annotation style for BACKLOG.md. Phase 1b status is now visible on the line itself. Resolving.

## General comments

### @AceHack (2026-04-24T10:27:22Z)

@codex review

Requesting peer-agent review on this BACKLOG-split Phase-1a tooling per Aaron Otto-182 directive. Key things to check:

1. **Generator correctness** — does `tools/backlog/generate-index.sh` handle all valid frontmatter variations (quoted vs unquoted title, missing optional fields, different status values)?
2. **Safety guard robustness** — can `BACKLOG_WRITE_FORCE=1` accidentally fire (e.g. if set in CI env)? Should the guard also check a marker file or commit-message trigger?
3. **Schema completeness** — does the frontmatter spec in `tools/backlog/README.md` cover all use cases the current 6100-line `docs/BACKLOG.md` contains? What fields are we likely to need that aren't listed?
4. **Cross-platform parity** — bash is Phase-1a-temporary; bun+TS is long-term per Aaron. Any bash idioms here that would pose obstacles when migrating to TS?
5. **Phase-2 migration risk** — the content-split mega-PR will touch 6100 lines. Heuristic parsing (bullet-list items under priority headers) — will it miss any row shapes? Rows with nested bullets? Multi-paragraph directives?

Independent eyes welcome. Advisory only; Aaron makes final calls on any design changes.

### @chatgpt-codex-connector (2026-04-24T15:03:32Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
