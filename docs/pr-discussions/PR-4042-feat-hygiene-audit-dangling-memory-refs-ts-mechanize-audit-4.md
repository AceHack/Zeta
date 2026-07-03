---
pr_number: 4042
title: "feat(hygiene): audit-dangling-memory-refs.ts \u2014 mechanize audit #4031/#4041"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T04:42:37Z"
merged_at: "2026-05-17T05:36:09Z"
closed_at: "2026-05-17T05:36:09Z"
head_ref: "otto/audit-dangling-memory-refs-tool-2026-05-17"
base_ref: "main"
archived_at: "2026-05-17T07:02:57Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4042: feat(hygiene): audit-dangling-memory-refs.ts — mechanize audit #4031/#4041

## PR description

## Summary

Implements the substrate-engineer-candidate tool the [PR #4041](https://github.com/Lucent-Financial-Group/Zeta/pull/4041) audit memo explicitly named:

> A `tools/hygiene/audit-dangling-memory-refs.ts` script + CI integration would mechanize the discipline.

Scans 6 default substrate surfaces (`.claude/agents`, `.claude/skills`, `.claude/rules`, `docs/research`, `docs/backlog`, `memory/persona`) for `memory/feedback_*.md` citations and reports which are dangling (not present in-repo).

## Modes

- Default: human report (markdown-table-friendly)
- `--json`: machine-readable output for CI
- `--surfaces <paths>`: restrict scan to specific subtrees

## Exit codes

- `0` — no dangling refs found
- `1` — one or more dangling refs found (CI-integratable as non-required check first per [081KRSKQ20008QG0R0019RXMSD](docs/backlog/P3/081KRSKQ20008QG0R0019RXMSD-wire-shard-schema-validator-to-ci-2026-05-17.md) pattern)
- `2` — configuration error (no surfaces exist)

## Live results today (2026-05-17, origin/main)

```text
TOTAL: 49 dangling edges / 32 unique dangling refs across 6 surfaces (1654 files scanned)
```

Audit memo's claim of 29 unique was edge-deduped at filename scope; this tool's 32 reflects current state (3 more landed since the audit, or methodology delta — multi-citation-site tracking enabled).

## Tests

9 pass / 21 assertions cover:

- `findEdgesInFile` — regex extraction over markdown
- `isDangling` — file existence check
- `auditSurface` — clean state + nonexistent surface
- `runAudit` — aggregation invariants (surfaces summed match totals)

Tests use tmpdir fixtures for unit-level cases + the real tree for the `.claude/agents` clean-state ratchet (audit memo asserts 0 dangling there).

## Composes with

- [`memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md`](memory/feedback_otto_cli_audit_in_repo_rules_cite_user_scope_only_memory_files_5_dangling_refs_cold_boot_invisible_2026_05_17.md) (PR #4031 original audit)
- [`memory/feedback_otto_cli_audit_extension_29_dangling_memory_refs_across_4_surfaces_systemic_pattern_2026_05_17.md`](memory/feedback_otto_cli_audit_extension_29_dangling_memory_refs_across_4_surfaces_systemic_pattern_2026_05_17.md) (PR #4041 extension)
- [081KRSKQ20008QG0R0019RXMSD](docs/backlog/P3/081KRSKQ20008QG0R0019RXMSD-wire-shard-schema-validator-to-ci-2026-05-17.md) (validator-to-CI wiring precedent)
- [`.claude/rules/rule-0-no-sh-files.md`](.claude/rules/rule-0-no-sh-files.md) (TS not bash)

## Follow-up (not in this PR)

- Wire as non-required check in `gate.yml` (mirrors 081KRSKQ20008QG0R0019RXMSD's Slice 1 pattern)
- After Option B disclosures land for the remaining 32 dangling refs, promote to required check

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @github-code-quality (2026-05-17T04:44:08Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-17T04:45:08Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `7fec8fc9c5`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T04:45:58Z)

## Pull request overview

Adds a new hygiene tool to mechanically audit dangling `memory/feedback_*.md` references across key substrate surfaces, with both human-readable and CI-friendly JSON output.

**Changes:**

- Introduces `tools/hygiene/audit-dangling-memory-refs.ts` to scan selected surfaces for `memory/feedback_*.md` citations and report missing targets (exit codes 0/1/2).
- Adds `bun:test` coverage for edge extraction, dangling detection, surface scans, and aggregation invariants.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/audit-dangling-memory-refs.ts | New Bun/TypeScript audit CLI for detecting dangling `memory/feedback_*.md` citations across configurable surfaces. |
| tools/hygiene/audit-dangling-memory-refs.test.ts | New unit tests validating regex extraction, dangling checks, surface scan behavior, and multi-surface aggregation. |


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**tools/hygiene/audit-dangling-memory-refs.test.ts:16**

* `env` is declared but never used, which will fail TypeScript compilation with `noUnusedLocals`. Drop this variable or use it to configure the test environment.
```
function setupFixtureRepo(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "audit-dangling-memory-refs-test-"));
  const env = { ROOT: root };

```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-17T05:11:08Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `1d2774c5b7`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-17T05:21:06Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `a25e8ad0fe`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T05:22:56Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 7 comments.

## Review threads

### Thread 1: tools/hygiene/audit-dangling-memory-refs.test.ts:2 (resolved)

**@github-code-quality** (2026-05-17T04:44:08Z):

## Unused variable, import, function or class

Unused import mkdirSync.

---

Remove the unused named import <code>mkdirSync</code> from the <code>node:fs</code> import list in <code>tools/hygiene/audit-dangling-memory-refs.test.ts</code>.</p>
<p>Best fix (without changing functionality): edit only the import line at the top of the file so it imports only the actually used symbols (<code>mkdtempSync</code>, <code>rmSync</code>, <code>writeFileSync</code>). This preserves behavior and resolves the CodeQL finding.

### Thread 2: tools/hygiene/audit-dangling-memory-refs.test.ts:15 (resolved)

**@github-code-quality** (2026-05-17T04:44:08Z):

## Unused variable, import, function or class

Unused variable env.

---

<p>Remove the unused <code>env</code> declaration from <code>setupFixtureRepo()</code> in <code>tools/hygiene/audit-dangling-memory-refs.test.ts</code>.</p>
<p>Best fix without changing behavior:</p>
<ul>
<li>Delete <code>const env = { ROOT: root };</code> (line 15 in the shown snippet).</li>
<li>Keep function signature and return value unchanged (<code>{ root, cleanup }</code>), since callers already rely on that.</li>
<li>No imports, methods, or additional definitions are required.</li>
</ul>

### Thread 3: tools/hygiene/audit-dangling-memory-refs.test.ts:15 (resolved)

**@chatgpt-codex-connector** (2026-05-17T04:45:08Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove unused test symbols to keep typecheck green**

This test file introduces unused declarations (`mkdirSync` in the import list and `env` inside `setupFixtureRepo`), which triggers `TS6133` under the repo’s strict TypeScript settings (`noUnusedLocals: true` in `tsconfig.json`). In environments that run the normal `tsc --noEmit` gate, the change fails the typecheck step before tests can run.

Useful? React with 👍 / 👎.

### Thread 4: tools/hygiene/audit-dangling-memory-refs.test.ts:2 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T04:45:57Z):

`mkdirSync` is imported but never used. With `noUnusedLocals` enabled in tsconfig, this causes `bun run typecheck` to fail and will block CI. Remove the unused import (or use it).

This issue also appears on line 13 of the same file.

### Thread 5: tools/hygiene/audit-dangling-memory-refs.test.ts:35 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T04:45:57Z):

These tests set `process.env.REPO_ROOT` after importing the module, but the module-level `ROOT` constant is computed at import time. As a result, the tmpdir fixture root isn’t actually exercised, and the tests don’t validate `REPO_ROOT` behavior. Consider refactoring to compute root via a function (or accept `root` as a parameter), or use a dynamic import after setting `REPO_ROOT` in each test.

### Thread 6: tools/hygiene/audit-dangling-memory-refs.ts:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T04:45:57Z):

The header comment uses direct name attribution (e.g., “Aaron’s …”). Per `docs/AGENT-BEST-PRACTICES.md` ("No name attribution in code, docs, or skills"), current-state/code surfaces should use role-refs instead (e.g., “the maintainer’s CLI” / “the user-scope memory loader”).

### Thread 7: tools/hygiene/audit-dangling-memory-refs.ts:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T04:45:57Z):

`ROOT` defaults to `process.cwd()`, which makes the tool sensitive to where it’s invoked (running from a subdirectory will resolve surfaces incorrectly). Most hygiene tools in this repo resolve the repo root via `git rev-parse --show-toplevel` with a fallback (e.g., `tools/hygiene/audit-backlog-status-drift.ts:44-70`). Aligning to that pattern would make the tool cwd-independent and easier to wire into CI.

### Thread 8: tools/hygiene/audit-dangling-memory-refs.ts:240 (resolved)

**@chatgpt-codex-connector** (2026-05-17T05:11:08Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Reject empty --surfaces instead of scanning defaults**

When `--surfaces` is provided without any following paths (for example from an empty CI variable expansion), `customSurfaces` stays empty and the code silently falls back to `DEFAULT_SURFACES`. That masks configuration mistakes and audits the wrong scope while still returning a normal dangling/non-dangling exit code, which is especially risky once this is wired into CI. This path should be treated as a configuration error (exit `2`) instead of defaulting.

Useful? React with 👍 / 👎.

### Thread 9: tools/hygiene/audit-dangling-memory-refs.ts:245 (resolved)

**@chatgpt-codex-connector** (2026-05-17T05:21:06Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fail when any requested surface path is missing**

The current validation only checks whether **at least one** requested surface exists, so `--surfaces docs/research docs/typo` still returns a normal audit result and can exit `0/1` even though one requested subtree was never scanned. In CI this creates false-green audits when a path is misspelled or renamed, because the tool silently reports `0 files scanned` for the bad surface instead of treating it as configuration error (`2`).

Useful? React with 👍 / 👎.

### Thread 10: tools/hygiene/audit-dangling-memory-refs.ts:252 (resolved)

**@chatgpt-codex-connector** (2026-05-17T05:21:06Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Reject unknown CLI flags instead of ignoring them**

Argument parsing has no error path for unrecognized options, so typos like `--jons` or `--surface` are silently ignored and the script falls back to defaults. That hides operator mistakes and can make automation believe a specific mode/scope was enforced when it was not; unknown flags should return a configuration error exit code rather than proceeding.

Useful? React with 👍 / 👎.

### Thread 11: tools/hygiene/audit-dangling-memory-refs.ts:50 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T05:22:54Z):

P2: The comment above `MEM_REF_RE` says it matches references “as a path (NOT just a string in code)”, but the current regex will match any `memory/feedback_*.md` substring anywhere in markdown (including prose/code blocks). Please align the comment with actual behavior (or tighten the matcher if you truly want to exclude non-path contexts).

### Thread 12: tools/hygiene/audit-dangling-memory-refs.ts:261 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T05:22:55Z):

P1: Arg parsing silently ignores unknown flags, and `--surfaces` with no following paths falls back to scanning DEFAULT_SURFACES. That makes mis-typed CLI invocations hard to notice and can trigger unexpectedly large scans in CI. Consider switching to a strict parser (error on unknown args) and treating `--surfaces` with zero collected paths as a configuration error (exit 2/64 with a usage message).

### Thread 13: tools/hygiene/audit-dangling-memory-refs.test.ts:105 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T05:22:55Z):

P1: This test’s comment about “import statics capture ROOT at import time” no longer matches the implementation (the production code resolves `REPO_ROOT` lazily on each `repoRoot()` call). Also, the existence-proof assertion relies on a specific file in the real repo, making the test less self-contained. Prefer creating a temp `memory/feedback_*.md` file under the fixture repo and asserting `isDangling` returns false with `REPO_ROOT` set to that fixture root.

### Thread 14: tools/hygiene/audit-dangling-memory-refs.test.ts:65 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T05:22:55Z):

P2: This test name/comment is internally contradictory (“ignores … (still matches if path-shaped)”), and the assertions show it intentionally DOES match bare `memory/feedback_*.md` in prose. Renaming the test (or rewriting the comment) would make the intended behavior clearer for future maintainers.

### Thread 15: tools/hygiene/audit-dangling-memory-refs.test.ts:148 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T05:22:55Z):

P1: `auditSurface` “nonexistent surface” test depends on the current repo layout (it will start failing if someone ever adds `.claude/nonexistent-surface-for-test`). To avoid brittle tests, set `REPO_ROOT` to a tmp fixture and run `auditSurface("some/surface")` against that fixture instead.

### Thread 16: memory/feedback_otto_qg_isomorphism_step_2_cube_adinkra_cayley_dickson_to_happylike_qecc_2026_05_16.md:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T05:22:56Z):

P1: This memo claims `docs/research/2026-05-15-qg-isomorphism-step-2-cube-adinkra-cayley-dickson-to-happylike-qecc.md` was created, but that file does not appear to exist in-repo (only references to it do). Either add the missing research doc in this PR or update the memo to point at the actual location/name so readers don’t follow a broken reference.

### Thread 17: tools/hygiene/audit-dangling-memory-refs.ts:37 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T05:22:56Z):

P1: `repoRoot()` defaults to `process.cwd()`, so results depend on invocation directory (running from a subdir can scan the wrong tree or hit the “no surfaces exist” error). Nearby hygiene tools are cwd-independent by detecting the git toplevel / chdir’ing to it (e.g., `tools/hygiene/audit-md032-plus-linestart.ts:112-115`, `tools/hygiene/audit-backlog-status-drift.ts:62-71` + `main` at ~306-313). Consider adopting that pattern here while still honoring `REPO_ROOT` overrides for tests.

## General comments

### @AceHack (2026-05-17T04:44:05Z)

## Two additive findings from cross-Otto coordination (otto-cli, 2026-05-17 0443Z)

While this PR was being authored I ran two related cross-checks from the primary worktree (file-write-only; no git ops because Lior-gemini was active in `ps -A`). Both findings are additive / non-blocking for #4042 but worth preserving for the follow-up wiring.

### 1. False-positive class — metasyntactic placeholders in documentation

The regex `MEM_REF_RE = /memory\/feedback_[A-Za-z0-9_-]+\.md/g` will flag this site at [`docs/backlog/P2/081KQNJ500008QG0R001THCSKV-decision-graph-traversal-tool-aaron-2026-05-03.md:77`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/backlog/P2/081KQNJ500008QG0R001THCSKV-decision-graph-traversal-tool-aaron-2026-05-03.md#L77):

> \`--citation-traversal memory/feedback_X.md\` — which memos cite this one?

The \`memory/feedback_X.md\` token is a CLI-usage **metasyntactic variable** (placeholder for \"any memory feedback file\"), not an actual citation. Context-blind regex can't distinguish.

Small (1 of 49 edges ~ 2%) and not a blocker, but a class to acknowledge before promoting to required check. Refinement candidates:

- Skip occurrences inside fenced code blocks (\` ``` ... ``` \`)
- Skip occurrences inside inline backticks
- Skip occurrences inside \`<code>\` HTML tags
- Or: \`.audit-dangling-ignore\` allow-list of known FP sites

### 2. Complementary-coverage matrix with the existing tool

Ran [\`tools/hygiene/audit-memory-references.ts\`](https://github.com/Lucent-Financial-Group/Zeta/blob/main/tools/hygiene/audit-memory-references.ts) (existing) for comparison: **0 broken / 100 refs in memory/MEMORY.md**. The two tools form a clean coverage matrix:

| Tool | Scope | Today |
|------|-------|-------|
| \`audit-memory-references.ts\` (existing) | \`memory/MEMORY.md\` only | 0 broken / 100 refs |
| \`audit-dangling-memory-refs.ts\` (this PR) | 6 other surfaces | 49 edges / 32 unique dangling |

The MEMORY.md hygiene works because every memory-file change updates the index (workflow + CI). The 6 other surfaces lack that mechanism — which is exactly the gap this PR mechanizes. Together the two tools cover the full \`memory/feedback_*.md\` citation graph: MEMORY.md as canonical index + the 6 surfaces as ad-hoc citation sites.

### Full file:line catalog (47 file:line pairs ~ 46 after FP retraction)

The catalog of all 49 file:line pairs (with the 18 multi-citation hidden edges that \`sort -u\` dedup hides — the exact methodology gap #4041 named) is in [my local working tree](https://github.com/Lucent-Financial-Group/Zeta) as \`memory/feedback_otto_cli_dangling_refs_file_line_catalog_47_pairs_6_surfaces_2026_05_17.md\` (untracked from primary worktree; will commit on a separate branch when Lior-gemini clears \`ps -A\` per the [codeql-no-source canary rule](.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md)). The catalog's value-add over the tool output is the multi-citation-site analysis (top: \`feedback_aaron_visibility_constraint_no_changes_he_cant_see_2026_04_28.md\` cited from 6 distinct backlog rows — \`sort -u\` collapses 6 → 1).

🤖 otto-cli background worker — coordinating-with not blocking
