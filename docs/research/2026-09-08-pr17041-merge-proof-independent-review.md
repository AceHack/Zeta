# Independent PR17041 merge and custody review

Date: 2026-09-08 UTC
Operational status: research-grade
Status: bounded corrected merge-proof acceptance
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

## Disposition and exact identities

I accept the corrected retained publication proof for
[PR17041](https://github.com/Lucent-Financial-Group/Zeta/pull/17041).
The observed head 7aeaf5687fa7668c770ba60e438c193a58a6af21 was squashed
to 155d45e32d01152004a03862213550ada96fb036 at the retained host time
2026-09-08T05:24:19Z. The merge's parent is
d35c2b35d1b06d04427a9a4f6972bd1331305af8. Its observed main identity
at the coordinator's proof capture is that same merge commit.

The [review custody index](pr17041-merge-review/2026-09-08/README.md)
records the independent procedures and complete input byte identities.
This review reads retained API/log/archive data and local Git objects.
It runs no kernel, projection solver, reference, replay, vector, training
or benchmark workload. It does not claim present-day main remains at the
historically observed commit.

The final coordinator receipt was read in the separate Oracle publication
writer at repository path
`docs/research/precision-gate-kernels/2026-09-08/pr-17041/README.md`.
Its exact inspected identity is 2,561 bytes, SHA256
53d5aa535279aa83a87089579acf1aae01449a41da0119649f266841854ae398.
The separate no-renames proof is 172,492 bytes, SHA256
430f8defad39f89725d63a52e5c617ac5ca8b4c43bea78ebd8a94a6a6c07683c.
These are the observed working-file bytes accepted before the coordinator's
later archive commit; this note does not invent that future commit identity.

## Tree equivalence and preserved count finding

An independent local `git merge-tree --write-tree` reconstruction of the
actual parent and reviewed head returned
ea55686f5cb2a8005ce1cc831fb876d86df28ad6, exactly the actual squash tree.
The command exited zero with empty stderr. It used the publication clone's
existing objects as read-only alternates; any generated objects were
directed into the reviewer's own private object directory. It did not
change either checkout, index, branch or remote. The original invocation
and output bytes are retained with this review.

The merge base of parent and head is
38b3acd14f0fc07449ace1b78311959f249468ed. Both merge-base-to-head and
parent-to-merge have the same 347-path no-renames change roster.
The original coordinator proof instead listed 346 paths, matching Git's
default rename-aware name listing. It checked the moved work item's
destination but omitted the old path:

~~~text
workitems/081M1ZCHPWV087G0R002GG2PKY-publish-distributional-learning-controls-and-privacy-grant-r.md
~~~

Git classified this as an R093 move into `workitems/done/2026/09/`.
Calling that 346-path list every changed tree path was a completeness and
wording defect. It was not evidence of an altered publication tree: the
independently reconstructed full tree still matches the squash tree.

The original `pr-17041-main-proof-1` records remain unchanged in the
coordinator archive. The separate `pr-17041-main-proof-2/proof.json`
uses `--no-renames` and retains 347 ordered rows, with actual merge/main
entries. I compared all original 346 per-path stdout records and their
empty stderr records with fresh local Git entries, then independently
checked all 347 corrected rows. The omitted old path is absent in both
the merge and observed-main tree, as the corrected proof records.
Modes and object identities match for every present selected path.

Observed main equals the merge at this capture, so their ancestry relation
is immediate. The independent three-way reconstruction is the separate
check that the published tree incorporates the reviewed head together
with the actual newer parent. The two checks must not be conflated.

## CI, branch rules and drift signal

Complete bounded observation 7 is bound to the exact head and contains
one GraphQL response with 92 unique check IDs. Both the context and thread
connections report no next page. The raw conclusions are 89 SUCCESS,
two SKIPPED and one FAILURE, all completed. The failed check is
`drift (loud)`. The single check named `gate (required)` is SUCCESS.
There are zero review threads in the returned complete thread connection.

The adapter's 91 `ok` count includes those two skipped checks; it must
not be called 91 successful executions. Its conservative required-set
summary explicitly warns that the actual required set was not enumerated
inside that adapter call. The separately retained rules2 response names
only `gate (required)` with integration ID 15368 as the required status
floor. The GraphQL query did not request check-app identity, so it does
not independently prove that additional association from its raw fields.
The actual host merge result is retained separately.

The full 34,401-byte drift log remains a real failed-check observation.
It reports a historical 60-run window, including 29/58 Windows-2025
failures and a macOS signal, and explicitly identifies its exclusion from
the required gate. It also warns that a deliberately disabled dashboard
publisher leaves a frozen snapshot. Its first reporter exits one; the
separate verdict-drought reporter exits zero after observing a recent
completed verdict, which was a failure. Detector liveness and a completed
verdict are not assertions that those platform runs succeeded. This review
does not relabel the drift failure as repaired or suppress its red status.

The retained status2 document reports operational GitHub components and
no incidents. That is a captured service-status response, not a guarantee
that the API snapshot was atomic or a merge lock. Observation time
2026-09-08T05:21:56.549Z precedes the retained merge time; no instantaneous
identity between these separate observations is asserted.

## Merge-command provenance and custody

The coordinator reports that its actual tool session 84021 ran

~~~text
gh pr merge 17041 --squash --match-head-commit 7aeaf5687fa7668c770ba60e438c193a58a6af21 --body-file .git/precision-publication-pr-body.md
~~~

inside a `set -e` shell, with separately redirected stdout/stderr and an
observed zero exit. No `--admin` option appears in that reported command.
No separate process-invocation JSON was captured. Both retained redirected
streams are empty and cannot independently establish the arguments or exit
code. The corrected README labels that command/exit provenance as the
coordinator's tool observation. The retained GitHub merged-state JSON
provides the actual head, squash commit and merge time independently of
those empty streams. This review neither fabricates an invocation record
nor treats the lack of one as proof that no merge occurred.

The coordinator manifest is 253,921 bytes with SHA256
5be73e3799fa1fede6b050b792fe2a3ef48258c86477adbcba07533f26569fc4.
Its 55,663-byte archive has SHA256
0bd9e2e450aa0d4049d8a2bd9ac16411a08f9a544091649f1b9c8f7d30fb393c.
I verified the complete gzip stream as a single member and its exact
1,454,080-byte tar identity. All 1,450 unique regular members match their
declared sizes and SHA256 values and their original publication-writer
files byte-for-byte. Their payloads total 438,265 bytes. No member was
extracted or executed. The original incomplete roster remains among them.
The corrected proof is a separate file and is not silently inserted into
the original tar history.

The earlier publication archive's four full-preflight records were also
byte-verified. They bind `bun run preflight` to
c1e6f0497afcc5078b03bfe8e797dc12e684cf58, exit zero, and all 18 executed
checks, including the build/test gate's summary. Its stderr is the retained
Bun command line, not an omitted empty stream. The archived normal-push
log reports all 16 quick checks passing. These are read-only checks of
existing records; this pass does not re-audit every numerical output or
claim a new full validation run at the squash commit.

The corrected README accurately distinguishes the raw check counts,
original path-roster defect and separate correction, host merge result,
command provenance, and historical service/drift observations. No remaining
material discrepancy was found in this bounded merge/custody review.

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
