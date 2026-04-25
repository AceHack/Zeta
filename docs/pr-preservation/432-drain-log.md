# PR #432 drain log — runner-version-freshness shell portability + allow-list scope

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/432>
Branch: `drain/360-followup-shell-portability-and-allowlist`
Drain session: 2026-04-25 (Otto, post-summary continuation autonomous-loop)
Thread count at drain start: 7 unresolved (Codex P1/P2 + Copilot P0/P1)
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with
reviewer authorship, severity, outcome class.

This PR was a follow-up to #360 (the shell-portability hardening
of `tools/lint/runner-version-freshness.sh`). Multiple Codex + Copilot
reviewers caught real shell-portability + correctness issues including
one P0 regression (`warn` unbound under `set -u`).

---

## Threads (all FIX outcomes — substantive technical findings)

### Thread 1 — `tools/lint/runner-version-freshness.sh:185` — `warn` unbound under nounset (Codex P1)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59kAP9`
- Severity: P1
- Finding: with `set -u` enabled, `warn` must always be defined before
  the final `[ "$warn" = "1" ]` check. The patch removed the default
  initialization, so when `_verify_age_ok` returns success and no stale
  labels are found, the script aborts with `warn: unbound variable`
  instead of returning success — turns a passing-lint into env-error.
- Outcome: **FIX (P0 regression)** — initialized `warn=0` alongside
  `fail=0` and `env_error=0` near the top of the main loop; explicit
  comment notes `MUST be initialized before the final check; under
  set -u, an unset var would abort.` Commit `98ce441`.

### Thread 2 — `tools/lint/runner-version-freshness.sh:244` — Allow-list ERE escape (Codex P2)

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59kAP-`
- Severity: P2
- Finding: allow-list regex built from raw label strings; labels like
  `ubuntu-24.04` contain `.` (ERE wildcard); without escaping, typos
  like `ubuntu-24x04` match as if allow-listed. Reusing
  `escape_for_regex` would keep the check literal and reliable.
- Outcome: **FIX** — added explicit escape loop for `ALLOWED_LABELS`
  and `ROLLING_ALIASES` matching the existing `STALE_LABELS`
  treatment. Commit `98ce441`.

### Thread 3 — `tools/lint/runner-version-freshness.sh:265` — `warn` unbound (Copilot P0)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59kApl`
- Severity: P0
- Finding: same as Thread 1 — `warn` never initialized, evaluation
  under `set -u` aborts with "unbound variable" whenever
  `_verify_age_ok` returns success (the common case).
- Outcome: **FIX** — same fix as Thread 1. Commit `98ce441`.

### Thread 4 — `tools/lint/runner-version-freshness.sh:56` — `cd "$REPO_ROOT"` before consuming `$@` (Copilot P1)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59kApt`
- Severity: P1
- Finding: `cd "$REPO_ROOT"` happens before `files=("$@")` is consumed.
  If caller passes file paths relative to their cwd (per the usage
  comment), those paths won't resolve after the cd; script reports
  env_error instead of linting.
- Outcome: **FIX** — CLI args normalized to absolute paths BEFORE the
  chdir into REPO_ROOT. Each `$arg` is converted: `case "$arg" in /*)
  ... ;; *) "$PWD/$arg" ;; esac`. Smoke-tested:
  `bash tools/lint/runner-version-freshness.sh ../.github/workflows/codeql.yml`
  from `docs/` resolves correctly. Commit `98ce441`.

### Thread 5 — `tools/lint/runner-version-freshness.sh:213` — `|| true` masking sed failures (Copilot P1)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59kApy`
- Severity: P1
- Finding: comment says `|| true` is needed on grep side, but
  `cmd1 | sed ... || true` applies to entire pipeline under `pipefail`,
  masking real `sed` failures (missing tool, unsupported `-E`).
- Outcome: **FIX** — restructured to `{ grep -vE ... || true; } | sed`
  so only the expected grep no-output exit-1 is neutralized; a real
  sed failure still surfaces as environment error. Commit `98ce441`.

### Thread 6 — `tools/lint/runner-version-freshness.sh:245` — Same allow-list ERE escape (Copilot P1)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59kAp2`
- Severity: P1
- Outcome: **FIX** — combined with Thread 2; `escape_for_regex`
  applied to ALLOWED_LABELS and ROLLING_ALIASES.

### Thread 7 — `tools/lint/runner-version-freshness.sh:252` — Matrix-entry NOT-ON-ALLOW-LIST scan missing (Copilot P1)

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59kAp6`
- Severity: P1
- Finding: NOT-ON-ALLOW-LIST scan only checks scalar `runs-on:` values,
  explicitly skips expression-form `runs-on: ${{ ... }}`. Workflows
  using `runs-on: ${{ matrix.os }}` would let unknown matrix entries
  (e.g., `ubuntu-30.04`) bypass validation.
- Outcome: **FIX** — extended the scan to validate matrix list entries
  using the existing `matrix_prefix` form. Required line-number-aware
  exclude prefix `(^|^[0-9]+:)` because `grep -n` prepends `<linenum>:`
  which would otherwise break the `^` anchor in the exclude filter.
  Smoke-tested: matrix entries `macos-26` / `ubuntu-24.04` /
  `ubuntu-24.04-arm` correctly excluded as allow-listed; existing
  stale `ubuntu-22.04` findings unchanged. Commit `98ce441`.

---

## Pattern observations (Otto-250 training-signal class)

1. **Two reviewers catching the same P0 independently is a quality
   signal.** Threads 1 (Codex P1) and 3 (Copilot P0) flagged the same
   `warn` unbound regression. Cross-reviewer convergence on a single
   finding raises confidence that the issue is real and not reviewer
   noise. The severity differs (P1 vs P0) because Copilot weighted the
   "common case" path higher.

2. **`set -euo pipefail` interaction with shell quirks is a recurring
   class.** Three of 7 findings (Threads 1, 3, 5) directly trace to
   `set -u` / `set -o pipefail` interactions: unset variable abort,
   pipeline-wide `|| true` masking. The class is shell-strictness
   versus shell-permissive-default; the pattern is "every
   `set -e` script needs full audit of every variable read + every
   `|| true`."

3. **ERE-metachar escape is a recurring lint-script class.** The
   `escape_for_regex` pattern was already applied to STALE_LABELS in
   #360; #432 caught that ALLOWED_LABELS and ROLLING_ALIASES had been
   missed in the same treatment. The fix template propagates uniformly
   across all label arrays.

4. **`grep -n` line-number prefix breaks `^` anchors in subsequent
   greps.** This subtle interaction (Thread 7) required a
   line-number-aware exclude pattern `(^|^[0-9]+:)`. Worth capturing
   as a reusable pattern for future `grep -n | grep -vE "^..."` chains
   in lint scripts.

## Final resolution

All 7 threads resolved at SHA `98ce441`. PR auto-merge SQUASH armed;
CI cleared; PR merged to main as `60b197c`.

Drained by: Otto, post-summary autonomous-loop continuation, cron
heartbeat `f38fa487` (`* * * * *`).
