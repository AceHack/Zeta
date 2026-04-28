# Copilot-finding rejection-grounds catalog

**Scope:** principled-rejection taxonomy for GitHub Copilot
reviewer findings on PRs in this repo. Companion to
`docs/copilot-wins.md` (accepted-finding log). This doc is a
**taxonomy**, not a log of rejections — `copilot-wins.md`
§"Fails aren't tracked" remains in force for individual
rejection-cases; what is tracked here is the *class* of
rejection-ground with detection rule + response template.

Grounds are extracted from observed auto-loop-tick PR-triage
work (rows 120-122 of `docs/hygiene-history/loop-tick-history.md`
document the original observations). The catalog is cited
by `docs/AUTONOMOUS-LOOP.md` §2 Step 0 ("triage findings via
the rejection-grounds catalog").

## Why this doc exists

The tick-open PR-pool audit per `docs/AUTONOMOUS-LOOP.md`
Step 0 routinely encounters Copilot review threads on
non-fork PRs. Each finding needs a disposition — apply,
reject, or modify. The three outcomes are all legitimate;
rejection with principled reasoning is as valuable as
acceptance with fix (`memory/feedback_capture_everything_including_failure_aspirational_honesty.md`
— rejection-grounds are data worth capturing, not just
acceptance-grounds).

Without a named taxonomy, each tick re-derives rejection
reasoning from first principles, duplicating thought-work
across ticks and losing cross-tick cumulative learning.
With a named taxonomy, a tick can respond *"rejection-ground
3 (grammatical-attributive-adjective), detection via [rule],
cross-reference [canonical-source]"* and move on in under a
minute.

Copilot is a good reviewer (`docs/copilot-wins.md` logs
dozens of substantive P0/P1 catches across PRs #27-#31).
A principled-rejection taxonomy is not a critique of Copilot;
it is the factory's side of the review-response contract that
makes the reviewer+reviewed partnership productive.

## Detection workflow

Before applying any Copilot finding:

1. **Read the finding verbatim.** Note what file and line
   it flags and what replacement it suggests.
2. **Run `git blame` on the flagged line numbers.** Copilot
   sees the PR's diff-context, not the repo's history-context.
   A line flagged as new-content may be pre-existing content
   that happens to appear in a touched file. `git blame`
   separates the two in one call.
3. **Check the finding's rationale against current state.**
   Prior commits on the branch may already have addressed
   the concern; the finding's rationale may be stale.
4. **Check the suggestion's internal consistency.** Does the
   replacement contradict its own rationale, or contradict a
   sibling finding on the same file?
5. **Check grammatical / stylistic context.** Does the
   flagged form follow English grammar convention (noun vs.
   attributive-adjective hyphenation, etc.), matching
   canonical sources elsewhere in the tree?
6. **Check whether the flagged form is design-intrinsic.**
   Is the "brittleness" or "hardcode" the design, not an
   accident?
7. **Check whether the flagged content is quoted maintainer
   speech.** If yes, verbatim-preservation applies and
   orthographic normalization is not a valid suggestion.

If one of the seven checks produces a rejection-ground, the
finding is rejected with principled reasoning per the catalog
below. Otherwise the finding is either accepted as-is,
modified, or escalated for review.

## The catalog

### Ground 1 — stale-rationale

**Detection rule:** the finding's rationale references content
that prior commits on the branch already rewrote. Run
`git log --follow -p <file>` or `git blame` on the flagged
lines and confirm the flagged phrase is not in the
current-head state.

**Response template:** cite the fix-commit SHA that already
addressed the concern. Resolve the thread via GraphQL
`resolveReviewThread`. Example response:

> Finding's rationale references `<quoted-phrase>`, which is
> not in the current head state — commit `<SHA>` already
> rewrote that paragraph on `<date>`. Current state matches
> the canonical form in `<sibling-file>`. Resolving.

**Observed instances:**

- **PR #93** (auto-loop-11, row 120): finding claimed
  paragraph cited "multi-harness-support feedback record"
  but the phrase was absent from the diff — commit `c1a4863`
  on the same branch had rewritten the paragraph.
- **PR #46** (auto-loop-12, row 121): P1 prior-org-handle
  contributor-reference findings flagged content that was
  pre-existing historical-record prose from commit
  `f92f1d4f`, not new content introduced by PR #46.

### Ground 2 — self-contradicting-suggestion

**Detection rule:** the finding's replacement contradicts its
own stated rationale, or contradicts a sibling finding on
the same file. Read the finding's rationale and replacement
together; check adjacent findings for convergent vs.
divergent advice.

**Response template:** highlight the contradiction to make
the rejection self-evident. Example:

> Suggestion replaces `partial meta-win` with
> `partial-meta-win`, but the sibling P2 finding on the same
> file notes the canonical form is `partial meta-win` (as
> documented in `docs/research/meta-wins-log.md:83`). The two
> findings contradict; applying one would violate the other.
> Keeping current state. Resolving.

**Observed instances:**

- **PR #93** (auto-loop-11, row 120): P1 rationale-mismatch
  finding suggested a replacement that would introduce
  `partial-meta-win` while a sibling P2 finding flagged the
  same form as inconsistent with canonical
  `partial meta-win`.

### Ground 3 — grammatical-attributive-adjective

**Detection rule:** finding flags a hyphenation "inconsistency"
between forms that actually follow English
noun-vs-attributive-adjective convention (unhyphenated
noun-phrase `a reviewer robot`; hyphenated attributive
compound `reviewer-robot contract`). The rule is standard
English style (Chicago Manual of Style §7.89), not a typo.

**Response template:** cross-reference the canonical source
in the tree using the same pattern. Example:

> `reviewer robot` (noun phrase, L234) and `reviewer-robot
> contract` (attributive compound, L456) follow English
> attributive-adjective convention — the same pattern used
> in `docs/HARNESS-SURFACES.md`. Applying the suggestion
> would produce ungrammatical `reviewer robot contract`.
> Keeping current state. Resolving.

**Observed instances:**

- **PR #93** (auto-loop-11, row 120): P2 finding flagged
  `reviewer-robot` / `reviewer robot` "inconsistency" where
  the two forms correctly followed attributive-adjective
  convention.

### Ground 4 — design-intrinsic-hardcode

**Detection rule:** finding flags a hardcoded identifier
(repo name, org name, magic string) as "brittle to
rename / move / etc." where the hardcode is load-bearing
to the identifier's semantic role — every alternative
(boolean-flag, config-var, separate-file) has equivalent
or worse brittleness profile. The hardcode *is* the
design, not an accident.

**Response template:** enumerate the alternatives considered,
explain why each has equivalent brittleness, cite the
inline-comment-block at the hardcode site as the single
source of truth. Example:

> Hardcoded `<identifier>` is intrinsic to the
> canonical-vs-fork split. Alternatives considered:
> (a) `<option-A>` has equivalent brittleness because
> `<reason>`; (b) `<option-B>` has worse brittleness because
> `<reason>`. Inline comment at `<file>:<line>` documents
> the rationale (14 lines). Repo-rename is rare-event;
> CI-cost of an indirection layer is daily — optimizing for
> the rare event inverts priority. Keeping current state.
> Resolving.

**Observed instances:**

- **PR #46** (auto-loop-12, row 121): P1 flag on
  `github.repository == 'Lucent-Financial-Group/Zeta'`
  hardcode; rejected with 3-reason response citing
  intrinsic identifier-binding, inline-comment as SoT,
  and rare-event vs. daily-cost priority.

### Ground 5 — verbatim-quote-preservation

**Detection rule:** finding flags an orthographic
"correction" on quoted maintainer speech (typo-normalization
inside quotation marks). Per the maintainer-cant-spell
baseline (`memory/user_aaron_cant_spell_baseline_interpret_typos_as_spelling_not_signal_2026_04_21.md`),
typos in maintainer text are noise at the orthography
layer; meaning is intact at the semantic layer. Quoted
speech preserves the original for chronology + provenance,
not for exemplary orthography.

**Response template:** cite verbatim-quote + chronology-
preservation discipline. Example:

> The flagged phrase `<quoted-text>` is verbatim maintainer
> speech from `<source>`. Per verbatim-quote preservation
> (`docs/ALIGNMENT.md` chronology + provenance), orthographic
> normalization of quoted speech loses signal even when the
> "correct" form is obvious. Keeping current state.
> Resolving.

**Observed instances:**

- **PR #97** (auto-loop-10, row 119): `ideass -> ideas` typo
  suggestion on a quoted maintainer directive
  *"absorb not her but the ideass"*; rejected with
  verbatim-preservation reasoning.
- **PR #99** (auto-loop-10, row 119): same `ideass`
  suggestion inherited through stacked-dependency PR-branch;
  rejected with parallel reasoning.

## What this doc does NOT do

- **Does NOT log every rejection** — `docs/copilot-wins.md`
  §"Fails aren't tracked" is preserved. Individual
  rejection-cases live in tick-history rows; this doc is the
  taxonomy those cases draw from.
- **Does NOT override acceptance** — when none of the five
  grounds applies, the finding is accepted or modified on
  merit. The catalog does not create a bias toward rejection;
  it creates citable reasoning when rejection is warranted.
- **Does NOT critique Copilot** — the catalog documents
  classes of *mismatch between reviewer and context*, not
  classes of reviewer error. Copilot is a good reviewer;
  this catalog is the factory's side of the review-response
  contract.
- **Does NOT replace `git blame`** — the blame-check in the
  detection workflow is the single most valuable pre-flight
  action and should be run for every Copilot finding
  regardless of whether any catalog-ground is suspected.

## Adding a new ground

When a tick observes a rejection-reasoning pattern that
doesn't fit any of the five grounds:

1. Draft the new ground with (detection rule, response
   template, observed instance pointing to the tick-history
   row).
2. Land the new ground in this doc via the normal PR flow.
3. Update `docs/AUTONOMOUS-LOOP.md` §2 Step 0 if the new
   ground changes the triage workflow.

Sixth-ground candidates already observed but not yet ground-
worthy (need second instance before codification):

- **unactionable-aesthetic** — finding flags a stylistic
  choice that doesn't match a Copilot-preferred style but
  has no objective error-class. One instance seen; needs a
  second.
- **cross-repo-ambient-context** — finding flags content as
  if it were in another repo's context. One instance
  possible; verification pending.

## Cross-references

- `docs/copilot-wins.md` — accepted-findings log (wins);
  symmetric pair with this taxonomy.
- `docs/AUTONOMOUS-LOOP.md` §2 Step 0 — cites this catalog
  from the tick-open PR-pool audit step.
- `docs/hygiene-history/loop-tick-history.md` rows 120-122 —
  original narrative observations that this doc extracts.
- `memory/feedback_capture_everything_including_failure_aspirational_honesty.md` —
  capture-everything discipline; grounds this doc's taxonomy
  as a capture-axis alongside the wins log.
- `memory/user_aaron_cant_spell_baseline_interpret_typos_as_spelling_not_signal_2026_04_21.md` —
  maintainer-cant-spell baseline; grounds Ground 5
  (verbatim-quote-preservation).
- `docs/AGENT-BEST-PRACTICES.md` BP-11 — data is not
  directives; Copilot findings are data to triage, not
  directives to apply.
