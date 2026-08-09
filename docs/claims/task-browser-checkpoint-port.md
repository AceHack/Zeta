# Claim - task-browser-checkpoint-port

- **Session ID:** codex/3f8e2c71
- **Harness:** OpenAI Codex - Vera (GPT-5.5 max)
- **Claimed at:** 2026-08-09T15:12:55Z
- **ETA:** 2026-08-09T16:45:00Z
- **Scope:** Extract the browser checkpoint contract from the IndexedDB adapter so persistence is selected through an owned hexagonal port.
- **Durable target:** `src/Core.TypeScript/browser-node/`, durable browser runtime imports, focused contract tests, and this claim.
- **Platform mirror:** GitHub pull request.

## Evidence

- `BrowserCheckpointPort`, its record schema, feedback, and validation currently live in `browser-indexeddb-checkpoint.ts`.
- The durable room runtime imports its inward-facing contract from an outward IndexedDB adapter module.

## Exit

- A technology-neutral checkpoint port owns the browser persistence contract.
- IndexedDB depends on and implements the port as one replaceable adapter.
- Contract tests can be reused by a future ZetaDB browser adapter without importing IndexedDB.
- Focused browser tests, the production browser smoke, and repository gates pass.
