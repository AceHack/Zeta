---
name: Mix cadences up and let observations drive — Aaron 2026-04-20 "mix it up, you figure out what works best over time by look at real observations and data"
description: Aaron 2026-04-20 standing directive on how to calibrate audit / hygiene / quality-check cadences. Don't prescribe "every N rounds" rigidly; vary cadence, instrument runtime, observe which cadence correlates with catching real drift, and tune from data. Composes with the existing audit_personas.sh observability substrate and with pending Task #112 (skills-runtime audit).
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-20: *"mix it up, you figure out what works
best over time by look at real observations and data"*

## The rule

Audit / hygiene / quality-check cadences should be
**empirical, not prescribed**. Vary them, instrument
runtime, observe which cadence catches real drift,
tune from data.

## Why

Prescribed cadences in `round-open-checklist` §7.5
(factory-audit ~10r, factory-balance-auditor 5-10r,
skill-tune-up 5-10r, etc.) are untested claims about
the right frequency. Without instrumentation we're
guessing. Aaron's pattern — already visible in the
persona-runtime audit he asked for — is:

1. Instrument first (text-based, git-tracked, no
   external DB — the gitops observability pattern).
2. Vary the cadence intentionally.
3. Read the data.
4. Tune.

This matches his "doing it blind is no fun" /
"feel free to wait and use observability" directive
from the same session.

## How to apply

- **When tempted to pin a cadence prescriptively**,
  don't. Pin it as a *starting hypothesis* with a
  review checkpoint at ~5 invocations.
- **Prefer adding instrumentation over tightening
  prescription.** Task #112 (skills-runtime audit) is
  the current example — it would show which audits
  actually fire vs only prescribed.
- **Rotate intentionally.** "One quality thing per
  round, rotate which one" beats "all of them every
  10 rounds" as a starting rhythm, because it creates
  data across the full portfolio faster.
- **Treat §7.5 as v0.1**, not canon. Update it from
  observed signal, not from reasoning.

## Cross-references

- `feedback_precise_language_wins_arguments.md` —
  similar axis: ground claims in evidence, not in
  rhetoric.
- `user_relational_memory_not_episodic_dates.md` —
  Aaron holds structure, agents hold instrumentation
  + dates + counts.
- `project_factory_as_externalisation.md` —
  empirical-cadence is one dimension of "agents act
  at his resolution without being told".
- `user_vocabulary_first_aspirational_stance.md` —
  same stance-not-theorem posture: cadence is a
  stance to be falsified by data, not a theorem.
