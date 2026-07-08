---
id: 081KTGPC2XP08QG0R000X8X1M9
type: task
state: closed
priority: P1
slug: git-reach-punch-list-data-plane-command-spec-requirements-fo
title: "git-reach punch-list → data-plane command spec (requirements for the no-git-CLI command surface, roadmap #1)"
created: 2026-06-07T09:24:39.990Z
depends_on: []
composes_with: ["081KTGES04808QG0R0010AK90E"]
---

# git-reach punch-list → data-plane command spec (requirements for the no-git-CLI command surface, roadmap #1)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGPC2XP08QG0R000X8X1M9-*.md` glob. -->

## Purpose

The REQUIREMENTS for roadmap #1 (no-git-CLI command surface), independent of the surface shape (CLI vs
MCP vs core-library — that's an open decision). "git-reach = the gap detector" made concrete: every git
operation Otto's work-cycle actually uses → the data-plane DB command that must replace it. When every
row has a DB command, Otto can complete a full work-cycle with **zero `git` CLI calls** (the done-test).

## The punch-list (from a real Otto session, 2026-06)

| git operation used | frequency | data-plane DB command | maps to |
|--------------------|-----------|------------------------|---------|
| `git commit -m/-F` | every change | `append` / `commit` (a delta/entry to a Log) | `IDeltaLog.AppendAsync` ✅ exists |
| `git checkout -b <branch>` | every change | `branch <name>` (fork a ref) | git ref op — **new command** |
| `git checkout <ref>` | switching | `checkout <ref>` (set working ref) | git ref op — **new** |
| `git log --oneline` | orient | `history` / `log [--since]` (read the Log) | `IDeltaLog.ReplayAsync` ✅ |
| `git show <ref>:<path>` / `git diff` | inspect | `get <ZetaId/seq>` / `diff <a> <b>` | read entry by coordinate — **new** |
| `git status` | orient | `status` (working-ref state, pending) | **new** (derive from Log tip) |
| `git fetch` / `git pull --ff-only` | sync view | `sync` / `pull` (fast-forward a ref) | git fetch + ff |
| `git reset --hard origin/main` | sync clone | `reset <ref>` (hard-set working ref) | git op |
| `git push -u origin <branch>` | publish | `push <branch>` | git op |
| `git ls-files` / `ls-tree` | list | `ls <ref>` (list entries) | read tree |
| `gh pr create` / `gh pr merge --auto` | land | (CONTROL-PLANE: PR/merge verbs) | Loom/consensus-repo layer, separate |

Notes: **read/append already exist** in the data plane (`IDeltaLog`); the **ref operations** (branch /
checkout / status / sync / push) are the genuinely-new commands — they're git-ref manipulations the DB
must expose as first-class verbs over the git backend. PR/merge are *control-plane* (the consensus-repo /
Loom layer), distinct from the data-plane DB commands.

## Command SHAPE (Aaron 2026-06-07 — the table is a gap inventory, NOT a 1:1 mirror)

The mapping above enumerates *which* git reaches must become replaceable — it is **not** a spec for
full-fidelity git verbs. Per `docs/research/2026-06-07-command-surface-not-1to1-git-...-aaron.md`:

- **Not 1:1 with git** — a curated subset, no full porcelain fidelity.
- **Retractable by nature** — apply has a defined inverse (Z-set retraction carried to the command layer).
- **Compensating action built in where not truly retractable** — e.g. `push` (can't un-send) carries a
  saga-style compensation (revert-commit / restore-ref), not a raw passthrough.
- **Data-plane = the ONE interface** forcing consistent DB flows over BOTH git and filesystem; the
  git-zeta verbs are the *freedom-but-less-composable* escape layer. End-state: only data-plane commands
  routinely; git's native history is still leveraged underneath the one interface.
- **Host (GitHub/GitLab/gh) = a plugin, not git-native** — remote verbs stay host-agnostic; credentials
  via the pluggable `CredentialSource` (`src/Core.Git/CredentialSource.fs`, EnvToken landed).

## Acceptance

A data-plane command exists for every data-plane row above; Otto completes a full work-cycle
(land a change, branch, query history, sync) issuing only DB commands, no `git`. Each new git-reach not
on this list is a new gap to add (the list is living).

## Open (Aaron's call — surface shape)

Where the commands live: (a) a CLI executable, (b) an MCP server, or (c) a shared command-core library
first with CLI and MCP as thin wrappers (Otto's lean, no surface lock-in). This punch-list is the
requirements for ALL three; the shape decision gates which wrapper lands first.

## Anchors

- `docs/ROADMAP.md` item #1 (no-git-CLI) + the git-reach-as-gap-detector loop · `src/Core/DeltaLog.fs`
  (`IDeltaLog` — append/replay exist) · `src/Core.Git/GitDeltaLog.fs` (the git backend) · ZetaID universal
  pointer (get-by-ZetaId) · the cross-cell/PR verbs = control-plane (Loom), separate.
