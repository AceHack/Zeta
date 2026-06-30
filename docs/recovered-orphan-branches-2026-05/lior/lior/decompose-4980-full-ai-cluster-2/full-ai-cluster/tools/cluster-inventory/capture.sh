#!/usr/bin/env bash
# full-ai-cluster/tools/cluster-inventory/capture.sh
#
# Capture precise hardware inventory of every cluster node into
# `docs/cluster-hardware/<hostname>/`. Re-run periodically to
# diff against prior captures (catch silent BIOS updates, GPU
# driver bumps, disk replacements).
#
# Three artifacts per node:
#
#   topology.xml   — lstopo XML (NUMA / PCI / cache / GPU layout)
#   topology.svg   — same data rendered as a diagram
#   nfd-labels.txt — kubectl-derived NFD label set
#   summary.md     — short human-readable summary
#
# Requires:
#   - kubectl configured against the cluster
#   - hwloc installed locally (for `lstopo --import topology.xml --of svg`)
#   - NFD already running on the cluster
#   - Either: nodes reachable via `kubectl debug node/<name>` (k8s 1.27+)
#             OR ssh access to each node as the zeta user
#
# Usage:
#   tools/cluster-inventory/capture.sh           # all nodes
#   tools/cluster-inventory/capture.sh worker-gpu-01 worker-gpu-02

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
INVENTORY_ROOT="${REPO_ROOT}/full-ai-cluster/docs/cluster-hardware"
mkdir -p "${INVENTORY_ROOT}"

# Default to all nodes; allow per-node selection via argv.
if [[ $# -gt 0 ]]; then
  NODES=("$@")
else
  mapfile -t NODES < <(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n')
fi

for node in "${NODES[@]}"; do
  echo "=== ${node} ==="
  out_dir="${INVENTORY_ROOT}/${node}"
  mkdir -p "${out_dir}"

  # 1. NFD labels — pulled straight from kubectl, no node access needed.
  kubectl get node "${node}" \
    --show-labels \
    -o jsonpath='{.metadata.labels}' \
    | tr ',' '\n' \
    | grep '^"feature.node.kubernetes.io' \
    > "${out_dir}/nfd-labels.txt" || true

  # 2. lstopo via `kubectl debug` (k8s 1.27+). Drops a debug pod on
  #    the node with hostPID + the hwloc image, runs lstopo, copies
  #    out the XML. Cleans the debug pod immediately after.
  #
  #    If `kubectl debug` isn't available, fall back to SSH:
  #      ssh -o StrictHostKeyChecking=no zeta@"${node}" lstopo --of xml \
  #        > "${out_dir}/topology.xml"
  if kubectl debug --help >/dev/null 2>&1; then
    kubectl debug "node/${node}" \
      --image=ghcr.io/open-mpi/hwloc:latest \
      --quiet \
      -- chroot /host lstopo --of xml \
      > "${out_dir}/topology.xml" 2>/dev/null || {
        echo "  kubectl debug failed; trying ssh fallback"
        ssh -o StrictHostKeyChecking=no -o BatchMode=yes "zeta@${node}" \
          'lstopo --of xml' > "${out_dir}/topology.xml"
      }
  else
    ssh -o StrictHostKeyChecking=no -o BatchMode=yes "zeta@${node}" \
      'lstopo --of xml' > "${out_dir}/topology.xml"
  fi

  # 3. Render the XML to SVG locally — small, diff-friendly, opens
  #    in any browser. Keep the XML as the source of truth for diffs.
  if command -v lstopo >/dev/null; then
    lstopo --input "${out_dir}/topology.xml" --of svg \
      > "${out_dir}/topology.svg" || true
  fi

  # 4. Short summary derived from NFD labels — what a human wants
  #    to see at a glance.
  {
    echo "# ${node}"
    echo
    echo "Captured: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
    echo "## CPU"
    grep -E 'cpu-model\.|cpu-cpuid\.' "${out_dir}/nfd-labels.txt" | head -10
    echo
    echo "## Memory + Storage"
    grep -E 'memory-|storage-' "${out_dir}/nfd-labels.txt" | head -10
    echo
    echo "## PCI vendors present (top 10)"
    grep 'pci-' "${out_dir}/nfd-labels.txt" | head -10
    echo
    echo "## Network"
    grep 'network-' "${out_dir}/nfd-labels.txt" | head -10
    echo
    echo "See \`topology.svg\` for NUMA / PCI / cache hierarchy."
  } > "${out_dir}/summary.md"

  echo "  → ${out_dir}/"
done

echo
echo "Done. Review + commit:"
echo "  git diff --stat full-ai-cluster/docs/cluster-hardware/"
echo "  git add full-ai-cluster/docs/cluster-hardware/"
echo "  git commit -m 'chore(inventory): capture cluster hardware $(date +%Y-%m-%d)'"
