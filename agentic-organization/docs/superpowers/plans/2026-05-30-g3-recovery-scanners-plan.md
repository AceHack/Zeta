# G3 Recovery Scanners Plan

## Goal

Add the recovery-scanner moat over the V9 reaction-plan lifecycle and adjacent runtime evidence:

- `stale-reaction-plan-scan`
- `stranded-schedule-scan`
- `abandoned-run-binding-scan`
- `dead-letter-classifier`

The scanners must be event-first, recovery-scan-second, and fail-open on transient adapter errors.

## Design

1. Add a pure application module that classifies recovery incidents from already-durable snapshots:
   reaction plans, schedule blocks, Hermes run bindings, and terminal failed/dead-lettered reaction plans.
2. Add Cockroach reader adapters that expose bounded scan inputs without mutating lifecycle rows.
3. Add four cadence lanes in the worker. Each lane reads one scanner source, emits recovery `OrgEvent`
   evidence for findings plus a scan-completed event, and returns degraded status instead of throwing on
   transient failures.
4. Compose the lanes into the always-on org cadence loop with independent intervals.
5. Add a KIND proof runner that seeds live Cockroach with one stale plan, one stranded schedule block,
   one abandoned Hermes run, and one failed/dead-lettered plan, then runs all scanner lanes and prints
   `PROOF: PASS`.

## Tests First

- Application unit tests for the four pure scanners and threshold boundaries.
- Worker lane tests proving evidence events are emitted and read/write errors fail open.
- Cockroach adapter unit tests proving the reader queries are bounded, tenant-scoped, and use the expected lifecycle predicates.

## Verification

- `npm run typecheck`
- `npm test`
- Rebuild/reload the worker image into KIND, restart the deployment, confirm clean boot and the four new lanes.
- Run `deploy/run-recovery-scanners.ts` against in-cluster Cockroach and require `PROOF: PASS`.
- Update `docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md`.
- Request subagent review, fix findings, rerun the gate, then commit with the Codex co-author trailer.
