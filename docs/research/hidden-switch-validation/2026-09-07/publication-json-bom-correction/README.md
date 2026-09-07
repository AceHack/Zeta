# Publication artifact: embedded log BOMs in a raw API response

Date: 2026-09-07
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05

At PR #16928 head `f3bd1347e490084f411198dc8abff197c817eb1b`, the
replacement workflow `34133618773` produced a real failed
`lint (semgrep drift)` job, `101780447107`. This failure belongs to that
replacement run; it is not one of the earlier superseded run's outcomes.
The [original job metadata](semgrep-drift-job-101780447107.json) and
[losslessly compressed full log](semgrep-drift-job-101780447107.log.gz)
remain retained. This review did not cancel, rerun or modify any job.

The `invisible-unicode-in-text` rule found three literal `U+FEFF` code
points in the retained API response
`docs/research/tlc-attempt-retention-validation/2026-09-07/publication/tlc-ci-merge-commit.json`.
The response is 711,308 bytes, SHA256
`040b64e0a36a7935f28aba75dc825040a1552910e47e3a3a10d2d61e44950205`.
The [exact finding record](finding.json) identifies zero-based UTF-8 byte
offsets 50,540, 182,327 and 305,632, in JSON paths
`$.files[6].patch`, `$.files[24].patch` and `$.files[32].patch`.
Those patches embed the original attribution, hygiene and race CI logs,
each of which began with a BOM. No scientific file caused this finding.

The accepted bounded correction is to retain that one raw API response
through lossless gzip, update its artifact links/inventory and disclose
both compressed and decompressed byte identities. Do not strip code
points, reserialize the JSON, alter original logs, suppress the rule or
change scientific sources/criteria/receipts. The old raw response remains
recoverable byte-for-byte, and the failed job remains failed. This record
establishes the diagnosis and intended correction; the coordinator owns
the actual artifact repair, verification and new-head CI.

The original failed job log is 3,779,217 bytes with SHA256
`3f32aa6a38c326f951b595e292257dc6be9737e9bb066ce6483f9cd68bbf29e7`.
The 666,728-byte gzip decompresses to those exact bytes. The
[evidence inventory](manifest.json) records the stored identities;
`finding.json` also retains the original and compressed log hashes.
No registered experiment or test suite was rerun for this diagnosis.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer.
