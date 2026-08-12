# Society Replay and Temporary Dispatch Boundary

## Scope

This handoff records two distinct mechanisms. **Committed society evidence** is public, append-only, and replayable from Git. **Temporary dispatch** is a trusted-runner action and must never be exposed to GitHub Pages, browser storage, committed source, or event payloads.

## Committed replay evidence

`planning/society-evolution-runner.ts` now appends each `society-*.json` event to `docs/observe-events/society-index.json`. The index schema is `zeta.society.event-index/v1`. Each entry records the exact event-byte SHA-256 and a predecessor-linked chain digest over:

```text
[previousDigest, id, at, file, eventDigest, sourceRevision|null]
```

The index is **not a proof by assertion**. The validation path can fail on changed event bytes, a broken predecessor link, swapped records, duplicate identifiers, malformed event JSON, or an incorrect head digest. `society-event-index-rebuild.ts` deterministically bootstraps the index from existing committed `society-*.json` evidence, ordered by the events' native ISO timestamps rather than filenames.

GitHub Pages Race Mode fetches the raw manifest from `main`, checks the full chain in-browser, then independently recomputes SHA-256 for the ten newest indexed event files. The UI reports either **verified**, **index pending**, or **verification failed**; it never receives a credential.

## Heat-loop conformance

`heat-loop-conformance.test.ts` tests the full observable path:

```text
unaccounted teaching errors
  → BatchTeachingEnvelope.summary
  → TemperatureBand=critical
  → Network transport adapter
  → HeatAwareScheduler ×0.1 AIMD throttle
  → lower lane-selection frequency
  → successful drains +0.05 recovery, capped at 1.0
```

Negative controls assert that accounted erasures remain cold and that a bare transport failure, which has no teaching envelope, cannot fabricate a heat signal.

## Temporary trusted dispatch

While the GitHub App control harness is unavailable, `planning/society-heartbeat-dispatch.ts` can start the existing `society-heartbeat.yml` via GitHub's **workflow-dispatch** REST endpoint. It requires a fine-grained token restricted to:

| Setting | Required value |
|---|---|
| Resource owner | `Lucent-Financial-Group` |
| Repository access | Only `Zeta` |
| Permission | **Actions: read and write** |
| Storage | Repository Actions secret `ZETA_SOCIETY_DISPATCH_TOKEN` |

The token is accepted only from `process.env` in a trusted runner. The dispatch payload contains only `ref: main`, matching the pre-existing manual-dispatch contract. Tests assert an empty token makes no network request, and GitHub denial becomes a repairable teaching error. The token must not be emitted to logs, committed into any file, copied to `localStorage`, or sent through the GitHub Pages interface.

To run from a trusted TypeScript-capable environment after configuring the secret:

```text
ZETA_SOCIETY_DISPATCH_TOKEN=<injected-secret> bun src/Core.TypeScript/planning/society-heartbeat-dispatch.ts
```

For a human-only one-off tick, prefer the existing **Actions → society-heartbeat → Run workflow** control, which needs no token.
