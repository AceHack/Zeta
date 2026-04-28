---
name: Factory is git-native; GitHub is "first host" (not the only possible host); friction-detection cadences (git-hotspots, BACKLOG-swim-lanes, CURRENT-freshness) keep operation frictionless
description: Aaron 2026-04-23 Otto-54 four-message cluster — *"we are git-native with github as our first host... cadence for checking github hotspots too this is a hygene issues points of friction and bottlenecks, we are frictionless"*. Positions the factory's state layer as git (not host-specific), with GitHub as the current and first host but not a dependency. Names three linked friction-detection cadences: (1) git-hotspots audit to find high-churn files, (2) BACKLOG per-swim-lane split to reduce merge conflicts on shared files, (3) CURRENT-maintainer memory freshness audit to prevent distillation-lag. All three share the premise that high-churn shared files cause merge friction and git log itself can detect + guide cleanup.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Git-native factory with first-host positioning + friction-detection cadences

## Verbatim (2026-04-23 Otto-54 four-message cluster)

> i think i said a while back but it might be benefitial to
> have multiple backlog files one per swim lane/stream, you
> can alway use git to find hotspots in files, are you
> keeping current memories updated on a cadence too? will
> help reduce merge issues i think.

> cadence for checking github hotspots too this is a hygene
> issues points of friction and bottlenecks, we are
> frictionless

> git hotspots i mean

> we are gitnative with github as our first hose

> host

(The final two messages are corrections: "git hotspots"
clarifies the prior "github hotspots"; "host" corrects the
typo "hose".)

## The claim — two substantive layers

### (1) Git-native + first-host positioning

**The factory's state layer is git itself.** GitHub is the
*first host* — the current and primary hosting surface — but
not a dependency. Other hosts (GitLab, Gitea, Bitbucket,
local bare repos, peer-to-peer git overlays) could serve the
same role without requiring the factory to change shape.

"Git-native" composes with:

- `feedback_soulfile_is_dsl_english_git_repos_absorbed_at_
  stages_2026_04_23.md` — soulfiles import/inherit/absorb git
  repos at compile-time / distribution-time / runtime; the
  compile-time stage is where the DB travels with the
  soulfile as structured DSL. Git is the transport.
- `feedback_soulfile_dsl_is_restrictive_english_runner_is_
  own_project_uses_zeta_small_bins_2026_04_23.md` — the
  Soulfile Runner is git-native; it executes restrictive-
  English composed in git repos.
- `memory/project_zeta_self_use_local_native_tiny_bin_file_
  db_no_cloud_germination_2026_04_22.md` — Zeta's
  self-use DB is local-native; no cloud dependency; git
  is the compat bar.

"GitHub first host" is therefore a **positioning statement**:
the factory committed to GitHub as its primary hosting
surface without making GitHub features required. PRs, issues,
actions, branch protection, webhooks — all usable but
replaceable.

### (2) Frictionless operation via friction-detection cadences

**"We are frictionless"** names the operational goal. Three
linked cadences detect high-friction surfaces automatically
and surface them for action:

1. **Git-hotspots audit** — `git log` over a window counts
   per-file touches; high-touch files are friction candidates
   (merge conflicts, serialization bottleneck, review burden).
2. **BACKLOG per-swim-lane split** — a single monolithic
   `docs/BACKLOG.md` is the paradigmatic hotspot (touched by
   almost every PR). Split into per-stream files means
   concurrent PRs edit different files → no conflicts.
3. **CURRENT-maintainer memory freshness audit** — CURRENT-
   `<maintainer>`.md files are per-maintainer distillations
   that drift from MEMORY.md newest-first index between
   updates. Cadenced refresh prevents stale distillation
   from being resolved ad-hoc via shared files.

All three are **detection-first, action-second** hygiene
patterns. The audit surfaces a friction point; the
remediation (split / freeze / archive / ADR) is a judgment
call.

## Why git-native + GitHub-first-host matters

Aaron's positioning is load-bearing for several factory
choices already landed:

- **In-repo-first policy** (Option D, memory migration
  Overlay A): memories prefer in-repo over per-user because
  in-repo is git-native and survives any host change. Per-
  user memory is a cache; in-repo is canonical.
