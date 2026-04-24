---
name: DV-2.0 is scope-universal indexing substrate (not skill-catalog-only)
description: Aaron 2026-04-22 scope-extension — DV-2.0 audit columns (`record_source / load_datetime / last_updated / superseded_by / status / bp_rules_cited`) apply to every indexed factory artifact, with indexing as the named value prop. Plus the self-reference closure corollary.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22: *"Data Vault 2.0 can be scope universal sounds
like it will help with indexing"*. The DV-2.0 discipline that
`skill-documentation-standard` codified for SKILL.md files is
not scoped to the skill catalog — it is a factory-wide default
for every artifact the factory indexes.

**Why:** indexing is the value Aaron specifically named. Once
every indexed artifact carries DV-2.0 breadcrumbs, cross-surface
queries become first-class — e.g. "all artifacts authored in
round N that cite BP-11", "all artifacts whose last_updated
lags their paired skill by > 10 rounds", "trace lineage through
`superseded_by` chains spanning ADRs, research reports, backlog
rows". This is the DV-sense hub/satellite/link pattern
materialised on the factory substrate, not a metaphor — a
tooling script could re-project the whole factory as a DV
schema and the audit properties would hold.

**How to apply:**

- **Scope** (surfaces the factory indexes and where DV-2.0
  applies): `.claude/skills/**/SKILL.md` (pilot, already
  specified), `.claude/agents/**/*.md` (personas),
  `docs/DECISIONS/**/*.md` (ADRs), `docs/research/**/*.md`
  (reports), `docs/BACKLOG.md` rows (table-shaped —
  row-columns not frontmatter), `docs/ROUND-HISTORY.md`
  rows, `docs/hygiene-history/*.md` rows,
  `memory/persona/**/*.md` (notebooks).
- **Pilot state 2026-04-22**: mechanical audit found 214 of
  216 SKILL.md files missing all five DV-2.0 fields. Only
  `github-surface-triage` (fixed this round) and
  `skill-documentation-standard` (fixed this round, was
  the self-referential gap) are compliant. BACKLOG row
  queues the mechanical cascade.
- **Owner split**: Aarav (skill-lifecycle) on phase 1
  skill-catalog rollout; `data-vault-expert` +
  `catalog-expert` on phase 2 cross-surface design;
  `skill-improver` on the mechanical cascade itself.
- **Corollary — self-reference closure**: a skill / doc /
  process that defines a standard must carry that standard
  in its own artifact. The standard-defining skill must
  live up to the standard it defines. If it cannot, the
  standard is aspirational and the factory hasn't adopted
  it. Aaron affirmed this framing ("nice Meta-fix: the
  standard-defining skill must carry its own standard")
  after the tick-local fix on
  `skill-documentation-standard`. This applies beyond
  DV-2.0 — e.g. the style guide should follow its own
  style guide; an ADR template should be ADR-compliant;
  a governance doc should be section-numbered-expert-
  compliant.
- **Don't surprise Aaron** with a premature cross-surface
  rollout — the scope-extension is large and backwards-
  compat concerns on long append-only tables
  (ROUND-HISTORY, hygiene-history) need design work first.
  Phase 1 mechanical skill-catalog rollout is safe to
  proceed scripted; phase 2 needs a research report.
- **Reference**: BACKLOG row "Data Vault 2.0 provenance as
  scope-universal indexing substrate — rollout beyond the
  skill catalog" landed 2026-04-22 in commit `a103f08`.
