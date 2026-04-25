# PR-preservation drain patterns — recurring findings across the corpus

**Status:** synthesis index, growing as new drain-logs land.
**Audience:** future drain-runners, reviewers calibrating severity,
authors avoiding common findings at write-time.
**Source corpus:** all `docs/pr-preservation/*-drain-log.md` files
(currently 27+ logs across 2026-04-22 through 2026-04-25).

This file indexes the recurring patterns across the per-PR drain
logs so the training signal Otto-250 identified is queryable rather
than scattered. Per-PR logs preserve verbatim reviewer text + outcome
class + resolution path; this file abstracts over them to surface
the patterns that compound across PRs.

---

## Outcome-class taxonomy (4 stable + 1 mixed)

The drain corpus has converged on four stable outcome classes plus
combinations:

1. **FIX** — apply the suggested change; reviewer's finding is correct
   and the fix improves the artifact.
2. **STALE-RESOLVED-BY-REALITY** — the doc claim was inaccurate when
   the review was filed but is accurate now (forward-mirror landed,
   adjacent PR fixed it, current main has the cited file). Reply
   pattern: verify-with-evidence + resolve, not re-fix.
3. **OTTO-279 SURFACE-CLASS** — the finding applies a rule that has a
   carve-out for the relevant surface (research / decisions /
   round-history / aurora-archive / pr-preservation are history-class
   surfaces; first-name attribution allowed there). Reply is a one-
   paragraph stamp citing Otto-279 + surface class + provenance-vs-
   policy distinction.
4. **DEFERRED-TO-MAINTAINER** — the finding is correct against the
   stated rule but applying it would lose meaning (e.g., bootstrap/
   docs documenting the maintainer's personal framework where by-name
   attribution is faithful representation, not arbitrary labeling).
   Reply acknowledges + surfaces tension + escalates without blocking
   the merge gate.
5. **VERBATIM-PRESERVATION DECLINED (Otto-227)** — the finding sits
   inside verbatim-preserved ferry content (Amara absorb / external
   import). Editing would violate Otto-227 signal-in-signal-out
   discipline. Brittleness valid as future-implementation work, not
   absorb-edit work.

Mixed outcomes (FIX + STALE-RESOLVED-BY-REALITY for combined
findings, etc.) are also common.

---

## Recurring findings classes

### Inline-code-span line-wrap rendering bug

Observed on: #191, #195, #219 (4 threads alone), #423.

Pattern: file paths inside backtick spans split across newlines render
as two adjacent code spans rather than one path, breaking copy/paste
and pointer-integrity audits.

Fix template: reflow to single-line code spans, or convert to a
markdown link with `[memory/path/file.md](../../memory/path/file.md)`
shape.

**Pre-commit-lint candidate**: regex check for backtick spans crossing
newlines.

### Memory-file dangling citation (forward-mirror compounding fix)

Observed on: #135 (8 threads), #195 (6 threads), #219 (3 threads),
#235 (3 threads), #377 (5 threads), #206 (multiple). At least 25
threads across the corpus.

Pattern: research/aurora docs cite memory files that don't exist in
`memory/` at review time but landed via Otto-114 forward-mirror by
drain time.

Fix template: STALE-RESOLVED-BY-REALITY reply with `ls memory/<file>`
verification. The substrate fix (Otto-114) converted what would have
been 25+ per-doc fixes into a one-line verify-and-resolve. **Highest-
leverage compounding fix in the corpus.**

### Subset-vs-superset framing errors

Observed on: #206 (K-relations: rings ARE semirings; GKT homomorphism:
positive relational algebra IS a subset), #135 (DORA canonical
definitions: deployments not commits; ratio not raw count).

Pattern: claim asserts a property over a broad class but the property
holds only for a narrower subset (or vice versa).

Fix template: identify the precision-restricting condition; reword to
explicitly scope the claim. "Pure-semiring-without-additive-inverses"
distinguishes from rings cleanly; "positive relational algebra"
distinguishes from full relational algebra cleanly.

**Codex catches this class reliably across math/research docs.**

### Cross-reference column-name accuracy

