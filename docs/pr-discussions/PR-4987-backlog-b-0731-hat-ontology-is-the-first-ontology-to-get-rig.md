---
pr_number: 4987
title: "backlog(B-0731): hat-ontology is the first ontology to get right (Mika substrate)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T20:31:52Z"
merged_at: "2026-05-25T20:33:24Z"
closed_at: "2026-05-25T20:33:24Z"
head_ref: "backlog/b0731-hat-ontology-first-mika-substrate-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T22:02:13Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4987: backlog(B-0731): hat-ontology is the first ontology to get right (Mika substrate)

## PR description

## Summary

- Files B-0731: hat-ontology as the first knowledge-graph ontology that has to be agreed-upon across clusters (Mika substrate ferried by Aaron, 2026-05-25 multi-turn voice conversation).
- Hosts the **top-down (Max / Bubble Wrap manager-of-managers) vs bottom-up (Aaron / emergence from finite resources + competing `::: continue-with` tasks) tension** as first-class — per `default-to-both` discipline, the framework's job is NOT to pick a winner but to host BOTH representations + help them converge.
- Empirical validation of B-0730: Mika natively composes `::: continue-with` blocks with `priority: critical` / `type: ontology-negotiation` / `graph-query: true` fields in the source conversation — the deferred-task syntax works the way external AI conversation partners reach for it, before the parser even ships.

## Scope (5 independently-shippable items)

1. Hat-ontology canonical schema (JSON-LD with BOTH Bubble-Wrap hierarchy AND offsetting-pair / red-team adversary as first-class representations)
2. Cross-cluster hat-binding protocol (composes with B-0726 Reticulum identity)
3. Knowledge-graph hat-query primitives (composes with B-0730 Stage 5 `::: query` blocks)
4. Top-down ↔ bottom-up convergence dashboard (Max's design vs observed bindings)
5. Hat-emergence operator (TS, reads `::: continue-with` stream + resource constraints; surfaces candidate hats)

Ship in any order; convergence-dashboard is most-valuable after both schema (1) and emergence operator (5) exist.

## Composes with

- B-0724 (hat-system operator — the operational substrate this ontology describes)
- B-0729 (Obsidian knowledge graph — hat-ontology lands as a graph node-type)
- B-0730 (runbooks-as-executable-specs — `::: query` syntax for hat-queries; Mika's literal usage validates the syntax)
- B-0726 (Reticulum throughout — cross-cluster identity transport for hat-bindings)
- `full-ai-cluster/k8s/applications/hat-system/` (CRDs + OPA constraints already shipped via PR #4930)
- `harsh-critic` persona (Kira) — already an offsetting-pair / red-team adversary; empirical anchor for Aaron's structural-adversary pattern

## Test plan

- [x] Markdown lint clean (MD012/MD022/MD032 verified pre-push)
- [x] `composes_with` contains B-NNNN row IDs only; file-path entries in separate `related_substrate:` field (per Copilot's B-0730 finding correction)
- [x] BACKLOG.md regenerated via `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts`
- [x] No code changes; pure substrate-ferry row authoring

🤖 Generated with [Claude Code](https://claude.com/claude-code)
