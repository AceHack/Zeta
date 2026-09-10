# PR17051 publication and continuation: independent review

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade publication review
Lifecycle: active
Disposition: accepted with the retained wording correction
Work item: 081M1Z63YMC087G0R003N5FH9X

## Reviewed cuts and finding

The [publication packet](https://github.com/Lucent-Financial-Group/Zeta/blob/4fc4df58b031974f6f371f4cb1a58e19a630f33f/docs/research/research-main-publication/2026-09-08/pr-17051/README.md)
is accepted at `4fc4df58b031974f6f371f4cb1a58e19a630f33f`, with the integration
register's narrow correction at `6608fdacc5dce7da60cb0f61d004726b65d78ff0`.
No publication custody or main-tree mismatch was found.

The original register described the historical Python gate as "strict
mypy/format checks." Its retained invocation uses `-m mypy
--follow-imports=silent` over fourteen files, without `--strict`; the inspected
source-cut configuration does not establish that mode. The correction says
"the recorded mypy and format checks" and preserves their actual successful
outcome. This is a qualification of the command's scope, not a new type-check
failure. The exact original and corrected register bytes and invocation are
retained in the [review custody](pr17051-publication-review/2026-09-08/README.md).
That correction changes only the register; the packet and handoff are identical.

## Archive, final observations and merge

Every one of the 162 regular archive members matches its manifest length/hash
and the retained local original, without extracting or executing members.
The payload totals 3,545,216 bytes. The 338,621-byte archive has SHA256
`3C0845830B19D7ACBEBF80AFFC57B8A86DD6AEFD8F021ACF7FEF24FA7481C373`.
The manifest and archive also equal their immutable Git bytes at both reviewed
cuts. Earlier observations, the first failed CI-log retrieval, the subsequent
full lint-failure log, thread resolution, publication commands and helper
sources remain present; successful later observations do not erase them.

The final raw GraphQL response for head
`212758f124fbe7d42cf8073c7863fa99183c1d1a` contains 92 distinct completed check
runs: 90 SUCCESS and two SKIPPED. Both pagination cursors report no next page.
Its single review thread is resolved and outdated; there is no unresolved
thread or unfinished check. These are check conclusions, not an absence of
advisory workflow annotations. The published audit-helper correction equals
its separately reviewed source at `02c439f7e87d30fb5062cbafa21ffe8759e32da1`.

The required-check read records `gate (required)` as SUCCESS, matching the
observed branch rule. GitHub's contemporaneous status response reports Git
Operations, API Requests, Pull Requests and Actions operational. These reads
completed after the final observation and before the merge command. The
complete workflow watch for run 34211206223 returned zero earlier; it was not
rerun by this review.

The retained actual command uses `gh pr merge 17051 --squash
--match-head-commit 212758f124fbe7d42cf8073c7863fa99183c1d1a`, with its subject
and body file. It returned zero with empty stdout/stderr. No admin or automatic
merge flag is present. The subsequent PR response reports MERGED at
2026-09-08T10:11:44Z, within that command's recorded execution interval, at
`f59b6e395603062882dd1fe69fa8247406842e4d`.

## Independent Git and shared-view checks

The actual merge parent and comparison base both resolve to
`0d29df2db91b001bb1b7e39f6c55e906116f328b`. An independent `git merge-tree`
in the reviewer's own clone recomputes
`a32ee7be86a34c4a7cc39f99bd8b09243ef21ff9`, equal to the merged whole tree.
The other writer supplies read-only alternate objects; this review writes no
Git objects in that writer.

An independent no-renames diff yields exactly 1,063 distinct paths. Every
mode/type/blob identity agrees across the expected tree, merged commit and
the retained observed main. This particular roster contains no deletions;
the comparison still preserves absent entries explicitly. The independently
generated NUL-delimited path and tree outputs equal the retained raw proof.

The historical shared-view proof contains successful commands for clean
status, branch `main`, one `pull --ff-only origin main`, clean status afterward,
HEAD equal to the merge, and merge ancestry. Its raw streams agree with the
summary and ordered command records. This review neither refreshes the shared
view nor claims that a future main tip remains at that dated identity.

## Continuation and evidence boundaries

The original registered-run archive, manifest and observation, and the original
implementation archive and manifests, are byte-identical at their historical
cuts, reviewed PR head, merged main and corrected continuation cut. In
particular, input manifest
`FE1F5BDF732FA6B08092887210552BA9CEF68D724E519C77958A282366A348E7` remains
bound to the original assembled source; publication hygiene has not reassigned
the recorded experiment.

The register and handoff accurately carry the prior independent outcome
disposition: 40 IDs, 88 calls, twelve core certificates and 27 closed native
children. Cancellation remains an uncertified native candidate with reference
IterationLimit and certificate NoRootEnclosure. Those observations are inherited
from the separately completed outcome review, not numerically re-evaluated here.

The continuation treats mixed-message application and learned-module comparison
as next work. It retains proposed/certified/applied distinctions, the separate
application obligation, frozen training/query boundaries, failed-result
denominators and the need for a real comparative learning result. It does not
claim an implemented learner, opened dataset, global convergence or SOTA result.
Compiled streams 9307/9409 remain unopened and that investment paused. The wider
memory, cartel, geometry and resource hypotheses remain qualified rather than
being promoted by the scalar result.

The cited design review at `6f5c62198aaee8f758d726e0c4c514f3bab57b9a` is preserved
byte-for-byte. Its design was not reviewed again. Neither this publication
receipt nor that earlier design acceptance opens a numerical or training run.

## Reviewer execution and preservation

The first audit failed because this reviewer gave the extensionless merge
stdout/stderr filenames an incorrect `.txt` suffix. The exact executed helper,
empty stdout, traceback and completion are retained. Correcting only those two
locators yields a zero-exit audit with 1,210,333 bytes of complete JSON output
and empty stderr. A separate continuity comparison also returned zero with
empty stderr. Both helpers and their actual invocation records are retained.
This is a reviewer inspection defect, not a producer evidence defect.

Work comprised retained-byte inspection, JSON/TOML interpretation, hashing,
Git comparisons and documentation checks. No audited helper, historical CI
workflow, numerical service, registered driver, solver, learner or training
workload was executed. No assertion-disabled safety or complete runtime-closure
claim is made. Normal preservation-push checks are separate repository hygiene.

Signed: Vera, OpenAI Codex using GPT-6 Astra, 2026-09-08 UTC.
