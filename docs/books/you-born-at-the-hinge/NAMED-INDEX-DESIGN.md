# The derived named index — design

> **What this is.** A mapping from **person -> every place they appear in the book**, generated from
> in-text markers, plus the audit that fails when a person appears in the prose with **no marker on
> them**. The index answers *"what does this book say about me?"*; the audit is what makes the answer
> trustworthy. It is the coverage half of
> [`CONSENT-SIGNOFF-DESIGN.md`](CONSENT-SIGNOFF-DESIGN.md) (PR #15619), which is the approval half,
> and both stand on [`CONSENT-LEDGER.md`](CONSENT-LEDGER.md), which stays the source of truth for
> scope and reasoning.
>
> **Status: built and proven failing, roster empty.** `consent-events.json` carries zero people, so
> on the real corpus this audit currently looks for nothing and finds nothing. **That is a count, not
> a clearance**, the report says so on every run, and section 8 is the one-command path out of it.

## 1. The problem: a hundred approval requests nobody answers

PR #15619 binds consent to the **sha256 of the approved passage**, so an edit makes the row `STALE`
and re-consent is required. That is correct and it is the right primitive.

It does not survive contact with how the book is actually written. Aaron 2026-08-26:

> *"this part we will need to have a back and forth on, based on their feedback and my many many
> revisions after talking about others, so a named index into the book would help — we should route
> and design that."*

**Twenty subjects times five revision passes is a hundred approval requests.** People stop answering
long before a hundred. And the moment they stop, the mechanism has trained everyone to ignore it —
which is strictly worse than not having one, because a green check now means "nobody read it" and
looks exactly like "everybody agreed".

## 2. Why the index is better, not merely cheaper

Three reasons, and only the third is about volume.

1. **It answers the question the subject actually has.** Nobody asks *"has paragraph 4 of chapter 6
   changed?"* They ask *"what does this book say about me?"* No passage-level diff answers that. An
   index entry does, in one page.
2. **Consent becomes about PORTRAYAL, not sentences.** Someone can be comfortable with every
   individual line and not with the aggregate picture — a person rendered accurately eleven times and
   left looking like a footnote in their own history has been misrepresented by an arrangement, not
   by a sentence. Only the whole footprint surfaces that, and only the whole footprint can be
   consented to.
3. **Revision churn gets scoped.** Revise one section and only the people indexed there need to look,
   at a **delta view** — *here is what changed about you since you approved* — rather than at
   everything again.

## 3. The thing that decides whether this works

> **The index must be DERIVED. It must never be hand-maintained.**

A hand-kept index drifts. A drifted index means someone approved coverage that no longer reflects the
text — coverage that **looks** complete and is not. That is the failure class this repo is built
against ([`toy-is-free-metered-must-be-earned`](../../../.claude/rules/toy-is-free-metered-must-be-earned.md)
is the standing form of it), with one difference that changes the stakes: **here the cost lands on a
named third party rather than on CI.**

So there are three mechanisms, and the second one is the load-bearing one:

| mechanism | what it does | file |
|---|---|---|
| in-text markers | `consent:begin` / `consent:end` name the subject at the passage | the prose (#15619's vocabulary, unchanged) |
| **the coverage audit** | **fails when a person is in the prose with no marker** | `audit-book-named-index.ts` |
| the generator | folds markers into the index and the footprint hash | `book-named-index.ts` |

Without the audit, the index under-reports **silently**: everything it lists is real, and nothing
tells you what it missed. A subject is shown a page headed *everywhere you appear*, reads it, says
yes — and the book says something else about them somewhere nobody marked. The index is what
persuaded them they had seen everything, which is exactly why an incomplete one is worse than none.

## 4. Proven failing — the mutation table

Every negative below is a **mutation of a positive control asserted green in the same test**, because
a negative that passes because an earlier guard fired on a broken fixture proves nothing (this repo
has been bitten by that twice). 30 tests in `audit-book-named-index.test.ts`, 27 in
`book-named-index.test.ts`.

| mutation | result |
|---|---|
| add one unmarked sentence naming a `named` subject | `UNMARKED_APPEARANCE`, **exit 1** |
| remove that sentence again | exit 0 — the finding tracks the text, not a latch |
| name a `pending` subject in ordinary prose | `NAME_LEAK`, exit 1 |
| name a `pending` subject **inside** a consent span | `NAME_LEAK`, exit 1 — a marker is not permission |
| name a `role-only` subject | `NAME_LEAK`, exit 1 — byte-identical outcome to `pending` |
| revoke a subject and leave their name in | `REVOKED_APPEARANCE` — advisory at repo tier, **fail under `--publish`** |
| hand-edit one line of `NAMED-INDEX.md` | `INDEX_STALE`, exit 1 |
| edit one character of prose without regenerating | `INDEX_STALE`, exit 1 |
| delete `named-index.json` | `INDEX_STALE`, exit 1 |
| put a roster person's zero aliases against a chapter full of their name | `NO_ALIASES_DECLARED` advisory, **and the test asserts the mention is invisible** |
| empty roster | `ROSTER_EMPTY` advisory, and the wording is *"a count, not a clearance"* |
| roster missing entirely | **exit 2** — a configuration error, never "no findings" |
| an unclosed `consent:begin` | **exit 2** — a malformed corpus is never a silent skip |

### Measured on the real corpus, not only on fixtures

Fixtures prove the logic; they do not prove the audit reaches 78 files of real prose. Run live on the
tracked book directory with one **throwaway, non-person** roster entry whose alias is a phrase the
book actually uses:

```text
roster: [{ person: "DEMO SUBJECT (not a real person)", indexState: "named",
           aliases: ["the correlation of souls"] }]

named-index coverage audit — mode: repo (false-claim checks)
  prose files scanned        : 78
  book-machinery files SKIPPED: 3 — CONSENT-LEDGER.md, NAMED-INDEX-DESIGN.md, NAMED-INDEX.md
    (the whole exclusion list, present or not: CONSENT-LEDGER.md, CONSENT-SIGNOFF-DESIGN.md,
     NAMED-INDEX-DESIGN.md, NAMED-INDEX.md)
  alias hits outside any span: 10
  findings : 12 (12 failing, 0 advisory)
exit 1

# roster reverted to empty
exit 0
```

Ten appearances across eight files, each reported with `file:line` and the source line, matched
case-insensitively (`The correlation of souls`, `the correlation of souls`). `CONSENT-LEDGER.md` was
skipped and said so. The roster was reverted immediately; the shipped one is empty and **no real
person was placed on it**.

Matching discipline, each with a paired control so the negative is not just "the matcher failed":

| case | behaviour |
|---|---|
| `Jordan` inside `Jordanian` | no hit; but `And Jordan, of course` **is** a hit |
| `jordan rivera`, lowercase | hit — case-insensitive, because over-reporting is the safe direction |
| the same name in a fenced example | no hit; the same name in prose two lines later **is** a hit |
| an alias containing `.` (`A.C.`) | matched literally, not as a wildcard |
| the same name in `CONSENT-LEDGER.md` | not an appearance; **the same string in a chapter is** |
| three aliases matching one line | one finding, not three |

## 5. The four states — and `role-only` is a content constraint

`indexState` on the roster. **Three are declared; the fourth is derived and may not be declared** — a
state that can be both asserted and computed is a state that can disagree with itself.

| state | declared? | what it permits | what the audit enforces |
|---|---|---|---|
| `named` | yes | may be named | every appearance must sit inside a consent span |
| `role-only` | yes | carried by role, never by name | **no alias may appear anywhere in the prose** |
| `pending` | yes | asked, no answer yet | **identical constraint to `role-only`** |
| `revoked` | **derived** | nothing | any appearance fails under `--publish` |

Two of those need a note.

**`pending` is not the weaker one.** It enforces exactly what `role-only` enforces, and there is a
test asserting the two produce byte-identical findings. Treating an unanswered ask as *probably fine*
is precisely the failure this mechanism exists to prevent; the states differ only in what they
**predict about the next event**, never in what they permit.

The live precedent is in the ledger already: a subject **asked and answered with a denial** (name use
declined for employer confidentiality), carried by role and not by name. `role-only` is that row,
made machine-checkable. `pending` is the same protection extended to the interval before an answer
arrives, which is when it is easiest to lose.

**`revoked` is derived from #15619's grant/revoke fold**, not from a parallel mechanism. This module
reads the raw events for two fields and answers only the coarse question *does anything still stand
for this person*. **Honest limit, in the code and here:** it cannot distinguish "revoked one scope"
from "revoked everything", so it reports `revoked` only when **nothing** survives. A partial revoke
shows as `named` here and is caught per-span by #15619's `REVOKED_PASSAGE_PRESENT`. A rollup that
looked finer than it is would be worse than none.

## 6. How it meets the consent mechanism

Consent binds to the person's **combined footprint hash** — sha256 over the ordered
`(spanId, passageSha256)` list, ordinal by `spanId` so the value is identical on every machine — not
to each passage separately. This is #15619's `spanId: "*"` footprint grant, and the index is what
makes it usable: the grant cites one hash, and the index is the human-readable thing that hash stands
for.

On revision:

```text
bun src/Core.TypeScript/hygiene/book-named-index.ts --delta --baseline <snapshot-they-approved.json>
```

renders *"what changed about you since you approved"* per person: **new passages**, **passages
edited since you approved them**, **passages removed**, and any state change. A person whose
footprint hash did not move produces **no row at all** — there is a test for that, and it is the
whole economics of the thing. One section revised sends a delta to the two people in it, not a
re-read to twenty.

The baseline is any earlier `named-index.json`; because the snapshot carries **no timestamp** and is
ordinal-sorted throughout, `git show <rev>:docs/books/you-born-at-the-hinge/named-index.json` is a
valid baseline for any point in history.

## 7. Reconciling with #15619 — extended, not replaced

PR #15619 §10 anticipated this work and proposed that its design supply the substrate: one marker
vocabulary, one roster, complementary audits, the footprint hash as the delta view. **All four are
adopted.** What follows is where this implementation differs, said out loud rather than diverged
quietly.

### 7.1 The shared parser lives in a third module, not in either tool

PR #15619 proposed exporting `collectSpans` from `audit-consent-signoff.ts` for the index to import.
Right shape, wrong direction of dependency — and unavailable in any case: **#15619 is open and
unmerged**, so nothing on `main` can import from it. Re-implementing the parser inside the index
would be the Babel failure in miniature: one syntax, two readings, drifting apart
([`anti-babel-preserve-reconcilability`](../../../.claude/rules/anti-babel-preserve-reconcilability.md)).

So the marker vocabulary lives in `src/Core.TypeScript/hygiene/book-consent-spans.ts`, which neither
tool owns, and three things keep the two honest until they are one:

1. **`book-consent-spans.golden.json`** — hex-in-JSON byte-locks of the canonical form and sha256 of
   five fixture passages, text-only per
   [`no-binary-in-proof-lineage`](../../../.claude/rules/no-binary-in-proof-lineage.md). One of them
   is the **exact example printed in `CONSENT-SIGNOFF-DESIGN.md` §4**, which makes it a
   cross-implementation anchor rather than a self-portrait: it is derivable from #15619's published
   text alone, so it constrains both parsers.
2. **`audit-book-named-index.ts --parser-conformance`** — imports `audit-consent-signoff.ts` when it
   is in the tree and compares its `collectSpans` against this one over the real corpus. Today it
   returns **exit 3, UNCHECKED — never 0**, because the counterpart is not there. That is the honest
   report and it is the same convention #15619 already uses for an unfetched review. Three tests
   cover it: absent -> 3, agreeing counterpart -> 0, counterpart differing by one hash character -> 1.
3. **The integration point below.**

### 7.2 Integration point — the edit that collapses the two parsers

When #15619 lands, `audit-consent-signoff.ts` should delete its own span-extraction block
(`BEGIN_RE` through `footprintOf`, and `repoRoot` / `DEFAULT_LEDGER` / `DEFAULT_CORPUS`) and re-export
from the shared module instead:

```ts
export {
  canonicalizePassage, collectSpans, DEFAULT_CORPUS, DEFAULT_LEDGER, extractSpans,
  footprintOf, hashPassage, parseAttrs, repoRoot, SpanError, type SpanMode, type SpanRecord,
} from "./book-consent-spans.ts";
```

Its public surface is unchanged, so its 42 tests keep passing unedited. After that,
`--parser-conformance` compares a module with itself and should be **retired**, not left running —
a check whose two sides are the same object is the vacuity class, and the golden vector is what
carries the constraint from then on. Wire `--parser-conformance` into CI only in the window
between #15619 landing and that edit.

### 7.3 `indexState` is additive and does not break #15619

`parseLedger` in `audit-consent-signoff.ts` **whitelists** the person fields it reads
(`person`, `githubLogin`, `githubUserId`, `aliases`) and ignores everything else. Verified by reading
the code, not assumed. So `indexState` on a person record is invisible to that verifier and cannot
break it. **Register: metered** — the field list is quoted from the source.

Absent `indexState` means `named`, and that default is chosen because it makes the coverage audit
**stricter**, not more permissive. A default that relaxes a check is how a check goes quiet.

### 7.4 Tier placement, where the two disagree

PR #15619 puts `SPAN_UNCLAIMED` (a marked passage with no consent event) at the **publish** tier:
insufficient consent, gated where the maintainer draws the hard demarcation. This audit puts
`UNMARKED_APPEARANCE` at the **repo** tier.

That is deliberate and it is not a disagreement about the demarcation. It is a different **kind** of
defect. An unclaimed span is *consent that has not been collected yet* — normal, expected, and
harmless in a disputable draft. An unmarked appearance is the **index making a false claim about its
own completeness**, and a false claim in the ledger is a defect at any stakes — which is #15619's own
rule for the repo tier, applied to a finding it does not have. Only `REVOKED_APPEARANCE` is
publish-only here, and it is publish-only for exactly #15619's reason.

### 7.5 The concern #15619 §10 raised does not materialise

> *"if that design needs per-appearance markers finer than a paragraph span (a single inline name),
> `spanId` granularity will have to shrink, and ... `SPAN_UNCLAIMED` would then fire on inline
> mentions that no one intends to gate."*

It does not need finer markers. Granularity stays at the paragraph span, identically to #15619. An
inline mention is handled by **coverage** (the alias scan), not by a smaller span: the audit's answer
to a bare name in a sentence is *wrap the passage*, never *mint a one-word span*. No span attribute
is needed and none is added.

### 7.6 `consent-events.json` is shipped byte-identical to #15619's copy

Both PRs create the same path. This one ships the file **byte-identical** to #15619's version, so git
merges the two additions with no conflict. That is also why its `_readme` names a verifier that is
not on `main` yet: the file originates in #15619, and this PR is carrying it forward unchanged rather
than forking it. The roster and the event log are **empty in both**.

## 8. Using it

```text
# regenerate the derived index (never hand-edit it)
bun src/Core.TypeScript/hygiene/book-named-index.ts --write

# is the committed index still what the prose says?
bun src/Core.TypeScript/hygiene/book-named-index.ts --check

# the coverage audit — the load-bearing one
bun src/Core.TypeScript/hygiene/audit-book-named-index.ts
bun src/Core.TypeScript/hygiene/audit-book-named-index.ts --publish

# what changed about each person since a baseline snapshot
bun src/Core.TypeScript/hygiene/book-named-index.ts --delta --baseline path/to/named-index.json

# candidate roster entries, read from CONSENT-LEDGER.md — writes nothing
bun src/Core.TypeScript/hygiene/book-named-index.ts --suggest-roster
```

**Filling the roster is the one manual step, and it is deliberately manual.** `--suggest-roster`
reads the **subject column of `CONSENT-LEDGER.md`** — never a scan of prose for capitalised words,
which would be inference about people rather than a reading of what Aaron already wrote
([`engagement-profiles-...`](../../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md):
ask, do not infer). It emits every row in a state that **withholds** the name, so applying it
verbatim fails loudly rather than quietly permitting. `aliases` and `indexState` are human calls.

## 9. What this audit cannot catch

Stated plainly, because implied coverage is the thing being defended against.

> **A person described identifiably without being named.**

This is a string matcher. *"My co-founder from the 2007 company, the one who later went into medical
imaging"* identifies someone precisely and contains no alias. **There is a test asserting the audit
says nothing about that sentence** — the gap is pinned, so silence is never later read as coverage.

The partial mitigation is real and it is not general: `aliases` accepts **role phrases** as well as
names, and a declared descriptor is caught (there is a test for that too). It caught the phrasing
because a human wrote the phrasing down; a paraphrase escapes it again. So:

- `NO_ALIASES_DECLARED` fires for any roster entry with an empty alias list — a check that cannot
  fail, reported as such rather than counted as a pass.
- The generated index prints **aliases declared** per person, because that number *is* the strength
  of the coverage claim for them.
- Every run of the audit prints `NOT CHECKED: a person described identifiably but not named.`

The residue is human review, and this design does not pretend otherwise.

**Two more things it does not do**, inherited from #15619 §11 and unchanged: it does not prove who
holds an account, and it does not prove consent was informed or uncoerced. E-signature is the legal
instrument, a DKIM-signed reply is the archival channel, and this is the machine-checkable layer.

## 10. Claim registers

Per [`toy-is-free-metered-must-be-earned`](../../../.claude/rules/toy-is-free-metered-must-be-earned.md):

| claim | register |
|---|---|
| the coverage audit fails on an unmarked appearance and passes without it | **metered** — mutation asserted both ways in one test |
| `role-only` / `pending` are enforced on content, not carried as a flag | **metered** — a name inside a consent span still fails |
| the index is derived, and drift is detected | **metered** — hand-edit, prose edit and deletion all go red |
| `indexState` does not break `audit-consent-signoff.ts` | **metered** — `parseLedger` whitelists its fields; read, not assumed |
| the two span parsers agree | **UNCHECKED** — exit 3 until #15619 lands; the golden vector is the interim constraint |
| the delta view makes many revisions survivable | **consistent with** — the mechanism is tested; the claim that people will actually keep answering is falsified or confirmed by the first real revision round |
| a person identifiable but unnamed is caught | **not claimed.** See section 9 |
| this reduces legal risk | **not claimed.** See #15619 §11 |

## 11. Pointers

- [`CONSENT-LEDGER.md`](CONSENT-LEDGER.md) — source of truth for scope, conditions and reasoning
- [`CONSENT-SIGNOFF-DESIGN.md`](CONSENT-SIGNOFF-DESIGN.md) — the approval half (PR #15619)
- [`NAMED-INDEX.md`](NAMED-INDEX.md) · `named-index.json` — the derived index (do not hand-edit)
- `src/Core.TypeScript/hygiene/book-consent-spans.ts` — the shared marker vocabulary
- `src/Core.TypeScript/hygiene/book-named-index.ts` — the generator and the delta view
- `src/Core.TypeScript/hygiene/audit-book-named-index.ts` — the coverage audit
- `src/Core.TypeScript/hygiene/book-consent-spans.golden.json` — the byte-locks, hex-in-JSON
- [`anti-babel-preserve-reconcilability`](../../../.claude/rules/anti-babel-preserve-reconcilability.md) — why one vocabulary, two parsers, is the risk
- [`privacy-budget-is-hard-money-earned-by-others`](../../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md) — one-way to more privacy is free
- [`local-time-never-enters-the-shared-fold`](../../../.claude/rules/local-time-never-enters-the-shared-fold.md) — why the snapshot carries no timestamp
- [`docs/governance/MANIFESTO.md`](../../governance/MANIFESTO.md) §6 consent-first, §5 memory preservation
