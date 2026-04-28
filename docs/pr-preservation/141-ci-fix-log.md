# PR #141 CI fix log

CI-only fix pass applied 2026-04-24 to unblock merge on
`feat/servicetitan-crm-demo` (PR #141, "samples: CrmKernel —
retraction-native algebraic kernel demo"). Zero unresolved
review threads at start; only CI checks were red. No review
re-drain, no scope change to the PR's substantive diff.

## Pre-fix state

- `mergeStateStatus`: `BLOCKED`.
- `state`: `OPEN` (branch one commit behind `origin/main`;
  rebase clean, no conflicts).
- Check results (per `gh pr checks 141`):
  - `lint (markdownlint)` — FAIL
  - `check memory/MEMORY.md paired edit` — FAIL
  - Everything else green (`build-and-test (ubuntu-22.04)`,
    `lint (actionlint)`, `lint (no empty dirs)`,
    `lint (semgrep)`, `lint (shellcheck)`,
    `lint memory/MEMORY.md reference-existence`,
    `Path gate`, `Analyze (csharp)`, `Analyze (actions)`,
    `submit-nuget`).

## Per-failure record

### Failure 1 — `lint (markdownlint)`

**Run:** GitHub Actions run `24902734336`, job
`72924293173`.

**Violations reported:**

```
docs/hygiene-history/loop-tick-history.md:175:2974
  MD056/table-column-count
  Table column count [Expected: 6; Actual: 4;
                      Too few cells, row will be missing data]
docs/hygiene-history/loop-tick-history.md:176:2028
  MD056/table-column-count
  Table column count [Expected: 6; Actual: 4;
                      Too few cells, row will be missing data]
```

**Root cause:** The tick-history table schema is 6 columns
(`date | agent | cron-id | action-summary | commit-or-link |
notes`). The auto-loop-44 and auto-loop-45 rows authored in
this PR packed `commit-or-link` and `notes` content into the
`action-summary` mega-cell, leaving only 4 pipe-separated
fields per row.

**Fix applied:** Split each offending row into the full
6-column shape. Commit-or-link fields cite pre-tick
`acb9858` (SignalQuality + /btw landing) for row 175 and the
PR branch name for row 176; notes fields summarize the
bilateral-verbatim-anchor discipline (auto-loop-44) and
speculative-work known-gap-fix tier (auto-loop-45).

Append-only discipline (Otto-229) honoured: no existing
prior row was edited; the fix is a structural completion of
rows *introduced by this PR*, not a rewrite of rows
previously landed on `main`.

**Verification:**

```bash
npx markdownlint-cli2@0.18.1 "**/*.md"
# exit=0
```

### Failure 2 — `check memory/MEMORY.md paired edit`

**Run:** GitHub Actions run `24902734259`, job
`72924292873`.

**Violations reported:** Five new `memory/**.md` files landed
on the PR branch without corresponding `memory/MEMORY.md`
index entries:

- `memory/observed-phenomena/2026-04-19-transcript-duplication-splitbrain-hypothesis.md`
- `memory/project_aaron_drop_zone_protocol_2026_04_22.md`
- `memory/project_arc3_adversarial_self_play_emulator_absorption_scoring_2026_04_22.md`
- `memory/project_operator_input_quality_log_directive_2026_04_22.md`
- `memory/project_reproducible_stability_as_obvious_purpose_2026_04_22.md`

The NSA-001 canonical incident (see
`docs/hygiene-history/nsa-test-history.md`) is exactly this
shape: memory-file-landed-without-pointer is undiscoverable
by future cold-start sessions.

**Fix applied:** Added five newest-first index entries to
`memory/MEMORY.md`, inserted immediately after the
`📌 Fast path` header paragraph. Each entry follows the
existing one-line-under-~200-chars bolded-description pattern
with bracketed link, path target, em-dash separator, and
short prose follow-up describing composition with prior
memories.

Order of new entries (newest-first within the 2026-04-22
auto-loop-43/44/45 tick cluster):

1. `observed-phenomena/2026-04-19-transcript-duplication-splitbrain-hypothesis.md`
2. `project_aaron_drop_zone_protocol_2026_04_22.md`
3. `project_arc3_adversarial_self_play_emulator_absorption_scoring_2026_04_22.md`
4. `project_operator_input_quality_log_directive_2026_04_22.md`
5. `project_reproducible_stability_as_obvious_purpose_2026_04_22.md`

**Verification:** Full-repo markdownlint still clean after
the MEMORY.md edit (`exit=0`); the
`paired-edit` check will pass on next CI run because all
five file paths now appear in MEMORY.md.

## Build gate

`dotnet build -c Release` on the rebased branch:

- First run: FAIL — `Feldera.Bench` SIGSEGV (exit code 139).
  Known Otto-248 flake; not reproducible across runs.
- Retry: `0 Warning(s), 0 Error(s)` — PASS.

## Constraints honoured

- Only `.md` files in the PR's diff plus `memory/MEMORY.md`
  (plus this log, plus the new `docs/pr-preservation/`
  directory creation) were touched.
- No new PRs opened.
- No merge (`gh pr merge`) invoked.
- No `docs/BACKLOG.md` edits.
- No symlinks (Otto-244).
- No review threads touched (0 unresolved before; 0 after).
- Append-only discipline honoured on tick-history: no
  previously-landed-on-`main` row was edited; the fix was
  restricted to structurally-incomplete rows introduced by
  this PR itself.

## Post-fix expectation

On push:

- `lint (markdownlint)` → PASS
- `check memory/MEMORY.md paired edit` → PASS
- `mergeStateStatus` → `CLEAN` (pending CI re-run)

Auto-merge is already armed on this PR per Otto-224
discipline; CI clearance should flip the state and land the
merge without manual intervention.

## Follow-up — reference-existence link-path fix

First push surfaced a sibling check that the original two
failures masked:

- `lint memory/MEMORY.md reference-existence` — FAIL
  (`observed-phenomena/2026-04-19-transcript-duplication-
  splitbrain-hypothesis.md -> ... (not found)`).

**Root cause:** `tools/hygiene/audit-memory-references.sh`
resolves link targets containing `/` as cwd-relative (from
repo root), not relative to the `memory/` base dir. The
existing `](docs/research/...)` precedent in MEMORY.md
demonstrates the convention — slash-paths must resolve from
repo root. My new link used the bare
`](observed-phenomena/...)` form which fails that
resolution.

**Fix applied:** Rewrote the link target to
`](memory/observed-phenomena/...)` so it resolves from repo
root like the sibling `docs/research/...` entry. Local audit
after the fix: 454 refs checked, 454 resolved, 0 broken.
Commit `b4ff814` pushed on top of the main CI fix commit
`1cacebe`.

## Rebase pass — 2026-04-24 post-#144 DIRTY clear

PR #144 (Aurora transfer absorb) landed on `main` and
dirtied this branch. `mergeStateStatus` flipped from `CLEAN`
back to `DIRTY`; 0 unresolved threads, 0 failing checks —
pure merge-conflict drain.

**Conflicts resolved** (11 files):

- Append-only / audit-trail files taken from `main` side
  (`--ours` in rebase semantics) per Otto-229 discipline:
  `.gitignore`, `docs/AUTONOMOUS-LOOP.md`,
  `docs/BACKLOG.md`, `docs/force-multiplication-log.md`,
  `docs/hygiene-history/loop-tick-history.md`,
  `docs/research/amara-network-health-oracle-rules-stacking-2026-04-22.md`,
  `drop/README.md`.
- Code files taken from `main` side as well:
  `Zeta.sln`, `src/Core/SignalQuality.fs`,
  `tests/Tests.FSharp/Algebra/SignalQuality.Tests.fs`.
  Rationale: `SignalQuality.fs` and its tests already
  landed on `main` via #144 + subsequent review-drain
  commits (fe156aa, 1ab9351, 44654ec), carrying strict
  superset improvements — empty-string returns `0.5` +
  `Pass` severity, NaN weight-poisoning guard in composite
  math, length-direct read of `MemoryStream` (no
  `.ToArray()` allocation), weight > 0L filter on grounding
  / falsifiability predicates, and IP-strip language
  cleanup. The PR branch carried the pre-drain variant;
  `main` is strictly ahead.
- `Zeta.sln`: `main` already has a `ServiceTitanCrm`
  project entry using the same project GUID
  (`{D44AB9CA-F491-41F4-96CE-B061238F3D6E}`) the PR's
  `CrmKernel` entry would have introduced. Taking `main`
  keeps the non-conflicting `ServiceTitanCrm` entry.
- `samples/CrmKernel/` directory (added by the PR's first
  commit) removed via `git rm -rf` — superseded by
  `samples/ServiceTitanCrm/` which already lives on `main`
  with the same content modulo the `CrmKernel ->
  ServiceTitanCrm` rename. Keeping the `CrmKernel`
  directory would duplicate source at the filesystem level
  and cause a project-GUID collision in the solution.

**Net result:** The first PR commit (`fee44e4`, the
substantive `samples: CrmKernel + SignalQuality` patch)
became empty after resolution and was dropped by
`git rebase --continue`. The three CI-fix commits
(`1cacebe`, `b4ff814`, `baaad9d`) rebased cleanly (one
more tick-history conflict resolved identically with
`--ours`) and retain their content.

**Build + test after rebase:**

- `dotnet build -c Release` — `0 Warning(s)`, `0 Error(s)`
  (Build succeeded; 15.26s).
- `dotnet test Zeta.sln -c Release --no-build` — all four
  test assemblies pass:
  - Core.CSharp.Tests: 2 / 2 passed
  - Bayesian.Tests: 8 / 8 passed
  - Tests.CSharp: 8 / 8 passed
  - Tests.FSharp: 694 / 695 passed (1 skipped — the
    pre-existing `RecursiveCountingMultiSeedTests` skip
    that is unrelated to this PR)

**Branch state:** 4 commits ahead of origin/main
(`7b34dc6 ci: fix PR #141 markdownlint MD056 + MEMORY.md
paired-edit`, `f195804 ci: fix reference-existence path`,
`20de672 ci: document reference-existence follow-up`, plus
the rebase-pass log-update commit landing this section).
`--force-with-lease` push follows. Expect
`mergeStateStatus` to flip `DIRTY → CLEAN` once refs
update and CI greens.

**Constraints honoured:** no new PRs opened, no merge
triggered (auto-merge armed via Otto-224 from the earlier
open-PR pass), no review-thread edits, build + test gate
clean, no symlinks introduced.

---

## 2026-04-24T post-rebase review-drain pass (2 new threads)

After the #144 merge + earlier rebase pass, Copilot and
Codex re-reviewed the branch and raised two new threads
against `src/Core/SignalQuality.fs`. The file was reverted
to its pre-fix shape by an earlier cherry-pick sequence
(the `e206b69` fixes referenced in the resolved threads
are no longer present in this branch's history), so the
two new threads are a legitimate re-raise and need the
fixes re-applied here.

**Thread 1 — P0 (Copilot):** `open System.Runtime.CompilerServices`
at line 8 is unused; with `TreatWarningsAsErrors` on this
will fail the build on `FS1182` (unused open).
**Fix:** removed the unused `open`. The module never
referenced any symbol from `System.Runtime.CompilerServices`
(no `[<MethodImpl>]`, no `[<Extension>]` on a module that
needed it — the extension-style `compressionMeasure`-etc.
entry points are regular `let`-bound functions).

**Thread 2 — P2 (Codex):** `composite` silently ignores
negative weights. `sumWeighted <- sumWeighted + w * f.Score`
with `w = 0.0` and `f.Score = NaN` produces NaN (because
`0.0 * NaN = NaN`); with negative `w` the dimension
participates in an inverted direction. Reconcile to one
consistent rule.
**Fix:** gated the inner loop on `w > 0.0` and, inside
that guard, separated the NaN branch (flips `sawNaN`
without touching the accumulators) from the valid-score
branch (adds to both `sumWeighted` and `sumWeights`).
Negative weights and `0.0` weights now explicitly do not
participate — documented in the docstring as "Weight
semantics" so callers can see the contract without
reading code. This matches the documented "missing /
ignored dimensions contribute 0" behavior and prevents
silent corruption on misconfigured weight maps.

**Build:** `dotnet build -c Release` → 0 Warning(s)
0 Error(s).

**Branch state:** push `--force-with-lease` follows.
Auto-merge armed from prior pass; no new PR opened.
Constraints preserved (no symlinks, append-only audit
trail, reply+resolve per thread, role-ref attribution in
docstring).
