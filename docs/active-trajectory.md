# Active trajectory

> **READ THIS FILE FIRST** before any work that touches the active trajectory.
> If you (Claude/Otto/whoever) are about to run `git rev-list`, `git diff`,
> open a new audit branch, or invoke a peer-call about the active trajectory,
> stop. Read this file. Do the next action listed here, not a re-derivation.
>
> **Classification (maintainer call, 2026-04-29T10:30Z):** this file is a
> HISTORY surface (like backlog rows / memory files / tick shards / CURRENT-*
> per-maintainer files), not a current-state surface. Persona names + dated
> attribution ARE allowed here. The trajectory IS history-of-decisions; the
> file records what was decided, by whom, when, and why. Treat as memory-
> equivalent for prose-register rules.
>
> **Inconsistency note (Copilot 2026-04-29T10:48Z catch)**: the closed list
> in `docs/AGENT-BEST-PRACTICES.md` (around lines 284-312) does NOT currently
> include `docs/active-trajectory.md`. The maintainer 2026-04-29T10:30Z call
> extends the closed list to cover this file, but the central rule doc has
> not yet been updated. Until that update lands, future editors/agents
> reading `AGENT-BEST-PRACTICES.md` will see the old closed list and
> conclude this file should use role-refs only.
>
> The discrepancy is acknowledged here to prevent silent drift. Follow-up
> required: edit `docs/AGENT-BEST-PRACTICES.md` to add `docs/active-
> trajectory.md` to the history-surface closed list alongside backlog and
> memory entries. Deferred; not blocking 0/0/0 progress, but should land
> before the trajectory file's classification is treated as authoritative
> by external readers.

## Priority — blocking all other work

**0/0/0 hard-reset: AceHack main = LFG main (0 ahead, 0 behind, 0 file content-diff).**

Per `CLAUDE.md` AceHack-LFG topology invariant + `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`. The maintainer 2026-04-29 framing: *"this is the only trajectory i care about right now, it's blocking everything else."*

While this trajectory is active:

