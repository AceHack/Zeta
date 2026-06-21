---
pr_number: 5464
title: "feat(081KSKBP80008QG0R001KK9WV6.3): heartbeat-writer + REST direct-push + AGENTS.md discipline + folder seed (Aaron 2026-05-27 USB push)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T13:58:06Z"
merged_at: "2026-05-27T14:14:57Z"
closed_at: "2026-05-27T14:14:57Z"
head_ref: "feat/b-0858-3-heartbeat-writer-folder-agents-md-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:23:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5464: feat(081KSKBP80008QG0R001KK9WV6.3): heartbeat-writer + REST direct-push + AGENTS.md discipline + folder seed (Aaron 2026-05-27 USB push)

## PR description

## Summary

End-to-end heartbeat substrate landed in one PR (operator 2026-05-27: "make sure it gets used" + direct-push to main without disturbing other files):

- **tools/agent-heartbeats/write-heartbeat.ts** — writer composing existing ZetaID v1 (category=3=Heartbeat per registry/categories.yaml); --push flag uses REST git-data API (blob→tree→commit→ref), bypasses local git entirely; --branch flag picks main or agent-heartbeats; 5x retry on non-fast-forward
- **tools/agent-heartbeats/write-heartbeat.test.ts** — 15 unit tests passing
- **docs/agent-heartbeats/README.md** — folder layout, bit-field grep patterns, both deployment options (folder-with-path-exclusion OR separate-branch-with-no-protection)
- **docs/agent-heartbeats/otto/2026/05/27/080cf34dbc457007a013000803955b96.md** — first actual heartbeat (dogfood)
- **AGENTS.md** — heartbeat-via-commit discipline added to Agent operational practices

## Operator-side note for direct-push

