---
pr_number: 5216
title: "feat(081KSGS9H0008QG0R000EPPQTR) + backlog(081KSGS9H0008QG0R000JVGZKG): TS deregister-node tool + heartbeat/expiration design \u2014 the maintainer 2026-05-26 dual ask"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:28:44Z"
merged_at: "2026-05-26T16:40:00Z"
closed_at: "2026-05-26T16:40:00Z"
head_ref: "otto-cli/deregister-tool-plus-b0814-b0815-heartbeat-expiration-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:20Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5216: feat(081KSGS9H0008QG0R000EPPQTR) + backlog(081KSGS9H0008QG0R000JVGZKG): TS deregister-node tool + heartbeat/expiration design — the maintainer 2026-05-26 dual ask

## PR description

## Summary

Three deliverables addressing the maintainer 2026-05-26 dual ask:

1. **`tools/cluster/deregister-node.ts`** (081KSGS9H0008QG0R000EPPQTR P1, ships ready-to-use) — TS Bun tool that removes a registered machine from git via PR. Operator-name auto-derives from `gh api /user`. Temp worktree (no operator-checkout touch). Default opens PR; `--push-direct` for fast-path. Per *"lets make a ts file for removing machines from git too cause i'm going to delete clusters a lot lol"*.

2. **081KSGS9H0008QG0R000EPPQTR P1 backlog row** — captures the deregister tool's design + acceptance + sub-targets (status: in-progress → done on this PR's merge).

3. **081KSGS9H0008QG0R000JVGZKG P2 backlog row** — heartbeat/expiration design space for "keep registration physically in sync with machine". 4 options documented (TTL / heartbeat-daemon / hybrid / K8s-status-as-truth) with tradeoffs + my recommendation (Option C hybrid for homelab; Option D K8s-native as upgrade path). Per *"how do keep registration status physically in sync with machine, like maybe you have to reregister once a day or week or something or it expires"*.

## Usage (081KSGS9H0008QG0R000EPPQTR)

```bash
bun tools/cluster/deregister-node.ts --host pikachu \
    [--maintainer aaron] [--reason "decommissioning"] [--push-direct]
```

Exit codes: 0=PR opened (or direct push) / 1=invocation error / 2=host not found / 3=git error.

## Substrate-inventory pass per #5131 rule

- `deregister-node` unused; `tools/cluster/` doesn't exist; `heartbeat`/`expires_at` no overlap with cluster-node scope.
- IDs 081KSGS9H0008QG0R000EPPQTR, 081KSGS9H0008QG0R000JVGZKG next-free.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:33:56Z)

## Pull request overview

This PR adds cluster-operations substrate for removing registered nodes from the GitOps tree, plus backlog rows capturing the deregistration tool and a follow-on heartbeat/expiration design space.

**Changes:**
- Add `tools/cluster/deregister-node.ts` Bun/TS CLI to delete `maintainers/<op>/cluster-nodes/<host>/`, commit, push, and open a PR (or optionally push directly).
- Add backlog rows 081KSGS9H0008QG0R000EPPQTR (tool) and 081KSGS9H0008QG0R000JVGZKG (heartbeat/expiration design options).
- Update `docs/BACKLOG.md` to include the new backlog entries.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 10 comments.

| File | Description |
| ---- | ----------- |
| tools/cluster/deregister-node.ts | New Bun/TS tool to deregister a cluster node via git worktree + PR/direct push. |
| docs/backlog/P1/081KSGS9H0008QG0R000EPPQTR-tools-cluster-deregister-node-ts-removes-registered-machine-from-git-sibling-to-iter-5-4-1-self-registration-aaron-2026-05-26.md | New P1 backlog row documenting the deregister-node tool’s intent/acceptance. |
| docs/backlog/P2/081KSGS9H0008QG0R000JVGZKG-cluster-node-registration-heartbeat-expiration-pattern-physical-sync-design-aaron-2026-05-26.md | New P2 backlog row exploring heartbeat/expiration designs to keep registration synced to physical reality. |
| docs/BACKLOG.md | Adds 081KSGS9H0008QG0R000EPPQTR and 081KSGS9H0008QG0R000JVGZKG entries to the generated backlog index. |

## Review threads

### Thread 1: tools/cluster/deregister-node.ts:85 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:53Z):

P1: `--reason` parsing accepts the next flag as the reason (e.g. `--reason --push-direct`), which will silently drop `--push-direct` and produce an incorrect commit/PR message. Treat values starting with `-` as missing, consistent with `--host`/`--maintainer`.

### Thread 2: tools/cluster/deregister-node.ts:112 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:53Z):

P1: `--host` is used to build both a filesystem path (`git rm -r maintainers/.../${host}`) and a branch name. Without validation, values like `../...` or path separators can target unexpected paths or create invalid refs.

### Thread 3: tools/cluster/deregister-node.ts:212 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:53Z):

P1: If `git worktree add` fails, the temporary directory created by `mkdtempSync` is left behind. This can leak temp dirs over time, especially if the repo isn't in a valid git state.

### Thread 4: tools/cluster/deregister-node.ts:196 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:54Z):

P2: The branch prefix is hard-coded to `otto-cli/`, which is an Otto agent lane prefix (see `.claude/rules/agent-roster-reference-card.md`). For a general operator tool, this will misattribute PRs and may interfere with lane-based automation; prefer a neutral prefix.

### Thread 5: tools/cluster/deregister-node.ts:283 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:54Z):

P2: Most Bun tools in this repo only call `process.exit(...)` under an `if (import.meta.main)` guard so they can be imported without side effects (see e.g. `tools/backlog/generate-index.ts`). This script exits unconditionally on import.

### Thread 6: docs/backlog/P1/081KSGS9H0008QG0R000EPPQTR-tools-cluster-deregister-node-ts-removes-registered-machine-from-git-sibling-to-iter-5-4-1-self-registration-aaron-2026-05-26.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:54Z):

P1: `status: in-progress` is not one of the documented backlog status enum values (`open` / `closed` / `superseded-by-*` / `deferred` / `decomposed`) in `tools/backlog/README.md`, so it will be treated as open but drifts from the schema.

### Thread 7: docs/backlog/P1/081KSGS9H0008QG0R000EPPQTR-tools-cluster-deregister-node-ts-removes-registered-machine-from-git-sibling-to-iter-5-4-1-self-registration-aaron-2026-05-26.md:92 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:54Z):

The relative link to `.claude/rules/verify-existing-substrate-before-authoring.md` is incorrect from `docs/backlog/P1/` (it currently points under `docs/.claude/...`), so the link will 404 on GitHub.

### Thread 8: docs/backlog/P2/081KSGS9H0008QG0R000JVGZKG-cluster-node-registration-heartbeat-expiration-pattern-physical-sync-design-aaron-2026-05-26.md:118 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:55Z):

The relative link to `.claude/rules/verify-existing-substrate-before-authoring.md` is incorrect from `docs/backlog/P2/` (it currently points under `docs/.claude/...`), so the link will 404 on GitHub.

### Thread 9: docs/BACKLOG.md:387 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:55Z):

The new backlog entry is missing the closing quote at the end of the maintainer quote, which breaks the exact title copy and can cause awkward rendering.

### Thread 10: docs/BACKLOG.md:752 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:33:55Z):

The new backlog entry is missing the closing quote at the end of the maintainer quote, which breaks the exact title copy and can cause awkward rendering.

## General comments

### @chatgpt-codex-connector (2026-05-26T16:28:50Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
