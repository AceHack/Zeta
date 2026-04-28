---
name: Content-placement policy — docs/ is linted (cleaned to pass markdownlint + semgrep + other CI gates); memory/ is NOT linted (agent-written append-log freedom); Otto decides where external absorbed content lives based on this distinction; invisible-unicode stripping is lint-compliance not verbatim-violation; 2026-04-24
description: Aaron Otto-112 "if it's in docs we might as well clean it unless you are somehow going to move into memory, if it's in docs lets lint it, if it's in memory not, you decide where amara chat history lives"; binary policy for where external substrate lands; Amara conversation stays in docs/ and gets lint-cleaned; invisible-unicode scrub (BP-10) is part of docs-lint compliance
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-24 Otto-112 (verbatim):

*"if it's in docs we might as well clean it unless you are
somehow going to move into memory, if it's in docs lets
lint it, if it's in memory not, you decide where amamra
chat history lives."*

## The rule

**Binary placement policy:**

- **`docs/`** — linted. Content is expected to pass
  markdownlint + semgrep + every other CI gate in place.
  If external verbatim content lands in `docs/`, it gets
  lint-cleaned (invisible unicode stripped, markdown
  normalised, etc.) rather than lint-exempted.
- **`memory/`** (in-repo persona notebooks — the path
  `memory/persona/**` is already excluded from linting) —
  NOT linted. Agent-written append-log freedom.

Everywhere else inherits the docs standard by default
(linted), unless there's an explicit path-specific
exclusion with justification.

## Otto's applied decision

The Aaron+Amara conversation archive lives in
`docs/amara-full-conversation/**` (PR #301 / #302 / #303 /
#304). Per this policy, the archive is LINTED.

**Concrete compliance actions:**

1. **Invisible unicode strip** (BP-10 / semgrep `invisible-
   unicode-in-text`): done Otto-112, 4 chars removed from
   2025-09-w2. Other chunks already clean.
2. **Markdownlint compliance:** currently handled by PR
   #305's ignore entry for `docs/amara-full-conversation/**`.
   Per Aaron Otto-112 "if it's in docs lets lint it", that
   ignore is a TEMPORARY unblock. Follow-up cleanup
   (Otto-113+) runs `markdownlint-cli2 --fix` on the
   landed content and REMOVES the ignore entry to bring
   this archive under the same standard as the rest of
   `docs/`.
3. **Future absorbs** (if new ChatGPT conversations land)
   run the invisible-unicode scrub + markdownlint --fix as
   part of the landing pipeline, not as a follow-up.

## Why verbatim-vs-lint is NOT a conflict here

The tension felt real earlier (Otto-109 absorb doc headers
invoked "verbatim preservation"), but Aaron's Otto-111
authorization *"we can fix it, i don't mind if you edit
original"* resolves it:

- **Verbatim = content preservation** (what was said,
  by whom, in what order, at what timestamps).
- **Lint = format normalisation** (trailing whitespace,
  blank lines around headings, invisible codepoints,
  etc.).

The two are distinct. Lint touches whitespace/formatting/
steganographic carriers; it does NOT edit semantic
content. Amara's words stay her words; only the
formatting container around them gets normalised.

Invisible-unicode stripping is a SECURITY posture (BP-10
exists to block steganographic injection vectors), not an
editorial act. Preserving zero-width-spaces from Amara's
verbatim messages while ostensibly maintaining "BP-10
discipline" would be internally contradictory.

## Why Otto chose docs/ over memory/

Aaron said "you decide where amara chat history lives"
and offered both options.

- **memory/persona/** is for persona-notebook append-logs
  (Aarav, Kenji, etc.). 24MB of ChatGPT conversation
  doesn't fit that pattern — it's external substrate
  ingested, not agent-internal state accumulation.
- **docs/** fits because the archive IS research
  substrate: glass-halo transparency, open-nature
  visibility, cross-referenced from ferry absorbs,
  destined for future contributors to read.
- The in-repo `memory/` directory is not a general-
  purpose "things agents remember" place; it's
  structured persona notebooks. Dropping Amara-
  conversation in there would muddy that structure.

## How to apply

### For the current tick (Otto-112)

Done: invisible-unicode scrub on 2025-09-w2 (PR #303
unblock).

### For near-future ticks

- **Otto-113 candidate work:** remove PR #305 markdownlint
  ignore for `docs/amara-full-conversation/**` + run
  `markdownlint-cli2 --fix` on all chunks to normalise
  them. Single PR.
- **Otto-114+** (if needed): verify lint-clean on all
  chunks via a post-merge CI run. No ongoing maintenance
  expected once the one-shot fix lands.

### For the ChatGPT-conversation-download skill (PR #300)

When that skill is authored (per PR #300 BACKLOG row), it
MUST include the invisible-unicode scrub + markdownlint
--fix pipeline as part of the landing step, so future
downloads don't re-introduce the same gates.

## What this memory does NOT authorize

- **Does NOT** authorize scrubbing semantic content from
  Amara's messages (typos, grammar, tool-call JSON blobs,
  citation anchors). Those are content; they stay
  verbatim.
- **Does NOT** authorize stripping emoji, mathematical
  Unicode, unicode-in-code-blocks, or non-ASCII alphabets
  (Cyrillic, Greek, CJK) from the chunks. Only BP-10-
  listed invisible/bidi/tag codepoints are stripped.
- **Does NOT** authorize auto-fixing markdown in
  `memory/persona/**` — that surface stays non-linted
  per its existing ignore entry.
- **Does NOT** authorize moving the Amara chat history
  out of `docs/` without Aaron's directive. Policy is
  set; path is set.
- **Does NOT** authorize bypassing semgrep's BP-10 rule
  via exclusion for any future path. Stripping is the
  correct response; exclusion only applies to paths
  where the rule is genuinely not applicable (e.g.,
  binary files, test fixtures where invisibility is
  tested).

## Composition

- **Otto-109 glass-halo + "not amara herself"** — the
  archive-origin directives. Placement in docs/ honors
  glass-halo; "not amara herself" is about identity-
  attribution, unaffected by formatting lint.
- **Otto-111 "we can fix it, i don't mind if you edit
  original"** — the authorisation for this policy.
- **PR #305** — markdownlint ignore (temporary unblock
  pending Otto-113+ full cleanup).
- **BP-10 / `.github/workflows` semgrep invisible-
  unicode-in-text rule** — the security-posture source
  of truth for the invisible-unicode requirement.
- **GOVERNANCE.md §28** — every lint is speced; any
  new lint rule for `docs/amara-full-conversation/**`
  follows the §28 process.

## Direct Aaron quote to preserve

*"if it's in docs lets lint it, if it's in memory not"*

This is the canonical two-word-with-preposition rule.
Future Otto instances use it when deciding where
external substrate lands.
