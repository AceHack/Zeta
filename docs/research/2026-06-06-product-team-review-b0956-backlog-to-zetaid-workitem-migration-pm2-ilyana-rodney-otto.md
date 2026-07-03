# Product-team review — 081KSXN940008QG0R002FWR9B2 backlog → ZetaId WorkItem migration (PM-2 + Ilyana + Rodney, synthesised by Otto) — 2026-06-06

Scope: the design memo 081KSXN940008QG0R002FWR9B2 §"Substrate-honest framing" asks for ("file the design memo first; route the
schema through product-team agreement **before any bulk migration**"). Aaron 2026-06-06: *"route to product
team and get their input and make sure we are not forgetting anything before bulk migration; build what we
need to; we don't have to rush."* Three advisory reviewers ran in parallel; this is the synthesis +
decisions + the buildable slice. Reviewers: **PM-2** (product discovery), **Ilyana** (public-API/contract),
**Rodney** (complexity razor). All advisory; Architect/human integrates.

## Unanimous (all three converged — treat as decided)

1. **Incremental ALIAS-AND-KEEP, NOT big-bang.** The consensus-free benefit is **entirely at mint time**
   (new items). The 1116 legacy `B-NNNN` rows are *already* minted, collision-free, and stable slugs —
   rewriting them buys nothing (Rodney: accidental complexity), **orphans thousands of external `B-NNNN`
   references** in commits/PRs/memory/rules (PM-2), and risks a full **re-migration** if the id encoding
   later changes (Ilyana). Hold the line at 081KSXN940008QG0R002FWR9B2 §4; the risk is execution drifting toward the big-bang
   reading of "convert them all."

2. **First buildable slice = tooling, with ZERO row changes:**
   - `tools/backlog/new-workitem.ts` — local consensus-free `Category.WorkItem` ZetaId mint (this is the
     *whole essential move* — Rodney). Must **refuse to ever emit a `B-` form** (Ilyana).
   - a **frontmatter-schema lint** that subsumes/fixes the chronic `backlog-index-integrity` failure.
   - a **referential-integrity lint** (every `depends_on`/`composes_with` resolves to a real row) — run on
     today's 1116 first; it will likely surface existing dangling refs (PM-2).

3. **Root cause of the chronic `backlog-index-integrity` red — FOUND (PM-2) + RESOLVED 2026-06-06.** FOUR
   rows had **no YAML frontmatter** (`generate-index.ts` `extractField` emitted empty `[]()` titles → real
   rows invisible / descriptions lost on a naive regen): the P0 money-floor `081KT7YW00008QG0R002T1XNWT`, the P1 canonical-YAML
   `081KT7YW00008QG0R002T1XNWT`, `081KT7YW00008QG0R003N6PF8A`, `081KT7YW00008QG0R0019J8FSX`, `081KT7YW00008QG0R001DGZQKM`. There was also a **true duplicate id** — `081KT7YW00008QG0R002T1XNWT` used by both
   the P0 money-floor *and* the landed P1 canonical-YAML item. RESOLUTION (Aaron 2026-06-06, option B):
   frontmatter added to all four **preserving their committed descriptions** (titles), the dup resolved by
   **renumbering the money-floor → `081KT7YW00008QG0R003JV9D4J`** (the canonical-YAML keeps `081KT7YW00008QG0R002T1XNWT` — it's referenced as
   `081KT7YW00008QG0R002T1XNWT` in all 4 YAML serializers' code, so renumbering *it* would churn code). `BACKLOG.md` regenerated
   (`BACKLOG_WRITE_FORCE=1`) → `--check` green + duplicate-id audit clean; **no description lost** (verified
   no dropped ids, no empty titles). (`081KR50HA0008QG0R0002PGV1N` was already consistent — filename == frontmatter id.) The
   permanent fix going forward is a frontmatter-schema lint (step 1 below).

## The one genuine DIVERGENCE — filename / identity shape (Aaron's call; a one-way door)

| Option | Who | Shape | Trade |
|---|---|---|---|
| **A** | Ilyana | flat `workitems/<zetaid>.md`, ZetaId-only path; slug/title/priority in frontmatter; cross-refs by ZetaId (resolve to slug at render) | Most immutable handle (path never breaks on reword/retier). **But** requires the ZetaId string encoding LOCKED first (see blocker) + abandons the `P<n>/` tier layout + changes the generator's `B-`-prefix filter. |
| **B** | Rodney + (lean) Otto | keep `P<n>/<slug>.md`; **ZetaId in frontmatter ONLY** (new items); cross-refs stay slug; legacy untouched | Minimal churn, generator-compatible (no `B-` filter change if new slugs keep the prefix, else a ~3-line filter edit), **defers the filename one-way-door entirely** (ZetaId never in a filename → encoding-blocker is moot for paths). Delivers 100% of the consensus-free benefit. |
| **C** | PM-2 (hybrid) | legacy keep `B-NNNN-<slug>.md`; new items `<slug>.<zetaid-short>.md`; cross-refs by stable SLUG | Human-readable. **Ilyana rejects**: truncated ZetaId = collision surface; two contracts (mutable slug + immutable id) welded into one filename. |

**DECIDED: option A (Aaron 2026-06-06, the 500-agent collision test).** Aaron's deciding question: *"if we
have 500 agents committing to zeta [under option B], do they have a collision this way?"* — **yes, option B
collides at the FILENAME.** The ZetaId in frontmatter is collision-free (128-bit, locally minted), but
option B's filename is `P<n>/<slug>.md` and the **slug is title-derived — a shared human namespace**: two
of 500 concurrent agents filing similar items generate the same slug → same path → **git merge conflict**.
That is a *hidden consensus point on the slug* — the exact "incrementing-ids-are-a-hidden-consensus" pain
081KSXN940008QG0R002FWR9B2 exists to remove, merely relocated from the number to the slug. **Option A (`workitems/<zetaid>.md`)
makes the filename ITSELF the conflict-free key** → every agent writes its own **disjoint file** → no
shared path, no merge conflict, at any N. This is exactly the proven **081KSXN940008QG0R00171YAZW agent-bus G-Set property**
(disjoint ZetaId-keyed files, no-PR, conflict-free, cross-machine). My earlier "start with B" lean was
WRONG for the at-scale concurrent-create case — it optimized churn/readability and missed that the slug
filename is a consensus surface. **Filename = ZetaId.** Human-readability preserved via `slug` + `title`
frontmatter + a generated **`slug → zetaid` index** (navigate by slug; canonical file is ZetaId-named).
Cross-refs resolve by **ZetaId** (rename-proof; render to slug for humans); legacy `B-NNNN` refs stay
frozen slugs. **Consequence:** the 081KS3X9Y0008QG0R000W00V73 blocker hardens — the ZetaId string is now the filename, so its
encoding must be locked **and filename-safe** (case-fold-safe for APFS/NTFS; no `/`) before any mint.
(Option C stays rejected — truncated ZetaId reintroduces the collision.)

**Filename refinement (Aaron 2026-06-06): `workitems/<zetaid>-<description>.md`** — ZetaId PREFIX +
human-readable description suffix. Strictly better than bare `<zetaid>.md`: keeps collision-freedom (the
ZetaId prefix is the unique key — same description across agents still can't collide) and time-ordering
(sort is by the leading ZetaId), and ADDS human-readability in `ls`. **Lock:** lookups + cross-refs key on
the **ZetaId prefix** (glob `<zetaid>-*.md`), so a reworded description changes only the suffix, never the
identity — path stays resolvable (the proven Jekyll-post / ADR `NNNN-title.md` / Zettelkasten pattern). The
`<description>` must be filename-safe-sanitized (same charset constraint as the ZetaId).

**State-as-folder-location (Aaron 2026-06-06): completed items move to `workitems/done/`.** The lifecycle
state can be encoded by the file's FOLDER — active items in `workitems/`, completed ones moved under
`workitems/done/` (the same folder-as-attribute pattern the repo already uses: `P0/P1/P2` priority folders,
the agent-heartbeat folder, fast-lane-as-folders 081KSNY2Z0008QG0R000E5KTPX, pr-archive-on-merge). Benefits: the "backlog"
(open) view becomes a plain folder listing (no fold needed for the common open-vs-done split), and the
active working set stays lean at 1116+ scale. **Still conflict-free** — a state transition is a git RENAME
of a disjoint, ZetaId-prefixed file; each agent moves its OWN file, so no path collision even at 500 agents.
**Identity survives the move** — resolve cross-refs by **recursive** ZetaId-prefix glob
(`workitems/**/<zetaid>-*.md`); the ZetaId is stable wherever the file sits. Relationship to the
state-as-field model: **folder = coarse lifecycle bucket** (open vs done, maybe in-progress); **frontmatter
`state` carries the fine value** (in-progress/blocked/…) and the move IS a lifecycle event the DORA Bag-folds
see (created→done = lead time). Decide later which is canonical when they could disagree (likely:
folder for open/done routing, frontmatter `state` authoritative).

**Dated done-archive (Aaron 2026-06-06): `done/YYYY/MM/DD/<zetaid>-<description>.md`.** Otto's assessment
(asked "what do you think?"): **yes, at scale** — 500 agents completing items for years would pile
thousands into one `done/` dir (git + filesystem cost); date folders keep every dir small and make
completion-range queries (`done/2026/06/`) a path scan. Three refinements:

1. **Partition by COMPLETION date (the path), not creation.** The ZetaId prefix inside the filename still
   carries creation time → you get both axes (path = done-when; zetaid = created-when; the gap = how long
   it sat). Document that path date = completion.
2. **Only `done/` gets the tree; keep the active `workitems/` FLAT.** Active is the lean working set agents
   hit most, already ZetaId-sorted by creation; don't nest it.
3. **Keep a `zetaid → path` index** (extend the planned `slug → zetaid` index). The one real cost:
   completion-date is NOT derivable from the ZetaId, so by-id lookup of a done item otherwise needs a
   recursive glob over `done/**`. An index keeps cross-ref resolution O(1).
4. **Completion datetime in FRONTMATTER (Aaron 2026-06-06).** Path stays coarse (`done/YYYY/MM/`);
   frontmatter carries the *precise* completion datetime — which is what the DORA Bag-folds need
   (lead-time = created→done uses the exact timestamp, not the month bucket). Path = routing/browse,
   frontmatter = the real number.
5. **The done-index is INCREMENTAL + checked into git (Aaron 2026-06-06) — sound because done is
   IMMUTABLE.** A completed item never changes, so its index entry is append-only and never goes stale →
   safe to materialize the `done` index and commit it (no regeneration, no drift). This is DV2.0
   change-rate partitioning + idempotency: **done = zero-change-rate → a committed satellite**; appending
   an entry is idempotent. The ACTIVE set may stay fold-on-read (it churns), but the done index is
   frozen-per-entry → check it in.
Depth DECIDED: **`done/YYYY/MM/`** (agreed; not `/DD/` — revisit only if a month-dir gets large).
Conflict-freedom + identity-survives-move both still hold (disjoint per-file git rename; resolve via index
or `done/**/<zetaid>-*.md`).

**Third win for option A (Aaron 2026-06-06): free time-ordered lookup + ordering.** Because the ZetaId is
time-prefixed (081KSNY2Z0008QG0R000V24M7E targets the Snowflake/ULID family), a **lexicographic sort of the `workitems/<zetaid>.md`
filenames = chronological creation order** — `ls` sorted is day-ordered, and "items from day D" is a
filename **prefix range-scan**, no separate time index. This is a property only option A gives (slug
filenames sort alphabetically, meaninglessly). **It adds a hard requirement on 081KS3X9Y0008QG0R000W00V73:** the canonical
string encoding must be **sort-preserving** — time in the high bits, big-endian, and a lexicographically-
monotonic alphabet (e.g. Crockford base32 like ULID, or zero-padded hex) so byte/string sort == time sort.

## Lock-before-any-ZetaId-persists (one-way doors — Ilyana)

1. **ZetaId canonical string encoding — HARD BLOCKER (081KS3X9Y0008QG0R000W00V73, currently P2/open).** The impl
   (`src/Core.TypeScript/zeta-id/zeta-id.ts`) has **no `format()`/`parse()`** — only an ad-hoc
   `toString(16).padStart(32,"0")` in `cross-verify.ts:117`. The moment a ZetaId is persisted as a string
   (frontmatter `id`, a cross-ref, or a filename) **that encoding is frozen**. **Promote 081KS3X9Y0008QG0R000W00V73 P2→P1,
   resolve it (case-fold-safe for filenames; endianness; base), and ship `format`/`parse` in the impl
   before the mint tool persists any ZetaId.** (Under option B this only needs to be stable for the
   frontmatter `id` string; under A it also freezes every path — another reason B is lower-risk now.)
2. **B-NNNN = permanent append-only alias** (G-Set; never reuse/reassign). New rows carry `legacy:` only
   if migrated; the mint tool never emits `B-`. A reference that resolved once resolves forever (MPG /
   idempotency applied to identity).
3. **Frontmatter field NAMES** (cheap to add fields, expensive to rename): `id` (zetaid string; prefer
   `id` over `zetaid`), `legacy` (B-NNNN alias), `type ∈ {task,bug}`, `state ∈ {backlog,in-progress,done,
   closed}`, `slug`, `title`, `depends_on`, `composes_with`. **Reject `notes` in frontmatter** — code/shape
   is `observations`; "notes" is a UX-only label (Aaron 2026-06-06).

## Don't-forget list (only bites post-migration)

- **Sub-id parent/decomposition** (`081KSNY2Z0008QG0R000E5KTPX`, `081KRA5AR0008QG0R002X77BEB`) encodes umbrella→child structure a flat
  ZetaId throws away — model as a `parent:` field, don't lose it (PM-2).
- **DORA folds need `created`/`done` timestamp discipline** — frontmatter dates are inconsistent; lint them
  (PM-2).
- **External inbound refs** (commits/PRs/memory/rules cite `B-NNNN` in prose) — alias-and-keep protects
  these; big-bang would orphan thousands (strongest single argument for incremental).
- **Is the index-drift fix bundled or separate?** Rodney: **separate + smaller** (it's a governance flip —
  whether `BACKLOG.md` monolith or the generated index is authoritative; CI skips the equivalence check
  until "Phase 2" by design). PM-2: the migration should subsume the integrity check. **Reconciliation:**
  fix the *data bugs* (081KT7YW00008QG0R002T1XNWT frontmatter, 081KR50HA0008QG0R0002PGV1N id) + add the frontmatter lint NOW (small, separable);
  defer the monolith-vs-generated authority flip as its own decision.
- **Loop-ins when building:** Viktor (no behavioural spec for the alias-resolution rule or mint output —
  spec-before-code), Mateo (`parse(s)` is a new untrusted-string deserialization path: filenames/refs →
  ZetaId).

## Proposed buildable order (no rush; each step independently valuable, no row rewrites)

1. Fix the two data bugs (081KT7YW00008QG0R002T1XNWT missing frontmatter, 081KR50HA0008QG0R0002PGV1N id mismatch) + add a **frontmatter-schema
   lint** → clears the chronic `backlog-index-integrity` red. (separable, small)
2. Add a **referential-integrity lint**; run on the 1116, fix any dangling refs surfaced.
3. Resolve **081KS3X9Y0008QG0R000W00V73** (promote P1) + ship **filename-safe** `format()`/`parse()` in the ZetaId impl
   (case-fold-safe for APFS/NTFS; no `/`) — REQUIRED because the ZetaId string is now the filename (option A).
4. Build **`tools/backlog/new-workitem.ts`** (local mint; writes **`workitems/<zetaid>-<description>.md`** —
   ZetaId prefix = the conflict-free + time-sortable key, description suffix = human-readable;
   `id`+`type`+`state`+`slug`+`title`+cross-refs frontmatter; refuses `B-`). Lookups/cross-refs resolve by
   ZetaId-prefix glob (`<zetaid>-*.md`), so reword is safe. New items ZetaId-keyed/named from here; legacy
   1116 stay `B-NNNN` slugs forever (alias-and-keep).
5. (Deferred / optional) any bulk legacy rewrite of the 1116 → `workitems/<zetaid>-<description>.md` — only
   if it ever earns its way; not needed for the 500-agent conflict-free-create property (delivered at step 4).

Pointer added from 081KSXN940008QG0R002FWR9B2. Reviewers' full findings are in their agent outputs (this synthesis is the
durable artifact).
