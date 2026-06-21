---
id: 081KV6D1B3T08QG0R000QCTMXN
type: task
state: done
priority: P3
slug: sweep-remaining-stale-upstreams-prior-art-mirror-dir-misnome
title: "Sweep remaining stale 'upstreams' -> 'prior-art' mirror-dir misnomer in active docs/backlog (keep legit OSS-upstream usage; leave dated historical snapshots)"
created: 2026-06-15T19:44:48.250Z
completed: 2026-06-21T05:07:41.404Z
depends_on: []
composes_with: []
---

# Sweep remaining stale 'upstreams' -> 'prior-art' mirror-dir misnomer in active docs/backlog (keep legit OSS-upstream usage; leave dated historical snapshots)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KV6D1B3T08QG0R000QCTMXN-*.md` glob. -->

**Context (Aaron 2026-06-15):** "I had called it upstreams when we first created
the project but then renamed it [to `references/prior-art/`]; it probably has
upstreams language left over places." Otto fixed the **live surfaces** in PR (the
prior-art-add PR): `CLAUDE.md` guard (`--exclude-dir=upstreams` → `prior-art` — was
*wrong*, no such dir), `.claude/rules.bak/references-prior-art-not-our-code-search-excludes.md`,
`.claude/agents/architect.md`, `docs/FACTORY-HYGIENE.md`, and comments in
`.dockerignore` / `.github/workflows/codeql.yml` / `.vscode/settings.json`.

## Remaining (this item) — classify each, then fix/keep/leave

**FIX (stale mirror-dir refs in *active* docs/backlog — `references/upstreams/` →
`references/prior-art/`):** several `docs/backlog/P*/…` items carry stale
`-not -path "*/references/upstreams/*"` find-excludes + `tools/setup/common/sync-upstreams.sh`
naming; `docs/aurora/2026-04-23-…` scan-scope comment. These are wrong (the dir is
`prior-art`) and could mis-guide a copy-paste.

**KEEP (legitimate "OSS upstream" usage — do NOT change):**
`.claude/skills/workflows/blueprints/fork-pr-workflow.md` ("direct PRs to OSS
upstreams"); `docs/PRIMITIVE-REGISTRY.md` ("push to all upstreams" = git distros);
GOVERNANCE.md §23 upstream-contribution.

**LEAVE (dated historical snapshots — do not rewrite history):**
`docs/DECISIONS/2026-04-20-tools-scripting-language.md`, `docs/MISSED-ITEMS-AUDIT.md`,
`docs/ROUND-HISTORY.md` entries — records of what was true when the dir was named
`upstreams`.

## Done

`git grep "upstreams"` over *active, non-historical* surfaces returns only the
legitimate-OSS-upstream usages; the prior-art mirror is never called "upstreams" in
any live guidance. Low priority (cosmetic + minor copy-paste footgun); no code path
depends on it.
