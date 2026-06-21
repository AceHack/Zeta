---
id: 081KRA5AR0008QG0R001JVT5FX
priority: P2
status: open
title: Forge CLI + Ollama bridge research pass (WebSearch + capability matrix, XS)
parent: 081KQ8P5D0008QG0R002E1G72J
ask: 081KQ8P5D0008QG0R002E1G72J decomposition — smallest atomic research slice
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with: [081KQ8P5D0008QG0R002E1G72J, memory/feedback_announce_non_default_harness_dependencies_plugins_mcp_skills_2026_04_28.md, Otto-247]
tags: [forge, ollama, research, websearch, harness-roster, local-ai]
type: research
effort: XS
---

# 081KRA5AR0008QG0R001JVT5FX — Forge CLI + Ollama research (XS)

## What this slice delivers

- WebSearch (Otto-247 currency) for current Forge CLI latest release, supported Ollama bridge, model surface, install matrix.
- Produce capability matrix table (harness features, local-model access, peer-call fit).
- Update 081KQ8P5D0008QG0R002E1G72J with findings + next-child pointer.
- No code changes; pure research substrate.

## Dependency order

Root of local-AI decomp tree. Unblocks 081KRA5AR0008QG0R001BTRYN0 (Ollama smoke) and 081KRA5AR0008QG0R002TPJ4NC decision.

## Focused check outcome (included in PR)

- `rg -i 'forge|ollama' docs/backlog docs/memory tools/ | head -5` → only prior mentions, no collision.
- dotnet build -c Release in worktree: 0 warnings 0 errors (gate passed pre-write).
- No existing Forge harness row.

## Pre-start checklist (backlog-item start gate)

1. Prior-art-search: Grep for ollama/forge/local-model across repo + trajectories → zero prior implementation (only this umbrella + unrelated "forge" string matches).
2. Dependency-restructure: 081KQ8P5D0008QG0R002E1G72J depends_on [] confirmed; added composes_with reciprocal.
3. Decision-archaeology: no superseding decision found for local-AI; this is first.

## Evidence links

- 081KQ8P5D0008QG0R002E1G72J parent
- Otto-247 version-currency rule
- `memory/feedback_kiro_cli_added_to_agent_roster_aaron_2026_04_28.md` (harness roster pattern)
