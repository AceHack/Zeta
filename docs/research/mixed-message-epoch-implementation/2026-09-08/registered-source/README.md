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

## Launcher review and repair

The first static-clean artifact at `87bc6b28a` still had two runtime boundary
defects found by independent source review. A FIFO manifest stalled after the
fixture's READY marker until its 500-ms watchdog killed the isolated Python
child. A separate synthetic session RuntimeError was followed by a finalization
OSError, which became the top-level raised outcome; Python retained the earlier
exception in its context, not as an independent caller observation. Those exact
original source and observations remain in the
[review/repair records](review-repair-1/manifest.json).

The correction uses observed lstat metadata only to supply a length to the
existing descriptor-relative `read_exact` helper. That helper admits a regular
file with no-follow/nonblocking open, exact size and the 64-KiB cap; service
admission still checks the independently supplied SHA256. Its actual public
return and raised outcome are retained separately from later setup.

The existing `_observe` helper now retains ordinary call, finalization and
console outcomes separately. A returned BridgeResult is held before summary
encoding. Session/plan failure cannot be replaced by a later finish or console
exception in this declared ordinary-Exception scope. CallerObservations reports
operation names, actual returned scalar/failure values and bounded raised
records; it does not serialize the full object graph or guarantee stdout/stderr
delivery after a console failure. There is one separate stderr attempt, without
recursive recovery. Process termination outside that scope remains an external
observation, not a fabricated closed result.

The corrected final source is SHA256
`CC7FBF89E681909374591516B4227F3D93373E9B5F089C039994B0CA46055E69`.
It passes strict mypy/Ruff/format. Two synthetic retention fixtures preserve the
primary plus secondary errors and, when returned, the exact synthetic result
object before a console exception. The FIFO now returns the actual
regular-file refusal and exits 2 before the watchdog. These three development
controls enter no peer, learner, native producer or interval reference. Earlier
repair formatting and two mypy narrowing failures remain preserved separately;
the final checks are not assigned to those earlier source bytes.

Independent follow-through source review accepts these two repaired edges for
that declared scope; final immutable source admission and named execution
remain pending. Special FIFO entries are recorded by mode and never read into
the preservation archive.
