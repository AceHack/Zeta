# Society Heartbeat: Token Boundaries and Current Gate-Start Failure

**Inspection date:** 2026-08-17  
**Status:** The heartbeat delivery path must **not** be retried as a proof of healthy gated delivery until PR-trigger identity is repaired. The newest observed heartbeat run correctly failed loudly because review PR `#11551` had no `gate.yml` run.

> This is an implementation-boundary record. It does not reveal a secret value, assert a token grant that GitHub’s secret endpoint did not expose during inspection, or treat a workflow comment as a credential proof.

## Observed Authority Separation

| Authority | Intended bounded job | Observed source boundary | What this review establishes | What it does **not** establish |
|---|---|---|---|---|
| `ZETA_SOCIETY_DISPATCH_TOKEN` | Dispatch the named `society-heartbeat.yml` workflow on `main` from a trusted runner. | `src/Core.TypeScript/planning/society-heartbeat-dispatch.ts` constructs only the GitHub Actions workflow-dispatch request and explicitly has no browser import. | GitHub Pages has no import path to this token; the helper rejects an empty token and constrains owner/repository syntax. | The current stored secret’s value, expiry, or live grant; GitHub returned HTTP 503 for the repository-secret metadata query. |
| `ZETA_TELEMETRY_FLUSH_TOKEN` | Authenticate branch pushes for the periodic `agent-heartbeat.yml` flush lanes. | `agent-heartbeat.yml` uses it only as the checkout/push credential, with a real-network dry-run preflight and `GITHUB_TOKEN` fallback. | It is distinct from `ZETA_SOCIETY_DISPATCH_TOKEN`; the heartbeat test suite asserts the heartbeat workflow does not reference the dispatch token. | That the currently stored token can cause a PR-triggered required gate to start. |
| `ZETA_PR_ARCHIVE_TOKEN` | Authenticate `gh pr create` for archive review branches when the Actions identity is restricted by enterprise policy. | `pr-archive-on-merge.yml` supplies it only to the PR-creation command. Branch pushes remain authenticated by the persisted Actions credential. | The workflow design separates pull-request creation from branch write and workflow dispatch. | The current secret’s presence/value or real-time permission grant; the GitHub secret metadata endpoint was unavailable during inspection. |

## Current Operational Failure

The most recent observed `agent-heartbeat` run, `32052744482`, completed with failure. Its authoritative failed step was **“Fail if a heartbeat PR is old and gate never started.”** The log reports:

> `required-check-started: no gate.yml run exists for heartbeat PR(s): #11551 — gate (required) can never report`

That is a correct detection outcome, not evidence that the heartbeat content is bad or that the retry path is healthy. A retry before the trigger-identity/root-cause repair would only produce another branch or PR whose required gate cannot report. The safe order is therefore:

1. Inspect the event actor and PR head provenance for `#11551`, and establish why it did not trigger `gate.yml`.
2. Make the minimal delivery-identity repair and add a test that fails when a heartbeat review PR has no required gate run after the declared age bound.
3. Create one bounded heartbeat review branch and observe a real required gate start before merging any heartbeat evidence to `main`.
4. Only then use the dispatch authority to re-exercise a heartbeat and confirm its committed event-index evidence reaches the Pages interface.

## Current Confidence and Gaps

The code-path boundary is well specified: the browser does not dispatch workflows, the periodic flush token is not the society-dispatch token, and the archive PR credential is isolated to PR creation. The live-secret boundary is **not yet independently verifiable** because GitHub’s repository-secret metadata endpoint responded with HTTP 503 during this inspection. The record must remain explicit about that limitation instead of promoting source-code intent into an observed credential fact.

The gate-start alarm is valuable precisely because it can fail. It prevented a green-looking but ungated heartbeat from being treated as delivery proof. Until a fresh heartbeat PR visibly carries `gate (required)`, the delivery state remains **degraded and unproven**.
