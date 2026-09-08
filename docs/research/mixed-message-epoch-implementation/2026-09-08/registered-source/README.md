# Fixed invocation artifact, pending assembled admission

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade invocation preparation
Lifecycle: active
Status: source draft; no named route entered

[`invoke.py`](invoke.py) fixes the calling sequence for the existing
[source contract](../../../../2026-09-08-checked-mixed-message-module-epoch-source-contract.md),
[transport amendment](../../../../2026-09-08-mixed-message-epoch-transport-amendment.md)
and [separate frozen query](../../../../2026-09-08-mixed-message-frozen-nested-query-register.md).
The final source/runtime/service manifest, immutable archive and independent
assembled admission are still required before invoking it. Its presence is
not authorization to skip those unfinished checks.

The `m4` mode opens exactly `m4-registered-1` and enters session
`m4/registered-1`. A zero process exit reports bridge closure only; M4's expected
numerical refusal must be inspected against the actual returned candidate,
certificate and retained state before the coordinator separately invokes M5.
The script does not turn a closed result into a numerical pass verdict.

The `m5-and-frozen-nested` mode opens exactly `m5-registered-1`, using the four
sessions `m5/child-train/1`, `m5/query-2/1`, `m5/query-3/1`,
`m5/parent-train/1`. Each dependent plan receives the actual previous sealed
SessionResult. The first failed prerequisite stops later construction; the
actual bridge is finalized once even if construction raises. The frozen query
uses those two returned training artifacts in the same Python process, through
a separate bridge with its own unchanged budget, named `frozen-nested-1` and
session `frozen-nested/1`. It performs no replacement training.

Before entering that separate query, require M5's four closed sessions, four
actual peer launches, zero native preparation, ten forwards, eight learning
steps, zero projection requests, two entered training artifacts, complete zero
remote service counts and an actual finalized journal. A failed count or
custody prerequisite is retained and the query is not entered. These are
prerequisite discriminators, not a claim that the counts have been observed.
Other declared M1-M8 checks and final numerical/structural assessment remain
separate; this script does not compute a replacement forward or solver result.

Arguments after the mode are the canonical absolute source root, attempt
parent, dotnet host, service-manifest path and independently supplied manifest
SHA256. No data, model, budget or retry option exists. The first attempt names
are exclusive. A repair needs separately identified source and a newly named
registration, preserving the first actual outcome.

Caller stdout retains summaries of actual bridge results and references their
original Store records/journal. The complete BridgeResult remains in memory;
this file introduces no general serializer for that object graph. Failure
before complete publication must remain a custody limitation, never a claim
that missing originals were durably stored. The parent invocation must capture
its exact argv, stdout, stderr, timing, exit and actual attempt files.

The draft passed Ruff check/format and a strict mypy check of this one source
file. The [static-check records](static-1/manifest.json) retain the actual mypy
invocation and unchanged source identity. These checks perform no named
learning, peer, native or reference invocation and establish no runtime result.
