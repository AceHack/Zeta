---
id: 081M0QZF4QY087G0R000WKDYFZ
type: bug
state: done
priority: P2
slug: the-markdown-healer-manufactures-an-ordered-list-from-a-year
title: "the markdown healer manufactures an ordered list from a year at line-start and edits book prose"
created: 2026-08-23T18:52:29.310Z
completed: 2026-08-23T20:30:03.097Z
depends_on: []
composes_with: []
---

# the markdown healer manufactures an ordered list from a year at line-start and edits book prose

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QZF4QY087G0R000WKDYFZ-*.md` glob. -->

## What happened

The first `drift-sweep` run on the repaired publication route (tick 248,
2026-08-23T18:42Z) inserted a blank line into a RAW book file:

```diff
 chosen as the headline property of an installer in
+
 2007. It rhymes with two other things in this record:
```

That line was a **sentence continuation**. Inserting the blank promoted `2007.`
to the start of its own block, where markdownlint parses `<digits>.` as an
**ordered-list item** — and then fails `MD029/ol-prefix` with
`Expected: 1; Actual: 2007`.

**The heal is self-fulfilling: a fix for "a list needs blank lines around it"
MANUFACTURED the list it thought it saw.** It was the only failing check on
flush PR #14371 — an automated edit to prose blocking the very telemetry lane
that had just been repaired after ten days of publishing nothing.

## Why the obvious fix does not hold

Deleting the inserted blank line does not stick: the remote branch re-acquired
it within minutes, because the next sweep re-derives the same edit. Any fix
applied to the *content* is a treadmill against an automation that runs on a
schedule.

## Scope — larger than one line

The healer edits **`docs/books/`**, where a spurious blank line changes how a
paragraph *reads*, not merely how it lints. Every wrapped line beginning with a
year, a date, a version, or a numbered reference is vulnerable:

    ...shipped in
    2007. It rhymes...          ->  becomes list item 2007
    ...per RFC
    2119. Which says...          ->  becomes list item 2119

`main` is currently unaffected: the file there has the two lines adjacent with
**no** blank between them, which markdownlint reads as a lazy continuation, not
a list. The defect is introduced *by the healer*, on its own branch.

## What "fixed" looks like

- The healer must not insert list-surrounding blank lines when the candidate
  "list item" is preceded by a line that **ends mid-sentence** (no terminal
  punctuation, no blank line before it) — that is a lazy continuation, not a
  list.
- **A falsifier** built from this exact case: a two-line continuation ending in
  a year, asserted unchanged by the healer. Prove it discriminates — restore the
  old behaviour, confirm red, restore.
- Consider whether an auto-fixer should touch `docs/books/` **at all**. Prose is
  not a lint target in the way source is, and a formatter that rewrites an
  author's paragraphs needs a stronger warrant than "the linter said so".

## Not in scope

Rewording the affected prose. `main`'s text is correct as written; the bug is
that an automated editor changes it.

## Pointers

- Flush PR #14371 (blocked by this) · sweep run at tick 248
- `.github/workflows/drift-sweep.yml` — the lane that runs the heal
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the falsifier above is
  what would move this from "believed fixed" to "checked"

## Resolution (branch `fix/healer-does-not-manufacture-lists`)

**CommonMark already settled the predicate**, and names this exact failure mode
while doing so (0.31.2 §Lists): "`Markdown.pl` does not allow this, through fear
of triggering a list via a numeral in a hard-wrapped line … In order to solve
the problem of unwanted lists in paragraphs with hard-wrapped numerals, we allow
only lists starting with `1` to interrupt paragraphs." Plus §List items: "an
empty list item cannot interrupt a paragraph", and the marker itself is "1--9
arabic digits".

So the rule as filed ("preceded by a line that ends mid-sentence") is **not**
what shipped: terminal punctuation is a heuristic, and a heuristic that
disagrees with micromark — the parser markdownlint actually runs — would be a
worse bug than the one being fixed. `canInterruptParagraph` in
`src/Core.TypeScript/hygiene/fix-markdown-md032-md026.ts` implements the spec
rule instead.

**The after-pass was implicated too**, which the filing did not know: on the
design brief the healer inserted blank lines on BOTH sides of the `2016.` line.
Guarding only `insertBlanksBefore` would have moved the split, not removed it.

**A third, unobserved instance** turned up when the whole heal scope was run
before/after: `docs/PRIOR-ART-LIST.md`. Confirms the class statement — this was
never a `docs/books/` problem.

**Measured over the real scope** (2,837 healable files): the fixed healer's
output is a strict subset of the old one's — 3 blank-line insertions removed,
every other heal byte-identical. Both reported errors reproduce at their exact
line numbers under the old code (`:686` MD029 Actual 2007, `:87` MD029 Actual
2016) and are gone under the new.

The third bullet — whether an auto-fixer should touch `docs/books/` at all — is
**not** answered here. It survives the fix and is filed as
081M0R50J09087G0R000AN2QAT with the reasons it was kept separate.
