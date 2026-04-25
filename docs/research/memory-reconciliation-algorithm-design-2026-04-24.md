# Memory reconciliation algorithm — design v0

**Date:** 2026-04-24
**Status:** research proposal; v0 design ready for review + incremental implementation
**Stage:** Amara Determinize (L-effort item per PR #221 absorb)
**Companion:** Otto-73 retractability-by-design foundation memory
**Implementation arc:** this doc is design-only; implementation lands as separate PRs (schema adoption → migration tooling → generation tool → CI integration) across multiple rounds

---

## Why this exists

Amara's 4th courier ferry (PR #221 absorb) proposed replacing
hand-maintained prose-based `CURRENT-aaron.md` / `CURRENT-amara.md`
distillations with **generated views over typed memory facts**.

Her sketch was a ~40-line Python prototype. This doc is the
design that downstream implementation follows: schema
semantics, normalization rules, conflict detection, rendering,
migration path from the existing prose corpus.

The design also addresses the MEMORY.md cap-drift surfaced by
Otto-70's snapshot-pinning tool (58842 bytes vs. 24976-byte
cap per FACTORY-HYGIENE row #11). A generated index can be
bounded by construction (emit top-N most-relevant, archive
the rest).

Composes with "deterministic reconciliation" naming (Otto-67
endorsement): this IS the concrete reconciliation mechanism
for the memory layer. Also composes with Zeta's retraction-
native algebra — `MemoryFact` records with explicit
supersession + retraction status mirror Z-set algebraic
semantics at the memory substrate.

---

## Scope

### In scope

- Typed `MemoryFact` record schema (fields + invariants)
- Canonical-key normalization rules (what makes two facts
  "about the same thing")
- Priority / supersession / status semantics
- Conflict detection + surfacing
- Generated rendering rules for `CURRENT-<maintainer>.md`
  and `MEMORY.md` index
- Migration path from existing prose memories
- CI integration hooks

### Out of scope (future work)

- Actual implementation language + tool (Python, F#, shell —
  later decision; design is language-agnostic)
- Full backfill of the 391 existing per-user memories +
  44 in-repo memories into typed records
- LLM-based fact extraction (if needed for prose-to-fact
  migration — separate research arc)
- Multi-maintainer consensus protocols (today: one
  human maintainer + AI maintainers. Cross-human
  consensus can be added when roster grows)

### Guardrail principles

- **Don't rewrite prior prose memories.** They're source-
  of-truth for the facts they encode; typed records
  extract facts FROM them, don't replace them.
- **Retractions leave trails.** Supersession is explicit +
  dated; no silent rewrite. Honors Otto-73 retractability-
  by-design discipline.
- **Generated views are DERIVED, not authoritative.**
  `CURRENT-*.md` and `MEMORY.md` become generated; the
  typed fact corpus is the source of truth.
- **Migration is incremental.** Land the schema first;
  backfill mechanically where possible; retain prose for
  facts too rich to compress.

---

## Schema — `MemoryFact` record

### Fields

| Field | Type | Required | Semantics |
|---|---|---|---|
| `id` | string | yes | Globally unique fact ID (e.g., `MF-2026-04-23-001`) |
| `subject` | string | yes | Who the fact is about: `aaron` / `amara` / `otto` / `kenji` / ... / `any` (factory-generic) |
| `predicate` | string | yes | Normalized verb: `prefers` / `delegates` / `forbids` / `endorses` / `retracted` / `supersedes` / ... |
| `object` | string | yes | Normalized claim text |
| `source_kind` | enum | yes | `memory` / `current` / `decision` / `backlog` / `conflict` / `verbatim-quote` |
| `source_path` | string | yes | File path the fact was extracted from |
| `source_anchor` | string | optional | Line number, section header, or hash for citation |
| `timestamp_utc` | ISO8601 | yes | When the fact was authored (not when extracted) |
| `supersedes` | string | optional | ID of fact this one supersedes (one-to-one) |
| `priority` | int | yes | Explicit override > current view > memory > archive (4 > 3 > 2 > 1) |
| `status` | enum | yes | `active` / `retracted` / `superseded` |
| `confidence` | enum | optional | `verbatim` / `paraphrase` / `inference` — how tight the extraction is |
| `tags` | list[string] | optional | Cross-cutting tags: `principle`, `authorization`, `register`, `ops`, `naming`, etc. |

### Invariants

1. `(subject, predicate, canonical_key(object))` is the
   canonical key. Multiple facts with the same canonical
   key form a version chain.
2. At most one fact per canonical key has `status: active`
   at any given time. Others are `superseded` or `retracted`.
3. `supersedes` is a single-step back-pointer. Chain
   traversal: follow `supersedes` until null.
4. `timestamp_utc` is monotone along a supersession chain
   (newer supersedes older).
5. `retracted` status implies `supersedes` is set to the
   previously-active fact (retraction creates a new
   record, not an in-place edit).
6. `priority` breaks ties only among simultaneously-
   active facts (shouldn't happen under invariant 2 but
   provides a deterministic fallback).

### Canonical-key normalization

`canonical_key(object)` collapses minor variations so
facts-about-the-same-thing chain cleanly.

Rules (applied in order):

1. Lowercase all characters
2. Replace whitespace sequences with single space
3. Strip leading/trailing whitespace
4. Remove markdown emphasis markers (`**`, `*`, `_`, backticks)
5. Normalize smart/curly quotes (left-double U+201C, right-
   double U+201D, left-single U+2018, right-single U+2019)
   to plain ASCII straight quotes (`"` and `'`)
6. Collapse repeated punctuation (`!!!` → `!`)
7. Strip trailing punctuation (`.`, `!`, `?`, `;`, `,`)

Rules NOT applied (preserve these distinctions):

- Word order — "Aaron prefers X" ≠ "X is Aaron's preference"
  (different canonical keys; handle via separate fact
  extraction, not normalization)
- Synonyms — "like" vs. "prefer" (lexically distinct;
  collapsing requires LLM-assisted normalization,
  out of scope for v0)
- Tense — "Aaron prefers X" vs. "Aaron preferred X"
  (different tense = different time; preserve)

### Example records

```yaml
- id: MF-2026-04-23-001
  subject: aaron
  predicate: endorses
  object: deterministic reconciliation as canonical phrasing for operational closure
  source_kind: memory
  source_path: memory/feedback_deterministic_reconciliation_endorsed_naming_for_closure_gap_not_philosophy_gap_2026_04_23.md
  timestamp_utc: 2026-04-23T20:45:00Z
  supersedes: null
  priority: 3
  status: active
  confidence: verbatim
  tags: [naming, principle, vocabulary]

- id: MF-2026-04-23-004
  subject: aaron
  predicate: grants
  object: full GitHub access for AceHack + LFG, only restriction is don't increase spending without asking
  source_kind: memory
  source_path: memory/feedback_aaron_full_github_access_authorization_all_acehack_lfg_only_restriction_no_spending_increase_2026_04_23.md
  timestamp_utc: 2026-04-23T21:30:00Z
  supersedes: MF-2026-04-23-002   # superseding the prior Otto-23 partial grant
  priority: 3
  status: active
  confidence: verbatim
  tags: [authorization, standing, github]
```

---

## Reconciliation algorithm

Pseudocode (language-agnostic):

```
function reconcile(facts):
  # Group by canonical key. Use defaultdict(list) so the
  # first append() initialises the bucket; equivalent to
  # `if k not in by_key: by_key[k] = []` then append.
  by_key = defaultdict(list)
  for f in facts:
    # Stable fact identity is (id) — fact-IDs are unique.
    # The (subject, predicate, canonical_key(object)) tuple
    # is the *grouping* key (multiple distinct facts may
    # share it under invariant #2's collision case below);
    # do NOT confuse the two.
    k = (f.subject, f.predicate, canonical_key(f.object))
    by_key[k].append(f)

  # Per-key: pick the winner, detect conflicts.
  accepted = {}
  conflicts = []
  for key, group in by_key.items():
    # Retraction semantics: a key is "live" if the HEAD
    # of its supersession chain has status == "active".
    # The chain head — not "any active record in the
    # group" — determines liveness, because a key with
    # active(t=1) → retracted(t=2) is NOT live (head is
    # retracted) even though an earlier active record
    # exists in the group. Status transitions to
    # "retracted" or "superseded" via explicit
    # FactRetracted / FactSuperseded events; we never
    # delete records, only mark them.
    chain_head = follow_supersession_to_head(group)
    if chain_head is not None and chain_head.status == "active":
      # Multiple active records that all map to the same
      # canonical key (invariant-2 violation) surface as a
      # ConflictRow; chain head is the winner.
      siblings_active = [f for f in group
                         if f.status == "active"
                         and f.id != chain_head.id]
      if siblings_active:
        conflicts.append(ConflictRow(
          key, [chain_head, *siblings_active], winner=chain_head))
      accepted[key] = chain_head
    # else: key is fully retired (chain head retracted or
    # superseded with no successor). Don't mark live;
    # chain integrity is still validated below.

  # Check version-chain consistency over ALL grouped keys
  # — including those whose chain head is retracted or
  # superseded — not just `accepted`. Chain integrity is
  # a property of the history, independent of liveness.
  for key, group in by_key.items():
    chain = follow_supersession_full(group)
    if chain_broken(chain):
      conflicts.append(ConflictRow(key, chain, reason="broken chain"))

  return accepted, conflicts
```

### Conflict outputs

Each conflict becomes a row in `docs/CONTRIBUTOR-CONFLICTS.md`
(the file Amara's 4th ferry noted is present-with-schema-but-
unpopulated; this design starts populating it via the
generator).
Row format:

```markdown
### CONF-<YYYY-MM-DD>-<NNN>: <subject> / <predicate>
- **Canonical key:** `<subject>::<predicate>::<normalized-object>`
- **Conflicting facts:** [MF-..., MF-...]
- **Winner (priority tiebreak):** MF-...
- **Reason:** invariant-2 violation | broken chain | explicit disagreement
- **Resolution:** pending | explicit-preference-recorded | escalated
- **Resolution evidence:** <DP-NNN.yaml ref if proxy-reviewed>
```

Conflicts block the `CURRENT-*.md` generation if unresolved
— this is the "explicit-not-silent" discipline Amara
emphasized. A CI run that discovers unresolved conflicts
fails the generation job.

---

## Rendering rules

### `CURRENT-<maintainer>.md` generation

Filter accepted facts by subject (`<maintainer>` or `any`),
sort by `(priority DESC, timestamp DESC)`, group by
`predicate`, render as markdown:

```markdown
# CURRENT-<maintainer>.md — generated

**Last generated:** <ISO8601 UTC>
**Source corpus:** <N facts from memory/ + <M> facts from docs/>
**Conflicts pending:** <K>

---

## <predicate>

- **<object>** — source: [<memory>](<source_path>), <timestamp>
- ...
```

Header states generation-time + source-corpus-size +
pending-conflict-count. The generator may refuse to emit
if `conflicts_pending > 0` and `--allow-conflicts` is not
set.

### `MEMORY.md` index generation

Accept facts where `source_kind == "memory"`; emit
newest-first list of `(source_path, first-sentence-of-object,
tags)` tuples. Cap at configurable size (default: 250 entries
or 24,000 bytes — strictly under the FACTORY-HYGIENE row #11
24,976-byte hard cap, with ~1KB headroom for any header /
index annotations the generator writes around the entry list).

Older entries move to dated archive files
`memory/MEMORY-ARCHIVE-YYYY-MM.md`. Ordering + link integrity
preserved across the archive boundary.

---

## Migration path from existing prose corpus

### Phase 1 — Schema adoption + worked example (S)

- Land this research doc (current PR)
- Create `memory/facts/` directory seeded with 5-10
  manually-authored `MemoryFact` records as worked
  examples (e.g., the "Aaron endorses deterministic
  reconciliation" record shown above)
- Keep existing prose memories unchanged

### Phase 2 — Generator prototype, off-CI (S-M)

- Implement `tools/memory/reconcile.py` (or equivalent)
  reading `memory/facts/*.yaml` + emitting
  `memory/CURRENT-<maintainer>.md.generated` +
  `memory/MEMORY.md.generated` (parallel output, not
  replacing existing files yet)
- Land the tool + a research doc comparing generated
  output against current hand-maintained files
- Do NOT overwrite existing files in this phase

### Phase 3 — Mechanical backfill (M)

- For each existing prose memory, extract 1-5
  `MemoryFact` records mechanically (parse frontmatter
  `description` + `verbatim` quotes)
- Human-maintainer spot-check of backfill quality
- Cross-link: typed records cite their source prose
  memory via `source_path`

### Phase 4 — Cutover with retractability (M)

- Move existing hand-maintained `CURRENT-*.md` to
  archive (`CURRENT-aaron-archive-2026-04.md`);
  retractability preserves the old versions
- Cutover the root `CURRENT-aaron.md` / `CURRENT-amara.md`
  to generated output
- Same for `MEMORY.md`
- CI integration: fail if generated output drifts from
  expected; conflict rows block generation

### Phase 5 — Richer LLM-assisted extraction (L, research)

- Use an LLM pass to extract additional facts from
  prose that the mechanical parser missed
- Careful review discipline — not auto-merge; human
  + peer review for each LLM extraction pass
- Establishes a richer fact-count; may surface additional
  conflicts

---

## CI integration hooks

### Existing surfaces this composes with

- FACTORY-HYGIENE row #58 (memory-index-integrity CI) —
  same-commit pairing of memory changes + MEMORY.md
  updates. Generated MEMORY.md preserves this invariant
  by construction; CI stays green.
- FACTORY-HYGIENE row #59 (memory-reference-existence) —
  link targets must resolve. Generated output can be
  validated by the same tool; CI stays green.
- AceHack PR #12 (memory-index-duplicates) — no duplicate
  link targets. Generated output deduplicates by
  construction; CI stays green.
- PR #222 decision-proxy-evidence — `consulted_memory_ids`
  can now reference `MemoryFact.id` directly for
  tighter audit.

### New CI hook for this work

- `memory-reconcile-generation.yml` — on PR touching
  `memory/facts/*.yaml` or the generator, re-run
  generation; fail if generated output ≠ committed
  output (similar to OpenAPI-spec-diff style check).

### Ordering of hooks

1. memory-index-integrity (row #58) — same-commit
2. memory-reference-existence (row #59) — refs resolve
3. memory-index-duplicates (AceHack #12) — no dups
4. memory-reconcile-generation (new) — generated output
   matches committed
5. memory-reconcile-conflict-check (new) — no unresolved
   conflicts

Steps 4 + 5 are future work; 1-3 already cover the
prose-layer invariants.

---

## Relationship to existing substrate

### With Otto-73 retractability-by-design

The `MemoryFact.status` field (active / superseded /
retracted) is exactly the retraction-native primitive at
the memory substrate. Each record is a signed delta;
supersession chains encode history; the reconciliation
algorithm is a deterministic fold over the deltas.
Zeta's ZSet algebra applied to memory.

### With Amara's 4 ferries

Amara's 4th ferry explicitly proposed this algorithm;
earlier ferries established the drift classes it
addresses:

- Otto-24 (PR #196) operational gap — memory-index lag
  (NSA-001) now captured as canonical-key conflict
  in the fact corpus
- Otto-54 (PR #211) ZSet semantics — the algebraic
  framework (Z-sets + retraction) that this memory
  schema inherits
- Otto-59 (PR #219) decision-proxy technical review —
  `consulted_memory_ids` field needs stable memory IDs;
  MemoryFact.id provides them
- Otto-67 (PR #221) memory drift alignment — this is
  the concrete algorithm her report proposed

### With Zeta's core algebra

`MemoryFact` records ARE Z-set entries at the memory
layer:

- `(subject, predicate, canonical_key(object))` = the Z-set
  key
- Priority + status + timestamp = the "weight" dimension
  (non-integer; resembles signed-delta semantics)
- Reconciliation = the `distinct` operator at the
  memory level, clamping to at-most-one-active per key
- Conflict detection = invariant violation surfacing
  (the same discipline Zeta's algebra-owner enforces
  for the code layer)

This is not coincidence. Aaron's Otto-73 thesis:
retractability is design at every layer of the factory.
This doc operationalizes it at the memory layer.

---

## What this design is NOT

- **Not a commitment to one implementation language.**
  Python, F#, shell — later decision. Design is
  language-agnostic.
- **Not a requirement to migrate all 391 existing
  per-user memories at once.** Incremental backfill,
  prose retained as source-of-truth.
- **Not authorization to overwrite existing
  CURRENT-*.md files.** Cutover is Phase 4; earlier
  phases generate `.generated` companions.
- **Not a commitment to LLM-assisted extraction.**
  Phase 5 is research-grade; manual + mechanical
  parsing covers the main backfill.
- **Not a replacement for decision-proxy-evidence
  records.** Evidence records capture per-decision
  context; MemoryFacts capture long-lived claims.
  Different surfaces; they compose via ID references.
- **Not a retraction of prose memory discipline.**
  Prose stays; it's the source material from which
  typed records extract. The factory's thought-layer
  continues in prose.

---

## Open questions for follow-up rounds

1. **Language choice** — Python (Amara's prototype),
   F# (consistent with Zeta), shell (matches existing
   tools/hygiene/ pattern)?
2. **Facts directory location** — `memory/facts/` under
   the existing memory tree, or separate surface?
3. **Conflict-row automation boundary** — CI-generated
   rows, or human-required fields for resolution?
4. **Archive boundary policy** — date-based (>90 days),
   count-based (keep 250 most-recent), relevance-scored
   (keep most-cited), or hybrid?
5. **Extraction granularity for mechanical backfill** —
   one fact per memory frontmatter, or mine the body
   for multi-fact patterns?

These are Phase 1 PR design decisions, not blockers for
the research-doc approval.

---

## Attribution

Amara (external AI maintainer) proposed the algorithm
Otto-67 (PR #221 ferry). Otto (loop-agent PM hat,
Otto-74) authored this design doc. Aaron's Otto-73
retractability-by-design insight grounds the schema's
supersession semantics. Kenji (Architect) queued for
synthesis on Phase 1 scope. Downstream implementation
follows this design across multiple PRs on the Amara
Determinize + Govern + Assure roadmap.
