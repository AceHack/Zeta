---
name: Orthogonal-axes factory hygiene — the axis set must form an orthogonal basis
description: Aaron 2026-04-22 rule — every pair of factory classification axes (skill-category, hygiene-scope, persona-surface, cadence-bucket, memory-type, review-target, trust-tier, …) must be independent. Overlap = rank-reduction and duplicate naming. Cadenced audit every 5-10 rounds, FACTORY-HYGIENE row #41.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Rule:** The factory's classification axes must form an
**orthogonal basis** (linear-algebra sense). Every pair of
axes must be independent — each axis's values carry
information no other axis carries. Overlap between two axes
is rank-reduction: one axis is a rotation of the other and
could be dropped without information loss.

**Why:** Aaron 2026-04-22 message, quoted in full so the
why stays alongside the rule:

> "also we need to make sure all our axises are orthogaonal
> to the others so therre is not overlap, like fully When
> all your axes are orthogonal basis covered (meaning they
> are mutually perpendicular), the set of axes is called an
> orthogonal basis."
>
> "i guess this is a cadence thing"
>
> "backlog"

The invocation of "orthogonal basis" is explicit
linear-algebra language. The factory *already* uses
multiple axes to classify work — skill-category (capability
/ persona / hat), hygiene-scope (project / factory / both),
persona-surface (author / reviewer / auditor / cadence-runner),
cadence-bucket (session-open / round-open / round-close /
weekly / per-event), memory-type (user / feedback / project /
reference), review-target (proposed / shipped / retired),
trust-tier (autonomous / advisory / binding) — and the
discipline keeps them usable by keeping each axis distinct.
When two axes drift into overlap, the classification stops
carrying information: we have two names for the same thing.

**Distinct from the symmetry audit** (FACTORY-HYGIENE row
#22). Symmetry asks *"is A paired with its mirror B?"*;
orthogonality asks *"do axes A and B have zero overlap?"*
Symmetry is bilateral mirror-pairing; orthogonality is
mutual independence in an N-dimensional basis. A factory can
be symmetric on every named pair and still have two axes
that collapse into each other. The two audits catch
different failure modes.

**How to apply:**

1. **On new axis proposals.** Whenever an agent proposes a
   new classification dimension (new memory-type, new
   review-target, new hygiene-scope value, new skill-kind),
   check pairwise against existing axes: could the new axis
   be expressed as a function of an existing axis? If yes,
   fold it into the existing axis as a new value rather than
   standing up a new axis. If no, document what
   information it adds that no existing axis carries.

2. **On absorbing new rules or memories.** When writing a
   new feedback-memory, project-memory, or skill, pick the
   classification tag that lives on the *most specific* axis
   whose value is distinct from every other axis's current
   value-set. Duplicate tags across axes = orthogonality
   drift.

3. **On cadenced audit (every 5-10 rounds).** Per
   FACTORY-HYGIENE row #41: enumerate current factory axes,
   build pairwise overlap matrix, per-pair verdict of
   collapse / keep-and-document / split. Load-bearing
   overlap (e.g. hygiene-scope and review-target overlap
   deliberately because some projects distinguish and some
   don't) must be explicitly documented as such; undocumented
   overlap is drift.

4. **Drift-sign table** — what the auditor looks for:
   - A new skill classifiable identically on two axes
     (collapsing them).
   - A proposed distinction in docs that maps one-to-one to
     an existing distinction (duplicate naming).
   - A taxonomy row in one doc that duplicates a taxonomy
     row in another (HYGIENE row vs. BACKLOG row vs.
     feedback-memory rule).
   - An axis whose values are all determined by another
     axis's values (rank-deficiency).

5. **When to keep non-orthogonal axes.** Load-bearing
   overlap is allowed — *if documented*. For example:
   hygiene-scope (`project` / `factory` / `both`) and
   adopter-visibility (shipped to project-under-construction
   yes / no) overlap because the adopter-visibility is
   mostly determined by scope. The overlap is kept because
   the adopter-facing read is a different consumer-surface
   than the maintainer-facing read. That's a judgment call
   and belongs in the audit doc when the pair is reviewed.

**Routing:** Findings go to `docs/research/` as an audit doc
per cycle, with overlap matrix + per-pair verdict.
HUMAN-BACKLOG rows as `axis-overlap` for P1+ findings that
need Aaron's decision (collapse vs. keep-and-document).
BACKLOG rows for candidate axis collapses that the factory
can land without human resolution.

**Interaction with existing skills:**

- **`skill-tune-up`** — criterion #7 (portability drift)
  already tests axis-correctness for the `project:` frontmatter
  axis. This rule extends that thinking factory-wide.
  Option-a for landing is fold orthogonality-check into
  skill-tune-up as criterion #8. Option-b is a dedicated
  `orthogonal-axes-auditor` capability skill.
- **Symmetry audit (row #22)** — different question, same
  cadence. Run in the same round-block to share context
  overhead.
- **Missing-hygiene-class gap-finder (row #23)** — this rule
  *is* one such missing class, now landed as row #41. The
  gap-finder surfaced it implicitly via Aaron's direct ask.

**Source:** Aaron direct message 2026-04-22 during
fork-PR-workflow test (PR #49 batch 1 of 6 speculative
drain). Triple-message thread: the rule, the cadence
realization, the backlog directive. Filed to
`docs/FACTORY-HYGIENE.md` row #41 and
`docs/BACKLOG.md` P1 row in the same turn.
