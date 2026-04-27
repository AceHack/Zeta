# Skill Data/Behaviour Split Audit — Fire History

Append-only log of FACTORY-HYGIENE row #51 audits. Each
row is one audit fire — the cadenced sweep of
`.claude/skills/**/SKILL.md` for mix-signature
violations (catalogs / inventories / adapter tables /
worked examples bundled into the routine body).

The authoritative rule is FACTORY-HYGIENE row #51; the
principle memory is
[`feedback_skills_split_data_behaviour_factory_rule.md`](../../../../.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/feedback_skills_split_data_behaviour_factory_rule.md);
the canonical worked example is the
`github-repo-transfer` triplet
([skill](../../.claude/skills/github-repo-transfer/SKILL.md) +
[data](../GITHUB-REPO-TRANSFER.md) +
[fire-history](./repo-transfer-history.md)).

## Schema

Each row contains:

- **Date (UTC).** YYYY-MM-DD of the audit fire.
- **Agent.** Which persona / wake / session ran the
  sweep.
- **Skills scanned.** Total count of `SKILL.md` files
  scanned.
- **Multi-signature hits.** Count of skills scoring ≥ 2
  on the mix-signature rubric.
- **Genuine splits.** Count after manual triage (some
  multi-signature hits are false positives — e.g.,
  decision-tables in a routine look like data-tables
  to the mechanical scan).
- **Landed splits this fire.** Count of skills actually
  split in the same session (usually 0 — splits are
  queued as BACKLOG work, not author-time).
- **Follow-up BACKLOG row.** Link to the queue entry
  for deferred splits.

## Why we keep this log

- **Row #44 (cadence-history) compliance.** Every
  cadenced factory surface with declared cadence MUST
  have a fire-history surface. Row #51's cadence is
  "every 5-10 rounds (same as row #5 skill-tune-up)";
  this file is the fire-history.
- **Signal calibration.** The mix-signature rubric is
  heuristic. Each fire's multi-sig-hits-vs-genuine-
  splits ratio is evidence for refining the rubric. A
  fire where "genuine = hits" means the rubric is
  tight; a fire where "genuine << hits" means the
  rubric is flagging false positives and needs
  refinement.
- **Factory-state offline readability.** Per
  `project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`,
  a future reader (local-only agent, fresh contributor,
  air-gapped CI runner) can see at a glance how often
  this audit fires, what it catches, and how the rubric
  evolves — without re-running the sweep.

## Rows

| Date | Agent | Skills scanned | Multi-sig hits | Genuine splits | Landed splits this fire | Follow-up BACKLOG row |
|---|---|---|---|---|---|---|
| 2026-04-22 | architect (kenji), first fire | 234 | 6 | 4 + 1 borderline | 0 (queued) | BACKLOG P1 row *"Retrospective split of four data-heavy expert skills"* |

## Fire 1 — 2026-04-22 first fire, full audit

### Methodology

Mechanical scan of every `.claude/skills/*/SKILL.md`
(excluding `_retired/` / `workspace/`) using the
signature rubric from the memory file:

- Section-header keywords: `catalogue` / `catalog` /
  `index` / `zoo` / `compendium` / `taxonomy` /
  `registry` / `reference table`.
- Known gotchas / pitfalls / common mistakes /
  footguns sections.
- Worked example / case study / in practice sections.
- Adapter / compatibility / variants / neutrality
  tables.
- What-survives / what-breaks / what-changes
  inventories.
- Line count > 400 as a weak tie-breaker (long skills
  are more likely to be mixed but not necessarily).

Score = count of signatures present. Threshold for
flagging: score ≥ 2.

### Rubric-refinement note

The first pass of the rubric (score based on
`tables > 8` as one signal) produced 38 flags — mostly
false positives from decision-tables in routines. The
rubric was refined mid-audit: table-count dropped,
catalog/catalogue/index keywords added. Refined rubric
produced 6 flags, 4-5 of which are genuine. This is
the calibration signal mentioned above — the refined
rubric is roughly 4-5x tighter than the initial one.

### Flagged skills

#### Genuine splits (4) — queue for P1 BACKLOG

1. **`performance-analysis-expert`** (642 lines, score
   3).
   - Mix sections: `## Core background — the
     catalogue` (~130 lines: queueing theory, USE/RED,
     Amdahl, Dean's numbers, tail latency,
     microarchitecture); `## Profiler-tool catalogue
     — read these, know these` (~80 lines: Linux /
     Windows / macOS / .NET / cross-platform profiler
     index).
   - Routine content: `## When to wear`, `## When to
     defer`, `## Zeta use`, `## AOT analysis
     procedure`, `## Capacity-planning procedure`.
   - Split target: routine stays; background +
     profiler catalogue move to
     `docs/PERFORMANCE-ANALYSIS-REFERENCE.md`.
   - Effort estimate: M (large catalog, cross-platform
     surface, multiple routine-consumer callsites).