Observed on: #206 (TECH-RADAR "11" in Round column not Ring column),
#85 (line count drift 5,957 vs 6,094).

Pattern: doc cross-references a table cell by column name but the
source-table evolved + the cited column name no longer matches.

Fix template: parse referenced table headers + verify cited column.
For volatile counts, use order-of-magnitude approximations + drift-
tolerance notes.

**Future doc-lint candidate.**

### Implementation-vs-math-definition tension

Observed on: #206 (Tropical math is `ℝ ∪ {+∞}`; Zeta uses
`ℤ ∪ {+∞}` via `int64`), other algebra docs.

Pattern: textbook formalization is broader than the implementation
pin.

Fix template: name the implementation-version explicitly, note the
math-definition-extends-to-broader-set with explicit pointer.
Captures both the math content + the engineering choice without
losing either.

### Phase-numbering / count-vs-surface-list cardinality

Observed on: #219 ("fifth phase" + "Phase 6" + 5 listed phases),
#191 ("18 audits" + 8 actual audit sections).

Pattern: a count claim doesn't match the cardinality of the surface
list it summarizes.

Fix template: sum the actual list, update the count, or rename the
heading to scope explicitly.

**Future doc-lint candidate**: claim-vs-list cardinality check.

### Line-leading list-marker confusion (markdownlint MD032)

Observed on: #377 (`+ manifest files` continuation), #195
(`+ Kenji (Architect)` owner-list continuation), #235 + #219
(Amara verbatim ferry content with `+ git history` / `- [link]`
continuation lines). PR #280's research-doc fix (commit
`cce1df2`) is a same-class instance — `+ provenance-aware
scoring` continuation reflowed at write-time before any
drain-log was filed for #280, so the citation here is to the
fix-commit rather than to a per-PR drain log. 5 instances in
one tick (2026-04-25).

Pattern: line wrap in multi-line prose / inline-bold spans /
multi-author lists hits a CommonMark special character (`+`,
`-`, `*`, `1.`) at line start. Markdownlint MD032 sees the
wrap-line as a list-item start and complains about missing
blank-line separators. The author intent is paragraph
continuation; the parser sees a new list.

Decision tree:

- **Author-controlled prose** (#377, #280, #195) — reflow
  inline by extending the prior line, switching to
  comma-separator (`A + B + C` → `A, B, C`), or replacing
  `+` with `plus`. Fix the rendering, preserve the meaning.
- **Verbatim ferry / courier content** (#235, #219) — Otto-227
  forbids editing the verbatim text. Add the surface to the
  markdownlint ignore list (precedent: `docs/aurora/**`,
  `docs/amara-full-conversation/**`). Config-PR fix unblocks
  every downstream PR touching the same surface in one shot.

**Pre-commit-lint candidate**: the repo already has
`tools/hygiene/audit-md032-plus-linestart.sh` covering the
`+`-at-line-start case. The new work here is either (a)
extending that audit to `- ` / `* ` in the same
non-list paragraph-continuation context, or (b) promoting
the audit from detect-only hygiene to pre-commit
enforcement. Same general failure mode as the
"Inline-code-span line-wrap rendering bug" class above
(line-wrap hits a CommonMark special character and the
parser reads it as a structural marker instead of prose
continuation).

### External-source verifiability gaps

Observed on: #219 (OpenAI help-center / DBSP paper / provenance-
semiring paper without resolvable identifiers), #231 (parity-matrix
claims without release-notes citations).

Pattern: research doc cites prior art without URLs / arXiv IDs /
DOIs / specific release-notes references.

Fix template: add resolvable citations one-line-each. Converts
"grounded somewhere" into "reviewers can verify."

**Future skill or pre-commit lint candidate.**

### Internal-consistency drift on draft ADRs

Observed on: #85 (5 of 7 fixes were self-reference inconsistencies:
tier-scheme-vs-tree, id-vs-filename, contradiction, claimed-as-
existing, PR-description-vs-ADR).

Pattern: draft ADRs evolve their own self-references during authoring;
reorganizations don't propagate uniformly to all cross-references.

