#!/usr/bin/env bash
#
# tools/hygiene/audit-cross-platform-parity.sh — detects cross-
# platform parity gaps across the tools/ tree: bash scripts that
# need a PowerShell twin for Windows support, and the inverse.
# Detect-only; `--enforce` flips exit 2 on gaps.
#
# Post-setup stack: bash scaffolding — the audit ships under
# `tools/hygiene/` and has to exist in bash while the bun+TS post-
# setup migration is mid-flight (same exception as
# `audit-post-setup-script-stack.sh` and
# `audit-missing-prevention-layers.sh`). Queued for bun+TS
# migration alongside them in docs/BACKLOG.md.
#
# ----- Decision record (mini-ADR) ---------------------------------
#
# Date:        2026-04-22
# Context:     Aaron 2026-04-22 — "missing mac/windows/linux/wsl
#              parity (ubuntu latest) we can deffer but should have
#              the hygene in place for when we want to enforce and
#              it will be more obvious to you in the future that we
#              are cross platform."
# Decision:    Author the audit NOW (detect-only); defer enforcement
#              (no CI gate, exit 0 on gaps) until the baseline
#              violations are triaged and CI matrix (macos-latest /
#              windows-latest / ubuntu-latest) is wired. The
#              `--enforce` flag flips exit 2 on gaps so the
#              transition to enforcement is a one-line change when
#              the baseline is green.
# Alternatives considered:
#              (a) Don't build it yet — rejected: cross-platform
#                  status becomes aspirational not visible; Aaron
#                  already noted it's easy to forget ("i was going
#                  to wait and see if you rmembered that").
#              (b) Build it + enforce immediately — rejected: 12
#                  pre-setup bash scripts currently have no
#                  PowerShell twin (Q1 violation discovered while
#                  authoring this audit); turning on enforcement
#                  blocks every CI run until all are fixed, which
#                  is cart-before-horse.
#              (c) Build it + enforce — this choice. Cross-
#                  platform-first becomes a *visible* factory
#                  property (the audit exists, runs, prints the
#                  gap); enforcement flips on after triage. Same
#                  pattern as FACTORY-HYGIENE row #23 (proposed →
#                  active) and row #47 (detect-only-gap →
#                  prevention-bearing).
# Auditable by: Aaron on next invocation; any reviewer of this file;
#              CI once `--enforce` is wired.
# Supersedes:  N/A — first instance of cross-platform parity
#              hygiene.
# Expires when: baseline is green (all listed gaps resolved or
#              intentional-decision-labelled) AND CI matrix runs
#              `--enforce` on macos-latest / windows-latest /
#              ubuntu-latest. At that point this comment block
#              migrates to a proper ADR under docs/DECISIONS/ per
#              the not-yet-formalised mini-ADR-format ADR (queued
#              BACKLOG).
#
# ----- Rule classes -----------------------------------------------
#
# Pre-setup (tools/setup/**/*)
#   - Both .sh AND .ps1 required. This is the existing Q1 dual-
#     authoring rule per
#     `memory/feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live`
#     and docs/POST-SETUP-SCRIPT-STACK.md Q1. Pre-setup scripts run
#     BEFORE canonical tooling (bun, dotnet) is installed, on a
#     bare OS-default shell — bash on macOS/Linux, PowerShell on
#     Windows. Missing either twin = Q1 violation.
#
# Post-setup permanent-bash (thin wrapper over existing CLI /
#                            trivial find-xargs pipeline /
#                            stay bash forever)
#   - PowerShell twin required per
#     `memory/feedback_stay_bash_forever_implies_powershell_twin_obligation.md`.
#     A permanent-bash script without a .ps1 twin silently breaks
#     Windows devs (they'd need WSL / Git Bash for a tool the
#     factory sells as cross-platform).
#
# Post-setup transitional (bun+TS migration candidate /
#                          bash scaffolding)
#   - No twin obligation. The long-term plan is one cross-platform
#     bun+TS script; the single-bash state is acknowledged
#     transitional.
#
# Post-setup bun+TS (*.ts under tools/)
#   - No twin needed — cross-platform native via the bun runtime.
#
# ------------------------------------------------------------------
#
# Usage:
#   tools/hygiene/audit-cross-platform-parity.sh            # report
#   tools/hygiene/audit-cross-platform-parity.sh --summary  # counts
#   tools/hygiene/audit-cross-platform-parity.sh --enforce  # exit 2
#                                                          # on gaps
#
# Exit codes:
#   0   always, unless --enforce and gaps > 0
#   1   usage error
#   2   --enforce mode with gap count > 0

set -euo pipefail

