#!/usr/bin/env bash
# tools/git/push-with-retry.sh
#
# Thin wrapper over `git push` that retries on transient
# GitHub 5xx errors. Thin-wrapper-over-existing-CLI exemption
# from the bun+TS default per docs/POST-SETUP-SCRIPT-STACK.md.
#
# Why this exists: the factory has observed recurring
# transient GitHub 500s during autonomous-loop tick-close
# commits (multiple occurrences 2026-04-23). A retry of the
# same `git push` command succeeds on the next attempt within
# seconds. Manual retry burns tick budget; a one-line helper
# makes the retry uniform.
#
# Root-cause investigation (2026-04-23, per the DST discipline
# — retries should be investigated before added, per the
# per-user memory on DST retries-are-non-determinism-smell):
#
# - Local git config is clean: `remote.origin.url =
#   https://github.com/Lucent-Financial-Group/Zeta.git` with
#   no trailing slash.
# - `GIT_TRACE=1 GIT_CURL_VERBOSE=1 git ls-remote origin`
#   shows the on-wire URL is
#   `/Lucent-Financial-Group/Zeta.git/git-upload-pack` — the
#   trailing `.git/` in error messages is `.git/git-upload-pack`
#   truncated in git's error formatter, not a client-side
#   URL-construction bug. The maintainer's trailing-slash
#   hypothesis was structural but the `/` is the path
#   separator before the Git-protocol endpoint, correct per
#   spec.
# - The HTTP 500 returns directly from GitHub's server and
#   reproduces intermittently on different commands
#   (push / ls-remote).
# - Conclusion: the 500 is a genuinely external GitHub
#   transient, not a client-side fix we can make. This is
#   the "real external reasons we can't control" exception
#   from the DST discipline — retry is legitimate here
#   after investigation, not as a default reach.
#
# If the 500-rate escalates or the investigation surfaces a
# new root cause, this wrapper should be revisited.
#
# DST classification: ACCEPTED_BOUNDARY (external network
# I/O + retry-on-failure) per the boundary registry at
# `docs/research/dst-accepted-boundaries.md` §3. Not a
# DST-held violation; rationale + retry discipline
# documented there. First classified 2026-04-23, formally
# registered Otto-168 2026-04-24 after Amara 19th-ferry
# correction #3 audit.
#
# Usage: tools/git/push-with-retry.sh [git push args...]
#   tools/git/push-with-retry.sh
#   tools/git/push-with-retry.sh --set-upstream origin my-branch
#
# Exit codes:
#   0   push succeeded (possibly after retries)
#   1   all retries exhausted on transient 5xx
#   2   environment validation failed (non-integer env value)
#   N   non-transient error — propagates `git push`'s own
#       exit code
#
# Environment:
#   GIT_PUSH_MAX_ATTEMPTS  override retry count (default 3;
#                          must be a positive integer)
#   GIT_PUSH_BACKOFF_S     override initial backoff seconds
#                          (default 2; doubles each retry;
#                          must be a non-negative integer)

set -euo pipefail

# Validate env values as integers before any arithmetic
# contexts fire (otherwise set -e would kill the script
# with a confusing message).
int_re='^[0-9]+$'
max_attempts="${GIT_PUSH_MAX_ATTEMPTS:-3}"
backoff="${GIT_PUSH_BACKOFF_S:-2}"
if ! [[ "$max_attempts" =~ $int_re ]] || (( max_attempts < 1 )); then
  echo "push-with-retry: GIT_PUSH_MAX_ATTEMPTS must be a positive integer; got '$max_attempts'" >&2
  exit 2
fi
if ! [[ "$backoff" =~ $int_re ]]; then
  echo "push-with-retry: GIT_PUSH_BACKOFF_S must be a non-negative integer; got '$backoff'" >&2
  exit 2
fi

# Temp-file lifecycle. Single tmp file reused across attempts,
# cleaned up on EXIT (normal or signal — addresses the
# Ctrl-C / SIGTERM leak case).
tmp_stderr="$(mktemp)"
cleanup() {
  rm -f "$tmp_stderr"
}
trap cleanup EXIT

attempt=1
while (( attempt <= max_attempts )); do
  # Capture git push's exit code directly. Use `set +e`
  # locally so non-zero exit doesn't terminate the script
  # (set -e would kill us otherwise) AND so $? is the push's
  # exit code, not an if-compound return value.
  set +e
  git push "$@" 2> >(tee "$tmp_stderr" >&2)
  exit_code=$?
  set -e

  if (( exit_code == 0 )); then
    exit 0
  fi

  # Only retry on transient 5xx errors from the remote.
  if grep -qE "(500|502|503|504|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)" "$tmp_stderr"; then
    if (( attempt < max_attempts )); then
      echo "push-with-retry: transient 5xx on attempt $attempt/$max_attempts; retrying in ${backoff}s..." >&2
      sleep "$backoff"
      backoff=$(( backoff * 2 ))
      attempt=$(( attempt + 1 ))
      # Clear the tmp file for the next attempt.
      : > "$tmp_stderr"
      continue
    fi
    echo "push-with-retry: failed after $max_attempts attempts on transient 5xx" >&2
    exit 1
  fi

  # Non-transient error (auth / protected branch / hook /
  # divergence / etc.) — propagate git push's own exit code,
  # do not retry.
  exit "$exit_code"
done
