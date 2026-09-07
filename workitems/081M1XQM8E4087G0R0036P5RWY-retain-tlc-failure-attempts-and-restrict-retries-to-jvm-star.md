---
id: 081M1XQM8E4087G0R0036P5RWY
type: bug
state: backlog
priority: P1
slug: retain-tlc-failure-attempts-and-restrict-retries-to-jvm-star
title: "Retain TLC failure attempts and restrict retries to JVM startup"
created: 2026-09-07T10:46:36.740Z
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
