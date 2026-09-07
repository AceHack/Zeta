# Claim - task-tlc-attempt-retention-20260907

- **Session ID:** codex/tlc-attempt-retention-20260907
- **Harness:** codex
- **Claimed at:** 2026-09-07T10:49:18.990403+00:00
- **ETA:** after the coordinated runtime diagnostics and full local gates
- **Scope:** preserve TLC attempt diagnostics and align startup-only retry semantics
- **Durable target:** work item 081M1XQM8E4087G0R0036P5RWY and a focused factory repair PR

## Notes

Owns F# TLC process execution, retry and synthetic tests; TypeScript
run-tlc execution, retention helpers and synthetic tests; diagnostic upload
wiring and indexed validation. Registry/model/jar/state counts/timeouts and
JVM policy remain unchanged. The independent runtime-policy lane owns those
policy comments/assertions if its two direct diagnostics establish evidence.

Initial claim publication is held for the coordinated JVM quiet window;
source edits are explicitly authorized by the coordinating parent. No
heavy build, tests or quick preflight until that window is released.
