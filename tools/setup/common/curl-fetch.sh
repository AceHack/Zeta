#!/usr/bin/env bash
#
# tools/setup/common/curl-fetch.sh — sourceable helpers for
# fetching URLs during install.
#
# One helper:
#   - curl_fetch        — file-output downloads. `--retry 5`
#                         + `--retry-all-errors` (safe because
#                         curl restarts the file from scratch
#                         on retry).
#
# All upstream-installer call sites (Homebrew, mise, elan)
# now use the download-to-temp + verify + exec pattern via
# curl_fetch. The former curl_fetch_stream function (streamed
# pipe-to-shell, no retries) was removed by 081KQ8P5D0008QG0R001DMK8JD — no call
# sites remain.
#
# WHY
# ===
# Human maintainer 2026-04-28: external-infra failures
# (upstream package mirrors returning 5xx, transient curl-22
# / network blips) should be absorbed by retry-with-backoff
# inside the install path, not kicked out to a workflow-rerun
# discipline. Quote: *"curl 502 pattern i mean why should a
# PR ever fail for this? our code does not handle the retries
# already?"*
#
# This file centralises the retry policy so every call site
# uses the same flags. Previously the policy was inlined in
# `tools/setup/mechanisms/from-url.sh` and missing entirely from
# `linux.sh` (mise install), `macos.sh` (Homebrew install),
# and `elan.sh` (Lean toolchain install). Follow-up framing:
# *"sounds like a common helper would help too rather than
# copy/paste."*
#
# DOWNLOAD-TO-TEMP PATTERN (081KQ8P5D0008QG0R001DMK8JD)
# ==================================
# All upstream-installer call sites now download to a temp
# file via curl_fetch (with full retries), verify content
# (SHA256 when upstream publishes one, non-empty size check
# otherwise), then exec the verified file. This replaces the
# former curl_fetch_stream pipe-to-shell pattern which could
# not safely retry (partial bytes already piped to the shell
# consumer cannot be un-received).
#
# USAGE
# =====
# Source this file, then call curl_fetch:
#
#     # shellcheck source=/dev/null
#     source "$REPO_ROOT/tools/setup/common/curl-fetch.sh"
#
#     # File output (safe with full retries):
#     curl_fetch --output "$path" "$url"
#
#     # Upstream installers — download to temp, verify, exec:
#     TMP="$(mktemp)"
#     trap 'rm -f "$TMP"' EXIT
#     curl_fetch --output "$TMP" "$url"
#     [ -s "$TMP" ] || { echo "error: empty download" >&2; exit 1; }
#     bash "$TMP"
#
# RETRY POLICY (rationale)
# ========================
#   --retry 5            — up to 5 retries (6 total attempts
#                          including the initial try, per
#                          curl(1)). Empirically covers the
#                          upstream 5xx blips this install
#                          path has hit.
#   --retry-delay 2      — 2-second base delay between retries.
#   --retry-all-errors   — (file-output only) retry on ALL
#                          transient errors including HTTP
#                          5xx without `Retry-After`. Curl's
#                          default `--retry` only retries
#                          connect / DNS / 408 / 429 / 5xx-
#                          with-Retry-After.
#   -fsSL                — original flags preserved:
#                            -f: fail on HTTP errors
#                            -s: silent (no progress meter)
#                            -S: show errors when silent
#                            -L: follow redirects
#
# COMMAND-SUBSTITUTION + SET-E (historical note)
# ===============================================
# All installer call sites now use download-to-temp + exec
# (081KQ8P5D0008QG0R001DMK8JD), which sidesteps the command-substitution + set -e
# interaction entirely. curl_fetch writes to a file; failure
# is caught by curl's non-zero exit + set -euo pipefail; the
# size check ([ -s "$TMP" ]) catches the edge case of an
# empty download. No command substitution in the critical path.
#
# IDEMPOTENCE
# ===========
# Re-sourcing this file is a no-op once the helper is
# loaded. The guard uses a file-local sentinel variable
# (`_CURL_FETCH_LOADED`) instead of probing for an
# existing `curl_fetch` function: a function-name probe
# would silently skip the definition if the caller
# environment already had an unrelated `curl_fetch`
# function. Sentinel-based guarding ties the load decision
# to "did this file load?" instead of "does that name
# exist?"

if [[ -z "${_CURL_FETCH_LOADED:-}" ]]; then
_CURL_FETCH_LOADED=1

# Feature-detect --retry-all-errors support. The flag was added in
# curl 7.71.0 (2020-06-24); older OS-provided curl builds (notably
# pre-2020 LTS distros, some embedded environments, some older macOS
# system curl) reject it as an unknown option and fail the entire
# call. This helper is sourced from install.sh BEFORE any toolchain
# manager has put a newer curl on PATH, so the OS-provided curl IS
# what runs first. Memoised so the `curl --help` probe runs once per
# shell, not once per call.
_curl_fetch_supports_retry_all_errors() {
  if [[ -z "${_CURL_FETCH_SUPPORTS_RETRY_ALL_ERRORS:-}" ]]; then
    if curl --help all 2>/dev/null | grep -Fq -- '--retry-all-errors'; then
      _CURL_FETCH_SUPPORTS_RETRY_ALL_ERRORS=1
    else
      _CURL_FETCH_SUPPORTS_RETRY_ALL_ERRORS=0
    fi
  fi
  [[ "${_CURL_FETCH_SUPPORTS_RETRY_ALL_ERRORS}" == "1" ]]
}

# File-output variant — safe with --retry-all-errors because
# curl restarts the output file from scratch on each retry. Falls
# back to plain --retry / --retry-delay on older curl builds that
# don't support --retry-all-errors (curl < 7.71.0). The fallback
# loses the "retry on HTTP 5xx without Retry-After" coverage but
# keeps the connect/DNS/408/429/5xx-with-Retry-After retry behaviour
# that bare --retry already provides.
curl_fetch() {
  local -a retry_args=(--retry 5 --retry-delay 2)
  if _curl_fetch_supports_retry_all_errors; then
    retry_args+=(--retry-all-errors)
  fi
  curl -fsSL "${retry_args[@]}" "$@"
}

fi
