# Independent projection process correction acceptance

Date: 2026-09-08 UTC
Operational status: research-grade
Status: bounded process source and correction custody accepted
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

I accept the bounded process component at
8254c827044100df1646369f1b0143ec994d5a07 and correction custody at
59e1867c98b3620ae0af2c96fb5740a0ac8cd904. This closes both findings in the
[original b575 review](2026-09-08-projection-process-initial-independent-review.md),
which remains preserved without rewriting its failed controls. I read the
complete original module/tests/report and the exact correction diff. The
[stdlib custody audit](projection-process-correction-review/2026-09-08/README.md)
executes no project, fixture, child, solver or final numerical case.

The corrected module has 35,009 bytes, SHA256
ec3eada6da2ac70067eee2ce7121f2c553fc9817f6f147fa18965d2e8729ef88.
The tests have 19,857 bytes, SHA256
98a5fe6be65318c41128901507f62bb927487a7425071b9ac0fa72a3117373ef.
Both equal exact 8254 Git blobs and the retained fourth test attempt. The public
dataclasses, preparation function, command admission and binding encoding
remain unchanged by AST. The F# numerical producer and Replay files remain
byte-identical across b575 and 8254.

Reader pumps now use nonblocking descriptors and finite readiness waits. After
direct-child cleanup, each reader receives a bounded join; a still-live reader
is cancelled and joined again. Its pipe closes only when that reader is known
finished. A remaining reader retains pipe ownership with a refusal, and the
returned bytes are only its available prefix. Missing EOF still refuses even
when cancellation succeeds. Reader completion, direct-child close, primary
failure and cleanup outcomes remain distinct.

The output read now assigns the actual bounded receipt bytes through a narrow
available callback before fallible hash observation and descriptor close. A
close error therefore preserves Receipt, output identity and available producer
metadata while keeping the close failure and Complete=false. The callback does
not admit an oversized or unstable file and does not turn a failed read into a
successful transport result.

Three added controls discriminate these changes: a synthetic unjoined reader
with real files keeps its pipes open; a real pipe with its owned writer still
open can cancel/join the reader and refuses absent EOF; and a real-close-then-
OSError retains the already-read receipt and exactly-once close observation.
The first and third controls failed against exact copied b575 source before
correction. Their original modules, tests, complete outputs and invocation
records remain available both in the original review custody and the author's
correction archive.

The accepted transport scope remains deliberately finite: exactly the declared
host, script and three literal copied reference files; per-file regular
same-descriptor reads with caps and checked deadlines; exclusive input/output
paths; bounded streams and exact argv; and two actual producer assembly
observations corresponding to Core and Bayesian. Core.Abstractions has copy
and before/after custody without an invented producer observation. Independent
caller expectations and the exact script hash remain load-bearing. This is
not arbitrary F# directive validation, an unforgeable preparation capability,
a hostile-namespace sandbox or a transitive runtime proof.

All 66 preparation records at 929a7e13afc302aa5d9a79ae7943d1607bb08557
match their stored, bounded single-member raw and original-file identities:
266,984 original / 70,582 stored bytes. All 52 correction records match as
well: 282,514 / 71,477 bytes. Each manifest's 14 source/contract/wiring pins
matches its exact stated source cut. Final module/test snapshots correspond
to their respective b575 and 8254 commits; both original failed-control module
copies equal b575.

The retained original suites show 13, 17 and 20 transport passes with their
actual typing/style history. The final repository-source run shows 23 passes
in 5.32 seconds, empty test stderr, and clean strict typing and Ruff outcomes.
These fixtures use small owned Python children, real files and explicit
synthetic seams; no F# final subject or reference solver was invoked by them.
The separately reported intermediate 23-pass draft lacks its exact pre-formatter
source preimage. Its output is preserved but is not substituted for the later
source-bound run. That limitation is explicit in the author's report.

The retained full-preflight invocation names historical b575, exits zero and
reports all 18 executed checks passed. It is not assigned to corrected 8254.
The final-source full gate was still pending at this archive cut and is a
separate integration prerequisite. This source/custody acceptance does not
supply that future result, independent source-manifest admission, shared run
budget validation or any final 40-case/88-call observation. Numerical and
native trace admission continue to belong to the independent certificate.

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
