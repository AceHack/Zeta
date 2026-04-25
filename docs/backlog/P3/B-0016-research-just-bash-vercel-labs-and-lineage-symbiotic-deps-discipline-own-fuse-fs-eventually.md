---
id: B-0016
priority: P3
status: open
title: Research just-bash (Vercel Labs) + lineage (bash-tool / wterm / ArchilFs / ChromaFs / gbash / bashkit / Utah) for FS-substrate algorithms + concepts; own FUSE FS eventually per Otto-323 symbiotic-deps discipline
tier: research
effort: M
directive: Aaron 2026-04-25 ("just backlog this")
created: 2026-04-25
last_updated: 2026-04-25
composes_with: [feedback_otto_323_aaron_symbiotic_deps_pull_algorithms_and_concepts_deep_integration_zeta_multi_modal_views_dsls_composable_own_fuse_fs_eventually_2026_04_25.md, feedback_otto_301_no_software_dependencies_hardware_bootstrap_no_os_we_are_microkernel_super_long_term_decision_resolution_anchor_2026_04_25.md]
tags: [research, filesystem, fuse, sandboxing, just-bash, agent-execution, fs-substrate]
---

# Research just-bash + lineage; own FUSE FS eventually

## What is just-bash

just-bash (Vercel Labs, TypeScript, 2026) is a sandboxed Bash environment with an in-memory virtual filesystem, designed for AI agents that need safe shell-execution. NOT a new shell — an execution-substrate layer between agent and host-system.

NOT an industry-interface like SQL. It's a sandbox-execution-environment (similar architectural role to V8 isolates for JS, FreeBSD jails for Unix, busybox-in-container for shell-ops).

## Lineage / siblings to study

| Project | Language | What it adds |
|---------|----------|--------------|
| just-bash | TypeScript | Core sandbox + in-memory VFS |
| bash-tool | TypeScript | FS-context retrieval, Vercel AI SDK bridge |
| wterm/just-bash | Zig | In-browser Bash via just-bash engine |
| ArchilFs | TS+S3 | S3-as-POSIX mount through just-bash |
| ChromaFs | TS+vector | Vector-DB-as-FS (FS calls → Chroma queries) |
| gbash | Go | Deterministic JSON-RPC sandbox, mvdan/sh delegation |
| bashkit | TS | Virtual Bash interpreter, recursive descent, 75+ commands |
| Utah | .shx → Bash | TypeScript-like syntax transpiling to clean Bash |

## What we absorb (per Otto-323 symbiotic-deps discipline)

NOT API imports. ALGORITHMS + CONCEPTS:

1. **just-bash**: in-memory virtual FS pattern + sandboxed-execution shape + OverlayFS copy-on-write protective cradle.
2. **ArchilFs**: cloud-storage-as-FS protocol-translation pattern (composes with Otto-317/318 multi-tier deployment).
3. **ChromaFs**: vector-DB-via-FS-interface pattern (could compose with Zeta's vector-DB views in the multi-algebra DB direction).
4. **gbash**: deterministic-sandbox + JSON-RPC discipline + parser-delegation pattern.
5. **bashkit**: defense-in-depth sandbox + parser-redesign discipline.
6. **Utah**: TypeScript-like surface + Bash-codegen pattern (composes with Zeta DSL ecosystem).

## Long-term direction: own FUSE FS

Per Otto-301 (no-software-deps + hardware-bootstrap + microkernel + symbiosis) + Otto-323 (own FUSE FS eventually), the factory's filesystem layer is eventually OURS. Each dep we research is brute-force-research-substrate (Otto-311); our own FUSE FS is the elegant-store.

The own-FUSE-FS integrates the absorbed algorithms + concepts into Zeta's multi-modal view layer + DSL ecosystem (per Otto-302 5GL-to-6GL + Otto-323 deep-integration discipline).

## Why P3

- Long-horizon research; not blocking current operational work.
- Queue-drain (#274) + acehack-first (#275) + factory-demo (#244) all higher-priority.
- Research-grade investigation; informs architectural decisions for FS substrate but doesn't ship anything yet.
- Own-FUSE-FS direction sequences AFTER multi-algebra DB substrate (per `project_zeta_multi_algebra_database_one_algebra_to_rule_them_all_sequenced_after_frontier_and_demo_2026_04_23.md`).

## Done when

- Each project in the lineage has a research-summary capture (algorithms + concepts + integration-fit-with-Zeta-multi-modal-views).
- A factory-FS-architecture-sketch document exists at `docs/research/factory-fs-architecture.md` synthesizing the absorbed insights.
- Otto-323 symbiotic-deps discipline has been concretely applied at least once via this row's investigation (validates the discipline by example).
- Own-FUSE-FS roadmap row exists in BACKLOG (likely B-NNNN P2 or P3 when sequencing is clearer).

## Composes with

- Otto-323 (this row's parent substrate discipline).
- Otto-301 (hardware-bootstrap ultimate-destination).
- Otto-302 (5GL-to-6GL bridge — own-FUSE-FS is at 5GL/6GL boundary).
- Otto-311 (compression-substrate — dep-research is brute-force-store, own-FUSE-FS is elegant-store).
- `project_zeta_multi_algebra_database_one_algebra_to_rule_them_all_sequenced_after_frontier_and_demo_2026_04_23.md` (sequencing).
