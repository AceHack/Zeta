# GitHub Pages Public Source Inventory

This document defines the public source inventory for the Zeta GitHub Pages site, as specified in backlog item [081KR2E4K0008QG0R0035QVX6S](../backlog/P1/081KR2E4K0008QG0R0035QVX6S-pages-public-source-inventory-exclusion-boundary-2026-05-08.md). It serves as the canonical list of what content is part of the public-facing site and what is considered internal substrate.

## Public Source Inventory

These files are the designated sources for the public GitHub Pages site. They have been selected to provide a clear and concise entry point for new contributors, researchers, and potential users.

| Source File | Public Purpose |
|---|---|
| `README.md` | **Landing Page:** The primary entry point for all visitors. Provides a high-level overview of the project. |
| `docs/VISION.md` | **Vision & "About" Page:** Explains the long-term goals and motivations of the project. |
| `docs/ALIGNMENT.md` | **Alignment Principles:** Details the core principles of human-agent collaboration and safety that govern the factory. |
| `docs/GLOSSARY.md` | **Glossary / Reference:** Defines the key terminology and concepts used within the Zeta ecosystem. |
| `CONTRIBUTING.md` | **Contributor On-ramp:** Provides clear instructions for new contributors on how to get involved, from reporting bugs to submitting code. |

### Selected Research Sources

These research documents are designated public sources because they explain the factory's methodology to outsiders and are already referenced from the public `docs/VISION.md` page (public-eligible by transitivity). The selection is intentionally conservative; later route work (081KR2E4K0008QG0R000WYVJAF) may extend it.

| Source File | Public Purpose |
|---|---|
| `docs/research/crystallization-loop.md` | **Methodology — Feedback Loop:** Explains the vision→research→crystallize→backlog convergent loop that drives the factory. |
| `docs/research/crystallization-ledger.md` | **Methodology — Ledger:** The append-only record of crystallization turns; shows the loop operating in practice. |

## Exclusion Boundary

The following directories and file patterns are explicitly excluded from the public site. They contain internal, operational, or private data that is not intended for public consumption.

| Excluded Path / Pattern | Reason for Exclusion |
|---|---|
| `memory/` | Contains private, persona-specific agent memories and operational notes. Not suitable for public view. |
| `docs/backlog/` | Internal project management and task tracking. Volatile and not relevant to external observers. |
| `docs/hygiene-history/` | Internal logs from automated tooling and hygiene checks. Purely operational data. |
| `docs/claims/` | Internal state for the agent work-claiming system. |
| **Operational loop state** — `docs/trajectories/`, `docs/CURRENT-ROUND.md`, `docs/AUTONOMOUS-LOOP-PER-TICK.md`, `docs/loop-tick-history.md` | The autonomous-loop's current round, trajectory handoff (`RESUME.md`), per-tick cadence, and tick history. Volatile operational handoff surfaces; not public content. |
| `drop/` | Temporary file storage. |
| `.claude/`, `.gemini/`, etc. | Agent-specific configuration and operational directories. |
| any file with `status: private` | A generic rule to exclude any file explicitly marked as private in its frontmatter. |
