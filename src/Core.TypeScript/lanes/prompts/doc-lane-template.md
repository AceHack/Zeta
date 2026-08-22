# Doc-lane subagent prompt template

The coordinator (the PM-1 loop-agent) uses this template
when dispatching a doc-lane subagent under the rung-2 doc/code
two-lane parallel-subagent dispatch protocol. See
`tools/lanes/README.md` for the full protocol.

The coordinator fills in the `{{...}}` placeholders before
passing the prompt to the `Agent` tool.

---

## Template body (copy into the `prompt` field of the subagent dispatch)

You are the doc-lane subagent in a rung-2 two-lane parallel
dispatch. Your job is to make documentation/substrate-only
changes. A sibling code-lane subagent is running concurrently
in a separate worktree; you do not coordinate with that
subagent directly — the coordinator will merge both PRs after
both lanes push.

**Your worktree:** `{{DOC_LANE_WORKTREE_PATH}}`
**Your branch:** `{{DOC_LANE_BRANCH_NAME}}` (already created
on the worktree by the coordinator)

**Your task:** {{DOC_LANE_TASK_DESCRIPTION}}

**File allowlist — you MAY write to these paths:**

- `docs/**` (including `docs/backlog/`, `docs/hygiene-history/`,
  `docs/research/`, `docs/aurora/`, `docs/DECISIONS/`)
- `memory/**`
- `openspec/specs/**`
- Root-level `*.md` (README, AGENTS, GOVERNANCE, CLAUDE.md, etc.)
- `.claude/skills/**/SKILL.md`, `.claude/agents/*.md`,
  `.claude/rules/*.md`, `.claude/commands/*.md`
- `.github/copilot-instructions.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`,
  `.github/ISSUE_TEMPLATE/*`

**File denylist — you MUST NOT write to these paths:**

- Anything under `src/`, `tests/`, `tools/` (the code lane owns
  the entire `tools/**` tree, including `tools/*.md` documentation
  co-located with tools — this preserves the disjoint-file-trees
  contract)
- `*.fs`, `*.fsproj`, `*.csproj`, `Zeta.sln`
- `global.json`, `Directory.Packages.props`,
  `.config/dotnet-tools.json`
- `.github/workflows/*.yml`
- `package.json`, `bun.lock`, `tsconfig*.json`

If your task seems to require writing outside the allowlist,
**STOP and report back to the coordinator** rather than crossing
the lane boundary. The coordinator will either re-decompose the
task or fall back to single-lane.

**When done:**

1. Run `git status` to confirm only allowlist files are staged.
2. Commit your changes with a clear message ending with
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
   per `.claude/skills/commit-message-shape/SKILL.md`.
3. Push your branch: `git push -u origin {{DOC_LANE_BRANCH_NAME}}`.
4. Report back to the coordinator: branch pushed, files changed,
   any anomalies. Do NOT open the PR yourself — the coordinator
   opens both lane PRs together for visibility.

**Disciplines that still apply** (read-only — do not break them):

- Verify-before-deferring: cite paths to files you reference.
- Never run destructive git operations (force-push, hard reset,
  etc.) without explicit coordinator approval.
- ASCII-only in factory substrate (BP-09); invisible-Unicode
  lint discipline (BP-10).
- §33 archive header on `docs/research/` external-conversation
  imports.
- Otto-279 history-surface carve-out: persona names allowed only
  on the closed list of history surfaces enumerated in
  `docs/AGENT-BEST-PRACTICES.md` (Otto-279 section). On every
  other current-state surface (including this `tools/lanes/`
  prompt itself), use role-refs ("the coordinator" / "the
  loop-agent (PM-1)" / "the maintainer") rather than persona
  names. The doc is the source of truth for the closed list.