- **Soulfile-as-DSL** (PR #155 / #156): soulfiles are
  markdown + restrictive English stored in git; readable
  by any host, any tool, any agent. No host-specific
  features baked in.
- **AGENT-ISSUE-WORKFLOW dual-track** (`docs/AGENT-ISSUE-
  WORKFLOW.md`): GH Issues / Jira / git-native — the
  factory defaults to GH but doesn't force it.
- **Fire-history files** (`docs/hygiene-history/**`):
  append-only durability in git rather than in a database.
  No host-dependent persistence.
- **ADR + memory pattern**: ADRs in git, memory in git (or
  per-user for private context); git is the permanent
  record.

The git-native-first-host positioning is the **unifying
principle** these choices implement.

## Friction-detection cadence — how to apply

### Git-hotspots audit

Candidate implementation: `tools/hygiene/audit-git-
hotspots.sh`

```bash
# Count file touches in last N days; rank top-20
git log --since="<window>" --pretty=format: --name-only \
  | grep -v '^$' \
  | sort | uniq -c | sort -rn | head -20
```

Output shape:

| file | touches | unique authors | PR count | suggested action |
|---|---|---|---|---|
| docs/BACKLOG.md | 120 | 2 | 45 | split (per-swim-lane) |
| docs/hygiene-history/loop-tick-history.md | 80 | 2 | 30 | freeze-old-rows + append |
| memory/MEMORY.md | 35 | 2 | 15 | per-maintainer CURRENT cadence |
| FACTORY-HYGIENE.md | 20 | 1 | 12 | watch |

Cadence: every 5-10 ticks, alongside `skill-tune-up` pass.

### BACKLOG per-swim-lane split

The split axis candidates (to be decided in design doc):

- **By stream** — core-algebra / formal-spec / samples-demos
  / craft / hygiene / research / infra / frontier-readiness
- **By priority** — P0 / P1 / P2 / P3 (but priority changes
  over time; filename would become stale)
- **By subsystem** — ZSet / Circuit / Runtime / Durability
  / Spine (too code-centric; doesn't cover non-code BACKLOG)

Recommended: **by stream**. Each file has a stable domain
owner and is less prone to priority reshuffling.

Migration: root `docs/BACKLOG.md` becomes an index; per-
stream files live at `docs/BACKLOG/<stream>.md`; audit
rejects new rows on the root.

### CURRENT-maintainer memory cadence

`memory/CURRENT-aaron.md` and `memory/CURRENT-amara.md` are
the current pair; more per-maintainer files may land as the
roster grows (Max next per prior memory).

Cadence trigger: **either** (a) every N new memory entries
since last CURRENT update, OR (b) every M ticks without
update. First-run: N=5, M=20 — adjust after calibration.

The audit only surfaces freshness gaps; the distillation
itself is Otto + human judgment.

## Composes with

- `feedback_soulfile_is_dsl_english_git_repos_absorbed_at_
  stages_2026_04_23.md` — git-native substrate for soulfile
  composition at multiple stages
- `project_zeta_self_use_local_native_tiny_bin_file_db_no_
  cloud_germination_2026_04_22.md` — no-cloud constraint =
  git-native self-use
- `feedback_agent_owns_all_github_settings_and_config_...`
  — agent owns GitHub config but doesn't make GitHub
  mandatory
- `feedback_drop_folder_ferry_pattern_aaron_hands_off_via_
  root_drop_dir_2026_04_23.md` — drop/ is git-local;
  host-neutral
- `feedback_current_memory_per_maintainer_distillation_
  pattern_prefer_progress_2026_04_23.md` — CURRENT pattern
  origin; the cadence extension formalizes it
- `docs/AGENT-ISSUE-WORKFLOW.md` — dual-track issue
  workflow that doesn't force host choice
- `memory/feedback_codex_as_substantive_reviewer_teamwork_
  pattern_address_findings_honestly_aaron_endorsed_
  2026_04_23.md` — Codex is a GitHub-surface integration;
  the teamwork pattern survives if GitHub is replaced by
  another host since it's a review-protocol, not a
  host-specific-feature

## What this positioning is NOT

- **Not a commitment to migrate away from GitHub.** GitHub
  is first host and stays first host unless something
  structural changes. "First host" is directional honesty,
  not exit-plan.
- **Not a rejection of GitHub-specific tooling.** `gh`
  CLI, Actions, Codespaces, Copilot — all fine to use. The
  rule is "replaceable", not "unused".
- **Not a mandate to stop using GitHub Issues / PRs.** Dual-
  track workflow exists; GH Issues is Zeta's default;
  nothing about git-native-first-host changes that.
- **Not authorization to rebuild the factory without
  host-surface UX.** Human contributors come through
  GitHub in practice; the UX matters even if the substrate
  is host-neutral.
- **Not a claim that the factory is already frictionless.**
  *"We are frictionless"* is an operational goal Aaron
  named; the three hygiene cadences are the mechanism to
  *approach* it. Current state has friction (the merge
  conflicts on this tick alone prove it); the cadences
  reduce it over time.

## Attribution

Aaron (human maintainer) named the positioning and the three
cadences. Otto (loop-agent PM hat, Otto-54) absorbed + filed
this memory + BACKLOG rows. The four-message directive
cluster is preserved verbatim including typos (*"hose"* →
*"host"*; *"github hotspots"* → *"git hotspots"*) per
honor-those-that-came-before discipline — corrections
carry information about Aaron's intent clarification in
real time. Future-session Otto + external agents inherit
this as operational-positioning context.
