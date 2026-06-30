# Axis-3 Code/English + formal-verification three-axis design decision

**Date:** 2026-05-14
**Status:** Accepted
**Author:** Otto
**Related row:** B-0479

## Context

The Zeta repository structure is evolving from a single monorepo into a multi-axis network. Previous decisions established Axis 1 (Factory vs Product vs Owner-only) and Axis 2 (Mirror vs Beacon).

On 2026-05-13, Aaron introduced a third orthogonal dimension:
> "we should also likely start to split based on code vs english except some docs belong in repo via best engineering practices... maybe even formal verificatino is split out"

This ADR formalizes the Axis-3 substrate structure. It relies on the Data Vault 2.0 (DV2.0) change-rate discipline: English documents (memory files, conversation archives) change extremely fast, whereas compiled Code changes slower. Furthermore, the GitHub Rulesets required to govern these tiers diverge significantly (e.g., heavy CI builds for code vs markdown linters for text).

## Decision: Code/English tier definitions

The Axis-3 structure categorizes substrate into two primary tiers:

1. **Code Tier:** Content whose primary purpose is executable, compilable, or directly testable (source code, tests, build scripts, wrappers).
2. **English Tier:** Content whose primary purpose is discursive, philosophical, or narrative (research documents, memory files, persona notebooks).

**The Engineering-Docs Exception:** The following documents are explicitly bound to the Code Tier because their versioning must march in lockstep with the code they describe:
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- Architecture Decision Records (ADRs) (`docs/DECISIONS/`)
- API documentation, Code of Conduct, security policies.

**Default Rule:** Content stays co-located unless DV2.0 change-rate analysis or divergent rulesets necessitate a split.

## Decision: Per-repo Axis-3 assignments

The three-axis matrix for current and proposed repositories:

| Repo | Axis-1 (Domain) | Axis-2 (Maturity) | Axis-3 (Substrate) | Split Recommendation |
|------|----------------|-------------------|--------------------|----------------------|
| **LFG/Zeta** | Factory | Beacon | Mixed | **Split.** Move `memory/` and `docs/research/` out. |
| **LFG/civsim** | Product | Beacon | Code | **Co-locate.** |
| **Forge** | Factory | Mirror | Mixed | **Split.** Separate factory tools from memory files. |
| **ace** | Factory | Beacon | Code | **Co-locate.** |
| **lf-ksk** | Product | Mirror | Code | **Co-locate.** |
| **aurora-network** | Product | Mirror | Mixed | **Resolved:** Remains Mixed until product defines clear code boundaries. |
| **american-dream** | Product | Mirror | Code | **Co-locate.** |
| **lf-dio** | Product | Mirror | Code | **Co-locate.** |
| **Dawn** | Product | Mirror | English | **English-only.** Charter documents. |

## Decision: Formal-verification sub-axis

Formal verification artifacts are categorized per property class:

1. **The `Zeta-OpenSpec` Split:** TLA+ models, Lean 4 proofs, Z3/SMT constraints, and Alloy models. These represent standalone mathematical models with violently divergent CI timelines (theorem-prover limits vs unit test limits). They will move to a dedicated `LFG/Zeta-OpenSpec` repository.
2. **The `Forge` Split:** CodeQL and Semgrep rules. These are factory hygiene tools and will move to `Forge`.
3. **The Co-Location Mandate:** FsCheck property tests and Stryker.NET mutation configs. FsCheck tests compile directly against the F# API. They must remain in the primary Code repos.

## Decision: Ruleset-divergence smell test operationalization

The Github Ruleset divergence audit confirmed that "ruleset divergence is the smell test for repo splits."
- Divergent required status checks (F# vs Markdownlint) justify the Code/English split.
- Divergent execution timeouts justify the Formal Verification split.

**Canonical Rule:** The ruleset divergence smell test is operative at repo-creation time. If two substrate clusters need mechanically different GitHub rulesets to govern them, they belong in different repositories.

## Consequences

- **What changes:** The `memory/` and `docs/research/` folders are formally marked for evacuation from `LFG/Zeta` into a dedicated English-tier repository (e.g., `Zeta-Memory`). Formal specs move to `Zeta-OpenSpec`.
- **What does NOT change:** Axis-1 and Axis-2 rules, honor-system licenses, and the glass-halo transparency protocol.
- **Ruleset Design:** New repos will map their GitHub Rulesets precisely to their Axis-3 classification (e.g., English repos will NOT run `build-and-test`).

## Composes with
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`
- `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md`
- `docs/research/2026-05-14-axis3-prior-art-audit-b0475.md`
- `docs/research/2026-05-14-github-ruleset-divergence-audit-b0476.md`
- `docs/research/2026-05-14-axis3-code-english-classification-matrix-b0477.md`
- `docs/research/2026-05-14-formal-verification-repo-split-evaluation-b0478.md`
