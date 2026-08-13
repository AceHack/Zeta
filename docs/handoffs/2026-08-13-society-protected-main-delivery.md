# Society Heartbeat: Protected-Main Delivery Contract

**Status:** Implementation design; direct `main` push is falsified by observed run #87.

## Observed teaching error

The society evolution computation itself completed in run #87: it emitted a cold heat readout, created `society-msrr8mpc`, and regenerated the event index. The failure occurred only at delivery time, where GitHub rejected the direct push to protected `main` because `gate (required)` was expected. The correct repair is therefore not a retry and not a wider dispatch token; it is a branch-and-PR delivery path that lets the independent gate decide whether durable evidence is admitted to `main`.

## Delivery sequence

| Stage | Actor and credential | Allowed effect | Independent check |
|---|---|---|---|
| 1 | `society-heartbeat.yml` with ephemeral `GITHUB_TOKEN` | Compute one evolution event and rebuild its SHA-256 index. | Event-index and heat-loop conformance tests. |
| 2 | Same workflow with job-scoped `contents: write` | Push the committed event/index pair to `society/evolution-run-<run>-attempt-<attempt>`. | Protected `main` is never the push target. |
| 3 | `ZETA_PR_ARCHIVE_TOKEN` in Actions only | Create or reuse the branch PR against `main`. | Token has Pull requests: write only. |
| 4 | Repository gate | Evaluate the normal required checks on the PR. | The heartbeat cannot certify its own evidence. |
| 5 | Repository merge policy | Merge only after the required gate passes; branch deletion follows normal PR policy. | `main` remains the durable, reviewed source of truth. |

## Credential separation

| Secret or token | Fine-grained permission | May be used by | Must not be used by |
|---|---|---|---|
| `ZETA_SOCIETY_DISPATCH_TOKEN` | Actions: read and write; Metadata read is automatic | Trusted dispatch adapter only | Pages, browser code, event payloads, PR creation, git push. |
| `ZETA_PR_ARCHIVE_TOKEN` | Pull requests: read and write; Metadata read is automatic | PR creation/reuse only | Pages, browser code, event payloads, workflow dispatch, direct `main` push. |
| Workflow `GITHUB_TOKEN` | Job-scoped `contents: write` | Event/index branch write only | Protected `main` direct push, browser code. |

The society dispatcher and PR delivery code must fail with a **teaching error** that identifies the absent boundary and the generator for repair: missing dispatch token means configure `ZETA_SOCIETY_DISPATCH_TOKEN`; missing PR token means configure `ZETA_PR_ARCHIVE_TOKEN`; a rejected gate is evidence that the branch must remain unmerged rather than an invitation to bypass protection.

## Coordination with `pr-archive-on-merge`

Otto's archival workflow remains a separate consumer of `ZETA_PR_ARCHIVE_TOKEN` if its default `GITHUB_TOKEN` cannot create PRs under repository policy. It may archive only merged PR review substrate. The society heartbeat delivery PR is not an archival PR and must not be exempted from the archive workflow's ordinary merged-PR capture. This retains the durable review trail without coupling the society dispatch authority to archive branch writes.

## Acceptance criteria

1. A heartbeat produces one branch, never a direct `main` write.
2. An open PR is reusable on retry; duplicate branch/PR creation is idempotently avoided.
3. The independent required gate is visible on the PR before merge.
4. A gate failure leaves the branch and PR as inspectable evidence, not an orphaned hidden mutation.
5. No static site, browser component, or committed event can read either personal access token.
