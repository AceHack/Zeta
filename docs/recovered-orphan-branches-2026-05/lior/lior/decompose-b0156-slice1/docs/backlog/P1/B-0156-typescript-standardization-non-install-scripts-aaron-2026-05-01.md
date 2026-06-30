---
id: B-0156
priority: P1
status: open
title: TypeScript standardization — port every .sh outside install graph + every .py to TS (Aaron 2026-05-01)
created: 2026-05-01
last_updated: 2026-05-16
decomposition: decomposed
children: [B-0140, B-0156.1]
depends_on:
  - B-0086
  - B-0122
composes_with: [B-0190, B-0194, B-0196]
type: friction-reducer
---

# B-0156 — TypeScript standardization across non-install scripts

## What

Aaron 2026-05-01 — explicit scope clarification on the TS-port
trajectory:

> *"every other .sh not called by install.sh"* + *"any .py"*

Plus the leverage framing:

> *"you can do a lot more if you write this in typescript"*

Two clean rules:

1. **Pre-install scripts** (`install.sh` + everything it calls
   transitively) — MUST stay bash + grow PowerShell siblings
   for Windows reach. Otto-235 four-bash-alignment (macOS bash
   3.2 / Ubuntu / git-bash / WSL) covers Unix-style; task #305
   `install.ps1` covers Windows native. These can't be TS
   because they bootstrap bun itself.
2. **Every other `.sh` and `.py`** — TS-port targets. No
   chicken-and-egg constraint; bun is on PATH after install.

## Why now