To enable direct-to-main push without PR gating, either:
- Add path-scoped branch protection exclusion for \`docs/agent-heartbeats/**\` on main, OR
- Create an \`agent-heartbeats\` branch with NO protection (use \`--branch agent-heartbeats\`)

ZetaID-unique filenames guarantee no concurrent-agent collision on either.

## Test plan

- [x] 15 unit tests pass (\`bun test tools/agent-heartbeats/\`)
- [x] First seed heartbeat written + verified via writer tool
- [x] tsc clean
- [x] AgencySignature v1 trailer on commit
- [x] Per .claude/rules/agent-worktree-hygiene-...: isolated worktree

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T14:07:15Z)

## Pull request overview

Adds an “agent heartbeat” substrate to record autonomous-loop ticks as ZetaID-addressed markdown files, including a Bun/TypeScript writer (with optional direct REST-based push), documentation of the folder/branch conventions, a seeded first heartbeat, and an operational-practice update in `AGENTS.md`.

**Changes:**
- Introduces `tools/agent-heartbeats/write-heartbeat.ts` to generate ZetaID-based heartbeat files and optionally push them via GitHub’s git-data REST API (through `gh api`) with retry-on-race behavior.
- Adds Bun unit tests for argument parsing and heartbeat rendering/packing helpers.
- Documents the heartbeat folder layout and lookup strategy; seeds an initial heartbeat record; updates `AGENTS.md` to require heartbeat-via-commit discipline.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 14 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| tools/agent-heartbeats/write-heartbeat.ts | New heartbeat writer + REST push implementation (blob→tree→commit→ref). |
| tools/agent-heartbeats/write-heartbeat.test.ts | Unit tests for parsing/rendering/path/id packing helpers. |
| docs/agent-heartbeats/README.md | New documentation for heartbeat layout, writing, push options, and grep-based indexing. |
| docs/agent-heartbeats/otto/2026/05/27/080cf34dbc457007a013000803955b96.md | Seed heartbeat record (“dogfood” entry). |
| AGENTS.md | Adds heartbeat-via-commit requirement to agent operational practices. |
</details>

## Review threads

### Thread 1: tools/agent-heartbeats/write-heartbeat.ts:84 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:09Z):

parseInt() results for numeric flags can be NaN (e.g. `--chromosome foo`), and the current range checks won’t catch that because comparisons with NaN are false. This can later crash when packing the ID (BigInt(NaN)). Add explicit `Number.isInteger(...)` / `Number.isFinite(...)` validation for all parsed numeric flags and return an arg-parse error when invalid.

### Thread 2: tools/agent-heartbeats/write-heartbeat.ts:119 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:10Z):

`--authority` and `--momentum` are accepted as arbitrary strings via type assertions. If an unknown tag is provided, `pack()` will throw (it validates against its internal maps), and `main()` doesn’t catch it—so this becomes an unhandled exception instead of a clean exit code 2 with a helpful message. Validate these flags against the supported tag set (and/or support a `Raw:<n>` form) and handle `pack()` failures gracefully.

### Thread 3: tools/agent-heartbeats/write-heartbeat.ts:33 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:10Z):

Exit code documentation is out of sync with behavior: the script returns 4 on REST push failure, but the header comment only documents codes 0/2/3. Please document exit code 4 (or adjust codes to match the docs).

### Thread 4: tools/agent-heartbeats/write-heartbeat.ts:314 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:10Z):

`repoRelPath` is derived via `path.split("/")`, but `heartbeatPath()` uses `path.join()`, which is platform-dependent (e.g., `\` on Windows). This can produce an incorrect repo-relative path (and thus push to the wrong location) on non-POSIX platforms or with unusual repoRoot values. Prefer computing a true repo-relative path with `path.relative(repoRoot, path)` and normalizing to POSIX separators for the GitHub API.

### Thread 5: tools/agent-heartbeats/write-heartbeat.ts:158 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:11Z):

`pushHeartbeatViaRest` is non-trivial new behavior (multi-step blob→tree→commit→ref with retry logic), but the test suite doesn’t cover it at all. Consider adding unit tests by injecting/stubbing the `gh` runner so you can verify success, parse failures, and the retry path without requiring network access or a real token.

### Thread 6: tools/agent-heartbeats/write-heartbeat.test.ts:158 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:12Z):

These path assertions are POSIX-specific (`/repo/...`). Since `heartbeatPath()` uses `path.join()`, the result will use platform separators; this test will fail on Windows runners. Use `path.join(...)` (or normalize separators) in the expected value so the test matches the function’s cross-platform behavior.

### Thread 7: docs/agent-heartbeats/README.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:12Z):

The docs treat `<persona>` as a canonical agent name, but the ZetaID `persona` bit-field is defined by `registry/personas.yaml` as a role-ref slot registry. Right now slot `2` is `FireflyCoherence`, not `otto`, so mixing “agent name” and “persona slot” is ambiguous and risks mis-indexing grep lookups. Please clarify terminology (e.g., folder segment = agent/surface name; ZetaID persona slot = registry role-ref id) and align examples accordingly.

### Thread 8: docs/agent-heartbeats/README.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:12Z):

“Collision-free by construction” is stronger than what 32 bits of randomness can guarantee; collisions are merely extremely unlikely, not impossible. Consider rephrasing to “collision-resistant/probabilistically unique” (and optionally state the approximate risk) to avoid overstating the property.

### Thread 9: docs/agent-heartbeats/otto/2026/05/27/080cf34dbc457007a013000803955b96.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:13Z):

The `persona-slot: 2` value currently corresponds to `FireflyCoherence` in `registry/personas.yaml`, but this heartbeat file identifies the agent as `otto`. If the intent is for the ZetaID persona bits to index the producing agent, either update the persona-slot here (and in the writer defaults/examples) or update the registry mapping so the slot aligns with the recorded agent identity.

### Thread 10: AGENTS.md:278 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:13Z):

This wrapped bullet continuation line starts with `+`, which markdownlint treats as a nested list marker and can break CI linting. Reword the sentence so the continuation line doesn’t begin with `+` (e.g., “and no named-dependency …”).

### Thread 11: AGENTS.md:286 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:14Z):

This section includes persona-name attribution (“Kira review”, “Otto-CLI”). Outside the explicit roster-mapping carve-out sections, governance/instructions docs should use role-refs rather than persona names to avoid name attribution bleeding into current-state docs. Please rewrite these references using role-based terms.

### Thread 12: tools/agent-heartbeats/write-heartbeat.ts:345 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:14Z):

With `--push`, the script still writes the heartbeat file to the local filesystem before doing the REST push, which will leave the worktree dirty (new uncommitted file). That contradicts the nearby claim about “no staged/unstaged files disturbed / no working-tree mutation”. Either skip the local write when `--push` is set (push-only mode) or clarify the wording to mean “doesn’t touch the git index/current branch”, not “doesn’t modify the worktree”.

### Thread 13: docs/agent-heartbeats/README.md:43 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:14Z):

This section says the REST path “bypasses local git index + working tree entirely — no staged/unstaged files disturbed”, but the writer tool writes the heartbeat file locally before pushing. Please adjust the wording (or the tool behavior) so users don’t expect a clean worktree after `--push`.

### Thread 14: tools/agent-heartbeats/write-heartbeat.ts:173 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T14:07:15Z):

Throughout the repo, `// eslint-disable-next-line sonarjs/no-os-command-from-path` suppressions include a short rationale comment (e.g., “-- gh invoked as explicit args array; no shell, no injection risk”) so the suppression is auditable and not mistaken for a drive-by lint appeasement. Please add the same rationale text to these new suppressions for consistency.

## General comments

### @chatgpt-codex-connector (2026-05-27T13:58:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
