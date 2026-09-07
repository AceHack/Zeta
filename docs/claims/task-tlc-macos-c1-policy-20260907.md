# Claim - task-tlc-macos-c1-policy-20260907

- **Session ID:** codex/tlc-c1-policy-20260907-740d
- **Harness:** codex
- **Claimed at:** 2026-09-07T06:54:47-04:00
- **ETA:** Policy candidate, retained diagnostic evidence and independent review this session.
- **Scope:** Pin C1-only compilation for TLC on macOS ARM64 after two retained alternate-runtime diagnostics; preserve all observed failures and avoid a root-cause claim.
- **Durable target:** `workitems/081M1XR248G087G0R000H0WJT1-pin-c1-for-tlc-on-macos-arm64-after-in-run-runtime-failures.md` and `docs/research/2026-09-07-tlc-macos-c1-policy.md`.

## Notes

This claim owns the platform-specific registry entry, the direct F#/TypeScript
JVM-policy assertions, current policy comments and the indexed evidence record.
The separate `081M1XQM8E4087G0R0036P5RWY` retention claim owns process execution,
failure preservation and startup-only retry parity. The two writers coordinate
the distinct regions of `Tlc.Runner.Tests.fs` before integration.

No model, configuration, jar, expected state count, timeout, retry rule or
hidden-switch scientific source is changed by this claim. Two successful direct
C1 runs are evidence for a bounded platform workaround, not a causal diagnosis,
a general stability theorem or replacements for failed pinned-policy gates.
