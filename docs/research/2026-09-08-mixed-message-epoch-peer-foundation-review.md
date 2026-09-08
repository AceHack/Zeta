# Mixed-message peer foundation: bounded source review

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade source review
Lifecycle: active
Disposition: bounded foundation read; complete peer acceptance remains pending
Work item: 081M1Z63YMC087G0R003N5FH9X

I read the immutable single peer source at
`a59bffb096d41a854a3dc55b82c3ffcd594d2950`,
`src/Research.FSharp/MixedMessageEpochReplay.fsx`: 62,223 bytes, SHA256
`A167B6F42792AE82A601516CD58F6724CE15B13B8BB975AAB74468D7A5221F8A`.
This pass read source only. It did not execute the peer, codecs, numerical
services, native targets or the owner's synthetic checks.

The inspected foundation contains cooperative stream transport, strict JSON
and Start admission, four direct-source observations, retained core admission
returns, bounded canonical envelope construction, and passive ACK/projection
response correspondence. Output failure is latched; a later frame is refused.
Pending timed-out I/O retains task/buffer ownership rather than racing stream
disposal. First observed incoming bytes charge a frame; empty EOF does not.
Global budget prefixes replace rather than sum already counted positions, with
the containing frame accounted separately. Canonical envelope construction
reserves fixed header/LF room and retains the actual codec result before a
later allocation can fail.

The direct-source reader has an explicit macOS ABI premise and bounded same-
descriptor observation. It does not claim hostile parent-directory isolation,
transitive loaded-code closure, or an OS resource quota. The ACK verifier uses
the selected unchanged Store's identity descriptor and complete original-frame
hash. Descriptor paths remain passive. Projection responses retain actual
bounded decoder returns before identity checks and defer numerical admission
to the separately owned core. Matching hashes alone do not prove execution.

No additional peer foundation defect was established by this source pass.
Its 256-character printable flat-binding-key guard agrees with the current
compiled core's `bindingsValid`. The Python bridge's broader source-path
admission was separately reported to the coordinator and reproduced using pure
manifest inputs; it is an outer-admission mismatch, not a peer finding. General
local admission caps and the peer's narrower direct-source caps are separate
checks; the actual assembled registration must satisfy every phase.

The file is explicitly incomplete: it does not yet implement the final main,
recorder/service callbacks, actual runEpoch invocation, EpochReturn exchange,
Terminal lifecycle or whole-session failure cleanup. This note does not accept
that missing lifecycle, the final 132-entry manifest, the source-to-runtime
premise, or any named M4/M5/nested-query result. Complete peer source review and
registered assembled controls remain necessary after the owner pins that work.

The exact reviewed source and this original note are retained in the bridge's
[correction custody](mixed-message-epoch-bridge-validation/2026-09-08/correction-1/README.md).
The Python path mismatch and its independently observed pure-manifest refusals
are tracked in the separate
[owner correction report](2026-09-08-mixed-message-epoch-bridge-corrections.md).
