# Guarded controller: fresh replay of actual owned file cases

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed source and actual seven-case capture; full outer admission pending

The [file replayer](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_file_replay.py)
executes a caller-fixed member of the seven source-defined file cases in a new,
separate owned tree. It retains the actual prepared fixture and every returned
operation before result parsing, comparison or later audit failure. An expected
typed refusal is distinct from a missing result or a fixture/harness failure.
Operation names and roles come from the fixed source roster; producer values
are data. A missing late call keeps earlier calls and does not invent execution.

All actual typed operation results are compared through the unchanged complete
Type/Fields/BytesHex encoder. Integer/boolean/float distinctions, error codes,
paths and details remain exact. Fixture audits compare all fixed fields, setup,
operation/fault order, file kind/content and symlink targets. Only explicitly
named OS observations use a limited projection: root strings must match the
independently supplied associations, each logical file keeps its device/inode
pair within its own run, and faults identify that same target. Mode type must
match the kind; permissions, timestamps and directory sizes are bounded raw
observations whose numeric values need not match across fresh roots. Original
and replay bytes remain intact; these projections are not rewritten evidence
or independent authentication of the original OS observations.

Original roots are never opened or resolved. Lexical equality and either
ancestor direction between original and generated replay roots are refused
before any preparation or I/O. The actual fresh parent still undergoes the
existing canonical owned-parent check. Public root fields are explicit strings;
Path objects exist only at private I/O/lexical boundaries. The complete valid
prepared observation and full replay result therefore encode without extending
the shared result convention or replacing them by a partial summary.

## Source and actual failures retained

The first replay draft passed 32 tests and failed its truncated-gzip case. That
exposed the earlier fixture's filename-only refusal, now separately preserved
by the [gzip correction](2026-09-07-hidden-switch-compiled-gzip-fixture-correction.md).
Intermediate 33- and 39-test runs passed. Additional malformed helper-return
cases first reported the wrong failure boundary; two same-length malformed
returns then raised AttributeError. The corrected helper contract retains those
actual returns and all earlier calls. Initial committed replay source
`e5b7720215e01ac7204dbe7888c8e7cb7bdfa7d2` passed 44 tests.

An actual two-call capture at that source matched its operations, but complete
encoding refused at $.Preparation.Returned.Root because the prepared DTO held
a Path. The original calls, inputs, full textual replay representation and
actual encoder refusal remain retained; that attempt did not produce a complete
canonical replay artifact. The explicit string DTO correction closes this gap.

Independent review also found that a replay could regenerate a moved original
root or run in its subtree. Three owned equality/descendant/ancestor regressions
failed before the isolation correction and preserve their full actual results.
Final repair `e6238f8acc89c4d619c6631f0cb0111aa9258c20` passes all 81 focused
checks in 3.68 seconds: 34 file-fixture tests and 47 replay tests. Strict mypy,
Ruff and formatting pass. Every positive replay test encodes the complete actual
prepared fixture through the unchanged encoder. The
[independent source review](2026-09-07-hidden-switch-compiled-file-replay-review.md)
accepts these exact four corrected source/test files and their finite scope.

## Actual seven-case capture

After source acceptance, one separately named capture used the real record
store and separate producer/replay directories. It executed 11 original file
operations, then 11 fresh replay operations; all seven cases matched. It
retained 56 normal store records, successful once-only finalization and a fully
encoded capture receipt. Preparation/audit/store calls remain separate from
those 22 operation counts. This is the seven-case slice, not a complete 92-case
outer envelope or registered scientific run.

The [lossless manifest](hidden-switch-compiled-validation/2026-09-07/file-replay/manifest.json)
retains 132 artifacts: source versions, all test/type/style failures and repairs,
twelve owned trees, original encoder/overlap failures, the exact capture harness,
actual named store artifacts, full store-return receipts and final capture
receipt. The actual store tree contains 91 entries and 456,836 regular bytes.
Its 56 separately retained full store-return receipts contain 33,339,959 bytes,
within their explicit separate 64 MiB capture limit. That diagnostic receipt
budget is distinct from the store's reservation accounting and from process
memory. All trees use lstat inventories and preserve symlinks as links.

Independent auditing of these actual capture identities/associations is a
separate follow-up to source acceptance. The complete outer producer/replayer,
source/archive admission, native body/call closure and final actual-envelope
chain remain pending. No implementation archive or registered source/measurement
was created by this validation.
