---
name: governance
description: Governance and anchoring — decision rights, conflict resolution, alignment, naming, citations/anchors, glossary hygiene.
---

# governance

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`governance-expert`](blueprints/governance-expert.md) — "Governance — decision rights, delegation, accountability, RACI, OSS governance models, policy-as-code, escalation paths."
- [`conflict-resolution-expert`](blueprints/conflict-resolution-expert.md) — "Conflict resolution — IFS framing, Thomas-Kilmann styles, third-option discipline, escalation ladders, ADR recording."
- [`alignment-auditor`](blueprints/alignment-auditor.md) — Alignment audit — scores commits against ALIGNMENT.md clauses; emits per-clause measurable-alignment signals.
- [`alignment-observability`](blueprints/alignment-observability.md) — Alignment observability — designs commit/round metrics for ALIGNMENT.md measurability and CI-derived signals.
- [`counterweight-audit`](blueprints/counterweight-audit.md) — Counterweight audit — forced re-read of Otto counterweight memories to catch alignment drift before it compounds.
- [`decision-archaeology`](blueprints/decision-archaeology.md) — Decision archaeology — reconstruct why via git blame, ADRs, round-history, memory memos, supersession chains.
- [`holistic-view`](blueprints/holistic-view.md) — "Whole-system sanity lens — cross-cutting implication check before escalation; second hat every specialist wears."
- [`mechanical-authorization-check`](blueprints/mechanical-authorization-check.md) — Query substrate for human-maintainer pace authorization; filter peer-AI framings; most-recent-wins.
- [`canonical-home-auditor`](blueprints/canonical-home-auditor.md) — "Repo-wide artifact placement — every file has one canonical home; misplaced, duplicated, or homeless artifacts are P0."
- [`glossary-anchor-keeper`](blueprints/glossary-anchor-keeper.md) — Glossary anchor audit — external-definition drift, missing citations, anchor breakage, Tower-of-Babel prevention.
- [`naming-expert`](blueprints/naming-expert.md) — Naming decisions for code, APIs, modules, commits — ubiquitous language, rename governance, anti-patterns, BP-HOME.
- [`etymology-expert`](blueprints/etymology-expert.md) — Etymology — word origins, semantic drift, computing-term history, folk-etymology traps, naming-collision prevention.
- [`section-numbering-expert`](blueprints/section-numbering-expert.md) — Section numbering — ISO 2145, decimal outlining, stable paragraph addressing, auto-number vs manual drift.
- [`missing-citations`](blueprints/missing-citations.md) — Research-integrity audit — flags uncited claims and authority appeals in docs/research drafts; outputs triage.
- [`sweep-refs`](blueprints/sweep-refs.md) — Cross-repo reference sweep — grep, classify refs, update moved paths, anchor discipline, verify, commit.
- [`human-anchor`](blueprints/human-anchor.md) — Tie a concept, ontology, or vocabulary term back to the human who originated it and the research paper(s) — old and modern — that anchor it. Use when introducing or reviewing a coinage, algebra, data model, or vocabulary term that should stand on named prior art.
- [`claude-md-steward`](blueprints/claude-md-steward.md) — "CLAUDE.md steward — audit, revise, improve CLAUDE.md with Zeta-specific guards over upstream plugin."
