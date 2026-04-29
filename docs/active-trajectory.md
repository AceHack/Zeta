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

```bash
git diff --numstat origin/main..acehack/main | awk '
  # Binary files: numstat emits "-\t-\t<path>". They have no countable lines,
  # but content can still be lost on hard-reset. Count them separately so
  # they require explicit classification rather than being silently dropped.
  $1 == "-" && $2 == "-" {
    binary_files += 1
    next
  }
  {
    add += $1; del += $2; files += 1
    if ($1 == 0) zero_files += 1
  }
  END {
    print "text_modified_files=" files
    print "zero_acehack_only_files=" zero_files
    print "potential_loss_lines=" add
    print "lfg_newer_lines=" del
    print "binary_modified_files=" (binary_files+0)
    if ((binary_files+0) > 0) {
      print "WARNING: binary files in diff need separate classification (lines uncountable)."
      print "Run: git diff --name-status origin/main..acehack/main | awk '\''$1!~/^[D]$/'\'' | grep -F -f <(git diff --numstat origin/main..acehack/main | awk '\''$1==\"-\"{print $3}'\'')"
    }
  }
'
```

Per Codex 2026-04-29T10:42Z catch (PR #835): the prior version of this script silently excluded binary files via `$1 != "-" && $2 != "-"`. `git diff --numstat` emits `-/-` for binary content because it can't count lines, but binary files CAN still be erased on hard-reset. New version counts them separately and surfaces a warning when present.

Verified 2026-04-29T10:43Z: the 5 binary-classified files in the current diff are all LFG-only (status `D` from AceHack perspective; hard-reset ADDS them, doesn't erase AceHack content), so this specific instance has zero binary-loss surface. The script fix is for general correctness.

Current ledger (computed 2026-04-29T10:25Z):

```text
potential_loss_lines  = 273    all AceHack-only +lines (would be erased on hard-reset)
classified_safe_lines = 97     semantic evidence in BUCKET 2 (SAFE_TO_RESET_LFG_SUPERSEDES)
unsafe_lines          = 0      no NEEDS_FORWARD_SYNC or NEEDS_HUMAN_DECISION
unclassified_lines    = 176    HEURISTIC_LFG_DOMINATES — pending per-file semantic inspection
```

### Hard-reset signoff gate (strict)

Hard-reset is signoff-eligible ONLY when:

```text
unclassified_lines             = 0
unsafe_lines                   = 0
binary_acehack_only_files      = 0  (binary files exist only on LFG, OR each binary file has been classified)
fresh-clone fsck               = clean
hard-reset preflight           = clean
ls-remote-vs-fetch SHA match   = verified
dry-run push shape             = clean
maintainer signoff             = yes
```

Per multi-AI review 2026-04-29T10:35Z: dry-run push shape verification is added to the gate. Validates refspec + credentials + push shape before the real destructive operation. The real lease still matters at the real push (server-side check); dry-run is an additive safety check, not a replacement.

Lease rejection on the real push is NOT a retry condition. It means the remote moved between observation and push — restart the safety gate from the top (re-fetch, recompute content-drift ledger, re-classify if anything moved).

**Currently NOT signoff-eligible**: 176 unclassified lines remain (18 files in HEURISTIC_LFG_DOMINATES).

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

**Hard-reset is NOT YET signoff-eligible.** The strict gate above requires `unclassified_lines = 0`, and the current ledger says `unclassified_lines = 176` (18 files in HEURISTIC_LFG_DOMINATES). The next agent-owned work is per-file semantic inspection of those 18 files to either promote each to SAFE_TO_RESET_LFG_SUPERSEDES (with named evidence) or downgrade to NEEDS_FORWARD_SYNC.

State summary:

- 9 infra files: SAFE_TO_RESET_LFG_SUPERSEDES (6 files, 97 lines, named evidence) or ALREADY_RESOLVED (3 files, 0 lines, identical content).
- 18 files in HEURISTIC_LFG_DOMINATES (176 lines, line-ratio dominance only — NOT proof per the strict bucket rule).
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
