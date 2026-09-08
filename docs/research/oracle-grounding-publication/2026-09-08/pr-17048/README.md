# PR 17048: oracle clarification main verification

Date: 2026-09-08
Operational status: research-grade verification record

[PR #17048](https://github.com/Lucent-Financial-Group/Zeta/pull/17048) merged
at 07:02:15 UTC. Reviewed head `b71d9a720cca3e9f2cc5b269e63f3b99b0a23e8c`
landed as squash `b6bb61f2b255093790f8bdf84dc1b6f0f612f4d9`.
The [manifest](manifest.json) indexes every retained member in the lossless
[custody archive](custody.tar.gz). Each stored/raw identity was verified by
reading the archive without extraction.

The final complete bounded observation has 90 successful checks, two skipped
checks, no failed/pending/running check and no unresolved review thread.
The required gate was separately read as successful. Live branch rules named
`gate (required)` with integration 15368 and non-strict base freshness; the
GitHub Pull Requests/Actions/API/Webhooks components were operational before
the normal squash command. Actual argv, UTC interval, stdout/stderr and exit 0
are retained. No administrative bypass or force operation was used.

The exact whole three-way tree is
`a21cac6b0495f8e32ec14956b728a7d0b0a96f38`. All 126 changed paths, counted with
`--no-renames`, match the expected merge and the immediately observed main.
Merge ancestry is verified. The shared view was clean main at `3f241c5b8d`
and was refreshed only by `git pull --ff-only` to `b6bb61f2b2`; it remained
clean and contained the merge. These are dated observations, not a future lock.

The earlier failed hygiene check is preserved: `result-identity.json` matched
an ignore rule. Its unchanged content was renamed to
`receipt-byte-identity.json`, references were corrected, the focused check
passed and the complete later CI passed. The initial unused-import review was
fixed while preserving the original helper source and historical audit identity;
the host's later complete observation records that thread resolved/outdated.
No retrospective thread-resolution mutation is invented.

The first job-log request was rejected while its workflow was active, and the
first direct log fetch refused terminal escapes. Those diagnostics were observed
in the tool result; no separate raw stderr record was captured for those two
retrieval failures. The successful escape-preserving job log is included, as are
any actual empty output files from the unsuccessful attempts. The two defects,
their original evidence, and the successful replacements remain distinct.
