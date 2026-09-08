# Independent initial projection process review findings

Date: 2026-09-08 UTC
Operational status: research-grade
Status: correction required before process-source acceptance
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

I independently read the whole process module, dedicated tests and report at
b575e34bd5cda05176ee14f89aedb2fa10edbb96. The process module has 33,669
bytes, SHA256 0a643cc17f39e2536caa963a1cfd6e200d83cca91cc443799d45c7316e54e6de.
It is not accepted at this cut. Two concrete failure-retention and resource
ownership defects need correction. The [retained failing controls](projection-process-initial-review/2026-09-08/README.md)
were executed by the author against exact copied b575 module bytes; this review
reads them without executing project code or a child.

1. Reviewer finding: after a timed reader join, capture unconditionally closes
   both pipes even when a reader remains alive or its join failed. The later
   ReadersClosed=false does not repair closing a reader-owned stream while it
   may still be using that descriptor. The actual synthetic unjoined-reader
   fixture uses real files and shows both closed despite the failed join.
   It failed with process exit 1, one failed / 20 deselected tests. This is a
   source/ownership discriminator; it is not an observed runaway native child.
2. Author finding: the file reader retains output identity before closing, but
   launch assigns Receipt only when that helper returns. A close exception after
   complete reading can therefore leave Receipt null despite available bytes.
   The actual real-close-then-OSError fixture retained its output file and
   returned null Receipt. It failed with process exit 1, one failed / 21
   deselected tests. The full original result prefix and failure output remain
   distinct from any later correction.

The proposed correction uses nonblocking pipe reads, finite readiness waits
and explicit cancellation, followed by a second bounded join. It closes a
pipe only after its reader is known finished; a remaining reader keeps pipe
ownership and an explicit refusal. An output-only available-bytes callback
records receipt bytes before fallible identity observation or close. I read
that isolated draft diff and found the direction appropriate. No acceptance
of an uncommitted draft or unobserved final gate is implied; the final source,
tests and correction custody must be reviewed at their separate immutable pin.

Other inspected boundaries are consistent with the stated limited purpose:
five independently supplied file identities, three literal copied references
with exactly two actual producer assembly observations, finite regular-file
reads, exclusive outputs, exact bounded input/binding/argument admission,
actual PID/exit/stream fields, independent before/after file observations,
and command-versus-receipt identity/counter/length correspondence. Receipt and
stdout metadata are retained independently when available. The typed prepared
record is explicitly caller-admitted, not an unforgeable capability. The
inherited environment, direct-child scope and lack of transitive runtime or
hostile-namespace proof remain declared limits.

The retained 20-test preparation precedes these findings. Numerical/trace
admission belongs to the independent certificate; synthetic transport receipts
must not be promoted to scientific results. No final 40-case/88-call workload,
new native solve, source stream or reference result was executed or inspected
by this review.

~~~text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
~~~
