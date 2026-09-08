# Guarded controller: outer artifact read review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: bounded actual-read primitive accepted after exception repair

This read-only review binds initial coordinator source
`8c50250f8978e159be049c400973933ae638c22a` and correction
`0e0008386865202805ab32450c298be9049228a9`. The final artifact-reader
module is 7,194 bytes, SHA-256
`b080371d01e61b045a3eb6bcf33feb8af4f5d0b99e5105398fef7bcfd98e8018`;
its test file is 12,080 bytes, SHA-256
`eb51d77ca23ca815aa504c2a4b03fdfe9cbaaef386cb160daa4aed992627b76a`.
I read the complete source/tests and verified current bytes against that pin.
No test, fixture, actual envelope replay, native process, source stream or
measurement was executed by this reviewer.

The corrected outer-structure validator runs before any artifact read. Each
unique File then invokes the actual strict read_artifact helper once with the
exact stored/original bounds from its admitted descriptor. Exact repeated
aliases point to the same retained read result; they do not reopen a changed
path or assert future immutability. The aggregate 256 MiB implementation cap
charges original envelope length and both declared stored/original lengths of
each unique file before reading. A failed read keeps its reservation. Parser
objects, caller allocations and Python overhead are separate from this bound.

The result retains all actual read returns and ordered reference-to-read
associations. A typed refusal is preserved as the actual result. Untyped or
wrong admitted values remain incomplete rather than becoming successful
negative evidence. Accepted bytes are independently checked for the planned
original length/hash after the shared helper's strict storage/gzip checks.
The first failure preserves successful earlier bytes and the failing reference;
a budget refusal occurs before the next helper call.

The initial source caught only four ordinary exception families around the
reader. A custom Exception or KeyError could escape after prior reads and lose
the promised typed prefix. I requested the same narrowly documented ordinary
Exception boundary as the accepted record store. Two late-reader regressions
failed against the original source, then passed after that correction. They
require the eight earlier admitted reads, exact associations, observed raised
type/detail, Returned=false and no fabricated ActualResult. BaseException
control-flow subclasses remain outside this boundary. The BLE001 rationale
is scoped to this helper observation site; it does not suppress other errors
or turn a raised exception into an admitted result.

The tests also exercise actual missing, symlink, changed and extra-byte files;
a valid gzip and a rejected trailing member; exact aggregate thresholds;
invalid roots/limits/raw envelopes; and independent prerequisite identity
refusal before any filesystem read. The alias fixture changes a file after
its real first read and verifies subsequent references use retained bytes.
A complete synthetic structural plan can be read while OutcomeReplay remains
explicitly not performed.

I read the original 23-test pass, both discriminating pre-repair failures, and
the final 25-test pass in 4.05 seconds with strict source/test mypy. The first
broad-catch lint diagnostic is retained; final Ruff and format-check logs pass
with unchanged executable repair statements. The owner is preserving original,
failed-regression and final owned fixture trees separately. No additional
material source or scope issue remains. This binds actual referenced bytes
only: producer-source/runtime identity, operation-outcome replay, complete
outer conformance and scientific admission remain separate obligations.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
