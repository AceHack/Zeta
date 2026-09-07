# PR #16928: final checked head and verified main publication

Date: 2026-09-07
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05

PR #16928 merged at **15:16:24 UTC** as
`1193d505de42f7a9406e64389f1496a311fc4b28`, from checked head
`f99c9f4e2502263943d899ec7a506aa287f76558`. This independent
publication review preserves the final hosting state and committed-byte
correspondence. It does not reopen the study's released claim, rerun an
experiment or test suite, or establish a source-to-binary theorem.

## Complete final matrix and review state

The [15:20:48–15:20:55 UTC snapshot](summary.json) contains **97 contexts:
93 successful, three skipped, one failed and none pending**. The
[full check connection](checks.json) has two pages of at most fifty
rows. The [collector](check-collector.py.txt) checks the PR head and
selected last-commit identity on every page, stable declared count,
unique IDs/cursors and the terminal cardinality, plus before/after PR
metadata. Final artifact verification independently checked every
CheckRun's check-suite commit against the exact head.

The [complete review connection](threads.json) has one resolved thread,
both comments retained, and no unresolved thread. This preserves the
existing `PANELS` disposition; this reviewer made no new comment or
thread mutation. All [workflow runs](runs.json) at the checked head are
complete, including the successful post-merge archive hook. This remains
a bounded non-atomic snapshot of hosting state, not a guarantee that no
future metadata can be added.

| Final gate job | Job ID | Conclusion |
| --- | --- | --- |
| Linux ARM64 build and test | `101786169307` | SUCCESS |
| Linux x64 build and test | `101786169338` | SUCCESS |
| macOS build and test | `101786169280` | SUCCESS |
| TypeScript hermetic | `101786082473` | SUCCESS |
| Semgrep drift scan | `101786082682` | SUCCESS |
| Required aggregate | `101791432485` | SUCCESS |
| Historical drift advisory | `101791485850` | FAILURE |

The [required-check command output](required.json), full check rows and
[complete gate job inventory](jobs-34135719099.json) agree on the
successful required aggregate. The command's exit status alone is not
treated as evidence of success. Gate workflow `34135719099` finished
**FAILURE**, with 71 successful jobs and the one failed advisory.
Calling the whole matrix green would be inaccurate.

## The final failed advisory remains visible

The original [job metadata](job-101791485850.json) and
[losslessly compressed log](job-101791485850.log.gz) retain a real
exit-1 failure. The log is 23,289 original bytes, SHA256
`6bd3115b3649cb2f4156a16bf7479d2f2826bc1b83a335419017237fdbb0d05d`.
Its recent-main window reports **53 failures in 59 executions (89.8%),
clean streak one**, for each Windows leg, with last run `34131348700`.
The separate frozen-dashboard warning names `33238368515`; it is a
warning, not the cause of exit 1. Neither statement claims Windows
jobs ran on this PR head.

The [earlier `a2bf4225` snapshot](../pr-16928-a2bf4225-review/README.md),
[two completed `f3bd1347` runs](../pr-16928-f3bd1347-final/README.md),
and [BOM failure/correction record](../publication-json-bom-correction/README.md)
remain separate. Their cancelled dependencies, failed aggregates,
different drift windows and original logs are not replaced by the final
successes. This pass cancelled, reran and dismissed nothing.

## Committed bytes and landed correspondence

The executed [byte-review source](committed-byte-review.py.txt) and
[output](committed-byte-review.json) verify at the exact checked head:

- All nineteen scientific files equal their recorded SHA256 values and
  implementation archive `4fc82b611012bd2620a26e02afe6baba491fe553`.
- All eighteen original result records equal their recorded lengths,
  SHA256 values and result archive `900c0f57a51bfb79d7e9a7b8156ef367d97824f8`.
- All seven descriptive-figure files equal their original artifact
  commit `58a3999765766f117f6c6ab46dc436cb9a92397a`.
- The fifteen changed paths since `f3bd1347` are documentation artifacts.
  The compressed API response expands to the exact original 711,308 bytes;
  no stripping, reserialization or scientific repair is substituted.

The [merge proof](merge-proof.json) independently verifies ancestry on
refreshed `origin/main`, which equalled the merge at inspection. It also
compares **all 266 paths changed by the merge** against the checked head,
using identical Git blobs for present paths and absence for deleted paths.
The proof retains the raw [PR response](pr.json.gz), raw
[merge response](merge-commit.json.gz), [squash body](squash-body.txt),
[executed collector](merge-proof-collector.py.txt) and
[successful command output](merge-proof-attempt-2.log). The squash body
keeps the failed local/CI attempts, gzip correction, 7,568 passing local
tests plus six skips, and full AgencySignature. These are correspondence
and attribution checks; the earlier independent scientific and validation
reviews retain their own source pins and scopes.

## Collector refusal and artifact retention

An initial inline proof attempt fetched API/body records and checked
ancestry, then stopped before completing the changed-path comparison:
this writer did not yet contain the checked head's commit object. The
[explicit reviewer annotation](initial-merge-capture-refusal.json)
retains the observed failure and distinguishes it from an executed log.
The first raw [PR](initial-merge-capture-pr.json.gz),
[commit](initial-merge-capture-merge-commit.json.gz) and
[body](initial-merge-capture-squash-body.txt) remain available. After
[fetching that exact commit](checked-head-fetch.log) from the owner clone,
the retained standalone collector completed the comparison. The initial
failure is not represented as a successful proof or a source defect.

The [artifact inventory](manifest.json) binds all retained source/output
files and every gzip's decompressed original. Raw API responses and logs
remain losslessly recoverable. No original scientific receipt, source,
archive tag, PR setting or external actor's work changed during this review.
The next study still requires its own active implementation claim and
frozen admission contract; this publication proof does not waive them.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer.
