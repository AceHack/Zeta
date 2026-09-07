# Required-check pagination: a present gate was reported absent

Date: 2026-09-07
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK76XQ087G0R000Y23NGM

## Observed defect

The scheduled [gate-presence run 34101855387](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/34101855387)
failed on main `a0ffd1bff714f4bcc6fbf31a9a64792aed5846ec`, claiming that
PR #16911 had no live gate workflow and its required check could never report.
The exact PR head was `594aee771a9e20c4f72b6f03b54aa8e27072523a`.

That diagnosis was false. Its [gate run 34080406671](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/34080406671)
was a completed `pull_request` run for that head. The
[required gate job](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/34080406671/job/101617395837)
passed at 03:59:11 UTC. `gh pr checks 16911 --required` exited zero. A separate
advisory drift job failed; neither its failure nor the workflow's aggregate
failure erased the already published required check.

With GitHub CLI 2.98.0, the detector's `gh pr list` call returned 100 check
contexts and omitted the required name. The PR-context GraphQL response
reported `totalCount=103`, `hasNextPage=true` and cursor `MTAw`. The second
page contained the successful required check, the failed advisory drift
check and the successful CodeQL check. The original detector treated this
truncated list-negative as complete, then interpreted the completed workflow
as unable to publish a check which had already been published.

The [captured witness](data/2026-09-07-required-check-pagination-witness.json)
retains the list projection, both PR-context pages, exact head, baseline source
hash, CLI version and run identities. The
[before output](data/2026-09-07-required-check-pagination-before.txt) records
exit 1 from the unmodified source. The
[after output](data/2026-09-07-required-check-pagination-after.txt) records
exit 0 after the repair, with the same unrelated PR left untouched.

## Repair and limits

A missing name in the PR-list prefix is now only a candidate. Before counting
workflow runs, the detector pages the PR's own last-commit check contexts.
It verifies the observed PR head and commit SHA on every page. Only a complete
negative proceeds to the existing queued-versus-stalled classifier.

Missing or malformed data, GraphQL/transport errors, a changed head or count,
repeated context IDs or cursors, an incomplete final page and the 100-page
resource cap all produce exit 2, meaning unmeasured. They cannot manufacture
an absent-check verdict. The maximum is 100 pages of 100 contexts per
candidate; existing bounded transient retries still apply to each host call.
The reader does not claim an atomic snapshot of GitHub's mutable check data.

The query retains the PR-to-last-commit path used by the original listing;
it does not substitute a repository-wide commit lookup or change the meaning
of a named CheckRun. Legacy status contexts count toward page completeness
but do not become named CheckRuns. Existing workflow-run counting, required
check policy and workflow permissions remain unchanged. The
[GitHub CLI API documentation](https://cli.github.com/manual/gh_api)
documents typed fields, repository placeholders and GraphQL pagination cursors.

GitHub's Pull Requests, Actions, API Requests and Webhooks components reported
operational during diagnosis. The live CI Gate ruleset names only
`gate (required)` from integration 15368. The presence watchdog is advisory
and is absent from that gate's dependency list. This false alarm did not
establish a forge outage or block a separate correctly gated documentation PR.
No other actor's PR was edited, cancelled, rerun or commented on.

## Validation and review

All 36 focused tests pass, including a real detector CLI invocation against a
local two-page `gh` fixture. The trace proves that page two is read and the
terminal-workflow inference is never invoked when the required check is found.
Portable cases retain genuine absence, queued/terminal distinctions and all
listed pagination refusals. The executable shim case is explicitly POSIX-only;
the remaining pagination tests do not depend on a host executable shim.
TypeScript checking passes with no diagnostics.

The initial direct-commit query was refined to the original PR query path
before source review/publication. Both final focused tests and the live
read-only after check were repeated against that PR-scoped implementation.
All sixteen quick-preflight checks pass. Independent review by the root Vera
agent accepted source commit `04a61eeb0d756b645a391f0593f0749eab7b7b49`
with no actionable correctness finding: the review covered exact PR/head
binding on every page, context/count/cursor completeness, unmeasured failures,
legacy-context handling and the executable second-page regression. Its sole
formatting observation, indentation of the typed-number assertion, was
corrected before publication; no test meaning or runtime source changed.
The review did not rerun experiments or make a statistical claim.
