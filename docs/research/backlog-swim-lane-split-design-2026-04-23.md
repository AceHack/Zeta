# BACKLOG per-swim-lane split — design research

**Date:** 2026-04-23
**Status:** proposal; awaiting human-maintainer sign-off on split
axis before migration PR
**Supersedes:** none
**Backlog row:** `docs/BACKLOG.md` § "P1 — Git-native hygiene
cadences (Otto-54 directive cluster)" — row "Split
`docs/BACKLOG.md` into per-swim-lane files" (the BACKLOG row
names a placeholder doc-path of `docs/research/backlog-split-
design-2026-MM-DD.md`; this doc landed at
`docs/research/backlog-swim-lane-split-design-2026-04-23.md`
to use the precise factual descriptor "swim-lane split" — the
BACKLOG row's path placeholder will resolve to this filename
in any subsequent backlog refactor pass).
**Companion memory:** Author's per-user Anthropic AutoMemory
entry on the git-native factory-as-host directive cluster.
This is an out-of-repo per-user artifact (not under
`memory/`); cited here for context only, not as a path
readers can resolve.

---

## Why this proposal exists

Human-maintainer Otto-54: *"it might be benefitial to have multiple
backlog files one per swim lane/stream, you can alway use git to find
hotspots in files... will help reduce merge issues i think."*

The first-run git-hotspots audit landed in
[`docs/hygiene-history/git-hotspots-2026-04-23.md`](../hygiene-history/git-hotspots-2026-04-23.md)
(detection-only artifact — no FACTORY-HYGIENE row owns the
audit cadence as of this writing; the audit ran once at
Otto-54 directive landing and the file is the durable
record). It measured the claim:

| file | touches | PRs |
|---|---:|---:|
| `docs/BACKLOG.md` | 34 | 26 |
| `docs/ROUND-HISTORY.md` | 18 | 12 |
| `memory/MEMORY.md` | 10 | 10 |

