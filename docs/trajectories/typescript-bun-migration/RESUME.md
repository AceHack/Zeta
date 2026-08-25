# Trajectory — TypeScript / Bun migration

**Status**: Closed-maintained bash-retirement phase (Lane B slice 21 merged — [#908](https://github.com/Lucent-Financial-Group/Zeta/pull/908); bash-retirement inventory guard landed — [#2764](https://github.com/Lucent-Financial-Group/Zeta/pull/2764); **Bucket B is empty**; retained non-Lean shell surface is the repo-wide setup/bootstrap/service-wrapper/installer/dev-cluster allowlist)
**Milestone**: 43 ported. All clusters complete: budget (14/18/19), peer-call (15/16/17), git (13/20), pr-preservation (21), cluster-inventory capture. Bucket B is empty as of 2026-04-30T08:07:32Z. The remaining non-Lean shell-family inventory is guarded repo-wide by `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts` and wired through package script `hygiene:check-bash-retirement-inventory` plus the `gate.yml` bash-retirement inventory lint job.
**Current blocker**: None.
**Next concrete action**: Maintain the bash-retirement inventory guard and treat
any newly tracked non-Lean shell-family file outside the allowlist as drift. Do
not revive the old Cluster G/H/I or budget-cluster port queues.
**Last updated**: 2026-05-28T12:35Z

## Why this trajectory exists

Per 081KQ8P5D0008QG0R003BFZPRC + maintainer-channel input 2026-04-29: TypeScript on Bun is the factory's default scripting language going forward. The migration is incremental — one coherent slice at a time, each PR a measurable increment.

Per the maintainer-channel correction via the multi-AI review surface (2026-04-29): this is the trajectory the maintainer cares about. The CodeQL host-ownership investigation was the _blocker_, not the trajectory.

> _Carved: CodeQL was the blocker. TypeScript/Bun is the trajectory._

## Landed slices

| PR                                                                | Date                          | Files                                                                                                                                                                     | Status |
| ----------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [#849](https://github.com/Lucent-Financial-Group/Zeta/pull/849)   | 2026-04-29 (commit `40344c9`) | `tools/hygiene/sort-tick-history-canonical.{py→ts}`, `tools/hygiene/fix-markdown-md032-md026.{py→ts}`                                                                     | Merged |
| [#866](https://github.com/Lucent-Financial-Group/Zeta/pull/866)   | 2026-04-30 (commit `d3b0be8`) | `tools/hygiene/audit-md032-plus-linestart.{sh→ts}`, `tools/hygiene/audit-memory-index-duplicates.{sh→ts}`, `tools/hygiene/audit-memory-references.{sh→ts}`                | Merged |
| [#868](https://github.com/Lucent-Financial-Group/Zeta/pull/868)   | 2026-04-30 (commit `b1dab4d`) | `tools/hygiene/audit-machine-specific-content.{sh→ts}`, `tools/hygiene/audit-git-hotspots.{sh→ts}`, `tools/hygiene/audit-cross-platform-parity.{sh→ts}`                   | Merged |
| [#870](https://github.com/Lucent-Financial-Group/Zeta/pull/870)   | 2026-04-30 (commit `cab59ca`) | `tools/alignment/audit_archive_headers.{sh→ts}`, `tools/alignment/audit_personas.{sh→ts}`, `tools/alignment/audit_commit.{sh→ts}`                                         | Merged |
| [#872](https://github.com/Lucent-Financial-Group/Zeta/pull/872)   | 2026-04-30 (commit `2f3275a`) | `tools/alignment/audit_skills.{sh→ts}`, `tools/alignment/citations.{sh→ts}`                                                                                               | Merged |
| [#874](https://github.com/Lucent-Financial-Group/Zeta/pull/874)   | 2026-04-30 (commit `3f33b51`) | `tools/hygiene/audit-tick-history-bounded-growth.{sh→ts}`, `tools/hygiene/audit-post-setup-script-stack.{sh→ts}`, `tools/hygiene/audit-missing-prevention-layers.{sh→ts}` | Merged |
| [#876](https://github.com/Lucent-Financial-Group/Zeta/pull/876)   | 2026-04-30 (commit `02baabc`) | `tools/hygiene/check-no-conflict-markers.{sh→ts}`, `tools/hygiene/check-archive-header-section33.{sh→ts}`, `tools/hygiene/check-tick-history-order.{sh→ts}`               | Merged |
| [#878](https://github.com/Lucent-Financial-Group/Zeta/pull/878)   | 2026-04-30                    | `tools/lint/no-empty-dirs.{sh→ts}`, `tools/lint/safety-clause-audit.{sh→ts}`, `tools/lint/doc-comment-history-audit.{sh→ts}`                                              | Merged |
| [#880](https://github.com/Lucent-Financial-Group/Zeta/pull/880)   | 2026-04-30 (commit `988de70`) | `tools/lint/runner-version-freshness.{sh→ts}`, `tools/lint/no-directives-otto-prose.{sh→ts}`, `tools/audit/live-lock-audit.{sh→ts}`                                       | Merged |
| [#882](https://github.com/Lucent-Financial-Group/Zeta/pull/882)   | 2026-04-30 (commit `02266a7`) | `tools/hygiene/validate-agencysignature-pr-body.{sh→ts}`, `tools/hygiene/audit-agencysignature-main-tip.{sh→ts}`, `tools/hygiene/capture-tick-snapshot.{sh→ts}`           | Merged |
| [#883](https://github.com/Lucent-Financial-Group/Zeta/pull/883)   | 2026-04-30 (commit `271bc38`) | `tools/hygiene/counterweight-audit.{sh→ts}`, `tools/hygiene/append-tick-history-row.{sh→ts}`                                                                              | Merged |
| [#884](https://github.com/Lucent-Financial-Group/Zeta/pull/884)   | 2026-04-30 (commit `9237756`) | `tools/skill-catalog/backfill_dv2_frontmatter.{sh→ts}`, `tools/audit-packages.{sh→ts}`                                                                                    | Merged |
| [#2764](https://github.com/Lucent-Financial-Group/Zeta/pull/2764) | 2026-05-12 (commit `b563ba0`) | `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts`, `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.test.ts`                                   | Merged |

## Inventory — Python (tools/, Zeta-authored)

**Status: 0 remaining.**

After PR #849, Zeta has zero Python files in `tools/` (Zeta-authored — the 22 `.py` files under `tools/lean4/.lake/packages/mathlib/scripts/` are mathlib upstream, not in scope). Python→TS in `tools/` is **100% complete**.

## Inventory — Shell (repo-wide, Zeta-authored, 21 retained files)

Current count is repo-derived and guarded by:

```bash
bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --enforce
bun run hygiene:check-bash-retirement-inventory
```

The expected retained surface is the explicit repo-wide allowlist: setup and
bootstrap scripts, host-service wrappers, NixOS installer scripts,
dev-cluster wrappers, launchd-bootstrap, and the Kiro loop wrapper. Any new
non-Lean shell-family file (`.sh`, `.bash`, `.zsh`, `.ksh`, or `.command`,
including uppercase extension variants) outside the allowlist is
bash-retirement drift. Executable dotted-name files with shell-family shebangs
are also entrypoints and are classified as drift; non-executable dotted
documentation fixtures with shell-looking first lines stay outside the
retained-shell inventory.

### Bucket A — Should stay Shell (21 files)

These either run **before** Bun is installed (post-install scripts can use Bun;
pre-install scripts cannot) or bootstrap macOS launchd into the pinned Bun
environment before handing off to TypeScript. Per Otto-235 4-shell portability
target (macOS bash 3.2 / Ubuntu / git-bash / WSL), these are the bootstrap
layer, or service/installer surfaces that still execute before the
TypeScript/Bun control plane is available.

```text
.gemini/service/install-lior-service.sh
.gemini/service/lior-loop.sh
full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh
full-ai-cluster/usb-nixos-installer/zeta-install.sh
tools/kiro/kiro-loop-wrapper.sh
tools/kiro/launchd/install.sh
tools/setup/install.sh
tools/setup/doctor.sh
tools/setup/linux.sh
tools/setup/macos.sh
tools/setup/common/curl-fetch.sh
tools/setup/mechanisms/from-dotnet-global.sh
tools/setup/mechanisms/from-elan.sh
tools/setup/common/mise.sh
tools/setup/common/profile-edit.sh
tools/setup/mechanisms/from-uv-tool.sh
tools/setup/common/shellenv.sh
tools/setup/common/verifiers.sh
```

Rationale: TS/Bun is itself one of the things `install.sh` installs, and
launchd needs a small shell bootstrap to establish PATH/state before `exec`
hands control to Bun. The `full-ai-cluster/tools/cluster-inventory/capture.sh`
entrypoint has been retired in favor of
`full-ai-cluster/tools/cluster-inventory/capture.ts`.

### Bucket B — Should become TypeScript (0 files remaining — empty as of 2026-04-30T08:07:32Z)

Post-install scripts that operate on the repo (lints, audits, hygiene checks, peer-call wrappers, budget reports, git ops). All 42 ports landed across PRs #849, #866, #868, #870, #872, #874, #876, #878, #880, #882, #883, #884, #885, #892, #894, #896, #898, #900, #901, #902, #907, #908. Cluster summary:

- **budget cluster** (slices 14/18/19) — complete: snapshot-burn / daily-cost-report / project-runway
- **peer-call cluster** (slices 15/16/17) — complete: grok / gemini / codex
- **git cluster** (slices 13/20) — complete: push-with-retry / batch-resolve-pr-threads
- **pr-preservation cluster** (slice 21) — complete: archive-pr

Bucket B/D bash originals have retired from the tracked non-Lean shell
surface. Bucket C scripts (check-github-settings-drift,
snapshot-github-settings) had their `.sh` originals deleted upon porting.
See "Soak + bash-retirement phase" actions in the status line at the top of
this doc.

### Bucket C — ~~Needs human decision~~ Ported (2 files)

Ported to TypeScript in the 081KQGDBJ0008QG0R000A4EZS5 PR. Both scripts use `gh api` via
`Bun.spawn` shell-out (option (a) — keeps `gh` as the auth + HTTP layer,
same as the bash originals).

```text
tools/hygiene/check-github-settings-drift.ts   # was .sh
tools/hygiene/snapshot-github-settings.ts       # was .sh
```

### Bucket D — Ported, bash retained (0 tracked files; historical list)

The TS ports landed across PRs #866, #868, #870, #872, #874, #876, #878, #880, #882, #883, #884, #885, #892, #894, #896, #898, #900, #901, and #902.
The bash originals listed below are now historical references, not
tracked live files; the bash-retirement inventory check fails if any
equivalent post-install `.sh` surface reappears outside the repo-wide retained
shell allowlist.

**Removed 2026-05-03 (CI-workflow .sh→.ts conversion completed):** the 5 files
listed in #1376's risk-stratification (audit-memory-index-duplicates,
audit-memory-references, check-archive-header-section33, check-no-conflict-markers,
check-tick-history-order) were removed after #1377 / #1378 / #1380 converted
all 3 workflows that referenced them (memory-index-duplicate-lint.yml,
memory-reference-existence-lint.yml, gate.yml). #1379 was the prerequisite
allowlist-parity fix to check-no-conflict-markers.ts.

```text
tools/hygiene/audit-md032-plus-linestart.sh        # ported in #866
tools/hygiene/audit-machine-specific-content.sh    # ported in #868
tools/hygiene/audit-git-hotspots.sh                # ported in #868
tools/hygiene/audit-cross-platform-parity.sh       # ported in #868
tools/alignment/audit_archive_headers.sh           # ported in #870
tools/alignment/audit_personas.sh                  # ported in #870
tools/alignment/audit_commit.sh                    # ported in #870
tools/alignment/audit_skills.sh                    # ported in #872
tools/alignment/citations.sh                       # ported in #872
tools/hygiene/audit-tick-history-bounded-growth.sh # ported in #874
tools/hygiene/audit-post-setup-script-stack.sh     # ported in #874
tools/hygiene/audit-missing-prevention-layers.sh   # ported in #874
tools/lint/no-empty-dirs.sh                        # ported in #878
tools/lint/safety-clause-audit.sh                  # ported in #878
tools/lint/doc-comment-history-audit.sh            # ported in #878
tools/lint/runner-version-freshness.sh             # ported in #880
tools/lint/no-directives-otto-prose.sh             # ported in #880
tools/audit/live-lock-audit.sh                     # ported in #880
tools/hygiene/validate-agencysignature-pr-body.sh  # ported in #882
tools/hygiene/audit-agencysignature-main-tip.sh    # ported in #882
tools/hygiene/capture-tick-snapshot.sh             # ported in #882
tools/hygiene/counterweight-audit.sh               # ported in #883
tools/hygiene/append-tick-history-row.sh           # ported in #883
tools/skill-catalog/backfill_dv2_frontmatter.sh    # ported in #884
tools/audit-packages.sh                            # ported in #884
tools/backlog/generate-index.sh                    # ported in #885
tools/git/push-with-retry.sh                       # ported in #892
tools/budget/snapshot-burn.sh                      # ported in #894
tools/peer-call/grok.sh                            # ported in #896 (peer-call cluster opens)
tools/peer-call/gemini.sh                          # ported in #898 (peer-call sibling)
tools/peer-call/codex.sh                           # ported in #900 (peer-call cluster closes)
tools/budget/daily-cost-report.sh                  # ported in #901 (budget wrapper)
tools/budget/project-runway.sh                     # ported in #902 (budget cluster closes)
```

## Atomic child candidate

**Child**: refresh the TS/Bun migration live-state references.

**Why this child exists**: the repo has moved beyond the older
"Recommended next slice" queue. Live inventory now shows the peer-call, lint,
budget, and git Bucket B scripts as `.ts` files. The former Bucket C
GitHub-settings scripts have also been ported (081KQGDBJ0008QG0R000A4EZS5).

**Live verification (2026-05-11)**:

- Upstream-source dates in `docs/best-practices/typescript.md`,
  `docs/best-practices/bun.md`, and
  `docs/best-practices/repo-scripting.md` remain inside the default
  30-day Gate B window.
- Sibling comparison points were rechecked read-only:
  `/Users/acehack/Documents/src/repos/SQLSharp` is at short SHA
  `7d3d9f6`; `/Users/acehack/Documents/src/repos/scratch/package.json`
  mtime is `2026-04-15T22:06:37-0400`; and
  `/Users/acehack/Documents/src/repos/scratch/tsconfig.json` mtime is
  `2026-04-15T03:18:20-0400`.
- Focused inventory returns only `.ts` paths for the peer-call, lint,
  budget, git, and GitHub-settings targets listed below. Any `.sh`
  result in that set is drift.
- DST + coverage gate: this child is docs/control-plane only and adds no
  runtime module or port. Per-port DST and coverage evidence remains in
  `slice-audits.md`; the next code-bearing slice must re-run its own
  Gate A checklist.

**Scope**: documentation/control-plane only. Update this resume so future
agents do not revive already-completed Cluster G/H/I and budget-cluster port
queues.

**Non-scope**: do not port or delete scripts in this child. Bucket C is
already ported through the documented `gh api` shell-out-wrapper pattern; this
child records that live state instead of reopening the shell-out-wrapper versus
Octokit decision.

**Focused check**:

```bash
rg --files tools/peer-call tools/lint tools/budget tools/git tools/hygiene \
  | rg '(peer-call/(codex|gemini|grok)\.(sh|ts)|lint/(no-empty-dirs|runner-version-freshness|no-directives-otto-prose|doc-comment-history-audit)\.(sh|ts)|budget/(daily-cost-report|project-runway|snapshot-burn)\.(sh|ts)|git/(batch-resolve-pr-threads|push-with-retry)\.(sh|ts)|hygiene/(check-github-settings-drift|snapshot-github-settings)\.(sh|ts))'
```

**Gate B prerequisite (mandatory before first mutating action on the slice)**:

1. Re-verify currency of `docs/best-practices/typescript.md`, `docs/best-practices/bun.md`, `docs/best-practices/repo-scripting.md` upstream-source dates (default 30-day window).
2. Re-verify sibling-repo comparison points (`../SQLSharp` commit hash, `../scratch` mtime).
3. Confirm DST + coverage gate items in the per-slice checklist apply (or document deferred-check exemption).

## Bun / tooling requirements

- `package.json` already declares `"packageManager": "bun@1.3.13"` and `"engines": { "bun": ">=1.3.13" }` (per PR #849)
- `bun.lock` is committed (per PR #849)
- `.mise.toml` pins `bun 1.3` for CI parity
- ESLint + markdownlint already configured for TS files
- `jiti` 2.6.1 was added in PR #849 as devDep; reused for future ports

## Two-gate quality model (per multi-AI Round 2 + Round 3 convergence)

Every TS/Bun port slice passes through two gates:

### Gate A — slice merge gate

Before a slice merges, all ported files must pass a code-level audit
(not just config / lint / runtime checks). Per-slice audits accumulate
at [`slice-audits.md`](slice-audits.md) — append per slice, never
overwrite. The first slice (PR #866) sets the canonical pattern;
future slices follow the slice template at the bottom of
`slice-audits.md`.

The hard requirements (from `docs/best-practices/typescript.md`):
typed external boundaries, typed domain records, checked
unknown/regex/index/file IO, no unreviewed `any`, no broad unsafe
casts. Plus runtime requirements from `docs/best-practices/bun.md`
(entry guard, atomic file IO, structured spawn classifier).

The full per-slice checklist lives in
`docs/best-practices/repo-scripting.md`.

### Gate B — next-slice prerequisite

Before the **first mutating action** on the next TS/Bun port slice,
the layered Gate B baseline must exist and be current:

- `docs/best-practices/typescript.md` <!-- STALE-REF: ../../best-practices/typescript.md -->
  — language / type-system / typed-linting standard.
- `docs/best-practices/bun.md` <!-- STALE-REF: ../../best-practices/bun.md -->
  — Bun runtime / process / file IO / shell standard.
- `docs/best-practices/repo-scripting.md` <!-- STALE-REF: ../../best-practices/repo-scripting.md -->
  — Zeta composition layer (Zeta-specific scripting conventions +
  per-slice audit checklist).

"First mutating action" = first file edit / commit / push for the
slice. Read-only scoping may happen first.

"Current" = each upstream source listed in the layered docs has been
re-verified within its currency window (default 30 days), OR the
slice's freshness pass re-verifies before proceeding.

> **Carved**:
> _TypeScript is the language. Bun is the host. Repo scripting is the
> composition._
>
> _Do not name the stack. Name the layers._
>
> _The expert baseline is not a new lane. It is the ignition key for
> the next slice._

The trajectory references the layered docs; it does NOT own them.
`docs/best-practices/` is durable substrate that outlives any
specific migration.

## Expert skill still needed (deferred to Lane C)

This audit is a one-off; it doesn't replace the per-tool/language expert + teaching skill (task #351). The skill would self-update on each TS/Bun release and teach the agent at port-time, not just serve as a static reference. The audit lineage above seeds that skill's knowledge base.

**Required**:

- A TS + Bun expert skill (`.claude/skills/`-shape) anchored to current upstream docs (per Otto-364 search-first authority)
- Best-practices map for the latest TS + Bun versions (live-search, not training-data)
- **Teaching role**: the skill transfers the best-practices into agent prose at port-time, not just serves as a static reference
- Composes with task #323 (per-tool/language expert skills — evidence-based + human-lineage-cited + ongoing-trajectory)

**Status**: deferred from this PR (no-fan-out during live lane). After #866 lands, the TS+Bun expert skill becomes a Lane C+ artifact or a sibling trajectory.

**Why this matters for the migration**: each future port or bash-retirement
slice benefits from a current-docs anchor. Without it, ports drift toward
whatever convention the most-recently-read TS file used; with it, ports
converge on contemporary best practice.

## Operating notes (lane-discipline addendum)

These rules apply to this trajectory's execution and are recorded here per the locked discipline that minor lane-discipline additions land in the active lane artifact rather than as standalone doctrine packets.

**Assume stale until refreshed** (positive-frame upgrade landed mid-#866). Freshness is the ignition step, not a lane — not a question — not a permission gate. Before any mutating action on this trajectory, refresh the lane facts. Then act.

Seven-step scaffold:

1. **Assume stale.** Last-known state is presumed stale.
2. **Refresh.** Pull the freshness-check facts (per `Freshness check` section below).
3. **Validate scope.** Confirm RESUME's next slice still matches reality.
4. **Classify boundary.** Apply the four-item authority-boundary checklist below.
5. **Act.** Port / commit / push under standing authority.
6. **Verify.** Run targeted validation (lint, equivalence, narrow tests).
7. **Record.** Update RESUME's `Landed slices` table; surface deferred notes inside this artifact.

**Authority-boundary checklist** (step 4):

- no host mutation
- no destructive git operation
- no permission change
- no merge before CI / review / branch-protection requirements are satisfied

If all four are clean, proceed. The maintainer is not the lane-transition protocol.

### Freshness check (per-trajectory, run before mutation)

```text
git fetch origin main                                      # main SHA current
gh pr list --state open                                    # active PRs visible
gh pr view <self> --json statusCheckRollup,mergeStateStatus  # CI + merge state
gh api graphql -f query='{ repository(owner: "Lucent-Financial-Group", name: "Zeta") { pullRequest(number: <self>) { reviewThreads(first: 50) { nodes { isResolved isOutdated path } } } }'  # unresolved threads
read RESUME.md                                             # next-slice line current
ls tools/hygiene/audit-*.{sh,ts}                           # target files exist
```

If any source is unavailable or known-stale, surface that as a freshness gap rather than completing the pass silently.

**Tick-level vs pre-mutation refresh**: tick-level (per heartbeat) reads main SHA + active PR states + RESUME next-action — fast, low cost. Pre-mutation (before edit/commit/push) reads the full freshness check above. The split bounds upstream API load.

### Drift response (when refresh reveals divergence)

- **Halt-class drift** (pause for input): authority boundary crossed, target files unexpectedly removed/renamed, scope drifted from RESUME, branch protection changed.
- **Reconcile-class drift** (work in-place): CI failure on own PR, new review thread, CI flake, mergeable-state UNSTABLE on non-required check.

### Carved

- _Assume stale until refreshed._
- _Freshness before mutation._
- _Scope before action._
- _Boundaries before escalation._
- _Observation is how autonomy stays attached to reality._

**Discipline bounds autonomous work; it does not replace autonomous work.** Trajectory-scoped standing authority is the safety. The trajectory exists to enable autonomous scoped work, not to create waiting gates. (Earlier "first action must be read-only" wording was self-defeating — it became a wait gate for trajectory-scoped code work it was supposed to enable. "Assume stale until refreshed" inverts the framing from permission-shaped to obligation-shaped: freshness precedes mutation rather than gating it.)

**Counts before percentages.** Track concrete counts and buckets before claiming progress as a percentage. Every percentage requires a defined denominator that is itself mechanically derivable. The Python inventory's "100% complete" is well-defined (denominator = 2 ports, both landed); future progress claims need the same standard.

**Closure summaries are factual, not meta-evaluative.** When closing a slice or lane, record what landed and what's next. Do not include review-surface health observations or self-evaluation paragraphs. The data is in the diff.

## Composes with

- `docs/trajectories/ci-codeql-host-ownership/INVESTIGATION.md` — #849 blocker record (linked here per the trajectory-naming correction)
- 081KQ8P5D0008QG0R003BFZPRC backlog (TS+Bun default scripting language)
- Otto-235 (4-shell portability target — applies to Bucket A only)
- Task #341 (TS port + future git scripts: enforce 3-tier multi-remote design)
- Task #350 (Otto-357 mechanized auditor — when `tools/lint/no-directives-otto-prose.sh` ports to TS, scope expansion ships in same PR)

## Do not do next

- Do **not** port `tools/setup/*` to TS (Bucket A — would break bootstrap)
- Do **not** mass-port multiple clusters in one PR (small slices, each measurable)
- Do **not** open a new investigation lane during a port slice (lane discipline)
- Do **not** treat this RESUME as authoritative for the trajectory direction without maintainer review — it's a starter inventory, refinement expected
- Do **not** revive Cluster G/H/I, budget-cluster, peer-call-cluster, git-cluster,
  or Bucket C porting queues; those are historical audit labels now.
