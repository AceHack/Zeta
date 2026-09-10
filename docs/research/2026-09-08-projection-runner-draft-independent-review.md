# Independent projection runner draft and correction review

Date: 2026-09-08 UTC
Operational status: research-grade
Status: recording component source accepted; final integration and run pending
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

I accept the bounded recording component at
c124a621db83d96894310cb079be20d942ebc45e after independently reading its
source and all 22 synthetic test cases. This accepts the correction of the two
findings below, not final process-module integration, strict typing against
that module, complete source admission or execution of the registered roster.
The [custody audit](projection-runner-draft-review/2026-09-08/README.md) reads
source, ASTs and retained bytes only; it imports no project and runs no fixture,
solver, native service or final evaluation.

The module is 25,193 bytes, SHA256
aada2881e4200760d66fbde688a93f314a99fb061d03f408f68880e384a8b7f0.
The tests are 22,687 bytes, SHA256
6c418f7e8f44037ea03623379326c2b04090863eb61d981629610fe19f840d24.
Both equal the retained eighth attempt and exact c124 blobs. The original
reviewed draft remains 2e051e8d0e5715dc3da6aa5176037d25598e74df.

Two independent findings were reported against that original draft:

1. Preparation, store snapshots and comparison included unobserved ordinary
   exception paths. An OSError in comparison after a service return could
   escape the public runner, losing the caller's access to the local observation
   ledger and preventing finalization.
2. A normally returned Success wrapper with None or 42, or a transport carrying
   JSON null, could increase CompleteReceipts without a receipt envelope.
   Normal return and complete receipt were therefore conflated.

The author retained all four failing controls: one escaped comparison failure
and three incorrect completion counts. That executed fifth snapshot already
contained the author's Services caller-admission addition; it is not the entire
original 2e051 file. Independent AST comparison confirms its `_Run`, `_observe`
and `reference_services` definitions equal the original reviewed definitions.
This preserves the exact executed source while establishing that the affected
recording behavior was unchanged.

The correction observes preparation, snapshots, comparisons and each slot,
retaining helper returns or raised type/message before admission. The actual
service observation is still assigned before later parsing, encoding, storage
or comparison. Ordinary helper failures preserve the first failure, stop the
next slot and reach the bounded finalization path. A final-envelope exception
returns the actual earlier entries and helper observations; its guard never
re-enters finalization once attempted. The fallback marks its pending plan
unverified, rather than claiming those slots failed or completed.

Three callable Services and a fresh issued Store are required before work.
Used or finalized stores are not appended or finalized again. Minimal actual
receipt-envelope shape now precedes CompleteReceipt, while malformed values
remain recorded as actual normal returns. A comparison must actually return
Admitted with an Assessment value before it counts as checked. Full service
schema, numerical trace admission, source identity and physical invocation are
explicitly separate. CompleteReceipts here means a returned service envelope,
not independently proved full-schema or mathematical admission.

The runner follows the fixed ordered 88-slot plan. It retains the exact native
process observation and raw receipt separately; Python outer failures and
encoding refusals keep their original returned objects in memory. While the
store is healthy, bounded retention of the current failed return is permitted
after setting its primary failure. It cannot start another slot or bypass the
store's first refusal. The 256-MiB combined store reservation already includes
its 8-MiB journal; the runner separately preserves one ordinary slot and 2 MiB
combined space for its own bounded terminal metadata. It does not claim these
are peak-memory limits. Once-only finalization and original failure precedence
have dedicated controls.

The twelve certificate controls require the retained unconstructed native
baseline, its actual reference enclosure and an actual returned Certified
assessment before mutation. Every mutation starts from the same original
native bytes. This dependency composes with independently admitted service
implementations; disposable callbacks and the synthetic positive 88-slot test
cannot establish that external premise. CollectionAndCriteriaPassed is an
accurately limited recording/criteria result. It must not be renamed or
reported as complete scientific, process, source or runtime admission.

All 40 original custody records and all 46 follow-up records match their
manifested stored, single-member raw and original-file identities. Totals are
488,456 original / 159,494 stored bytes and 536,890 / 171,016 bytes respectively.
Each group includes four incidental Python cache records; they were checked as
bytes, not loaded, and do not establish runtime closure. All eight copied draft
process modules match their independently retained bootstrap hash. They served
only as NativeObservation fixture constructors, not as actual process launches.

The original suites retain 9/11/12/13 passes, including the first three pytest
bootstrap warnings. The follow-up retains four failed controls, 18 passes with
three Ruff closure diagnostics, then distinct 20/22 passes with Ruff clean.
The final 22-pass suite took 0.47 seconds. Strict typing and ordinary module
integration remain pending the process owner's final pin. The first 2e051
normal push reached its remote and passed its hook, but the author edited the
workspace during that hook. Its raw log and remote proof remain preserved;
that mixed-workspace check is not assigned exact-head validation status.

The review's first read-only exploratory manifest helper used Bytes instead
of this archive's RawBytes and stopped with KeyError before verification. Its
[tool-observed disposition](projection-runner-draft-review/2026-09-08/inspection-first-tool-observation.json)
is retained separately; the corrected audit uses the actual explicit schema.
No archive or project source was changed to make that audit pass.

The separate process launcher still requires its own source/custody review.
The corrected reference and native Unicode sources must be integrated at their
accepted pins, followed by the required integrated checks and immutable source
map before any final run. This review neither opens that run nor supplies its
results from the synthetic controls.

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
