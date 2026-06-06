# Product-team review — B-0956 backlog → ZetaId WorkItem migration (PM-2 + Ilyana + Rodney, synthesised by Otto) — 2026-06-06

Scope: the design memo B-0956 §"Substrate-honest framing" asks for ("file the design memo first; route the
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
   later changes (Ilyana). Hold the line at B-0956 §4; the risk is execution drifting toward the big-bang
   reading of "convert them all."

2. **First buildable slice = tooling, with ZERO row changes:**
   - `tools/backlog/new-workitem.ts` — local consensus-free `Category.WorkItem` ZetaId mint (this is the
     *whole essential move* — Rodney). Must **refuse to ever emit a `B-` form** (Ilyana).
   - a **frontmatter-schema lint** that subsumes/fixes the chronic `backlog-index-integrity` failure.
   - a **referential-integrity lint** (every `depends_on`/`composes_with` resolves to a real row) — run on
     today's 1116 first; it will likely surface existing dangling refs (PM-2).

3. **Root cause of the chronic `backlog-index-integrity` red — FOUND (PM-2):** `docs/backlog/P0/B-1016-*.md`
   has **no YAML frontmatter** (body starts with `#`), so `generate-index.ts` (`extractField`, ~L90-110)
   emits an empty `[]()` id+title — a real row invisible to every fold. Plus `B-0366.2-*.md` filename
   disagrees with its frontmatter `id: B-0366.2.1`. **These are real data bugs to fix regardless of the
   migration**, and the frontmatter-schema lint is what catches them going forward.

## The one genuine DIVERGENCE — filename / identity shape (Aaron's call; a one-way door)

| Option | Who | Shape | Trade |
|---|---|---|---|
| **A** | Ilyana | flat `workitems/<zetaid>.md`, ZetaId-only path; slug/title/priority in frontmatter; cross-refs by ZetaId (resolve to slug at render) | Most immutable handle (path never breaks on reword/retier). **But** requires the ZetaId string encoding LOCKED first (see blocker) + abandons the `P<n>/` tier layout + changes the generator's `B-`-prefix filter. |
| **B** | Rodney + (lean) Otto | keep `P<n>/<slug>.md`; **ZetaId in frontmatter ONLY** (new items); cross-refs stay slug; legacy untouched | Minimal churn, generator-compatible (no `B-` filter change if new slugs keep the prefix, else a ~3-line filter edit), **defers the filename one-way-door entirely** (ZetaId never in a filename → encoding-blocker is moot for paths). Delivers 100% of the consensus-free benefit. |
| **C** | PM-2 (hybrid) | legacy keep `B-NNNN-<slug>.md`; new items `<slug>.<zetaid-short>.md`; cross-refs by stable SLUG | Human-readable. **Ilyana rejects**: truncated ZetaId = collision surface; two contracts (mutable slug + immutable id) welded into one filename. |

**Otto's recommendation: start with B** — it's the minimal essential path (Rodney's razor + Aaron's
"no rush / it's just markdown in git" ethos), delivers the full mint benefit now, and **keeps the
filename-as-ZetaId decision (A) as a separate, later, reversible step** if the immutability ever pays for
itself. Cross-refs: Ilyana argues ZetaId (rename-proof), PM-2 argues slug (human-followable); under B,
**legacy cross-refs stay `B-NNNN` slugs (frozen, fine) and new cross-refs can be either** — punt until the
mint tool exists and we see real usage.

## Lock-before-any-ZetaId-persists (one-way doors — Ilyana)

1. **ZetaId canonical string encoding — HARD BLOCKER (B-0682, currently P2/open).** The impl
   (`src/Core.TypeScript/zeta-id/zeta-id.ts`) has **no `format()`/`parse()`** — only an ad-hoc
   `toString(16).padStart(32,"0")` in `cross-verify.ts:117`. The moment a ZetaId is persisted as a string
   (frontmatter `id`, a cross-ref, or a filename) **that encoding is frozen**. **Promote B-0682 P2→P1,
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

- **Sub-id parent/decomposition** (`B-0890.1`, `B-0366.2.1`) encodes umbrella→child structure a flat
  ZetaId throws away — model as a `parent:` field, don't lose it (PM-2).
- **DORA folds need `created`/`done` timestamp discipline** — frontmatter dates are inconsistent; lint them
  (PM-2).
- **External inbound refs** (commits/PRs/memory/rules cite `B-NNNN` in prose) — alias-and-keep protects
  these; big-bang would orphan thousands (strongest single argument for incremental).
- **Is the index-drift fix bundled or separate?** Rodney: **separate + smaller** (it's a governance flip —
  whether `BACKLOG.md` monolith or the generated index is authoritative; CI skips the equivalence check
  until "Phase 2" by design). PM-2: the migration should subsume the integrity check. **Reconciliation:**
  fix the *data bugs* (B-1016 frontmatter, B-0366.2 id) + add the frontmatter lint NOW (small, separable);
  defer the monolith-vs-generated authority flip as its own decision.
- **Loop-ins when building:** Viktor (no behavioural spec for the alias-resolution rule or mint output —
  spec-before-code), Mateo (`parse(s)` is a new untrusted-string deserialization path: filenames/refs →
  ZetaId).

## Proposed buildable order (no rush; each step independently valuable, no row rewrites)

1. Fix the two data bugs (B-1016 missing frontmatter, B-0366.2 id mismatch) + add a **frontmatter-schema
   lint** → clears the chronic `backlog-index-integrity` red. (separable, small)
2. Add a **referential-integrity lint**; run on the 1116, fix any dangling refs surfaced.
3. Resolve **B-0682** (promote P1) + ship `format()`/`parse()` in the ZetaId impl.
4. Build **`tools/backlog/new-workitem.ts`** (local mint; `id`+`type`+`state`+`slug`+`title` frontmatter;
   refuses `B-`). New items ZetaId-keyed from here; legacy 1116 stay B-NNNN forever.
5. (Deferred / optional) the filename-as-ZetaId shape (option A) + any bulk legacy rewrite — only if it
   ever earns its way.

Pointer added from B-0956. Reviewers' full findings are in their agent outputs (this synthesis is the
durable artifact).
