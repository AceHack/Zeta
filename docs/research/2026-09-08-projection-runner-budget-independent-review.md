# Independent shared runner budget review

Date: 2026-09-08 UTC
Operational status: research-grade
Status: bounded runner budget correction accepted; whole driver pending
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

I accept the narrow runner correction at
e133efe8324331d43187fd87c54bd4ea39c401f5, following the
[recording-component review](2026-09-08-projection-runner-draft-independent-review.md).
The [archive audit](projection-runner-budget-review/2026-09-08/README.md)
reads source and retained records without extraction, project imports, fixture
execution or final numerical work.

The runner now admits an issued fresh Store with combined allowance greater
than 10 MiB and no greater than 256 MiB, the unchanged 8-MiB journal and 3..512
artifact slots. Per-write checks still preserve its additional terminal slot
and 2-MiB combined reserve. Allowances can shrink but cannot exceed registered
ceilings. Four controls reject excessive slots, a changed journal, exhausted
terminal space and insufficient ordinary slots without mutation/finalization;
two smaller allowances exercise a retained synthetic launch failure. This
admission does not guarantee the first fixed record or the whole roster will
fit a marginal byte allowance. Later bounded refusal remains valid.

The accompanying source edits only capture an already admitted baseline for
closure typing, assert the already admitted receipt byte type and type two
storage-fault fixture arguments. The other two test edits remove import blank
lines. No numerical source or mathematical rule changes. The final runner is
25,597 bytes, SHA256
41D01A033295C28CC9D51F8510F4C3C1DF9BA87AF028A2D0E299835602BF9CF6;
its tests are 24,771 bytes, SHA256
4726B5CCD43F5B88674C7DEEF7C8B72033351C72DAFED7FE9CBAD10946FBB4C8.
Both match the second retained attempt and exact e133 blobs.

The coordinator's separate proposed outer reservation is arithmetically
consistent: 90 slots comprise four custody copies, one manifest, 27 times
three native attempt files, and four bounded metadata files. Its combined
reservation is twice the sum of script/three-DLL copy bytes, manifest bytes,
27 times the input/binding/receipt maxima, and four 1-MiB metadata maxima.
The inner Store receives the remaining bytes and slots, without refund after
partial failures. Those four metadata roles must be fixed by the driver and
no uncharged diagnostic or full RunResult files may be added. This is a
retention-accounting design, not an OS storage/heap quota, complete invocation
proof or an implemented whole-driver acceptance.

All 41 archived regular members match their length/hash table and original
files. The single-member gzip archive is 119,192 bytes; its tar has 583,680
bytes and regular-file payload totals 547,452 bytes. Both twelve-file source
snapshot tables match their copies and appropriate Git cuts. Attempt 1 binds
8100544b68573e00fa3e99aa51e94673ebbc25de and has 272 passes in 13.81 seconds,
two Ruff errors and eight mypy errors. Attempt 2 records that same base HEAD
with changed working source snapshots; those snapshots exactly match e133.
It has 28 runner passes in 5.46 seconds and clean Ruff/mypy for all twelve
listed files. The first failed MD012 claim-push hook remains raw evidence;
its bypass suggestion is log data, not an action taken by this review.

The integration snapshot still contains historical process b575, not the
subsequently [accepted 8254 process correction](2026-09-08-projection-process-correction-independent-review.md).
The corrected process, remaining driver, source-manifest admission and their
final integrated checks remain separate prerequisites. These component test
counts are not the registered 88 experimental calls. No final run is accepted
or opened by this review.

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
