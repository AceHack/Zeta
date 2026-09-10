# Otto ferry: independent custody index

Operational status: research-grade

The [signed review](../../2026-09-08-decorrelation-noninterference-ferry-review.md)
is the entry point. [manifest.json](manifest.json) binds eight lossless gzip
records: the PR17026 response, remote heads, both commands' actual stderr and
invocations, the exact already-public ferry, and the independent result.

[audit.py](audit.py) invokes only read-only Git/GitHub commands and reads the
named local attachment for its identity. It imports no repository modules,
executes no source tests, and does not execute the attachment's commands.
The attachment content itself is not stored in this directory. The result
binds 35 selected paths at two immutable commits; 34 are equal and the
PrivacyEconomy grant repair differs. These identities establish source
custody, not exhaustive implementation correctness.

The [selection-source manifest](selection-source-manifest.json) additionally
binds three exact main-cut source snapshots (58,243 original bytes) inspected
for the later oracle-selection clarification. Those files were read, not
executed. They are separate from the original 35-pair census.

The main branch advanced during capture. Its observed ref is retained
separately from the earlier inspected main commit. The PR was open at the
first recorded observation. The separate
[follow-up manifest](status-followup-manifest.json) binds three further
lossless records confirming merge at 2026-09-08T04:04:10Z, reviewed head
91737dd89910ac623b16a1e28f3309815846387d unchanged, squash
d4d317fbbf2ad1917ae84f9d4588a94d8c1af36c. This is preservation status,
not scientific or CI result admission. The
review includes the coordinator-relayed later user refinement explicitly,
without pretending it was present in the earlier attachment.

Final read-only verification checked all 14 single-member gzip records,
112,459 original bytes and 39,558 stored bytes, against their stored and raw
hashes. It rechecked all 35 source pairs and the three additional snapshots
against the exact Git blobs. Authored Markdown passed the scoped lint.
