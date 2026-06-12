---
id: B-0068.4
zetaid: 081KR7JY10008QG0R0025F6QVP
priority: P2
status: open
title: Forge CLI + Ollama harness integration research slice (B-0068 child 1, parallel scope)
effort: S
ask: decompose from B-0068 umbrella
created: 2026-05-10
last_updated: 2026-05-13
renumbered_from: B-0068.1
renumbered_reason: "ID collision with Riven's B-0068.1 (PR #2650, filed 2026-05-11; scope 'WebSearch + capability matrix XS'). Riven's row keeps the original ID because the B-0068 parent body description + sibling rows B-0068.2 and B-0068.3 all reference Riven's specific scope. This row had no external references → safe to renumber to next-free slot B-0068.4. Substrate-cleanup tracked in B-0451."
depends_on: []
tags: [local-ai, forge, ollama, research, renumbered]
type: research
---

# B-0068.4 — Forge CLI + Ollama research slice (renumbered from B-0068.1)

## Why (atomic child of B-0068)

B-0068 is the umbrella for local AI trajectory. This is the smallest atomic first child: pure research on Forge CLI current version, supported models, and Ollama native bridge. No implementation, no install, no code. Per Otto-247 version-currency and search-first authority, every model/harness claim starts with fresh WebSearch.

This slice unblocks B-0068.2 (hardware/model selection) and B-0068.3 (smoke test) by providing the capability matrix.

## What (bounded scope)

- WebSearch "Forge CLI latest release 2026" + "Forge CLI Ollama integration"
- Capture: current version, supported local model surface, Ollama bridge docs, hardware requirements
- Land findings as research-grade doc under docs/research/ with archive header (GOVERNANCE §33)
- No code, no scripts, no install, no PR beyond this research landing
- Explicit non-scope: no model install, no direct integration, no harness wiring

## Focused check outcome (included per task rule)

- Root checkout build gate (dotnet build -c Release): transient MSB4166 child-node exit (known MSBuild parallel flake, 0 code warnings/errors before cancel; 4 termination warnings only)
- Worktree focused: dotnet build src/Core -c Release (assets missing as expected for fresh worktree; no code changes yet)
- No pre-existing Forge or Ollama references in docs/backlog/P2/ or tools/ (verified via rg before write)
- Decomposition re-applied: B-0068 umbrella assumed too broad → first child is research-only to keep velocity without committing to stack

## Evidence links

- Parent: docs/backlog/P2/B-0068-local-ai-trajectory-forge-ollama-direct-integration-aaron-2026-04-28.md
- Otto-247 version-currency rule
- .claude/rules/search-first-authority.md

## Out of scope

- Any implementation or install
- Model selection (next child)
- Direct integration paths (path 3 of umbrella)
