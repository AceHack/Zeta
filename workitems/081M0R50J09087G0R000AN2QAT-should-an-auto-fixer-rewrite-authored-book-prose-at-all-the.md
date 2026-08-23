---
id: 081M0R50J09087G0R000AN2QAT
type: task
state: backlog
priority: P2
slug: should-an-auto-fixer-rewrite-authored-book-prose-at-all-the
title: "should an auto-fixer rewrite authored book prose at all — the standing question the healer defect raised"
created: 2026-08-23T20:29:22.825Z
depends_on: []
composes_with: []
---

# should an auto-fixer rewrite authored book prose at all — the standing question the healer defect raised

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R50J09087G0R000AN2QAT-*.md` glob. -->

## Where this came from

081M0QZF4QY087G0R000WKDYFZ asked, as its third bullet, whether the certified
markdown healer should touch `docs/books/` **at all** — prose is not a lint
target the way source is, and a formatter that rewrites an author's paragraphs
needs a stronger warrant than "the linter said so".

That bug is fixed (PR against `main`, branch
`fix/healer-does-not-manufacture-lists`): the healer now conforms to
CommonMark's paragraph-interruption rule and no longer manufactures a list out
of a hard-wrapped numeral. **This question survives the fix**, which is why it
is filed separately rather than answered inside it.

## Why it was NOT decided in the bug fix

1. **Excluding books would not have fixed the bug.** The same defect landed in
   `docs/design/2026-08-23-clifford-gpu-theory-brief-*.md:87` and — measured
   during that fix, previously unobserved — in `docs/PRIOR-ART-LIST.md`. It is
   a *class* over every hard-wrapped numeral, not a books problem. A scope
   exclusion would have left the class alive everywhere else and read as a fix.
2. **There is deliberately only ONE exclusion list.**
   `src/Core.TypeScript/hygiene/healers/md-heal-scope.ts` reads the LINTER's own
   `ignores` out of `.markdownlint-cli2.jsonc`, and its header says why: "A
   second hand-maintained exclusion list would drift from the first the moment
   someone edited one and not the other, which is how this class of defect
   regenerates." So excluding books from the *healer* means one of two things,
   and both are real decisions:
   - add `docs/books/**` to `.markdownlint-cli2.jsonc` — which also stops
     **checking** book prose. Coverage loss, not just write-scope loss.
   - give the healer its own list — the drift the module exists to prevent.
3. **Coupling would be dishonest.** Changing what `drift-sweep` measures on the
   same tick that unblocks its first publication in ten days mixes two effects
   in one signal.

## The actual question

Is markdown lint a *style* contract (apply to authored prose too) or a
*structural* one (apply where structure is load-bearing, leave paragraphs
alone)? Note the existing ignore list already answers "leave it alone" for every
**verbatim** class — ferries, PR archives, the Amara conversation, recovered
orphan branches — on preservation grounds. Authored book prose is a *different*
argument: not "someone else's bytes" but "an author's sentences".

Sub-questions worth separating:

- REPORTING on book prose (markdownlint finds MD029) vs WRITING to it (the
  healer edits it). The two do not have to move together, and today they do.
- If they should differ, the one-source-of-truth property has to be replaced by
  something better than a second list — e.g. the config carrying a per-entry
  `heal: false` that both consumers read.

## Not in scope

The healer defect itself (fixed) and the lint profile's rule selection.

## Input (not a decision) — the warrant argument, after the detector landed

Recorded by the follow-on hardening (`orderedListPrefixDetector`, same branch
name, PR against `main`). This does **not** close the item; it supplies the
piece the original filing could not have, because the mechanism did not exist
yet.

The filing's third bullet says a formatter that rewrites an author's paragraphs
"needs a stronger warrant than *the linter said so*". There is now a candidate
warrant that is not a scope carve-out:

> The healer's write access is granted per-invocation by a certification whose
> closure law is `d(heal(t)) ⊆ d(t)` — it may never MINT drift. That law was
> already the right one; what it lacked was a detector able to see the class
> that mangles prose. With `ol-prefix` in `REFERENCE_DETECTORS`, the naive
> re-splitter now FAILS the gate on the incident fixture (measured: pass=true
> before, pass=false after). The warrant for touching authored prose is
> therefore "an executable law refuses the edit that would damage it", not
> "the linter said so".

Two honest limits on that argument, so it is not read as an answer:

1. **The warrant is only as wide as the detector set.** It is now five
   detectors, not one linter. The next prose-damaging class with no detector is
   in exactly the position MD029 was in this morning. The general fix would be
   a detector derived from the linter itself rather than hand-written siblings;
   nobody has costed that.
2. **No gate can require a heal.** Idempotence, closure and convergence are all
   satisfied by a healer that does nothing, so certification can only ever say
   "this edit is not damaging" — never "this file needed editing". Whether an
   author's paragraph *should* be edited at all is untouched by any of this,
   and remains the open question.

The sub-question the filing separates — REPORTING on book prose vs WRITING to
it — is still the sharp one, and still unanswered.
