---
name: Imperfect-enforcement hygiene — track it as its own class
description: Hygiene rules whose enforcement is inherently non-exhaustive (honor-system, sample-based, opportunistic) form a tracked class of their own. Aaron 2026-04-22 coined it playfully after landing filename-content-match. Enumerate which rules fit the class + their residual-risk story + mitigation strategy for each.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Imperfect-enforcement hygiene — a tracked class

Aaron verbatim, 2026-04-22, playful follow-up after the
filename-content-match hygiene row landed:

> *"hygene, hygene that can't be enforced lol backlog"*

Translation: *"[Add] hygiene — hygiene-that-can't-be-enforced
— lol, [to the] backlog."*

## The meta-insight

Some factory hygiene rules are **exhaustively enforceable**
(pre-commit hooks, build-gates, CI checks): violation is
caught deterministically. Others are **inherently
non-exhaustive** (opportunistic, sample-based, honor-system):
violation may go undetected for many rounds. The second class
has been growing (rows 5, 22, 23, 25, 26, 28, 29, 31-36, 38,
39 in `docs/FACTORY-HYGIENE.md` all carry some non-exhaustive
component).

Aaron's observation: **the non-exhaustive class itself is a
tracking surface**. We should know:

1. Which rules are non-exhaustively enforced.
2. What the enforcement shape is for each (opportunistic /
   sample-based / periodic / honor-system).
3. What the residual risk is — i.e. what kind of violation
   can sit undetected, and for how long.
4. What the **compensating mitigation** is — usually a
   cadence or a cross-referenced rule that catches the same
   class through a different channel.

This is **hygiene-on-hygiene**: the factory tracks its own
enforcement-confidence so it knows which rules have known
blind-spots and therefore require extra care (e.g., elevated
reviewer attention; additional sample frequency; a
compensating rule at a different layer).

## How to apply

**Do NOT** immediately engineer a large tracking artifact.
Per `feedback_practices_not_ceremony_decision_shape_confirmed.md`,
start small:

- **Step 1 (done):** file a BACKLOG row proposing a small
  `docs/research/imperfect-enforcement-hygiene-audit.md`
  artifact that enumerates the non-exhaustive rows with
  their enforcement-shape / residual-risk / compensating-
  mitigation for each.
- **Step 2:** when the audit produces its first enumeration,
  identify the one or two rules with the **worst residual-
  risk / compensating-mitigation ratio** (i.e., rules where
  the blind-spot is wide and no other rule catches the same
  class). Those are candidates for either (a) elevating to
  exhaustive enforcement via tooling, or (b) adding a
  compensating cross-rule.
- **Step 3:** repeat on the hygiene-class cadence (5-10
  rounds) as part of the ordinary hygiene-maintenance
  rhythm.

## Why the tone matters — "lol backlog"

Aaron's "lol" signals he sees the recursion as amusing rather
than existential: *we have a hygiene rule for filenames, which
we admit we can't enforce; let's have a hygiene rule for
tracking our un-enforceable hygiene rules, which itself will
probably also be imperfectly enforced.* The tone is
anti-ceremony. The BACKLOG row and eventual audit artifact
should match that tone: small, tight, no framework-scaffolding
on top of what's already in `docs/FACTORY-HYGIENE.md`. A
one-page audit table, not a new subsystem.

## Related

- `feedback_filename_content_match_hygiene_hard_to_enforce.md`
  — the specific hygiene rule that triggered this meta-
  observation.
- `feedback_crystallize_everything_lossless_compression_except_memory.md`
  — the companion "make the surface honest" policy.
- `feedback_missing_hygiene_class_gap_finder.md` — the
  *missing-class* tier-3 gap-finder; this meta-rule is the
  *imperfect-enforcement* tier-3 gap-finder's near-cousin.
- `docs/FACTORY-HYGIENE.md` — source of the rules to audit.
