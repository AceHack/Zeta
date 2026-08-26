---
id: 081M100RH3Q087G0R0018X4RSJ
type: task
state: backlog
priority: P1
slug: closed-model-tools-ace-verbs-for-deps-zeta-verbs-for-git-fs
title: "Closed model tools: Ace verbs for deps, Zeta verbs for git/fs/forge, never bash/gh/git"
created: 2026-08-26T21:49:00.919Z
depends_on: ["081M100RB97087G0R0008EAAY7", "081M100RB9Z087G0R000GWY1MM"]
composes_with: []
---

# Closed model tools: Ace verbs for deps, Zeta verbs for git/fs/forge, never bash/gh/git

Today `ZETA_TOOLS` is `fs_*` + `db_*` over an in-memory DagFs/zetadb
store. Production agents get vendor toolboxes (bash, Read, gh, git).
`src/Core.TypeScript/observe/subscription-executor.ts` still has
`run_command` to `bash -c`.

Ace closes over **dependencies**. Zeta closes over **source control +
filesystem + forge**. The model sees those CLIs, not platform CLIs.

## Must

- Closed vocabulary: `ace_*` (install/verify/list/realize) + `zeta_*`
  (status/commit/push/branch + DagFs path ops + PR/issue via ForgeHost).
- Off-surface names refused (existing `isClosedSurface` invariant).
- Execution is the real Ace CLI / `zeta` LibGit2Sharp / ForgeHost HTTP
  — not a second copy of the semantics.
- JSON-out, structured errors, no TTY prompts. `--json` is the contract,
  not a `list`-only flag.

## Falsifier

A summoned persona can commit + open a PR + install a pinned dep with
no `git`/`gh`/`bash`/`brew` in the tool list. Adding `run_command` to
the declared tools turns the closed-surface test red.
