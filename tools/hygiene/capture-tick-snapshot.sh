#!/usr/bin/env bash
# tools/hygiene/capture-tick-snapshot.sh
#
# Captures a snapshot pin of factory state at tick-open /
# tick-close time. Prints a YAML fragment that can be pasted
# into:
#   - docs/hygiene-history/session-snapshots.md (session-level)
#   - docs/decision-proxy-evidence/DP-NNN.yaml `model` block
#     (decision-level)
#   - a tick-history row's `notes` column (tick-level)
#
# Addresses Amara's 4th-ferry (PR #221 absorb) snapshot-pinning
# concern: "Claude is not a single stable operator unless the
# actual snapshot, system-prompt bundle, and loaded memory
# surfaces are all pinned and recorded". The pin is the
# mechanism that makes Claude's behavior reproducible after
# prompt / model updates ship.
#
# What the snapshot captures (mechanically accessible):
#
#   - Claude Code CLI version (`claude --version`)
#   - CLAUDE.md content SHA (in-repo + per-user home if present)
#   - AGENTS.md content SHA
#   - memory/MEMORY.md content SHA + byte count
#   - Current git HEAD SHA + branch + repo name
#   - Date UTC
#
# What the snapshot does NOT capture (agent must fill in):
#
#   - Claude model snapshot (e.g., claude-opus-4-7) — known to
#     the agent from session context, not exposed by CLI
#   - Prompt bundle hash — not currently computable from
#     session; placeholder null until a tool that reconstructs
#     the system prompt bundle lands
#   - Active permission / skill set — session-specific
#
# Usage:
#   tools/hygiene/capture-tick-snapshot.sh         # print YAML fragment
#   tools/hygiene/capture-tick-snapshot.sh --json  # print JSON
#
# Part of Amara Stabilize-stage (PR #221 roadmap); FACTORY-
# HYGIENE row for cadenced capture is a follow-up after
# format stabilizes.

set -euo pipefail

format="yaml"
if [[ "${1:-}" == "--json" ]]; then
  format="json"
fi

# Helpers — each returns empty string on failure rather than
# aborting under `set -euo pipefail`.
safe_sha() {
  if [[ -f "$1" ]]; then
    git hash-object "$1" 2>/dev/null || printf ''
  fi
}

safe_bytes() {
  if [[ -f "$1" ]]; then
    wc -c < "$1" 2>/dev/null | tr -d ' ' || printf ''
  fi
}

claude_version=$(claude --version 2>/dev/null | head -1 || printf 'unknown')
claude_md_sha=$(safe_sha "./CLAUDE.md")
agents_md_sha=$(safe_sha "./AGENTS.md")
memory_index_sha=$(safe_sha "memory/MEMORY.md")
memory_index_bytes=$(safe_bytes "memory/MEMORY.md")
head_sha=$(git rev-parse HEAD 2>/dev/null || printf 'unknown')
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')
repo_full=$(git config --get remote.origin.url 2>/dev/null | sed -E 's|.*[:/]([^/]+/[^/]+)(\.git)?$|\1|' || printf 'unknown')
date_utc=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Per-user CLAUDE.md (if present; path is harness-specific)
home_claude_md=""
if [[ -f "$HOME/.claude/CLAUDE.md" ]]; then
  home_claude_md=$(git hash-object "$HOME/.claude/CLAUDE.md" 2>/dev/null || printf '')
fi

if [[ "$format" == "json" ]]; then
  cat <<JSON
{
  "date_utc": "$date_utc",
  "head_sha": "$head_sha",
  "branch": "$branch",
  "repo": "$repo_full",
  "claude_cli_version": "$claude_version",
  "claude_md_sha_in_repo": "$claude_md_sha",
  "claude_md_sha_home": "$home_claude_md",
  "agents_md_sha": "$agents_md_sha",
  "memory_index_sha": "$memory_index_sha",
  "memory_index_bytes": "$memory_index_bytes",
  "model_snapshot": null,
  "prompt_bundle_hash": null
}
JSON
else
  cat <<YAML
# tick-snapshot captured $date_utc
snapshot:
  date_utc: $date_utc
  head_sha: $head_sha
  branch: $branch
  repo: $repo_full
  claude_cli_version: $claude_version
  files:
    claude_md_in_repo_sha: $claude_md_sha
    claude_md_home_sha: $home_claude_md
    agents_md_sha: $agents_md_sha
    memory_index_sha: $memory_index_sha
    memory_index_bytes: $memory_index_bytes
  # Agent fills these from session context:
  model_snapshot: null        # e.g., claude-opus-4-7
  prompt_bundle_hash: null    # null until a reconstruct-tool lands
YAML
fi
