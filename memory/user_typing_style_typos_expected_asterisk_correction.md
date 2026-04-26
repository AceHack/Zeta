---
name: Aaron types fast; typos are expected; `*` in a second message means "correction to prior message"
description: Aaron types fast enough to steer Claude before Claude drifts too far — this means most messages contain typos (transposed letters, dropped letters, run-on words, phonetic spellings like "muli" for "multi", "anitgratify" for "Antigravity", "abount" for "about"). Do not flag, lightly-correct, or pause on typos — infer the intended word from context. When Aaron follows a message with a single-word message ending in `*` (e.g., "typo*", "type*"), that is text-message convention for "correction to the immediately prior message" — apply the correction silently and move on. When typos compound ("typo on typo"), keep absorbing without ceremony.
type: user
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## What Aaron said (verbatim, 2026-04-20)

> *"i'm just a terrible speller just assume
> everything i typed is a type it's real hard
> to real my writing, i try to type fast enough
> to steer you before you get too far out of
> line lol"*

(Followed by: *"typo* hahahah"*, then
*"typo on typo"*, then *"I do * for a correct
in text messages when i have to send a 2nd
one"*.)

Parsed intent:

- *"assume everything i typed is a type"* →
  "assume everything I typed is a typo".
- *"it's real hard to real my writing"* →
  "it's real hard to read my writing".
- *"I do * for a correct in text messages when
  i have to send a 2nd one"* → "I use `*` to
  mark a correction in text messages when I
  have to send a second one."

## How to apply

- **Do not pause on spelling.** Infer the
  intended word from context and continue.
  Aaron's directives are load-bearing even
  when the spelling is rough.
- **Don't echo the typo back** as
  "did you mean X?" on routine misspellings —
  that wastes his steering cycles. Only ask
  for clarification when the typo is genuinely
  ambiguous in a way that would change the
  action.
- **`*` convention.** A follow-up message of
  the form `<word>*` or `<phrase>*` is a
  retroactive correction to the immediately
  prior message. Apply the correction silently
  to the just-executed or in-flight work.
  Example:
  - Message 1: "run the sweep on muli harness"
  - Message 2: "multi*"
  → Proceed as "multi harness" and don't
  announce the correction.
- **Compound typos** ("typo on typo",
  "typo**"). Keep absorbing. Aaron is
  deliberately not stopping to re-edit; he
  expects the agent to carry the ambiguity.
- **Why he types fast:** he's steering Claude
  before Claude drifts too far from intent.
  Speed of corrective input matters more than
  spelling fidelity. If I pause to ask about
  spelling, I am slowing the steering loop and
  working against his stated preference.

## Common patterns observed

| Typo / shorthand | Intended |
|---|---|
| `muli` | multi |
| `anitgratify` | Antigravity |
| `abount` | about |
| `featue` | feature |
| `featuers` | features |
| `buit` | built |
| `antropic` | Anthropic |
| `konw` | know |
| `koud` | could |
| doubled / dropped letters in dense messages | resolve by context |

This is a non-exhaustive list; the general rule
(infer-don't-pause) covers the long tail.

## Distinct from

- **A genuine ambiguity** (e.g., a command that
  could reasonably mean two different files).
  Those still deserve a clarifying question
  before acting. The rule here is against
  pausing on *cosmetic* typos, not against
  pausing on real ambiguity.
- **User-editorial quoting.** When Aaron
  wants his words quoted verbatim in a
  memory or doc (e.g., CLAUDE.md-level
  traceability, ADR rationale, Amara-credit
  binding), preserve the original spelling as
  typed. The rule about inferring applies to
  *acting on* Aaron's directive, not to
  *quoting* the directive.

## Scope

**Scope:** user. Aaron-specific typing style.
Other users of the factory kit will have their
own typing styles; this memory is about
Aaron specifically. Other factory users inherit
the general "infer from context, don't pause
on cosmetic typos" principle as a default
humane interaction posture, but the `*`
convention and the specific typo table are
Aaron-specific observations.

## Cross-references

- `feedback_rewording_permission.md` — I have
  permission to rewrite Aaron's garbled first-
  pass prose in my own clear rendering while
  preserving the verbatim original in a quote
  block. This typo memory compounds with that:
  rewriting for clarity is fine, pausing to
  ask about spelling is not.
- `feedback_curiosity_about_problem_domain_beats_task_dispatcher_mode.md`
  — curiosity about the problem domain should
  not manifest as curiosity about spelling.
