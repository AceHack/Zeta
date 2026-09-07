---
id: 081M1XR248G087G0R000H0WJT1
type: bug
state: done
priority: P2
slug: pin-c1-for-tlc-on-macos-arm64-after-in-run-runtime-failures
title: "Pin C1 for TLC on macOS ARM64 after in-run runtime failures"
created: 2026-09-07T10:54:11.216Z
depends_on: []
composes_with: []
---

# Pin C1 for TLC on macOS ARM64 after in-run runtime failures

The shared TLC registry now selects C1 only on macOS ARM64. Two in-run
OpenJDK 26 failures and two successful direct C1 diagnostics are retained in
the [policy record](../../../../docs/research/2026-09-07-tlc-macos-c1-policy.md), without
claiming a cause or general stability. The F#/TypeScript policy assertions
cover the exact platform addition and preserve all other platform paths.

The own-tree candidate gate at `47d29d9cb2dc7ebb2cf36135b6699bb9a0d66839`
passed 7,529 native tests with six existing skips, including all 52 TLC gate
models. Release build had zero warnings/errors; 17 focused TypeScript tests/88
assertions and all sixteen quick checks passed. Formatter exited zero with
retained workspace/unsupported-F# notices, not an F# formatting proof.
Independent source/evidence review accepted the change and its limits.

No jar, model/configuration, expected count, heap/worker setting, timeout or
retry rule changes. Failure preservation/startup-retry parity is a separate
coordinated work item, `081M1XQM8E4087G0R0036P5RWY`.

Final evidence review verified all 28 retained records, seven original TRX
streams, 95 source pins and the complete 52-case TLC roster. Claim released
for the focused publication; no policy code or registry change followed the tested commit.

Publication CI exposed NCI tests replaying historical receipts against the
changed live registry. The indexed correction retains the exact old registry
as a historical fixture, all four original pins and both scientific receipts,
and tests live-registry refusal in Python and TypeScript. Python's named
exception now permits traceback assignment so the real refusal is retained.
Core.Python passed 60 tests; both Bun versions passed 20 NCI tests with 40
assertions. Independent review accepted this bounded integration correction.
