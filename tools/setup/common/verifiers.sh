#!/usr/bin/env bash
#
# tools/setup/common/verifiers.sh — downloads formal-verifier jars
# (TLC, Alloy) to `tools/tla/` and `tools/alloy/` respectively.
#
# Manifest format: `<target-dir>/<target-file>  <url>` per line,
# comments starting with `#`. Per the human maintainer's round-29
# call we do not verify checksums (trust-on-first-use); when
# upstream provides a published SHA256SUMS we may revisit.
#
# This replaces the legacy tools/install-verifiers.sh in the same
# commit (greenfield — no alias per GOVERNANCE.md §24 fallout).

set -euo pipefail

# shellcheck source=curl-fetch.sh
# shellcheck disable=SC1091  # CI runs without -x; source path verified in tools/setup/common/curl-fetch.sh
source "$(dirname "${BASH_SOURCE[0]}")/curl-fetch.sh"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/verifiers"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ no verifiers manifest; skipping"
  exit 0
fi

# Assert the JVM is present — TLC + Alloy both need it. The manifest
# has nothing to do unless Java is available.
if ! command -v java >/dev/null 2>&1; then
  echo "error: java not on PATH; install JDK 21 (brew openjdk@21 or apt openjdk-21-jdk)"
  exit 1
fi

grep -vE '^(#|$)' "$MANIFEST" | while IFS= read -r line; do
  target="$(echo "$line" | awk '{print $1}')"
  url="$(echo "$line" | awk '{print $2}')"
  dest="$REPO_ROOT/$target"
  mkdir -p "$(dirname "$dest")"
  if [ -f "$dest" ]; then
    # Trust-on-first-use: if the file exists we assume it's intact.
    # Per the human maintainer's round-29 call we do not re-verify content.
    echo "✓ $target already present"
  else
    # Download to a .part suffix then atomic-rename. Protects against
    # partial downloads (network flap, Ctrl-C, OOM) becoming
    # permanently trusted by the TOFU check above.
    #
    # Retries: GitHub's release-asset CDN occasionally returns
    # transient 502 / 504 / 5xx responses (observed 2026-04-25
    # ~13:52 UTC; recurring 504 on tla2tools/ln.jar 2026-06-06 —
    # 5+ gate runs). Per Otto-285 (don't use determinism to avoid
    # edge-case handling — handle the network-non-determinism
    # algorithmically), curl_fetch (from common/curl-fetch.sh)
    # handles the INNER retry: 5 attempts, 2-4-8-16-32 s
    # exponential backoff, --retry-all-errors so 4xx/5xx retry too
    # (~62 s total per curl_fetch call).
    #
    # OUTER retry (below): a sustained CDN outage can outlast a
    # single curl_fetch's ~62 s window (2026-06-06: 6×504 then
    # exit 22, repeated across gate runs). We don't control the
    # CDN, so wrap the whole fetch in a bounded outer loop with
    # its own coarse backoff — total coverage ~62 s × attempts +
    # 30/60/90 s sleeps ≈ several minutes. Bounded (never hangs):
    # fails loudly after $max_attempts so a true upstream outage
    # still surfaces rather than spinning forever.
    echo "↓ downloading $target from $url"
    attempt=1
    max_attempts=4
    until curl_fetch -o "$dest.part" "$url"; do
      rm -f "$dest.part"
      if [ "$attempt" -ge "$max_attempts" ]; then
        echo "error: failed to download $target after $max_attempts attempts (last url: $url)" >&2
        exit 1
      fi
      sleep_s=$(( attempt * 30 ))
      echo "  attempt $attempt/$max_attempts failed (transient upstream, e.g. GitHub release-CDN 5xx); retrying in ${sleep_s}s" >&2
      attempt=$(( attempt + 1 ))
      sleep "$sleep_s"
    done
    mv "$dest.part" "$dest"
    echo "✓ $target"
  fi
done
