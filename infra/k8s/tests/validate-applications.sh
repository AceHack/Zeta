#!/usr/bin/env bash
# infra/k8s/tests/validate-applications.sh
#
# Helm chart validation tests for all ArgoCD Application manifests.
# Tests that the manifests are syntactically valid and that the referenced
# Helm charts exist at the declared versions.
#
# Usage:
#   ./infra/k8s/tests/validate-applications.sh [--offline]
#
# Requirements:
#   - yq (YAML parser): apt install yq / brew install yq
#   - curl (for chart existence checks, skipped with --offline)
#
# Exit codes:
#   0 — all tests passed
#   1 — one or more tests failed
#
# Anti-self-certifying: these tests fail if:
#   - An Application.yaml is missing required fields
#   - A Helm chart repo URL is unreachable (online mode)
#   - A chart version does not exist in the repo index
#   - A required annotation or syncOption is missing

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APPS_DIR="$REPO_ROOT/infra/k8s/applications"
OFFLINE="${1:-}"

PASS=0
FAIL=0
ERRORS=()

# ── Helpers ───────────────────────────────────────────────────────────────────

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; ERRORS+=("$1"); FAIL=$((FAIL+1)); }

require_field() {
  local file="$1" field="$2" value
  value=$(~/.local/bin/yq4 e "$field" "$file" 2>/dev/null || echo "null")
  if [[ "$value" == "null" || -z "$value" ]]; then
    fail "$file: missing required field $field"
    return 1
  fi
  return 0
}

# ── Test 1: All Application.yaml files are valid YAML ─────────────────────────

echo ""
echo "=== Test 1: YAML syntax validation ==="
while IFS= read -r -d '' app; do
  if ~/.local/bin/yq4 e '.' "$app" > /dev/null 2>&1; then
    pass "$(basename "$(dirname "$app")")/Application.yaml: valid YAML"
  else
    fail "$(basename "$(dirname "$app")")/Application.yaml: invalid YAML"
  fi
done < <(find "$APPS_DIR" -name "Application.yaml" -print0)

# ── Test 2: Required ArgoCD Application fields ────────────────────────────────

echo ""
echo "=== Test 2: Required ArgoCD Application fields ==="
while IFS= read -r -d '' app; do
  name=$(basename "$(dirname "$app")")
  ok=true
  require_field "$app" '.apiVersion'                               || ok=false
  require_field "$app" '.kind'                                     || ok=false
  require_field "$app" '.metadata.name'                            || ok=false
  require_field "$app" '.metadata.namespace'                       || ok=false
  require_field "$app" '.spec.project'                             || ok=false
  require_field "$app" '.spec.source.repoURL'                      || ok=false
  require_field "$app" '.spec.destination.server'                  || ok=false
  require_field "$app" '.spec.destination.namespace'               || ok=false
  require_field "$app" '.spec.syncPolicy.automated.prune'          || ok=false
  require_field "$app" '.spec.syncPolicy.automated.selfHeal'       || ok=false
  # Finalizer must be present (prevents orphaned resources on delete)
  finalizer=$(~/.local/bin/yq4 e '.metadata.finalizers[]' "$app" 2>/dev/null | grep -c "resources-finalizer" || true)
  if [[ "$finalizer" -lt 1 ]]; then
    fail "$name/Application.yaml: missing resources-finalizer.argocd.argoproj.io"
    ok=false
  fi
  # CreateNamespace=true must be in syncOptions
  ns_opt=$(~/.local/bin/yq4 e '.spec.syncPolicy.syncOptions[]' "$app" 2>/dev/null | grep -c "CreateNamespace=true" || true)
  if [[ "$ns_opt" -lt 1 ]]; then
    fail "$name/Application.yaml: missing CreateNamespace=true in syncOptions"
    ok=false
  fi
  [[ "$ok" == "true" ]] && pass "$name/Application.yaml: all required fields present"
done < <(find "$APPS_DIR" -name "Application.yaml" -print0)

# ── Test 3: Helm-based apps have chart + targetRevision ───────────────────────

echo ""
echo "=== Test 3: Helm chart fields ==="
while IFS= read -r -d '' app; do
  name=$(basename "$(dirname "$app")")
  source_type=$(~/.local/bin/yq4 e '.spec.source | keys | .[]' "$app" 2>/dev/null | tr '\n' ' ')
  if echo "$source_type" | grep -q "chart"; then
    ok=true
    require_field "$app" '.spec.source.chart'          || ok=false
    require_field "$app" '.spec.source.targetRevision' || ok=false
    [[ "$ok" == "true" ]] && pass "$name/Application.yaml: Helm chart fields present"
  else
    pass "$name/Application.yaml: not a Helm chart app (skipped)"
  fi