Fix template: pick canonical wording in one place, sweep references
for consistency before merge. Reviewers reliably catch the
accumulated drift.

### Discriminator falsification

Observed on: #231 (AGENTS.md-read test relying on values repeated in
same doc — false-positive readiness path).

Pattern: a test or check uses content that's available in the test's
own surface, so passing the test doesn't prove what it's intended to
prove.

Fix template: pick unique-to-target content. Same shape as
randomized-canary in security testing.

### Forward-author-to-future-state-of-main drift

Observed on: #377 (38% stale-resolved density), #135 (66% stale-
resolved-by-reality on memory citations).

Pattern: research doc forward-authors against a future state of main
that adjacent PRs land during the review window, producing high
stale-resolved density.

Fix template: STALE-RESOLVED-BY-REALITY reply pattern + verify against
current main. The pattern is high-leverage: research docs naturally
describe the post-review-window state.

### Self-induced cascade

Observed on: #435 (wave-1 fix introduced wave-2 finding — "separate
BACKLOG items" plural vs actual single-row state).

Pattern: when fixing a claim, the new claim itself is also
inaccurate against current-state.

Fix template: don't just remove the bad claim; replace it with a
verified-from-grep claim. Verify-the-fix-itself is the discipline.

---

## Cross-reviewer convergence as a quality signal

Observed on: #432 (`warn` unbound: Codex P1 + Copilot P0), #206
(K-relations retraction: Codex P2 + Copilot P1), #435 (FACTORY-HYGIENE
row: Codex P2 + Copilot P1).

Pattern: when two unrelated reviewers converge on the same finding
with high confidence, the prior on "real bug" goes way up. Severity
typically differs (e.g., P0 vs P1) because reviewers weight common-
case-paths differently.

This is the strongest single quality signal in the drain corpus and
worth preserving as a reviewer-roster property — Codex + Copilot
fire on different surfaces (Codex strong on shell, math, security;
Copilot strong on design-spec, formatting, broken-link refs); their
overlap is a high-precision finding region.

## Per-PR reviewer-coverage signal

Observed on: #434 (Copilot-only on design-spec text; Codex silent),
#432 (both fired heavily on shell-portability), #206 (both fired
heavily on math content).

Pattern: Codex tends to fire on shell scripts, math docs, security
threat models, research-grade content with citations to verify.
Copilot tends to fire on design-spec text, formatting/grammar,
broken-link references, schema-vs-doc consistency. Different
surfaces produce different reviewer coverage.

Could inform per-PR reviewer-selection or per-finding severity-
weighting. **Future tooling/triage candidate.**

## Post-merge reviewer-cascade

Observed on: #135 (10 + 4 = 14 across 2 waves), #231 (2 + 1 + 3 + 2 =
9 across 4 waves), #432 (7 first-wave only, no cascade), #435 (2 +
1 = 3 across 2 waves).

Pattern: every commit on a PR triggers a fresh Codex/Copilot review
wave. Wave-by-wave the findings shift class: structural → rendering
→ internal-consistency → version-currency. The cascade is a property
of the merge-trigger surface, not per-PR oddity.

4 of 7 cascade-PRs in the 2026-04-25 session followed wave-1 +
wave-2 cascade pattern.

## Post-merge cascade triggering version-currency on the doc

Observed on: #231 (Wave 4 reclassifications — TodoWrite Sept 15 2025;
Hooks `rust-v0.117.0` March 26 2026).

Pattern: Codex enforces version-currency on the doc's own claims via
release-notes citations. This is the inverse of CLAUDE.md's author-
side version-currency rule. Bidirectional drift correction:
author-side searches at write-time + reviewer-side enforces against
new releases at review-time.

