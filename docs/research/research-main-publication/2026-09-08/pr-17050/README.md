# PR 17050: research receipt publication verified on main

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade verification record

[PR #17050](https://github.com/Lucent-Financial-Group/Zeta/pull/17050) merged
at 08:20:24 UTC. Reviewed head `2d6161be620d6af3897a7651e11477753a4b7319`
landed as squash `0d29df2db91b001bb1b7e39f6c55e906116f328b`.
The [manifest](manifest.json) binds all 55 original records in the
[custody archive](custody.tar.gz), checked by complete gzip decoding and member
hashes without extraction. It preserves the final live check observation,
required gate and main rules, dependency status, actual normal merge invocation,
command completion and subsequent main/tree/shared-view verification.

The final complete GraphQL observation has 88 successful and three skipped
checks, no failed or unfinished check and no unresolved review thread. Both
connections have no next page. The separately read required gate succeeded;
the relevant GitHub components were operational before the normal matched-head
squash. Actual argv, start/end times, stdout/stderr and exit zero are retained.
No administrative bypass, force push or published amendment was used.

The expected and merged whole tree is
`ce3144e4055510aafecec30ff5d7dc95ff787e19`. All seventeen changed paths counted
with `--no-renames` match the expected merge and immediately observed main.
The merge is an ancestor of that main. The shared main view was clean before
and after its sole `git pull --ff-only` refresh to `0d29df2db91b001bb1b7e39f6c55e906116f328b`.
These are dated observations, not a future lock on repository state.

This PR made the earlier magnet/oracle main receipts and the paused compiled
investment disposition durable. Its [independent pre-merge review](../../../2026-09-08-pr17050-publication-independent-review.md)
remains distinct from this post-merge observation. This preservation adds no
numerical experiment or new scientific claim.