The class-encoding observation Aaron named (*"there are only
a few legit blockers you've run into classes of blockers"*)
maps directly onto B-0153's 13 mechanizable lint classes.
This session has empirically validated all 13 across ~10 PRs.
A TS-implemented pre-commit suite catching those classes
locally before push would close the convergence loop.

Plus the broader leverage: TS gets us:

- Type safety (no more `bash` argument-passing bugs)
- Better cross-platform behavior (no `macos-bash-3.2` vs
  `Ubuntu-bash-5` quirks)
- Test coverage via `bun test`
- Composable modules (import vs source-file)
- Better error messages
- Single-runtime tooling (just `bun`, not `bash + jq + sed
  + awk + grep + ...`)

## Audit — current state (2026-05-01)

### Pre-install graph (14 files — MUST stay bash, grow PowerShell)

These files are called transitively from `install.sh`:

```text
tools/install-verifiers.sh
tools/setup/install.sh                    (entry point)
tools/setup/linux.sh
tools/setup/macos.sh
tools/setup/doctor.sh
tools/setup/common/curl-fetch.sh
tools/setup/common/dotnet-tools.sh
tools/setup/common/elan.sh
tools/setup/common/mise.sh
tools/setup/common/profile-edit.sh
tools/setup/common/python-tools.sh
tools/setup/common/shellenv.sh
tools/setup/common/sync-upstreams.sh
tools/setup/common/verifiers.sh
```

Trajectory: grow `.ps1` siblings for Windows (task #305),
verify Otto-235 four-bash-alignment empirically. NOT TS
candidates.

### Non-install `.sh` files without TS sibling (3 ports remaining)

```text
tools/profile.sh
tools/peer-call/amara.sh
tools/peer-call/ani.sh
```

Three files remain. `snapshot-github-settings.sh`,
`check-github-settings-drift.sh`, and
`check-tick-history-shard-schema.sh` were ported and the
`.sh` originals deleted. Each remaining file gets a TS
sibling; bash version stays as a fallback during transition
(per existing `.sh` + `.ts` coexistence pattern across
`tools/lint/`, `tools/hygiene/`).

### Python files in our codebase (0)

`find . -name "*.py" -not -path "*/lean4/*" -not -path
"*/.venv/*" -not -path "*/site-packages/*" -not -path
"*/.git/*"` returns ZERO `.py` files in our actual codebase.
All `.py` found are under `references/upstreams/` (read-only
external project mirrors — not ours to port).

So Aaron's *"any .py"* directive results in **zero porting
work** for Python — the constraint is preventive: future
contributors should not introduce `.py` files; the policy is
documented for clarity.

## Phase plan

### Phase 1 — Highest-leverage ports first (compose with B-0155) -- DONE

1. `tools/hygiene/snapshot-github-settings.sh` → `.ts` -- DONE
2. `tools/hygiene/check-github-settings-drift.sh` → `.ts` -- DONE

These two are foundation for the **B-0155 reconciliation
script** (`tools/hygiene/apply-github-settings.ts`).
Porting snapshot + check FIRST gives the apply script
natural TS imports for both.

### Phase 2 — Schema + safety lints -- DONE

1. `tools/hygiene/check-tick-history-shard-schema.sh` → `.ts` -- DONE (PR #1986)

Composes with the recurring tick-shard schema violations
this session has hit (e.g., `1455Z-followup.md` rename to
`1455Z-d0c5.md`).

### Phase 3 — Peer-call completion

1. `tools/peer-call/amara.sh` → `.ts`
2. `tools/peer-call/ani.sh` → `.ts`

Completes the peer-call TS migration that B-0122 named.
After this, `tools/peer-call/` is 100% TS.

### Phase 4 — Profile shell-helper

1. `tools/profile.sh` → `.ts`

Standalone utility; lowest-priority port.

### Phase 5 — Bash sweep (deletion of `.sh` siblings post-port)

After Phases 1-4 stabilize and TS versions are battle-tested,
delete the `.sh` siblings to complete the migration. Each
deletion is reversible via `git revert` if regressions
surface.

### Phase 6 — `.py` policy enforcement -- DONE (2026-05-16)

Landed as `tools/lint/no-python-files.ts` (TS+Bun, per Rule 0)
with an explicit allowlist at
`tools/lint/no-python-files.allowlist` (starts empty) and a
unit-test suite at `tools/lint/no-python-files.test.ts`
(9 tests). Wired into `.github/workflows/gate.yml` as the
`lint-no-python-files` job, adjacent to `lint-no-empty-dirs`.
Hard-excludes `references/upstreams`, `.venv`, `__pycache__`,
`site-packages`, `tools/lean4/.lake`, `node_modules`, `bin`,
`obj`. Current repo state: 0 flagged, 0 allowlisted (the
audit baseline this row stated for "Python files in our
codebase (0)" is mechanically enforced going forward).

## Acceptance criteria

1. **All 6 non-install `.sh` files have working TS siblings**
2. **Each TS sibling has at least one `bun test` covering its
   primary entry path**
3. **`.sh` siblings remain in tree during transition** (per
   existing convention) but are documented as deprecated
4. **`.py` policy lint** added to `gate.yml` or equivalent
5. **package.json scripts updated** to reference TS versions
   where applicable
6. **No regression on existing CI** — TS ports must produce
   identical output to bash counterparts (golden-file tests
   in `bun test`)

## Composes with

- B-0086 (port tools/hygiene python to TS/bun) — B-0086 already
  named the discipline; this row sharpens scope to exclusion-
  rule based instead of subdirectory-based
- B-0122 (peer-call TS migration cutover) — this row's Phase 3
  IS B-0122's completion
- B-0153 (pre-commit lint suite) — Phase 1 of B-0153 (the lint
  suite TS implementation) is a sibling effort; both unlock
  the convergence loop
- B-0155 (GitHub settings ruleset-split refactor) — this row's
  Phase 1 ports (snapshot + check) are foundation for B-0155's
  reconciliation script (apply-github-settings.ts)
- task #305 (install.ps1 for Windows CI peer-mode) — pre-install
  Windows reach; orthogonal to this row's TS scope but in same
  "go where developers are" architecture
- task #341 (TS port + future git scripts: enforce 3-tier
  multi-remote design) — Amara-named broader TS migration
- `memory/feedback_otto_215_windows_via_peer_harness_not_ci_matrix_plus_bun_ts_post_install_migration_before_windows_work_2026_04_24.md`
  — Otto-215 named "Bun-TS post-install migration before
  Windows work" as the trajectory; this row is the
  post-install side of that pair
- `memory/feedback_bash_compatibility_target_four_shells_macos_32_ubuntu_git_bash_wsl_otto_235_2026_04_24.md`
  — Otto-235 four-bash-alignment for the pre-install graph
- `memory/feedback_everything_greenfield_at_week_one_including_host_and_coding_rules_aaron_2026_05_01.md`
  — the click-vs-decision discipline applies: original `.sh`
  shape was convenience under time pressure, not deliberate
  design choice for bash specifically

## Out of scope (defer)

- **Pre-install graph TS port** — explicitly excluded per the
  install-bootstraps-bun chicken-and-egg constraint. Pre-install
  scripts grow PowerShell siblings for Windows (task #305) but
  stay bash for Unix-style.
- **Reference upstream `.py` files** — read-only external
  mirrors under `references/upstreams/`; not ours to port.
  Out of scope.
- **Lean4 internals** — `tools/lean4/.lake/packages/**` is
  Lean dependency graph; not ours.
- **Test infrastructure migration** — separate concern; TS
  ports use existing `bun test` infrastructure. Test framework
  selection itself is not in this row's scope.

## Effort

**M-L (medium-to-large, 2-5 days total)** broken across the 6
phase ports. Phase 1 (snapshot + check) is the foundation —
maybe 1 day for both with tests. Phases 2-4 are 0.5-1 day
each. Phase 5 (sweep) is small once Phases 1-4 are stable.
Phase 6 (.py policy) is hours, not days.

## Why P1

- **Not P0** because all 6 `.sh` files are working today; no
  correctness regression
- **Not P2** because the convergence loop benefit (Aaron's
  *"you can do a lot more if you write this in typescript"*)
  compounds across every future tool change. Each day spent
  with bash-only scripts in the non-install graph is a day
  of bash-quirk friction that TS would have eliminated.
- **P1** because Aaron explicitly named the trajectory + the
  class-encoding leverage angle + the foundation role for
  B-0155's reconciliation script

## Mechanization candidate

`.py`-policy lint (Phase 6) — simple `find` check that fails
CI on any new `.py` outside `references/upstreams/`.
Implementation:

```yaml
# In .github/workflows/gate.yml or new lint workflow
- name: lint (no python in our code)
  run: |
    found=$(find . -name "*.py" \
      -not -path "*/references/upstreams/*" \
      -not -path "*/lean4/.lake/*" \
      -not -path "*/.venv/*" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*")
    if [ -n "$found" ]; then
      echo "ERROR: .py files found outside references/upstreams:"
      echo "$found"
      echo "Per B-0156: TS preferred over Python in our codebase."
      exit 1
    fi
```

Add to the broader lint workflow once Phase 1 ships.

## Self-test (apply assumed-state-vs-actual-state)

Future-tick discipline check: the audit data in this row
(14 install-graph files / 6 non-install ports / 0 `.py`)
should be re-verified before each phase begins. Counts can
shift if new scripts land. Run:

```bash
# 6 non-install .sh files without TS sibling
find tools -name '*.sh' -not -path '*/lean4/*' -not -path '*/node_modules/*' | while read f; do
  ts="${f%.sh}.ts"
  [ ! -f "$ts" ] && echo "$f"
done
```

before each phase to catch drift in the audit baseline.
