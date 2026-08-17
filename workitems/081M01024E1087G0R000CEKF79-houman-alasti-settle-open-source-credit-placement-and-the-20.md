---
id: 081M01024E1087G0R000CEKF79
type: task
state: backlog
priority: P2
slug: houman-alasti-settle-open-source-credit-placement-and-the-20
title: "Houman Alasti: settle open-source credit placement and the 2007-2008 company artifact question"
created: 2026-08-14T20:40:19.649Z
depends_on: []
composes_with: []
---

# Houman Alasti: settle open-source credit placement and the 2007-2008 company artifact question

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M01024E1087G0R000CEKF79-*.md` glob. -->

**Blocked on one human answer.** Houman Alasti asked for open-source credit (relayed by Aaron
2026-08-14). That is an obligation, not a courtesy — attribution asked for and not given is a specific,
checkable wrong. What is missing is only *where it goes*, and only he can say.

Consent + ownership status: `docs/books/you-born-at-the-hinge/CONSENT-LEDGER.md` (Houman row).
Mutual material: `docs/books/you-born-at-the-hinge/RAW-2026-08-14-the-2007-company-*.md`.

## The credit surface — what actually exists in this repo (checked)

There is **no `CONTRIBUTORS`, `AUTHORS`, `CITATION.cff`, or `CREDITS` file.** Searched the tree
(excluding `references/prior-art/`); the only hit for "citation" is
`docs/research/citations-as-first-class.md`, which is about citing *works*, not crediting *people*.

The two surfaces that do exist and are already load-bearing:

| surface | shape | precedent |
|---|---|---|
| `README.md` §Acknowledgements | prose, general, outward-facing | currently credits the DBSP authors (Budiu et al.) + Feldera |
| a source docstring on the artifact | specific, sits on the code it anchors | **Diana**, `src/Core/DecorrelationMetrology.fs` — "Aaron and Diana … built the meter-fusion …", with her consent noted inline and dated |
| commit `Co-authored-by:` (AgencySignature v1) | per-commit | mechanical; not a standing credit |

**Recommendation: do not create a new file.** The Diana precedent is good and already works, and a
a contributor registry invented for one person is the elaborate answer to a small question. If a general
acknowledgement is what he wants, the minimal move is **one subsection under the existing
`README.md` §Acknowledgements** naming human collaborators and what they anchor — additive, no new
surface, and it gives Chris King / Diana / Houman one consistent home.

**Nothing has been landed.** Placement is his to choose, and guessing it would be the same
ask-don't-infer failure the rest of this record is disciplined against.

## Published work: none located — and the near-misses are a trap, not a lead

`.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md` permits compiling his **chosen-public**
professional output. A search for published work (patents / papers / talks) under **"Houman Alasti"**
returned **nothing matching him**. What it did return was **several different people who share the first
name** — Houman Behzadi, Houman Azarm, Houman Hassani Jalilian, Houman Younessi — with unrelated patents
and careers.

**None of those are him, and none are recorded as his.** Attaching another person's patents to him would
be precisely the failure this task exists to avoid: a misattribution in a document whose entire purpose is
to credit him correctly. **No engagement profile has been written.** If public work exists, the way to
learn of it is to **ask him** — he is reachable, and a self-supplied list is both more accurate and the
method the rules prescribe.

## Open questions for Aaron (each answerable in one line)

1. Is **"functional tree"** the company's **name**, or a **description** of what it built (persistent /
   immutable tree structures — the Okasaki 1998 anchor applies only if it is the description)?
2. Does Houman want credit on a **specific artifact** (a docstring on the code his work anchors, Diana-style)
   or a **general acknowledgement** (a line in `README.md` §Acknowledgements)?
3. May the **co-founded company be named** — in the book, in the repo, or neither?
4. Does Houman's **own book** change where or how he wants the open-source credit to appear? A
   cross-reference between two books is a different ask than a line in an acknowledgements file.
5. **Does any dated artifact from that company still exist** — filings, a repo, a domain registration, a
   spec, a demo? This is the highest-value one: it converts a recollection into evidence.

## Not in scope here

If (5) comes back positive, evidencing the 2007–2008 peer-to-peer money/logistics lineage is a **separate
and much larger task** — file it then, do not start it from this item. And no priority claim relative to
any 2008 publication is to be written under any answer; see the guard in the RAW.
