# FACTORY-DISCIPLINE.md — agent-visible rule index

**Status:** stop-gap index. Stable rules live in
`docs/AGENT-BEST-PRACTICES.md` (BP-NN identifiers) and
`GOVERNANCE.md` (numbered sections). Session-captured
corrections live in the canonical in-repo memory store at
`memory/` (see `GOVERNANCE.md` §18 and `memory/README.md`);
`memory/MEMORY.md` is the index and `memory/feedback_*.md`
are the individual entries. Subagents dispatched via the
Task tool can `Read` those files directly. A per-
maintainer factory-personal staging store also exists
out-of-tree under `~/.claude/projects/<slug>/memory/` —
that is a scratchpad that syncs INTO the in-repo store,
not an authoritative parallel source. If the two disagree,
the in-repo `memory/` tree wins.

This file is the **short-form agent-visible index** on top
of that in-repo memory: it names the active disciplines and
points at the authoritative `memory/feedback_*.md` entries.
Historical note: earlier drafts of this file described the
out-of-repo store as the authoritative source because it
predated the memory-sync landing. The memory-sync
mechanism (loop-agent work, landed shortly before this
file was written) reversed that direction — in-repo
canonical, out-of-repo staging — and this file now
reflects that current state.

**Read order for any subagent dispatched into the repo:**

1. `CLAUDE.md` (bootstrap; points at AGENTS / GOVERNANCE /
   ALIGNMENT / AGENT-BEST-PRACTICES / WONT-DO)
2. This file (`docs/FACTORY-DISCIPLINE.md`)
3. The specific `memory/feedback_*.md` entry cited in a
   discipline section below, when deeper context is needed
4. First 100 lines of any file being edited (file-local
   discipline sections)

**Scope note:** this index is not authoritative. The
`memory/feedback_*.md` files it cites ARE authoritative.
This file is a short-form pointer; updates here must cite
the source memory file.

---

## Active disciplines (by short-name → pointer)

### append-only audit-trail files

**Rule:** `docs/hygiene-history/**`, `docs/ROUND-HISTORY.md`,
`docs/DECISIONS/**` are append-only. Rows / entries are immutable
once committed. Corrections go in NEW rows that reference the
earlier row, never edit existing rows in place — not for typos,
date normalisation, column alignment, or "consistency".

**Source:** `memory/feedback_tick_history_append_only_never_edit_prior_rows_otto_229_*.md`

**Applies to drain-subagent dispatch prompts:** every prompt
that edits one of these files must carry the explicit
constraint "do NOT edit existing rows — only APPEND new rows
or correction rows."

### code comments explain code, not history

**Rule:** `///`, `//`, `#` doc comments in `src/**`, `tests/**`,
`bench/**`, `tools/**` source files must explain the CODE
(math, invariants, input contracts, composition). They must
NOT carry factory-process lineage — no "Provenance:",
"Attribution:", "Nth graduation", "per correction #N", ferry
names, Otto-NN tags, persona names. That content belongs in
PR descriptions, commit messages, `docs/hygiene-history/**`,
or memory files.

**Source:** `memory/feedback_code_comments_explain_code_not_history_otto_220_*.md`
and the lint at `tools/lint/doc-comment-history-audit.sh`.

### name-attribution role references