2. **`serialization-and-wire-format-expert`** (478
   lines, score 2).
   - Mix sections: `## Format catalogue — read this,
     know these` (~60 lines: Protobuf, FlatBuffers,
     Cap'n Proto, Arrow, MessagePack, JSON, etc.);
     `## Decision matrix — which format` (borderline
     — could be routine or data).
   - Routine content: `## Procedure for introducing a
     new serialization surface`, `## Schema
     evolution`, `## Canonical-form discipline`,
     `## Fuzzing and parser safety`.
   - Split target: routine + decision matrix stays;
     format catalogue moves to
     `docs/SERIALIZATION-FORMATS.md`.
   - Effort estimate: S-M.

3. **`compression-expert`** (431 lines, score 2).
   - Mix sections: `## Core background` (~115 lines:
     entropy coding, dictionary-based, specialized);
     `## Hazards and anti-patterns` (~70 lines: catalog
     of 10+ pitfalls — borderline mix given the
     hazards are reference-material, not
     decision-flow).
   - Routine content: `## Introduction procedure —
     adding a codec to Zeta`, `## .NET-specific
     choices`, `## Decision matrix`.
   - Split target: routine stays; core background +
     hazards catalogue move to
     `docs/COMPRESSION-REFERENCE.md`.
   - Effort estimate: S-M.

4. **`hashing-expert`** (415 lines, score 2).
   - Mix sections: `## Hash-function catalogue`
     (~75 lines: MD5, SHA-1, SHA-2, SHA-3, BLAKE2,
     BLAKE3, xxHash, MurmurHash, SipHash, etc.);
     `## Hazards — read these once, remember forever`
     (~55 lines: catalog).
   - Routine content: `## Procedure for introducing a
     new hashed surface`, `## Decision trees`, `## Key
     / seed discipline`.
   - Split target: routine + decision-trees stays;
     hash catalogue + hazards move to
     `docs/HASHING-REFERENCE.md`.
   - Effort estimate: S-M.

#### Borderline (1) — observe one more cycle

1. **`consent-ux-researcher`** (448 lines, score 2).
   - Mix section: `## Dark-pattern catalog — what to
     never design` (~60 lines). The rest of the body
     is procedural (`## The five preconditions of real
     consent`, `## Comprehension-bar operational
     test`, `## Layered disclosure`, `## Revocation UX
     pattern`, `## How to review a consent flow`).
   - Signal: single catalog section embedded in
     otherwise-procedural content. Dark-pattern
     awareness is arguably part of the consent-UX
     expertise (the reviewer needs to have the anti-
     pattern vocabulary loaded while reviewing).
   - Decision: **observe** this cycle. If the next
     fire also flags it, split the dark-pattern
     catalog to `docs/CONSENT-DARK-PATTERNS.md`;
     otherwise let it be.
   - Effort if split: S.

#### False positive (1) — rubric-refinement data

1. **`sweep-refs`** (160 lines, score 2).
   - Signal triggered by: `## Pitfalls we've hit`
     (~20 lines, 5-6 bullets) + length > 400 (wait —
     this file is 160 lines, not >400; the signal was
     `catalog=1` from a section header matching
     "catalog"? Let me recheck).
   - On inspection: the skill has a short pitfall
     list appropriate for a procedure-local gotcha
     context. Not a split candidate.
   - Rubric-refinement note: the pitfall-section
     trigger should require > 3 catalog-style sub-
     items (bullets / sub-headings), not mere
     presence of the section.

### Counts

- **234** SKILL.md files scanned.
- **6** multi-signature hits (score ≥ 2) after rubric
  refinement.
- **4** genuine split candidates queued to BACKLOG.
- **1** borderline queued to next-cycle observation.
- **1** false positive feeding rubric refinement.
- **0** splits landed in this fire (audit-only;
  splits are separate work).

### Follow-up landings (this tick)

- BACKLOG row *"Retrospective split of four data-heavy
  expert skills (performance-analysis, serialization,
  compression, hashing)"* added to P1 architectural
  hygiene, cross-referenced to this fire.
- Rubric refinement (require > 3 catalog-style
  sub-items for gotcha/pitfall sections to trigger the
  mix signal) noted for the next fire's audit script.
- BACKLOG row for `skill-creator` to gain the
  at-landing mix-signature checklist (prevention
  surface) + BACKLOG row for `skill-tune-up` to gain
  mix-signature as criterion-8 (detection surface),
  both to be routed through the canonical skill-
  editing workflow per GOVERNANCE.md §4.

## Cadence

- **Round cadence.** Every 5-10 rounds (same as
  FACTORY-HYGIENE row #5 skill-tune-up). First fire
  2026-04-22; next-fire-expected ~ 2026-05-10.
- **Opportunistic on-touch.** Every new or edited
  `SKILL.md` triggers the author-time prevention
  surface (`skill-creator` checklist, once landed).
- **Round-close audit.** If a fire happened this round
  and no row exists here, that's a hygiene failure —
  file immediately.

## Related

- `docs/FACTORY-HYGIENE.md` row #51 — the authoritative
  hygiene rule.
- `memory/feedback_skills_split_data_behaviour_factory_rule.md`
  — the principle memory.
- `memory/feedback_bootstrapping_divine_downloading_factory_learns_from_self.md`
  — the naming memory for the meta-pattern that
  produced row #51.
- `.claude/skills/github-repo-transfer/SKILL.md` +
  `docs/GITHUB-REPO-TRANSFER.md` +
  `docs/hygiene-history/repo-transfer-history.md` —
  canonical three-surface worked example.
- `.claude/skills/skill-tune-up/SKILL.md` — the
  detection runner once criterion-8 lands.
- `.claude/skills/skill-creator/SKILL.md` — the
  prevention surface once the at-landing checklist
  lands.
- `docs/BACKLOG.md` P1 architectural hygiene — where
  the follow-up split work queues.