MODE="report"
for arg in "$@"; do
  case "$arg" in
    --summary) MODE="summary" ;;
    --enforce) MODE="enforce" ;;
    -h|--help)
      sed -n '3,60p' "$0"
      exit 0
      ;;
    *)
      echo "error: unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

# Enumerate every script under tools/. git ls-files excludes
# vendored / gitignored build caches. NUL-delimited for whitespace
# tolerance; while-read for bash 3.2 (macOS default) compatibility.
ALL=()
while IFS= read -r -d '' f; do
  ALL+=("$f")
done < <(git ls-files -z 'tools/*.sh' 'tools/*.ps1' 'tools/**/*.sh' 'tools/**/*.ps1' | sort -z)

# Classify a path. Echoes one of:
#   pre-setup
#   post-setup-permanent
#   post-setup-transitional
#   exempt-deprecated
classify() {
  local p="$1"
  case "$p" in
    tools/setup/*) echo "pre-setup"; return ;;
    tools/_deprecated/*) echo "exempt-deprecated"; return ;;
  esac
  # Post-setup: inspect the FIRST label-declaration line only,
  # to avoid false-positives on prose that references other
  # category names while explaining the rule taxonomy. The two
  # accepted declaration patterns are:
  #   # Post-setup stack: <label> — ...
  #   # label: "<label>" — ...   (self-referential form)
  local decl
  decl="$(head -60 "$p" 2>/dev/null | grep -iE '^# (Post-setup stack|Exception label|label):' | head -1)"
  case "$decl" in
    *"thin wrapper over existing CLI"*) echo "post-setup-permanent" ;;
    *"trivial find-xargs pipeline"*) echo "post-setup-permanent" ;;
    *"stay bash forever"*) echo "post-setup-permanent" ;;
    *"bun+TS migration candidate"*) echo "post-setup-transitional" ;;
    *"bash scaffolding"*) echo "post-setup-transitional" ;;
    *)
      # Unlabelled post-setup bash — violation of the post-setup
      # stack rule (row #46), not a parity question. Defer to
      # that row's audit; classify here as transitional to avoid
      # double-counting.
      echo "post-setup-transitional"
      ;;
  esac
}

# Return 0 if `<stem>.ps1` exists as a tracked file (Git-tracked,
# not just on disk). 1 otherwise.
has_twin() {
  local p="$1"
  local stem="${p%.sh}"
  git ls-files --error-unmatch "${stem}.ps1" >/dev/null 2>&1
}

# Return 0 if `<stem>.sh` exists as a tracked file.
has_bash_twin() {
  local p="$1"
  local stem="${p%.ps1}"
  git ls-files --error-unmatch "${stem}.sh" >/dev/null 2>&1
}

PAIRED=()
PRE_SETUP_GAP_BASH=()       # .sh under tools/setup/ without .ps1
PRE_SETUP_GAP_PS1=()        # .ps1 under tools/setup/ without .sh
POST_PERM_GAP=()            # permanent-bash .sh without .ps1
TRANSITIONAL=()             # no twin obligation
EXEMPT=()

for f in "${ALL[@]}"; do
  case "$f" in
    *.sh)
      klass="$(classify "$f")"
      case "$klass" in
        pre-setup)
          if has_twin "$f"; then
            PAIRED+=("$f")
          else
            PRE_SETUP_GAP_BASH+=("$f")
          fi
          ;;
        post-setup-permanent)
          if has_twin "$f"; then
            PAIRED+=("$f")
          else
            POST_PERM_GAP+=("$f")
          fi
          ;;
        post-setup-transitional)
          TRANSITIONAL+=("$f")
          ;;
        exempt-deprecated)
          EXEMPT+=("$f")
          ;;
      esac
      ;;
    *.ps1)
      case "$f" in
        tools/setup/*)
          if has_bash_twin "$f"; then
            : # already counted via the .sh side of the pair
          else
            PRE_SETUP_GAP_PS1+=("$f")
          fi
          ;;
        tools/_deprecated/*)
          EXEMPT+=("$f")
          ;;
        *)
          # Post-setup .ps1 is unusual; no twin obligation on this
          # side unless the .sh side is a permanent-bash exception.
          # Count under PAIRED if the .sh twin exists, else treat
          # as standalone (rare; not currently used).
          if has_bash_twin "$f"; then
            : # .sh side already counted
          else
            TRANSITIONAL+=("$f")
          fi
          ;;
      esac
      ;;
  esac
done

gap_count=$(( ${#PRE_SETUP_GAP_BASH[@]} + ${#PRE_SETUP_GAP_PS1[@]} + ${#POST_PERM_GAP[@]} ))

if [[ "$MODE" == "summary" ]]; then
  printf 'paired:                    %d\n' "${#PAIRED[@]}"
  printf 'transitional (no gap):     %d\n' "${#TRANSITIONAL[@]}"
  printf 'exempt (_deprecated):      %d\n' "${#EXEMPT[@]}"
  printf 'gap: pre-setup .sh no twin:  %d\n' "${#PRE_SETUP_GAP_BASH[@]}"
  printf 'gap: pre-setup .ps1 no twin: %d\n' "${#PRE_SETUP_GAP_PS1[@]}"
  printf 'gap: permanent-bash no .ps1: %d\n' "${#POST_PERM_GAP[@]}"
  printf 'gap total:                 %d\n' "$gap_count"
else
  echo "# Cross-platform parity audit"
  echo
  echo "Run: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Authoritative rules: docs/POST-SETUP-SCRIPT-STACK.md Q1 (pre-setup)"
  echo "  + memory/feedback_stay_bash_forever_implies_powershell_twin_obligation.md"
  echo "  (post-setup permanent-bash)."
  echo "Mode: $MODE (enforcement deferred; exit 2 requires --enforce)."
  echo
  echo "## Paired (${#PAIRED[@]})"
  echo
  echo "Scripts with a complete cross-platform twin."
  echo
  if [[ ${#PAIRED[@]} -gt 0 ]]; then
    printf -- '- %s\n' "${PAIRED[@]}"
  else
    echo "- (none)"
  fi
  echo
  echo "## Gaps — pre-setup bash without PowerShell twin (${#PRE_SETUP_GAP_BASH[@]})"
  echo
  echo "Q1 violation per docs/POST-SETUP-SCRIPT-STACK.md — pre-setup scripts"
  echo "MUST be dual-authored as bash + PowerShell because they run before"
  echo "canonical tooling is installed, on OS-default shells."
  echo
  if [[ ${#PRE_SETUP_GAP_BASH[@]} -gt 0 ]]; then
    printf -- '- %s (missing .ps1)\n' "${PRE_SETUP_GAP_BASH[@]}"
  else
    echo "- (none — clean)"
  fi
  echo
  echo "## Gaps — pre-setup PowerShell without bash twin (${#PRE_SETUP_GAP_PS1[@]})"
  echo
  if [[ ${#PRE_SETUP_GAP_PS1[@]} -gt 0 ]]; then
    printf -- '- %s (missing .sh)\n' "${PRE_SETUP_GAP_PS1[@]}"
  else
    echo "- (none — clean)"
  fi
  echo
  echo "## Gaps — permanent-bash without PowerShell twin (${#POST_PERM_GAP[@]})"
  echo
  echo "Post-setup permanent-bash exceptions (thin wrapper / find-xargs /"
  echo "stay bash forever) owe a .ps1 twin per the 2026-04-22 Windows-twin"
  echo "obligation. Missing twin is a quiet break for Windows devs."
  echo
  if [[ ${#POST_PERM_GAP[@]} -gt 0 ]]; then
    printf -- '- %s (missing .ps1)\n' "${POST_PERM_GAP[@]}"
  else
    echo "- (none — clean)"
  fi
  echo
  echo "## Transitional / exempt (${#TRANSITIONAL[@]} + ${#EXEMPT[@]})"
  echo
  echo "Transitional (bun+TS migration candidate / bash scaffolding): no twin obligation."
  echo "Exempt (tools/_deprecated/): awaiting deletion."
  echo
  echo "Transitional:"
  if [[ ${#TRANSITIONAL[@]} -gt 0 ]]; then
    printf -- '- %s\n' "${TRANSITIONAL[@]}"
  else
    echo "- (none)"
  fi
  echo
  echo "Exempt:"
  if [[ ${#EXEMPT[@]} -gt 0 ]]; then
    printf -- '- %s\n' "${EXEMPT[@]}"
  else
    echo "- (none)"
  fi
  echo
  echo "## Summary"
  echo
  printf -- '- paired:                    %d\n' "${#PAIRED[@]}"
  printf -- '- transitional (no gap):     %d\n' "${#TRANSITIONAL[@]}"
  printf -- '- exempt (_deprecated):      %d\n' "${#EXEMPT[@]}"
  printf -- '- gap: pre-setup .sh no twin:  %d\n' "${#PRE_SETUP_GAP_BASH[@]}"
  printf -- '- gap: pre-setup .ps1 no twin: %d\n' "${#PRE_SETUP_GAP_PS1[@]}"
  printf -- '- gap: permanent-bash no .ps1: %d\n' "${#POST_PERM_GAP[@]}"
  printf -- '- gap total:                 %d\n' "$gap_count"
fi

if [[ "$MODE" == "enforce" && "$gap_count" -gt 0 ]]; then
  echo
  echo "FAIL: $gap_count cross-platform parity gap(s). See rules above." >&2
  exit 2
fi
exit 0
