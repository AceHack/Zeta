---
id: 081M1XQM8E4087G0R0036P5RWY
type: bug
state: done
priority: P1
slug: retain-tlc-failure-attempts-and-restrict-retries-to-jvm-star
title: "Retain TLC failure attempts and restrict retries to JVM startup"
created: 2026-09-07T10:46:36.740Z
completed: 2026-09-07T12:33:17.414Z
depends_on: []
composes_with: []
---

# Retain TLC failure attempts and restrict retries to JVM startup

Retain each unexpected TLC attempt with complete streams, exact invocation,
runtime/input identities and its own state/error directory. A later startup
recovery must not erase the earlier failure. Restrict retries in both runners
to a JVM that demonstrably failed before TLC started. Never retry model
violations, internal checker errors or fatal in-run JVM signals to obtain green.

The current witness is the hidden-switch native full-suite fingerprint
recovery failure followed by an unchanged isolated SIGBUS. Preserve those
failures as motivation; this task does not infer their root cause or alter
the registered models, jar, counts, timeouts or JVM policy.

Validation must include synthetic startup/crash/retention/no-overwrite
regressions and the full solution gate after the coordinated runtime diagnosis.
The failed original full gate remains failed; runtime diagnosis is a named
dependency, not an implicit skip.

## Preserved repair and validation

- [Repair report](../../../../docs/research/2026-09-07-tlc-attempt-retention.md)
- [Accepted independent source review](../../../../docs/research/2026-09-07-tlc-attempt-retention-review.md)
- [Focused checks and retained failures](../../../../docs/research/tlc-attempt-retention-validation/2026-09-07/README.md)

Source pins: `2e69017ff` and `07e399929`. The independent source review accepts the final repair. The combined
C1-policy/retention/hidden-switch full catalog gate passed at `457bdf094`:
7,552 passes, six existing skips, zero failures; build zero warnings/errors.
The focused PR follows C1 main integration and source-byte verification.

The C1 merge `536570576` is integrated. The 97 matching inputs and exactly
six additional project links in the larger gate are recorded explicitly.
Source/review/evidence ancestry is retained by the immutable supplemental
archive named in the report; required publication CI remains its own signal.

The [initial publication correction](../../../../docs/research/tlc-attempt-retention-validation/2026-09-07/ci-correction.md)
retains the visible-description attribution error and two additional CI
findings. TypeScript source-copy admission now uses the consumed descriptor;
its watchdog fixture no longer gives its child a wall-clock wake-up timer.
The original archive and failed runs remain unchanged.

The [final native correction/gate](../../../../docs/research/tlc-attempt-retention-validation/2026-09-07/ci-native-correction.md)
preserves accepted source `3149e2596` and full validation at integrated
`4b4d9a237`: 7,539 passes, six skips, zero failures; build zero
warnings/errors. The initial macOS startup-speed fixture failure remains
recorded. The supplemental correction archive preserves the final source
and evidence without moving the original ref.
