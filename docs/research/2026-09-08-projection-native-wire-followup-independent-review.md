# Independent native projection Unicode wire correction review

Date: 2026-09-08 UTC
Operational status: research-grade
Status: narrow source correction and retained evidence accepted
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

I accept the narrow correction e3b87af8f33f09476e939ebbc4f78360c3aa7d1d
and its evidence at 763578f7b91bdd2b720b6c7f16da5e12d2597c32.
The [original source acceptance](2026-09-08-projection-native-source-independent-review.md)
remains unchanged in history. This follow-up records the real wire-classification
defect found after that review and its subsequent correction. The original
bf2da44b94e770d21add73ce53dacb8fb34259bf acceptance must be read with this
qualification, rather than treated as proof that the original wire boundary
was complete.

The later source inspection identified that JsonDocument parse/clone admission
did not necessarily decode a string's escapes. A later JsonElement.GetString
could reject an unpaired surrogate outside the wire exception boundary.
Versioned .NET source corroborates this mechanism: the document's string path
calls deferred unescaping, and its unescaping helper rejects incomplete UTF-16.
These are versioned source explanations, not an asserted binary identity match.
See [JsonDocument at v10.0.0](https://github.com/dotnet/runtime/blob/v10.0.0/src/libraries/System.Text.Json/src/System/Text/Json/Document/JsonDocument.cs)
and [its unescaping helper](https://github.com/dotnet/runtime/blob/v10.0.0/src/libraries/System.Text.Json/src/System/Text/Json/Reader/JsonReaderHelper.Unescaping.cs).

The author then executed one newly added nonnumeric malformed-wire fixture
against the exact original producer source. It failed at 2026-09-08
06:52:41.063383 UTC with process exit 1. The actual return was Unexpected at
input, Field null, Message CannotReadIncompleteUTF16, all seven numerical
counters zero, all partial-result fields null and one failed input trace row.
The full observed receipt is preserved as F# representation in the actual
failure output and TRX; it is not described as an independently encoded JSON
receipt. This is an implementation classification defect, not a numerical
solver observation.

The correction catches InvalidOperationException inside stringField and
returns Wire at input with the actual field and exception message. The whole
producer file outside that function is byte-identical to the original; Replay
is also byte-identical. It adds one original high-surrogate regression, five
field/high/low-surrogate controls, and one valid-pair/escaped-digit control.
The valid pair reaches the decimal grammar boundary, and the escaped zero
remains admitted. The correction therefore does not achieve green tests by
rejecting every escaped string.

The final producer is 36,804 bytes, SHA256
05f0dd3d50011698a198d68e2ca5aa0741855f79c5abc97d235700fbabde465e.
Its tests are 20,227 bytes, SHA256
a30c59c6d35878fc57cc0c0ae3bd563bada13d2bd035ee42ac84ceb7fa773857.
Both equal their retained corrected-attempt snapshots and exact e3b87 blobs.
The corrected focused process completed at 2026-09-08 06:55:01.201075 UTC,
exit 0, empty stderr, with all 41 TRX results passed and no skips. Those 41
include the prior numerical unit controls; they are not the final registered
40-case/88-call workload.

The independent [custody audit](projection-native-wire-followup-review/2026-09-08/README.md)
checks all 16 stored records against bounded single-member decompression,
raw hashes, original files, both invocation source tables and actual TRX
rows. Totals are 209,118 original / 47,336 stored bytes. The original failure
uses exact bf2da producer bytes plus its separately identified new test.
The archive also retains the documentation draft and an explicitly labeled
tool-observation transcription of its initial blank-line lint refusal;
the transcription is not claimed to be raw stderr.

The previous full all-18 gate remains evidence for the historical source cut.
This follow-up admits the corrected source and focused test evidence only;
it does not assert a corrected full-gate result, actual final comparison,
reference-output agreement, learned-system result or machine-code closure.
No project code or numerical workload was executed by this review.

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
