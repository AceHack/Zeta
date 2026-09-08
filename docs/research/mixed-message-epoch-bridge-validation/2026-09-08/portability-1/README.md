# Bridge test portability custody

Operational status: research-grade validation evidence
Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra

The [owner report](../../../2026-09-08-mixed-message-epoch-bridge-test-portability.md)
explains the test-only correction and exact source cuts.
[manifest.json](manifest.json) indexes 99 lossless original files in
[custody.tar.gz](custody.tar.gz): 2,717,190 original bytes, 569,543 stored bytes,
SHA256 `750AE2E4405A039650A13657CB65615069646EBE726D36AA2D74C1AFCFF5D7B0`.

The root 110-pass/one-failure run, prior repository-local basetemp success,
owner unchanged one-failure reproduction, corrected 111-test returns and
initial formatter diagnostic remain distinct. Production source is unchanged.
The full preflight failed its build with compiler exit 139 while its other
17 checks passed. The unchanged build retry passed independently. The original
compiler failure remains unresolved; no successful gate is fabricated.

Commands, source snapshots, complete stdout/stderr and completion records are
retained. The original coordinator completion also contains its argv; there
was no separate original invocation JSON. The current-copy label on the older
development helper is deliberate; the actual historical invocation and test
bytes are retained alongside it. The formatter records unsupported F# project
warnings. No named M4/M5, frozen nested-query or standalone numerical producer
was invoked by this correction.