- Do NOT start LOST-branch recovery (task #264).
- Do NOT begin Aurora Round-3 absorption (task #286).
- Do NOT process the multi-AI synthesis backlog (tasks #309 / #310 / #311).
- Do NOT open new memory files or new substrate islands (B-0105 consolidation gate is still active).
- Do NOT run autonomous tick-history shards while in audit-spiral mode — wait for state change.

The autonomous-loop tick MAY still produce minimal honest-wait acknowledgements, but every action toward the trajectory must read this file first.

## Canonical state-bearing artifacts

These are the substrate the trajectory has produced. Read them in order; do NOT re-derive their content:

1. **`docs/0-0-0-readiness/CLASSIFICATION.md`** — file-level classification rubric + calibration batch (5/23 ALREADY-COVERED). The doc body lags the commit narrative; see #2.
2. **Commit `37bbca9`** (2026-04-28T17:53Z, "ops(0-0-0-readiness): final classification 19/4/0/0/0 + 3 Claude.ai upgrades + measurable-alignment round-close note") — declares 19 ALREADY-COVERED + 4 NEEDS-FORWARD-SYNC. The full per-file table never landed in the doc body; the narrative is in the commit message.
3. **`docs/research/2026-04-28-forward-sync-merge-direction-proposal-9-infra-files.md`** — the per-file plan with risk levels and recommended order. **16+ hours stale as of 2026-04-29T09:40Z**; verify against current git state before executing per-file decisions.
4. **`memory/feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`** — pre-flight disciplines that apply during any forward-sync or hard-reset.

## Current state (verified 2026-04-29T10:11Z)

### Content-drift trajectory (the KEY metric)

Per maintainer 2026-04-29T10:13Z framing: *"do you not keep up with content drift, that's the import metrics for the trajectory."* Commit counts are NOT the trajectory; **AceHack-only lines** (the content that would be erased on hard-reset) IS.

| Date | Modified files | Deleted-on-AceHack | AceHack-only +lines | LFG-newer -lines | Direction |
|---|---|---|---|---|---|
| 2026-04-27 (early) | 53 | — | ~6065 | — | (pre-option-c reference) |
| 2026-04-28T17:53Z | 23 | — | — | — | Calibration commit `37bbca9` |
| 2026-04-28T21:50Z | 23 | — | ~397 | — | CLASSIFICATION.md initial |
| 2026-04-29T10:11Z | 30 | 156 | (mis-counted as 454; corrected to 273) | (18,227 then; 18,046 now) | (Earlier line-count was wrong — `grep -c '^+'` counted 181 file-header lines on top of 273 real insertions.) |
| **2026-04-29T10:25Z** | **30** | **156** | **273** | **18,046** | **Canonical via `git diff --numstat` — see ledger below** |

**Headline safety number: 273 AceHack-only lines.** That's what hard-reset of `acehack/main` would erase. Of those, classified safe with semantic evidence:

- 9 infra files: ~all of the file-level safety-relevant content
- 5 spot-checked memory/docs files: ~tens of lines (mostly stale frontmatter)
- 15 unverified files: heuristic-projected ALREADY-COVERED

Drift cadence observation: AceHack-only lines grew +57 in 12.5h while LFG advanced +18k+ lines. **Relative drift is shrinking** (LFG advances faster than AceHack-only side accumulates) but **absolute drift is widening** (raw AceHack-only count growing). For hard-reset safety, ABSOLUTE matters; for synchronization-effort, relative matters.

### Commit-count divergence (NOT the trajectory; do not chase)

```text
AceHack ahead of LFG:   145 commits
AceHack behind LFG:     640 commits  (was 638 before #832/#833 landed)
```

Commit-count is unfaithful — many AceHack-side commits supersede each other on the AceHack-only side, and many LFG-side commits don't add unique substrate either. The content-drift table above is the faithful metric.

### Hard-reset-safety classification (NOT merge-direction)

Per Amara 2026-04-29T09:50Z framing correction: "merge-direction is a plan shape; content-loss is the reset gate; do not confuse them." The question for 0/0/0 is NOT "which fork wins this file" but "what unique AceHack content would be LOST on hard-reset?"

Per Amara 2026-04-29T10:18Z reinforcement: line-count dominance is a TRIAGE SIGNAL, not content-equivalence proof. The repeated failure pattern: compute drift → see low AceHack-only count or LFG-newer dominance → infer "safe" → reviewer finds one semantic thing hidden inside the small diff. The fix is the `HEURISTIC_LFG_DOMINATES` bucket — files there are *unclassified*, not safe.

Classification taxonomy (5-bucket, strict):

```text
ALREADY_RESOLVED               — file is identical OR exact AceHack content exists on LFG. Zero AceHack-only lines is the canonical case.
SAFE_TO_RESET_LFG_SUPERSEDES   — AceHack-only content is NAMED + LFG equivalent/superset is NAMED + reason LFG supersedes is WRITTEN. Semantic evidence required.
HEURISTIC_LFG_DOMINATES        — LFG-only line count dwarfs AceHack-only line count, BUT AceHack-only lines were not semantically inspected. NOT proof; counts as UNCLASSIFIED for gate purposes.
NEEDS_FORWARD_SYNC             — AceHack has unique substantive content not on LFG; forward-sync to LFG before hard-reset.
NEEDS_HUMAN_DECISION           — ambiguous, irreversible, or accept-loss decision required.
```

Best blade (Amara): *"Line-count dominance is a smoke detector. Content equivalence is the fire inspection."*

### Four-bucket ledger (compute, do not hand-maintain)

The drift trajectory is a metric; the GATE is the ledger. Hand-counts drift; ledgers from `git diff --numstat` don't.

The ledger is computed in two passes (text via `numstat`, binary direction via `name-status`). Per multi-AI review 2026-04-29T10:50Z: binary files emit `-/-` in `numstat` because lines aren't countable, but they CAN be erased on hard-reset, so they need direction classification — `acehack-only` vs `lfg-only` vs `modified-on-both`.

**The shell snippet below is ILLUSTRATIVE, NOT DURABLE.** Per multi-AI review 2026-04-29T11:05Z (Codex + Copilot 7-thread cluster + Amara): the inline awk/grep approach below has real NUL-safety bugs and is not portable across awk implementations:

- `awk $3` with default whitespace FS breaks on paths with spaces (need `FS='\t'`).
- `grep -Ff` reads newline-delimited patterns, not NUL-delimited (the `ORS="\0"` write doesn't compose with `grep -f`).
- `numstat -z` rename/copy records are `adds<TAB>dels<TAB>NUL old<NUL>new<NUL>`, not just one NUL-delimited row.
- `name-status -z` rename/copy rows are `status<NUL>old<NUL>new<NUL>` (3 fields), not `status<NUL>path<NUL>` (2 fields). The toggle parser desynchronizes.
- `RS='\0'` / `ORS='\0'` is a gawk extension; macOS BSD awk doesn't support it.
- `/tmp/binary-paths.nul` is a fixed path with no `mktemp` + `trap` cleanup; clobber-prone under concurrency.

The durable home for the gate-runner is `tools/zero-zero-zero/check-gate.sh` (deferred follow-up, see "Deferred follow-ups" below). That script must be tested against fixtures including: paths with spaces, binary add, binary delete, binary modify, binary rename, binary copy, gawk-vs-BSD-awk.

**Stopgap rule for this round**: if either `binary_acehack_only_files > 0` OR `binary_modified_or_renamed_files > 0` in this ledger (the two gate-relevant binary metrics emitted by the new script), do NOT rely on the inline snippet to classify direction. Use `git diff --name-status -z origin/main..acehack/main -- <path>` per binary file + direct `git show` evidence, manually, until the gate-runner script exists. (`binary_lfg_only_files > 0` is NOT a stopgap trigger — LFG-only files get added on hard-reset; no AceHack content lost.)

**The inline shell snippet was REMOVED 2026-04-29T11:20Z** per multi-AI review packet (Codex P0 + Copilot 5-thread cluster + Amara). Even with an "illustrative" disclaimer, a broken parser left in the doc encourages copy-paste use of code that has 6 known bugs (awk default-FS path-with-spaces breakage, `grep -Ff` not NUL-aware, name-status `-z` rename-record desync, gawk-only `RS='\0'`, fixed `/tmp/binary-paths.nul` not race-safe, missing semantic LFG-only-vs-modified distinction).

The conceptual structure remains correct (three binary buckets — `acehack_only`, `lfg_only`, `modified_or_renamed`). The execution belongs in `tools/zero-zero-zero/check-gate.sh` as a real script with fixtures (paths with spaces, binary add/delete/modify/rename/copy, gawk-vs-BSD-awk portability, `mktemp` + `trap` cleanup). That script is the highest-priority deferred follow-up.

**Until that script exists, classify binary files manually** (see "Stopgap rule" above): `git diff --name-status -z origin/main..acehack/main -- <path>` per binary file + direct `git show` evidence + manual bucket assignment.

For the text-file ledger, the conceptual computation is straightforward: `git diff --numstat origin/main..acehack/main` reports added/removed line counts per file (with `-/-` for binary). Sum the non-binary rows for `potential_loss_lines` and `lfg_newer_lines`. The current round's verified text-ledger numbers (273 / 18046) were computed manually 2026-04-29T10:25Z and are recorded in the trajectory table above.

**Reset-loss surface for binary files:**

- `binary_acehack_only_files` → would be ERASED on hard-reset; this is the gate-relevant count.
- `binary_lfg_only_files` → would be ADDED on hard-reset; not a loss.
- `binary_modified_or_renamed_files` → exists on both with content/mode/path differences; needs semantic classification (e.g., is the AceHack version more correct, or is LFG's the canonical?).

Verified 2026-04-29T10:43Z: the 5 binary-classified files in the current diff have status `D` (LFG-only), so `binary_acehack_only_files = 0` and `binary_modified_or_renamed_files = 0` in this specific round.

Current ledger (last updated 2026-04-29T12:31Z, post-option-(c)-migration-PR — values reflect post-merge state of the migration PR):

```text
potential_loss_lines  = 273    all AceHack-only +lines (would be erased on hard-reset)
classified_safe_lines = 235    semantic evidence in BUCKET 2 (SAFE_TO_RESET_LFG_SUPERSEDES)
unsafe_lines          = 0      no NEEDS_FORWARD_SYNC or NEEDS_HUMAN_DECISION
unclassified_lines    = 38     HEURISTIC_LFG_DOMINATES — pending per-file semantic inspection
```

**Ledger state**: in-force as of post-#839-merge (option-(c) migration landed 2026-04-29T12:46:29Z). The 9 ACEHACK_ONLY tick rows are durably preserved as Option B shards under `docs/hygiene-history/ticks/2026/04/28/` on LFG main. Hard-reset of `loop-tick-history.md` is content-preservation-safe.

`potential_loss_lines = 273` was computed 2026-04-29T10:25Z via `git diff --numstat refs/remotes/origin/main..refs/remotes/acehack/main` and remains canonical: the AceHack and LFG main tips have not advanced relative to each other in a way that touched the divergent files (#837 + #838 + the option-(c) migration only touch docs in `docs/0-0-0-readiness/` and add new shard files in `docs/hygiene-history/ticks/2026/04/28/` — neither set affects the existing AceHack-vs-LFG diff for the divergent file set). Re-compute on next batch open if either tip moves materially.

Arithmetic sanity check: `273 = 235 + 0 + 38` ✓ (per the multi-AI review discipline — verify mechanically, do not trust the math because it "looks plausible").

### Option-(c) Migration Preflight Ledger (loop-tick-history.md, 2026-04-29T12:31Z)

Per the Migration Preflight Ledger discipline (per multi-AI review 2026-04-29 packet 6): no shard migration starts until every candidate row has normalized hash + bucket + destination/no-op-reason. Built via content-based identity (not timestamp-based). All hashes are 12-char prefixes of SHA-256 over the full normalized row.

| timestamp | acehack_row_hash | lfg_row_hash | bucket | shard_action |
|---|---|---|---|---|
| 2026-04-21T17:28 | d1d54bae860f | d1d54bae860f | COMMON_IDENTICAL_REORDERED | no shard write (subcase of COMMON_IDENTICAL — same row content on both forks, diff displays `+/-` because table position changed) |
| 2026-04-28T04:08 | f23a8b7cdb2d | — | ACEHACK_ONLY | create 0408Z.md |
| 2026-04-28T04:18 | 49461a7d509b | — | ACEHACK_ONLY | create 0418Z.md |
| 2026-04-28T04:33 | e48763be9831 | — | ACEHACK_ONLY | create 0433Z.md |
| 2026-04-28T05:01 | 0fd03048c2fd | — | ACEHACK_ONLY | create 0501Z.md |
| 2026-04-28T05:23 | f2263f3742fe | — | ACEHACK_ONLY | create 0523Z.md |
| 2026-04-28T05:44 | 6d0979994589 | — | ACEHACK_ONLY | create 0544Z.md |
| 2026-04-28T05:50 | e7c8825f26e6 | — | ACEHACK_ONLY | create 0550Z.md |
| 2026-04-28T07:15 | 9756cee23c0d | — | ACEHACK_ONLY | create 0715Z.md |
| 2026-04-28T08:50 | d39082ee5264 | — | ACEHACK_ONLY | create 0850Z.md |

Net: 9 shard writes; 1 no-op (COMMON_IDENTICAL with positional drift). The misclassification of `2026-04-21T17:28` as SAME_TIMESTAMP_DRIFT (caught during the trajectory's earlier prose-only classification on #838) was corrected here by the preflight ledger's content-hash check — exactly the bug-class the discipline is designed to prevent. **A timestamp is an address, not an identity.**

Composition of `classified_safe_lines = 235` (in-force post-#840-merge):

- 9 infra files (97 lines): see "9 infra files" table above. SAFE_TO_RESET_LFG_SUPERSEDES with named per-file evidence.
- 5 calibration-batch files (28 lines, 2026-04-28): MEMORY.md (11) + codeql_umbrella (12) + doc_class_mirror_beacon (1) + CURRENT-aaron (2) + CURRENT-amara (2). Originally labeled "ALREADY-COVERED" in older taxonomy; under strict bucket each has named evidence in `docs/0-0-0-readiness/CLASSIFICATION.md` → SAFE_TO_RESET_LFG_SUPERSEDES.
- Batch 1 (9 lines, 2026-04-29T11:32Z): SECURITY.md (4) + validate-agencysignature-pr-body.sh (5). See `docs/0-0-0-readiness/CLASSIFICATION.md` Batch 1 table for named evidence per file.
- Batch 2 (81 lines, 2026-04-29T12:05Z): codeql-config.yml (6) + memory-index-duplicate-lint.yml (8) + audit-memory-index-duplicates.sh (8) + Shard.fs (9) + AUTONOMOUS-LOOP.md (9) + macos.sh (11) + fix-markdown-md032-md026.py (16) + curl-fetch.sh (14). See `docs/0-0-0-readiness/CLASSIFICATION.md` Batch 2 table for named evidence per file. Common pattern: LFG version is either rule-compliant (role-refs vs persona-name violations on current-state surfaces), more accurate (correct retry-math on curl-fetch.sh), the perf-fixed form (Shard.fs non-boxing comparer), the current doctrine (AUTONOMOUS-LOOP.md Option B shard-mode), or strict superset (fix-markdown-md032-md026.py YAML frontmatter handling).
- Option-(c) migration (12 lines, #839 merged 2026-04-29T12:46:29Z): `loop-tick-history.md` reclassified from NEEDS_HUMAN_DECISION → SAFE_TO_RESET_LFG_SUPERSEDES because the 9 ACEHACK_ONLY rows are durably preserved as Option B shards under `docs/hygiene-history/ticks/2026/04/28/`. Hard-reset of the table on AceHack is content-preservation-safe.
- Batch 3a (8 lines, #840 merged 2026-04-29T12:54:53Z): `memory/project_laptop_only_*.md`. AceHack drops the closed-list-scope qualifier from the `../scratch` / `../SQLSharp` zero-matches completion criterion (technically unsatisfiable without the qualifier); LFG version is rule-compliant. See `docs/0-0-0-readiness/CLASSIFICATION.md` Batch 3a table.

Composition of `unsafe_lines = 0` (in-force post-#839-merge):

```text
(empty)
```

`loop-tick-history.md` was previously NEEDS_HUMAN_DECISION (12 lines, mutual divergence — 9 truly-unique-AceHack timestamps + 9 truly-unique-LFG timestamps + 1 COMMON_IDENTICAL_REORDERED row per the Migration Preflight Ledger above). Maintainer chose option (c); the option-(c) migration PR (#839, merged 2026-04-29T12:46:29Z) wrote 9 ACEHACK_ONLY rows as Option B shards on LFG, making hard-reset content-preservation-safe. File now classifies SAFE_TO_RESET_LFG_SUPERSEDES.

Composition of `unclassified_lines = 38` (1 file):

```text
38  .github/workflows/budget-snapshot-cadence.yml
```

This is the last unclassified file. It has real behavioral divergence (auto-merge policy + Scorecard `TokenPermissionsID` security fix) requiring explicit Level-1 buddy review per the Second-Agent Design Review Gate (Amara 2026-04-29 packet 10) before classification. After Batch 3b classifies it, `unclassified_lines = 0` and the strict gate's classification condition is satisfied.

### Hard-reset signoff gate (strict)

Hard-reset is signoff-eligible ONLY when:

```text
unclassified_lines                       = 0
unsafe_lines                             = 0
binary_acehack_only_files                = 0  (would be ERASED on hard-reset)
binary_modified_or_renamed_unclassified  = 0  (each must have a classification verdict)
binary_files_needing_forward_sync        = 0  (NEEDS_FORWARD_SYNC requires forward-sync FIRST)
binary_files_needing_human_decision      = 0  (NEEDS_HUMAN_DECISION requires maintainer call)
fresh-clone fsck                         = clean
hard-reset preflight                     = clean
ls-remote-vs-fetch SHA match             = verified
dry-run push shape                       = clean
maintainer signoff                       = yes
```

Per multi-AI review 2026-04-29T10:35Z: dry-run push shape verification is added to the gate. Validates refspec + credentials + push shape before the real destructive operation. The real lease still matters at the real push (server-side check); dry-run is an additive safety check, not a replacement.

Lease rejection on the real push is NOT a retry condition. It means the remote moved between observation and push — restart the safety gate from the top (re-fetch, recompute content-drift ledger, re-classify if anything moved).

**Currently NOT signoff-eligible**: see the live ledger above (`unclassified_lines`, `HEURISTIC_LFG_DOMINATES` row count). The four-bucket ledger is the single source of truth for classification progress; downstream prose paragraphs are no longer hand-maintained synonyms of the ledger.

### 9 infra files (verified 2026-04-29T09:50Z against current git state, NOT against the 16h-old plan)

| File | Hard-reset safety | Evidence |
|---|---|---|
| `tools/setup/common/verifiers.sh` | ALREADY_RESOLVED | Git shows identical content on both forks (2026-04-29T09:36Z `git diff --stat` empty). |
| `.markdownlint-cli2.jsonc` | ALREADY_RESOLVED | Identical content on both forks. |
| `.github/workflows/scorecard.yml` | ALREADY_RESOLVED | Identical content on both forks. |
| `.mise.toml` | SAFE_TO_RESET_LFG_SUPERSEDES | AceHack has `uv = "0.9"`; LFG has `uv = "0.11.8"`. LFG-newer pins. |
| `.github/workflows/resume-diff.yml` | SAFE_TO_RESET_LFG_SUPERSEDES | AceHack uses `gh pr view --json comments` (returns GraphQL node IDs, broken per Codex P1 on LFG #649). LFG uses `gh api .../issues/.../comments --paginate --jq` (returns REST integer IDs, fixed). LFG version is the bug-fix. |
| `tools/setup/common/elan.sh` | SAFE_TO_RESET_LFG_SUPERSEDES | AceHack uses `curl_fetch_stream <url> \| sh` (streamed pipe-to-sh). LFG uses `curl_fetch --output` to temp + per-arch SHA256 verify + run. LFG version is structurally safer per Scorecard PinnedDependenciesID hardening. |
| `tools/setup/linux.sh` | SAFE_TO_RESET_LFG_SUPERSEDES | AceHack uses `curl_fetch_stream https://mise.run \| sh`. LFG uses pinned-tarball + per-arch SHA256 + temp-dir + trap. LFG version is structurally safer. |
| `.github/workflows/codeql.yml` | SAFE_TO_RESET_LFG_SUPERSEDES | AceHack dropped `java-kotlin` matrix cell. LFG kept it with explicit code-scanning-service rationale (no-findings SARIF per language). LFG-newer matrix structure. |
| `.github/workflows/gate.yml` | SAFE_TO_RESET_LFG_SUPERSEDES | AceHack has `Setup Python` + `pip install semgrep` (wrong-per-uv-decision) + extra cache paths already covered on LFG. LFG uses `install.sh` three-way-parity routing through `uv tool install`. See "gate.yml evidence detail" paragraph below the table. |

**Result: 9 of 9 infra files SAFE_TO_RESET or ALREADY_RESOLVED.** No NEEDS_FORWARD_SYNC. No NEEDS_HUMAN_DECISION on these 9.

#### gate.yml evidence detail

The maintainer 2026-04-29T09:51Z framing was: *"pip-install is wrong, uv we decided a long time ago."* AceHack's `pip install semgrep` step violates that prior uv-only decision for Python tool management.

LFG installs semgrep via `install.sh` three-way-parity. The `pipx:semgrep` pin in `.mise.toml` routes through `uv tool install` since `uv = "0.11.8"` is in the toolchain — see `docs/DECISIONS/2026-04-27-uv-canonical-python-tool-manager.md` for the canonical form.

AceHack's extra `tools/tla` / `tools/alloy` cache paths are already on LFG in the `Cache verifier jars (TLC + Alloy)` step.

The retry-attempts logic (`for attempt in 1 2 3 4 5; do`) is identical on both sides.

The only remaining diff is comment-wording register: AceHack's prose carries the legacy agency-framing form (the kind the no-directives lint catches).

LFG's prose uses maintainer-input phrasing.

Hard-reset removes the wrong-per-decision pip path, gains the canonical uv path, and cleans the lint-tripping prose register.

The declarative pattern composes with the broader factory direction (maintainer 2026-04-29T09:53Z: *"everything is declarative; we need all the functionality of `../scratch` — that's what we're aiming for for the ace package manager release"*). AceHack's imperative `pip install` step violates that target shape; LFG's pin-in-`.mise.toml` form fits it.

### The other 21 modified files (heuristic-projected; 5 spot-verified)

The 30-file modified-list is a superset of the 9 infra files. The remaining 21 are mostly memory / docs / tick-history / setup-script edits. Spot-checked 5 of the LARGEST-by-line (2026-04-29T09:55Z):

| File | AceHack-only +lines | LFG-only -lines | Verdict |
|---|---|---|---|
| `memory/CURRENT-aaron.md` | 2 | 267 | ALREADY_RESOLVED (verified in prior calibration batch) |
| `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_*.md` | 1 | 188 | ALREADY_RESOLVED (LFG-newer dominates) |
| `tools/hygiene/fix-markdown-md032-md026.py` | 17 | 158 | ALREADY_RESOLVED (LFG-newer dominates) |
| `memory/feedback_outdated_review_threads_*.md` | 1 | 134 | ALREADY_RESOLVED (LFG-newer dominates) |
| `memory/feedback_confucius_unfolding_pattern_*.md` | 1 | 127 | ALREADY_RESOLVED (LFG-newer dominates) |

Heuristic strongly holds: 5/5 spot-checks ALREADY_RESOLVED; combined with the 5-file calibration batch + 9-file infra table = **15 of 30 files verified ALREADY-COVERED**. The remaining 15 unverified are projected ALREADY-COVERED; the pattern is consistent (when LFG-newer (-) >> AceHack-newer (+), AceHack content is older drafts).

### Hard-reset preflight (per Amara 2026-04-29T09:50Z addition)

Before hard-reset, run a NARROW reachability-preservation pass — NOT broad LOST-branch recovery. Purpose: determine whether hard-reset would make AceHack-only substrate harder to recover.

Required checks:

```text
- list local branches whose commits are not reachable from origin/main
- list AceHack remote branches not merged to origin/main
- list worktrees and their HEAD SHAs
- list stashes and their base commits
- list known dangling commits from the corruption / lost-substrate ledger, if any
- classify whether each item intersects 0/0/0 hard-reset safety
```

Preflight classification:

```text
RESET_PREREQ_PRESERVE       — create named preservation ref or PR before hard-reset
RESET_IRRELEVANT_PARKED     — leave parked until after 0/0/0; do NOT recover during the active lane
ALREADY_REACHABLE           — already preserved via origin/main or other ref; no action
NEEDS_HUMAN_DECISION        — surface to maintainer
```

Best rule (Amara): *"Before hard-reset, preserve reachability. After hard-reset, recover history."*

Best blade: *"Do not do archaeology before reset. Do preserve the exits before closing the door."*

### Preflight result + fresh-clone evidence (2026-04-29T10:11Z)

#### Branch / worktree / stash preflight

```text
Local branches not reachable from origin/main:        794
Remote AceHack branches not reachable from origin/main: 122
Worktrees (locked under .claude/worktrees/agent-*):     ~9 visible
Stashes:                                                  7
```

For HARD-RESET of `acehack/main` specifically: hard-reset is a ref operation that moves only `acehack/main`. Other refs (branches, remote-tracking refs, worktree HEADs, stashes) are NOT deleted by that operation. They remain reachable post-reset.

Caveat (per Amara correction): blanket-classifying 794+122 branches as "reset-irrelevant" requires evidence. The narrow claim that holds: **hard-reset of `acehack/main` does not directly modify these refs**. A separate audit (NOT this lane) would classify which contain unique substrate worth preserving. Per the corrupt-clone-default below, that audit is best done from the clean clone.

#### Pack corruption found in local clone — local-only, remote intact

`git fsck --full` on the *local* clone reports:

```text
error: inflate: data stream error (incorrect data check)
error: cannot unpack 9bf2daee3ce53c88633824f9532a0158aaa92ed9
       from .git/objects/pack/pack-16732bccb3ace9ec45c913c57a1fd050fd730c3f.pack
       at offset 4973478
```

Object `9bf2dae...` is a BLOB (commit/tree history unaffected). Local clone frozen via `git config gc.auto 0` + `gc.pruneExpire never` + `gc.reflogExpire never` + `gc.reflogExpireUnreachable never` — preserves evidence per `memory/feedback_corruption_triage_discipline_object_health_incident_aaron_amara_2026_04_29.md`.

Fresh-clone evacuation (per the "corrupt clone default" rule below) executed 2026-04-29T10:06Z:

```text
$ git clone <LFG> /tmp/zeta-clean-2026-04-29/lfg
$ cd /tmp/zeta-clean-2026-04-29/lfg
$ git remote add acehack <AceHack>
$ git fetch acehack main
$ git fsck --full
(empty stdout, empty stderr — clean)
$ git rev-list --count origin/main..acehack/main
145
$ git rev-list --count acehack/main..origin/main
640
$ git rev-parse acehack/main
675508187a5e80bd0a8c14a74a9ae80d5346e722  (matches local clone)
```

**Conclusion: corruption is LOCAL-CLONE-ONLY.** Remote object stores (LFG + AceHack) are intact. Same SHAs, same divergence numbers. Hard-reset CAN proceed from the clean clone — it is NOT globally blocked.

### Corrupt clone default (per Amara 2026-04-29T10:10Z)

When the active local clone reports pack/object corruption:

```text
Default action (agent-owned, reversible, evidence-preserving):
  1. Freeze the corrupt clone (gc.auto 0 + reflogExpire never + pruneExpire never).
  2. NEVER run git gc / git prune / git repack / git fsck --lost-found in it.
  3. Create a fresh sibling clone (e.g., /tmp/zeta-clean-YYYY-MM-DD/<remote>).
  4. Add/fetch all relevant remotes.
  5. Run git fsck --full in the fresh clone.
  6. If clean: continue work from fresh clone; corrupt clone stays parked as forensic evidence.
  7. If fresh clone ALSO fails fsck: escalate to maintainer (corruption is remote, not local).

Maintainer direction required ONLY for irreversible loss:
  - Fresh clone fails fsck (remote/object-source corruption)
  - Required objects are unavailable from any remote
  - Accept-loss is being proposed
  - Hard-reset signoff is reached
```

Best rule (Amara): *"Fresh clone is not repair. Fresh clone is evacuation. Preserve evidence, resume from clean substrate."*

Tiny blade: *"Do not ask Aaron how to stop bleeding. Apply pressure. Then report what happened."*

### Reversible vs irreversible authority (per maintainer 2026-04-29T10:10Z delegation)

Maintainer 2026-04-29T10:10Z framing: *"you know git/github better than me now, your choices will also be higher quality as long as they are evidence-based and self-preservation based."*

```text
Agent-owned (reversible substrate-integrity ops, evidence-based):
  - Fresh-clone evacuation
  - git fsck diagnosis
  - Branch / worktree / stash classification
  - Per-file content-equivalence verification
  - Preflight tables
  - Forward-sync execution (additive, reversible)
  - Lint scope updates
  - Doc updates (including this file)
  - Closing PRs with stale framing
  - Pulling, fetching, branching
  - Local config changes (gc.auto, etc.) for forensic preservation

Maintainer-owned (irreversible loss, sign-off required):
  - Hard-reset of acehack/main (drops AceHack-unique commits irreversibly)
  - Force-push to LFG main (forbidden anyway)
  - Branch deletion when the branch contains unique substrate
  - Accept-loss decisions on corrupt blobs / orphan refs with substrate
  - Anything that is structurally unrecoverable
```

Composes with Amara's: *"Reversible preservation → agent acts. Irreversible loss → maintainer decides."*

## Honest assessment of safety

The 2026-04-28 plan's per-file direction analysis still applies in spirit but its specifics are 16h stale. Today's task #312 (durable retry fix in `elan.sh` + `linux.sh`) shifted the AceHack-side state of those two files — the plan's "AceHack regressed to unsafe form" framing on `linux.sh` may or may not still hold.

Direct git verification 2026-04-29T09:36Z:

- AceHack `linux.sh` mise-install path uses `curl_fetch_stream https://mise.run | sh` (the streamed pipe-to-sh form).
- LFG `linux.sh` mise-install path uses pinned-tarball + arch-specific SHA256 + temp-dir + trap (the structurally-safe form).
- For HARD-RESET (LFG tree replaces AceHack tree): AceHack would GAIN the safe form. Hard-reset is SAFE for `linux.sh`.

A peer-call to Grok this session reported the inverse claim ("AceHack has the secure form"). That claim is WRONG — direct git verification contradicts it. Note for future-self: peer-call output is a single LLM read of supplied text; ground every claim in `git show` before acting on it.

## Next action

**Hard-reset is NOT YET signoff-eligible.** The strict gate above requires `unclassified_lines = 0`. The live four-bucket ledger above is the source of truth for the current count; the remaining files are listed in the `unclassified_lines` composition block. The next agent-owned work is per-file semantic inspection of each remaining file to either promote each to SAFE_TO_RESET_LFG_SUPERSEDES (with named evidence) or downgrade to NEEDS_FORWARD_SYNC.

### Deferred follow-ups (NOT blocking 0/0/0 progress, captured for visibility)

Per multi-AI review 2026-04-29T10:50Z packet:

- **Gate-runner script** (now bumped to highest priority among deferred follow-ups): build `tools/zero-zero-zero/check-gate.sh` that emits a machine-readable summary of all 9 gate conditions and fails closed. Replaces the prose ledger AND the illustrative inline snippet above with a verifiable-by-execution gate. Per multi-AI review 2026-04-29T11:05Z (Codex P1 + Copilot 5 threads + Amara): the durable script must be tested against fixtures: paths with spaces, binary add, binary delete, binary modify, binary rename, binary copy, gawk-vs-BSD-awk portability, `mktemp` + `trap` cleanup. Until the script lands, binary direction MUST be classified manually via `git diff --name-status -z` per file + direct `git show` evidence. Best blade (Amara): *"The binary hole is found. The gate condition is right. The parser still needs teeth."*
- **Self-reference rule for personas in operational specs**: "Otto" is a named identity in the substrate. Should references to "Otto" in reusable operational specs follow the same role-vs-name rule as references to "Aaron" / "Amara"? Probably yes. Capture in `docs/AGENT-BEST-PRACTICES.md` extension.
- **LOST recovery soft-trigger predicate format**: "deferred with stated condition" needs a verifiable predicate that auto-resurfaces the work for resume/retire decision when the condition becomes true. Example shape: `"deferred until: (B-0105 lands) AND (no consolidation work is active)"`.
- **Time-gap between dry-run and real push**: structure the destructive sequence so dry-run + real push run as one operator-approved unit, not two separate decisions. Capture timestamps for both for any post-incident analysis.

State summary:

- 9 infra files: SAFE_TO_RESET_LFG_SUPERSEDES (6 files, 97 lines, named evidence) or ALREADY_RESOLVED (3 files, 0 lines, identical content).
- HEURISTIC_LFG_DOMINATES files remain (line-ratio dominance only — NOT proof per the strict bucket rule). Live count + per-file enumeration in the four-bucket ledger above.
- Branch / worktree / stash preflight: hard-reset of `acehack/main` does not modify these refs.
- Pack corruption found in local clone, **fresh clone passes fsck clean → corruption is local-only, remote intact**.
- Local clone frozen as forensic evidence. All future destructive work happens from `/tmp/zeta-clean-2026-04-29/lfg`.

Remaining steps to clear the gate:

1. **(AGENT, in-progress)** Per-file semantic inspection of the 18 HEURISTIC_LFG_DOMINATES files. For each, name the AceHack-only content + name the LFG equivalent/superset + write the reason LFG supersedes. Promote to SAFE_TO_RESET_LFG_SUPERSEDES, OR downgrade to NEEDS_FORWARD_SYNC if AceHack-only content is unique work.
2. **(AGENT)** Recompute the four-bucket ledger after each batch of files.
3. **(MAINTAINER, gate-final)** Once `unclassified_lines = 0` AND `unsafe_lines = 0`, sign off on hard-reset of `acehack/main` to `origin/main`. This is the irreversible step per the reversible-vs-irreversible authority categorization.
4. **(AGENT, post-sign-off)** From the clean clone:
   ```bash
   # Per multi-AI review packet 2026-04-29T10:35Z (convergent across
   # external AI reviewers): the v4 form below defends against
   # background-fetch race during the SHA-capture step itself.
   # `git rev-parse refs/remotes/acehack/main` can return a SHA newer
   # than what the just-completed `git fetch` produced if a background
   # cron/IDE auto-fetch fires in between. Fix: observe the remote ref
   # directly via `git ls-remote` BEFORE the fetch, then verify the
   # fetched value matches.
   #
   # See `git log` for the four-iteration history of this command.
   #
   # Best blade: "Do not lease by nickname. Do not lease by a moving
   # local guess. Lease the remote ref by observed SHA."

   set -euo pipefail
   cd /tmp/zeta-clean-2026-04-29/lfg

   git fetch origin main

   remote_expect=$(git ls-remote --refs acehack refs/heads/main | awk '{print $1}')
   git fetch acehack refs/heads/main:refs/remotes/acehack/main
   fetched_expect=$(git rev-parse refs/remotes/acehack/main)

   [ "$remote_expect" = "$fetched_expect" ] || {
     echo "acehack/main moved between ls-remote and fetch — stop, reclassify, re-enter gate"
     exit 1
   }

   # Dry-run first: validates push shape + credentials + refspec
   # without touching the remote. The real lease still matters at the
   # real push (server-side check). Per Codex 2026-04-29T10:48Z catch:
   # the dry-run MUST be guarded — a failed dry-run cannot be allowed
   # to fall through to the real push. `set -e` above catches it; the
   # explicit `if !` guard below makes it loud.
   if ! git push --dry-run \
     --force-with-lease=refs/heads/main:"$fetched_expect" \
     acehack \
     refs/remotes/origin/main:refs/heads/main
   then
     echo "DRY-RUN FAILED: refspec / credentials / push shape problem."
     echo "DO NOT PROCEED to real push. Diagnose dry-run failure first."
     exit 1
   fi

   # Real push.
   if ! git push \
     --force-with-lease=refs/heads/main:"$fetched_expect" \
     acehack \
     refs/remotes/origin/main:refs/heads/main
   then
     echo "LEASE REJECTED: acehack/main moved or expectation stale."
     echo ""
     echo "If dry-run succeeded above and real push rejected: the remote moved"
     echo "between dry-run and push. This is EXPECTED behavior — the lease did"
     echo "its job. The fix is NOT to debug syntax."
     echo ""
     echo "DO NOT RETRY BLINDLY. Re-fetch, recompute content-drift ledger,"
     echo "and re-enter the signoff gate from the top."
     exit 1
   fi
   ```
   This pushes `origin/main`'s commit to `acehack/main`, which is the destructive AceHack-side reset.
5. **(AGENT)** Verify 0/0/0:
   ```bash
   git rev-list --count origin/main..acehack/main   # expect 0
   git rev-list --count acehack/main..origin/main   # expect 0
   git diff origin/main..acehack/main                # expect empty
   ```
6. **(AGENT)** Update this file: replace "active trajectory" with the next priority, OR delete if no follow-on.
7. **(LATER, separate trajectory)** Forensic triage of the corrupt local clone (corruption-triage memory's full procedure). Not blocking 0/0/0.

## Stop conditions

- Any per-file analysis produces NEEDS-HUMAN-REVIEW → STOP, surface to maintainer, do not classify further until resolved.
- Any forward-sync PR's CI fails → STOP, classify the failure (PENDING_CHECKS / FAILING_CHECKS / etc. per the candidate 3-tick-classify rule), do not retry blindly.
- The maintainer redirects to a different trajectory → update this file FIRST, then pivot.
- Compaction or branch-switch happens → on resume, READ THIS FILE FIRST, then verify "current state" section against git, update if drifted, continue from "next action".

## Do-not list (mechanical)

- Do NOT run `git rev-list` or `git diff` on origin/main vs acehack/main as a *first* action. Read this file first; the verified state is here.
- Do NOT open new audit branches without referencing this file's "next action."
- Do NOT invoke peer-call (codex / gemini / grok) without an explicit specific question that this file does not already answer.
- Do NOT confuse parallel-tool-calls with peer mode. Peer mode is each AI running its own autonomous loop with git-native work-claim coordination — that is a separate trajectory (NOT this one) and is captured as a backlog candidate (the maintainer flagged "need a trajectory for real peer mode" 2026-04-29T09:30Z).
- Do NOT add new substrate islands to the absorption files (the multi-AI feedback packets) — they live in `docs/research/` as non-normative archives per B-0105.

## Resume protocol

Every wake / branch-switch / cron tick that touches this trajectory:

1. **Read this file in full.**
2. Produce a one-paragraph "current understanding" — the state I think I'm in + the next action I plan to take.
3. Compare to this file's "current state" + "next action" sections.
4. If they match: proceed.
5. If they DON'T match: STOP. Either the file is stale (update it), or my understanding is wrong (re-read the canonical artifacts in section 2 above). Do NOT proceed on the divergent understanding.

This file is the load-state. Without it, every resume re-derives state from scratch and produces parallel artifacts that don't connect to the prior trajectory. With it, every resume picks up from a known point.

## Trajectory-protocol meta-note

This file is itself an instance of a more general pattern: any multi-session trajectory needs a known-path load-state file. After 0/0/0 closes, candidates for the same shape:

- B-0105 consolidation-gate trajectory (next consolidation round)
- Future peer-mode trajectory (when the maintainer chooses to start it)
- Any future Aurora-round absorption arc

The pattern is: trajectory state lives in one file at a known path; rules-substrate (memory folder) is for cross-trajectory rules; tick history is for what happened. Each storage class has its own retrieval shape; conflating them produces the resume-amnesia failure mode.

## Authorship

Bootstrapped 2026-04-29T09:40Z by Claude (opus-4-7) in response to the maintainer's 2026-04-29T09:38Z message: *"they all got your raw logs and didn't talk to each other about it this is your fuckup, fix it. They might all be wrong, this is on me, don't take shortcuts or you'll just be stuck forever."*

The shape of this file is informed by external multi-AI feedback (Amara / Gemini / Ani / Claude.ai / Alexa / Deepseek), but the content is my own honest read of the failure mode I just lived through. The maintainer correctly noted that the multi-AI feedback was correlated (all read the same raw conversation logs without peer cross-talk), so their convergence is signal-not-proof. The structural diagnosis still landed because the failure mode is verifiable in this session's history.