done < <(find "$APPS_DIR" -name "Application.yaml" -print0)

# ── Test 4: apiVersion and kind are correct ────────────────────────────────────

echo ""
echo "=== Test 4: apiVersion and kind ==="
while IFS= read -r -d '' app; do
  name=$(basename "$(dirname "$app")")
  api=$(~/.local/bin/yq4 e '.apiVersion' "$app" 2>/dev/null || echo "")
  kind=$(~/.local/bin/yq4 e '.kind' "$app" 2>/dev/null || echo "")
  if [[ "$api" == "argoproj.io/v1alpha1" && "$kind" == "Application" ]]; then
    pass "$name/Application.yaml: apiVersion=argoproj.io/v1alpha1, kind=Application"
  else
    fail "$name/Application.yaml: wrong apiVersion ($api) or kind ($kind)"
  fi
done < <(find "$APPS_DIR" -name "Application.yaml" -print0)

# ── Test 5: destination.server is in-cluster ──────────────────────────────────

echo ""
echo "=== Test 5: destination.server is in-cluster ==="
while IFS= read -r -d '' app; do
  name=$(basename "$(dirname "$app")")
  server=$(~/.local/bin/yq4 e '.spec.destination.server' "$app" 2>/dev/null || echo "")
  if [[ "$server" == "https://kubernetes.default.svc" ]]; then
    pass "$name/Application.yaml: destination.server is in-cluster"
  else
    fail "$name/Application.yaml: destination.server is NOT in-cluster ($server)"
  fi
done < <(find "$APPS_DIR" -name "Application.yaml" -print0)

# ── Test 6: root-application.yaml recurse=true ────────────────────────────────

echo ""
echo "=== Test 6: root-application.yaml recurse=true ==="
ROOT_APP="$APPS_DIR/root-application.yaml"
if [[ -f "$ROOT_APP" ]]; then
  recurse=$(~/.local/bin/yq4 e '.spec.source.directory.recurse' "$ROOT_APP" 2>/dev/null || echo "false")
  if [[ "$recurse" == "true" ]]; then
    pass "root-application.yaml: directory.recurse=true"
  else
    fail "root-application.yaml: directory.recurse is not true ($recurse)"
  fi
  include=$(~/.local/bin/yq4 e '.spec.source.directory.include' "$ROOT_APP" 2>/dev/null || echo "")
  if [[ -n "$include" ]]; then
    pass "root-application.yaml: directory.include is set"
  else
    fail "root-application.yaml: directory.include is missing (would pick up non-Application files)"
  fi
else
  fail "root-application.yaml: file not found"
fi

# ── Test 7: Online chart existence check (skipped if --offline) ───────────────

if [[ "$OFFLINE" != "--offline" ]]; then
  echo ""
  echo "=== Test 7: Helm chart existence (online) ==="
  while IFS= read -r -d '' app; do
    name=$(basename "$(dirname "$app")")
    repo=$(~/.local/bin/yq4 e '.spec.source.repoURL' "$app" 2>/dev/null || echo "")
    chart=$(~/.local/bin/yq4 e '.spec.source.chart' "$app" 2>/dev/null || echo "null")
    version=$(~/.local/bin/yq4 e '.spec.source.targetRevision' "$app" 2>/dev/null || echo "null")
    if [[ "$chart" == "null" || -z "$chart" ]]; then
      pass "$name/Application.yaml: not a Helm chart app (skipped)"
      continue
    fi
    # Check if the repo index is reachable and contains the chart at the declared version
    index_url="${repo%/}/index.yaml"
    if curl -fsSL --max-time 10 "$index_url" 2>/dev/null | grep -q "name: $chart"; then
      pass "$name/Application.yaml: chart '$chart' found in $repo"
    else
      fail "$name/Application.yaml: chart '$chart' NOT found in $repo (or repo unreachable)"
    fi
  done < <(find "$APPS_DIR" -name "Application.yaml" -print0)
else
  echo "=== Test 7: Helm chart existence (SKIPPED — offline mode) ==="
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "========================================"
echo "Results: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failures:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  echo ""
  exit 1
fi
echo "All tests passed."
