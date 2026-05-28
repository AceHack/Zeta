#!/usr/bin/env bash
#
# tools/setup/common/mise.sh — trust the repo's .mise.toml and run
# `mise install` to pin dotnet + python to the declared versions.
#
# `.mise.toml` is the single source of truth for language-runtime
# pins. Adding a runtime = editing that file. See
# docs/research/build-machine-setup.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

if [ ! -f "$REPO_ROOT/.mise.toml" ]; then
  echo "error: no .mise.toml at repo root"
  exit 1
fi

# `mise trust` is idempotent and required before `install` will read
# a project-local .mise.toml. Silent on repeat runs.
mise trust "$REPO_ROOT/.mise.toml" >/dev/null

echo "↓ mise install (reading $REPO_ROOT/.mise.toml)..."
if [ "${GITHUB_ACTIONS:-}" = "true" ] &&
   [ -n "${GITHUB_TOKEN:-}" ] &&
   [ -z "${MISE_GITHUB_TOKEN:-}" ] &&
   [ -z "${GITHUB_API_TOKEN:-}" ]; then
  # GitHub Actions' default GITHUB_TOKEN is scoped to this repository.
  # mise/aqua may reuse it for release metadata in other repositories
  # (uv, shellcheck, actionlint), where GitHub returns 404. Prefer a
  # dedicated mise token if supplied; otherwise fall back to anonymous
  # public release lookups rather than poisoning them with the repo token.
  (cd "$REPO_ROOT" && env -u GITHUB_TOKEN mise install)
else
  (cd "$REPO_ROOT" && mise install)
fi
echo "✓ mise runtimes installed"

# Put mise shims on PATH for the remainder of this install.sh run
# so downstream scripts (e.g. anything needing python) see the
# mise-managed binaries. `shellenv.sh` (final step) propagates the
# same to subsequent shells and to CI's $GITHUB_PATH.
for shim_dir in \
    "$HOME/.local/share/mise/shims" \
    "/opt/homebrew/opt/mise/shims" \
    "/opt/homebrew/share/mise/shims"; do
  if [ -d "$shim_dir" ]; then
    export PATH="$shim_dir:$PATH"
    echo "✓ mise shims on PATH: $shim_dir"
    break
  fi
done

# Print the resolved versions so the log is useful on a first run.
(cd "$REPO_ROOT" && mise current)