**`docs/BACKLOG.md` takes 34 touches across 26 PRs in 30 days —
effectively one BACKLOG touch per PR opened.** It is the
paradigmatic shared-file-friction surface. Every PR this session
that edited BACKLOG.md hit a merge conflict against at least one
sibling (observed on #207, #208, #210). The conflict shape is
repetitive: different rows added in different PRs, both landing at
the same trailing section, requiring manual reorder.

The Otto-54 claim *"split would help reduce merge issues"* is
quantified by the hotspots data. This research doc picks the split
axis + migration plan.

---

## What BACKLOG.md contains today

Word count (2026-04-23): ~68 000 words / ~6 800 lines. Section
structure is a mix of tier-based (`## P0 — X`, `## P1 — Y`,
`## P2 — Z`) and theme-based (`## Research projects`,
`## ⏭️ Declined`, `## P2 — Skill-family expansions`). Sections
do not share a consistent naming convention, and priority
reshuffles leave old-tier rows under their original section
headings.

Rough content taxonomy at section-heading level (best-effort
categorisation; not authoritative):

| Category | Section count (approx) | Content share |
|---|---:|---:|
| Tier-prefixed (P0/P1/P2/P3) | 15 | ~75 % |
| Research-tier specific | 2 | ~10 % |
| Skill-family / role-driven | 2 | ~5 % |
| FACTORY-HYGIENE adjacent | 1 | ~5 % |
| Declined / WONT-DO overlap | 1 | ~5 % |

Observed patterns that drive friction:

- Multiple contributors append to the trailing P2/P3 sections
  (rare P0 changes are easy to coordinate; routine P2 adds are
  the ones conflicting).
- Some rows are load-bearing for specific PRs (must be cited as
  "Source of truth"), and the content is static in tick-to-tick
  motion; others are living triage surfaces updated frequently.
- Tier-prefix naming confuses readers looking for "the game
  theory backlog" vs "the skills backlog" — section titles mix
  concerns.

---

## Candidate split axes

Four candidate axes, with pros/cons per:

### Axis A — by stream (recommended)

Split per substantive work-stream:

- `docs/BACKLOG/core-algebra.md` — Zeta kernel (ZSet, operators,
  primitives, spine, circuit)
- `docs/BACKLOG/formal-spec.md` — OpenSpec, TLA+, Lean, Alloy,
  FsCheck property-test infrastructure
- `docs/BACKLOG/samples-demos.md` — audience-specific samples,
  research/learning/production samples, demo fixtures
- `docs/BACKLOG/craft.md` — onboarding + production-tier Craft
  modules, pedagogy, cross-subject expansions
- `docs/BACKLOG/factory-hygiene.md` — hygiene audits, cadences,
  prevention-layer meta-audits
- `docs/BACKLOG/research.md` — long-horizon research arcs
  (Foundation aspiration, Aurora, Frontier, linguistic seed,
  cluster algebras)
- `docs/BACKLOG/infrastructure.md` — CI, tools, security,
  GitHub-settings-as-code, bun+TS migration, workflows
- `docs/BACKLOG/frontier-readiness.md` — multi-repo split,
  bootstrap reference docs, gap-#N audits

**Pros:**

- Each file has a stable domain owner (Kenji integrates but
  Dejan writes infra, Iris writes UX, Aarav writes hygiene
  etc.)
- Content-shape similarity within a file (all rows about
  similar concerns can compare priorities cleanly)
- Grep-by-filename gets you to the right surface faster than
  grep-by-section-heading in a 6800-line file
- Stream-level files are less prone to priority reshuffling
  (priorities change; streams are stable)
- Supports per-owner cadence (Kenji round-cadence on
  core-algebra + formal-spec; Aarav 5-10 round cadence on
  factory-hygiene)

**Cons:**

- Cross-stream rows (Craft module covering Zeta internals has
  touchpoints on core-algebra + craft) need a policy: primary-
  stream wins, cross-ref via pointer row in secondary streams
- Some rows genuinely span streams; risk of duplication or
  drift if the rule isn't enforced
- Migration is non-trivial: every existing row needs a stream
  classification

### Axis B — by priority (not recommended)

Split per tier:

- `docs/BACKLOG/P0.md`, `docs/BACKLOG/P1.md`,
  `docs/BACKLOG/P2.md`, `docs/BACKLOG/P3.md`

**Pros:**

- Sorting-by-urgency is automatic
- Existing section structure already partially does this

**Cons:**

- Priority reshuffles move rows across files (every P1-to-P2
  down-bump = a file-level move)
- Filename goes stale when the row's priority changes
- Doesn't help merge-friction: every contributor hits the
  same P2 file at the same frequency
- Loses domain affinity (P2 has rows from every subsystem;
  grep-by-priority doesn't match grep-by-concern)

### Axis C — by subsystem (not recommended for BACKLOG)

Split per Zeta code subsystem:

- `docs/BACKLOG/zset.md`, `docs/BACKLOG/circuit.md`,
  `docs/BACKLOG/spine.md`, etc.

**Pros:**

- Matches `src/Core/` module structure
- Easy for engineers to find code-related rows

**Cons:**

- BACKLOG is not purely code; research arcs, pedagogy, hygiene,
  infra, governance all need a home
- Forces non-code rows into awkward "other" bucket
- Subsystem boundaries change (renames, splits); filenames age

### Axis D — hybrid stream + index (variant of A)

Same as axis A but with `docs/BACKLOG/README.md` or
`docs/BACKLOG/INDEX.md` serving as the canonical entry point
that lists all per-stream files + priority rollup.

**Pros:**

- Single discoverable entry; cross-stream priority view via
  rollup
- Retains axis A's stream-affinity benefit
- Easier for new contributors to orient

**Cons:**

- Two-step read (INDEX → per-stream) instead of one-step
- INDEX itself becomes a small coordination surface (low
  merge frequency vs the per-stream files)

---

## Recommendation: axis A (by stream), with axis D index

Rationale:

- Axis A maximises merge-friction reduction (the load-bearing
  Otto-54 ask).
- The stream set is stable enough to own filenames; priority
  fluidity and subsystem churn are both worse candidates.
- Adding an `INDEX.md` (axis D variant) is cheap and solves
  the discoverability concern without eroding the
  merge-friction reduction.
- Existing stream-affinity is already visible in section
  headings today (e.g., "P2 — Skill-family expansions (Aaron-
  authorised)" is clearly skill-family); the axis makes the
  implicit explicit.

## Migration plan

### Phase 1 — coordinate a quiet window

The migration is a mass-rewrite of `docs/BACKLOG.md`. Every
open PR touching BACKLOG.md will conflict at migration time.
Wait for a window with ≤ 3 open BACKLOG-touching PRs (typical
session lull). Signal the migration in chat; land the
migration PR standalone before any routine session tick
opens a BACKLOG edit.

### Phase 2 — classification pass

Walk every row in current `docs/BACKLOG.md`, tag it with a
stream label (one of the 8 candidate streams). For rows that
genuinely span streams, tag the primary and note the
secondary.

### Phase 3 — migration PR

Single PR:

- Creates `docs/BACKLOG/` directory
- Creates `docs/BACKLOG/INDEX.md` — canonical entry point +
  per-stream links + priority rollup (auto-generated or
  hand-curated — research decides)
- Creates one file per stream (8 files)
- Moves each row from the old monolith to its new home
- Root `docs/BACKLOG.md` becomes a one-line pointer to
  `docs/BACKLOG/INDEX.md` (or is deleted if redirects are
  cleaner — research decides)
- Includes a hygiene audit
  (`tools/hygiene/audit-backlog-per-swimlane.sh`) that flags
  new top-level BACKLOG.md edits post-migration

### Phase 4 — cadence + hygiene row

Add FACTORY-HYGIENE row referencing the audit. Expected
post-migration hotspot ranking: no single BACKLOG file above
~10 touches/30 days (from the current 34 on the monolith).
Measure the delta via the git-hotspots audit 30 days
post-migration.

### Phase 5 — cross-ref sweep

Existing PRs merged before the migration have commit messages
citing `docs/BACKLOG.md § "P2 — X"`. Those citations stay
valid historically (the commit is in git history referring
to the file as-it-was); no rewrite. New PRs cite the per-
stream files directly.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Row mis-classified at migration (stream wrong) | Migration PR opens for review; human maintainer + Kenji review classifications before merge |
| Cross-stream rows duplicate or drift | Primary-stream owns; secondary-stream cross-refs via 1-line pointer row linking to primary |
| INDEX.md itself becomes a hotspot | Likely low-churn (only updated on stream-level changes); measure 30 days post-migration |
| Existing PRs conflict massively at migration | Mitigation = wait for quiet window (phase 1) |
| Stream set evolves (new stream needed) | Split one stream file; the cost is a second migration but smaller |
| Search (`grep -r "P0"` etc.) now returns per-file hits instead of one-file | Feature, not bug — per-stream hits carry more context |

---

## What this proposal is NOT

- **Not an ADR** — this is a research doc. A committed ADR
  under `docs/DECISIONS/` would land alongside the migration
  PR in Phase 3, citing this research as the rationale.
- **Not a commitment to migrate this round** — Phase 1
  requires a quiet window; the current queue is not quiet
  (13+ open PRs as of 2026-04-23). Landing when Aaron
  decides the time is right.
- **Not a one-way door** — if axis A post-migration shows
  issues (churn concentrated on one stream file, or
  classification ambiguity worse than expected), the split
  can be revisited. Per the future-self-not-bound rule, a
  later tick can re-axis with an ADR explaining why.
- **Not an authorization to rewrite ROUND-HISTORY.md or
  MEMORY.md on the same pattern** — each has its own
  hotspot data; ROUND-HISTORY's 18/30 touches is an
  append-only narrative (freeze-then-watch), MEMORY.md's
  10/30 is per-memory index (CURRENT-freshness row targets
  it differently). Different remediations for different
  shapes.
- **Not license to skip human-maintainer sign-off** — the
  axis choice is final enough that Aaron should bless it
  before Phase 2 runs.

---

## Open questions for sign-off

1. **Stream set** — is the 8-stream set above the right
   coarseness? Too many streams = overhead; too few = still
   a hotspot.
2. **Root `docs/BACKLOG.md` afterward** — delete, or keep as
   single-line pointer?
3. **INDEX.md auto-generation vs hand-curation** — auto-
   generate (from per-stream headings) risks stale INDEX
   on rename; hand-curate adds small coordination cost.
4. **Sibling migrations** — should `HUMAN-BACKLOG.md` split
   simultaneously or separately?
5. **Migration-PR size** — one big PR (easier review) vs a
   staged migration (less blast radius). Recommend one big
   PR given the coordination cost of a staged migration on
   a live BACKLOG.

Human-maintainer sign-off on these five questions unlocks
Phase 2.

---

## Attribution

Human maintainer directed the split (Otto-54 four-message
cluster) + the git-hotspots audit that validated priority
(Otto-54 same cluster). Otto (loop-agent PM hat, Otto-58)
authored this research doc. Kenji (Architect) queued for
axis-choice review; Rune (readability) for INDEX structure;
Aarav for hygiene-audit design; Dejan for migration-PR
tooling. The 8-stream proposal is starting-point; the sign-
off round is where streams get finalized.
