# Axis-3 Code/English classification matrix — per-repo two-tier classification

**Date:** 2026-05-14
**Author:** Otto
**Related row:** B-0477

## Purpose
Produce the per-repo Axis-3 classification matrix across all existing and proposed repositories, distinguishing Code from English substrate while preserving the engineering-docs exception. Provide split recommendations based on Data Vault 2.0 change-rate discipline.

## Axis-3 Tier Definitions

### Code Tier
Content whose primary purpose is executable, compilable, or directly testable.
- Source code (F#, C#, TypeScript, Python)
- Build scripts, CI YAML files, configuration files
- Tests and test fixtures
- Peer-call wrappers, validators

**Engineering-Docs Exception:** The following English-language documents are permanently bound to the Code tier because their versioning is strictly tied to the executable artifacts they describe:
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- ADRs (`docs/DECISIONS/`) and architecture diagrams
- API documentation, `GLOSSARY.md` (code-specific terms)
- Build/run/test instructions, CI config documentation
- Security policies, `CODE_OF_CONDUCT.md`

### English Tier
Content whose primary purpose is discursive, philosophical, or substrate-narrative.
- Research documents (`docs/research/**`)
- Philosophy and narrative substrate
- Memory files (`memory/**`)
- Persona notebooks (`memory/persona/**`)
- Conversation archives and trajectory documents

## Per-Repo Classification Matrix

| Repo | Axis-1 (Domain) | Axis-3 Primary | Axis-3 English Content | Split Recommendation |
|------|-----------------|----------------|------------------------|----------------------|
| **LFG/Zeta** | Factory | Mixed | `docs/research/`, `memory/` | **Candidate for English split.** Currently hosts all shared memory and research docs. |
| **AceHack/Zeta** | Factory | Mixed | `docs/research/`, `memory/` | Same as upstream LFG/Zeta. |
| **LFG/civsim** | Product | Code | Minimal | **Stay co-located.** Honor-system code repo. |
| **Forge** (Proposed) | Factory | Mixed | `memory/persona/`, `docs/research/` (Factory scope) | **Candidate for English split.** Factory scripts vs high-churn memory files. |
| **ace** (Proposed) | Factory | Code | Minimal | **Stay co-located.** Will distribute packages. |
| **lf-ksk** (Proposed) | Product | Code | Minimal | **Stay co-located.** |
| **aurora-network** (Proposed) | Product | Mixed / English | Alignment thesis docs | **TBD (Ambiguous).** Depends if consensus mechanism is primarily code or a document archive. |
| **american-dream** (Proposed) | Product | Code | Minimal | **Stay co-located.** |
| **lf-dio** (Proposed) | Product | Code | Minimal | **Stay co-located.** |
| **Dawn** (Proposed) | Product | English | Child-AI charter docs | **Candidate for English-only.** Mostly charter docs. |

## DV2.0 Change-Rate Analysis & Recommendations

According to the DV2.0 discipline, substrate should be partitioned by change rate (Hubs vs Satellites).

1. **LFG/Zeta & Forge (Factory)**
   - **Code/Hubs (Moderate change rate):** Core F# database engine, TypeScript build scripts, and `.claude/skills/`. They evolve deliberately and require strict CI compilation.
   - **English/Satellites (Extremely fast change rate):** `memory/` files, `memory/persona/` notebooks, and conversational absorbs update *multiple times per session*.
   - **DV2.0 Rationale:** The English tier updates constantly as agents work, but only requires `markdownlint`. The Code tier updates less frequently but requires heavy `macos`/`ubuntu` test matrices.
   - **Recommendation:** **Split.** Move the fast-changing `memory/` and `docs/research/` to a dedicated `LFG/Zeta-Memory` or `LFG/Zeta-Research` repository. The exact boundary between what moves vs what stays as engineering docs is unambiguous per the exception rule.

2. **Aurora-Network & Dawn**
   - **Analysis:** These are primarily alignment, consensus, and charter artifacts. Their "code" footprint is minimal initially.
   - **Recommendation:** **Flagged as Ambiguous.** Should they be strictly English-tier repos, or will they eventually contain smart contracts / operational code? Needs ADR resolution (B-0479).

3. **Standard Product Repos (`civsim`, `ksk`, etc.)**
   - **Analysis:** Feature standard game/product code. Any docs within them are almost exclusively engineering docs (ADRs, READMEs).
   - **Recommendation:** **Co-locate.** No significant DV2.0 change-rate divergence exists that justifies separating product code from product documentation.

## Ambiguous Cases for B-0479 (ADR)
- **Shared Memory Destination:** If `memory/` and `docs/research/` split out of `Zeta` and `Forge`, do they merge into a single `Zeta-Memory` unified repo, or does `Forge` get `Forge-Memory` and `Zeta` get `Zeta-Memory`?
- **Aurora/Dawn Repos:** Are they fundamentally Code or English repos at maturity?