Score-summary propagation (Parity 10→11, Gap 4→3 on #231) is
load-bearing — without it the matrix's running counts drift from
the row data.

---

## Surface-class taxonomy (where rules apply / don't apply)

**History-class surfaces (Otto-279)** — first-name attribution
permitted; preserves provenance:

- `docs/research/**`
- `docs/DECISIONS/**`
- `docs/ROUND-HISTORY.md`
- `docs/aurora/**`
- `docs/pr-preservation/*-drain-log.md` (per-log records;
  `_patterns.md` is the synthesis-over-history exception per
  the section below)
- `memory/**` (out-of-scope for code-style rules anyway)

**Current-state-class surfaces** — role-ref discipline applies; no
first-name attribution:

- Skill bodies (`.claude/skills/**/SKILL.md`)
- Code (`src/**`, `tools/**`, `tests/**`)
- README, public-facing prose
- Behavioural docs, threat models
- Spec docs (`docs/**` not in history-class above)

**Synthesis-over-history surfaces** — current-state-tracking
abstractions over history-class corpora; reflect current state
not historical sequence:

- `docs/pr-preservation/_patterns.md` (this file) —
  synthesis-index over the per-PR drain-log corpus. Edited as
  new logs land + patterns surface; should reflect current
  corpus state. Underscore-prefix candidate convention for
  "synthesis-indices over history-class corpora" co-located
  with the corpus.

**Tension surfaces** — both apply; defer to maintainer:

- `docs/bootstrap/**` (#195) — current-state operational substrate
  AND maintainer's personal framework documentation simultaneously.
- `docs/craft/**` Attribution sections (#206) — current-state
  operational substrate AND PR-level provenance simultaneously.

The **Otto-279 history-vs-current-state carve-out is mature enough
to codify in `docs/AGENT-BEST-PRACTICES.md` as a stable BP-NN rule.**
Tension surfaces need either a third surface class or explicit
carve-out within current-state. Synthesis-over-history is now
named as a third class that's distinct from both pure history-
class and pure current-state.

---

## Fixes-to-substrate that compound across the corpus

These are the structural changes that converted per-doc fix-toil
into one-line stale-resolved-by-reality replies:

1. **Otto-114 forward-mirror** — Anthropic AutoMemory mirrored to
   in-repo `memory/` tree. Converts 25+ memory-file-dangling
   findings across the corpus into verify-with-`ls`-and-resolve.
2. **Otto-279 surface-class refinement** — history-vs-current-state
   carve-out for first-name attribution. Converts every "Aaron
   appears in research surface" finding into a one-paragraph stamp
   reply citing the surface class.
3. **Auto-merge SQUASH armed by default** (Otto-224) — drain-author
   doesn't need to manually merge after CI clears.
4. **Otto-227 verbatim-preservation discipline** — absorb docs
   (Amara ferries) carry an explicit non-edit boundary. Converts
   "brittleness in proposed validation" findings inside verbatim
   ferry content into VERBATIM-PRESERVATION DECLINED replies
   (#235, also second-wave on same PR).
5. **Otto-236 reply+resolve always paired** — every thread ends
   resolved (branch-protection requires it), so even DEFERRED-TO-
   MAINTAINER replies close the merge-gate.

---

## Open patterns / future-work candidates

- **Pre-commit lint for inline-code-span line-wrap** (most-recurring
  formatting bug in the corpus).
- **Doc-lint for claim-vs-list cardinality** (catches phase-numbering
  + audit-count drift).
- **Doc-lint for unresolvable external-source references** (research
  docs without URLs / arXiv IDs / DOIs).
- **`_patterns.md` self-update** — when a new drain-log lands, add
  any new pattern here + cite the log.
- **Promote Otto-279 to BP-NN-stable-rule** in
  `docs/AGENT-BEST-PRACTICES.md` (currently memory-only).
- **Tension-surface third class or carve-out** for bootstrap/ +
  craft/ Attribution sections.
- **Per-PR reviewer-coverage routing** (Codex vs Copilot strengths
  on different surfaces — informs per-finding severity-weighting).

---

## Known divergence: drain-log shape (Otto-250 canonical vs Otto-268 abbreviated)

The drain-log corpus has two co-existing shapes:

**Canonical Otto-250 shape** (used in older drain-logs like
`108-drain-log.md`, `247-drain-log.md`):

```markdown
## Thread N — `path/file.md:LINE` — heading

- Reviewer: <handle>
- Thread ID: `PRRT_...`
- Severity: P0/P1/P2

### Original comment (verbatim)

> verbatim quote of reviewer's full text

### Outcome — FIX / STALE-RESOLVED-BY-REALITY / ...

Discussion + commit SHA where fix landed.

### Reply (verbatim)

> verbatim quote of the reply that resolved the thread.
```

**Abbreviated Otto-268 shape** (used across the 2026-04-25 backfill
wave; in-tree examples at `docs/pr-preservation/421-drain-log.md`,
`docs/pr-preservation/422-drain-log.md`,
`docs/pr-preservation/423-drain-log.md`):

```markdown
### Thread N — short description

- Reviewer: <handle>
- Severity: P0/P1/P2
- Finding: short prose summary of the reviewer's concern.
- Outcome: **CLASS** — short prose explanation. Commit `SHA`.
```

The abbreviated shape preserves key metadata (reviewer, severity,
outcome class, commit SHA) and a paraphrased Finding bullet, but
verbatim original-comment + verbatim reply text are NOT preserved.
Multi-section structure, file:line locator, and Thread ID are also
typically omitted vs the canonical Otto-250 shape.

**Maintainer-decision pending** — three options:

(a) **Rewrite** the abbreviated-shape drain-logs from the
2026-04-25 backfill wave to canonical shape with verbatim
reviewer/reply. Highest faithfulness; high churn (~5-8 hours).

(b) **Accept divergence** — document both shapes here as valid
(this section); keep abbreviated shape for low-thread-count or
bulk-backfill logs; use canonical for high-thread-count or
substantive drains where verbatim preservation pays back.

(c) **Hybrid** — backfill canonical shape only for the
highest-substantive logs (#206 math content, #268 BLAKE3
crypto-protocol, #226 algorithm spec, #85 ADR draft) where
verbatim training-signal value is highest; leave low-substance
logs in abbreviated shape.

This file is the synthesis-index where the maintainer-decision
should land + propagate via the canonical reference. Until
then, drain-runners writing future logs should default to
canonical shape; existing Otto-268-wave logs stay
abbreviated-with-this-known-divergence-note.

---

## How to update this file

When a new drain-log lands in `docs/pr-preservation/`:

1. Read the new log's "Pattern observations" section.
2. For each observation:
   - If it matches an existing pattern here, add a citation
     (`Observed on: ... ; #NNN`).
   - If it's a new pattern, add a section under "Recurring findings
     classes" with a name, pattern description, fix template, and
     observation citations.
3. If an outcome class needs renaming or a tension surface gets a
   maintainer-decision, update the taxonomy sections.

This file is a **synthesis-index over a history-class corpus** —
the per-PR `*-drain-log.md` files in this directory are the
history-class records (preserve names, point-in-time records,
provenance, Otto-279 carve-out applies), and this `_patterns.md`
is the current-state-tracking abstraction over them. The two
surface classes coexist in the same directory by design:

- `docs/pr-preservation/*-drain-log.md` — **history-class** per-PR
  records (per the surface-class taxonomy above; Otto-279 carve-out
  applies; first-name attribution preserves provenance).
- `docs/pr-preservation/_patterns.md` (this file) —
  **current-state synthesis-index** that should reflect the
  corpus state, not the historical sequence in which patterns
  were discovered. This is a third surface class —
  *synthesis-over-history* — distinct from both pure
  history-class and pure current-state surfaces.

The directory-level surface-class declaration in the
"Surface-class taxonomy" section above applies to the per-log
records (the per-log glob `docs/pr-preservation/*-drain-log.md`);
the index file is explicitly carved out as a synthesis-index.
The underscore prefix (`_patterns.md`) is a candidate
naming convention for "synthesis-indices over history-class
corpora" — when the convention matures, it could be promoted to
a named pattern itself.

## Reference patterns

- `docs/pr-preservation/*-drain-log.md` — the per-PR training-signal
  records this index abstracts over.
- `memory/feedback_pr_reviews_are_training_signals_*.md` — Otto-250
  framing of the discipline.
- `docs/AGENT-BEST-PRACTICES.md` — where BP-NN-stable-rule promotions
  land if/when the four stable outcome classes + history-class
  surfaces get codified.