**Rule:** factory-authored docs and code comments use role
references ("the human maintainer", "external AI collaborator",
"the loop-agent", "the threat-model reviewer", "the
documentation agent", "the security reviewer") rather than
direct contributor or agent names. History files, memory files,
and verbatim-preserved ferry absorbs are carved out — they
legitimately carry names.

**Source:** name-attribution discipline (multiple memory
entries; see the consolidated current-state memory index).

### verbatim-preserve vs factory-authored

**Rule:** ferry-absorb documents (`docs/aurora/**` external-
research imports) are VERBATIM-preserved external research
substrate. The verbatim body is content-preservation (no
rewrites for typos, consistency, or current-convention
alignment). Factory-authored header and absorb-notes
sections ARE editable under the name-attribution +
code-comments disciplines.

**Source:** verbatim-preservation memories + Otto-112.

### glass-halo first-party vs third-party PII

**Rule:** two tiers on absorbed conversation content:

- **First-party** (the human maintainer's own
  information): glass-halo default → leave intact. No
  redaction on the maintainer's behalf.
- **Third-party** (someone else): defer to human-
  maintainer + threat-model reviewer; no unilateral
  agent redaction.

The tier turns on whose information is IN the passage, not
who the speaker is.

**Source:** `memory/feedback_glass_halo_first_party_aaron_consent_no_redaction_of_his_own_content_otto_231_*.md`

### auto-merge-always at PR-open-time

**Rule:** every `gh pr create` is immediately followed by
`gh pr merge <N> --auto --squash`. Opening without arming
auto-merge leaves the PR sitting at BLOCKED/CLEAN waiting
on manual merge — the exact throughput hole the autonomous
loop was built to close.

**Source:** `memory/feedback_always_enable_auto_merge_on_every_pr_at_open_time_otto_224_*.md`

### drain loop has three axes

**Rule:** a PR auto-merges only when ALL THREE clear:
(1) zero unresolved review threads, (2) all required CI
checks pass, (3) branch has no merge conflict with main
(`mergeStateStatus != "DIRTY"`). Every tick survey all
three. Dispatch subagents for whichever axis each PR needs.

**Source:** `memory/feedback_drain_loop_includes_dirty_conflict_state_not_just_threads_and_checks_otto_228_*.md`

### hot-file cascade → bulk-close

**Rule:** when N>5 PRs share a single hot-append file AND
the file is append-only AND the PR content is historical
audit-trail (captured by downstream main state), the correct
disposition is bulk-close-as-superseded, not rebase-and-
merge. Every merge of an append-only-file sibling
re-DIRTIES the other N-1 in the cluster; parallel rebase
under cascade is negative-throughput.

**Source:** `memory/feedback_hot_file_cascade_bulk_close_as_superseded_over_sisyphean_rebase_otto_232_*.md`

Three-signal confirmation required before bulk-closing.

### subagent fresh-session quality gap

**Rule:** dispatched subagents have CLAUDE.md, the dispatch
prompt, and in-repo `Read` access (including the in-repo
`memory/` tree). They do NOT share the dispatching
session's in-memory context, and recently-captured
discipline that has not yet synced into in-repo
`memory/feedback_*.md` is invisible to them. Mitigations
in effect:

1. Every dispatch prompt carries explicit constraints for
   the rules that apply to the target files (append-only,
   verbatim-preserve, code-comments-not-history, etc.).
2. Every dispatch prompt includes a **pre-edit header-scan
   step**: Read the first 100 lines of every conflicted /
   edited file; apply any file-local discipline sections
   found.
3. This file (`docs/FACTORY-DISCIPLINE.md`) is in-repo and
   reachable by subagents via `Read`, and points at the
   in-repo `memory/feedback_*.md` entries for deeper
   context.

**Source:** `memory/feedback_subagent_fresh_session_quality_gap_missing_rules_debug_otto_230_*.md`

The upstream structural fix — periodic sync from the
per-maintainer factory-personal staging store into the
in-repo `memory/` tree — is live (see `memory/README.md`
and `GOVERNANCE.md` §18). Post-sync, subagents read the
authoritative memory directly; this file is the
short-form index on top.

### serial PR open, parallel thread drain

**Rule:** opening new PRs = serial (one at a time, wait
for review, address, then next). Draining threads on
existing open PRs = parallel (fan out via subagents with
worktree isolation, batch 3-8).

**Source:** `memory/feedback_serial_pr_flow_wait_for_review_comments_before_opening_next_pr_otto_225_*.md`
and `memory/feedback_dispatch_subagents_with_worktrees_to_drain_pr_threads_in_parallel_otto_226_*.md`

### post-drain AceHack-first routing

**Rule:** once the current Zeta drain completes (queue
<= 20 open, no stuck review-drain PRs), new PRs go to
`acehack/Zeta` first (personal GitHub, unlimited Copilot
via ServiceTitan billing) for Copilot review, THEN push
to `Lucent-Financial-Group/Zeta` for merge. Does NOT
authorize two-hop during drain-mode (worsens saturation).

**Source:** `memory/feedback_post_drain_prs_to_acehack_first_for_copilot_then_push_to_lfg_otto_223_*.md`

### branch-protection strict=false + branch-protection-PATCH via API

**Rule:** `required_status_checks.strict: false` on
`Lucent-Financial-Group/Zeta` so BEHIND PRs can auto-merge
without manual rebase. `allow_auto_merge: true` +
`delete_branch_on_merge: true` on `AceHack/Zeta` fork so
both repos support the AceHack-first flow.

**Source:** Otto-223 branch-protection + GitHub-settings
live-edit memories.

### cross-harness skill discovery

**Rule:** Claude Code does NOT read `.agents/skills/`
(verified empirically); Codex + Gemini DO read it. Placement:

- Generic skills → `.agents/skills/<name>/SKILL.md` (Codex +
  Gemini) + `.claude/skills/<name>/SKILL.md` (Claude, until
  it joins the convention)
- Harness-specific skills → that harness's canonical dir
  only. Behaviour / data split: SKILL.md bodies carry
  behaviour with per-harness tweaks; shared `docs/`
  content carries data.

**Source:** `memory/feedback_cross_harness_skill_discovery_verified_canonical_home_per_harness_otto_227_*.md`

### three-outcome model per review thread

**Rule:** when addressing a review thread, pick ONE of
three legitimate outcomes; no silent bailout:

1. **Fix in place** — small, localised fix lands in this PR.
2. **Narrow fix + BACKLOG row** — partial fix in this PR,
   deeper cleanup tracked as a new BACKLOG row cited in
   the thread reply.
3. **Backlog only + resolve** — proper solution is
   architectural; file a BACKLOG row, reply with the
   link, resolve the thread.

No LOC cap on which outcome applies; judgement call per
thread.

**Source:** Otto-226 + Otto-227 three-outcome-model
memories.

---

### missing-file search surfaces

When a file, target, or reference appears "missing"
(verify-before-deferring per `CLAUDE.md`, Otto-257
recovery, Otto-230 fresh-session quality-gap), search
across these classes before declaring loss. Subagents
in particular cannot see most agent-state surfaces, so
the list also doubles as a coverage map for what
authoritative state lives where.

**In-tree (working copy):**

- Untracked scratch dirs surfaced by `git status` —
  e.g. `drop/`, `.playwright-mcp/`.
- Subagent worktrees: actual checkouts at
  `.claude/worktrees/agent-<id>/` PLUS git metadata at
  `.git/worktrees/<name>/`. Authoritative listing is
  `git worktree list`. After a manual delete of the
  working-copy path, run `git worktree prune` to clear
  the orphaned metadata.
- `.gitignore`d sidecars: `.btw-queue.md` (session-scope
  TodoWrite alternative), `.memory-sync-state.json`
  (Otto-242 sync ledger).
- Sparse-checked-out siblings (e.g. `../runtime` for
  dotnet/runtime offline navigation).

**Git-managed but not on `main`:**

- Other branches: `git log --all -- <path>` /
  `git branch -a --contains <sha>`.
- Stashes: `git stash list` + `git stash show -p
  stash@{N}`.
- Reflog: `git reflog` (orphans pre-force-push or
  pre-`reset --hard`).
- Dangling objects: `git fsck --lost-found` (commits
  and blobs no ref points at).
- Deleted-in-history: `git log --diff-filter=D --all --
  <path>` to find the commit that deleted it.
- Renamed: `git log --follow <path>` /
  `git log --find-renames=N`.
- Tags: `git tag -l` + `git show <tag>` — a tag can
  point at a commit no branch reaches.
- Notes: `git notes list` — git-notes attached to
  commits; not visible in `git log` by default.
- Submodules: `.gitmodules` + `git submodule status` —
  embedded sub-repos with their own histories.
- Bundles: `*.bundle` files in-tree — portable git
  archives that may carry orphan history.
- Hooks: `.git/hooks/` (local) vs `tools/git/hooks/`
  (committed) — Zeta keeps committed hooks
  installable; the local copy may be stale.

**In-repo factory state:**

- `memory/persona/<name>/NOTEBOOK.md` and
  `OFFTIME.md` — per-persona scratchpads, separate
  from the canonical `memory/feedback_*.md` store.
- `docs/hygiene-history/` — append-only audit trail
  (per Otto-229; never edit prior rows).
- `docs/hygiene-history/tick-history/` — per-writer
  tick files when multi-instance lands (Otto-240).
- `docs/pr-preservation/` — drain-logs and PR
  conversation extraction (Otto-250).
- `docs/research/` — courier-ferry research and
  research-grade reports (Aurora absorbs).
- `docs/ROUND-HISTORY.md` and `docs/DECISIONS/` —
  history docs (vs current-state docs); a fact may
  live in an ADR rather than the live spec.

**GitHub-side (not yet preserved in-repo):**

- Open PRs: `gh pr list` + `gh pr diff <n>` (content
  may live on a feature branch awaiting merge).
- Closed-not-merged PRs (Otto-264 row tracks recovery
  of 14 such branches).
- Forks (contributor forks pre-PR; Aaron's fork +
  others).
- PR review threads / comments — Otto-113 + Otto-250
  git-native PR-preservation owe extraction; until
  those land, the discussion substrate lives
  GitHub-side only.
- GitHub Discussions and Wiki — covered by the
  `github-surface-triage` capability skill.
- Issues with attached files.
- Actions artifacts: `gh run download <run-id>` for
  CI-uploaded outputs.
- Releases (release-attached binaries / assets).

**Out-of-repo agent state:**

- Anthropic per-project AutoMemory at
  `~/.claude/projects/<slug>/memory/` — invisible to
  subagents (Otto-230 visibility gap). Per
  `GOVERNANCE.md` §18 the in-repo `memory/` tree is
  canonical; the global path is staging.
- Anthropic global skills: `~/.claude/skills/`.
- Plugin caches: `~/.claude/plugins/cache/`.
- Other harness state: Codex `.codex_index/`, Gemini
  `.gemini/`.
- Live cron / RemoteTrigger / CronCreate jobs —
  authoritative listing via `CronList`; a scheduled
  task may exist as state without a file in-repo.
- Sibling LFG repos: `lucent-ksk`, other org repos —
  content referenced from Zeta may live in a sibling
  repo (Zeta is not the only repo in the org).
- GitHub gists owned by the user — referenced in
  research notes; tied to user identity, not repo.

**Local-machine substrates:**

- macOS Time Machine + APFS local snapshots —
  `tmutil listlocalsnapshots /` lists APFS-level
  snapshots that may contain a recently-deleted file.
- Trash: `~/.Trash/` (per-volume `/Volumes/*/.Trashes/`
  for external drives) — recently deleted files.
- IDE local-history surfaces: `.vscode/.history/` (VS
  Code History extension), `.idea/shelf/` and
  `.idea/workspace.xml` (JetBrains LocalHistory),
  `.vs/` (Visual Studio).
- Filesystem-extended attributes: `xattr -l <path>`
  for macOS metadata, `mdfind` for Spotlight index
  (find files by content even after rename).
- Devcontainer / Docker volumes — if the repo is run
  in a containerised dev env, Docker-managed volumes
  hold state outside the working tree.
- Terminal scrollback / shell history (`~/.zsh_history`
  for zsh) — last-resort recovery of a recently-typed
  inline content.

**External substrates (pre-absorption):**

- Courier-ferry imports (research from peer harnesses
  not yet absorbed via PR).
- External-conversation transcripts pre-archive-header
  per `GOVERNANCE.md` §33.
- Local diagnostic reports
  (`~/Library/Logs/DiagnosticReports/` for the .NET
  GC SIGSEGV `.ips` files referenced in the
  Apple-Silicon backlog row).

**Index-integrity check that bites:**

- A file in `memory/*.md` without a pointer row in
  `memory/MEMORY.md` is invisible to fresh sessions
  even when it exists on disk. The index IS the
  discovery mechanism. Always pair the file landing
  with the index row in the same commit.

**Source:** Aaron 2026-04-24 quiz directive *"wherever
are all the places you could look for missing files /
we should probably keep a list check in somewhere"*.
Composes with Otto-230 (fresh-session-quality-gap),
Otto-264 (LOST-branch recovery), Otto-242 (sidecar
pattern), Otto-250 (PR-preservation), and the
`verify-before-deferring` rule in `CLAUDE.md`.

---

## What this file is NOT

- Not authoritative. The in-repo `memory/feedback_*.md`
  files are authoritative; this file is a short-form
  pointer.
- Not a full rule list. Stable rules live in
  `docs/AGENT-BEST-PRACTICES.md` (BP-NN). Session-captured
  corrections are distilled here only where they matter
  for subagent dispatch.
- Not auto-maintained. Updates to this file are written
  manually when a new `memory/feedback_*.md` entry
  introduces a discipline worth indexing for subagents.

## Read more

- `CLAUDE.md` — session bootstrap + pointer tree
- `docs/AGENT-BEST-PRACTICES.md` — stable BP-NN rule list
- `GOVERNANCE.md` — numbered repo-wide rules
  (see §18 for the memory-store invariant)
- `docs/CONFLICT-RESOLUTION.md` — specialist review roster
- `docs/WONT-DO.md` — declined features / refactors
- `memory/README.md` — in-repo memory-store layout and
  sync policy
- `memory/MEMORY.md` — canonical in-repo index of
  authoritative session-captured discipline; reachable
  by both the dispatching session and dispatched
  subagents via `Read`.
